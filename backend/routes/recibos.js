const express = require("express");
const router = express.Router();
const pool = require("../db");
const multer = require("multer");
const { numeroRecibo, emitirFiniquito } = require("../utils/recibos");

const formatear = (r, cooperativa) => {
  let detalle = null;
  try {
    detalle = r.detalle ? JSON.parse(r.detalle) : null;
  } catch {
    detalle = null;
  }
  return {
    id_recibo: r.id_recibo,
    numero: numeroRecibo(r.id_recibo, r.tipo),
    tipo: r.tipo,
    referencia_tipo: r.referencia_tipo,
    referencia_id: r.referencia_id,
    monto: parseFloat(r.monto),
    metodo: r.metodo,
    concepto: r.concepto,
    detalle,
    fecha: r.fecha,
    anulado: !!r.anulado,
    socio: r.socio_nombre ? { nombre: r.socio_nombre, dni: r.socio_dni, telefono: r.socio_telefono || null } : null,
    emitido_por: r.emisor_nombre || null,
    comprobante_firmado: r.firmado_en ? { subido_en: r.firmado_en } : null,
    cooperativa,
  };
};

const nombreCooperativa = async () => {
  try {
    const [rows] = await pool.query("SELECT valor FROM configuracion_sitio WHERE clave = 'site_name'");
    return rows.length ? rows[0].valor : "Cooperativa";
  } catch {
    return "Cooperativa";
  }
};

const SELECT_RECIBO = `
  SELECT r.*, s.nombre_completo AS socio_nombre, s.dni AS socio_dni, s.telefono AS socio_telefono, e.nombre_completo AS emisor_nombre,
         (SELECT MAX(c.subido_en) FROM comprobantes_firmados c WHERE c.id_recibo = r.id_recibo) AS firmado_en
  FROM recibos r
  LEFT JOIN usuarios s ON r.id_socio = s.id_usuario
  LEFT JOIN usuarios e ON r.emitido_por = e.id_usuario`;

// GET /api/recibos/finiquito/:id_prestamo  → constancia de cancelación (se genera si falta)
router.get("/finiquito/:id_prestamo", async (req, res) => {
  try {
    const idPrestamo = parseInt(req.params.id_prestamo);
    const [pr] = await pool.query("SELECT estado FROM prestamos WHERE id_prestamo = ?", [idPrestamo]);
    if (!pr.length) return res.status(404).json({ message: "Préstamo no encontrado" });
    if (pr[0].estado !== "pagado") {
      return res.status(400).json({ message: "La constancia solo se emite cuando el préstamo está totalmente pagado." });
    }
    const id = await emitirFiniquito(pool, idPrestamo, req.usuario?.id_usuario || null);
    if (!id) return res.status(500).json({ message: "No se pudo emitir la constancia" });
    const [rows] = await pool.query(`${SELECT_RECIBO} WHERE r.id_recibo = ?`, [id]);
    res.json({ success: true, data: formatear(rows[0], await nombreCooperativa()) });
  } catch (error) {
    console.error("ERROR AL OBTENER FINIQUITO:", error);
    res.status(500).json({ message: "Error al obtener la constancia" });
  }
});

// GET /api/recibos/buscar?referencia_tipo=pago&referencia_id=12
router.get("/buscar", async (req, res) => {
  try {
    const { referencia_tipo, referencia_id } = req.query;
    if (!referencia_tipo || !referencia_id) {
      return res.status(400).json({ message: "Indica referencia_tipo y referencia_id." });
    }
    const [rows] = await pool.query(
      `${SELECT_RECIBO} WHERE r.referencia_tipo = ? AND r.referencia_id = ? ORDER BY r.id_recibo DESC LIMIT 1`,
      [referencia_tipo, referencia_id]
    );
    if (!rows.length) return res.status(404).json({ message: "No hay recibo para esta operación." });
    res.json({ success: true, data: formatear(rows[0], await nombreCooperativa()) });
  } catch (error) {
    console.error("ERROR AL BUSCAR RECIBO:", error);
    res.status(500).json({ message: "Error al buscar el recibo" });
  }
});

