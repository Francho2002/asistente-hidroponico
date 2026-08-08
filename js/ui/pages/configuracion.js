export function renderSettingsPage(container, cultivation, helpers) {
  const { card, escape, plantFor } = helpers;
  const assignments = cultivation.dwcs
    .map(
      (dwc) =>
        `<label>${escape(dwc.nombre)}<select name="${dwc.id}"><option value="">Sin asignar</option>${cultivation.plantas.map((plant) => `<option value="${plant.id}" ${plantFor(cultivation, dwc.id)?.id === plant.id ? "selected" : ""}>${escape(plant.nombre)}</option>`).join("")}</select></label>`,
    )
    .join("");
  const sources = cultivation.fuentesVariables
    .map(
      (source) =>
        `<div class="list-row"><b>${escape(source.variable)}</b><small>${escape(source.fuente?.etiqueta || source.fuente?.modo || "")}</small></div>`,
    )
    .join("");
  container.innerHTML = `<div class="grid">${card("Sistema y asignaciones", `<form id="settings-form"><div class="settings-grid"><label>Nombre<input name="nombre" value="${escape(cultivation.nombre)}"></label><label>Variedad<input name="variedad" value="${escape(cultivation.variedad)}"></label>${assignments}</div><div class="actions" style="margin-top:14px"><button class="primary">Guardar configuración</button></div></form>`, "span-8")}${card("Fuentes de datos", `<p class="muted">Las variables permanecen configurables y las lecturas SonoffLAN se importan localmente.</p>${sources}`, "span-4")}${card("Datos y seguridad", '<p class="muted">Los datos se guardan en este navegador.</p><div class="actions"><button id="settings-import" class="secondary">Importar JSON</button><button id="settings-export" class="secondary">Descargar backup</button><button id="delete-local" class="secondary">Eliminar datos locales</button></div>', "span-12")}</div>`;
}
