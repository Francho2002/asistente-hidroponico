const connectionKey = (cultivationId) => `raiz-sonoff-home-assistant:${cultivationId}`;

export const defaultSonoffConnection = () => ({
  baseUrl: "",
  token: "",
  temperatureEntityId: "",
  humidityEntityId: "",
  humidifierEntityId: "",
  intervalSeconds: 60,
});

export function sanitizeConnection(connection = {}) {
  return {
    ...defaultSonoffConnection(),
    baseUrl: String(connection.baseUrl || "").trim().replace(/\/+$/, ""),
    token: String(connection.token || "").trim(),
    temperatureEntityId: String(connection.temperatureEntityId || "").trim(),
    humidityEntityId: String(connection.humidityEntityId || "").trim(),
    humidifierEntityId: String(connection.humidifierEntityId || "").trim(),
    intervalSeconds: Math.max(15, Math.min(3600, Number(connection.intervalSeconds) || 60)),
  };
}

export function validateSonoffConnection(connection, pageProtocol = globalThis.location?.protocol) {
  const value = sanitizeConnection(connection);
  const missing = [
    [value.baseUrl, "la URL de Home Assistant"],
    [value.token, "el token de acceso"],
    [value.temperatureEntityId, "la entidad de temperatura"],
    [value.humidityEntityId, "la entidad de humedad"],
    [value.humidifierEntityId, "la entidad del humidificador"],
  ].find(([item]) => !item);
  if (missing) return { valid: false, message: `Falta ${missing[1]}.`, value };
  try {
    const url = new URL(value.baseUrl);
    if (!/^https?:$/.test(url.protocol))
      return { valid: false, message: "La URL debe usar http:// o https://.", value };
    if (pageProtocol === "https:" && url.protocol === "http:")
      return {
        valid: false,
        message:
          "GitHub Pages usa HTTPS y el navegador bloqueará una URL HTTP local. Usá HTTPS en Home Assistant o abrí la app desde un origen HTTP local.",
        value,
      };
  } catch {
    return { valid: false, message: "La URL de Home Assistant no es válida.", value };
  }
  return { valid: true, value };
}

export function loadSonoffConnection(cultivationId, storage = localStorage) {
  try {
    const stored = storage.getItem(connectionKey(cultivationId));
    return stored ? sanitizeConnection(JSON.parse(stored)) : null;
  } catch {
    return null;
  }
}

export function saveSonoffConnection(cultivationId, connection, storage = localStorage) {
  const value = sanitizeConnection(connection);
  storage.setItem(connectionKey(cultivationId), JSON.stringify(value));
  return value;
}

export function removeSonoffConnection(cultivationId, storage = localStorage) {
  storage.removeItem(connectionKey(cultivationId));
}

/** A safe status for UI and exports. It deliberately excludes the token. */
export function publicSonoffConnection(connection) {
  if (!connection) return null;
  const { token, ...safe } = sanitizeConnection(connection);
  return safe;
}
