import { SCHEMA_VERSION, type CopiaSeguridadCultivo, type Cultivo, type EstadoAplicacion, type PlantillaCultivo } from "./types";

export type ArchivoImportado =
  | { tipo: "plantilla"; archivo: PlantillaCultivo }
  | { tipo: "copia-seguridad"; archivo: CopiaSeguridadCultivo };

export interface ResultadoValidacion<T> {
  valido: boolean;
  errores: string[];
  valor?: T;
}

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}

function validarCabecera(valor: unknown, tipo: "plantilla" | "copia-seguridad"): string[] {
  if (!esObjeto(valor)) return ["El archivo debe ser un objeto JSON."];
  const errores: string[] = [];
  if (valor.formato !== "asistente-cultivo") errores.push("Formato de archivo no reconocido.");
  if (valor.version !== SCHEMA_VERSION) errores.push(`Versión no compatible. Se esperaba ${SCHEMA_VERSION}.`);
  if (valor.tipo !== tipo) errores.push(`Se esperaba un archivo de tipo ${tipo}.`);
  return errores;
}

export function validateTemplate(valor: unknown): ResultadoValidacion<PlantillaCultivo> {
  const errores = validarCabecera(valor, "plantilla");
  if (!esObjeto(valor)) return { valido: false, errores };
  if (typeof valor.id !== "string" || !valor.id) errores.push("La plantilla necesita un id.");
  if (typeof valor.nombre !== "string" || !valor.nombre) errores.push("La plantilla necesita un nombre.");
  if (!esObjeto(valor.configuracion)) errores.push("Falta la configuración de la plantilla.");
  else {
    const config = valor.configuracion;
    if (!Array.isArray(config.dwcs) || config.dwcs.length === 0) errores.push("La plantilla debe definir al menos un DWC.");
    if (!Array.isArray(config.plantas) || config.plantas.length === 0) errores.push("La plantilla debe definir al menos una planta.");
    if (!esObjeto(config.plan) || !Array.isArray(config.plan.semanas) || config.plan.semanas.length === 0) {
      errores.push("La plantilla debe incluir un plan semanal.");
    }
    if (!esObjeto(config.estadoInicial) || typeof config.estadoInicial.semanaActiva !== "number") {
      errores.push("La plantilla debe incluir un estado inicial.");
    }
    if (!Array.isArray(config.asignacionesIniciales)) errores.push("Faltan las asignaciones iniciales.");
  }
  return errores.length ? { valido: false, errores } : { valido: true, errores: [], valor: valor as unknown as PlantillaCultivo };
}

export function validateBackup(valor: unknown): ResultadoValidacion<CopiaSeguridadCultivo> {
  const errores = validarCabecera(valor, "copia-seguridad");
  if (!esObjeto(valor)) return { valido: false, errores };
  if (typeof valor.exportadaEn !== "string") errores.push("La copia de seguridad necesita fecha de exportación.");
  if (!esObjeto(valor.cultivo)) errores.push("La copia de seguridad no contiene un cultivo.");
  else {
    if (typeof valor.cultivo.id !== "string") errores.push("El cultivo respaldado necesita un id.");
    if (typeof valor.cultivo.nombre !== "string") errores.push("El cultivo respaldado necesita un nombre.");
    if (!Array.isArray(valor.cultivo.dwcs)) errores.push("El cultivo respaldado tiene DWC inválidos.");
    if (!Array.isArray(valor.cultivo.eventos)) errores.push("El cultivo respaldado tiene historial inválido.");
  }
  return errores.length ? { valido: false, errores } : { valido: true, errores: [], valor: valor as unknown as CopiaSeguridadCultivo };
}

/** Analiza y valida de forma básica una plantilla o una copia de seguridad JSON. */
export function importFile(texto: string): ArchivoImportado {
  let valor: unknown;
  try {
    valor = JSON.parse(texto);
  } catch {
    throw new Error("El archivo no contiene JSON válido.");
  }
  if (!esObjeto(valor)) throw new Error("El archivo debe ser un objeto JSON.");
  if (valor.tipo === "plantilla") {
    const resultado = validateTemplate(valor);
    if (!resultado.valido || !resultado.valor) throw new Error(resultado.errores.join(" "));
    return { tipo: "plantilla", archivo: resultado.valor };
  }
  if (valor.tipo === "copia-seguridad") {
    const resultado = validateBackup(valor);
    if (!resultado.valido || !resultado.valor) throw new Error(resultado.errores.join(" "));
    return { tipo: "copia-seguridad", archivo: resultado.valor };
  }
  throw new Error("El tipo de archivo debe ser plantilla o copia-seguridad.");
}

/** Exporta una copia de seguridad de un cultivo. Si se recibe el estado, usa el seleccionado o el primero. */
export function exportBackup(origen: Cultivo | EstadoAplicacion): string {
  const cultivo = "cultivos" in origen
    ? origen.cultivos.find(({ id }) => id === origen.cultivoSeleccionadoId) ?? origen.cultivos[0]
    : origen;
  if (!cultivo) throw new Error("No hay un cultivo para exportar.");
  const archivo: CopiaSeguridadCultivo = {
    formato: "asistente-cultivo",
    version: SCHEMA_VERSION,
    tipo: "copia-seguridad",
    exportadaEn: new Date().toISOString(),
    cultivo,
  };
  return JSON.stringify(archivo, null, 2);
}

export function exportTemplate(plantilla: PlantillaCultivo): string {
  return JSON.stringify(plantilla, null, 2);
}
