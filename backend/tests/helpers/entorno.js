// Prepara el entorno de pruebas ANTES de cargar la aplicación.
// Las pruebas de integración usan siempre una base aparte (nombre terminado en _test):
// nunca tocan la base real.
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "secreto-solo-para-pruebas";
process.env.LOG_LEVEL = "error";
// Las pruebas nunca envían correos de verdad (vacías, para que el .env no las vuelva a llenar)
process.env.EMAIL_HOST = "";
process.env.EMAIL_USER = "";
process.env.EMAIL_PASS = "";

const base = process.env.TEST_DB_NAME || `${(process.env.DB_NAME || "cooperativa").replace(/_test$/, "")}_test`;
if (!/_test$/.test(base)) {
  throw new Error(`Por seguridad la base de pruebas debe terminar en _test (se recibió "${base}").`);
}
process.env.DB_NAME = base;

module.exports = { baseDePruebas: base };
