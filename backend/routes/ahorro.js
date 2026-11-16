// Ahorro: productos de ahorro, intereses del mes y depósitos a plazo fijo.
const express = require("express");
const router = express.Router();
const pool = require("../db");
const { hoyISO } = require("../utils/fechas");
const { dinero } = require("../utils/pais");
const { registrarCaja, normalizarMetodo } = require("../utils/caja");
const { crearRecibo } = require("../utils/recibos");
const { contabilizar, conSalvaguarda } = require("../utils/contabilidad");
const { previaIntereses, liquidarIntereses, liquidacionPlazo, sumarDias } = require("../utils/ahorro");

const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const num = (v) => parseFloat(v || 0);
const esSocio = (req) => req.usuario?.rol === "Socio";
const soloSuperAdmin = (req, res, next) =>
  req.usuario?.rol === "Super Administrador" ? next() : res.status(403).json({ message: "Solo el Super Administrador puede hacer esto." });
const soloPersonal = (req, res, next) => (esSocio(req) ? res.status(403).json({ message: "No tienes permiso para realizar esta acción." }) : next());

// ── Productos de ahorro ────────────────────────────────────────────────────
const productoDesde = (b, actual = {}) => {
  const v = { ...actual, ...b };
  const datos = {
    nombre: String(v.nombre || "").trim().substring(0, 60),
    descripcion: String(v.descripcion || "").trim().substring(0, 300) || null,
    clase: ["ahorro", "plazo_fijo"].includes(v.clase) || actual.clase === "aportacion" ? v.clase : "ahorro",
    tasa_anual: num(v.tasa_anual),
    saldo_minimo: num(v.saldo_minimo),
    permite_retiros: v.permite_retiros === false || v.permite_retiros === 0 ? 0 : 1,
    apertura_automatica: v.apertura_automatica ? 1 : 0,
    monto_min: num(v.monto_min),
    plazo_min_dias: parseInt(v.plazo_min_dias) || 30,
    plazo_max_dias: parseInt(v.plazo_max_dias) || 1825,
    penalizacion_pct: v.penalizacion_pct === undefined || v.penalizacion_pct === "" ? 50 : num(v.penalizacion_pct),
    activo: v.activo === false || v.activo === 0 ? 0 : 1,
    orden: parseInt(v.orden) || 0,
  };
  // La clase "aportación" (capital social) es una sola y no se cambia
  if (actual.clase === "aportacion") datos.clase = "aportacion";
  if (datos.nombre.length < 3) return { error: "Escribe el nombre del producto." };
  if (!(datos.tasa_anual >= 0 && datos.tasa_anual <= 50)) return { error: "La tasa anual debe estar entre 0 y 50%." };
  if (!(datos.saldo_minimo >= 0)) return { error: "El saldo mínimo no es válido." };
  if (!(datos.penalizacion_pct >= 0 && datos.penalizacion_pct <= 100)) return { error: "La penalización va de 0 a 100% del interés." };
  if (datos.plazo_min_dias < 1 || datos.plazo_max_dias < datos.plazo_min_dias) return { error: "Revisa los plazos del producto." };
  return { datos };
};

