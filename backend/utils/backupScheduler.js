const cron = require("node-cron");
const fs = require("fs");
const path = require("path");
const pool = require("../db");

const CONFIG_FILE = path.join(__dirname, "../backup_config.json");
const BACKUPS_DIR = path.join(__dirname, "../backups");

const DEFAULT_CONFIG = {
  activo: false,
  frecuencia: "diario",
  hora: "02:00",
  dia_semana: 1,
  max_backups: 10,
  ultimo_backup: null,
};

let currentTask = null;

function leerConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return { ...DEFAULT_CONFIG, ...JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8")) };
    }
  } catch (err) {
    console.error("Error al leer config de backup:", err.message);
  }
  return { ...DEFAULT_CONFIG };
}

function guardarConfig(config) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

async function generarSQL() {
  const dbName = process.env.DB_NAME;
  const [tables] = await pool.query("SHOW TABLES");
  const tableNames = tables.map((t) => Object.values(t)[0]);

  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const filename = `DBcooperativa_${pad(now.getDate())}_${pad(now.getMonth() + 1)}_${now.getFullYear()}_${pad(now.getHours())}h${pad(now.getMinutes())}.sql`;

  const lines = [];
  lines.push(`-- ============================================`);
  lines.push(`-- BACKUP BASE DE DATOS: ${dbName}`);
  lines.push(
    `-- Fecha y hora: ${now.toLocaleDateString("es-HN")} ${now.toLocaleTimeString("es-HN")}`
  );
  lines.push(`-- Generado por Demo`);
  lines.push(`-- ============================================`);
  lines.push(``);
  lines.push(`SET FOREIGN_KEY_CHECKS=0;`);
  lines.push(`SET SQL_MODE="NO_AUTO_VALUE_ON_ZERO";`);
  lines.push(``);

  for (const tableName of tableNames) {
    const [createResult] = await pool.query(
      `SHOW CREATE TABLE \`${tableName}\``
    );
    const createStatement = createResult[0]["Create Table"];

    lines.push(`-- ---- Tabla: ${tableName} ----`);
    lines.push(`DROP TABLE IF EXISTS \`${tableName}\`;`);
    lines.push(`${createStatement};`);
    lines.push(``);

    const [rows] = await pool.query(`SELECT * FROM \`${tableName}\``);
    if (rows.length > 0) {
      const columns = Object.keys(rows[0])
        .map((c) => `\`${c}\``)
        .join(", ");
      const valueGroups = rows.map((row) => {
        const vals = Object.values(row).map((val) => {
          if (val === null || val === undefined) return "NULL";
          if (val instanceof Date)
            return `'${val.toISOString().slice(0, 19).replace("T", " ")}'`;
          if (typeof val === "boolean") return val ? 1 : 0;
          if (typeof val === "number") return val;
          return `'${String(val)
            .replace(/\\/g, "\\\\")
            .replace(/'/g, "\\'")
            .replace(/\n/g, "\\n")
            .replace(/\r/g, "\\r")}'`;
        });
        return `(${vals.join(", ")})`;
      });
      lines.push(`INSERT INTO \`${tableName}\` (${columns}) VALUES`);
      lines.push(valueGroups.join(",\n") + ";");
      lines.push(``);
    }
  }

  lines.push(`SET FOREIGN_KEY_CHECKS=1;`);
  return { filename, content: lines.join("\n") };
}

async function ejecutarBackup() {
  if (!fs.existsSync(BACKUPS_DIR))
    fs.mkdirSync(BACKUPS_DIR, { recursive: true });

  try {
    const config = leerConfig();
    const { filename, content } = await generarSQL();
    fs.writeFileSync(path.join(BACKUPS_DIR, filename), content, "utf8");
    console.log(`✅ Backup generado: ${filename}`);

    // Limpiar backups más viejos si se supera el límite
    const archivos = fs
      .readdirSync(BACKUPS_DIR)
      .filter(
        (f) => f.startsWith("DBcooperativa_") && f.endsWith(".sql")
      )
      .sort();

    const maxB = config.max_backups || 10;
    while (archivos.length > maxB) {
      const oldest = archivos.shift();
      fs.unlinkSync(path.join(BACKUPS_DIR, oldest));
      console.log(`🗑️  Backup eliminado (límite alcanzado): ${oldest}`);
    }

    config.ultimo_backup = new Date().toISOString();
    guardarConfig(config);
    return filename;
  } catch (err) {
    console.error("❌ Error al generar backup:", err.message);
    return null;
  }
}

function buildCronExpr(config) {
  const parts = (config.hora || "02:00").split(":");
  const hour = parseInt(parts[0], 10);
  const minute = parseInt(parts[1], 10);
  switch (config.frecuencia) {
    case "hora":
      return `0 * * * *`;
    case "diario":
      return `${minute} ${hour} * * *`;
    case "semanal":
      return `${minute} ${hour} * * ${config.dia_semana ?? 1}`;
    default:
      return `${minute} ${hour} * * *`;
  }
}

function iniciarScheduler() {
  if (currentTask) {
    currentTask.stop();
    currentTask = null;
  }

  const config = leerConfig();

  if (!config.activo) {
    console.log("ℹ️  Backup automático: desactivado");
    return;
  }

  const expr = buildCronExpr(config);

  try {
    currentTask = cron.schedule(expr, ejecutarBackup, {
      timezone: "America/Tegucigalpa",
    });
  } catch (_tzErr) {
    // Fallback si la versión de node-cron no soporta timezone
    currentTask = cron.schedule(expr, ejecutarBackup);
  }

  console.log(
    `⏰ Backup automático activo: [${expr}] — ${config.frecuencia} a las ${config.hora}`
  );
}

module.exports = {
  iniciarScheduler,
  ejecutarBackup,
  generarSQL,
  leerConfig,
  guardarConfig,
  buildCronExpr,
  BACKUPS_DIR,
};
