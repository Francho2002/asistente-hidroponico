import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import test from "node:test";
import { validateTemplate } from "../js/template.js";
import {
  calendarWeek,
  formatDecimal,
  normalizeCultivation,
  parseDecimal,
} from "../js/domain.js";
import { createAmbientalFeatures } from "../js/features/ambiental.js";
import { buildAiTemplatePrompt } from "../js/features/plantilla-ia.js";
import {
  createSonoffHomeAssistant,
  parseHomeAssistantStates,
} from "../js/features/sonoff-home-assistant.js";
import {
  publicSonoffConnection,
  validateSonoffConnection,
} from "../js/core/sonoff-connection.js";
import {
  applyMergePlan,
  buildSyncFile,
  compareClocks,
  createMergePlan,
  stampLocalMutation,
  validateSyncFile,
} from "../js/core/sync.js";
import { createStore } from "../js/core/store.js";

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), "utf8");
const syncCultivation = () => normalizeCultivation({
  id: "cultivo-sync",
  nombre: "Prueba",
  variedad: "Prueba",
  estado: { semanaActiva: 1, etapaActiva: "Vegetativo temprano" },
  plan: { semanas: [{ semana: 1, etapa: "Vegetativo temprano" }] },
  dwcs: [{ id: "dwc-1", nombre: "DWC 1" }], plantas: [{ id: "planta-1", nombre: "A" }],
  equipos: [], fuentesVariables: [], reglasAlertas: [], eventos: [], tareas: [], alertas: [], asignaciones: [], inventario: [], lecturasAmbientales: [],
});

test("formato de sincronización conserva la identidad y no contiene token Sonoff", () => {
  const cultivation = syncCultivation();
  cultivation.eventos.push({ id: "evento-a", tipo: "observacion", texto: "ok" });
  stampLocalMutation(cultivation, syncCultivation(), "pc");
  const file = buildSyncFile(cultivation, "2026-08-08T12:00:00.000Z");
  assert.equal(file.tipo, "sincronizacion");
  assert.equal(file.cultivoUid, "cultivo-sync");
  assert.equal(validateSyncFile(file), file);
  assert.doesNotMatch(JSON.stringify(file), /secreto-sonoff/i);
});

test("une registros independientes de PC y teléfono sin duplicar eventos ni lecturas", () => {
  const base = syncCultivation();
  const pc = structuredClone(base);
  pc.eventos.push({ id: "evento-pc", tipo: "observacion", observacion: "PC" });
  pc.lecturasAmbientales.push({ id: "lectura-pc", fecha: "2026-08-08T10:00:00Z", temperatura: 24, humedad: 60 });
  stampLocalMutation(pc, base, "pc");
  const phone = structuredClone(base);
  phone.eventos.push({ id: "evento-tel", tipo: "observacion", observacion: "Teléfono" });
  phone.lecturasAmbientales.push({ id: "lectura-tel", fecha: "2026-08-08T10:01:00Z", temperatura: 25, humedad: 61 });
  stampLocalMutation(phone, base, "telefono");
  const merged = applyMergePlan(createMergePlan(pc, phone));
  assert.deepEqual(merged.eventos.map((item) => item.id).sort(), ["evento-pc", "evento-tel"]);
  assert.deepEqual(merged.lecturasAmbientales.map((item) => item.id).sort(), ["lectura-pc", "lectura-tel"]);
});

test("cambio concurrente del mismo objeto queda como conflicto y exige resolución", () => {
  const base = syncCultivation();
  const pc = structuredClone(base);
  pc.dwcs[0].nombre = "DWC PC";
  stampLocalMutation(pc, base, "pc");
  const phone = structuredClone(base);
  phone.dwcs[0].nombre = "DWC teléfono";
  stampLocalMutation(phone, base, "telefono");
  const plan = createMergePlan(pc, phone);
  assert.equal(plan.conflicts.length, 1);
  assert.throws(() => applyMergePlan(plan), /Elegí una versión/);
  const resolved = applyMergePlan(plan, { "dwcs:dwc-1": "imported" });
  assert.equal(resolved.dwcs[0].nombre, "DWC teléfono");
  assert.deepEqual(resolved.dwcs[0]._sync.clock, { pc: 1, telefono: 1 });
  assert.equal(compareClocks(pc.dwcs[0]._sync.clock, phone.dwcs[0]._sync.clock), "concurrent");
});

