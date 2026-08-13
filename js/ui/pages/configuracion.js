export function renderSettingsPage(container, cultivation, helpers) {
  const { card, escape, plantFor, sonoffStatus, canUndoSync } = helpers;
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
  const connector = sonoffStatus || { state: "unconfigured", message: "Sin configurar" };
  const varieties = cultivation.procedenciaPlan?.variedades?.length
    ? cultivation.procedenciaPlan.variedades.map((item) => item.etiqueta).join(" · ")
    : cultivation.procedenciaPlan?.variedad?.etiqueta || "referencia indicada";
  const trace = cultivation.procedenciaPlan
    ? `<p class="muted plan-trace">Receta 0–14: ${escape(cultivation.procedenciaPlan.receta?.etiqueta || "fuente indicada")} · Variedades: ${escape(varieties)}</p>${cultivation.procedenciaPlan.advertenciaMezcla ? `<p class="template-warning" role="note">${escape(cultivation.procedenciaPlan.advertenciaMezcla)}</p>` : ""}`
    : "";
  container.innerHTML = `<div class="grid">${card("Sistema y asignaciones", `<form id="settings-form"><div class="settings-grid"><label>Nombre<input name="nombre" value="${escape(cultivation.nombre)}"></label><label>Variedad<input name="variedad" value="${escape(cultivation.variedad)}"></label>${assignments}</div><div class="actions" style="margin-top:14px"><button class="primary">Guardar configuración</button></div></form>`, "span-8")}${card("Fuentes de datos", `<p class="muted">Las variables siguen siendo configurables: manuales, automáticas o no disponibles.</p>${sources}${trace}`, "span-4")}${card("Home Assistant + SonoffLAN", `<p class="connector-status ${escape(connector.state)}">${escape(connector.message || "Sin configurar")}</p><p class="muted">Conectá Home Assistant local, donde SonoffLAN ya integra el THR320D. El token se guarda solo en este navegador y nunca se exporta.</p><div class="actions"><button id="settings-sonoff" class="secondary">Conectar / Configurar SonoffLAN</button><button id="settings-sonoff-refresh" class="secondary" ${connector.state === "unconfigured" ? "disabled" : ""}>Actualizar ahora</button></div>`, "span-4")}${card("Sincronizar entre dispositivos", `<p class="muted">1. Exportá una copia en este dispositivo. 2. Llevála al otro (archivo, cable o mensajería). 3. Allí elegí Fusionar copia. No usa cuenta, nube ni red.</p><div class="actions"><button id="sync-export" class="primary">Exportar para otro dispositivo</button><button id="sync-merge" class="secondary">Fusionar copia</button><button id="sync-undo" class="secondary" ${canUndoSync ? "" : "disabled"}>Deshacer última sincronización</button></div>`, "span-12")}${card("Plantillas predefinidas", `<p class="muted">Elegí, creá o descargá una plantilla editable sin llenar de acciones esta pantalla.</p><div class="actions"><button id="settings-predefined-templates" class="primary" aria-haspopup="dialog">Plantillas predefinidas</button><button id="settings-ai-template" class="secondary">Crear plantilla con IA</button></div>`, "span-8")}${card("Datos y seguridad", '<p class="muted">Los datos se guardan en este navegador. Podés importar lecturas JSON como respaldo si no usás la conexión automática.</p><div class="actions"><button id="settings-import" class="secondary">Importar JSON</button><button id="settings-export" class="secondary">Descargar backup</button><button id="settings-import-sonoff" class="secondary">Importar lecturas JSON (respaldo)</button><button id="delete-local" class="secondary">Eliminar datos locales</button></div>', "span-12")}</div>`;
}