// GET /api/recibos/socio/:id_usuario
router.get("/socio/:id_usuario", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `${SELECT_RECIBO} WHERE r.id_socio = ? ORDER BY r.fecha DESC LIMIT 100`,
      [req.params.id_usuario]
    );
    const coop = await nombreCooperativa();
    res.json({ success: true, data: rows.map((r) => formatear(r, coop)) });
  } catch (error) {
    console.error("ERROR AL LISTAR RECIBOS:", error);
    res.status(500).json({ message: "Error al listar los recibos" });
  }
});

// Comprobante firmado: foto o archivo que devuelve el socio (o que sube el personal)
const MIMES_PERMITIDOS = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const subida = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 6 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (MIMES_PERMITIDOS.includes(file.mimetype)) return cb(null, true);
    cb(new Error("FORMATO"));
  },
});

// POST /api/recibos/:id/comprobante-firmado   (campo "archivo")
router.post("/:id/comprobante-firmado", (req, res) => {
  subida.single("archivo")(req, res, async (err) => {
    if (err) {
      const mensaje =
        err.message === "FORMATO"
          ? "Formato no permitido. Sube una foto (JPG, PNG, WEBP) o un PDF."
          : err.code === "LIMIT_FILE_SIZE"
          ? "El archivo es muy grande (máximo 6 MB)."
          : "No se pudo recibir el archivo.";
      return res.status(400).json({ message: mensaje });
    }
    try {
      if (!req.file) return res.status(400).json({ message: "Selecciona la foto o el archivo del comprobante firmado." });

      const [rows] = await pool.query("SELECT * FROM recibos WHERE id_recibo = ?", [req.params.id]);
      if (!rows.length) return res.status(404).json({ message: "Recibo no encontrado" });
      const r = rows[0];
      if (r.tipo !== "desembolso" || r.anulado) {
        return res.status(400).json({ message: "Solo los comprobantes de desembolso vigentes llevan copia firmada." });
      }

      await pool.query(
        `INSERT INTO comprobantes_firmados
           (id_recibo, id_socio, nombre_archivo, mime, tamano, contenido, subido_por, subido_por_rol)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          r.id_recibo,
          r.id_socio,
          String(req.file.originalname || "comprobante").substring(0, 150),
          req.file.mimetype,
          req.file.size,
          req.file.buffer,
          req.usuario.id_usuario,
          req.usuario.rol,
        ]
      );

      await pool.query(
        `INSERT INTO bitacora (id_usuario, accion, detalle, fecha) VALUES (?, ?, ?, NOW())`,
        [
          r.id_socio,
          "Comprobante firmado",
          `Se recibió el comprobante firmado ${numeroRecibo(r.id_recibo, r.tipo)} (${req.usuario.rol})`,
        ]
      );

      res.status(201).json({ success: true, message: "Comprobante firmado recibido." });
    } catch (error) {
      console.error("ERROR AL GUARDAR COMPROBANTE FIRMADO:", error);
      res.status(500).json({ message: "No se pudo guardar el comprobante." });
    }
  });
});

// GET /api/recibos/:id/comprobante-firmado  → el archivo más reciente
router.get("/:id/comprobante-firmado", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT nombre_archivo, mime, contenido FROM comprobantes_firmados
       WHERE id_recibo = ? ORDER BY id_comprobante DESC LIMIT 1`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ message: "Aún no hay comprobante firmado." });
    res.setHeader("Content-Type", rows[0].mime);
    res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(rows[0].nombre_archivo)}"`);
    res.send(rows[0].contenido);
  } catch (error) {
    console.error("ERROR AL LEER COMPROBANTE FIRMADO:", error);
    res.status(500).json({ message: "No se pudo leer el comprobante." });
  }
});

// GET /api/recibos/:id
router.get("/:id", async (req, res) => {
  try {
    const [rows] = await pool.query(`${SELECT_RECIBO} WHERE r.id_recibo = ?`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ message: "Recibo no encontrado" });
    res.json({ success: true, data: formatear(rows[0], await nombreCooperativa()) });
  } catch (error) {
    console.error("ERROR AL OBTENER RECIBO:", error);
    res.status(500).json({ message: "Error al obtener el recibo" });
  }
});

module.exports = router;
