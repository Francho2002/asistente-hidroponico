export const SYNC_COLLECTIONS = [
  "eventos",
  "tareas",
  "alertas",
  "asignaciones",
  "inventario",
  "dwcs",
  "plantas",
  "equipos",
  "fuentesVariables",
  "reglasAlertas",
  "reglasTareas",
  "lecturasAmbientales",
];

const clone = (value) => structuredClone(value);
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const syncFree = (value) => {
  if (Array.isArray(value)) return value.map(syncFree);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value)
      .filter((key) => key !== "_sync")
      .sort()
      .map((key) => [key, syncFree(value[key])]),
  );
};

export const stableJson = (value) => JSON.stringify(syncFree(value));
export function signature(value) {
  let hash = 2166136261;
  for (const char of stableJson(value)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}
const normalClock = (clock) =>
  Object.fromEntries(
    Object.entries(clock || {}).filter(([, value]) => Number.isInteger(value) && value >= 0),
  );
export const mergeClocks = (left = {}, right = {}) => {
  const merged = {};
  for (const key of new Set([...Object.keys(left), ...Object.keys(right)]))
    merged[key] = Math.max(left[key] || 0, right[key] || 0);
  return merged;
};
export function compareClocks(left = {}, right = {}) {
  const a = normalClock(left);
  const b = normalClock(right);
  let aGreater = false;
  let bGreater = false;
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if ((a[key] || 0) > (b[key] || 0)) aGreater = true;
    if ((b[key] || 0) > (a[key] || 0)) bGreater = true;
  }
  if (!aGreater && !bGreater) return "equal";
  if (aGreater && !bGreater) return "after";
  if (bGreater && !aGreater) return "before";
  return "concurrent";
}

