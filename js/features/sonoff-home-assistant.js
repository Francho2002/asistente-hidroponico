import {
  loadSonoffConnection,
  removeSonoffConnection,
  saveSonoffConnection,
  validateSonoffConnection,
} from "../core/sonoff-connection.js";

const errorMessage = (error) => {
  if (error?.name === "TypeError")
    return "No se pudo contactar Home Assistant. Revisá la URL, HTTPS/CORS y que la instancia sea accesible desde este navegador.";
  return error?.message || "No se pudo actualizar la lectura ambiental.";
};

export function parseHomeAssistantStates(states, timestamp = new Date().toISOString()) {
  const [temperature, humidity, humidifier] = states;
  const asNumber = (state, label) => {
    const value = Number(state?.state);
    if (!Number.isFinite(value)) throw new Error(`Home Assistant devolvió una ${label} no numérica.`);
    return value;
  };
  return {
    fecha: timestamp,
    temperatura: asNumber(temperature, "temperatura"),
    humedad: asNumber(humidity, "humedad"),
    humidificadorEncendido: String(humidifier?.state || "").toLowerCase() === "on",
  };
}

export function createSonoffHomeAssistant(api) {
  let cultivationId = null;
  let timer = null;
  let pending = false;
  let started = false;
  let configuration = null;
  let status = { state: "unconfigured", lastReadAt: null, message: "Sin configurar" };
  const fetchImpl = api.fetchImpl || fetch;
  const setStatus = (next) => {
    status = { ...status, ...next };
    api.onStatusChange?.(status);
  };
  const stop = () => {
    if (timer) clearInterval(timer);
    timer = null;
    pending = false;
    started = false;
  };
  const requestState = async (baseUrl, entityId, token) => {
    const response = await fetchImpl(
      `${baseUrl}/api/states/${encodeURIComponent(entityId)}`,
      { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } },
    );
    if (!response.ok) {
      if (response.status === 401 || response.status === 403)
        throw new Error("Home Assistant rechazó el token de acceso.");
      throw new Error(`Home Assistant respondió ${response.status} al leer ${entityId}.`);
    }
    return response.json();
  };
  const schedule = () => {
    if (timer || !configuration) return;
    timer = setInterval(() => refresh({ silent: true }), configuration.intervalSeconds * 1000);
  };
  async function refresh({ silent = false } = {}) {
    if (!cultivationId || !configuration || pending) return { ok: false, message: "El conector no está configurado." };
    pending = true;
    setStatus({ state: "connecting", message: "Actualizando…" });
    try {
      const states = await Promise.all([
        requestState(configuration.baseUrl, configuration.temperatureEntityId, configuration.token),
        requestState(configuration.baseUrl, configuration.humidityEntityId, configuration.token),
        requestState(configuration.baseUrl, configuration.humidifierEntityId, configuration.token),
      ]);
      const reading = parseHomeAssistantStates(states, api.now?.() || new Date().toISOString());
      await api.recordReadings([reading], {
        modo: "automatica",
        etiqueta: "Home Assistant + SonoffLAN",
      });
      setStatus({ state: "connected", lastReadAt: reading.fecha, message: "Conectado" });
      return { ok: true, reading };
    } catch (error) {
      const message = errorMessage(error);
      setStatus({ state: "error", message });
      if (!silent) api.showToast?.(message);
      return { ok: false, message };
    } finally {
      pending = false;
    }
  }
  function start(nextCultivationId) {
    if (cultivationId === nextCultivationId && started) return;
    stop();
    cultivationId = nextCultivationId;
    started = true;
    configuration = loadSonoffConnection(cultivationId, api.storage);
    if (!configuration) {
      setStatus({ state: "unconfigured", lastReadAt: null, message: "Sin configurar" });
      return;
    }
    const check = validateSonoffConnection(configuration, api.pageProtocol);
    if (!check.valid) {
      setStatus({ state: "error", message: check.message });
      return;
    }
    configuration = check.value;
    refresh({ silent: true });
    schedule();
  }
  async function configure(next) {
    const check = validateSonoffConnection(next, api.pageProtocol);
    if (!check.valid) return { ok: false, message: check.message };
    stop();
    configuration = saveSonoffConnection(cultivationId, check.value, api.storage);
    started = true;
    setStatus({ state: "connecting", lastReadAt: null, message: "Actualizando…" });
    const result = await refresh();
    schedule();
    return result;
  }
  function forget() {
    stop();
    if (cultivationId) removeSonoffConnection(cultivationId, api.storage);
    configuration = null;
    setStatus({ state: "unconfigured", lastReadAt: null, message: "Sin configurar" });
  }
  return {
    start,
    stop,
    forget,
    refresh,
    configure,
    getStatus: () => status,
    getConfiguration: () => configuration || loadSonoffConnection(cultivationId, api.storage),
  };
}
