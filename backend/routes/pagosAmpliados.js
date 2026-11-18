// Pagos ampliados (función "pagos_ampliados", la enciende el Super Administrador):
// pago rápido de varios préstamos de un socio en una sola operación y conciliación de las
// boletas de depósito o transferencia contra el estado de cuenta del banco.
const express = require("express");
const router = express.Router();
const pool = require("../db");
const { habilitada } = require("../utils/funciones");
const { filtroSocio } = require("../utils/sucursal");
const { procesarPago, FalloPago } = require("./pagos");
const { crearNotificacion } = require("../utils/notificaciones");
const { dinero } = require("../utils/pais");
const { registrarCaja, normalizarMetodo } = require("../utils/caja");

// Depósito a una cuenta de ahorro dentro de la transacción del pago (igual que un abono normal)
const depositar = async (conn, { id_cuenta, monto, metodo, boleta, usuario }) => {
  const [[c]] = await conn.query("SELECT id_cuenta, id_usuario, tipo_cuenta, saldo_actual, estado FROM cuentas WHERE id_cuenta = ? FOR UPDATE", [id_cuenta]);
  if (!c) throw error(404, `La cuenta #${id_cuenta} no existe.`);
  if (c.estado && c.estado !== "activa") throw error(400, `La cuenta ${c.tipo_cuenta} no está activa.`);
  const anterior = num(c.saldo_actual);
  const nuevo = Math.round((anterior + monto) * 100) / 100;
  const descripcion = `Depósito con el pago${boleta ? ` (boleta ${boleta})` : ""}`;
  const [r] = await conn.query(
    `INSERT INTO movimientos_cuenta (id_cuenta, tipo_movimiento, monto, saldo_anterior, saldo_nuevo, descripcion, fecha)
     VALUES (?, 'abono', ?, ?, ?, ?, NOW())`,
    [id_cuenta, monto, anterior, nuevo, descripcion]
  );
  await registrarCaja(conn, {
    tipo: "ingreso",
    categoria: "deposito_ahorro",
    monto,
    metodo: normalizarMetodo(metodo),
    descripcion: `Depósito en cuenta ${c.tipo_cuenta}: ${descripcion}`,
    referencia_tipo: "movimiento_cuenta",
    referencia_id: r.insertId,
    id_socio: c.id_usuario,
    id_registrado_por: usuario?.id_usuario,
    contable: { tipo_cuenta: c.tipo_cuenta },
  });
  await conn.query("UPDATE cuentas SET saldo_actual = ? WHERE id_cuenta = ?", [nuevo, id_cuenta]);
  return { id_cuenta, id_usuario: c.id_usuario, tipo_cuenta: c.tipo_cuenta, monto, saldo_nuevo: nuevo };
};

const num = (v) => parseFloat(v || 0);
const esFecha = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ""));
const error = (codigo, message) => Object.assign(new Error(message), { codigo });

router.use(async (req, res, next) => {
  if (await habilitada("pagos_ampliados", req.usuario)) return next();
  res.status(403).json({ message: "Los pagos ampliados no están habilitados." });
});

