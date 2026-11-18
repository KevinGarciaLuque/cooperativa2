// Descuento por planilla (función "descuento_planilla"): empresas con convenio, préstamos que
// se cobran descontando la cuota del salario, la planilla del mes para la empresa (Excel) y el
// pago que manda la empresa, aplicado a todos los préstamos en un solo paso (todo o nada).
// Módulo de permisos: pagos. Aplicar el pago es la acción "pagos.registrar".
const express = require("express");
const router = express.Router();
const ExcelJS = require("exceljs");
const pool = require("../db");
const { habilitada } = require("../utils/funciones");
const { cuotaDelPrestamo } = require("../utils/planPagos");
const { crearNotificacion } = require("../utils/notificaciones");
const { dinero, obtener: paisActual } = require("../utils/pais");
const { procesarPago, FalloPago } = require("./pagos");

const num = (v) => parseFloat(v || 0);
const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const txt = (v, max) => (String(v ?? "").trim() ? String(v).trim().substring(0, max) : null);
const METODOS = ["transferencia", "cheque", "deposito", "efectivo"];

router.use(async (req, res, next) => {
  if (req.usuario?.rol === "Socio") return res.status(403).json({ message: "Solo para el personal." });
  if (await habilitada("descuento_planilla", req.usuario)) return next();
  res.status(403).json({ message: "El descuento por planilla no está habilitado." });
});

// Lo que se descuenta en el mes: la cuota llevada a un mes (semanal ×52/12, quincenal ×2),
// sin pasar de lo que debe (saldo más un mes de interés)
const descuentoMensual = (p) => {
  const factor = p.frecuencia_pago === "semanal" ? 52 / 12 : p.frecuencia_pago === "quincenal" ? 2 : 1;
  const cuota = r2(cuotaDelPrestamo(p) * factor);
  const tope = r2(num(p.saldo_restante) * (1 + num(p.tasa_interes) / 100 / 12));
  return Math.min(cuota, tope);
};

const fallo = (res, e, msg) => {
  if (e instanceof FalloPago) return res.status(e.codigo).json(e.cuerpo);
  if (e.codigo) return res.status(e.codigo).json({ message: e.message });
  console.error(msg, e);
  res.status(500).json({ message: msg });
};
const error = (codigo, message) => Object.assign(new Error(message), { codigo });

// ── Empresas ────────────────────────────────────────────────────────────────
router.get("/empresas", async (req, res) => {
  try {
    const [filas] = await pool.query(
      `SELECT e.*,
              (SELECT COUNT(*) FROM prestamos p WHERE p.id_empresa_planilla = e.id_empresa AND p.estado IN ('activo','mora')) AS prestamos,
              (SELECT IFNULL(SUM(p.saldo_restante), 0) FROM prestamos p WHERE p.id_empresa_planilla = e.id_empresa AND p.estado IN ('activo','mora')) AS saldo
       FROM empresas_convenio e ORDER BY e.activa DESC, e.nombre`
    );
    res.json({ success: true, data: filas.map((f) => ({ ...f, saldo: num(f.saldo), activa: !!f.activa })) });
  } catch (e) {
    fallo(res, e, "No se pudieron cargar las empresas");
  }
});

const datosEmpresa = (b) => {
  const nombre = txt(b?.nombre, 150);
  if (!nombre) throw error(400, "Escribe el nombre de la empresa.");
  const dia = b?.dia_corte === "" || b?.dia_corte == null ? null : parseInt(b.dia_corte);
  if (dia !== null && !(dia >= 1 && dia <= 31)) throw error(400, "El día de corte va del 1 al 31.");
  return [nombre, txt(b.contacto, 120), txt(b.telefono, 30), txt(b.correo, 120), dia];
};

router.post("/empresas", async (req, res) => {
  try {
    const [r] = await pool.query(
      "INSERT INTO empresas_convenio (nombre, contacto, telefono, correo, dia_corte) VALUES (?, ?, ?, ?, ?)",
      datosEmpresa(req.body)
    );
    res.status(201).json({ success: true, id_empresa: r.insertId, message: "Empresa registrada." });
  } catch (e) {
    fallo(res, e, "No se pudo registrar la empresa");
  }
});

