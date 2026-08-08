import { loadState, saveState, clearState } from "./storage.js";
import { loadEyeballzTemplate, validateTemplate } from "./template.js";
import { createHashRouter } from "./ui/router.js";
import { createModal } from "./ui/modal.js";
import { card, escapeHtml as escape, formatDate as date } from "./ui/shared.js";
import { renderHistoryPage } from "./ui/pages/historial.js";
import { renderInventoryPage } from "./ui/pages/inventario.js";
import { renderSettingsPage } from "./ui/pages/configuracion.js";
import { renderPanelPage } from "./ui/pages/panel.js";
import { createAmbientalFeatures } from "./features/ambiental.js";
import { buildAiTemplatePrompt, copyTemplatePrompt } from "./features/plantilla-ia.js";
import { createSonoffHomeAssistant } from "./features/sonoff-home-assistant.js";
import { actionForm, createRegistroFeatures } from "./features/registro.js";
import { createStore } from "./core/store.js";
import {
  downloadJson,
  importCultivationFile,
} from "./features/import-export.js";
import { createCycleFeatures } from "./features/ciclo.js";
import {
  backup,
  calendarWeek,
  createCultivation,
  currentPlan,
  dateInputValue,
  formatDecimal,
  hoursFrom,
  id,
  normalizeCultivation,
  now,
  stageThemeKey,
} from "./domain.js";

const $ = (selector) => document.querySelector(selector);
const app = $("#app"),
  welcome = $("#welcome"),
  modal = $("#modal"),
  form = $("#modal-form");
const routeStage = $("#route-stage");
const store = createStore({ now, saveState, normalizeCultivation });
const state = store.state;
let route = "panel",
  modalAction = null,
  toastTimer;
