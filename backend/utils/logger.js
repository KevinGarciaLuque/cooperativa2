// Registro estructurado: una línea JSON por evento, fácil de buscar en los logs de Railway.
const NIVELES = { debug: 10, info: 20, warn: 30, error: 40 };
const NIVEL_MIN = NIVELES[process.env.LOG_LEVEL] || NIVELES.info;
const SILENCIO = process.env.NODE_ENV === "test";

const escribir = (nivel, mensaje, datos = {}) => {
  if (SILENCIO || NIVELES[nivel] < NIVEL_MIN) return;
  const linea = JSON.stringify({
    t: new Date().toISOString(),
    nivel,
    mensaje,
    ...datos,
  });
  (nivel === "error" ? console.error : console.log)(linea);
};

const detalleError = (e) =>
  e instanceof Error ? { error: e.message, pila: e.stack?.split("\n").slice(0, 4).join(" | ") } : { error: String(e) };

module.exports = {
  debug: (m, d) => escribir("debug", m, d),
  info: (m, d) => escribir("info", m, d),
  warn: (m, d) => escribir("warn", m, d),
  error: (m, e, d) => escribir("error", m, { ...(e ? detalleError(e) : {}), ...d }),
};
