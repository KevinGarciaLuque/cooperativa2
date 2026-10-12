// Crea una base de datos nueva con el esquema base y aplica las migraciones.
// Uso:  node scripts/crear_bd.js <nombre> [--reiniciar]
// Sirve para ambientes de ensayo y para las pruebas automáticas.
const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");

const ESQUEMA = path.join(__dirname, "../sql/esquema_base.sql");

const conectar = (database) =>
  mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database,
    multipleStatements: true,
  });

const nombreSeguro = (n) => /^[A-Za-z0-9_]{1,60}$/.test(n);

async function crearBaseDeDatos(nombre, { reiniciar = false } = {}) {
  if (!nombreSeguro(nombre)) throw new Error("Nombre de base de datos inválido");
  if (!fs.existsSync(ESQUEMA)) {
    throw new Error("Falta sql/esquema_base.sql. Genera con `npm run db:exportar`.");
  }
  const admin = await conectar(undefined);
  try {
    if (reiniciar) await admin.query(`DROP DATABASE IF EXISTS \`${nombre}\``);
    await admin.query(`CREATE DATABASE IF NOT EXISTS \`${nombre}\` CHARACTER SET utf8mb4`);
  } finally {
    await admin.end();
  }
  const conn = await conectar(nombre);
  try {
    await conn.query(fs.readFileSync(ESQUEMA, "utf8"));
  } finally {
    await conn.end();
  }
}

module.exports = { crearBaseDeDatos };

if (require.main === module) {
  require("dotenv").config({ path: path.join(__dirname, "../.env") });
  const nombre = process.argv[2];
  if (!nombre) {
    console.error("Indica el nombre de la base: node scripts/crear_bd.js <nombre> [--reiniciar]");
    process.exit(1);
  }
  const reiniciar = process.argv.includes("--reiniciar");
  crearBaseDeDatos(nombre, { reiniciar })
    .then(async () => {
      // Aplicar migraciones sobre la base recién creada
      process.env.DB_NAME = nombre;
      const { aplicarMigraciones } = require("../utils/migraciones");
      await aplicarMigraciones();
      console.log(`Base "${nombre}" lista.`);
      process.exit(0);
    })
    .catch((e) => {
      console.error("No se pudo crear la base:", e.message);
      process.exit(1);
    });
}
