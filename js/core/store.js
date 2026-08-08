export function createStore({ now, saveState, normalizeCultivation, deviceId, stampLocalMutation }) {
  const state = {
    version: 1,
    cultivos: [],
    cultivoSeleccionadoId: null,
    actualizadoEn: now(),
    mutationRevision: 0,
    syncUndo: null,
  };

  const selected = () =>
    state.cultivos.find(
      (cultivation) => cultivation.id === state.cultivoSeleccionadoId,
    ) || state.cultivos[0];

  const restore = (saved) => {
    if (!saved || !Array.isArray(saved.cultivos)) return state;
    saved.cultivos.forEach(normalizeCultivation);
    Object.assign(state, saved);
    return state;
  };

  const persist = async (cultivation, { fromSync = false } = {}) => {
    state.cultivos = state.cultivos.map((item) =>
      item.id === cultivation.id ? cultivation : item,
    );
    state.cultivoSeleccionadoId = cultivation.id;
    state.actualizadoEn = now();
    state.mutationRevision = (state.mutationRevision || 0) + 1;
    if (!fromSync) state.syncUndo = null;
    await saveState(state);
  };

  const update = async (mutator) => {
    const before = structuredClone(selected());
    const cultivation = structuredClone(before);
    mutator(cultivation);
    if (stampLocalMutation && deviceId)
      stampLocalMutation(cultivation, before, deviceId);
    cultivation.actualizadoEn = now();
    await persist(cultivation);
    return cultivation;
  };

  const add = async (cultivation, { preserveSyncMetadata = false } = {}) => {
    if (stampLocalMutation && deviceId && !preserveSyncMetadata) {
      const before = structuredClone(cultivation);
      before.id = "";
      before._sync = {};
      [
        "eventos", "tareas", "alertas", "asignaciones", "inventario", "dwcs",
        "plantas", "equipos", "fuentesVariables", "reglasAlertas", "reglasTareas",
        "lecturasAmbientales",
      ].forEach((collection) => { before[collection] = []; });
      stampLocalMutation(cultivation, before, deviceId);
    }
    state.cultivos = [
      ...state.cultivos.filter((item) => item.id !== cultivation.id),
      cultivation,
    ];
    state.cultivoSeleccionadoId = cultivation.id;
    state.actualizadoEn = now();
    state.mutationRevision = (state.mutationRevision || 0) + 1;
    state.syncUndo = null;
    await saveState(state);
  };

  const applySync = async (cultivation) => {
    const previous = structuredClone(selected());
    await persist(cultivation, { fromSync: true });
    state.syncUndo = {
      cultivationId: cultivation.id,
      cultivation: previous,
      revision: state.mutationRevision,
    };
    await saveState(state);
  };
  const canUndoSync = () =>
    Boolean(
      state.syncUndo &&
        state.syncUndo.cultivationId === selected()?.id &&
        state.syncUndo.revision === state.mutationRevision,
    );
  const undoSync = async () => {
    if (!canUndoSync()) return false;
    const checkpoint = structuredClone(state.syncUndo.cultivation);
    state.cultivos = state.cultivos.map((item) =>
      item.id === checkpoint.id ? checkpoint : item,
    );
    state.mutationRevision += 1;
    state.syncUndo = null;
    state.actualizadoEn = now();
    await saveState(state);
    return true;
  };

  const reset = () =>
    Object.assign(state, {
      version: 1,
      cultivos: [],
      cultivoSeleccionadoId: null,
      actualizadoEn: now(),
      mutationRevision: 0,
      syncUndo: null,
    });

  return { state, selected, restore, persist, update, add, applySync, canUndoSync, undoSync, reset };
}
