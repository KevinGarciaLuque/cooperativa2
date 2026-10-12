// Genera sql/esquema_base.sql a partir de la base de datos configurada en .env.
// Uso: npm run db:exportar
// El archivo permite crear una base nueva (pruebas, ambiente de ensayo) sin datos.
const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const mysql = require("mysql2/promise");

const ROLES = [
  [1, "Administrador", "Acceso total al sistema"],
  [2, "Socio", "Usuario regular de la cooperativa"],
  [3, "Contador", "Gestión financiera y reportes"],
  [5, "Super Administrador", "Control total y configuración"],
];

(async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  const [tablas] = await conn.query("SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'");
  const nombres = tablas.map((t) => Object.values(t)[0]).sort();
  nombres.splice(nombres.indexOf("schema_migraciones") >>> 0, 1); // lo crea el sistema de migraciones

  const lineas = [
    "-- Esquema base de la cooperativa (sin datos). Generado con `npm run db:exportar`.",
    "-- Las migraciones de utils/migraciones.js se aplican encima de este esquema.",
    "SET FOREIGN_KEY_CHECKS = 0;",
    "SET NAMES utf8mb4;",
    "",
  ];

  for (const nombre of nombres) {
    const [[fila]] = await conn.query(`SHOW CREATE TABLE \`${nombre}\``);
    const ddl = fila["Create Table"]
      .replace(/ AUTO_INCREMENT=\d+/g, "")
      .replace(/^CREATE TABLE/, "CREATE TABLE IF NOT EXISTS");
    lineas.push(`${ddl};`, "");
  }

  lineas.push("-- Roles base");
  ROLES.forEach(([id, nombre, desc]) => {
    lineas.push(
      `INSERT INTO roles (id_rol, nombre, descripcion) VALUES (${id}, '${nombre}', '${desc}') ON DUPLICATE KEY UPDATE nombre = VALUES(nombre);`
    );
  });
  lineas.push("", "SET FOREIGN_KEY_CHECKS = 1;", "");

  const destino = path.join(__dirname, "../sql/esquema_base.sql");
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  fs.writeFileSync(destino, lineas.join("\n"), "utf8");
  console.log(`Esquema exportado: ${nombres.length} tablas → ${path.relative(process.cwd(), destino)}`);
  await conn.end();
})().catch((e) => {
  console.error("No se pudo exportar el esquema:", e.message);
  process.exit(1);
});