router.put("/empresas/:id", async (req, res) => {
  try {
    const d = datosEmpresa(req.body);
    const [r] = await pool.query(
      "UPDATE empresas_convenio SET nombre = ?, contacto = ?, telefono = ?, correo = ?, dia_corte = ?, activa = ? WHERE id_empresa = ?",
      [...d, req.body.activa === false ? 0 : 1, parseInt(req.params.id)]
    );
    if (!r.affectedRows) return res.status(404).json({ message: "Empresa no encontrada." });
    res.json({ success: true, message: "Empresa actualizada." });
  } catch (e) {
    fallo(res, e, "No se pudo actualizar la empresa");
  }
});

// Préstamos de la empresa con lo que se descuenta cada mes
router.get("/empresas/:id/prestamos", async (req, res) => {
  try {
    const [filas] = await pool.query(
      `SELECT p.*, u.nombre_completo, u.dni, u.numero_socio
       FROM prestamos p JOIN usuarios u ON u.id_usuario = p.id_usuario
       WHERE p.id_empresa_planilla = ? AND p.estado IN ('activo','mora') ORDER BY u.nombre_completo`,
      [parseInt(req.params.id)]
    );
    res.json({
      success: true,
      data: filas.map((p) => ({
        id_prestamo: p.id_prestamo, id_usuario: p.id_usuario, nombre_completo: p.nombre_completo, dni: p.dni,
        numero_socio: p.numero_socio, monto: num(p.monto), saldo_restante: num(p.saldo_restante), estado: p.estado,
        frecuencia_pago: p.frecuencia_pago, descuento_mensual: descuentoMensual(p),
      })),
    });
  } catch (e) {
    fallo(res, e, "No se pudieron cargar los préstamos de la empresa");
  }
});

// Préstamos vigentes que todavía no se cobran por planilla (para ligarlos)
router.get("/prestamos-disponibles", async (req, res) => {
  try {
    const q = `%${String(req.query.buscar || "").trim()}%`;
    const [filas] = await pool.query(
      `SELECT p.id_prestamo, p.saldo_restante, u.nombre_completo, u.dni
       FROM prestamos p JOIN usuarios u ON u.id_usuario = p.id_usuario
       WHERE p.estado IN ('activo','mora') AND p.id_empresa_planilla IS NULL
         AND (u.nombre_completo LIKE ? OR u.dni LIKE ? OR CAST(p.id_prestamo AS CHAR) LIKE ?)
       ORDER BY u.nombre_completo LIMIT 30`,
      [q, q, q]
    );
    res.json({ success: true, data: filas.map((f) => ({ ...f, saldo_restante: num(f.saldo_restante) })) });
  } catch (e) {
    fallo(res, e, "No se pudieron buscar los préstamos");
  }
});

router.post("/empresas/:id/prestamos", async (req, res) => {
  try {
    const [[emp]] = await pool.query("SELECT activa FROM empresas_convenio WHERE id_empresa = ?", [parseInt(req.params.id)]);
    if (!emp) return res.status(404).json({ message: "Empresa no encontrada." });
    if (!emp.activa) return res.status(400).json({ message: "La empresa no está activa." });
    const [r] = await pool.query(
      "UPDATE prestamos SET id_empresa_planilla = ? WHERE id_prestamo = ? AND estado IN ('activo','mora') AND id_empresa_planilla IS NULL",
      [parseInt(req.params.id), parseInt(req.body?.id_prestamo) || 0]
    );
    if (!r.affectedRows) return res.status(400).json({ message: "El préstamo no está vigente o ya se cobra por planilla." });
    res.json({ success: true, message: "Préstamo agregado a la planilla." });
  } catch (e) {
    fallo(res, e, "No se pudo agregar el préstamo");
  }
});

router.delete("/prestamos/:id", async (req, res) => {
  try {
    await pool.query("UPDATE prestamos SET id_empresa_planilla = NULL WHERE id_prestamo = ?", [parseInt(req.params.id)]);
    res.json({ success: true, message: "El préstamo ya no se cobra por planilla." });
  } catch (e) {
    fallo(res, e, "No se pudo quitar el préstamo");
  }
});

