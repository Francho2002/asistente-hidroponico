export function createAmbientalFeatures(api) {
  const ruleIsActive = (cultivation, ruleId) =>
    cultivation.reglasAlertas?.find((rule) => rule.id === ruleId)?.activa ?? true;
  const addAlert = (
    cultivation,
    ruleId,
    severity,
    title,
    detail,
    scope = { tipo: "cultivo" },
  ) => {
    if (!ruleIsActive(cultivation, ruleId)) return false;
    const duplicate = cultivation.alertas.some(
      (alert) =>
        alert.estado === "activa" &&
        alert.titulo === title &&
        alert.alcance?.id === scope.id,
    );
    if (!duplicate)
      cultivation.alertas.push({
        id: api.id("alerta"),
        reglaId: ruleId,
        severidad: severity,
        titulo: title,
        detalle: detail,
        alcance: scope,
        creadaEn: api.now(),
        estado: "activa",
      });
    return !duplicate;
  };
  const evaluateAmbient = (cultivation, reading) => {
    const plan = api.currentPlan(cultivation);
    const notices = [];
    if (
      Math.abs(reading.temperatura - plan.temperaturaObjetivoC) >= 2 &&
      addAlert(
        cultivation,
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
        cultivation,
        "humedad-fuera-rango",
        "alerta",
        "Humedad fuera del rango objetivo",
        `Se registró ${reading.humedad} %; el objetivo es ${plan.humedadObjetivo.minimo}–${plan.humedadObjetivo.maximo} %.`,
      )
    )
      notices.push(`Humedad ${reading.humedad} %`);
    return notices;
  };
  async function recordReadings(
    readings,
    source = { modo: "automatica", etiqueta: "SonoffLAN" },
  ) {
    const identifiedReadings = readings.map((reading) => ({
      ...reading,
      id: reading.id || api.id("lectura"),
    }));
    const notices = [];
    await api.updateCultivation((cultivation) => {
      cultivation.lecturasAmbientales = [
        ...(cultivation.lecturasAmbientales || []),
        ...identifiedReadings.map((reading) => ({ ...reading, fuente: source })),
      ].sort((a, b) => a.fecha.localeCompare(b.fecha));
      identifiedReadings.forEach((reading) => {
        cultivation.eventos.push({
          id: api.id("evento"),
          tipo: "lectura_ambiental",
          fecha: reading.fecha,
          alcance: { tipo: "cultivo" },
          etapaActiva: cultivation.estado.etapaActiva,
          fuente: source,
          valores: reading,
        });
        notices.push(...evaluateAmbient(cultivation, reading));
      });
    });
    notices.forEach((notice) => api.notify("Raíz: alerta ambiental", notice));
    return notices;
  }
  async function importSonoff(text) {
    try {
      const source = JSON.parse(text);
      const rows = Array.isArray(source)
        ? source
        : Array.isArray(source.readings)
          ? source.readings
          : [source];
      const readings = rows.map((row) => {
        if (!row || typeof row !== "object")
          throw new Error("Cada lectura debe ser un objeto.");
        const temperatura = Number(
          row.temperatura ?? row.temperature ?? row.currentTemperature,
        );
        const humedad = Number(
          row.humedad ?? row.humidity ?? row.currentHumidity,
        );
        const fecha = new Date(row.fecha ?? row.timestamp ?? row.time ?? api.now());
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
            row.humidificadorEncendido === true ||
            row.humidifier === true ||
            String(row.switch).toLowerCase() === "on",
        };
      });
      const notices = await recordReadings(readings);
      api.closeModal();
      api.showToast(
        `${readings.length} lectura(s) importada(s).${notices.length ? " Se generaron alertas." : ""}`,
      );
    } catch (error) {
      api.showToast(error.message || "JSON inválido.");
    }
  }
  return { addAlert, evaluateAmbient, importSonoff, recordReadings };
}
