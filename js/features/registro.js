import { formatDecimal, parseDecimal } from "../domain.js";

const decimalInput = (name, attributes = "") =>
  `<input name="${name}" type="text" inputmode="decimal" autocomplete="off" ${attributes}>`;

export function actionForm(action, cultivation, selectedDwc, escape) {
  const options = cultivation.dwcs
    .map(
      (dwc) =>
        `<option value="${dwc.id}" ${dwc.id === selectedDwc ? "selected" : ""}>${escape(dwc.nombre)}</option>`,
    )
    .join("");
  const dwc = `<label>DWC<select name="dwc">${options}</select></label>`;
  const forms = {
    measure: [
      "Registrar medición",
      `${dwc}<label>pH${decimalInput("ph", 'required placeholder="5,8"')}</label><label>EC (mS/cm)${decimalInput("ec", 'required placeholder="1,8"')}</label><label>Temperatura (°C)${decimalInput("temperature", 'required placeholder="21,4"')}</label>`,
    ],
    water: [
      "Registrar reposición",
      `${dwc}<label>Litros añadidos${decimalInput("liters", 'required placeholder="1,5"')}</label>`,
    ],
    solution: [
      "Registrar cambio de solución",
      `<label class="full">Alcance<select name="dwc"><option value="todos">Todos los DWC</option>${options}</select></label>`,
    ],
    observation: [
      "Registrar observación",
      `<label>Planta<select name="plant">${cultivation.plantas.map((plant) => `<option value="${plant.id}">${escape(plant.nombre)}</option>`).join("")}</select></label><label class="full">Observación<textarea name="observation" rows="4" required></textarea></label>`,
    ],
    nutrition: [
      "Registrar nutrición",
      `${dwc}<label>Producto<select name="product">${cultivation.inventario.map((item) => `<option value="${item.id}">${escape(item.nombre)} (${item.cantidad} ${item.unidad})</option>`).join("")}</select></label><label>Cantidad (mL)${decimalInput("amount", 'required placeholder="1,5"')}</label>`,
    ],
  };
  return forms[action];
}