// ── Planillas (lotes) ──────────────────────────────────────────────────────
router.get("/lotes", async (req, res) => {
  try {
    const idEmp = parseInt(req.query.id_empresa) || null;
    const [filas] = await pool.query(
      `SELECT l.*, e.nombre AS empresa, (SELECT COUNT(*) FROM planilla_detalle d WHERE d.id_lote = l.id_lote) AS prestamos
       FROM planilla_lotes l JOIN empresas_convenio e ON e.id_empresa = l.id_empresa
       ${idEmp ? "WHERE l.id_empresa = ?" : ""} ORDER BY l.periodo DESC, l.id_lote DESC LIMIT 100`,
      idEmp ? [idEmp] : []
    );
    res.json({ success: true, data: filas.map((l) => ({ ...l, total_esperado: num(l.total_esperado), total_recibido: l.total_recibido === null ? null : num(l.total_recibido) })) });
  } catch (e) {
    fallo(res, e, "No se pudieron cargar las planillas");
  }
});

// POST /api/planillas/lotes { id_empresa, periodo: "YYYY-MM" } → la planilla del mes
router.post("/lotes", async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const idEmp = parseInt(req.body?.id_empresa) || 0;
    const periodo = String(req.body?.periodo || "");
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(periodo)) throw error(400, "Indica el mes de la planilla.");
    await conn.beginTransaction();
    const [[emp]] = await conn.query("SELECT * FROM empresas_convenio WHERE id_empresa = ? FOR UPDATE", [idEmp]);
    if (!emp) throw error(404, "Empresa no encontrada.");
    const [[ya]] = await conn.query("SELECT id_lote FROM planilla_lotes WHERE id_empresa = ? AND periodo = ? AND estado <> 'anulada'", [idEmp, periodo]);
    if (ya) throw error(409, `Ya existe la planilla de ${periodo} para esta empresa.`);
    const [prestamos] = await conn.query("SELECT * FROM prestamos WHERE id_empresa_planilla = ? AND estado IN ('activo','mora')", [idEmp]);
    if (!prestamos.length) throw error(400, "La empresa no tiene préstamos vigentes para descontar.");
    const filas = prestamos.map((p) => [p.id_prestamo, p.id_usuario, descuentoMensual(p)]);
    const total = r2(filas.reduce((t, f) => t + f[2], 0));
    const [l] = await conn.query("INSERT INTO planilla_lotes (id_empresa, periodo, total_esperado, creado_por) VALUES (?, ?, ?, ?)", [
      idEmp, periodo, total, req.usuario.id_usuario,
    ]);
    await conn.query("INSERT INTO planilla_detalle (id_lote, id_prestamo, id_usuario, monto_esperado) VALUES ?", [filas.map((f) => [l.insertId, ...f])]);
    await conn.commit();
    res.status(201).json({ success: true, id_lote: l.insertId, message: `Planilla de ${periodo} generada: ${filas.length} préstamos, ${dinero(total)}.` });
  } catch (e) {
    await conn.rollback().catch(() => {});
    fallo(res, e, "No se pudo generar la planilla");
  } finally {
    conn.release();
  }
});

const leerLote = async (id, conn = pool) => {
  const [[l]] = await conn.query(
    `SELECT l.*, e.nombre AS empresa, e.contacto, e.correo FROM planilla_lotes l
     JOIN empresas_convenio e ON e.id_empresa = l.id_empresa WHERE l.id_lote = ?`,
    [id]
  );
  if (!l) return null;
  const [detalle] = await conn.query(
    `SELECT d.*, u.nombre_completo, u.dni, u.numero_socio, p.saldo_restante
     FROM planilla_detalle d JOIN usuarios u ON u.id_usuario = d.id_usuario JOIN prestamos p ON p.id_prestamo = d.id_prestamo
     WHERE d.id_lote = ? ORDER BY u.nombre_completo`,
    [id]
  );
  return {
    ...l,
    total_esperado: num(l.total_esperado),
    total_recibido: l.total_recibido === null ? null : num(l.total_recibido),
    detalle: detalle.map((d) => ({
      ...d,
      monto_esperado: num(d.monto_esperado),
      monto_recibido: d.monto_recibido === null ? null : num(d.monto_recibido),
      saldo_restante: num(d.saldo_restante),
    })),
  };
};

