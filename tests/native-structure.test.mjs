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

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), "utf8");
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
  assert.deepEqual(cultivation.lecturasAmbientales, [
    {
      fecha: "2026-08-08T12:00:00.000Z",
      temperatura: 24.5,
      humedad: 62,
      humidificadorEncendido: true,
    },
  ]);
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