router.get("/productos", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT p.*, (SELECT COUNT(*) FROM cuentas c WHERE (p.id_producto_ahorro = c.id_producto_ahorro OR (c.id_producto_ahorro IS NULL AND p.nombre = c.tipo_cuenta COLLATE utf8mb4_unicode_ci)) AND c.estado = 'activa') AS cuentas,
              (SELECT IFNULL(SUM(saldo_actual), 0) FROM cuentas c WHERE (p.id_producto_ahorro = c.id_producto_ahorro OR (c.id_producto_ahorro IS NULL AND p.nombre = c.tipo_cuenta COLLATE utf8mb4_unicode_ci))) AS saldo,
              (SELECT COUNT(*) FROM depositos_plazo d WHERE d.id_producto_ahorro = p.id_producto_ahorro AND d.estado = 'vigente') AS plazos_vigentes
       FROM productos_ahorro p ORDER BY p.orden, p.nombre`
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error("ERROR PRODUCTOS DE AHORRO:", error);
    res.status(500).json({ message: "No se pudieron cargar los productos de ahorro" });
  }
});

router.post("/productos", soloSuperAdmin, async (req, res) => {
  try {
    const { error, datos } = productoDesde(req.body);
    if (error) return res.status(400).json({ message: error });
    const [r] = await pool.query("INSERT INTO productos_ahorro SET ?", [datos]);
    res.status(201).json({ success: true, id_producto_ahorro: r.insertId });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") return res.status(409).json({ message: "Ya existe un producto con ese nombre." });
    res.status(500).json({ message: "No se pudo crear el producto" });
  }
});

// Cambiar la tasa aplica desde el mes siguiente (los meses ya acreditados no cambian)
router.put("/productos/:id", soloSuperAdmin, async (req, res) => {
  try {
    const [[actual]] = await pool.query("SELECT * FROM productos_ahorro WHERE id_producto_ahorro = ?", [req.params.id]);
    if (!actual) return res.status(404).json({ message: "Producto no encontrado" });
    const { error, datos } = productoDesde(req.body, actual);
    if (error) return res.status(400).json({ message: error });
    if (datos.nombre !== actual.nombre) {
      return res.status(400).json({ message: "El nombre no se cambia: las cuentas existentes lo usan. Crea un producto nuevo si lo necesitas." });
    }
    await pool.query("UPDATE productos_ahorro SET ? WHERE id_producto_ahorro = ?", [datos, actual.id_producto_ahorro]);
    await pool.query(`INSERT INTO bitacora (id_usuario, accion, detalle, fecha) VALUES (?, ?, ?, NOW())`, [
      req.usuario.id_usuario,
      "Producto de ahorro modificado",
      `${datos.nombre}: ${datos.tasa_anual}% anual${datos.activo ? "" : " (desactivado)"}`,
    ]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: "No se pudo modificar el producto" });
  }
});

// ── Intereses ───────────────────────────────────────────────────────────────
const mesDe = (q) => {
  const anio = parseInt(q.anio);
  const mes = parseInt(q.mes);
  return anio > 2000 && mes >= 1 && mes <= 12 ? { anio, mes } : null;
};

router.get("/intereses/previa", soloPersonal, async (req, res) => {
  try {
    const m = mesDe(req.query);
    if (!m) return res.status(400).json({ message: "Indica el año y el mes." });
    const filas = await previaIntereses(m.anio, m.mes);
    res.json({
      success: true,
      ...m,
      data: filas,
      total_neto: r2(filas.filter((f) => !f.ya_acreditado).reduce((t, f) => t + f.interes_neto, 0)),
    });
  } catch (error) {
    console.error("ERROR PREVIA INTERESES:", error);
    res.status(500).json({ message: "No se pudo calcular los intereses" });
  }
});

router.post("/intereses/liquidar", soloSuperAdmin, async (req, res) => {
  try {
    const m = mesDe(req.body);
    if (!m) return res.status(400).json({ message: "Indica el año y el mes." });
    const r = await liquidarIntereses(m.anio, m.mes, req.usuario.id_usuario);
    res.json({ success: true, ...r, message: r.cuentas ? `Intereses acreditados a ${r.cuentas} cuenta(s): ${dinero(r.total)}.` : "No había intereses pendientes de ese mes." });
  } catch (error) {
    if (error.codigo) return res.status(error.codigo).json({ message: error.message });
    console.error("ERROR LIQUIDAR INTERESES:", error);
    res.status(500).json({ message: "No se pudieron acreditar los intereses" });
  }
});

router.get("/intereses/historial", soloPersonal, async (req, res) => {
  const [rows] = await pool.query(
    `SELECT anio, mes, COUNT(*) AS cuentas, SUM(interes_bruto) AS bruto, SUM(retencion) AS retencion, SUM(interes_neto) AS neto, MAX(acreditado_en) AS acreditado_en
     FROM intereses_ahorro GROUP BY anio, mes ORDER BY anio DESC, mes DESC LIMIT 36`
  );
  res.json({ success: true, data: rows });
});

// ── Depósitos a plazo fijo ──────────────────────────────────────────────────
const listarPlazos = async (where, params) => {
  const [rows] = await pool.query(
    `SELECT d.*, p.nombre AS producto, u.nombre_completo AS socio, u.numero_socio
     FROM depositos_plazo d
     INNER JOIN productos_ahorro p ON p.id_producto_ahorro = d.id_producto_ahorro
     INNER JOIN usuarios u ON u.id_usuario = d.id_usuario
     ${where} ORDER BY d.estado = 'vigente' DESC, d.fecha_vencimiento, d.id_deposito DESC`,
    params
  );
  const hoy = hoyISO();
  return rows.map((d) => ({ ...d, liquidacion_hoy: d.estado === "vigente" ? liquidacionPlazo(d, hoy) : null }));
};

router.get("/plazos", soloPersonal, async (req, res) => {
  try {
    const where = [];
    const params = [];
    if (req.query.estado) {
      where.push("d.estado = ?");
      params.push(req.query.estado);
    }
    if (req.query.id_usuario) {
      where.push("d.id_usuario = ?");
      params.push(req.query.id_usuario);
    }
    res.json({ success: true, data: await listarPlazos(where.length ? `WHERE ${where.join(" AND ")}` : "", params) });
  } catch (error) {
    console.error("ERROR PLAZOS:", error);
    res.status(500).json({ message: "No se pudieron cargar los depósitos a plazo" });
  }
});

// Los del socio que inició sesión
router.get("/plazos/mios", async (req, res) => {
  try {
    res.json({ success: true, data: await listarPlazos("WHERE d.id_usuario = ?", [req.usuario.id_usuario]) });
  } catch (error) {
    res.status(500).json({ message: "No se pudieron cargar tus depósitos a plazo" });
  }
});

// Abrir un depósito: el socio entrega el dinero en caja, por banco o desde su cuenta de ahorro
router.post("/plazos", soloPersonal, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const idUsuario = parseInt(req.body.id_usuario);
    const monto = r2(num(req.body.monto));
    const plazoDias = parseInt(req.body.plazo_dias);
    const origen = req.body.origen === "cuenta" ? "cuenta" : normalizarMetodo(req.body.origen);
    const [[prod]] = await conn.query(
      "SELECT * FROM productos_ahorro WHERE id_producto_ahorro = ? AND clase = 'plazo_fijo' AND activo = 1",
      [req.body.id_producto_ahorro]
    );
    if (!prod) return res.status(400).json({ message: "Elige un producto de plazo fijo activo." });
    const [[socio]] = await conn.query("SELECT id_usuario, nombre_completo FROM usuarios WHERE id_usuario = ? AND estado = 'activo'", [idUsuario]);
    if (!socio) return res.status(400).json({ message: "Socio no encontrado o inactivo." });
    if (!(monto > 0) || monto < num(prod.monto_min)) return res.status(400).json({ message: `El monto mínimo es ${dinero(prod.monto_min)}.` });
    if (!(plazoDias >= prod.plazo_min_dias && plazoDias <= prod.plazo_max_dias)) {
      return res.status(400).json({ message: `El plazo va de ${prod.plazo_min_dias} a ${prod.plazo_max_dias} días.` });
    }

    await conn.beginTransaction();
    const hoy = hoyISO();
    const [r] = await conn.query(
      `INSERT INTO depositos_plazo (id_usuario, id_producto_ahorro, monto, tasa_anual, plazo_dias, penalizacion_pct, fecha_inicio, fecha_vencimiento, origen, creado_por)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [idUsuario, prod.id_producto_ahorro, monto, prod.tasa_anual, plazoDias, prod.penalizacion_pct, hoy, sumarDias(hoy, plazoDias), origen, req.usuario.id_usuario]
    );
    const concepto = `Depósito a plazo fijo #${r.insertId} (${prod.nombre}, ${plazoDias} días al ${num(prod.tasa_anual)}% anual)`;

    if (origen === "cuenta") {
      // Sale de su cuenta de ahorro (la que indique)
      const [[c]] = await conn.query(
        `SELECT c.*, p.permite_retiros, p.saldo_minimo FROM cuentas c LEFT JOIN productos_ahorro p ON (p.id_producto_ahorro = c.id_producto_ahorro OR (c.id_producto_ahorro IS NULL AND p.nombre = c.tipo_cuenta COLLATE utf8mb4_unicode_ci))
         WHERE c.id_cuenta = ? AND c.id_usuario = ? AND c.estado = 'activa' FOR UPDATE`,
        [req.body.id_cuenta, idUsuario]
      );
      if (!c) throw Object.assign(new Error("Elige una cuenta activa del socio."), { codigo: 400 });
      if (c.permite_retiros === 0) throw Object.assign(new Error(`La cuenta ${c.tipo_cuenta} no permite retiros.`), { codigo: 400 });
      if (num(c.saldo_actual) - monto < num(c.saldo_minimo)) throw Object.assign(new Error("Saldo insuficiente en la cuenta."), { codigo: 400 });
      const nuevo = r2(num(c.saldo_actual) - monto);
      await conn.query("UPDATE cuentas SET saldo_actual = ? WHERE id_cuenta = ?", [nuevo, c.id_cuenta]);
      await conn.query(
        `INSERT INTO movimientos_cuenta (id_cuenta, tipo_movimiento, monto, saldo_anterior, saldo_nuevo, descripcion, fecha) VALUES (?, 'retiro', ?, ?, ?, ?, NOW())`,
        [c.id_cuenta, monto, num(c.saldo_actual), nuevo, concepto]
      );
      await conSalvaguarda(conn, { concepto, origen: "plazo_fijo", origen_id: r.insertId }, () =>
        contabilizar(conn, "apertura_plazo", { monto, metodo: "cuenta", tipo_cuenta: c.tipo_cuenta }, { concepto, origen: "plazo_fijo", origen_id: r.insertId, creada_por: req.usuario.id_usuario })
      );
    } else {
      await registrarCaja(conn, {
        tipo: "ingreso",
        categoria: "apertura_plazo",
        monto,
        metodo: origen,
        descripcion: concepto,
        referencia_tipo: "plazo_fijo",
        referencia_id: r.insertId,
        id_socio: idUsuario,
        id_registrado_por: req.usuario.id_usuario,
      });
    }
    const idRecibo = await crearRecibo(conn, {
      tipo: "plazo_fijo",
      referencia_tipo: "plazo_fijo",
      referencia_id: r.insertId,
      id_socio: idUsuario,
      monto,
      metodo: origen === "cuenta" ? "cuenta" : origen,
      concepto,
      detalle: { plazo_dias: plazoDias, tasa_anual: num(prod.tasa_anual), vence: sumarDias(hoy, plazoDias) },
      emitido_por: req.usuario.id_usuario,
    });
    await conn.query(`INSERT INTO bitacora (id_usuario, accion, detalle, fecha) VALUES (?, ?, ?, NOW())`, [idUsuario, "Depósito a plazo fijo", `${concepto}: ${dinero(monto)}`]);
    await conn.commit();
    res.status(201).json({ success: true, id_deposito: r.insertId, id_recibo: idRecibo, fecha_vencimiento: sumarDias(hoy, plazoDias) });
  } catch (error) {
    await conn.rollback().catch(() => {});
    if (error.codigo) return res.status(error.codigo).json({ message: error.message });
    console.error("ERROR AL ABRIR PLAZO FIJO:", error);
    res.status(500).json({ message: "No se pudo registrar el depósito a plazo" });
  } finally {
    conn.release();
  }
});

