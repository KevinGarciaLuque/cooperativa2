// Fotos del frente y reverso de la identidad (DNI) del socio. Son datos sensibles:
// se guardan en su propia tabla y solo se entregan con sesión (el socio dueño o el personal),
// nunca por /uploads.
const multer = require("multer");
const pool = require("../db");

const LADOS = ["frente", "reverso"];
const MIMES = ["image/jpeg", "image/png", "image/webp"];
const MAX_MB = 6;

const subidaIdentidad = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_MB * 1024 * 1024, files: 2 },
  fileFilter: (req, file, cb) => {
    if (MIMES.includes(file.mimetype)) return cb(null, true);
    cb(new Error("FORMATO"));
  },
});

// Mensaje claro para los errores de multer
const mensajeErrorSubida = (err) =>
  err.message === "FORMATO"
    ? "Formato no permitido. Sube una foto (JPG, PNG o WEBP) de tu identidad."
    : err.code === "LIMIT_FILE_SIZE"
    ? `La foto es muy grande (máximo ${MAX_MB} MB).`
    : "No se pudo recibir la foto.";

// Guarda (o reemplaza) un lado. `conn` puede ser el pool o una conexión en transacción.
const guardarLado = async (conn, idUsuario, lado, archivo, subidoPor) => {
  await conn.query(
    `INSERT INTO documentos_identidad (id_usuario, lado, mime, tamano, contenido, subido_por)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE mime = VALUES(mime), tamano = VALUES(tamano), contenido = VALUES(contenido),
       subido_por = VALUES(subido_por), subido_en = CURRENT_TIMESTAMP`,
    [idUsuario, lado, archivo.mimetype, archivo.size, archivo.buffer, subidoPor]
  );
};

// { frente: { subido_en } | null, reverso: ... }
const estadoIdentidad = async (idUsuario) => {
  const [rows] = await pool.query(
    "SELECT lado, subido_en FROM documentos_identidad WHERE id_usuario = ?",
    [idUsuario]
  );
  const estado = { frente: null, reverso: null };
  rows.forEach((r) => {
    estado[r.lado] = { subido_en: r.subido_en };
  });
  return estado;
};

const leerLado = async (idUsuario, lado) => {
  const [rows] = await pool.query(
    "SELECT mime, contenido FROM documentos_identidad WHERE id_usuario = ? AND lado = ?",
    [idUsuario, lado]
  );
  return rows[0] || null;
};

module.exports = { LADOS, subidaIdentidad, mensajeErrorSubida, guardarLado, estadoIdentidad, leerLado };