// POST /api/pagos-ampliados/rapido
// { metodo_pago, fecha_pago?, numero_boleta?, lugar_pago?, detalles: [{ id_prestamo, monto_pagado, otros_cargos?, otros_cargos_detalle? }] }
// Todos los préstamos deben ser del mismo socio. Todo o nada.
router.post("/rapido", async (req, res) => {
  const b = req.body || {};
  const conn = await pool.getConnection();
  try {
    const detalles = (Array.isArray(b.detalles) ? b.detalles : [])
      .map((d) => ({ ...d, id_prestamo: parseInt(d.id_prestamo), monto_pagado: Math.round(num(d.monto_pagado) * 100) / 100 }))
      .filter((d) => d.monto_pagado > 0);
    // Depósitos a cuentas de ahorro del socio en la misma operación
    const depositos = (Array.isArray(b.depositos) ? b.depositos : [])
      .map((d) => ({ id_cuenta: parseInt(d.id_cuenta), monto: Math.round(num(d.monto) * 100) / 100 }))
      .filter((d) => d.id_cuenta && d.monto > 0);
    if (!detalles.length && !depositos.length) throw error(400, "Indica cuánto se paga en al menos un préstamo o cuenta.");
    if (new Set(detalles.map((d) => d.id_prestamo)).size !== detalles.length) throw error(400, "Un préstamo aparece dos veces.");
    const [prestamos] = detalles.length
      ? await conn.query("SELECT id_prestamo, id_usuario FROM prestamos WHERE id_prestamo IN (?)", [detalles.map((d) => d.id_prestamo)])
      : [[]];
    if (prestamos.length !== detalles.length) throw error(404, "Uno de los préstamos no existe.");
    const [cuentas] = depositos.length
      ? await conn.query("SELECT id_cuenta, id_usuario FROM cuentas WHERE id_cuenta IN (?)", [depositos.map((d) => d.id_cuenta)])
      : [[]];
    if (cuentas.length !== new Set(depositos.map((d) => d.id_cuenta)).size) throw error(404, "Una de las cuentas no existe.");
    const duenos = new Set([...prestamos.map((p) => p.id_usuario), ...cuentas.map((c) => c.id_usuario)]);
    if (duenos.size > 1) throw error(400, "El pago rápido es para los préstamos y cuentas de un mismo socio.");
    const idSocio = [...duenos][0];

    await conn.beginTransaction();
    const resultados = [];
    for (const d of detalles) {
      try {
        resultados.push(
          await procesarPago(
            conn,
            {
              id_prestamo: d.id_prestamo,
              monto_pagado: d.monto_pagado,
              metodo_pago: b.metodo_pago,
              fecha_pago: b.fecha_pago,
              numero_boleta: b.numero_boleta,
              lugar_pago: b.lugar_pago,
              otros_cargos: d.otros_cargos,
              otros_cargos_detalle: d.otros_cargos_detalle,
            },
            req.usuario
          )
        );
      } catch (e) {
        if (e instanceof FalloPago) throw error(e.codigo, `Préstamo #${d.id_prestamo}: ${e.cuerpo?.message || e.message}`);
        throw e;
      }
    }
    const depositados = [];
    for (const d of depositos) {
      depositados.push(await depositar(conn, { ...d, metodo: b.metodo_pago, boleta: b.numero_boleta, usuario: req.usuario }));
    }
    const total =
      resultados.reduce((t, r) => t + r.montoPagadoNum + (r.otrosCargos || 0), 0) + depositados.reduce((t, d) => t + d.monto, 0);
    await conn.query("INSERT INTO bitacora (id_usuario, accion, detalle, fecha) VALUES (?, ?, ?, NOW())", [
      req.usuario.id_usuario,
      "Pago rápido",
      `${dinero(total)} en ${resultados.length} préstamo(s) y ${depositados.length} cuenta(s) del socio #${idSocio}${b.numero_boleta ? ` · boleta ${b.numero_boleta}` : ""}`,
    ]);
    await conn.commit();
    for (const r of resultados) {
      crearNotificacion(r.prestamoData.id_usuario, {
        titulo: r.prestamoLiquidado ? `¡Préstamo #${r.id_prestamo} cancelado!` : "Pago registrado",
        mensaje: `Registramos tu pago de ${dinero(r.montoPagadoNum)} a tu préstamo #${r.id_prestamo}. ` +
          (r.prestamoLiquidado ? "Tu préstamo quedó totalmente pagado." : `Tu nuevo saldo es ${dinero(r.nuevoSaldo)}.`),
        tipo: "pago",
        idRecibo: r.idRecibo,
      });
    }
    res.status(201).json({
      success: true,
      message: `Pago registrado: ${dinero(total)}${resultados.length ? ` en ${resultados.length} préstamo(s)` : ""}${depositados.length ? `${resultados.length ? " y" : " en"} ${depositados.length} cuenta(s) de ahorro` : ""}.`,
      depositos: depositados,
      total,
      detalles: resultados.map((r) => ({
        id_prestamo: Number(r.id_prestamo),
        monto_pagado: r.montoPagadoNum,
        otros_cargos: r.otrosCargos || 0,
        capital: r.capitalDelPeriodo,
        interes: r.interesEfectivo,
        mora: r.interesMoratorio,
        saldo_nuevo: r.nuevoSaldo,
        id_recibo: r.idRecibo,
        liquidado: r.prestamoLiquidado,
      })),
    });
  } catch (e) {
    await conn.rollback().catch(() => {});
    if (e.codigo) return res.status(e.codigo).json({ message: e.message });
    console.error("ERROR EN PAGO RÁPIDO:", e);
    res.status(500).json({ message: "No se pudo registrar el pago" });
  } finally {
    conn.release();
  }
});

