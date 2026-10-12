const express = require("express");
const router = express.Router();
const pool = require("../db");

const num = (v) => parseFloat(v || 0);

// GET /api/socios/:id/estado-cuenta?desde=YYYY-MM-DD&hasta=YYYY-MM-DD
router.get("/:id/estado-cuenta", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { desde, hasta } = req.query;
    const filtroFecha = (campo) => {
      const partes = [];
      const params = [];
      if (/^\d{4}-\d{2}-\d{2}$/.test(desde || "")) {
        partes.push(`DATE(${campo}) >= ?`);
        params.push(desde);
      }
      if (/^\d{4}-\d{2}-\d{2}$/.test(hasta || "")) {
        partes.push(`DATE(${campo}) <= ?`);
        params.push(hasta);
      }
      return { sql: partes.length ? " AND " + partes.join(" AND ") : "", params };
    };

    const [socio] = await pool.query(
      `SELECT id_usuario, nombre_completo, dni, telefono, correo, direccion, fecha_registro
       FROM usuarios WHERE id_usuario = ?`,
      [id]
    );
    if (!socio.length) return res.status(404).json({ message: "Socio no encontrado" });

    const [cuentas] = await pool.query(
      `SELECT id_cuenta, tipo_cuenta, saldo_actual, estado FROM cuentas WHERE id_usuario = ?`,
      [id]
    );

    const fa = filtroFecha("fecha");
    const [aportaciones] = await pool.query(
      `SELECT id_aportacion, monto, fecha, descripcion FROM aportaciones
       WHERE id_usuario = ?${fa.sql} ORDER BY fecha DESC`,
      [id, ...fa.params]
    );

    const [prestamos] = await pool.query(
      `SELECT id_prestamo, monto, tasa_interes, plazo_meses, saldo_restante, estado, fecha_otorgado
       FROM prestamos WHERE id_usuario = ? AND estado IN ('activo','mora','pagado') ORDER BY fecha_otorgado DESC`,
      [id]
    );

    const fp = filtroFecha("pp.fecha_pago");
    const [pagos] = await pool.query(
      `SELECT pp.id_pago, pp.id_prestamo, pp.monto_pagado, pp.monto_capital, pp.monto_interes,
              pp.saldo_restante, pp.metodo_pago, pp.fecha_pago
       FROM pagos_prestamo pp INNER JOIN prestamos pr ON pp.id_prestamo = pr.id_prestamo
       WHERE pr.id_usuario = ?${fp.sql} ORDER BY pp.fecha_pago DESC`,
      [id, ...fp.params]
    );

    res.json({
      success: true,
      generado: new Date().toISOString(),
      periodo: { desde: desde || null, hasta: hasta || null },
      socio: socio[0],
      resumen: {
        saldo_cuentas: cuentas.reduce((s, c) => s + num(c.saldo_actual), 0),
        total_aportaciones: aportaciones.reduce((s, a) => s + num(a.monto), 0),
        saldo_prestamos: prestamos
          .filter((p) => p.estado !== "pagado")
          .reduce((s, p) => s + num(p.saldo_restante), 0),
        total_pagado: pagos.reduce((s, p) => s + num(p.monto_pagado), 0),
      },
      cuentas,
      aportaciones,
      prestamos,
      pagos,
    });
  } catch (error) {
    console.error("ERROR EN ESTADO DE CUENTA:", error);
    res.status(500).json({ message: "Error al generar el estado de cuenta" });
  }
});

module.exports = router;
