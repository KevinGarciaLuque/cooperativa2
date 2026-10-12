const mysql = require("mysql2/promise");
const dotenv = require("dotenv");
dotenv.config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Opcional: fija la zona horaria de cada sesión (por ejemplo "-06:00"). Así NOW() guarda
// la hora de la cooperativa aunque el servidor de base de datos esté en UTC.
// Aplíquelo solo en una base nueva o tras revisar los datos existentes.
if (process.env.DB_TIMEZONE) {
  pool.on("connection", (conn) => {
    conn.query(`SET time_zone = '${String(process.env.DB_TIMEZONE).replace(/[^+\-:0-9A-Za-z_/]/g, "")}'`);
  });
}

// Probar la conexión al iniciar (no en pruebas automáticas)
if (process.env.NODE_ENV !== "test") {
  pool
    .getConnection()
    .then((conn) => {
      console.log("✅ Conexión a la base de datos exitosa");
      conn.release();
    })
    .catch((err) => {
      console.error("❌ Error al conectar con la base de datos:", err.message);
    });
}

module.exports = pool;
