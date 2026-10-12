// Prepara el entorno de pruebas ANTES de cargar la aplicación.
// Las pruebas de integración usan siempre una base aparte (nombre terminado en _test):
// nunca tocan la base real.
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "secreto-solo-para-pruebas";
process.env.LOG_LEVEL = "error";

const base = process.env.TEST_DB_NAME || `${(process.env.DB_NAME || "cooperativa").replace(/_test$/, "")}_test`;
if (!/_test$/.test(base)) {
  throw new Error(`Por seguridad la base de pruebas debe terminar en _test (se recibió "${base}").`);
}
process.env.DB_NAME = base;

module.exports = { baseDePruebas: base };
