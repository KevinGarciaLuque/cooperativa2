const express = require("express");
const router = express.Router();
const pool = require("../db");
const { verificarToken } = require("../middleware/auth");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Multer para logo del sitio
const storageLogo = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, "../uploads/logos");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `logo_${Date.now()}${ext}`);
  },
});
const uploadLogo = multer({
  storage: storageLogo,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) => {
    const allowed = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg"];
    if (allowed.includes(path.extname(file.originalname).toLowerCase())) {
      cb(null, true);
    } else {
      cb(new Error("Solo se permiten imágenes JPG, PNG, WEBP, SVG o GIF"));
    }
  },
});

// Solo Super Administrador puede modificar
const soloSuperAdmin = (req, res, next) => {
  if (!req.usuario || req.usuario.rol !== "Super Administrador") {
    return res.status(403).json({ message: "Acceso denegado. Solo el Super Administrador puede realizar esta acción." });
  }
  next();
};

// Valores por defecto del sitio
const DEFAULTS = {
  site_name:         "Demo",
  home_badge:        "Plataforma cooperativa digital",
  home_title1:       "Tu cooperativa,",
  home_title2:       "siempre contigo.",
  home_subtitle:     "Gestiona tus aportaciones, préstamos y cuentas desde un solo lugar, de forma segura, rápida y eficiente.",
  home_cta:          "Comenzar ahora",
  home_footer:       "Demo © {year} — Ahorro y crédito, desde cualquier lugar.",
  home_features:     JSON.stringify([
    { icon: "💰", title: "Aportaciones", desc: "Registra y consulta tus aportaciones en tiempo real." },
    { icon: "🏦", title: "Préstamos",    desc: "Solicita y gestiona préstamos de forma rápida y segura." },
    { icon: "📊", title: "Reportes",     desc: "Accede a reportes financieros detallados y actualizados." },
    { icon: "🔐", title: "Seguridad",    desc: "Tu información protegida con acceso seguro las 24 horas." },
  ]),
  login_tagline1:    "Tu Cooperativa,",
  login_tagline2:    "siempre contigo.",
  login_subtitle:    "Gestiona tus aportaciones, préstamos y cuentas desde un solo lugar, de forma segura y eficiente.",
  login_features:    JSON.stringify([
    "Control total de tus finanzas",
    "Acceso seguro 24/7",
    "Reportes en tiempo real",
    "Gestión de socios y roles",
  ]),
  logo_url: "",
};

// ============================================================
// Inicializar tabla si no existe
// ============================================================
(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS configuracion_sitio (
        clave VARCHAR(100) PRIMARY KEY,
        valor  TEXT        NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
  } catch (err) {
    console.error("Error creando tabla configuracion_sitio:", err.message);
  }
})();

// ============================================================
// GET /api/configuracion  (público)
// Devuelve la configuración fusionada con defaults
// ============================================================
router.get("/", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT clave, valor FROM configuracion_sitio");
    const db = {};
    rows.forEach(({ clave, valor }) => { db[clave] = valor; });

    // Fusionar con defaults
    const resultado = { ...DEFAULTS, ...db };

    // Parsear campos JSON
    ["home_features", "login_features"].forEach((key) => {
      if (typeof resultado[key] === "string") {
        try { resultado[key] = JSON.parse(resultado[key]); } catch { /* mantener como string */ }
      }
    });

    res.json({ success: true, data: resultado });
  } catch (error) {
    res.status(500).json({ message: "Error al obtener configuración", error: error.message });
  }
});

// ============================================================
// PUT /api/configuracion  (solo Super Admin)
// Guarda/actualiza los pares clave-valor enviados
// ============================================================
router.put("/", verificarToken, soloSuperAdmin, async (req, res) => {
  const campos = req.body; // { clave: valor, ... }

  if (!campos || typeof campos !== "object" || Array.isArray(campos)) {
    return res.status(400).json({ message: "Formato inválido. Envía un objeto { clave: valor }." });
  }

  try {
    const claves = Object.keys(campos);
    if (claves.length === 0) {
      return res.status(400).json({ message: "No se enviaron campos para actualizar." });
    }

    // Validar que solo se actualicen claves conocidas
    const clavesPermitidas = Object.keys(DEFAULTS);
    const clavesInvalidas = claves.filter((c) => !clavesPermitidas.includes(c));
    if (clavesInvalidas.length > 0) {
      return res.status(400).json({ message: `Claves no permitidas: ${clavesInvalidas.join(", ")}` });
    }

    // Serializar arrays/objetos a JSON
    for (const key of claves) {
      if (typeof campos[key] === "object") {
        campos[key] = JSON.stringify(campos[key]);
      } else {
        campos[key] = String(campos[key]);
      }
    }

    // UPSERT masivo
    for (const [clave, valor] of Object.entries(campos)) {
      await pool.query(
        "INSERT INTO configuracion_sitio (clave, valor) VALUES (?, ?) ON DUPLICATE KEY UPDATE valor = VALUES(valor)",
        [clave, valor]
      );
    }

    res.json({ success: true, message: "Configuración guardada correctamente." });
  } catch (error) {
    res.status(500).json({ message: "Error al guardar configuración", error: error.message });
  }
});

// ============================================================
// POST /api/configuracion/logo  (solo Super Admin)
// Sube una imagen y guarda la URL en configuracion_sitio
// ============================================================
router.post("/logo", verificarToken, soloSuperAdmin, (req, res) => {
  uploadLogo.single("logo")(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ message: err.message || "Error al subir la imagen" });
    }
    if (!req.file) {
      return res.status(400).json({ message: "No se recibió ninguna imagen" });
    }

    const logoUrl = `/uploads/logos/${req.file.filename}`;

    try {
      // Eliminar logo anterior si existía y no es el default
      const [prev] = await pool.query(
        "SELECT valor FROM configuracion_sitio WHERE clave = 'logo_url'"
      );
      if (prev.length > 0 && prev[0].valor && !prev[0].valor.includes("smartcoop.png")) {
        const oldPath = path.join(__dirname, "..", prev[0].valor);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }

      await pool.query(
        "INSERT INTO configuracion_sitio (clave, valor) VALUES ('logo_url', ?) ON DUPLICATE KEY UPDATE valor = VALUES(valor)",
        [logoUrl]
      );

      res.json({ success: true, logo_url: logoUrl, message: "Logo actualizado correctamente" });
    } catch (error) {
      res.status(500).json({ message: "Error al guardar el logo", error: error.message });
    }
  });
});

module.exports = router;
