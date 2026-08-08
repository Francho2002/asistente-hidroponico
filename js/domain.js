export const clone = (value) => structuredClone(value);
export const id = (prefix) =>
  `${prefix}-${crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
export const now = () => new Date().toISOString();
export const hoursFrom = (date, hours) =>
  new Date(new Date(date).getTime() + hours * 3600000).toISOString();
function readingValue(value) {
  return value && typeof value === "object" && "valor" in value
    ? value.valor
    : value;
}
export function normalizeCultivation(cultivation) {
  cultivation.alertas ||= [];
  cultivation.eventos ||= [];
  cultivation.tareas ||= [];
  cultivation.asignaciones ||= [];
  cultivation.inventario ||= [];
  if (!Array.isArray(cultivation.lecturasAmbientales)) {
    cultivation.lecturasAmbientales = cultivation.eventos
      .filter((event) => event.tipo === "lectura_ambiental" && event.valores)
      .map((event) => ({
        fecha: event.fecha,
        temperatura: Number(readingValue(event.valores.temperatura) ?? readingValue(event.valores.temperaturaAmbiente)),
        humedad: Number(readingValue(event.valores.humedad)),
        humidificadorEncendido: Boolean(readingValue(event.valores.humidificadorEncendido)),
      }))
      .filter((reading) => Number.isFinite(reading.temperatura) && Number.isFinite(reading.humedad));
  }
  return cultivation;
}
export function currentPlan(cultivation) {
  return (
    cultivation.plan.semanas.find(
      (w) => w.semana === cultivation.estado.semanaActiva,
    ) || cultivation.plan.semanas[0]
  );
}
export function createCultivation(template, date = now()) {
  const c = clone(template.configuracion);
  const { estadoInicial, asignacionesIniciales, ...base } = c;
  const tasks = [
    {
      titulo: "Preparar la solución inicial",
      alcance: { tipo: "cultivo" },
      venceEn: date,
      descripcion: "Preparar la receta de la semana 0.",
    },
    {
      titulo: "Comprobar aireadores",
      alcance: { tipo: "equipo", id: "aireadores" },
      venceEn: date,
      descripcion: "Confirmar aireación de las cuatro piedras.",
    },
  ];
  base.dwcs.forEach((dwc) =>
    tasks.push(
      {
        reglaId: "medir-solucion",
        titulo: "Medir solución",
        descripcion: "Registrar pH, EC y temperatura.",
        alcance: { tipo: "dwc", id: dwc.id },
        venceEn: date,
      },
      {
        reglaId: "revisar-agua",
        titulo: "Revisar nivel de agua",
        descripcion: "Comprobar nivel, raíces, olor y claridad.",
        alcance: { tipo: "dwc", id: dwc.id },
        venceEn: date,
      },
      {
        reglaId: "renovar-solucion",
        titulo: "Renovar solución",
        descripcion: "Renovación semanal de la solución.",
        alcance: { tipo: "dwc", id: dwc.id },
        venceEn: hoursFrom(date, 168),
      },
    ),
  );
  return {
    ...base,
    id: id("cultivo"),
    creadoDesdePlantilla: { id: template.id, nombre: template.nombre },
    fechaInicio: date,
    creadoEn: date,
    actualizadoEn: date,
    estado: clone(estadoInicial),
    asignaciones: asignacionesIniciales.map((x) => ({
      ...x,
      id: id("asignacion"),
      fechaInicio: date,
    })),
    tareas: tasks.map((x) => ({ ...x, id: id("tarea"), estado: "pendiente" })),
    alertas: [],
    eventos: [],
    lecturasAmbientales: [],
  };
}
export function backup(cultivation) {
  return JSON.stringify(
    {
      formato: "asistente-cultivo",
      version: 1,
      tipo: "copia-seguridad",
      exportadaEn: now(),
      cultivo: cultivation,
    },
    null,
    2,
  );
}
