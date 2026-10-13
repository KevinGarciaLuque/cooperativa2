// Pagos que el socio hace por transferencia o depósito y reporta desde su panel con la foto
// del comprobante. El personal los revisa: al confirmarlos se registran en Pagos (con su
// recibo) y el reporte queda enlazado al pago; si no corresponden, se rechazan con un motivo.
const express = require("express");
const router = express.Router();
const multer = require("multer");
const pool = require("../db");
const { notificarAdministradores, notificarSocio, escaparHtml } = require("../utils/notificaciones");

const METODOS = ["Transferencia", "Deposito", "Pago móvil"];
const MIMES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const esSocio = (req) => req.usuario?.rol === "Socio";
const num = (v) => parseFloat(v || 0);
const texto = (v, max) => String(v || "").trim().substring(0, max);
const fmt = (n) => `L. ${num(n).toLocaleString("es-HN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const subida = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 6 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => (MIMES.includes(file.mimetype) ? cb(null, true) : cb(new Error("FORMATO"))),
});

const soloPersonal = (req, res, next) =>
  esSocio(req) ? res.status(403).json({ message: "No tienes permiso para realizar esta acción." }) : next();

const COLUMNAS = `r.id_reporte, r.id_prestamo, r.id_usuario, r.monto, r.metodo, r.banco, r.referencia, r.fecha_pago,
  r.nota, r.mime, r.estado, r.motivo_rechazo, r.id_pago, r.revisado_en, r.creado_en`;
const formatear = (r) => ({ ...r, monto: num(r.monto) });

// ============================================
// SOCIO: reportar un pago
// POST /api/pagos-reportados  (multipart: datos + campo "comprobante")
// ============================================
router.post("/", (req, res) => {
  subida.single("comprobante")(req, res, async (err) => {
    if (err) {
      const mensaje =
        err.message === "FORMATO"
          ? "Sube una foto (JPG, PNG, WEBP) o un PDF del comprobante."
          : err.code === "LIMIT_FILE_SIZE"
          ? "El comprobante es muy grande (máximo 6 MB)."
          : "No se pudo recibir el comprobante.";
      return res.status(400).json({ message: mensaje });
    }
    try {
      if (!esSocio(req)) return res.status(403).json({ message: "Solo el socio reporta sus pagos." });
      const b = req.body || {};
      const idPrestamo = parseInt(b.id_prestamo);
      const monto = num(b.monto);
      const metodo = METODOS.includes(b.metodo) ? b.metodo : null;
      const fecha = /^\d{4}-\d{2}-\d{2}$/.test(b.fecha_pago || "") ? b.fecha_pago : null;

      if (!req.file) return res.status(400).json({ message: "Adjunta la foto o el PDF del comprobante de pago." });
      if (!(monto > 0) || monto > 10000000) return res.status(400).json({ message: "Indica el monto que pagaste." });
      if (!metodo) return res.status(400).json({ message: "Indica cómo hiciste el pago." });
      if (!fecha) return res.status(400).json({ message: "Indica la fecha del pago." });
      const [[f]] = await pool.query(
        "SELECT DATEDIFF(CURDATE(), ?) AS dias",
        [fecha]
      );
      if (f.dias < 0) return res.status(400).json({ message: "La fecha del pago no puede ser futura." });
      if (f.dias > 90) return res.status(400).json({ message: "La fecha del pago es de hace más de 90 días." });

      const [[p]] = await pool.query(
        "SELECT id_prestamo, id_usuario, estado FROM prestamos WHERE id_prestamo = ?",
        [idPrestamo]
      );
      if (!p || p.id_usuario !== req.usuario.id_usuario) {
        return res.status(404).json({ message: "Préstamo no encontrado." });
      }
      if (!["activo", "mora"].includes(p.estado)) {
        return res.status(400).json({ message: "Solo se reportan pagos de préstamos vigentes." });
      }
      const [pendiente] = await pool.query(
        "SELECT id_reporte FROM pagos_reportados WHERE id_prestamo = ? AND estado = 'pendiente' LIMIT 1",
        [idPrestamo]
      );
      if (pendiente.length) {
        return res.status(409).json({
          message: "Ya tienes un pago en revisión para este préstamo. Espera a que la cooperativa lo confirme.",
        });
      }

      const [r] = await pool.query(
        `INSERT INTO pagos_reportados
           (id_prestamo, id_usuario, monto, metodo, banco, referencia, fecha_pago, nota, nombre_archivo, mime, tamano, contenido)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          idPrestamo,
          req.usuario.id_usuario,
          monto,
          metodo,
          texto(b.banco, 60) || null,
          texto(b.referencia, 60) || null,
          fecha,
          texto(b.nota, 300) || null,
          String(req.file.originalname || "comprobante").substring(0, 150),
          req.file.mimetype,
          req.file.size,
          req.file.buffer,
        ]
      );
      await pool.query(
        `INSERT INTO bitacora (id_usuario, accion, detalle, fecha) VALUES (?, ?, ?, NOW())`,
        [req.usuario.id_usuario, "Pago reportado", `Reportó un pago de ${fmt(monto)} (${metodo}) al préstamo #${idPrestamo}`]
      );
      notificarAdministradores(
        "Pago reportado por un socio",
        `<p><strong>${escaparHtml(req.usuario.nombre_completo || "Un socio")}</strong> reportó un pago de ` +
          `<strong>${fmt(monto)}</strong> por ${escaparHtml(metodo.toLowerCase())} al préstamo #${idPrestamo}. ` +
          `Revísalo y confírmalo en Solicitudes.</p>`
      );
      res.status(201).json({
        success: true,
        id_reporte: r.insertId,
        message: "Pago reportado. La cooperativa revisará tu comprobante y te avisará cuando quede registrado.",
      });
    } catch (error) {
      console.error("ERROR AL REPORTAR PAGO:", error);
      res.status(500).json({ message: "No se pudo reportar el pago. Intenta de nuevo." });
    }
  });
});

