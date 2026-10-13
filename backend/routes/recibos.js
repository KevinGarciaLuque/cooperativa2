const express = require("express");
const router = express.Router();
const pool = require("../db");
const multer = require("multer");
const { notificarAdministradores, escaparHtml } = require("../utils/notificaciones");
const { numeroRecibo, emitirFiniquito } = require("../utils/recibos");
const { firmaDataUrl, leerFirma } = require("../utils/firmas");

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
    comprobante_firmado: r.firmado_en ? { subido_en: r.firmado_en, revisado: !!r.firmado_revisado_en } : null,
    firma_digital: r.firmado_digital_en ? { firmado_en: r.firmado_digital_en } : null,
    cooperativa,
  };
};

// Firma del socio guardada en el documento cuando lo firmó desde la app
const firmaSocioDataUrl = async (idRecibo) => {
  try {
    const [[f]] = await pool.query("SELECT mime, contenido FROM firmas_documento WHERE id_recibo = ?", [idRecibo]);
    return f ? `data:${f.mime};base64,${Buffer.from(f.contenido).toString("base64")}` : null;
  } catch {
    return null;
  }
};

// Recibo completo (para verlo o generar su PDF): incluye la firma de quien lo emitió
// y, si ya lo firmó, la del socio
const reciboCompleto = async (r) => ({
  ...formatear(r, await nombreCooperativa()),
  firma_emisor: await firmaDataUrl(r.emitido_por),
  firma_socio: r.firmado_digital_en ? await firmaSocioDataUrl(r.id_recibo) : null,
});

const nombreCooperativa = async () => {
  try {
    const [rows] = await pool.query("SELECT valor FROM configuracion_sitio WHERE clave = 'site_name'");
    return rows.length ? rows[0].valor : "SmartCoop";
  } catch {
    return "SmartCoop";
  }
};

