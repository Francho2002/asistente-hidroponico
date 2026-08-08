export function createCycleFeatures(api) {
  async function toggleTask(taskId) {
    await api.updateCultivation((cultivation) => {
      const task = cultivation.tareas.find((item) => item.id === taskId);
      task.estado = task.estado === "completada" ? "pendiente" : "completada";
      task.completadaEn = task.estado === "completada" ? api.now() : undefined;
    });
    api.showToast("Tarea actualizada.");
  }

  function requestWeek(week) {
    const cultivation = api.cultivation();
    if (week < 0 || week > 14 || week === cultivation.estado.semanaActiva)
      return;
    if (week !== cultivation.estado.semanaActiva + 1) {
      api.showToast("El avance se confirma de a una semana.");
      return;
    }
    api.setModalAction("week");
    const stage = cultivation.plan.semanas.find((item) => item.semana === week);
    api.openModal(
      `Confirmar semana ${week}`,
      `<p>Vas a activar <b>${api.escape(stage.etapa)}</b>. Este avance se registra en el historial.</p>`,
    );
  }

  async function advanceWeek() {
    const cultivation = api.cultivation();
    const week = Math.min(14, cultivation.estado.semanaActiva + 1);
    const plan = cultivation.plan.semanas.find((item) => item.semana === week);
    const time = api.now();
    await api.updateCultivation((item) => {
      item.estado.semanaActiva = week;
      item.estado.etapaActiva = plan.etapa;
      item.eventos.push({
        id: api.id("evento"),
        tipo: "etapa",
        fecha: time,
        alcance: { tipo: "cultivo" },
        semana: week,
        etapaNueva: plan.etapa,
        fuente: { modo: "sistema", etiqueta: "Avance confirmado" },
      });
    });
    api.closeModal();
    api.showToast(`Semana ${week} activada: ${plan.etapa}.`);
  }

  async function saveSettings(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await api.updateCultivation((cultivation) => {
      cultivation.nombre =
        String(form.get("nombre") || "").trim() || cultivation.nombre;
      cultivation.variedad =
        String(form.get("variedad") || "").trim() || cultivation.variedad;
      cultivation.banco =
        String(form.get("banco") || "").trim() || cultivation.banco;
      cultivation.espacio ||= {};
      ["largo", "ancho", "alto"].forEach((key) => {
        const value = Number(form.get(`espacio-${key}`));
        if (Number.isFinite(value) && value > 0)
          cultivation.espacio[`${key}M`] = value;
      });
      const temperature = Number(form.get("temperaturaObjetivoC"));
      if (Number.isFinite(temperature)) {
        cultivation.plan.semanas.forEach((week) => {
          week.temperaturaObjetivoC = temperature;
        });
      }
      cultivation.dwcs.forEach((dwc) => {
        const name = String(form.get(`dwc-name-${dwc.id}`) || "").trim();
        const volume = Number(form.get(`dwc-volume-${dwc.id}`));
        if (name) dwc.nombre = name;
        if (Number.isFinite(volume) && volume > 0)
          dwc.volumenTrabajoLitros = volume;
        const plant = String(form.get(dwc.id) || "");
        const open = cultivation.asignaciones.find(
          (assignment) => assignment.dwcId === dwc.id && !assignment.fechaFin,
        );
        if (open && open.plantaId !== plant) open.fechaFin = api.now();
        if (plant && (!open || open.plantaId !== plant)) {
          cultivation.asignaciones.forEach((assignment) => {
            if (assignment.plantaId === plant && !assignment.fechaFin)
              assignment.fechaFin = api.now();
          });
          cultivation.asignaciones.push({
            id: api.id("asignacion"),
            plantaId: plant,
            dwcId: dwc.id,
            fechaInicio: api.now(),
          });
        }
      });
      (cultivation.reglasAlertas || []).forEach((rule) => {
        const input = document.querySelector(
          `[name="alert-${CSS.escape(rule.id)}"]`,
        );
        if (input) rule.activa = input.checked;
      });
    });
    api.showToast("Configuración guardada.");
  }

  return { toggleTask, requestWeek, advanceWeek, saveSettings };
}