export function getDeviceId(storage = localStorage) {
  const key = "raiz-sync-device-id";
  const current = storage.getItem(key);
  if (current) return current;
  const value = `device-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
  storage.setItem(key, value);
  return value;
}
const legacyId = (collection, record) => `${collection}-${signature(record)}`;
const ensureRecord = (record, collection) => {
  const next = record && typeof record === "object" ? record : {};
  next.id ||= legacyId(collection, next);
  next._sync ||= {};
  next._sync.clock = normalClock(next._sync.clock);
  return next;
};
export function ensureSyncMetadata(cultivation) {
  if (!cultivation || typeof cultivation !== "object") return cultivation;
  cultivation._sync ||= {};
  cultivation._sync.rootClock = normalClock(cultivation._sync.rootClock);
  cultivation._sync.counters ||= {};
  for (const collection of SYNC_COLLECTIONS) {
    cultivation[collection] ||= [];
    if (!Array.isArray(cultivation[collection])) cultivation[collection] = [];
    cultivation[collection].forEach((record) => ensureRecord(record, collection));
  }
  return cultivation;
}
const tick = (cultivation, deviceId, existing = {}) => {
  ensureSyncMetadata(cultivation);
  const counters = cultivation._sync.counters;
  counters[deviceId] = Math.max(counters[deviceId] || 0, existing[deviceId] || 0) + 1;
  return mergeClocks(existing, { [deviceId]: counters[deviceId] });
};
const recordMap = (items) => new Map((items || []).map((item) => [item.id, item]));

/** Stamps only records changed by a normal local mutation; no wall clock is used. */
export function stampLocalMutation(cultivation, before, deviceId) {
  ensureSyncMetadata(cultivation);
  ensureSyncMetadata(before);
  for (const collection of SYNC_COLLECTIONS) {
    const previous = recordMap(before[collection]);
    cultivation[collection].forEach((record) => {
      const old = previous.get(record.id);
      if (!old || stableJson(old) !== stableJson(record))
        record._sync.clock = tick(cultivation, deviceId, mergeClocks(old?._sync?.clock, record._sync?.clock));
    });
  }
  const root = (item) => {
    const copy = syncFree(item);
    SYNC_COLLECTIONS.forEach((collection) => delete copy[collection]);
    delete copy.actualizadoEn;
    return copy;
  };
  if (stableJson(root(before)) !== stableJson(root(cultivation)))
    cultivation._sync.rootClock = tick(cultivation, deviceId, cultivation._sync.rootClock);
  return cultivation;
}

export function buildSyncFile(cultivation, exportedAt = new Date().toISOString()) {
  const prepared = clone(cultivation);
  ensureSyncMetadata(prepared);
  return {
    formato: "asistente-cultivo",
    version: 1,
    tipo: "sincronizacion",
    cultivoUid: prepared.id,
    exportadaEn: exportedAt,
    cultivo: prepared,
  };
}
export function validateSyncFile(file) {
  if (!file || file.formato !== "asistente-cultivo" || file.version !== 1 || file.tipo !== "sincronizacion")
    throw new Error("El archivo no es una sincronización compatible.");
  if (!file.cultivo || typeof file.cultivoUid !== "string" || file.cultivo.id !== file.cultivoUid)
    throw new Error("El archivo de sincronización no conserva una identidad de cultivo válida.");
  return file;
}

const rootPayload = (cultivation) => {
  const payload = syncFree(cultivation);
  SYNC_COLLECTIONS.forEach((collection) => delete payload[collection]);
  delete payload.actualizadoEn;
  delete payload.estado;
  return payload;
};
const conflictKey = (collection, id) => `${collection}:${id}`;
const addConflict = (list, collection, id, local, imported, label = null) =>
  list.push({ key: conflictKey(collection, id), collection, id, local: clone(local), imported: clone(imported), label: label || id });

export function createMergePlan(localSource, importedSource) {
  const local = clone(localSource);
  const imported = clone(importedSource);
  ensureSyncMetadata(local);
  ensureSyncMetadata(imported);
  if (local.id !== imported.id)
    throw new Error("Esta copia pertenece a otro cultivo. Importala como cultivo inicial, no la fusiones.");
  const merged = clone(local);
  const conflicts = [];
  const summary = { added: 0, updated: 0, conserved: 0, conflicts: 0 };
  for (const collection of SYNC_COLLECTIONS) {
    const left = recordMap(local[collection]);
    const right = recordMap(imported[collection]);
    const result = [];
    for (const itemId of new Set([...left.keys(), ...right.keys()])) {
      const a = left.get(itemId);
      const b = right.get(itemId);
      if (!a) { result.push(clone(b)); summary.added += 1; continue; }
      if (!b) { result.push(clone(a)); summary.conserved += 1; continue; }
      if (stableJson(a) === stableJson(b)) {
        const kept = clone(a);
        kept._sync.clock = mergeClocks(a._sync?.clock, b._sync?.clock);
        result.push(kept); summary.conserved += 1; continue;
      }
      const relation = compareClocks(a._sync?.clock, b._sync?.clock);
      if (relation === "before") { result.push(clone(b)); summary.updated += 1; continue; }
      if (relation === "after") { result.push(clone(a)); summary.conserved += 1; continue; }
      result.push(clone(a));
      addConflict(conflicts, collection, itemId, a, b, `${collection} · ${itemId}`);
    }
    merged[collection] = result;
  }
  const localRoot = rootPayload(local);
  const importedRoot = rootPayload(imported);
  if (stableJson(localRoot) !== stableJson(importedRoot)) {
    const relation = compareClocks(local._sync.rootClock, imported._sync.rootClock);
    if (relation === "before") {
      Object.assign(merged, importedRoot);
      summary.updated += 1;
    } else if (relation === "after") summary.conserved += 1;
    else addConflict(conflicts, "raiz", "configuracion", localRoot, importedRoot, "Configuración y plan");
  }
  const localState = local.estado || {};
  const importedState = imported.estado || {};
  if (stableJson(localState) !== stableJson(importedState)) {
    const localWeek = Number(localState.semanaActiva) || 0;
    const importedWeek = Number(importedState.semanaActiva) || 0;
    if (importedWeek > localWeek) { merged.estado = clone(importedState); summary.updated += 1; }
    else if (localWeek > importedWeek) summary.conserved += 1;
    else addConflict(conflicts, "raiz", "estado", localState, importedState, "Etapa confirmada");
  }
  merged._sync.rootClock = mergeClocks(local._sync.rootClock, imported._sync.rootClock);
  merged._sync.counters = mergeClocks(local._sync.counters, imported._sync.counters);
  summary.conflicts = conflicts.length;
  return { local, imported, merged, conflicts, summary };
}

export function applyMergePlan(plan, choices = {}) {
  const result = clone(plan.merged);
  for (const conflict of plan.conflicts) {
    const choice = choices[conflict.key];
    if (choice !== "local" && choice !== "imported")
      throw new Error(`Elegí una versión para “${conflict.label}”.`);
    const selected = clone(choice === "local" ? conflict.local : conflict.imported);
    if (conflict.collection === "raiz" && conflict.id === "configuracion") {
      Object.assign(result, selected);
      result._sync.rootClock = mergeClocks(
        plan.local._sync?.rootClock,
        plan.imported._sync?.rootClock,
      );
    } else if (conflict.collection === "raiz" && conflict.id === "estado") {
      result.estado = selected;
      result._sync.rootClock = mergeClocks(
        plan.local._sync?.rootClock,
        plan.imported._sync?.rootClock,
      );
    } else {
      const index = result[conflict.collection].findIndex((item) => item.id === conflict.id);
      if (index >= 0) {
        selected._sync ||= {};
        selected._sync.clock = mergeClocks(
          conflict.local._sync?.clock,
          conflict.imported._sync?.clock,
        );
        result[conflict.collection][index] = selected;
      }
    }
  }
  ensureSyncMetadata(result);
  return result;
}