test("la resolución de configuración raíz aplica el payload elegido", () => {
  const base = syncCultivation();
  const pc = structuredClone(base);
  pc.nombre = "Cultivo PC";
  stampLocalMutation(pc, base, "pc");
  const phone = structuredClone(base);
  phone.nombre = "Cultivo teléfono";
  stampLocalMutation(phone, base, "telefono");
  const plan = createMergePlan(pc, phone);
  assert.equal(plan.conflicts[0].key, "raiz:configuracion");
  const merged = applyMergePlan(plan, { "raiz:configuracion": "imported" });
  assert.equal(merged.nombre, "Cultivo teléfono");
  assert.equal(merged.configuracion, undefined);
  assert.deepEqual(merged._sync.rootClock, { pc: 1, telefono: 1 });
});

test("un conflicto de estado se resuelve dentro de estado sin escribir campos en la raíz", () => {
  const base = syncCultivation();
  const pc = structuredClone(base);
  pc.estado = { semanaActiva: 2, etapaActiva: "Preflora" };
  stampLocalMutation(pc, base, "pc");
  const phone = structuredClone(base);
  phone.estado = { semanaActiva: 2, etapaActiva: "Vegetativo tardío" };
  stampLocalMutation(phone, base, "telefono");
  const plan = createMergePlan(pc, phone);
  assert.equal(plan.conflicts[0].key, "raiz:estado");
  const merged = applyMergePlan(plan, { "raiz:estado": "imported" });
  assert.deepEqual(merged.estado, phone.estado);
  assert.equal(merged.semanaActiva, undefined);
  assert.equal(merged.etapaActiva, undefined);
});

test("una copia de sincronización importada conserva clocks y acepta un cambio unilateral", async () => {
  const pc = syncCultivation();
  const initial = structuredClone(pc);
  stampLocalMutation(pc, { ...initial, id: "", dwcs: [] }, "pc");
  const exported = buildSyncFile(pc);
  const phoneStore = createStore({
    now: () => "2026-08-08T12:00:00.000Z",
    saveState: async () => {},
    normalizeCultivation,
    deviceId: "telefono",
    stampLocalMutation,
  });
  await phoneStore.add(structuredClone(exported.cultivo), { preserveSyncMetadata: true });
  const pcChanged = structuredClone(pc);
  pcChanged.dwcs[0].nombre = "DWC cambiado en PC";
  stampLocalMutation(pcChanged, pc, "pc");
  const plan = createMergePlan(phoneStore.selected(), pcChanged);
  assert.equal(plan.summary.conflicts, 0);
  assert.equal(applyMergePlan(plan).dwcs[0].nombre, "DWC cambiado en PC");
});

