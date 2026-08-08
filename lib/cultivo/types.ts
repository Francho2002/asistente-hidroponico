/** Modelo de dominio local-first del asistente de cultivo. */

export const SCHEMA_VERSION = 1 as const;

export type Id = string;
export type FechaISO = string;
export type FuenteModo = "manual" | "automatica" | "no_disponible";
export type AlcanceTipo = "cultivo" | "dwc" | "planta" | "equipo" | "inventario";
export type EstadoTarea = "pendiente" | "completada" | "omitida";
export type SeveridadAlerta = "informacion" | "aviso" | "alerta";
export type EstadoAlerta = "activa" | "reconocida" | "resuelta";

export interface FuenteDato {
  modo: FuenteModo;
  equipoId?: Id;
  etiqueta: string;
  pendienteConexion?: boolean;
}

export interface Alcance {
  tipo: AlcanceTipo;
  id?: Id;
}

export interface Medicion<T extends number | boolean | string = number> {
  variable: string;
  valor: T;
  unidad?: string;
}

export interface Equipo {
  id: Id;
  nombre: string;
  categoria:
    | "iluminacion"
    | "climatizacion"
    | "humidificacion"
    | "ventilacion"
    | "aireacion"
    | "instrumento"
    | "sensor"
    | "otro";
  descripcion?: string;
  capacidades?: string[];
}

export interface FuenteVariable {
  variable: string;
  fuente: FuenteDato;
  unidad?: string;
}

export interface DWC {
  id: Id;
  nombre: string;
  capacidadNominalLitros: number;
  volumenTrabajoLitros: number;
  notas?: string;
}

export interface Planta {
  id: Id;
  nombre: string;
  variedad?: string;
  banco?: string;
  estado: "semilla_en_lana_de_roca" | "plántula" | "vegetativo" | "flora" | "cosechada" | "retirada";
  notas?: string;
}

/** Una asignación abierta no tiene fechaFin. Es la única fuente de verdad Planta <-> DWC. */
export interface Asignacion {
  id: Id;
  plantaId: Id;
  dwcId: Id;
  fechaInicio: FechaISO;
  fechaFin?: FechaISO;
  notas?: string;
}

export interface DosisNutriente {
  productoId: Id;
  producto: string;
  mililitrosPorLitro: number;
}

export interface PlanSemanal {
  semana: number;
  etapa: string;
  dosis: DosisNutriente[];
  ecObjetivo?: number;
  phObjetivo?: number;
  fotoperiodo: string;
  ppfdReferencia?: { minimo: number; maximo: number };
  humedadObjetivo?: { minimo: number; maximo: number };
  temperaturaObjetivoC: number;
}

export interface PlanCultivo {
  semanas: PlanSemanal[];
  cambioEtapaRequiereConfirmacion: boolean;
  instruccionesPreparacion: string[];
}

export interface ItemInventario {
  id: Id;
  nombre: string;
  cantidad: number;
  unidad: "mL" | "L" | "unidad" | "m";
  umbralBajo?: number;
  notas?: string;
}

export interface ReglaTarea {
  id: Id;
  titulo: string;
  descripcion?: string;
  alcance: Alcance;
  frecuenciaHoras?: number;
  eventoSugerido?: TipoEvento;
  activa: boolean;
}

export interface Tarea {
  id: Id;
  reglaId?: Id;
  titulo: string;
  descripcion?: string;
  alcance: Alcance;
  venceEn: FechaISO;
  estado: EstadoTarea;
  completadaEn?: FechaISO;
  eventoId?: Id;
}

export interface ReglaAlerta {
  id: Id;
  nombre: string;
  severidad: SeveridadAlerta;
  descripcion: string;
  activa: boolean;
  condicion: string;
  notificacionNavegador?: boolean;
}

export interface Alerta {
  id: Id;
  reglaId?: Id;
  severidad: SeveridadAlerta;
  titulo: string;
  detalle?: string;
  alcance: Alcance;
  creadaEn: FechaISO;
  estado: EstadoAlerta;
}

export interface EventoBase {
  id: Id;
  tipo: TipoEvento;
  fecha: FechaISO;
  alcance: Alcance;
  etapaActiva?: string;
  fuente: FuenteDato;
  notas?: string;
}

export interface EventoMedicionSolucion extends EventoBase {
  tipo: "medicion_solucion";
  alcance: { tipo: "dwc"; id: Id };
  valores: {
    ph?: Medicion;
    ec?: Medicion;
    temperaturaSolucion?: Medicion;
  };
}

