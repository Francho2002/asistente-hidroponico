function drawHumidityChart(canvas, points) {
  if (!canvas) return;
  const context = canvas.getContext("2d");
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * devicePixelRatio;
  canvas.height = rect.height * devicePixelRatio;
  context.scale(devicePixelRatio, devicePixelRatio);
  context.strokeStyle = getComputedStyle(
    document.documentElement,
  ).getPropertyValue("--line");
  context.beginPath();
  context.moveTo(0, rect.height - 20);
  context.lineTo(rect.width, rect.height - 20);
  context.stroke();
  if (points.length < 2) {
    context.fillStyle = getComputedStyle(
      document.documentElement,
    ).getPropertyValue("--muted");
    context.font = "13px system-ui";
    context.fillText("Sin suficientes lecturas", 12, 26);
    return;
  }
  const values = points.map((point) => point.humedad);
  const min = Math.min(...values) - 3;
  const max = Math.max(...values) + 3;
  context.strokeStyle = getComputedStyle(
    document.documentElement,
  ).getPropertyValue("--accent");
  context.lineWidth = 2;
  context.beginPath();
  points.forEach((point, index) => {
    const x = (index / (points.length - 1)) * rect.width;
    const y =
      rect.height -
      10 -
      ((point.humedad - min) / (max - min)) * (rect.height - 30);
    index ? context.lineTo(x, y) : context.moveTo(x, y);
  });
  context.stroke();
}

export function renderPanelPage(container, cultivation, plan, helpers) {
  const { card, escape, date, latest, plantFor, activeAlerts } = helpers;
  const alerts = activeAlerts(cultivation).length
    ? activeAlerts(cultivation)
        .slice(-5)
        .reverse()
        .map(
          (alert) =>
            `<div class="alert"><span class="badge ${alert.severidad}">${alert.severidad}</span><b>${escape(alert.titulo)}</b><small>${escape(alert.detalle || "")}</small></div>`,
        )
        .join("")
    : '<p class="empty">No hay alertas activas.</p>';
  const weeks = cultivation.plan.semanas
    .map(
      (week) =>
        `<button data-week="${week.semana}" class="${week.semana === cultivation.estado.semanaActiva ? "active" : ""}" title="${escape(week.etapa)}">${week.semana}</button>`,
    )
    .join("");
  const dwcs = cultivation.dwcs
    .map((dwc) => {
      const measurement = latest(cultivation, dwc.id);
      const plant = plantFor(cultivation, dwc.id);
      return `<article class="dwc"><header><strong>${escape(dwc.nombre)}</strong><button data-action="measure" data-dwc="${dwc.id}" class="secondary">Medir</button></header><p class="muted">${plant ? escape(plant.nombre) : "Sin planta asignada"} · ${dwc.volumenTrabajoLitros} L</p><div class="numbers"><div><small>pH</small><b>${measurement?.valores?.ph?.valor ?? "—"}</b></div><div><small>EC</small><b>${measurement?.valores?.ec?.valor ?? "—"}</b></div><div><small>Solución</small><b>${measurement?.valores?.temperaturaSolucion?.valor ?? "—"}${measurement ? " °C" : ""}</b></div></div><small>${measurement ? `Última: ${date(measurement.fecha)}` : "Sin mediciones"}</small><div class="actions" style="margin-top:12px"><button data-action="water" data-dwc="${dwc.id}">Agua</button><button data-action="solution" data-dwc="${dwc.id}">Solución</button><button data-action="nutrition" data-dwc="${dwc.id}">Nutrición</button><button data-action="observation" data-dwc="${dwc.id}">Nota</button></div></article>`;
    })
    .join("");
  const tasks =
    cultivation.tareas
      .filter((task) => task.estado === "pendiente")
      .sort((a, b) => a.venceEn.localeCompare(b.venceEn))
      .slice(0, 8)
      .map(
        (task) =>
          `<div class="task"><label><input type="checkbox" data-task="${task.id}"><span><b>${escape(task.titulo)}</b><br><small>${escape(task.descripcion || "")} · vence ${date(task.venceEn)}</small></span></label></div>`,
      )
      .join("") || '<p class="empty">No hay tareas pendientes.</p>';
  const readings = cultivation.lecturasAmbientales || [];
  const reading = readings.at(-1);
  container.innerHTML = `<div class="grid">${card("Estado del ciclo", `<p><b>${escape(plan.etapa)}</b> · Fotoperiodo ${plan.fotoperiodo}</p><div class="numbers"><div><small>pH objetivo</small><b>${plan.phObjetivo ?? "—"}</b></div><div><small>EC objetivo</small><b>${plan.ecObjetivo ?? "—"}</b></div><div><small>Humedad</small><b>${plan.humedadObjetivo.minimo}–${plan.humedadObjetivo.maximo}%</b></div></div><div class="week-strip" aria-label="Semanas">${weeks}</div><div class="actions" style="margin-top:14px"><button id="advance-week" class="primary" ${cultivation.estado.semanaActiva >= 14 ? "disabled" : ""}>Confirmar semana siguiente</button></div>`, "span-8")}${card("Alertas", alerts, "span-4")}${card("DWC y plantas", `<div class="dwc-grid">${dwcs}</div>`, "span-8")}${card("Ambiente (SonoffLAN)", `<div class="numbers"><div><small>Temperatura</small><b>${reading?.temperatura ?? "—"}${reading ? " °C" : ""}</b></div><div><small>Humedad</small><b>${reading?.humedad ?? "—"}${reading ? " %" : ""}</b></div><div><small>Humidificador</small><b>${reading?.humidificadorEncendido ? "ON" : "—"}</b></div></div><canvas id="humidity-chart" class="chart" aria-label="Historial de humedad"></canvas><button id="sonoff-import" class="secondary">Importar lecturas JSON</button>`, "span-4")}${card("Tareas pendientes", tasks, "span-8")}${card("Receta semanal", `<p>${plan.dosis.length ? plan.dosis.map((dose) => `${escape(dose.producto)} ${dose.mililitrosPorLitro} mL/L`).join(" · ") : "Sin nutrientes programados."}</p><small>Temperatura objetivo ${plan.temperaturaObjetivoC} °C · PPFD ${plan.ppfdReferencia.minimo}–${plan.ppfdReferencia.maximo}</small>`, "span-4")}</div>`;
  drawHumidityChart(
    container.querySelector("#humidity-chart"),
    readings.slice(-20),
  );
}