// GET /api/pagos-ampliados/conciliacion?estado=pendiente|conciliado|todos&desde=&hasta=&search=
// Pagos por depósito, transferencia o cheque, o con número de boleta
router.get("/conciliacion", async (req, res) => {
  try {
    const w = ["(p.metodo_pago IN ('deposito','transferencia','cheque','Depósito','Transferencia','Cheque') OR p.numero_boleta IS NOT NULL)"];
    const params = [];
    if (req.query.estado === "conciliado") w.push("p.conciliado = 1");
    else if (req.query.estado !== "todos") w.push("p.conciliado = 0");
    if (esFecha(req.query.desde)) {
      w.push("DATE(p.fecha_pago) >= ?");
      params.push(req.query.desde);
    }
    if (esFecha(req.query.hasta)) {
      w.push("DATE(p.fecha_pago) <= ?");
      params.push(req.query.hasta);
    }
    if (req.query.search) {
      w.push("(p.numero_boleta LIKE ? OR u.nombre_completo LIKE ? OR u.dni LIKE ?)");
      const t = `%${req.query.search}%`;
      params.push(t, t, t);
    }
    const suc = await filtroSocio(req, "u");
    const [filas] = await pool.query(
      `SELECT p.id_pago, p.id_prestamo, p.fecha_pago, p.monto_pagado, p.otros_cargos, p.metodo_pago, p.numero_boleta, p.lugar_pago,
              p.conciliado, p.conciliado_en, c.nombre_completo AS conciliado_por_nombre,
              u.nombre_completo, u.dni, u.numero_socio
       FROM pagos_prestamo p
       JOIN prestamos pr ON pr.id_prestamo = p.id_prestamo
       JOIN usuarios u ON u.id_usuario = pr.id_usuario
       LEFT JOIN usuarios c ON c.id_usuario = p.conciliado_por
       WHERE ${w.join(" AND ")}${suc.sql}
       ORDER BY p.fecha_pago DESC, p.id_pago DESC
       LIMIT 1000`,
      [...params, ...suc.params]
    );
    const datos = filas.map((f) => ({ ...f, monto_pagado: num(f.monto_pagado), otros_cargos: num(f.otros_cargos), conciliado: !!f.conciliado }));
    res.json({
      success: true,
      data: datos,
      total: datos.reduce((t, f) => t + f.monto_pagado + f.otros_cargos, 0),
    });
  } catch (e) {
    console.error("ERROR EN CONCILIACIÓN:", e);
    res.status(500).json({ message: "No se pudieron leer los pagos" });
  }
});

// PUT /api/pagos-ampliados/conciliacion  { ids: [id_pago...], conciliado: true|false }
router.put("/conciliacion", async (req, res) => {
  try {
    const ids = [...new Set((req.body?.ids || []).map((x) => parseInt(x)).filter(Boolean))];
    if (!ids.length) return res.status(400).json({ message: "Elige al menos un pago." });
    const si = req.body?.conciliado !== false;
    const [r] = await pool.query(
      `UPDATE pagos_prestamo SET conciliado = ?, conciliado_por = ?, conciliado_en = ${si ? "NOW()" : "NULL"} WHERE id_pago IN (?)`,
      [si ? 1 : 0, si ? req.usuario.id_usuario : null, ids]
    );
    await pool.query("INSERT INTO bitacora (id_usuario, accion, detalle, fecha) VALUES (?, ?, ?, NOW())", [
      req.usuario.id_usuario,
      "Conciliación de pagos",
      `${r.affectedRows} pago(s) marcados como ${si ? "conciliados" : "pendientes"}: ${ids.slice(0, 30).join(", ")}`,
    ]);
    res.json({ success: true, message: `${r.affectedRows} pago(s) ${si ? "conciliados" : "devueltos a pendiente"}.` });
  } catch (e) {
    console.error("ERROR AL CONCILIAR:", e);
    res.status(500).json({ message: "No se pudo conciliar" });
  }
});

module.exports = router;
