import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import test from "node:test";
import { validateTemplate } from "../js/template.js";
import { normalizeCultivation } from "../js/domain.js";

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), "utf8");
test("entrega una aplicación estática con módulos ES", async () => {
  const [html, css, app, storage] = await Promise.all([
    read("index.html"),
    read("styles.css"),
    read("js/app.js"),
    read("js/storage.js"),
  ]);
  assert.match(html, /<main id="main"/);
  assert.match(html, /type="module" src="js\/app\.js"/);
  assert.match(html, /public\/og\.png/);
  assert.match(html, /public\/favicon\.svg/);
  assert.match(css, /data-theme/);
  assert.match(app, /canvas/);
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
    eventos: [{ tipo: "lectura_ambiental", fecha: "2026-08-08T12:00:00.000Z", valores: { temperaturaAmbiente: { valor: 24.5 }, humedad: { valor: 62 }, humidificadorEncendido: { valor: true } } }],
  });
  assert.deepEqual(cultivation.lecturasAmbientales, [{ fecha: "2026-08-08T12:00:00.000Z", temperatura: 24.5, humedad: 62, humidificadorEncendido: true }]);
});
test("no deja código legado", async () => {
  const app = await read("js/app.js");
  assert.doesNotMatch(
    app,
    /submitModalLegacy|importSonoffLegacy|saveSettingsLegacy/,
  );
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