router.get("/lotes/:id", async (req, res) => {
  try {
    const l = await leerLote(parseInt(req.params.id));
    if (!l) return res.status(404).json({ message: "Planilla no encontrada." });
    res.json({ success: true, data: l });
  } catch (e) {
    fallo(res, e, "No se pudo cargar la planilla");
  }
});

// Excel para la empresa: a quién descontar y cuánto
router.get("/lotes/:id/excel", async (req, res) => {
  try {
    const l = await leerLote(parseInt(req.params.id));
    if (!l) return res.status(404).json({ message: "Planilla no encontrada." });
    const [[sitio]] = await pool.query("SELECT valor FROM configuracion_sitio WHERE clave = 'site_name'");
    const libro = new ExcelJS.Workbook();
    const ws = libro.addWorksheet("Planilla");
    ws.addRow([sitio?.valor || "Cooperativa"]).font = { size: 14, bold: true };
    ws.addRow([`Descuento por planilla · ${l.empresa} · ${l.periodo}`]).font = { size: 12, bold: true };
    ws.addRow([`Moneda: ${paisActual().moneda.iso}. Descuente a cada empleado el monto indicado y envíe el total a la cooperativa.`]).font = { size: 10, color: { argb: "FF666666" } };
    ws.addRow([]);
    const cab = ws.addRow(["#", "Empleado", "Identidad", "N.º socio", "Préstamo", "Monto a descontar", "Monto descontado", "Observaciones"]);
    cab.font = { bold: true };
    cab.eachCell((c) => (c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } }));
    l.detalle.forEach((d, i) =>
      ws.addRow([i + 1, d.nombre_completo, d.dni, d.numero_socio || "", `#${d.id_prestamo}`, d.monto_esperado, d.monto_recibido ?? "", d.nota || ""])
    );
    const tot = ws.addRow(["", "TOTAL", "", "", "", l.total_esperado, l.total_recibido ?? ""]);
    tot.font = { bold: true };
    [6, 7].forEach((c) => (ws.getColumn(c).numFmt = "#,##0.00"));
    [5, 36, 18, 12, 12, 18, 18, 30].forEach((w, i) => (ws.getColumn(i + 1).width = w));
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="planilla_${l.periodo}_${l.id_empresa}.xlsx"`);
    await libro.xlsx.write(res);
    res.end();
  } catch (e) {
    if (!res.headersSent) fallo(res, e, "No se pudo generar el Excel");
  }
});

// POST /api/planillas/lotes/:id/aplicar
//   { metodo, referencia, detalle: [{ id_detalle, monto_recibido, nota }] }
// Aplica cada monto como un pago normal (interés, mora, recibo). Si uno falla, no se aplica ninguno.
router.post("/lotes/:id/aplicar", async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const metodo = String(req.body?.metodo || "transferencia").toLowerCase();
    if (!METODOS.includes(metodo)) throw error(400, "Método de pago no válido.");
    const referencia = txt(req.body?.referencia, 80);
    const cambios = new Map((Array.isArray(req.body?.detalle) ? req.body.detalle : []).map((d) => [parseInt(d.id_detalle), d]));

    await conn.beginTransaction();
    const [[l]] = await conn.query("SELECT * FROM planilla_lotes WHERE id_lote = ? FOR UPDATE", [parseInt(req.params.id)]);
    if (!l) throw error(404, "Planilla no encontrada.");
    if (l.estado !== "generada") throw error(400, `La planilla ya está ${l.estado}.`);
    const [[emp]] = await conn.query("SELECT nombre FROM empresas_convenio WHERE id_empresa = ?", [l.id_empresa]);
    const [detalle] = await conn.query("SELECT * FROM planilla_detalle WHERE id_lote = ?", [l.id_lote]);

    let total = 0;
    const aplicados = [];
    for (const d of detalle) {
      const c = cambios.get(d.id_detalle);
      const monto = r2(c && c.monto_recibido !== undefined && c.monto_recibido !== "" ? num(c.monto_recibido) : num(d.monto_esperado));
      const nota = txt(c?.nota, 200);
      if (!(monto >= 0)) throw error(400, "Hay un monto recibido no válido.");
      if (monto === 0) {
        await conn.query("UPDATE planilla_detalle SET monto_recibido = 0, estado = 'no_descontado', nota = ? WHERE id_detalle = ?", [
          nota || "La empresa no lo descontó",
          d.id_detalle,
        ]);
        continue;
      }
      let r;
      try {
        r = await procesarPago(
          conn,
          { id_prestamo: d.id_prestamo, monto_pagado: monto, metodo_pago: metodo, numero_boleta: referencia, lugar_pago: `Planilla ${emp?.nombre || ""}`.trim() },
          req.usuario
        );
      } catch (e) {
        if (e instanceof FalloPago) throw error(e.codigo, `Préstamo #${d.id_prestamo}: ${e.cuerpo?.message || e.message}`);
        throw e;
      }
      await conn.query("UPDATE planilla_detalle SET monto_recibido = ?, id_pago = ?, estado = 'aplicado', nota = ? WHERE id_detalle = ?", [
        monto, r.nuevoPagoId, nota, d.id_detalle,
      ]);
      total = r2(total + monto);
      aplicados.push({ id_usuario: d.id_usuario, id_prestamo: d.id_prestamo, monto, idRecibo: r.idRecibo, nuevoSaldo: r.nuevoSaldo, liquidado: r.prestamoLiquidado });
    }
    await conn.query(
      "UPDATE planilla_lotes SET estado = 'aplicada', total_recibido = ?, metodo = ?, referencia = ?, aplicado_por = ?, aplicado_en = NOW() WHERE id_lote = ?",
      [total, metodo, referencia, req.usuario.id_usuario, l.id_lote]
    );
    await conn.query("INSERT INTO bitacora (id_usuario, accion, detalle, fecha) VALUES (?, ?, ?, NOW())", [
      req.usuario.id_usuario,
      "Planilla aplicada",
      `Planilla ${l.periodo} de ${emp?.nombre}: ${aplicados.length} pagos por ${dinero(total)} (${metodo}${referencia ? ` ${referencia}` : ""})`,
    ]);
    await conn.commit();

    for (const a of aplicados) {
      crearNotificacion(a.id_usuario, {
        titulo: a.liquidado ? `¡Préstamo #${a.id_prestamo} cancelado!` : "Pago por planilla aplicado",
        mensaje: `Aplicamos ${dinero(a.monto)} descontado de tu salario a tu préstamo #${a.id_prestamo}. ` +
          (a.liquidado ? "Tu préstamo quedó totalmente pagado." : `Tu nuevo saldo es ${dinero(a.nuevoSaldo)}.`),
        tipo: "pago",
        idRecibo: a.idRecibo,
      });
    }
    const sinDescontar = detalle.length - aplicados.length;
    res.json({
      success: true,
      message: `Planilla aplicada: ${aplicados.length} pagos por ${dinero(total)}.${sinDescontar ? ` ${sinDescontar} sin descontar: cóbralos por otra vía.` : ""}`,
      aplicados: aplicados.length,
      sin_descontar: sinDescontar,
      total,
    });
  } catch (e) {
    await conn.rollback().catch(() => {});
    fallo(res, e, "No se pudo aplicar la planilla");
  } finally {
    conn.release();
  }
});

// Anular una planilla que todavía no se aplicó (por ejemplo, para generarla de nuevo)
router.delete("/lotes/:id", async (req, res) => {
  try {
    const [r] = await pool.query("UPDATE planilla_lotes SET estado = 'anulada' WHERE id_lote = ? AND estado = 'generada'", [parseInt(req.params.id)]);
    if (!r.affectedRows) return res.status(400).json({ message: "Solo se anula una planilla que no se ha aplicado." });
    res.json({ success: true, message: "Planilla anulada." });
  } catch (e) {
    fallo(res, e, "No se pudo anular la planilla");
  }
});

module.exports = router;