const modalControls = createModal(modal, form, (data) => {
  if (modalAction) submitModal(data);
});
modal.addEventListener("close", () => {
  modalAction = null;
});
const cultivation = () => store.selected();
function showToast(message) {
  $("#toast").textContent = message;
  $("#toast").classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("#toast").classList.remove("show"), 3500);
}
async function persist(c) {
  await store.persist(c);
  render({ animate: false });
}
function updateCultivation(mutator) {
  return store.update(mutator).then((cultivation) => {
    render({ animate: false });
    return cultivation;
  });
}
const ambiental = createAmbientalFeatures({
  id,
  now,
  currentPlan,
  updateCultivation,
  notify,
  closeModal: () => closeModal(),
  showToast,
});
const sonoff = createSonoffHomeAssistant({
  now,
  storage: localStorage,
  pageProtocol: location.protocol,
  recordReadings: ambiental.recordReadings,
  showToast,
  onStatusChange: () => {
    if (route === "panel" && cultivation() && !modal.open) render();
  },
});
const ciclo = createCycleFeatures({
  cultivation,
  updateCultivation,
  now,
  id,
  escape,
  showToast,
  openModal: (...args) => openModal(...args),
  closeModal: () => closeModal(),
  setModalAction: (action) => {
    modalAction = action;
  },
});
const registro = createRegistroFeatures({
  cultivation,
  updateCultivation,
  now,
  id,
  hoursFrom,
  currentPlan,
  addAlert: (...args) => ambiental.addAlert(...args),
  notify,
  closeModal: () => closeModal(),
  showToast,
});
function latest(c, dwcId, type = "medicion_solucion") {
  return c.eventos
    .filter((e) => e.tipo === type && e.alcance?.id === dwcId)
    .at(-1);
}
function plantFor(c, dwcId) {
  const assignment = c.asignaciones.find(
    (a) => a.dwcId === dwcId && !a.fechaFin,
  );
  return c.plantas.find((p) => p.id === assignment?.plantaId);
}
function activeAlerts(c) {
  return c.alertas.filter((a) => a.estado === "activa");
}
function notify(title, body) {
  if ("Notification" in window && Notification.permission === "granted")
    new Notification(title, { body });
}
const routes = new Set(["panel", "historial", "inventario", "configuracion"]);
function pageFrame(c, name) {
  const currentCalendarWeek = calendarWeek(c.fechaInicio);
  const heading = {
    panel: {
      eyebrow: `Semana confirmada ${c.estado.semanaActiva} de 14 · calendario ${currentCalendarWeek} · ${c.estado.etapaActiva}`,
      title: c.nombre,
      subtitle: `${c.variedad} · ${c.dwcs.length} DWC independientes · inicio ${date(c.fechaInicio)}`,
      actions:
        '<button id="notification-button" class="secondary">Activar avisos</button><button id="new-measurement" class="primary">+ Medición</button>',
      content: '<section id="panel-view" class="view"></section>',
    },
    historial: {
      eyebrow: "Registro del ciclo",
      title: "Historial",
      subtitle:
        "Cada medición, reposición y observación conserva su fecha y alcance.",
      actions:
        '<button id="new-measurement" class="primary">+ Medición</button>',
      content: '<section id="history-view" class="view"></section>',
    },
    inventario: {
      eyebrow: "Recursos locales",
      title: "Inventario",
      subtitle: "Insumos y cantidades disponibles para este cultivo.",
      actions:
        '<button id="add-inventory" class="primary">+ Añadir insumo</button>',
      content: '<section id="inventory-view" class="view"></section>',
    },
    configuracion: {
      eyebrow: "Sistema y datos",
      title: "Configuración",
      subtitle: "Equipamiento, asignaciones y reglas que usa este cultivo.",
      actions:
        '<button id="export-route" class="secondary">Exportar backup</button>',
      content: '<section id="settings-view" class="view"></section>',
    },
  }[name];
  return `<article class="route-page" data-route="${name}" data-stage="${stageThemeKey(currentPlan(c).etapa)}"><header class="page-heading"><div><p class="eyebrow">${heading.eyebrow}</p><h1>${escape(heading.title)}</h1><p>${escape(heading.subtitle)}</p></div><div class="actions page-actions">${heading.actions}</div></header>${heading.content}</article>`;
}
async function mountPage(name) {
  const c = cultivation();
  route = name;
  welcome.hidden = Boolean(c);
  app.hidden = !c;
  if (!c) {
    sonoff.stop();
    return;
  }
  sonoff.start(c.id);
  routeStage.innerHTML = pageFrame(c, name);
  if (name === "panel") {
    renderPanelPage($("#panel-view"), c, currentPlan(c), {
      card,
      escape,
      date,
      latest,
      plantFor,
      activeAlerts,
      calendarWeek,
      formatDecimal,
      sonoffStatus: sonoff.getStatus(),
    });
    bindPanel();
    $("#notification-button").onclick = requestNotifications;
    $("#new-measurement").onclick = () =>
      openAction("measure", cultivation()?.dwcs[0].id);
  }
  if (name === "historial") {
    renderHistoryPage($("#history-view"), c, {
      card,
      escape,
      date,
      labelEvent,
      scopeName,
    });
    $("#new-measurement").onclick = () =>
      openAction("measure", cultivation()?.dwcs[0].id);
  }
  if (name === "inventario") {
    renderInventoryPage($("#inventory-view"), c, {
      card,
      escape,
      formatDecimal,
    });
    $("#add-inventory").onclick = openInventory;
    $("#inventory-view [data-action]").onclick = (event) => {
      const button = event.target.closest("[data-action]");
      if (button) openAction(button.dataset.action, button.dataset.dwc);
    };
  }
  if (name === "configuracion") {
    renderSettingsPage($("#settings-view"), c, {
      card,
      escape,
      plantFor,
      sonoffStatus: sonoff.getStatus(),
    });
    bindSettings();
    enhanceSettings(c);
    $("#export-route").onclick = exportCurrent;
  }
}
function render() {
  return routeDriver.mount(routeDriver.getRoute(), { animate: false });
}
function enhanceSettings(c) {
  const target = $("#settings-view .span-8");
  if (!target) return;
  const rules = (c.reglasAlertas || [])
    .map(
      (r) =>
        `<label><input type="checkbox" name="alert-${escape(r.id)}" ${r.activa ? "checked" : ""}> ${escape(r.nombre)}</label>`,
    )
    .join("");
  target.insertAdjacentHTML(
    "beforeend",
    `<hr><h3>Detalle del sistema</h3><div class="settings-grid"><label>Fecha de inicio<input form="settings-form" name="fechaInicio" type="date" value="${dateInputValue(c.fechaInicio)}"></label><label>Banco<input form="settings-form" name="banco" value="${escape(c.banco || "")}"></label><label>Temperatura objetivo<input form="settings-form" name="temperaturaObjetivoC" type="text" inputmode="decimal" value="${formatDecimal(currentPlan(c).temperaturaObjetivoC)}"></label><label>Largo (m)<input form="settings-form" name="espacio-largo" type="text" inputmode="decimal" value="${formatDecimal(c.espacio?.largoM)}"></label><label>Ancho (m)<input form="settings-form" name="espacio-ancho" type="text" inputmode="decimal" value="${formatDecimal(c.espacio?.anchoM)}"></label><label>Alto (m)<input form="settings-form" name="espacio-alto" type="text" inputmode="decimal" value="${formatDecimal(c.espacio?.altoM)}"></label>${c.dwcs.map((d) => `<label>${escape(d.nombre)}: nombre<input form="settings-form" name="dwc-name-${d.id}" value="${escape(d.nombre)}"></label><label>${escape(d.nombre)}: volumen de trabajo (L)<input form="settings-form" name="dwc-volume-${d.id}" type="text" inputmode="decimal" required value="${formatDecimal(d.volumenTrabajoLitros)}"></label>`).join("")}</div><h3 style="margin-top:16px">Reglas de alerta</h3><div class="settings-grid">${rules || '<p class="muted">No hay reglas configuradas.</p>'}</div>`,
  );
}
function bindSettings() {
  $("#settings-form").addEventListener("submit", ciclo.saveSettings);
  $("#settings-import").onclick = () => $("#import-file").click();
  $("#settings-export").onclick = exportCurrent;
  $("#settings-import-sonoff").onclick = openSonoffImport;
  $("#settings-sonoff").onclick = openSonoffConfiguration;
  $("#settings-sonoff-refresh").onclick = refreshSonoff;
  $("#settings-ai-template").onclick = openAiTemplatePrompt;
  $("#delete-local").onclick = confirmDelete;
}
function scopeName(c, scope = {}) {
  if (scope.tipo === "dwc")
    return c.dwcs.find((d) => d.id === scope.id)?.nombre || scope.id;
  if (scope.tipo === "planta")
    return c.plantas.find((p) => p.id === scope.id)?.nombre || scope.id;
  return scope.tipo || "cultivo";
}
function labelEvent(e) {
  return (
    {
      medicion_solucion: "Medición de solución",
      reposicion_agua: `Reposición de agua${e.litros ? ` (${formatDecimal(e.litros)} L)` : ""}`,
      cambio_solucion: "Cambio de solución",
      observacion: "Observación",
      nutricion: "Nutrición",
      etapa: `Semana ${e.semana}: ${e.etapaNueva}`,
      lectura_ambiental: "Lectura ambiental",
    }[e.tipo] || e.tipo
  );
}
function bindPanel() {
  document
    .querySelectorAll("[data-action]")
    .forEach(
      (b) => (b.onclick = () => openAction(b.dataset.action, b.dataset.dwc)),
    );
  document
    .querySelectorAll("[data-task]")
    .forEach((x) => (x.onchange = () => ciclo.toggleTask(x.dataset.task)));
  document
    .querySelectorAll("[data-week]")
    .forEach(
      (b) => (b.onclick = () => ciclo.requestWeek(Number(b.dataset.week))),
    );
  const advanceButton = $("#advance-week");
  if (advanceButton)
    advanceButton.onclick = () =>
      ciclo.requestWeek(cultivation().estado.semanaActiva + 1);
  $("#sonoff-configure").onclick = openSonoffConfiguration;
  $("#sonoff-refresh").onclick = refreshSonoff;
}
function openAction(action, dwc) {
  modalAction = action;
  const definition = actionForm(action, cultivation(), dwc, escape);
  openModal(definition[0], `<div class="form-grid">${definition[1]}</div>`);
}
function openModal(title, body, { submitLabel = "Guardar", readOnly = false } = {}) {
  $("#modal-title").textContent = title;
  $("#modal-body").innerHTML = body;
  $("#modal-submit").textContent = submitLabel;
  $("#modal-submit").hidden = readOnly;
  modal.showModal();
}
function closeModal() {
  modalControls.close();
}
function openSonoffImport() {
  modalAction = "sonoff";
  openModal(
    "Importar lecturas SonoffLAN",
    `<div class="form-grid"><label class="full">Lectura JSON o arreglo<textarea name="json" rows="9" required placeholder='[{"fecha":"2026-08-08T12:00:00Z","temperatura":24.2,"humedad":72}]'></textarea></label></div>`,
  );
}
function openSonoffConfiguration() {
  modalAction = "sonoff-config";
  const config = sonoff.getConfiguration() || {};
  openModal(
    "Conectar Home Assistant + SonoffLAN",
    `<p class="modal-note">Raíz consulta automáticamente a tu Home Assistant local; SonoffLAN integra allí el THR320D. No intenta llamar al puerto del Sonoff.</p><p class="modal-note">La URL debe ser accesible desde este navegador y permitir CORS para <code>${escape(location.origin)}</code>. En GitHub Pages, una URL HTTP local queda bloqueada por mixed content: usá HTTPS o ejecutá la app desde un origen HTTP local.</p><div class="form-grid"><label class="full">URL base de Home Assistant<input name="baseUrl" required inputmode="url" autocomplete="url" placeholder="https://homeassistant.local:8123" value="${escape(config.baseUrl || "")}"></label><label class="full">Long-Lived Access Token<input name="token" type="password" required autocomplete="off" placeholder="Token de Home Assistant" value="${escape(config.token || "")}"><small>Se guarda solo en el almacenamiento local de este navegador; no se incluye en backups.</small></label><label>Entidad de temperatura<input name="temperatureEntityId" required placeholder="sensor.carpas_temperatura" value="${escape(config.temperatureEntityId || "")}"></label><label>Entidad de humedad<input name="humidityEntityId" required placeholder="sensor.carpas_humedad" value="${escape(config.humidityEntityId || "")}"></label><label>Switch del humidificador<input name="humidifierEntityId" required placeholder="switch.humidificador" value="${escape(config.humidifierEntityId || "")}"></label><label>Actualizar cada (segundos)<input name="intervalSeconds" required type="text" inputmode="numeric" value="${escape(config.intervalSeconds || 60)}"></label></div>`,
    { submitLabel: "Guardar y conectar" },
  );
}
async function refreshSonoff() {
  const result = await sonoff.refresh();
  if (result.ok) showToast("Lectura ambiental actualizada.");
}
async function openAiTemplatePrompt() {
  try {
    modalAction = "ai-template";
    const prompt = buildAiTemplatePrompt(await loadEyeballzTemplate());
    openModal(
      "Crear plantilla con IA",
      `<p class="modal-note">Copiá este prompt, pegalo en una IA y reemplazá el bloque de descripción por tu instalación real. La respuesta debe ser un único archivo JSON, que después importás desde Configuración.</p><label class="full prompt-field">Prompt copiable<textarea id="ai-template-prompt" rows="14" readonly>${escape(prompt)}</textarea></label><div class="actions"><button type="button" id="copy-ai-template" class="primary">Copiar prompt</button></div>`,
      { readOnly: true },
    );
    $("#copy-ai-template").onclick = async () => {
      try {
        await copyTemplatePrompt(prompt);
        showToast("Prompt copiado. Pegalo en la IA que uses.");
      } catch (error) {
        showToast(error.message || "No se pudo copiar el prompt.");
      }
    };
  } catch (error) {
    showToast(error.message || "No se pudo preparar el prompt.");
  }
}
function exportCurrent() {
  const c = cultivation();
  if (c)
    downloadJson(
      `${c.variedad.toLowerCase().replace(/\s+/g, "-")}-backup.json`,
      backup(c),
    );
}
function confirmDelete() {
  modalAction = "delete";
  openModal(
    "Eliminar datos locales",
    "<p>Se borrará todo el contenido guardado en IndexedDB de este navegador. Esta acción no se puede deshacer.</p>",
  );
  $("#modal-submit").textContent = "Eliminar";
}
async function importFile(file) {
  if (!file) return;
  try {
    const type = await importCultivationFile(file, {
      validateTemplate,
      createCultivation,
      normalizeCultivation,
      store,
    });
    render();
    showToast(
      type === "plantilla"
        ? "Plantilla importada como cultivo nuevo."
        : "Copia de seguridad restaurada.",
    );
  } catch (e) {
    showToast(e.message || "No se pudo importar el archivo.");
  }
}
$("#theme-toggle").onclick = () => {
  const themeName =
    document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = themeName;
  localStorage.setItem("raiz-theme", themeName);
  render();
};
async function requestNotifications() {
  if (!("Notification" in window))
    return showToast("Este navegador no admite notificaciones.");
  const p = await Notification.requestPermission();
  showToast(
    p === "granted"
      ? "Notificaciones activadas."
      : "Notificaciones no autorizadas.",
  );
}
$("#start-example").onclick = async () => {
  const t = await loadEyeballzTemplate();
  const c = createCultivation(t);
  await store.add(c);
  render();
  showToast("Ejemplo Eyeballz creado.");
};
$("#download-template").onclick = async () =>
  downloadJson(
    "eyeballz-4-dwc.example.json",
    JSON.stringify(await loadEyeballzTemplate(), null, 2),
  );
