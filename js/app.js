import { loadState, saveState, clearState } from "./storage.js";
import { loadEyeballzTemplate, validateTemplate } from "./template.js";
import {
  backup,
  createCultivation,
  currentPlan,
  hoursFrom,
  id,
  normalizeCultivation,
  now,
} from "./domain.js";

const $ = (selector) => document.querySelector(selector);
const app = $("#app"),
  welcome = $("#welcome"),
  modal = $("#modal"),
  form = $("#modal-form");
let state = {
  version: 1,
  cultivos: [],
  cultivoSeleccionadoId: null,
  actualizadoEn: now(),
};
let view = "panel",
  modalAction = null,
  toastTimer;
const escape = (value) =>
  String(value ?? "").replace(
    /[&<>'"]/g,
    (x) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[
        x
      ],
  );
const cultivation = () =>
  state.cultivos.find((c) => c.id === state.cultivoSeleccionadoId) ||
  state.cultivos[0];
const date = (iso) =>
  iso
    ? new Intl.DateTimeFormat("es-AR", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(iso))
    : "Sin registro";
const download = (name, text) => {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 500);
};
function showToast(message) {
  $("#toast").textContent = message;
  $("#toast").classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("#toast").classList.remove("show"), 3500);
}
async function persist(c) {
  state = {
    ...state,
    cultivos: state.cultivos.map((x) => (x.id === c.id ? c : x)),
    cultivoSeleccionadoId: c.id,
    actualizadoEn: now(),
  };
  await saveState(state);
  render();
}
function updateCultivation(mutator) {
  const c = structuredClone(cultivation());
  mutator(c);
  c.actualizadoEn = now();
  return persist(c);
}
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
function normalizeState(saved) {
  if (!saved || !Array.isArray(saved.cultivos)) return state;
  saved.cultivos.forEach(normalizeCultivation);
  return saved;
}
function ruleIsActive(c, ruleId) {
  return c.reglasAlertas?.find((rule) => rule.id === ruleId)?.activa ?? true;
}
function addAlert(
  c,
  ruleId,
  severity,
  title,
  detail,
  scope = { tipo: "cultivo" },
) {
  if (!ruleIsActive(c, ruleId)) return false;
  const duplicate = c.alertas.some(
    (alert) =>
      alert.estado === "activa" &&
      alert.titulo === title &&
      alert.alcance?.id === scope.id,
  );
  if (!duplicate)
    c.alertas.push({
      id: id("alerta"),
      reglaId,
      severidad: severity,
      titulo: title,
      detalle: detail,
      alcance: scope,
      creadaEn: now(),
      estado: "activa",
    });
  return !duplicate;
}
function evaluateAmbient(c, reading) {
  const plan = currentPlan(c),
    notices = [];
  if (
    Math.abs(reading.temperatura - plan.temperaturaObjetivoC) >= 2 &&
    addAlert(
      c,
      "temperatura-fuera-rango",
      "alerta",
      "Temperatura ambiental fuera de rango",
      `Se registraron ${reading.temperatura} °C; el objetivo es ${plan.temperaturaObjetivoC} °C.`,
    )
  )
    notices.push(`Temperatura ${reading.temperatura} °C`);
  if (
    (reading.humedad < plan.humedadObjetivo.minimo ||
      reading.humedad > plan.humedadObjetivo.maximo) &&
    addAlert(
      c,
      "humedad-fuera-rango",
      "alerta",
      "Humedad fuera del rango objetivo",
      `Se registró ${reading.humedad} %; el objetivo es ${plan.humedadObjetivo.minimo}–${plan.humedadObjetivo.maximo} %.`,
    )
  )
    notices.push(`Humedad ${reading.humedad} %`);
  return notices;
}
function card(title, content, classes = "") {
  return `<article class="card ${classes}"><h2>${title}</h2>${content}</article>`;
}
function render() {
  const c = cultivation();
  welcome.hidden = Boolean(c);
  app.hidden = !c;
  if (!c) return;
  const plan = currentPlan(c);
  $("#week-label").textContent =
    `Semana ${c.estado.semanaActiva} de 14 · ${c.estado.etapaActiva}`;
  $("#cultivation-title").textContent = c.nombre;
  $("#cultivation-subtitle").textContent =
    `${c.variedad} · ${c.dwcs.length} DWC independientes · inicio ${date(c.fechaInicio)}`;
  document
    .querySelectorAll("[data-view]")
    .forEach((b) => b.classList.toggle("active", b.dataset.view === view));
  ["panel", "history", "inventory", "settings"].forEach(
    (n) =>
      ($(`#${n}-view`).hidden =
        {
          panel: "panel",
          history: "historial",
          inventory: "inventario",
          settings: "configuracion",
        }[n] !== view),
  );
  renderPanel(c, plan);
  renderHistory(c);
  renderInventory(c);
  renderSettings(c);
  enhanceInventory();
  enhanceSettings(c);
  bindPanel();
}
function enhanceInventory() {
  const actions = $("#inventory-view .span-4");
  if (!actions) return;
  actions.insertAdjacentHTML(
    "beforeend",
    '<button id="add-inventory" class="secondary">Añadir insumo</button>',
  );
  $("#add-inventory").onclick = openInventory;
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
    `<hr><h3>Detalle del sistema</h3><div class="settings-grid"><label>Banco<input form="settings-form" name="banco" value="${escape(c.banco || "")}"></label><label>Temperatura objetivo<input form="settings-form" name="temperaturaObjetivoC" type="number" step="0.1" value="${currentPlan(c).temperaturaObjetivoC ?? ""}"></label><label>Largo (m)<input form="settings-form" name="espacio-largo" type="number" step="0.1" value="${c.espacio?.largoM ?? ""}"></label><label>Ancho (m)<input form="settings-form" name="espacio-ancho" type="number" step="0.1" value="${c.espacio?.anchoM ?? ""}"></label><label>Alto (m)<input form="settings-form" name="espacio-alto" type="number" step="0.1" value="${c.espacio?.altoM ?? ""}"></label>${c.dwcs.map((d) => `<label>${escape(d.nombre)}: nombre<input form="settings-form" name="dwc-name-${d.id}" value="${escape(d.nombre)}"></label><label>${escape(d.nombre)}: volumen de trabajo (L)<input form="settings-form" name="dwc-volume-${d.id}" type="number" step="0.1" min="0.1" required value="${d.volumenTrabajoLitros}"></label>`).join("")}</div><h3 style="margin-top:16px">Reglas de alerta</h3><div class="settings-grid">${rules || '<p class="muted">No hay reglas configuradas.</p>'}</div>`,
  );
}
function renderPanel(c, plan) {
  const alertHtml = activeAlerts(c).length
    ? activeAlerts(c)
        .slice(-5)
        .reverse()
        .map(
          (a) =>
            `<div class="alert"><span class="badge ${a.severidad}">${a.severidad}</span><b>${escape(a.titulo)}</b><small>${escape(a.detalle || "")}</small></div>`,
        )
        .join("")
    : '<p class="empty">No hay alertas activas.</p>';
  const weeks = c.plan.semanas
    .map(
      (w) =>
        `<button data-week="${w.semana}" class="${w.semana === c.estado.semanaActiva ? "active" : ""}" title="${escape(w.etapa)}">${w.semana}</button>`,
    )
    .join("");
  const dwcs = c.dwcs
    .map((d) => {
      const m = latest(c, d.id);
      const plant = plantFor(c, d.id);
      return `<article class="dwc"><header><strong>${escape(d.nombre)}</strong><button data-action="measure" data-dwc="${d.id}" class="secondary">Medir</button></header><p class="muted">${plant ? escape(plant.nombre) : "Sin planta asignada"} · ${d.volumenTrabajoLitros} L</p><div class="numbers"><div><small>pH</small><b>${m?.valores?.ph?.valor ?? "—"}</b></div><div><small>EC</small><b>${m?.valores?.ec?.valor ?? "—"}</b></div><div><small>Solución</small><b>${m?.valores?.temperaturaSolucion?.valor ?? "—"}${m ? " °C" : ""}</b></div></div><small>${m ? `Última: ${date(m.fecha)}` : "Sin mediciones"}</small><div class="actions" style="margin-top:12px"><button data-action="water" data-dwc="${d.id}">Agua</button><button data-action="solution" data-dwc="${d.id}">Solución</button><button data-action="nutrition" data-dwc="${d.id}">Nutrición</button><button data-action="observation" data-dwc="${d.id}">Nota</button></div></article>`;
    })
    .join("");
  const tasks =
    c.tareas
      .filter((t) => t.estado === "pendiente")
      .sort((a, b) => a.venceEn.localeCompare(b.venceEn))
      .slice(0, 8)
      .map(
        (t) =>
          `<div class="task"><label><input type="checkbox" data-task="${t.id}"><span><b>${escape(t.titulo)}</b><br><small>${escape(t.descripcion || "")} · vence ${date(t.venceEn)}</small></span></label></div>`,
      )
      .join("") || '<p class="empty">No hay tareas pendientes.</p>';
  const readings = c.lecturasAmbientales || [];
  const lastReading = readings.at(-1);
  const points = readings
    .slice(-20)
    .map((r) => ({ x: new Date(r.fecha).getTime(), y: r.humedad }));
  $("#panel-view").innerHTML =
    `<div class="grid">${card("Estado del ciclo", `<p><b>${escape(plan.etapa)}</b> · Fotoperiodo ${plan.fotoperiodo}</p><div class="numbers"><div><small>pH objetivo</small><b>${plan.phObjetivo ?? "—"}</b></div><div><small>EC objetivo</small><b>${plan.ecObjetivo ?? "—"}</b></div><div><small>Humedad</small><b>${plan.humedadObjetivo.minimo}–${plan.humedadObjetivo.maximo}%</b></div></div><div class="week-strip" aria-label="Semanas">${weeks}</div><div class="actions" style="margin-top:14px"><button id="advance-week" class="primary" ${c.estado.semanaActiva >= 14 ? "disabled" : ""}>Confirmar semana siguiente</button></div>`, "span-8")}${card("Alertas", alertHtml, "span-4")}${card("DWC y plantas", `<div class="dwc-grid">${dwcs}</div>`, "span-8")}${card("Ambiente (SonoffLAN)", `<div class="numbers"><div><small>Temperatura</small><b>${lastReading?.temperatura ?? "—"}${lastReading ? " °C" : ""}</b></div><div><small>Humedad</small><b>${lastReading?.humedad ?? "—"}${lastReading ? " %" : ""}</b></div><div><small>Humidificador</small><b>${lastReading?.humidificadorEncendido ? "ON" : "—"}</b></div></div><canvas id="humidity-chart" class="chart" aria-label="Historial de humedad"></canvas><button id="sonoff-import" class="secondary">Importar lecturas JSON</button>`, "span-4")}${card("Tareas pendientes", tasks, "span-8")}${card("Receta semanal", `<p>${plan.dosis.length ? plan.dosis.map((x) => `${escape(x.producto)} ${x.mililitrosPorLitro} mL/L`).join(" · ") : "Sin nutrientes programados."}</p><small>Temperatura objetivo ${plan.temperaturaObjetivoC} °C · PPFD ${plan.ppfdReferencia.minimo}–${plan.ppfdReferencia.maximo}</small>`, "span-4")}</div>`;
  drawChart(points);
}
function drawChart(points) {
  const canvas = $("#humidity-chart");
  if (!canvas) return;
  const ctx = canvas.getContext("2d"),
    rect = canvas.getBoundingClientRect(),
    w = (canvas.width = rect.width * devicePixelRatio),
    h = (canvas.height = rect.height * devicePixelRatio);
  ctx.scale(devicePixelRatio, devicePixelRatio);
  ctx.clearRect(0, 0, rect.width, rect.height);
  ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue(
    "--line",
  );
  ctx.beginPath();
  ctx.moveTo(0, rect.height - 20);
  ctx.lineTo(rect.width, rect.height - 20);
  ctx.stroke();
  if (points.length < 2) {
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue(
      "--muted",
    );
    ctx.font = "13px system-ui";
    ctx.fillText("Sin suficientes lecturas", 12, 26);
    return;
  }
  const ys = points.map((p) => p.y),
    min = Math.min(...ys) - 3,
    max = Math.max(...ys) + 3;
  ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue(
    "--accent",
  );
  ctx.lineWidth = 2;
  ctx.beginPath();
  points.forEach((p, i) => {
    const x = (i / (points.length - 1)) * rect.width,
      y = rect.height - 10 - ((p.y - min) / (max - min)) * (rect.height - 30);
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  });
  ctx.stroke();
}
function renderHistory(c) {
  const events = c.eventos.slice().reverse();
  $("#history-view").innerHTML = card(
    "Historial",
    events.length
      ? events
          .map(
            (e) =>
              `<div class="list-row"><div><b>${escape(labelEvent(e))}</b><br><small>${date(e.fecha)} · ${escape(scopeName(c, e.alcance))}</small></div><span class="badge">${escape(e.tipo)}</span></div>`,
          )
          .join("")
      : '<p class="empty">Todavía no registraste acciones.</p>',
    "span-12",
  );
}
function renderInventory(c) {
  $("#inventory-view").innerHTML =
    `<div class="grid">${card("Inventario", c.inventario.map((i) => `<div class="list-row"><div><b>${escape(i.nombre)}</b><br><small>Umbral: ${i.umbralBajo ?? "—"} ${escape(i.unidad)}</small></div><b>${i.cantidad} ${escape(i.unidad)}</b></div>`).join(""), "span-8")}${card("Acciones", `<p class="muted">El registro de nutrición descuenta el inventario automáticamente.</p><button data-action="nutrition" data-dwc="${c.dwcs[0].id}" class="primary">Registrar nutrición</button>`, "span-4")}</div>`;
}
function renderSettings(c) {
  const assignments = c.dwcs
    .map(
      (d) =>
        `<label>${escape(d.nombre)}<select name="${d.id}"><option value="">Sin asignar</option>${c.plantas.map((p) => `<option value="${p.id}" ${plantFor(c, d.id)?.id === p.id ? "selected" : ""}>${escape(p.nombre)}</option>`).join("")}</select></label>`,
    )
    .join("");
  $("#settings-view").innerHTML =
    `<div class="grid">${card("Sistema y asignaciones", `<form id="settings-form"><div class="settings-grid"><label>Nombre<input name="nombre" value="${escape(c.nombre)}"></label><label>Variedad<input name="variedad" value="${escape(c.variedad)}"></label>${assignments}</div><div class="actions" style="margin-top:14px"><button class="primary">Guardar configuración</button></div></form>`, "span-8")}${card("Fuentes de datos", `<p class="muted">Las variables permanecen configurables y las lecturas SonoffLAN se importan localmente.</p>${c.fuentesVariables.map((x) => `<div class="list-row"><b>${escape(x.variable)}</b><small>${escape(x.fuente?.etiqueta || x.fuente?.modo || "")}</small></div>`).join("")}`, "span-4")}${card("Datos y seguridad", `<p class="muted">IndexedDB es la fuente autoritativa de esta instalación.</p><div class="actions"><button id="settings-import" class="secondary">Importar JSON</button><button id="settings-export" class="secondary">Descargar backup</button><button id="delete-local" class="secondary">Eliminar datos locales</button></div>`, "span-12")}</div>`;
  $("#settings-form").addEventListener("submit", saveSettings);
  $("#settings-import").onclick = () => $("#import-file").click();
  $("#settings-export").onclick = exportCurrent;
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
      reposicion_agua: `Reposición de agua${e.litros ? ` (${e.litros} L)` : ""}`,
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
    .forEach((x) => (x.onchange = () => toggleTask(x.dataset.task)));
  document
    .querySelectorAll("[data-week]")
    .forEach((b) => (b.onclick = () => requestWeek(Number(b.dataset.week))));
  $("#advance-week").onclick = () =>
    requestWeek(cultivation().estado.semanaActiva + 1);
  $("#sonoff-import").onclick = () => openSonoff();
}
function optionsDwcs(selected) {
  return cultivation()
    .dwcs.map(
      (d) =>
        `<option value="${d.id}" ${d.id === selected ? "selected" : ""}>${escape(d.nombre)}</option>`,
    )
    .join("");
}
function openAction(action, dwc) {
  modalAction = action;
  const c = cultivation();
  const common = `<label>DWC<select name="dwc">${optionsDwcs(dwc)}</select></label>`;
  const defs = {
    measure: [
      "Registrar medición",
      `${common}<label>pH<input name="ph" type="number" step="0.01" required></label><label>EC (mS/cm)<input name="ec" type="number" step="0.01" required></label><label>Temperatura (°C)<input name="temperature" type="number" step="0.1" required></label>`,
    ],
    water: [
      "Registrar reposición",
      `${common}<label>Litros añadidos<input name="liters" type="number" step="0.1" min="0.1" required></label>`,
    ],
    solution: [
      "Registrar cambio de solución",
      `<label class="full">Alcance<select name="dwc"><option value="todos">Los 4 DWC</option>${optionsDwcs(dwc)}</select></label>`,
    ],
    observation: [
      "Registrar observación",
      `<label>Planta<select name="plant">${c.plantas.map((p) => `<option value="${p.id}">${escape(p.nombre)}</option>`).join("")}</select></label><label class="full">Observación<textarea name="observation" rows="4" required></textarea></label>`,
    ],
    nutrition: [
      "Registrar nutrición",
      `${common}<label>Producto<select name="product">${c.inventario.map((i) => `<option value="${i.id}">${escape(i.nombre)} (${i.cantidad} ${i.unidad})</option>`).join("")}</select></label><label>Cantidad (mL)<input name="amount" type="number" step="1" min="1" required></label>`,
    ],
  };
  openModal(defs[action][0], `<div class="form-grid">${defs[action][1]}</div>`);
}
function openModal(title, body) {
  $("#modal-title").textContent = title;
  $("#modal-body").innerHTML = body;
  $("#modal-submit").textContent = "Guardar";
  modal.showModal();
}
form.addEventListener("submit", (event) => {
  if (event.submitter?.value === "cancel") return;
  event.preventDefault();
  if (modalAction) submitModal(new FormData(form));
});
function closeModal() {
  modal.close();
  modalAction = null;
}
async function toggleTask(taskId) {
  await updateCultivation((c) => {
    const t = c.tareas.find((x) => x.id === taskId);
    t.estado = t.estado === "completada" ? "pendiente" : "completada";
    t.completadaEn = t.estado === "completada" ? now() : undefined;
  });
  showToast("Tarea actualizada.");
}
function requestWeek(week) {
  const c = cultivation();
  if (week < 0 || week > 14 || week === c.estado.semanaActiva) return;
  if (week !== c.estado.semanaActiva + 1)
    return showToast("El avance se confirma de a una semana.");
  modalAction = "week";
  openModal(
    `Confirmar semana ${week}`,
    `<p>Vas a activar <b>${escape(c.plan.semanas.find((w) => w.semana === week).etapa)}</b>. Este avance se registra en el historial.</p>`,
  );
}
async function advanceWeek() {
  const c = cultivation(),
    week = Math.min(14, c.estado.semanaActiva + 1),
    plan = c.plan.semanas.find((x) => x.semana === week),
    time = now();
  await updateCultivation((x) => {
    x.eventos.push({
      id: id("evento"),
      tipo: "etapa",
      fecha: time,
      alcance: { tipo: "cultivo" },
      etapaActiva: plan.etapa,
      fuente: { modo: "manual", etiqueta: "Confirmado por el usuario" },
      semana: week,
      etapaAnterior: x.estado.etapaActiva,
      etapaNueva: plan.etapa,
      confirmado: true,
    });
    x.estado.semanaActiva = week;
    x.estado.etapaActiva = plan.etapa;
  });
  closeModal();
  showToast(`Semana ${week} activada.`);
}
function openSonoff() {
  modalAction = "sonoff";
  openModal(
    "Importar lecturas SonoffLAN",
    `<div class="form-grid"><label class="full">Lectura JSON o arreglo<textarea name="json" rows="9" required placeholder='[{"fecha":"2026-08-08T12:00:00Z","temperatura":24.2,"humedad":72}]'></textarea></label></div>`,
  );
}
function exportCurrent() {
  const c = cultivation();
  if (c)
    download(
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
    const parsed = validateTemplate(JSON.parse(await file.text()));
    const c =
      parsed.tipo === "plantilla" ? createCultivation(parsed) : normalizeCultivation(parsed.cultivo);
    state = {
      ...state,
      cultivos: [...state.cultivos.filter((x) => x.id !== c.id), c],
      cultivoSeleccionadoId: c.id,
    };
    await saveState(state);
    render();
    showToast(
      parsed.tipo === "plantilla"
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
$("#export-button").onclick = exportCurrent;
$("#new-measurement").onclick = () =>
  openAction("measure", cultivation()?.dwcs[0].id);
$("#notification-button").onclick = async () => {
  if (!("Notification" in window))
    return showToast("Este navegador no admite notificaciones.");
  const p = await Notification.requestPermission();
  showToast(
    p === "granted"
      ? "Notificaciones activadas."
      : "Notificaciones no autorizadas.",
  );
};
$("#start-example").onclick = async () => {
  const t = await loadEyeballzTemplate();
  const c = createCultivation(t);
  state = {
    ...state,
    cultivos: [...state.cultivos, c],
    cultivoSeleccionadoId: c.id,
  };
  await saveState(state);
  render();
  showToast("Ejemplo Eyeballz creado.");
};
$("#download-template").onclick = async () =>
  download(
    "eyeballz-4-dwc.example.json",
    JSON.stringify(await loadEyeballzTemplate(), null, 2),
  );
$("#import-file").onchange = (e) => importFile(e.target.files[0]);
$("#welcome-import").onchange = (e) => importFile(e.target.files[0]);
document.querySelectorAll("[data-view]").forEach(
  (b) =>
    (b.onclick = () => {
      view = b.dataset.view;
      render();
    }),
);
try {
  state = normalizeState((await loadState()) || state);
  render();
} catch {
  render();
  showToast("IndexedDB no está disponible; revisá los permisos del navegador.");
}

function openInventory() {
  modalAction = "inventory";
  openModal(
    "Añadir insumo",
    '<div class="form-grid"><label class="full">Nombre<input name="name" required></label><label>Cantidad<input name="quantity" type="number" min="0" step="0.01" required></label><label>Unidad<input name="unit" required placeholder="L, mL, unidad…"></label><label>Umbral bajo<input name="threshold" type="number" min="0" step="0.01"></label><label class="full">Notas<textarea name="notes" rows="3"></textarea></label></div>',
  );
}
async function submitModal(data) {
  const c = cultivation(),
    time = now(),
    action = modalAction;
  if (action === "week") return advanceWeek();
  if (action === "sonoff") return importSonoff(String(data.get("json") || ""));
  if (action === "delete") {
    await clearState();
    state = {
      version: 1,
      cultivos: [],
      cultivoSeleccionadoId: null,
      actualizadoEn: now(),
    };
    closeModal();
    render();
    showToast("Datos locales eliminados.");
    return;
  }
  if (action === "inventory") {
    const name = String(data.get("name") || "").trim(),
      quantity = Number(data.get("quantity")),
      unit = String(data.get("unit") || "").trim(),
      threshold = String(data.get("threshold") || "").trim(),
      notes = String(data.get("notes") || "").trim();
    if (!name || !unit || !Number.isFinite(quantity))
      return showToast("Completá nombre, cantidad y unidad.");
    await updateCultivation((x) =>
      x.inventario.push({
        id: id("inventario"),
        nombre: name,
        cantidad: quantity,
        unidad: unit,
        umbralBajo: threshold === "" ? undefined : Number(threshold),
        notas: notes || undefined,
      }),
    );
    closeModal();
    showToast("Insumo añadido al inventario.");
    return;
  }
  const dwc = String(data.get("dwc")),
    base = {
      id: id("evento"),
      fecha: time,
      alcance: { tipo: "dwc", id: dwc },
      etapaActiva: c.estado.etapaActiva,
      fuente: { modo: "manual", etiqueta: "Registro manual" },
    };
  if (action === "measure") {
    const ph = Number(data.get("ph")),
      ec = Number(data.get("ec")),
      temperature = Number(data.get("temperature"));
    if (![ph, ec, temperature].every(Number.isFinite))
      return showToast("Completá pH, EC y temperatura.");
    const notices = [];
    await updateCultivation((x) => {
      const measurement = {
        ...base,
        tipo: "medicion_solucion",
        fuente: {
          modo: "manual",
          equipoId: "labymos-ez9902",
          etiqueta: "Labymos EZ9902",
        },
        valores: {
          ph: { valor: ph, unidad: "pH" },
          ec: { valor: ec, unidad: "mS/cm" },
          temperaturaSolucion: { valor: temperature, unidad: "°C" },
        },
      };
      x.eventos.push(measurement);
      x.tareas.forEach((t) => {
        if (
          t.alcance?.id === dwc &&
          t.reglaId === "medir-solucion" &&
          t.estado === "pendiente"
        ) {
          t.estado = "completada";
          t.completadaEn = time;
        }
      });
      x.tareas.push({
        id: id("tarea"),
        reglaId: "medir-solucion",
        titulo: "Medir solución",
        descripcion: "Registrar pH, EC y temperatura.",
        alcance: { tipo: "dwc", id: dwc },
        venceEn: hoursFrom(time, 48),
        estado: "pendiente",
      });
      if (
        (ph < 5.5 || ph > 6.5) &&
        addAlert(
          x,
          "ph-general",
          "alerta",
          "pH fuera del rango general",
          `Se registró pH ${ph}.`,
          measurement.alcance,
        )
      )
        notices.push("pH fuera de rango");
      if (
        currentPlan(x).ecObjetivo !== undefined &&
        Math.abs(ec - currentPlan(x).ecObjetivo) >= 0.2 &&
        addAlert(
          x,
          "ec-objetivo",
          "aviso",
          "EC alejada del objetivo",
          `Se registró EC ${ec}.`,
          measurement.alcance,
        )
      )
        notices.push("EC alejada del objetivo");
    });
    notices.forEach((message) => notify("Raíz: alerta de solución", message));
    closeModal();
    showToast("Medición guardada; la próxima vence en 48 h.");
    return;
  }
  if (action === "water") {
    const liters = Number(data.get("liters"));
    if (!Number.isFinite(liters) || liters <= 0)
      return showToast("Indicá una cantidad de agua válida.");
    await updateCultivation((x) => {
      x.eventos.push({ ...base, tipo: "reposicion_agua", litros });
      x.tareas.forEach((t) => {
        if (
          t.alcance?.id === dwc &&
          t.reglaId === "revisar-agua" &&
          t.estado === "pendiente"
        ) {
          t.estado = "completada";
          t.completadaEn = time;
        }
      });
    });
    closeModal();
    showToast("Reposición guardada y tarea de agua completada.");
    return;
  }
  if (action === "solution") {
    const ids = dwc === "todos" ? c.dwcs.map((d) => d.id) : [dwc];
    await updateCultivation((x) => {
      ids.forEach((d) =>
        x.eventos.push({
          ...base,
          id: id("evento"),
          tipo: "cambio_solucion",
          alcance: { tipo: "dwc", id: d },
          volumenLitros: x.dwcs.find((y) => y.id === d)?.volumenTrabajoLitros,
        }),
      );
      x.tareas.forEach((t) => {
        if (
          ids.includes(t.alcance?.id) &&
          t.reglaId === "renovar-solucion" &&
          t.estado === "pendiente"
        ) {
          t.estado = "completada";
          t.completadaEn = time;
        }
      });
      ids.forEach((d) =>
        x.tareas.push({
          id: id("tarea"),
          reglaId: "renovar-solucion",
          titulo: "Renovar solución",
          descripcion: "Renovación semanal.",
          alcance: { tipo: "dwc", id: d },
          venceEn: hoursFrom(time, 168),
          estado: "pendiente",
        }),
      );
    });
    closeModal();
    showToast("Cambio de solución registrado.");
    return;
  }
  if (action === "observation") {
    const text = String(data.get("observation") || "").trim();
    if (!text) return showToast("Escribí una observación.");
    await updateCultivation((x) =>
      x.eventos.push({
        ...base,
        tipo: "observacion",
        alcance: { tipo: "planta", id: data.get("plant") },
        observacion: text,
      }),
    );
    closeModal();
    showToast("Observación guardada.");
    return;
  }
  if (action === "nutrition") {
    const product = c.inventario.find((i) => i.id === data.get("product")),
      amount = Number(data.get("amount"));
    if (!product || !Number.isFinite(amount) || amount <= 0)
      return showToast("Indicá un producto y cantidad válidos.");
    await updateCultivation((x) => {
      x.eventos.push({
        ...base,
        tipo: "nutricion",
        productos: [
          {
            inventarioId: product.id,
            nombre: product.nombre,
            cantidad: amount,
            unidad: "mL",
          },
        ],
      });
      const item = x.inventario.find((i) => i.id === product.id);
      item.cantidad = Math.max(
        0,
        item.cantidad - (item.unidad === "L" ? amount / 1000 : amount),
      );
    });
    closeModal();
    showToast("Nutrición registrada e inventario actualizado.");
  }
}
async function importSonoff(text) {
  try {
    const source = JSON.parse(text),
      rows = Array.isArray(source)
        ? source
        : Array.isArray(source.readings)
          ? source.readings
          : [source];
    const readings = rows.map((r) => {
      if (!r || typeof r !== "object")
        throw new Error("Cada lectura debe ser un objeto.");
      const temperatura = Number(
          r.temperatura ?? r.temperature ?? r.currentTemperature,
        ),
        humedad = Number(r.humedad ?? r.humidity ?? r.currentHumidity),
        fecha = new Date(r.fecha ?? r.timestamp ?? r.time ?? now());
      if (
        !Number.isFinite(temperatura) ||
        !Number.isFinite(humedad) ||
        Number.isNaN(fecha.getTime())
      )
        throw new Error(
          "Cada lectura necesita fecha, temperatura y humedad válidas.",
        );
      return {
        fecha: fecha.toISOString(),
        temperatura,
        humedad,
        humidificadorEncendido:
          r.humidificadorEncendido === true ||
          r.humidifier === true ||
          String(r.switch).toLowerCase() === "on",
      };
    });
    const notices = [];
    await updateCultivation((x) => {
      x.lecturasAmbientales = [
        ...(x.lecturasAmbientales || []),
        ...readings,
      ].sort((a, b) => a.fecha.localeCompare(b.fecha));
      readings.forEach((r) => {
        x.eventos.push({
          id: id("evento"),
          tipo: "lectura_ambiental",
          fecha: r.fecha,
          alcance: { tipo: "cultivo" },
          etapaActiva: x.estado.etapaActiva,
          fuente: { modo: "automatica", etiqueta: "SonoffLAN" },
          valores: r,
        });
        notices.push(...evaluateAmbient(x, r));
      });
    });
    notices.forEach((message) => notify("Raíz: alerta ambiental", message));
    closeModal();
    showToast(
      `${readings.length} lectura(s) importada(s).${notices.length ? " Se generaron alertas." : ""}`,
    );
  } catch (error) {
    showToast(error.message || "JSON inválido.");
  }
}
async function saveSettings(event) {
  event.preventDefault();
  const f = new FormData(event.currentTarget);
  await updateCultivation((c) => {
    c.nombre = String(f.get("nombre") || "").trim() || c.nombre;
    c.variedad = String(f.get("variedad") || "").trim() || c.variedad;
    c.banco = String(f.get("banco") || "").trim() || c.banco;
    c.espacio ||= {};
    ["largo", "ancho", "alto"].forEach((key) => {
      const value = Number(f.get(`espacio-${key}`));
      if (Number.isFinite(value) && value > 0) c.espacio[`${key}M`] = value;
    });
    const temp = Number(f.get("temperaturaObjetivoC"));
    if (Number.isFinite(temp))
      c.plan.semanas.forEach((week) => (week.temperaturaObjetivoC = temp));
    c.dwcs.forEach((d) => {
      const name = String(f.get(`dwc-name-${d.id}`) || "").trim(),
        volume = Number(f.get(`dwc-volume-${d.id}`));
      if (name) d.nombre = name;
      if (Number.isFinite(volume) && volume > 0)
        d.volumenTrabajoLitros = volume;
      const plant = String(f.get(d.id) || ""),
        open = c.asignaciones.find((a) => a.dwcId === d.id && !a.fechaFin);
      if (open && open.plantaId !== plant) open.fechaFin = now();
      if (plant && (!open || open.plantaId !== plant)) {
        c.asignaciones.forEach((a) => {
          if (a.plantaId === plant && !a.fechaFin) a.fechaFin = now();
        });
        c.asignaciones.push({
          id: id("asignacion"),
          plantaId: plant,
          dwcId: d.id,
          fechaInicio: now(),
        });
      }
    });
    (c.reglasAlertas || []).forEach((rule) => {
      const input = document.querySelector(
        `[name="alert-${CSS.escape(rule.id)}"]`,
      );
      if (input) rule.activa = input.checked;
    });
  });
  showToast("Configuración guardada.");
}
