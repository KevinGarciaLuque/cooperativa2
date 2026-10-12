// Almacén de imágenes subidas (fotos de perfil y logo) dentro de la base de datos.
// El disco de Railway se borra en cada despliegue; la base de datos no.
// Las URL conservan la forma /uploads/...: las pantallas no necesitan cambios.
const fs = require("fs");
const path = require("path");
const pool = require("../db");

const MIMES = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".heic": "image/heic",
  ".heif": "image/heif",
};

const mimeDe = (ruta) => MIMES[path.extname(ruta).toLowerCase()] || "application/octet-stream";

const guardarArchivo = async (ruta, mime, buffer) => {
  await pool.query(
    `INSERT INTO archivos (ruta, mime, tamano, contenido) VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE mime = VALUES(mime), tamano = VALUES(tamano), contenido = VALUES(contenido)`,
    [ruta, mime || mimeDe(ruta), buffer.length, buffer]
  );
};

const eliminarArchivo = async (ruta) => {
  if (!ruta) return;
  await pool.query("DELETE FROM archivos WHERE ruta = ?", [ruta]);
  // También el archivo en disco, si existía de antes
  try {
    const enDisco = path.join(__dirname, "..", ruta.replace(/^\//, ""));
    if (enDisco.startsWith(path.join(__dirname, "..", "uploads")) && fs.existsSync(enDisco)) {
      fs.unlinkSync(enDisco);
    }
  } catch {
    // sin importancia
  }
};

// Middleware: sirve /uploads/... desde la base de datos; si no está, deja pasar
// al servidor de archivos estáticos (imágenes anteriores a este cambio).
const servirArchivos = async (req, res, next) => {
  if (req.method !== "GET" && req.method !== "HEAD") return next();
  try {
    const ruta = decodeURIComponent(req.originalUrl.split("?")[0]);
    const [rows] = await pool.query("SELECT mime, contenido FROM archivos WHERE ruta = ? LIMIT 1", [ruta]);
    if (!rows.length) return next();
    res.setHeader("Content-Type", rows[0].mime);
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.send(rows[0].contenido);
  } catch {
    next();
  }
};

// Copia a la base de datos las imágenes que existan en uploads/ (una sola vez por archivo).
// Sirve para no perder las fotos y logos que ya estaban en el repositorio o en disco.
const importarArchivosExistentes = async () => {
  const raiz = path.join(__dirname, "../uploads");
  let importados = 0;
  for (const sub of ["usuarios", "logos"]) {
    const dir = path.join(raiz, sub);
    if (!fs.existsSync(dir)) continue;
    for (const nombre of fs.readdirSync(dir)) {
      const archivo = path.join(dir, nombre);
      if (!fs.statSync(archivo).isFile()) continue;
      const ruta = `/uploads/${sub}/${nombre}`;
      const [[existe]] = await pool.query("SELECT COUNT(*) AS n FROM archivos WHERE ruta = ?", [ruta]);
      if (existe.n) continue;
      await guardarArchivo(ruta, mimeDe(nombre), fs.readFileSync(archivo));
      importados += 1;
    }
  }
  return importados;
};

module.exports = { guardarArchivo, eliminarArchivo, servirArchivos, importarArchivosExistentes, mimeDe };