export interface EventoLecturaAmbiental extends EventoBase {
  tipo: "lectura_ambiental";
  alcance: { tipo: "cultivo" };
  valores: {
    temperaturaAmbiente?: Medicion;
    humedad?: Medicion;
    humidificadorEncendido?: Medicion<boolean>;
  };
}

export interface EventoReposicionAgua extends EventoBase {
  tipo: "reposicion_agua";
  litros: number;
}

export interface EventoNutricion extends EventoBase {
  tipo: "nutricion";
  productos: Array<{ inventarioId?: Id; nombre: string; cantidad: number; unidad: "mL" | "L" }>;
}

export interface EventoCambioSolucion extends EventoBase {
  tipo: "cambio_solucion";
  volumenLitros: number;
  tipoCambio: "preparacion_inicial" | "renovacion" | "lavado";
}

export interface EventoObservacion extends EventoBase {
  tipo: "observacion";
  observacion: string;
  fotos?: string[];
}

export interface EventoEtapa extends EventoBase {
  tipo: "etapa";
  semana: number;
  etapaAnterior?: string;
  etapaNueva: string;
  confirmado: boolean;
}

export interface EventoIncidencia extends EventoBase {
  tipo: "incidencia";
  accion: "abierta" | "actualizada" | "resuelta";
  titulo: string;
  gravedad: "baja" | "media" | "alta";
  incidenciaId: Id;
}

export interface EventoCorreccionPh extends EventoBase {
  tipo: "correccion_ph";
  producto?: string;
  cantidad?: number;
  unidad?: "mL" | "L";
}

export interface EventoMantenimiento extends EventoBase {
  tipo: "mantenimiento";
  accion: "calibrar" | "limpiar" | "mantener" | "reemplazar";
  equipoId?: Id;
}

export interface EventoInventario extends EventoBase {
  tipo: "inventario";
  accion: "recibir" | "consumir" | "ajustar" | "descartar";
  inventarioId: Id;
  cantidad: number;
  unidad: ItemInventario["unidad"];
}

export type TipoEvento =
  | "medicion_solucion"
  | "lectura_ambiental"
  | "reposicion_agua"
  | "nutricion"
  | "cambio_solucion"
  | "observacion"
  | "etapa"
  | "incidencia"
  | "correccion_ph"
  | "mantenimiento"
  | "inventario";

export type Evento =
  | EventoMedicionSolucion
  | EventoLecturaAmbiental
  | EventoReposicionAgua
  | EventoNutricion
  | EventoCambioSolucion
  | EventoObservacion
  | EventoEtapa
  | EventoIncidencia
  | EventoCorreccionPh
  | EventoMantenimiento
  | EventoInventario;

export interface Cultivo {
  id: Id;
  creadoDesdePlantilla?: { id: Id; nombre: string };
  nombre: string;
  variedad: string;
  banco?: string;
  fechaInicio: FechaISO;
  creadoEn: FechaISO;
  actualizadoEn: FechaISO;
  estado: { semanaActiva: number; etapaActiva: string; activo: boolean };
  espacio: { nombre: string; largoM: number; anchoM: number; altoM: number };
  dwcs: DWC[];
  plantas: Planta[];
  asignaciones: Asignacion[];
  equipos: Equipo[];
  fuentesVariables: FuenteVariable[];
  inventario: ItemInventario[];
  plan: PlanCultivo;
  reglasTareas: ReglaTarea[];
  reglasAlertas: ReglaAlerta[];
  tareas: Tarea[];
  alertas: Alerta[];
  eventos: Evento[];
}

export interface PlantillaCultivo {
  formato: "asistente-cultivo";
  version: typeof SCHEMA_VERSION;
  tipo: "plantilla";
  id: Id;
  nombre: string;
  descripcion?: string;
  configuracion: Omit<
    Cultivo,
    "id" | "creadoDesdePlantilla" | "fechaInicio" | "creadoEn" | "actualizadoEn" | "estado" | "asignaciones" | "tareas" | "alertas" | "eventos"
  > & {
    estadoInicial: Cultivo["estado"];
    asignacionesIniciales: Array<Omit<Asignacion, "id" | "fechaInicio" | "fechaFin">>;
  };
}

export interface CopiaSeguridadCultivo {
  formato: "asistente-cultivo";
  version: typeof SCHEMA_VERSION;
  tipo: "copia-seguridad";
  exportadaEn: FechaISO;
  cultivo: Cultivo;
}

export interface EstadoAplicacion {
  version: typeof SCHEMA_VERSION;
  actualizadoEn: FechaISO;
  cultivoSeleccionadoId?: Id;
  cultivos: Cultivo[];
}
