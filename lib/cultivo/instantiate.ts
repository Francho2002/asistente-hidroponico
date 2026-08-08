import type { Alcance, Cultivo, FechaISO, PlantillaCultivo, Tarea } from "./types";

const copiar = <T>(valor: T): T => JSON.parse(JSON.stringify(valor)) as T;

export function crearId(prefijo: string): string {
  const cryptoDisponible = typeof globalThis !== "undefined" ? globalThis.crypto : undefined;
  if (cryptoDisponible?.randomUUID) return `${prefijo}-${cryptoDisponible.randomUUID()}`;
  return `${prefijo}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function fechaISO(fecha?: Date | FechaISO): FechaISO {
  return fecha instanceof Date ? fecha.toISOString() : fecha ?? new Date().toISOString();
}

function sumarHoras(origen: FechaISO, horas: number): FechaISO {
  return new Date(new Date(origen).getTime() + horas * 60 * 60 * 1000).toISOString();
}

function tarea(
  titulo: string,
  alcance: Alcance,
  venceEn: FechaISO,
  descripcion?: string,
  reglaId?: string,
): Tarea {
  return { id: crearId("tarea"), reglaId, titulo, descripcion, alcance, venceEn, estado: "pendiente" };
}

/**
 * Crea un ciclo independiente. La plantilla nunca se modifica y la fecha de
 * importación se convierte en el inicio del cultivo.
 */
export function createCultivationFromTemplate(template: PlantillaCultivo, now?: Date | FechaISO): Cultivo {
  const fecha = fechaISO(now);
  const configuracion = copiar(template.configuracion);
  const { estadoInicial, asignacionesIniciales, ...base } = configuracion;
  const tareasIniciales: Tarea[] = [
    tarea("Preparar la solución inicial", { tipo: "cultivo" }, fecha, "Preparar la receta de la semana 0 y repartir 16 L por DWC."),
    tarea("Comprobar aireadores", { tipo: "equipo", id: "aireadores" }, fecha, "Confirmar que las cuatro piedras difusoras reciben aire."),
  ];

  for (const dwc of base.dwcs) {
    tareasIniciales.push(
      tarea("Realizar la primera medición", { tipo: "dwc", id: dwc.id }, fecha, "Registrar pH, EC y temperatura de solución.", "medir-solucion"),
      tarea("Revisar nivel de agua", { tipo: "dwc", id: dwc.id }, fecha, "Comprobar nivel, raíces, olor y claridad.", "revisar-agua"),
      tarea("Renovar solución", { tipo: "dwc", id: dwc.id }, sumarHoras(fecha, 168), "Renovación semanal de la solución.", "renovar-solucion"),
    );
  }

  return {
    ...base,
    id: crearId("cultivo"),
    creadoDesdePlantilla: { id: template.id, nombre: template.nombre },
    fechaInicio: fecha,
    creadoEn: fecha,
    actualizadoEn: fecha,
    estado: copiar(estadoInicial),
    asignaciones: asignacionesIniciales.map((asignacion) => ({
      ...asignacion,
      id: crearId("asignacion"),
      fechaInicio: fecha,
    })),
    tareas: tareasIniciales,
    alertas: [],
    eventos: [],
  };
}

/** Alias en español para consumidores que prefieran la API de dominio. */
export const crearCultivoDesdePlantilla = createCultivationFromTemplate;
