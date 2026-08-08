import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("renderiza la entrada local-first del asistente", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<title>Raíz — Asistente hidropónico<\/title>/i);
  assert.match(html, /Tu cultivo,[\s\S]*con contexto/i);
  assert.match(html, /Iniciar ejemplo Eyeballz/i);
  assert.match(html, /Funciona sin backend/i);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton|Starter Project/i);
});

test("mantiene plantilla, persistencia y dominio como piezas separadas", async () => {
  const [entry, storage, template, example] = await Promise.all([
    readFile(new URL("../lib/index.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/cultivo/storage.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/cultivo/eyeballz-template.ts", import.meta.url), "utf8"),
    readFile(new URL("../examples/eyeballz-4-dwc.example.json", import.meta.url), "utf8"),
  ]);
  assert.match(entry, /createCultivationFromTemplate/);
  assert.match(entry, /exportBackup/);
  assert.match(storage, /indexedDB/);
  assert.match(template, /EYEBALLZ_TEMPLATE/);
  const parsed = JSON.parse(example);
  assert.equal(parsed.configuracion.plan.semanas.length, 15);
  assert.equal(parsed.configuracion.dwcs.length, 4);
  assert.equal(parsed.configuracion.plantas.length, 4);
});