$("#welcome-ai-template").onclick = openAiTemplatePrompt;
$("#import-file").onchange = (e) => importFile(e.target.files[0]);
$("#welcome-import").onchange = (e) => importFile(e.target.files[0]);
const routeDriver = createHashRouter({
  stage: routeStage,
  navigation: [...document.querySelectorAll("[data-view]")],
  routes: [...routes],
  renderRoute: mountPage,
});
document.querySelector(".brand").addEventListener("click", (event) => {
  event.preventDefault();
  routeDriver.navigate("panel");
});
try {
  store.restore((await loadState()) || state);
  await routeDriver.start();
} catch {
  await routeDriver.start();
  showToast("IndexedDB no está disponible; revisá los permisos del navegador.");
}

// The clock is derived from fechaInicio. Refreshing once a minute lets an open
// dashboard update its calendar-week status without a reload or background job.
setInterval(() => {
  if (cultivation() && route === "panel" && !modal.open) render();
}, 60000);

function openInventory() {
  modalAction = "inventory";
  openModal(
    "Añadir insumo",
    '<div class="form-grid"><label class="full">Nombre<input name="name" required></label><label>Cantidad<input name="quantity" type="text" inputmode="decimal" required placeholder="1,5"></label><label>Unidad<input name="unit" required placeholder="L, mL, unidad…"></label><label>Umbral bajo<input name="threshold" type="text" inputmode="decimal" placeholder="0,25"></label><label class="full">Notas<textarea name="notes" rows="3"></textarea></label></div>',
  );
}
async function submitModal(data) {
  const c = cultivation(),
    time = now(),
    action = modalAction;
  if (action === "week") return ciclo.advanceWeek();
  if (action === "sonoff")
    return ambiental.importSonoff(String(data.get("json") || ""));
  if (action === "sonoff-config") {
    const result = await sonoff.configure({
      baseUrl: data.get("baseUrl"),
      token: data.get("token"),
      temperatureEntityId: data.get("temperatureEntityId"),
      humidityEntityId: data.get("humidityEntityId"),
      humidifierEntityId: data.get("humidifierEntityId"),
      intervalSeconds: data.get("intervalSeconds"),
    });
    if (result.ok) {
      closeModal();
      showToast("SonoffLAN conectado mediante Home Assistant.");
    } else showToast(result.message);
    return;
  }
  if (action === "delete") {
    sonoff.forget();
    await clearState();
    store.reset();
    closeModal();
    render();
    showToast("Datos locales eliminados.");
    return;
  }
  return registro.submit(action, data);
}