const SELECT_RECIBO = `
  SELECT r.*, s.nombre_completo AS socio_nombre, s.dni AS socio_dni, s.telefono AS socio_telefono, e.nombre_completo AS emisor_nombre,
         (SELECT MAX(c.subido_en) FROM comprobantes_firmados c WHERE c.id_recibo = r.id_recibo) AS firmado_en,
         (SELECT c.revisado_en FROM comprobantes_firmados c WHERE c.id_recibo = r.id_recibo
            ORDER BY c.id_comprobante DESC LIMIT 1) AS firmado_revisado_en,
         (SELECT fd.firmado_en FROM firmas_documento fd WHERE fd.id_recibo = r.id_recibo) AS firmado_digital_en
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
    res.json({ success: true, data: await reciboCompleto(rows[0]) });
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
    res.json({ success: true, data: await reciboCompleto(rows[0]) });
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
      if (r.anulado) {
        return res.status(400).json({ message: "Este recibo está anulado: ya no se firma." });
      }

      // Una vez revisado por la cooperativa, el socio ya no puede cambiarlo
      if (req.usuario.rol === "Socio") {
        const [[previo]] = await pool.query(
          `SELECT revisado_en FROM comprobantes_firmados WHERE id_recibo = ? ORDER BY id_comprobante DESC LIMIT 1`,
          [r.id_recibo]
        );
        if (previo && previo.revisado_en) {
          return res.status(403).json({
            message: "Este comprobante ya fue revisado por la cooperativa. Comunícate con ella si necesitas cambiarlo.",
          });
        }
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

      // Lo que sube el personal ya viene revisado
      if (req.usuario.rol !== "Socio") {
        await pool.query(
          `UPDATE comprobantes_firmados SET revisado_en = NOW(), revisado_por = ?
           WHERE id_recibo = ? AND revisado_en IS NULL`,
          [req.usuario.id_usuario, r.id_recibo]
        );
      }

      await pool.query(
        `INSERT INTO bitacora (id_usuario, accion, detalle, fecha) VALUES (?, ?, ?, NOW())`,
        [
          r.id_socio,
          "Comprobante firmado",
          `Se recibió el comprobante firmado ${numeroRecibo(r.id_recibo, r.tipo)} (${req.usuario.rol})`,
        ]
      );

      // Aviso al Super Administrador cuando lo sube el socio
      if (req.usuario.rol === "Socio") {
        const [[socio]] = await pool.query("SELECT nombre_completo FROM usuarios WHERE id_usuario = ?", [r.id_socio]);
        notificarAdministradores(
          "Comprobante firmado recibido",
          `<p><strong>${socio?.nombre_completo || "Un socio"}</strong> subió firmado su documento ` +
            `<strong>${numeroRecibo(r.id_recibo, r.tipo)}</strong>.</p>`
        );
      }

      res.status(201).json({ success: true, message: "Comprobante firmado recibido." });
    } catch (error) {
      console.error("ERROR AL GUARDAR COMPROBANTE FIRMADO:", error);
      res.status(500).json({ message: "No se pudo guardar el comprobante." });
    }
  });
});

// POST /api/recibos/:id/firmar  → el socio firma su documento con la firma digital de su perfil.
// Se guarda una copia de la firma en ese momento: si después la cambia, el documento no cambia.
router.post("/:id/firmar", async (req, res) => {
  try {
    if (req.usuario.rol !== "Socio") {
      return res.status(403).json({ message: "Solo el socio firma sus documentos desde la app." });
    }
    const [[r]] = await pool.query("SELECT * FROM recibos WHERE id_recibo = ?", [req.params.id]);
    if (!r || r.id_socio !== req.usuario.id_usuario) return res.status(404).json({ message: "Recibo no encontrado" });
    if (r.anulado) return res.status(400).json({ message: "Este recibo está anulado: ya no se firma." });

    const firma = await leerFirma(req.usuario.id_usuario);
    if (!firma) {
      return res.status(400).json({ message: "Primero dibuja tu firma.", sin_firma: true });
    }
    const [ins] = await pool.query(
      `INSERT IGNORE INTO firmas_documento (id_recibo, id_usuario, mime, contenido, ip) VALUES (?, ?, ?, ?, ?)`,
      [r.id_recibo, req.usuario.id_usuario, firma.mime, firma.contenido, String(req.ip || "").substring(0, 60) || null]
    );
    if (!ins.affectedRows) return res.status(409).json({ message: "Ya firmaste este documento." });

    await pool.query(
      `INSERT INTO bitacora (id_usuario, accion, detalle, fecha) VALUES (?, ?, ?, NOW())`,
      [r.id_socio, "Documento firmado", `Firmó digitalmente ${numeroRecibo(r.id_recibo, r.tipo)}`]
    );
    if (r.tipo === "desembolso") {
      notificarAdministradores(
        "Comprobante de desembolso firmado",
        `<p><strong>${escaparHtml(req.usuario.nombre_completo || "Un socio")}</strong> firmó digitalmente su comprobante de desembolso ` +
          `<strong>${numeroRecibo(r.id_recibo, r.tipo)}</strong> (préstamo #${r.referencia_id}).</p>`
      );
    }

    const [rows] = await pool.query(`${SELECT_RECIBO} WHERE r.id_recibo = ?`, [r.id_recibo]);
    res.status(201).json({ success: true, message: "Documento firmado.", data: await reciboCompleto(rows[0]) });
  } catch (error) {
    console.error("ERROR AL FIRMAR DOCUMENTO:", error);
    res.status(500).json({ message: "No se pudo firmar el documento." });
  }
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

    // Cuando el personal lo abre, queda marcado como revisado
    if (req.usuario.rol !== "Socio") {
      await pool.query(
        `UPDATE comprobantes_firmados SET revisado_en = NOW(), revisado_por = ?
         WHERE id_recibo = ? AND revisado_en IS NULL`,
        [req.usuario.id_usuario, req.params.id]
      );
    }
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
    res.json({ success: true, data: await reciboCompleto(rows[0]) });
  } catch (error) {
    console.error("ERROR AL OBTENER RECIBO:", error);
    res.status(500).json({ message: "Error al obtener el recibo" });
  }
});

module.exports = router;
