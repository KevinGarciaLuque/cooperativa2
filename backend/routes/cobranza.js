const express = require("express");
const router = express.Router();
const pool = require("../db");
const { DIAS_MES } = require("../utils/calculosPrestamo");
const { obtenerCartera, resumirCartera } = require("../utils/cartera");
const { notificarSocio } = require("../utils/notificaciones");
const {
  mensajeRecordatorio,
  ejecutarRecordatorios,
  registrarGestion,
  htmlDe,
  nombreCooperativa,
} = require("../utils/recordatorios");

// ============================================
// CARTERA: préstamos vigentes clasificados por antigüedad
// GET /api/cobranza/cartera
// ============================================
router.get("/cartera", async (req, res) => {
  try {
    const filas = await obtenerCartera();
    const { resumen } = resumirCartera(filas);
    res.json({ success: true, dias_mes: DIAS_MES, resumen, data: filas });
  } catch (error) {
    console.error("ERROR AL OBTENER CARTERA:", error);
    res.status(500).json({ message: "Error al obtener la cartera" });
  }
});

// ============================================
// GESTIONES (llamadas, visitas, promesas)
// ============================================
router.get("/gestiones/:id_prestamo", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT g.*, u.nombre_completo AS registrado_por
       FROM gestiones_cobro g LEFT JOIN usuarios u ON g.id_usuario = u.id_usuario
       WHERE g.id_prestamo = ? ORDER BY g.fecha DESC, g.id_gestion DESC LIMIT 50`,
      [req.params.id_prestamo]
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error("ERROR AL LISTAR GESTIONES:", error);
    res.status(500).json({ message: "Error al obtener las gestiones" });
  }
});

router.post("/gestiones", async (req, res) => {
  try {
    const { id_prestamo, medio, nota, promesa_fecha, promesa_monto } = req.body;
    if (!id_prestamo || !String(nota || "").trim()) {
      return res.status(400).json({ message: "Indica el préstamo y una nota de la gestión." });
    }
    const medios = ["llamada", "visita", "mensaje", "correo", "otro"];
    const medioFinal = medios.includes(medio) ? medio : "llamada";
    const fechaPromesa = /^\d{4}-\d{2}-\d{2}$/.test(promesa_fecha || "") ? promesa_fecha : null;
    const montoPromesa = promesa_monto ? parseFloat(promesa_monto) : null;

    const [existe] = await pool.query("SELECT id_prestamo, id_usuario FROM prestamos WHERE id_prestamo = ?", [id_prestamo]);
    if (!existe.length) return res.status(404).json({ message: "Préstamo no encontrado" });

    await pool.query(
      `INSERT INTO gestiones_cobro (id_prestamo, medio, nota, promesa_fecha, promesa_monto, id_usuario)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id_prestamo, medioFinal, String(nota).trim().substring(0, 500), fechaPromesa, montoPromesa, req.usuario?.id_usuario || null]
    );
    await pool.query(
      `INSERT INTO bitacora (id_usuario, accion, detalle, fecha) VALUES (?, ?, ?, NOW())`,
      [existe[0].id_usuario, "Gestión de cobranza", `Préstamo #${id_prestamo}: ${medioFinal}. ${String(nota).trim().substring(0, 150)}`]
    );
    res.status(201).json({ success: true, message: "Gestión registrada" });
  } catch (error) {
    console.error("ERROR AL REGISTRAR GESTIÓN:", error);
    res.status(500).json({ message: "Error al registrar la gestión" });
  }
});

// ============================================
// RECORDATORIOS DE PAGO
// ============================================
const filaDe = async (idPrestamo) => (await obtenerCartera()).find((f) => f.id_prestamo === idPrestamo);

// Texto del recordatorio (para WhatsApp) y teléfono del socio
router.get("/recordatorio/:id_prestamo", async (req, res) => {
  try {
    const f = await filaDe(parseInt(req.params.id_prestamo));
    if (!f) return res.status(404).json({ message: "El préstamo no está vigente." });
    const m = mensajeRecordatorio(f, await nombreCooperativa());
    res.json({ success: true, data: { tipo: m.tipo, texto: m.texto, telefono: f.telefono, correo: f.correo } });
  } catch (error) {
    console.error("ERROR AL PREPARAR RECORDATORIO:", error);
    res.status(500).json({ message: "No se pudo preparar el recordatorio" });
  }
});

// Enviar ahora el recordatorio por correo a un socio
router.post("/recordatorio/:id_prestamo", async (req, res) => {
  try {
    const f = await filaDe(parseInt(req.params.id_prestamo));
    if (!f) return res.status(404).json({ message: "El préstamo no está vigente." });
    const m = mensajeRecordatorio(f, await nombreCooperativa());
    const envio = await notificarSocio(f.id_usuario, m.asunto, htmlDe(m.texto));
    if (!envio.enviado) return res.status(400).json({ message: envio.motivo });
    await registrarGestion(
      f.id_prestamo,
      "correo",
      `Recordatorio de pago enviado por correo a ${envio.correo}.`,
      req.usuario?.id_usuario || null
    );
    res.json({ success: true, message: `Recordatorio enviado a ${envio.correo}.` });
  } catch (error) {
    console.error("ERROR AL ENVIAR RECORDATORIO:", error);
    res.status(500).json({ message: "No se pudo enviar el recordatorio" });
  }
});

// Ejecutar ya el envío automático del día (solo Super Administrador)
router.post("/recordatorios/ejecutar", async (req, res) => {
  try {
    if (req.usuario?.rol !== "Super Administrador") {
      return res.status(403).json({ message: "Solo el Super Administrador puede hacerlo." });
    }
    const r = await ejecutarRecordatorios();
    if (r.motivo) return res.status(400).json({ message: r.motivo, data: r });
    res.json({
      success: true,
      message:
        `Se enviaron ${r.enviados} recordatorio(s): ${r.previos} antes del vencimiento y ${r.mora} de mora.` +
        (r.ya_enviados ? ` ${r.ya_enviados} ya se habían enviado.` : "") +
        (r.sin_correo ? ` ${r.sin_correo} socio(s) sin correo.` : "") +
        (r.errores ? ` ${r.errores} no se pudieron enviar.` : ""),
      data: r,
    });
  } catch (error) {
    console.error("ERROR AL EJECUTAR RECORDATORIOS:", error);
    res.status(500).json({ message: "No se pudieron enviar los recordatorios" });
  }
});

module.exports = router;
