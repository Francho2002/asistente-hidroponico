export function renderInventoryPage(container, cultivation, helpers) {
  const { card, escape, formatDecimal } = helpers;
  const items = cultivation.inventario
    .map(
      (item) =>
        `<div class="list-row"><div><b>${escape(item.nombre)}</b><br><small>Umbral: ${formatDecimal(item.umbralBajo)} ${escape(item.unidad)}</small></div><b>${formatDecimal(item.cantidad)} ${escape(item.unidad)}</b></div>`,
    )
    .join("");
  container.innerHTML = `<div class="grid">${card("Inventario", items || '<p class="empty">No hay insumos cargados.</p>', "span-8")}${card("Acciones", `<p class="muted">El registro de nutrición descuenta el inventario automáticamente.</p><button data-action="nutrition" data-dwc="${cultivation.dwcs[0]?.id || ""}" class="primary">Registrar nutrición</button>`, "span-4")}</div>`;
}
