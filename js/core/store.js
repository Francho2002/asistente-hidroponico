export function createStore({ now, saveState, normalizeCultivation }) {
  const state = {
    version: 1,
    cultivos: [],
    cultivoSeleccionadoId: null,
    actualizadoEn: now(),
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

  const persist = async (cultivation) => {
    state.cultivos = state.cultivos.map((item) =>
      item.id === cultivation.id ? cultivation : item,
    );
    state.cultivoSeleccionadoId = cultivation.id;
    state.actualizadoEn = now();
    await saveState(state);
  };

  const update = async (mutator) => {
    const cultivation = structuredClone(selected());
    mutator(cultivation);
    cultivation.actualizadoEn = now();
    await persist(cultivation);
    return cultivation;
  };

  const add = async (cultivation) => {
    state.cultivos = [
      ...state.cultivos.filter((item) => item.id !== cultivation.id),
      cultivation,
    ];
    state.cultivoSeleccionadoId = cultivation.id;
    state.actualizadoEn = now();
    await saveState(state);
  };

  const reset = () =>
    Object.assign(state, {
      version: 1,
      cultivos: [],
      cultivoSeleccionadoId: null,
      actualizadoEn: now(),
    });

  return { state, selected, restore, persist, update, add, reset };
}