// Pagar (al vencimiento) o cancelar antes (con penalización): capital + interés − retención
router.post("/plazos/:id/pagar", soloPersonal, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [[d]] = await conn.query("SELECT * FROM depositos_plazo WHERE id_deposito = ? FOR UPDATE", [req.params.id]);
    if (!d) throw Object.assign(new Error("Depósito no encontrado"), { codigo: 404 });
    if (d.estado !== "vigente") throw Object.assign(new Error("Ese depósito ya se pagó."), { codigo: 400 });
    const l = liquidacionPlazo(d);
    if (l.anticipado && req.body.confirmar_anticipado !== true) {
      throw Object.assign(new Error("El depósito aún no vence: confirma la cancelación anticipada (se aplica la penalización)."), { codigo: 409 });
    }
    const destino = req.body.destino === "cuenta" ? "cuenta" : normalizarMetodo(req.body.destino);
    const concepto = `${l.anticipado ? "Cancelación anticipada" : "Pago"} del depósito a plazo #${d.id_deposito}`;
    const contable = { capital: l.capital, interes: l.interes, retencion: l.retencion };

    if (destino === "cuenta") {
      const [[c]] = await conn.query("SELECT * FROM cuentas WHERE id_cuenta = ? AND id_usuario = ? AND estado = 'activa' FOR UPDATE", [req.body.id_cuenta, d.id_usuario]);
      if (!c) throw Object.assign(new Error("Elige una cuenta activa del socio."), { codigo: 400 });
      const nuevo = r2(num(c.saldo_actual) + l.total);
      await conn.query("UPDATE cuentas SET saldo_actual = ? WHERE id_cuenta = ?", [nuevo, c.id_cuenta]);
      await conn.query(
        `INSERT INTO movimientos_cuenta (id_cuenta, tipo_movimiento, monto, saldo_anterior, saldo_nuevo, descripcion, fecha) VALUES (?, 'deposito', ?, ?, ?, ?, NOW())`,
        [c.id_cuenta, l.total, num(c.saldo_actual), nuevo, concepto]
      );
      await conSalvaguarda(conn, { concepto, origen: "plazo_fijo", origen_id: d.id_deposito }, () =>
        contabilizar(conn, "pago_plazo", { ...contable, metodo: "cuenta", tipo_cuenta: c.tipo_cuenta }, { concepto, origen: "plazo_fijo", origen_id: d.id_deposito, creada_por: req.usuario.id_usuario })
      );
    } else {
      await registrarCaja(conn, {
        tipo: "egreso",
        categoria: "pago_plazo",
        monto: l.total,
        metodo: destino,
        descripcion: concepto,
        referencia_tipo: "plazo_fijo",
        referencia_id: d.id_deposito,
        id_socio: d.id_usuario,
        id_registrado_por: req.usuario.id_usuario,
        contable,
      });
    }
    await conn.query(
      `UPDATE depositos_plazo SET estado = ?, interes_pagado = ?, retencion = ?, pagado_en = NOW(), destino_pago = ? WHERE id_deposito = ?`,
      [l.anticipado ? "cancelado" : "pagado", l.interes, l.retencion, destino, d.id_deposito]
    );
    const idRecibo = await crearRecibo(conn, {
      tipo: "pago_plazo",
      referencia_tipo: "plazo_fijo",
      referencia_id: d.id_deposito,
      id_socio: d.id_usuario,
      monto: l.total,
      metodo: destino,
      concepto,
      detalle: { capital: l.capital, interes: l.interes, retencion: l.retencion, penalizacion: l.penalizacion, dias: l.dias },
      emitido_por: req.usuario.id_usuario,
    });
    await conn.query(`INSERT INTO bitacora (id_usuario, accion, detalle, fecha) VALUES (?, ?, ?, NOW())`, [
      d.id_usuario,
      "Depósito a plazo pagado",
      `${concepto}: capital ${dinero(l.capital)}, interés ${dinero(l.interes)}${l.penalizacion ? ` (penalización ${dinero(l.penalizacion)})` : ""}`,
    ]);
    await conn.commit();
    res.json({ success: true, ...l, id_recibo: idRecibo });
  } catch (error) {
    await conn.rollback().catch(() => {});
    if (error.codigo) return res.status(error.codigo).json({ message: error.message });
    console.error("ERROR AL PAGAR PLAZO FIJO:", error);
    res.status(500).json({ message: "No se pudo pagar el depósito" });
  } finally {
    conn.release();
  }
});

module.exports = router;
