const cron = require("node-cron");
const fs = require("fs");
const path = require("path");
const pool = require("../db");
const { locale } = require("./pais");
const { zona } = require("./fechas");

const respaldoExterno = require("./respaldoExterno");

// Archivo donde antes se guardaba la configuración (se borraba en cada despliegue de Railway).
// Ahora vive en la base de datos (configuracion_sitio, clave "respaldo_config").
const CONFIG_FILE_ANTERIOR = path.join(__dirname, "../backup_config.json");
const CLAVE_CONFIG = "respaldo_config";
// En Railway, apunta BACKUPS_DIR a un volumen persistente (ej. /data/backups)
const BACKUPS_DIR = process.env.BACKUPS_DIR || path.join(__dirname, "../backups");

// Activados por defecto: un respaldo diario a las 2:00 a. m. (hora de la cooperativa)
const DEFAULT_CONFIG = {
  activo: true,
  frecuencia: "diario",
  hora: "02:00",
  dia_semana: 1,
  max_backups: 10,
  ultimo_backup: null,
  // Copia fuera del servidor (utils/respaldoExterno.js)
  ultimo_externo: null, // fecha de la última copia externa que salió bien
  archivo_externo: null,
  error_externo: null, // mensaje del último intento fallido (null si el último salió bien)
};

let cache = null;
let currentTask = null;

// Lee la configuración guardada en la base de datos. La primera vez toma la frecuencia y la
// hora del archivo anterior, si existe, pero deja los respaldos activados.
async function cargarConfig() {
  try {
    const [[fila]] = await pool.query("SELECT valor FROM configuracion_sitio WHERE clave = ?", [CLAVE_CONFIG]);
    if (fila) {
      cache = { ...DEFAULT_CONFIG, ...JSON.parse(fila.valor) };
      return cache;
    }
    let anterior = {};
    try {
      if (fs.existsSync(CONFIG_FILE_ANTERIOR)) anterior = JSON.parse(fs.readFileSync(CONFIG_FILE_ANTERIOR, "utf8"));
    } catch {
      anterior = {};
    }
    const { frecuencia, hora, dia_semana, max_backups, ultimo_backup } = anterior;
    cache = { ...DEFAULT_CONFIG, ...JSON.parse(JSON.stringify({ frecuencia, hora, dia_semana, max_backups, ultimo_backup })) };
    await guardarConfig(cache);
  } catch (err) {
    console.error("Error al leer la configuración de respaldos:", err.message);
    cache = cache || { ...DEFAULT_CONFIG };
  }
  return cache;
}

// La configuración ya cargada, o la carga de la base de datos
async function obtenerConfig() {
  return cache ? leerConfig() : { ...(await cargarConfig()) };
}

function leerConfig() {
  return { ...(cache || DEFAULT_CONFIG) };
}

async function guardarConfig(config) {
  cache = { ...DEFAULT_CONFIG, ...config };
  await pool.query(
    "INSERT INTO configuracion_sitio (clave, valor) VALUES (?, ?) ON DUPLICATE KEY UPDATE valor = VALUES(valor)",
    [CLAVE_CONFIG, JSON.stringify(cache)]
  );
  return cache;
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
    `-- Fecha y hora: ${now.toLocaleDateString(locale())} ${now.toLocaleTimeString(locale())}`
  );
  lines.push(`-- Generado por SmartCoop`);
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
          if (Buffer.isBuffer(val)) return val.length ? `0x${val.toString("hex")}` : "''";
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

// Genera el respaldo, lo guarda en el servidor y, si está configurado, sube una copia
// comprimida al almacenamiento externo. Devuelve el nombre del archivo, o null si no se pudo
// guardar en ningún lado.
async function ejecutarBackup() {
  let generado;
  try {
    generado = await generarSQL();
  } catch (err) {
    console.error("❌ Error al generar backup:", err.message);
    return null;
  }
  const { filename, content } = generado;
  const config = leerConfig();
  let guardado = false;

  try {
    if (!fs.existsSync(BACKUPS_DIR)) fs.mkdirSync(BACKUPS_DIR, { recursive: true });
    fs.writeFileSync(path.join(BACKUPS_DIR, filename), content, "utf8");
    guardado = true;
    console.log(`✅ Backup generado: ${filename}`);

    // Limpiar backups más viejos si se supera el límite
    const archivos = fs
      .readdirSync(BACKUPS_DIR)
      .filter((f) => f.startsWith("DBcooperativa_") && f.endsWith(".sql"))
      .sort();
    const maxB = config.max_backups || 10;
    while (archivos.length > maxB) {
      const oldest = archivos.shift();
      fs.unlinkSync(path.join(BACKUPS_DIR, oldest));
      console.log(`🗑️  Backup eliminado (límite alcanzado): ${oldest}`);
    }
  } catch (err) {
    console.error("❌ No se pudo guardar el backup en el servidor:", err.message);
  }

  if (respaldoExterno.configurado()) {
    try {
      const subido = await respaldoExterno.subirRespaldo(filename, content);
      config.ultimo_externo = new Date().toISOString();
      config.archivo_externo = subido.nombre;
      config.error_externo = null;
      guardado = true;
      console.log(`☁️  Copia externa del backup: ${subido.nombre} (${subido.bytes} bytes)`);
    } catch (err) {
      config.error_externo = `${new Date().toISOString()} — ${err.message}`;
      console.error("❌ No se pudo subir la copia externa del backup:", err.message);
    }
  }

  if (guardado) config.ultimo_backup = new Date().toISOString();
  try {
    await guardarConfig(config);
  } catch (err) {
    console.error("No se pudo registrar el respaldo:", err.message);
  }
  return guardado ? filename : null;
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

async function iniciarScheduler() {
  if (!cache) await cargarConfig();
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
      timezone: zona(),
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
  cargarConfig,
  obtenerConfig,
  buildCronExpr,
  BACKUPS_DIR,
};
