import { SCHEMA_VERSION, type Cultivo, type EstadoAplicacion } from "./types";

const DB_NAME = "asistente-cultivo";
const DB_VERSION = 1;
const STORE_NAME = "estado";
const STATE_KEY = "actual";
let memoria: EstadoAplicacion | undefined;

export function emptyCultivationState(): EstadoAplicacion {
  return { version: SCHEMA_VERSION, actualizadoEn: new Date().toISOString(), cultivos: [] };
}

function clonar<T>(valor: T): T {
  return JSON.parse(JSON.stringify(valor)) as T;
}

function indexedDbDisponible(): boolean {
  return typeof globalThis !== "undefined" && typeof globalThis.indexedDB !== "undefined";
}

function abrirDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const solicitud = globalThis.indexedDB.open(DB_NAME, DB_VERSION);
    solicitud.onupgradeneeded = () => {
      if (!solicitud.result.objectStoreNames.contains(STORE_NAME)) {
        solicitud.result.createObjectStore(STORE_NAME);
      }
    };
    solicitud.onsuccess = () => resolve(solicitud.result);
    solicitud.onerror = () => reject(solicitud.error ?? new Error("No se pudo abrir IndexedDB"));
  });
}

async function leerIndexedDb(): Promise<EstadoAplicacion | undefined> {
  const db = await abrirDb();
  try {
    return await new Promise<EstadoAplicacion | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const solicitud = tx.objectStore(STORE_NAME).get(STATE_KEY);
      solicitud.onsuccess = () => resolve(solicitud.result as EstadoAplicacion | undefined);
      solicitud.onerror = () => reject(solicitud.error ?? new Error("No se pudo leer el estado"));
    });
  } finally {
    db.close();
  }
}

async function escribirIndexedDb(estado: EstadoAplicacion): Promise<void> {
  const db = await abrirDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(estado, STATE_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("No se pudo guardar el estado"));
      tx.onabort = () => reject(tx.error ?? new Error("Se canceló el guardado"));
    });
  } finally {
    db.close();
  }
}

/** Carga el único estado local. En SSR, pruebas o navegadores restringidos usa memoria. */
export async function loadCultivation(): Promise<EstadoAplicacion> {
  if (!indexedDbDisponible()) return clonar(memoria ?? emptyCultivationState());
  try {
    const estado = await leerIndexedDb();
    memoria = estado ?? emptyCultivationState();
    return clonar(memoria);
  } catch {
    return clonar(memoria ?? emptyCultivationState());
  }
}

/** Reemplaza atómicamente el estado local completo y conserva una copia de respaldo en memoria. */
export async function saveCultivation(estado: EstadoAplicacion): Promise<EstadoAplicacion> {
  const siguiente: EstadoAplicacion = {
    ...clonar(estado),
    version: SCHEMA_VERSION,
    actualizadoEn: new Date().toISOString(),
  };
  memoria = siguiente;
  if (indexedDbDisponible()) {
    try {
      await escribirIndexedDb(siguiente);
    } catch {
      // El fallback en memoria mantiene funcional la sesión si IndexedDB está bloqueado.
    }
  }
  return clonar(siguiente);
}

/** Añade o reemplaza un cultivo dentro del estado único de la aplicación. */
export async function upsertCultivation(cultivo: Cultivo, seleccionar = true): Promise<EstadoAplicacion> {
  const actual = await loadCultivation();
  const indice = actual.cultivos.findIndex(({ id }) => id === cultivo.id);
  const cultivos = [...actual.cultivos];
  if (indice >= 0) cultivos[indice] = cultivo;
  else cultivos.push(cultivo);
  return saveCultivation({ ...actual, cultivos, cultivoSeleccionadoId: seleccionar ? cultivo.id : actual.cultivoSeleccionadoId });
}

/** Elimina un cultivo por id; sin id limpia todo el estado local de forma explícita. */
export async function deleteCultivation(cultivoId?: string): Promise<EstadoAplicacion> {
  if (!cultivoId) return saveCultivation(emptyCultivationState());
  const actual = await loadCultivation();
  const cultivos = actual.cultivos.filter(({ id }) => id !== cultivoId);
  const seleccionado = actual.cultivoSeleccionadoId === cultivoId ? cultivos[0]?.id : actual.cultivoSeleccionadoId;
  return saveCultivation({ ...actual, cultivos, cultivoSeleccionadoId: seleccionado });
}

export const STORAGE = { DB_NAME, DB_VERSION, STORE_NAME };
