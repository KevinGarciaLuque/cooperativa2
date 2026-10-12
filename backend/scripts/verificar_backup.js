// Prueba de restauración: carga un respaldo .sql en una base temporal y compara
// la cantidad de registros de cada tabla con la base en uso. No modifica datos reales.
// Uso:  node scripts/verificar_backup.js [ruta/al/respaldo.sql]
// Sin argumento usa el respaldo guardado más reciente de backend/backups.
const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");

const credenciales = (database) => ({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database,
  multipleStatements: true,
});

async function verificarRespaldo(archivo) {
  if (!archivo || !fs.existsSync(archivo)) throw new Error("No se encontró el archivo de respaldo.");
  const sql = fs.readFileSync(archivo, "utf8");
  const temporal = `verif_${process.env.DB_NAME}_${Date.now()}`.replace(/[^A-Za-z0-9_]/g, "_").substring(0, 60);

  const admin = await mysql.createConnection(credenciales(undefined));
  const resultado = { archivo: path.basename(archivo), tablas: [], diferencias: [], ok: false };
  try {
    await admin.query(`CREATE DATABASE \`${temporal}\` CHARACTER SET utf8mb4`);
    const restaurada = await mysql.createConnection(credenciales(temporal));
    const real = await mysql.createConnection(credenciales(process.env.DB_NAME));
    try {
      await restaurada.query(sql);
      const [tablas] = await real.query("SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'");
      for (const t of tablas) {
        const nombre = Object.values(t)[0];
        const [[a]] = await real.query(`SELECT COUNT(*) AS n FROM \`${nombre}\``);
        let b = { n: null };
        try {
          [[b]] = await restaurada.query(`SELECT COUNT(*) AS n FROM \`${nombre}\``);
        } catch {
          b = { n: null };
        }
        const fila = { tabla: nombre, actual: a.n, respaldo: b.n };
        resultado.tablas.push(fila);
        if (b.n === null) resultado.diferencias.push({ ...fila, motivo: "no existe en el respaldo" });
        else if (b.n > a.n) resultado.diferencias.push({ ...fila, motivo: "el respaldo tiene más registros" });
      }
      // Un respaldo antiguo tiene menos registros que la base actual: es normal.
      // Es un problema cuando falta una tabla o el respaldo no se pudo cargar.
      resultado.ok = resultado.diferencias.filter((d) => d.motivo === "no existe en el respaldo").length === 0;
    } finally {
      await restaurada.end();
      await real.end();
    }
  } finally {
    await admin.query(`DROP DATABASE IF EXISTS \`${temporal}\``).catch(() => {});
    await admin.end();
  }
  return resultado;
}

module.exports = { verificarRespaldo };

if (require.main === module) {
  require("dotenv").config({ path: path.join(__dirname, "../.env") });
  const dir = process.env.BACKUPS_DIR || path.join(__dirname, "../backups");
  let archivo = process.argv[2];
  if (!archivo && fs.existsSync(dir)) {
    const lista = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".sql"))
      .map((f) => ({ f, t: fs.statSync(path.join(dir, f)).mtimeMs }))
      .sort((x, y) => y.t - x.t);
    if (lista.length) archivo = path.join(dir, lista[0].f);
  }
  verificarRespaldo(archivo)
    .then((r) => {
      console.log(`Respaldo: ${r.archivo}`);
      r.tablas.forEach((t) => console.log(`  ${t.tabla.padEnd(26)} actual=${t.actual}  respaldo=${t.respaldo}`));
      r.diferencias.forEach((d) => console.log(`  ! ${d.tabla}: ${d.motivo}`));
      console.log(r.ok ? "✔ El respaldo se restauró correctamente." : "✘ El respaldo tiene problemas.");
      process.exit(r.ok ? 0 : 2);
    })
    .catch((e) => {
      console.error("No se pudo verificar el respaldo:", e.message);
      process.exit(1);
    });
}
