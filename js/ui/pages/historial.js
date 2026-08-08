export function renderHistoryPage(container, cultivation, helpers) {
  const { card, escape, date, labelEvent, scopeName } = helpers;
  const events = cultivation.eventos.slice().reverse();
  container.innerHTML = card(
    "Historial",
    events.length
      ? events
          .map(
            (event) =>
              `<div class="list-row"><div><b>${escape(labelEvent(event))}</b><br><small>${date(event.fecha)} · ${escape(scopeName(cultivation, event.alcance))}</small></div><span class="badge">${escape(event.tipo)}</span></div>`,
          )
          .join("")
      : '<p class="empty">Todavía no registraste acciones.</p>',
    "span-12",
  );
}
