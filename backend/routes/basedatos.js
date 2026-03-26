const express = require("express");
const router = express.Router();
const pool = require("../db");
const multer = require("multer");
const os = require("os");
const fs = require("fs");
const path = require("path");
const { verificarToken, soloAdmin } = require("../middleware/auth");
const {
  ejecutarBackup,
  generarSQL,
  leerConfig,
  guardarConfig,
  iniciarScheduler,
  BACKUPS_DIR,
} = require("../utils/backupScheduler");

// Multer: guarda en carpeta temporal del SO, solo acepta .sql
const upload = multer({
  dest: os.tmpdir(),
  fileFilter: (_req, file, cb) => {
    if (
      file.originalname.toLowerCase().endsWith(".sql") ||
      file.mimetype === "application/sql" ||
      file.mimetype === "text/plain"
    ) {
      cb(null, true);
    } else {
      cb(new Error("Solo se permiten archivos .sql"));
    }
  },
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB máximo
});

// ============================================
// GET /api/basedatos/info
// Devuelve la lista de tablas con conteo de registros y tamaño total de la BD
// ============================================
router.get("/info", verificarToken, soloAdmin, async (req, res) => {
  try {
    const dbName = process.env.DB_NAME;
    const [tables] = await pool.query("SHOW TABLES");
    const tableNames = tables.map((t) => Object.values(t)[0]);

    const tableInfo = [];
    for (const tableName of tableNames) {
      const [rows] = await pool.query(
        `SELECT COUNT(*) AS count FROM \`${tableName}\``
      );
      tableInfo.push({ tabla: tableName, registros: rows[0].count });
    }

    const [sizeResult] = await pool.query(
      `SELECT ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS size_mb
       FROM information_schema.tables
       WHERE table_schema = ?`,
      [dbName]
    );

    res.json({
      success: true,
      base_datos: dbName,
      tablas: tableInfo,
      tamano_mb: sizeResult[0].size_mb || 0,
    });
  } catch (error) {
    console.error("ERROR INFO BD:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// GET /api/basedatos/backup
// Descarga directa al browser (no guarda en servidor)
// ============================================
router.get("/backup", verificarToken, soloAdmin, async (req, res) => {
  try {
    const { filename, content } = await generarSQL();
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(content);
  } catch (error) {
    console.error("ERROR BACKUP BD:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// GET /api/basedatos/config-backup
// ============================================
router.get("/config-backup", verificarToken, soloAdmin, (req, res) => {
  res.json({ success: true, config: leerConfig() });
});

// ============================================
// POST /api/basedatos/config-backup
// Guarda configuración y reinicia el cron
// ============================================
router.post("/config-backup", verificarToken, soloAdmin, (req, res) => {
  try {
    const { activo, frecuencia, hora, dia_semana, max_backups } = req.body;

    const FRECUENCIAS_VALIDAS = ["hora", "diario", "semanal"];
    if (frecuencia && !FRECUENCIAS_VALIDAS.includes(frecuencia)) {
      return res.status(400).json({ success: false, message: "Frecuencia inválida" });
    }
    if (hora && !/^\d{2}:\d{2}$/.test(hora)) {
      return res.status(400).json({ success: false, message: "Formato de hora inválido (HH:MM)" });
    }
    if (dia_semana !== undefined && (dia_semana < 0 || dia_semana > 6)) {
      return res.status(400).json({ success: false, message: "Día de semana inválido (0-6)" });
    }
    if (max_backups !== undefined && (max_backups < 1 || max_backups > 100)) {
      return res.status(400).json({ success: false, message: "max_backups debe ser entre 1 y 100" });
    }

    const current = leerConfig();
    const updated = {
      ...current,
      ...(activo !== undefined && { activo: Boolean(activo) }),
      ...(frecuencia !== undefined && { frecuencia }),
      ...(hora !== undefined && { hora }),
      ...(dia_semana !== undefined && { dia_semana: Number(dia_semana) }),
      ...(max_backups !== undefined && { max_backups: Number(max_backups) }),
    };

    guardarConfig(updated);
    iniciarScheduler();

    res.json({ success: true, message: "Configuración guardada", config: updated });
  } catch (error) {
    console.error("ERROR CONFIG BACKUP:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// POST /api/basedatos/ejecutar-backup
// Ejecuta un backup inmediato guardado en el servidor
// ============================================
router.post("/ejecutar-backup", verificarToken, soloAdmin, async (req, res) => {
  try {
    const filename = await ejecutarBackup();
    if (!filename) throw new Error("No se pudo generar el backup");
    res.json({ success: true, message: `Backup guardado en el servidor: ${filename}`, filename });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// GET /api/basedatos/backups-guardados
// ============================================
router.get("/backups-guardados", verificarToken, soloAdmin, (req, res) => {
  try {
    if (!fs.existsSync(BACKUPS_DIR)) {
      return res.json({ success: true, backups: [] });
    }
    const archivos = fs
      .readdirSync(BACKUPS_DIR)
      .filter((f) => f.startsWith("DBcooperativa_") && f.endsWith(".sql"))
      .sort()
      .reverse()
      .map((nombre) => {
        const stat = fs.statSync(path.join(BACKUPS_DIR, nombre));
        const match = nombre.match(/DBcooperativa_(\d{2})_(\d{2})_(\d{4})_(\d{2})h(\d{2})/);
        const fechaFormateada = match
          ? `${match[1]}/${match[2]}/${match[3]} ${match[4]}:${match[5]}h`
          : "—";
        return { nombre, fecha: fechaFormateada, tamano_kb: Math.ceil(stat.size / 1024) };
      });
    res.json({ success: true, backups: archivos });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// GET /api/basedatos/backups-guardados/:filename
// Descarga un backup guardado
// ============================================
router.get("/backups-guardados/:filename", verificarToken, soloAdmin, (req, res) => {
  const safeName = path.basename(req.params.filename);
  if (!/^DBcooperativa_\d{2}_\d{2}_\d{4}_\d{2}h\d{2}\.sql$/.test(safeName)) {
    return res.status(400).json({ success: false, message: "Nombre de archivo inválido" });
  }
  const filePath = path.join(BACKUPS_DIR, safeName);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, message: "Archivo no encontrado" });
  }
  res.download(filePath, safeName);
});

// ============================================
// DELETE /api/basedatos/backups-guardados/:filename
// ============================================
router.delete("/backups-guardados/:filename", verificarToken, soloAdmin, (req, res) => {
  const safeName = path.basename(req.params.filename);
  if (!/^DBcooperativa_\d{2}_\d{2}_\d{4}_\d{2}h\d{2}\.sql$/.test(safeName)) {
    return res.status(400).json({ success: false, message: "Nombre de archivo inválido" });
  }
  const filePath = path.join(BACKUPS_DIR, safeName);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, message: "Archivo no encontrado" });
  }
  fs.unlinkSync(filePath);
  res.json({ success: true, message: "Backup eliminado" });
});

// ============================================
// POST /api/basedatos/importar
// Recibe un archivo .sql y ejecuta todas las sentencias
// ============================================
router.post(
  "/importar",
  verificarToken,
  soloAdmin,
  upload.single("archivo"),
  async (req, res) => {
    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, message: "No se proporcionó archivo SQL" });
    }

    const tmpPath = req.file.path;

    try {
      const sqlContent = fs.readFileSync(tmpPath, "utf8");
      fs.unlinkSync(tmpPath); // eliminar el temporal inmediatamente

      // Separar en sentencias individuales (ignora comentarios y líneas vacías)
      const statements = sqlContent
        .split(/;\s*\n/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && !s.startsWith("--"));

      const connection = await pool.getConnection();
      let ejecutadas = 0;
      const errores = [];

      try {
        await connection.query("SET FOREIGN_KEY_CHECKS=0");

        for (const stmt of statements) {
          if (!stmt || stmt.startsWith("--")) continue;
          try {
            await connection.query(stmt);
            ejecutadas++;
          } catch (err) {
            errores.push({
              sentencia: stmt.substring(0, 120) + "...",
              error: err.message,
            });
          }
        }

        await connection.query("SET FOREIGN_KEY_CHECKS=1");
      } finally {
        connection.release();
      }

      res.json({
        success: true,
        message: `Importación completada: ${ejecutadas} sentencias ejecutadas`,
        ejecutadas,
        errores,
      });
    } catch (error) {
      // Limpiar temporal si aún existe
      if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
      console.error("ERROR IMPORTAR BD:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  }
);

module.exports = router;