test("no fusiona UIDs distintos, conserva etapa más avanzada y undo se invalida al cambiar", async () => {
  const local = syncCultivation();
  const foreign = syncCultivation();
  foreign.id = "otro-cultivo";
  assert.throws(() => createMergePlan(local, foreign), /otro cultivo/i);
  const newer = structuredClone(local);
  newer.estado = { semanaActiva: 3, etapaActiva: "Flora" };
  stampLocalMutation(newer, local, "telefono");
  assert.equal(applyMergePlan(createMergePlan(local, newer)).estado.semanaActiva, 3);
  let saved;
  const store = createStore({
    now: () => "2026-08-08T12:00:00.000Z",
    saveState: async (state) => { saved = structuredClone(state); },
    normalizeCultivation,
    deviceId: "pc",
    stampLocalMutation,
  });
  await store.add(local);
  const incoming = structuredClone(local);
  incoming.eventos.push({ id: "evento-importado", tipo: "observacion" });
  stampLocalMutation(incoming, local, "telefono");
  await store.applySync(applyMergePlan(createMergePlan(local, incoming)));
  assert.equal(store.canUndoSync(), true);
  assert.equal(store.selected().eventos.length, 1);
  assert.equal(await store.undoSync(), true);
  assert.equal(store.selected().eventos.length, 0);
  await store.applySync(applyMergePlan(createMergePlan(local, incoming)));
  await store.update((cultivation) => { cultivation.nombre = "Cambio posterior"; });
  assert.equal(store.canUndoSync(), false);
  assert.ok(saved.syncUndo === null);
});
test("entrega una aplicación estática con módulos ES", async () => {
  const [html, css, app, storage, panel] = await Promise.all([
    read("index.html"),
    read("styles.css"),
    read("js/app.js"),
    read("js/storage.js"),
    read("js/ui/pages/panel.js"),
  ]);
  assert.match(html, /<main id="main"/);
  assert.match(html, /type="module" src="js\/app\.js"/);
  assert.match(html, /public\/og\.png/);
  assert.match(html, /public\/favicon\.svg/);
  assert.match(css, /data-theme/);
  assert.match(css, /\[hidden\]\s*\{\s*display:\s*none\s*!important/);
  assert.match(panel, /canvas/);
  assert.match(storage, /indexedDB/);
});

test("el prompt de IA pide una plantilla JSON estricta y usa el ejemplo como esquema", async () => {
  const template = JSON.parse(await read("examples/eyeballz-4-dwc.example.json"));
  const prompt = buildAiTemplatePrompt(template);
  assert.match(prompt, /exclusivamente el JSON final/i);
  assert.match(prompt, /"tipo": "plantilla"/);
  assert.match(prompt, /no inventes datos no confirmados/i);
  assert.match(prompt, /Home Assistant \+ SonoffLAN/);
  assert.match(prompt, /Eyeballz/);
});

test("la configuración de Home Assistant mantiene el token fuera de la superficie pública", () => {
  const check = validateSonoffConnection({
    baseUrl: "https://ha.local:9443/",
    token: "secreto-local",
    temperatureEntityId: "sensor.temperatura",
    humidityEntityId: "sensor.humedad",
    humidifierEntityId: "switch.humidificador",
    intervalSeconds: 5,
  }, "http:");
  assert.equal(check.valid, true);
  assert.equal(check.value.intervalSeconds, 15);
  assert.deepEqual(publicSonoffConnection(check.value), {
    baseUrl: "https://ha.local:9443",
    temperatureEntityId: "sensor.temperatura",
    humidityEntityId: "sensor.humedad",
    humidifierEntityId: "switch.humidificador",
    intervalSeconds: 15,
  });
  assert.match(
    validateSonoffConnection({ ...check.value, baseUrl: "http://ha.local:8123" }, "https:").message,
    /mixed content|HTTPS/i,
  );
});

test("el conector consulta estados de Home Assistant y registra una lectura automática", async () => {
  const calls = [];
  const saved = new Map();
  const readings = [];
  const connector = createSonoffHomeAssistant({
    now: () => "2026-08-08T12:00:00.000Z",
    pageProtocol: "http:",
    storage: {
      getItem: (key) => saved.get(key) || null,
      setItem: (key, value) => saved.set(key, value),
      removeItem: (key) => saved.delete(key),
    },
    recordReadings: async (next, source) => readings.push({ next, source }),
    fetchImpl: async (url) => {
      calls.push(url);
      const state = url.includes("temperatura") ? "24.4" : url.includes("humedad") ? "61" : "on";
      return { ok: true, json: async () => ({ state }) };
    },
  });
  connector.start("cultivo-prueba");
  const result = await connector.configure({
    baseUrl: "https://ha.local:8123",
    token: "secreto",
    temperatureEntityId: "sensor.temperatura",
    humidityEntityId: "sensor.humedad",
    humidifierEntityId: "switch.humidificador",
    intervalSeconds: 60,
  });
  assert.equal(result.ok, true);
  assert.equal(calls.length, 3);
  assert.deepEqual(readings.at(-1), {
    next: [{
      fecha: "2026-08-08T12:00:00.000Z",
      temperatura: 24.4,
      humedad: 61,
      humidificadorEncendido: true,
    }],
    source: { modo: "automatica", etiqueta: "Home Assistant + SonoffLAN" },
  });
  connector.forget();
  assert.equal(saved.size, 0);
  assert.equal(connector.getConfiguration(), null);
});

test("los fondos PWM locales cubren todas las etapas y el panel usa el conector", async () => {
  const [css, panel, app, settings, html] = await Promise.all([
    read("styles.css"),
    read("js/ui/pages/panel.js"),
    read("js/app.js"),
    read("js/ui/pages/configuracion.js"),
    read("index.html"),
  ]);
  for (const asset of [
    "montanas-serenas", "oceano-profundo", "dunas-doradas", "sombras-botanicas", "bosque-en-niebla", "cielo-nocturno",
  ]) {
    await access(new URL(`../public/assets/backgrounds/${asset}.webp`, import.meta.url), constants.F_OK);
    assert.match(css, new RegExp(`backgrounds/${asset}\\.webp`));
  }
  for (const stage of ["enraizado", "vegetativo-temprano", "vegetativo-tardio", "preflora", "flora-estiramiento", "flora-engorde", "maduracion", "lavado", "cosecha"])
    assert.match(css, new RegExp(`data-stage="${stage}"`));
  assert.match(css, /--stage-background/);
  assert.match(panel, /Home Assistant \+ SonoffLAN/);
  assert.doesNotMatch(panel, /Importar lecturas JSON/);
  assert.match(settings, /Importar lecturas JSON \(respaldo\)/);
  assert.match(html, /welcome-ai-template/);
  assert.match(app, /createSonoffHomeAssistant/);
});

test("el parser de estados de Home Assistant exige números y switch on", () => {
  assert.deepEqual(
    parseHomeAssistantStates([{ state: "25" }, { state: "58.5" }, { state: "on" }], "2026-08-08T12:00:00.000Z"),
    { fecha: "2026-08-08T12:00:00.000Z", temperatura: 25, humedad: 58.5, humidificadorEncendido: true },
  );
  assert.throws(() => parseHomeAssistantStates([{ state: "x" }, { state: "58" }, { state: "off" }]), /temperatura no numérica/);
});
test("mantiene la plantilla Eyeballz y el ciclo semanal completo", async () => {
  const template = JSON.parse(
    await read("examples/eyeballz-4-dwc.example.json"),
  );
  assert.equal(template.tipo, "plantilla");
  assert.equal(template.configuracion.dwcs.length, 4);
  assert.equal(template.configuracion.plantas.length, 4);
  assert.deepEqual(
    template.configuracion.plan.semanas.map((x) => x.semana),
    Array.from({ length: 15 }, (_, i) => i),
  );
});
test("rechaza copias de seguridad incompletas", () => {
  assert.throws(
    () =>
      validateTemplate({
        formato: "asistente-cultivo",
        version: 1,
        tipo: "copia-seguridad",
        cultivo: { id: "x" },
      }),
    /incompleta|estructura/i,
  );
});
test("normaliza lecturas ambientales heredadas", () => {
  const cultivation = normalizeCultivation({
    eventos: [
      {
        tipo: "lectura_ambiental",
        fecha: "2026-08-08T12:00:00.000Z",
        valores: {
          temperaturaAmbiente: { valor: 24.5 },
          humedad: { valor: 62 },
          humidificadorEncendido: { valor: true },
        },
      },
    ],
  });
  const reading = cultivation.lecturasAmbientales[0];
  assert.equal(reading.fecha, "2026-08-08T12:00:00.000Z");
  assert.equal(reading.temperatura, 24.5);
  assert.equal(reading.humedad, 62);
  assert.equal(reading.humidificadorEncendido, true);
  assert.match(reading.id, /^lecturasAmbientales-/);
  assert.deepEqual(reading._sync.clock, {});
});
test("el calendario avanza solo, pero la etapa confirmada permanece separada", () => {
  const start = "2026-08-01T12:00:00.000Z";
  assert.equal(calendarWeek(start, "2026-08-01T12:00:00.000Z"), 0);
  assert.equal(calendarWeek(start, "2026-08-08T11:59:59.000Z"), 0);
  assert.equal(calendarWeek(start, "2026-08-08T12:00:00.000Z"), 1);
  assert.equal(calendarWeek(start, "2027-01-01T12:00:00.000Z"), 14);
  assert.equal(calendarWeek(start, "2026-07-20T12:00:00.000Z"), 0);
});
test("acepta coma decimal y presenta valores en español", () => {
  assert.equal(parseDecimal("5,8"), 5.8);
  assert.equal(parseDecimal("1.5"), 1.5);
  assert.ok(Number.isNaN(parseDecimal("cinco")));
  assert.equal(formatDecimal(1.5), "1,5");
});
test("addAlert crea una alerta con la regla que la originó", () => {
  const features = createAmbientalFeatures({
    id: () => "alerta-prueba",
    now: () => "2026-08-08T12:00:00.000Z",
  });
  const cultivation = {
    alertas: [],
    reglasAlertas: [{ id: "ph-general", activa: true }],
  };
  assert.equal(
    features.addAlert(
      cultivation,
      "ph-general",
      "alerta",
      "pH fuera de rango",
      "Se registró pH 7,0.",
      { tipo: "dwc", id: "dwc-1" },
    ),
    true,
  );
  assert.deepEqual(cultivation.alertas, [
    {
      id: "alerta-prueba",
      reglaId: "ph-general",
      severidad: "alerta",
      titulo: "pH fuera de rango",
      detalle: "Se registró pH 7,0.",
      alcance: { tipo: "dwc", id: "dwc-1" },
      creadaEn: "2026-08-08T12:00:00.000Z",
      estado: "activa",
    },
  ]);
  assert.equal(
    features.addAlert(
      cultivation,
      "ph-general",
      "alerta",
      "pH fuera de rango",
      "Duplicada.",
      { tipo: "dwc", id: "dwc-1" },
    ),
    false,
  );
});
test("no deja código legado", async () => {
  const app = await read("js/app.js");
  assert.doesNotMatch(
    app,
    /submitModalLegacy|importSonoffLegacy|saveSettingsLegacy/,
  );
  assert.doesNotMatch(app, new RegExp("[\\u00c3\\u00c2]"));
});
test("navega como SPA y el diálogo permite cancelar sin validar", async () => {
  const [html, app, router, modal] = await Promise.all([
    read("index.html"),
    read("js/app.js"),
    read("js/ui/router.js"),
    read("js/ui/modal.js"),
  ]);
  assert.match(html, /id="route-stage"/);
  assert.doesNotMatch(html, /id="panel-view"/);
  assert.match(html, /data-modal-close/);
  assert.match(html, /id="modal-submit" type="submit"/);
  assert.match(app, /createHashRouter/);
  assert.match(router, /hashchange/);
  assert.match(router, /route-leave/);
  assert.match(router, /navigationId/);
  assert.match(modal, /button\.type = "button"/);
  assert.match(modal, /dialog\.addEventListener\("cancel"/);
});
test("mantiene el flujo híbrido y superficies PWM sin exportar en el panel", async () => {
  const [html, css, app, panel, cycle, registro] = await Promise.all([
    read("index.html"),
    read("styles.css"),
    read("js/app.js"),
    read("js/ui/pages/panel.js"),
    read("js/features/ciclo.js"),
    read("js/features/registro.js"),
  ]);
  assert.doesNotMatch(html, /id="export-button"/);
  assert.match(app, /setInterval/);
  assert.match(app, /Semana confirmada/);
  assert.match(app, /name="fechaInicio"/);
  assert.match(cycle, /week > calendarWeek/);
  assert.match(panel, /Semana calendario/);
  assert.match(app, /data-stage/);
  assert.match(registro, /inputmode="decimal"/);
  assert.match(registro, /parseDecimal/);
  assert.match(css, /--bg: #111418/);
  assert.match(css, /--surface: #1a1f26/);
  assert.match(css, /--accent: #1d4ed8/);
  assert.match(css, /data-stage="flora-engorde"/);
  assert.match(css, /@media \(max-width: 390px\)/);
  assert.match(css, /nav \{ order: 3; flex: 0 0 100%/);
  assert.match(css, /\.route-page::before \{ inset: 2\.5rem 0 -1rem; \}/);
  assert.match(css, /@media \(max-width: 340px\)/);
  assert.match(css, /nav \{ display: grid; grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(css, /\.numbers \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\); \}/);
});
test("separa rutas, páginas y funcionalidades en módulos nativos", async () => {
  const app = await read("js/app.js");
  for (const module of [
    "./ui/router.js",
    "./ui/modal.js",
    "./ui/pages/panel.js",
    "./ui/pages/historial.js",
    "./ui/pages/inventario.js",
    "./ui/pages/configuracion.js",
    "./features/ambiental.js",
    "./features/registro.js",
  ]) {
    assert.match(
      app,
      new RegExp(module.replaceAll(".", "\\.").replaceAll("/", "\\/")),
    );
  }
});
test("no duplica mutaciones de registro en el bootstrap", async () => {
  const [app, registro, ciclo] = await Promise.all([
    read("js/app.js"),
    read("js/features/registro.js"),
    read("js/features/ciclo.js"),
  ]);
  assert.match(app, /return registro\.submit\(action, data\)/);
  assert.doesNotMatch(app, /Código de migración|tipo: "medicion_solucion"/);
  assert.match(registro, /tipo: "medicion_solucion"/);
  assert.match(ciclo, /async function saveSettings/);
});
test("no deja fuentes ni configuración del stack anterior", async () => {
  for (const file of [
    "app",
    "lib",
    "worker",
    "build",
    "vite.config.ts",
    "next.config.ts",
    "tsconfig.json",
    "pnpm-lock.yaml",
  ]) {
    await assert.rejects(
      access(new URL(`../${file}`, import.meta.url), constants.F_OK),
    );
  }
  const files = await Promise.all(
    [
      "index.html",
      "styles.css",
      "js/app.js",
      "js/domain.js",
      "js/storage.js",
      "js/template.js",
    ].map(read),
  );
  assert.doesNotMatch(
    files.join("\n"),
    /react|vinext|next(?:\.js)?|tailwind|typescript/i,
  );
});