export function createRegistroFeatures(api) {
  async function submit(action, data) {
    const cultivation = api.cultivation();
    const time = api.now();
    if (action === "inventory") {
      const name = String(data.get("name") || "").trim();
      const quantity = parseDecimal(data.get("quantity"));
      const unit = String(data.get("unit") || "").trim();
      const threshold = String(data.get("threshold") || "").trim();
      const notes = String(data.get("notes") || "").trim();
      if (!name || !unit || !Number.isFinite(quantity))
        return api.showToast("Completá nombre, cantidad y unidad.");
      await api.updateCultivation((item) =>
        item.inventario.push({
          id: api.id("inventario"),
          nombre: name,
          cantidad: quantity,
          unidad: unit,
          umbralBajo:
            threshold === "" ? undefined : parseDecimal(threshold),
          notas: notes || undefined,
        }),
      );
      api.closeModal();
      return api.showToast("Insumo añadido al inventario.");
    }
    const dwc = String(data.get("dwc"));
    const base = {
      id: api.id("evento"),
      fecha: time,
      alcance: { tipo: "dwc", id: dwc },
      etapaActiva: cultivation.estado.etapaActiva,
      fuente: { modo: "manual", etiqueta: "Registro manual" },
    };
    if (action === "measure") {
      const ph = parseDecimal(data.get("ph"));
      const ec = parseDecimal(data.get("ec"));
      const temperature = parseDecimal(data.get("temperature"));
      if (![ph, ec, temperature].every(Number.isFinite))
        return api.showToast("Completá pH, EC y temperatura.");
      const notices = [];
      await api.updateCultivation((item) => {
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
        item.eventos.push(measurement);
        item.tareas.forEach((task) => {
          if (
            task.alcance?.id === dwc &&
            task.reglaId === "medir-solucion" &&
            task.estado === "pendiente"
          ) {
            task.estado = "completada";
            task.completadaEn = time;
          }
        });
        item.tareas.push({
          id: api.id("tarea"),
          reglaId: "medir-solucion",
          titulo: "Medir solución",
          descripcion: "Registrar pH, EC y temperatura.",
          alcance: { tipo: "dwc", id: dwc },
          venceEn: api.hoursFrom(time, 48),
          estado: "pendiente",
        });
        if (
          (ph < 5.5 || ph > 6.5) &&
          api.addAlert(
            item,
            "ph-general",
            "alerta",
            "pH fuera del rango general",
            `Se registró pH ${formatDecimal(ph)}.`,
            measurement.alcance,
          )
        )
          notices.push("pH fuera de rango");
        if (
          api.currentPlan(item).ecObjetivo !== undefined &&
          Math.abs(ec - api.currentPlan(item).ecObjetivo) >= 0.2 &&
          api.addAlert(
            item,
            "ec-objetivo",
            "aviso",
            "EC alejada del objetivo",
            `Se registró EC ${formatDecimal(ec)}.`,
            measurement.alcance,
          )
        )
          notices.push("EC alejada del objetivo");
      });
      notices.forEach((notice) =>
        api.notify("Raíz: alerta de solución", notice),
      );
      api.closeModal();
      return api.showToast("Medición guardada; la próxima vence en 48 h.");
    }
    if (action === "water") {
      const liters = parseDecimal(data.get("liters"));
      if (!Number.isFinite(liters) || liters <= 0)
        return api.showToast("Indicá una cantidad de agua válida.");
      await api.updateCultivation((item) => {
        item.eventos.push({ ...base, tipo: "reposicion_agua", litros });
        item.tareas.forEach((task) => {
          if (
            task.alcance?.id === dwc &&
            task.reglaId === "revisar-agua" &&
            task.estado === "pendiente"
          ) {
            task.estado = "completada";
            task.completadaEn = time;
          }
        });
      });
      api.closeModal();
      return api.showToast("Reposición guardada y tarea de agua completada.");
    }
    if (action === "solution") {
      const ids =
        dwc === "todos" ? cultivation.dwcs.map((item) => item.id) : [dwc];
      await api.updateCultivation((item) => {
        ids.forEach((dwcId) =>
          item.eventos.push({
            ...base,
            id: api.id("evento"),
            tipo: "cambio_solucion",
            alcance: { tipo: "dwc", id: dwcId },
            volumenLitros: item.dwcs.find((unit) => unit.id === dwcId)
              ?.volumenTrabajoLitros,
          }),
        );
        item.tareas.forEach((task) => {
          if (
            ids.includes(task.alcance?.id) &&
            task.reglaId === "renovar-solucion" &&
            task.estado === "pendiente"
          ) {
            task.estado = "completada";
            task.completadaEn = time;
          }
        });
        ids.forEach((dwcId) =>
          item.tareas.push({
            id: api.id("tarea"),
            reglaId: "renovar-solucion",
            titulo: "Renovar solución",
            descripcion: "Renovación semanal.",
            alcance: { tipo: "dwc", id: dwcId },
            venceEn: api.hoursFrom(time, 168),
            estado: "pendiente",
          }),
        );
      });
      api.closeModal();
      return api.showToast("Cambio de solución registrado.");
    }
    if (action === "observation") {
      const text = String(data.get("observation") || "").trim();
      if (!text) return api.showToast("Escribí una observación.");
      await api.updateCultivation((item) =>
        item.eventos.push({
          ...base,
          tipo: "observacion",
          alcance: { tipo: "planta", id: data.get("plant") },
          observacion: text,
        }),
      );
      api.closeModal();
      return api.showToast("Observación guardada.");
    }
    if (action === "nutrition") {
      const product = cultivation.inventario.find(
        (item) => item.id === data.get("product"),
      );
      const amount = parseDecimal(data.get("amount"));
      if (!product || !Number.isFinite(amount) || amount <= 0)
        return api.showToast("Indicá un producto y cantidad válidos.");
      await api.updateCultivation((item) => {
        item.eventos.push({
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
        const inventoryItem = item.inventario.find(
          (entry) => entry.id === product.id,
        );
        inventoryItem.cantidad = Math.max(
          0,
          inventoryItem.cantidad -
            (inventoryItem.unidad === "L" ? amount / 1000 : amount),
        );
      });
      api.closeModal();
      return api.showToast("Nutrición registrada e inventario actualizado.");
    }
  }
  return { submit };
}