// GET /api/pagos-reportados/mios  → los reportes del socio
router.get("/mios", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT ${COLUMNAS} FROM pagos_reportados r WHERE r.id_usuario = ? ORDER BY r.creado_en DESC LIMIT 30`,
      [req.usuario.id_usuario]
    );
    res.json({ success: true, data: rows.map(formatear) });
  } catch (error) {
    console.error("ERROR AL LISTAR PAGOS REPORTADOS DEL SOCIO:", error);
    res.status(500).json({ message: "No se pudieron cargar tus pagos reportados" });
  }
});

// GET /api/pagos-reportados?estado=pendiente  → revisión del personal
router.get("/", soloPersonal, async (req, res) => {
  try {
    const estado = ["pendiente", "confirmado", "rechazado"].includes(req.query.estado) ? req.query.estado : "pendiente";
    const [rows] = await pool.query(
      `SELECT ${COLUMNAS}, u.nombre_completo, u.dni, u.telefono, p.saldo_restante, p.estado AS estado_prestamo
       FROM pagos_reportados r
       INNER JOIN usuarios u ON r.id_usuario = u.id_usuario
       INNER JOIN prestamos p ON r.id_prestamo = p.id_prestamo
       WHERE r.estado = ?
       ORDER BY r.creado_en ${estado === "pendiente" ? "ASC" : "DESC"} LIMIT 100`,
      [estado]
    );
    res.json({ success: true, data: rows.map((r) => ({ ...formatear(r), saldo_restante: num(r.saldo_restante) })) });
  } catch (error) {
    console.error("ERROR AL LISTAR PAGOS REPORTADOS:", error);
    res.status(500).json({ message: "No se pudieron cargar los pagos reportados" });
  }
});

// GET /api/pagos-reportados/:id  → datos de un reporte (para prellenar Pagos)
router.get("/:id(\\d+)", soloPersonal, async (req, res) => {
  try {
    const [[r]] = await pool.query(`SELECT ${COLUMNAS} FROM pagos_reportados r WHERE r.id_reporte = ?`, [req.params.id]);
    if (!r) return res.status(404).json({ message: "Reporte no encontrado" });
    res.json({ success: true, data: formatear(r) });
  } catch (error) {
    res.status(500).json({ message: "No se pudo cargar el reporte" });
  }
});

// GET /api/pagos-reportados/:id/comprobante  → la foto o el PDF (el socio dueño o el personal)
router.get("/:id(\\d+)/comprobante", async (req, res) => {
  try {
    const [[r]] = await pool.query(
      "SELECT id_usuario, mime, nombre_archivo, contenido FROM pagos_reportados WHERE id_reporte = ?",
      [req.params.id]
    );
    if (!r) return res.status(404).json({ message: "Comprobante no encontrado" });
    if (esSocio(req) && r.id_usuario !== req.usuario.id_usuario) {
      return res.status(403).json({ message: "No tienes permiso para realizar esta acción." });
    }
    res.setHeader("Content-Type", r.mime);
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(r.nombre_archivo)}"`);
    res.send(r.contenido);
  } catch (error) {
    res.status(500).json({ message: "No se pudo cargar el comprobante" });
  }
});

// POST /api/pagos-reportados/:id/rechazar  { motivo }
router.post("/:id(\\d+)/rechazar", soloPersonal, async (req, res) => {
  try {
    const motivo = texto(req.body?.motivo, 255);
    if (motivo.length < 3) return res.status(400).json({ message: "Indica el motivo del rechazo (mínimo 3 caracteres)." });
    const [[r]] = await pool.query("SELECT * FROM pagos_reportados WHERE id_reporte = ?", [req.params.id]);
    if (!r) return res.status(404).json({ message: "Reporte no encontrado" });
    if (r.estado !== "pendiente") return res.status(400).json({ message: "Este pago ya fue revisado." });
    await pool.query(
      `UPDATE pagos_reportados SET estado = 'rechazado', motivo_rechazo = ?, revisado_por = ?, revisado_en = NOW()
       WHERE id_reporte = ? AND estado = 'pendiente'`,
      [motivo, req.usuario.id_usuario, r.id_reporte]
    );
    await pool.query(
      `INSERT INTO bitacora (id_usuario, accion, detalle, fecha) VALUES (?, ?, ?, NOW())`,
      [r.id_usuario, "Pago reportado rechazado", `Pago reportado #${r.id_reporte} de ${fmt(r.monto)} no se registró. Motivo: ${motivo}`]
    );
    notificarSocio(
      r.id_usuario,
      "Tu pago reportado no se pudo registrar",
      `<p>Revisamos el pago de <strong>${fmt(r.monto)}</strong> que reportaste para tu préstamo #${r.id_prestamo} y no lo pudimos registrar.</p>
       <p><strong>Motivo:</strong> ${escaparHtml(motivo)}</p>
       <p>Si tienes dudas, comunícate con la cooperativa.</p>`
    );
    res.json({ success: true, message: "Pago reportado rechazado." });
  } catch (error) {
    console.error("ERROR AL RECHAZAR PAGO REPORTADO:", error);
    res.status(500).json({ message: "No se pudo rechazar el pago" });
  }
});

module.exports = router;
