const express = require("express");
const router = express.Router();
const pool = require("../db");
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
  SELECT r.*, s.nombre_completo AS socio_nombre, s.dni AS socio_dni, s.telefono AS socio_telefono, e.nombre_completo AS emisor_nombre
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
