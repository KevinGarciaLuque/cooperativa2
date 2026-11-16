const express = require("express");
const { registrarCaja, turnoAbierto } = require("../utils/caja");
const router = express.Router();
const pool = require("../db");

const esFecha = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(Date.parse(v));
const { hoyISO } = require("./../utils/fechas");
const { dinero } = require("../utils/pais");
const num = (v) => parseFloat(v || 0);

// Resumen del efectivo de un día: saldo inicial (último cierre previo) + ingresos - egresos
const efectivoDelDia = async (fecha) => {
  const [[flujo]] = await pool.query(
    `SELECT
       IFNULL(SUM(CASE WHEN tipo = 'ingreso' THEN monto ELSE 0 END), 0) AS ingresos,
       IFNULL(SUM(CASE WHEN tipo = 'egreso' THEN monto ELSE 0 END), 0) AS egresos
     FROM caja_movimientos
     WHERE metodo = 'efectivo' AND DATE(fecha) = ?`,
    [fecha]
  );
  const [previo] = await pool.query(
    `SELECT efectivo_contado FROM cierres_caja WHERE fecha < ? ORDER BY fecha DESC LIMIT 1`,
    [fecha]
  );
  const saldoInicial = previo.length ? num(previo[0].efectivo_contado) : 0;
  return {
    saldo_inicial: saldoInicial,
    ingresos_efectivo: num(flujo.ingresos),
    egresos_efectivo: num(flujo.egresos),
    efectivo_esperado: parseFloat((saldoInicial + num(flujo.ingresos) - num(flujo.egresos)).toFixed(2)),
  };
};

// ============================================
// RESUMEN DE UN DÍA: GET /api/caja/resumen?fecha=YYYY-MM-DD
// ============================================
router.get("/resumen", async (req, res) => {
  try {
    const fecha = esFecha(req.query.fecha) ? req.query.fecha : hoyISO();

    const [movimientos] = await pool.query(
      `SELECT c.*, u.nombre_completo AS socio, r.nombre_completo AS registrado_por
       FROM caja_movimientos c
       LEFT JOIN usuarios u ON c.id_socio = u.id_usuario
       LEFT JOIN usuarios r ON c.id_registrado_por = r.id_usuario
       WHERE DATE(c.fecha) = ?
       ORDER BY c.fecha DESC, c.id_movimiento DESC`,
      [fecha]
    );

    const [porMetodo] = await pool.query(
      `SELECT metodo,
              IFNULL(SUM(CASE WHEN tipo = 'ingreso' THEN monto ELSE 0 END), 0) AS ingresos,
              IFNULL(SUM(CASE WHEN tipo = 'egreso' THEN monto ELSE 0 END), 0) AS egresos
       FROM caja_movimientos WHERE DATE(fecha) = ? GROUP BY metodo`,
      [fecha]
    );

    const [porCategoria] = await pool.query(
      `SELECT categoria, tipo, COUNT(*) AS cantidad, IFNULL(SUM(monto), 0) AS total
       FROM caja_movimientos WHERE DATE(fecha) = ? GROUP BY categoria, tipo ORDER BY total DESC`,
      [fecha]
    );

    const efectivo = await efectivoDelDia(fecha);
    const [cierre] = await pool.query(`SELECT * FROM cierres_caja WHERE fecha = ?`, [fecha]);

    const ingresos = movimientos.filter((m) => m.tipo === "ingreso").reduce((s, m) => s + num(m.monto), 0);
    const egresos = movimientos.filter((m) => m.tipo === "egreso").reduce((s, m) => s + num(m.monto), 0);

    res.json({
      success: true,
      fecha,
      totales: { ingresos, egresos, neto: parseFloat((ingresos - egresos).toFixed(2)) },
      efectivo,
      por_metodo: porMetodo.map((m) => ({
        metodo: m.metodo,
        ingresos: num(m.ingresos),
        egresos: num(m.egresos),
      })),
      por_categoria: porCategoria.map((c) => ({
        categoria: c.categoria,
        tipo: c.tipo,
        cantidad: c.cantidad,
        total: num(c.total),
      })),
      movimientos: movimientos.map((m) => ({ ...m, monto: num(m.monto) })),
      cierre: cierre.length ? cierre[0] : null,
    });
  } catch (error) {
    console.error("ERROR AL OBTENER RESUMEN DE CAJA:", error);
    res.status(500).json({ message: "Error al obtener el resumen de caja" });
  }
});

// ============================================
// CIERRE DE CAJA (arqueo): POST /api/caja/cierre
// ============================================
router.post("/cierre", async (req, res) => {
  try {
    const { fecha: fechaBody, efectivo_contado, observacion } = req.body;
    const fecha = esFecha(fechaBody) ? fechaBody : hoyISO();
    const contado = parseFloat(efectivo_contado);
    if (isNaN(contado) || contado < 0) {
      return res.status(400).json({ message: "Indica el efectivo contado (número mayor o igual a 0)." });
    }

    const [existe] = await pool.query(`SELECT id_cierre FROM cierres_caja WHERE fecha = ?`, [fecha]);
    if (existe.length) {
      return res.status(409).json({ message: "La caja de esta fecha ya fue cerrada." });
    }

    const e = await efectivoDelDia(fecha);
    const diferencia = parseFloat((contado - e.efectivo_esperado).toFixed(2));

    if (Math.abs(diferencia) > 0.005 && !String(observacion || "").trim()) {
      return res.status(400).json({
        message: `Hay una diferencia de ${dinero(diferencia)}. Explica el motivo en la observación para cerrar.`,
        diferencia,
      });
    }

    await pool.query(
      `INSERT INTO cierres_caja
         (fecha, saldo_inicial, ingresos_efectivo, egresos_efectivo, efectivo_esperado,
          efectivo_contado, diferencia, observacion, id_cerrado_por)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        fecha, e.saldo_inicial, e.ingresos_efectivo, e.egresos_efectivo, e.efectivo_esperado,
        contado, diferencia, observacion ? String(observacion).substring(0, 255) : null,
        req.usuario?.id_usuario || null,
      ]
    );

    await pool.query(
      `INSERT INTO bitacora (id_usuario, accion, detalle, fecha) VALUES (?, ?, ?, NOW())`,
      [
        req.usuario?.id_usuario,
        "Cierre de caja",
        `Caja del ${fecha} cerrada. Esperado: ${dinero(e.efectivo_esperado)}, contado: ${dinero(contado)}, diferencia: ${dinero(diferencia)}`,
      ]
    );

    res.status(201).json({ success: true, message: "Caja cerrada correctamente", diferencia });
  } catch (error) {
    console.error("ERROR AL CERRAR CAJA:", error);
    res.status(500).json({ message: "Error al cerrar la caja" });
  }
});

// ============================================
// HISTORIAL DE CIERRES: GET /api/caja/cierres
// ============================================
router.get("/cierres", async (req, res) => {
  try {
    const limite = Math.min(parseInt(req.query.limit) || 30, 200);
    const [rows] = await pool.query(
      `SELECT c.*, u.nombre_completo AS cerrado_por
       FROM cierres_caja c LEFT JOIN usuarios u ON c.id_cerrado_por = u.id_usuario
       ORDER BY c.fecha DESC LIMIT ?`,
      [limite]
    );
    res.json({
      success: true,
      data: rows.map((r) => ({
        ...r,
        saldo_inicial: num(r.saldo_inicial),
        ingresos_efectivo: num(r.ingresos_efectivo),
        egresos_efectivo: num(r.egresos_efectivo),
        efectivo_esperado: num(r.efectivo_esperado),
        efectivo_contado: num(r.efectivo_contado),
        diferencia: num(r.diferencia),
      })),
    });
  } catch (error) {
    console.error("ERROR AL LISTAR CIERRES:", error);
    res.status(500).json({ message: "Error al obtener los cierres de caja" });
  }
});

// ============================================
// REGISTRAR UN GASTO: POST /api/caja/gasto
// ============================================
// Ejecuta fn(conexión) dentro de una transacción (el movimiento de caja y su partida van juntos)
const enTransaccion = async (fn) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const r = await fn(conn);
    await conn.commit();
    return r;
  } catch (error) {
    await conn.rollback().catch(() => {});
    throw error;
  } finally {
    conn.release();
  }
};

const CATEGORIAS_GASTO = ["servicios", "salarios", "alquiler", "papeleria", "transporte", "otros"];

router.post("/gasto", async (req, res) => {
  try {
    const { categoria, monto, metodo, concepto, fecha } = req.body;
    const cat = CATEGORIAS_GASTO.includes(categoria) ? categoria : "otros";
    const valor = parseFloat(monto);
    if (isNaN(valor) || valor <= 0) {
      return res.status(400).json({ message: "El monto del gasto debe ser mayor a 0." });
    }
    if (!String(concepto || "").trim()) {
      return res.status(400).json({ message: "Describe el gasto en el concepto." });
    }
    const metodoFinal = ["efectivo", "transferencia", "cheque", "deposito"].includes(metodo) ? metodo : "efectivo";
    const fechaMov = esFecha(fecha) && fecha <= hoyISO() ? `${fecha} 12:00:00` : null;

    await enTransaccion((conn) =>
      registrarCaja(conn, {
        fecha: fechaMov,
        tipo: "egreso",
        categoria: `gasto_${cat}`,
        monto: valor,
        metodo: metodoFinal,
        descripcion: String(concepto).trim(),
        referencia_tipo: "gasto",
        id_registrado_por: req.usuario?.id_usuario || null,
      })
    );
    await pool.query(
      `INSERT INTO bitacora (id_usuario, accion, detalle, fecha) VALUES (?, ?, ?, NOW())`,
      [req.usuario?.id_usuario, "Registro de gasto", `Gasto (${cat}) de ${dinero(valor)}: ${String(concepto).trim().substring(0, 120)}`]
    );
    res.status(201).json({ success: true, message: "Gasto registrado" });
  } catch (error) {
    console.error("ERROR AL REGISTRAR GASTO:", error);
    res.status(500).json({ message: "Error al registrar el gasto" });
  }
});

// ============================================
// REGISTRAR UN INGRESO NO OPERATIVO (saldo inicial, capital): POST /api/caja/ingreso
// No cuenta como ingreso del período en el estado de resultados.
// ============================================
const CATEGORIAS_INGRESO = {
  saldo_inicial: "Saldo inicial de caja",
  capital: "Aporte de capital",
  otro: "Otro ingreso",
};

router.post("/ingreso", async (req, res) => {
  try {
    const { categoria, monto, metodo, concepto, fecha } = req.body;
    const cat = CATEGORIAS_INGRESO[categoria] ? categoria : "otro";
    const valor = parseFloat(monto);
    if (isNaN(valor) || valor <= 0) {
      return res.status(400).json({ message: "El monto debe ser mayor a 0." });
    }
    const metodoFinal = ["efectivo", "transferencia", "cheque", "deposito"].includes(metodo) ? metodo : "efectivo";
    const descripcion = String(concepto || "").trim() || CATEGORIAS_INGRESO[cat];
    const fechaMov = esFecha(fecha) && fecha <= hoyISO() ? `${fecha} 12:00:00` : null;

    await enTransaccion((conn) =>
      registrarCaja(conn, {
        fecha: fechaMov,
        tipo: "ingreso",
        categoria: `ingreso_${cat}`,
        monto: valor,
        metodo: metodoFinal,
        descripcion,
        referencia_tipo: "ingreso_manual",
        id_registrado_por: req.usuario?.id_usuario || null,
      })
    );
    await pool.query(
      `INSERT INTO bitacora (id_usuario, accion, detalle, fecha) VALUES (?, ?, ?, NOW())`,
      [req.usuario?.id_usuario, "Ingreso manual a caja", `${CATEGORIAS_INGRESO[cat]}: ${dinero(valor)} (${metodoFinal})`]
    );
    res.status(201).json({ success: true, message: "Ingreso registrado" });
  } catch (error) {
    console.error("ERROR AL REGISTRAR INGRESO:", error);
    res.status(500).json({ message: "Error al registrar el ingreso" });
  }
});

// ════════════════════════════════════════════
// SUCURSALES Y TURNOS DE CAJA POR CAJERO
// Cada cajero abre su turno con un fondo inicial; lo que registra mientras está abierto queda en
// su turno. Al cerrarlo cuenta el efectivo y queda la diferencia contra lo esperado.
// ════════════════════════════════════════════
const r2 = (n) => parseFloat(num(n).toFixed(2));

const totalesTurno = async (t) => {
  const [[f]] = await pool.query(
    `SELECT
       IFNULL(SUM(CASE WHEN tipo = 'ingreso' AND metodo = 'efectivo' THEN monto ELSE 0 END), 0) AS ingresos,
       IFNULL(SUM(CASE WHEN tipo = 'egreso' AND metodo = 'efectivo' THEN monto ELSE 0 END), 0) AS egresos,
       COUNT(*) AS movimientos
     FROM caja_movimientos WHERE id_turno = ?`,
    [t.id_turno]
  );
  return {
    ingresos_efectivo: r2(f.ingresos),
    egresos_efectivo: r2(f.egresos),
    movimientos: f.movimientos,
    efectivo_esperado: r2(num(t.fondo_inicial) + num(f.ingresos) - num(f.egresos)),
  };
};

const SQL_TURNO = `SELECT t.*, s.nombre AS sucursal, u.nombre_completo AS cajero
  FROM cajas_turnos t JOIN sucursales s ON s.id_sucursal = t.id_sucursal JOIN usuarios u ON u.id_usuario = t.id_cajero`;

// GET /api/caja/sucursales
router.get("/sucursales", async (req, res) => {
  try {
    const [filas] = await pool.query("SELECT * FROM sucursales ORDER BY activa DESC, nombre");
    res.json({ success: true, data: filas });
  } catch (error) {
    console.error("ERROR AL LISTAR SUCURSALES:", error);
    res.status(500).json({ message: "No se pudieron leer las sucursales" });
  }
});

// POST /api/caja/sucursales  y  PUT /api/caja/sucursales/:id  (Super Administrador)
const guardarSucursal = async (req, res) => {
  if (req.usuario.rol !== "Super Administrador") {
    return res.status(403).json({ message: "Solo el Super Administrador administra las sucursales." });
  }
  const nombre = String(req.body?.nombre || "").trim().substring(0, 100);
  const direccion = String(req.body?.direccion || "").trim().substring(0, 255) || null;
  const activa = req.body?.activa === false || req.body?.activa === 0 ? 0 : 1;
  if (!nombre) return res.status(400).json({ message: "Escribe el nombre de la sucursal." });
  try {
    if (req.params.id) {
      const [r] = await pool.query("UPDATE sucursales SET nombre = ?, direccion = ?, activa = ? WHERE id_sucursal = ?", [
        nombre, direccion, activa, parseInt(req.params.id),
      ]);
      if (!r.affectedRows) return res.status(404).json({ message: "Sucursal no encontrada" });
      return res.json({ success: true, message: "Sucursal guardada." });
    }
    const [r] = await pool.query("INSERT INTO sucursales (nombre, direccion, activa) VALUES (?, ?, ?)", [nombre, direccion, activa]);
    res.status(201).json({ success: true, message: "Sucursal creada.", id_sucursal: r.insertId });
  } catch (error) {
    console.error("ERROR AL GUARDAR SUCURSAL:", error);
    res.status(500).json({ message: "No se pudo guardar la sucursal" });
  }
};
router.post("/sucursales", guardarSucursal);
router.put("/sucursales/:id", guardarSucursal);

// GET /api/caja/turno → el turno abierto del usuario, con sus totales
router.get("/turno", async (req, res) => {
  try {
    const abierto = await turnoAbierto(pool, req.usuario.id_usuario);
    if (!abierto) {
      const [[u]] = await pool.query("SELECT id_sucursal FROM usuarios WHERE id_usuario = ?", [req.usuario.id_usuario]);
      return res.json({
        success: true,
        data: null,
        id_sucursal_habitual: u?.id_sucursal || null,
        exigir_turno: !!parseInt(require("../utils/configFinanciera").obtener().caja_exigir_turno),
      });
    }
    const [[t]] = await pool.query(`${SQL_TURNO} WHERE t.id_turno = ?`, [abierto.id_turno]);
    res.json({ success: true, data: { ...t, ...(await totalesTurno(t)) } });
  } catch (error) {
    console.error("ERROR AL LEER EL TURNO:", error);
    res.status(500).json({ message: "No se pudo leer el turno" });
  }
});

// POST /api/caja/turno/abrir  { id_sucursal, fondo_inicial }
router.post("/turno/abrir", async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const fondo = parseFloat(req.body?.fondo_inicial ?? 0);
    if (isNaN(fondo) || fondo < 0) return res.status(400).json({ message: "El fondo inicial no es válido." });
    const idSucursal = parseInt(req.body?.id_sucursal);
    const [[s]] = await conn.query("SELECT id_sucursal FROM sucursales WHERE id_sucursal = ? AND activa = 1", [idSucursal || 0]);
    if (!s) return res.status(400).json({ message: "Elige una sucursal activa." });
    await conn.beginTransaction();
    // Un solo turno abierto por cajero (el bloqueo evita abrir dos a la vez)
    await conn.query("SELECT id_usuario FROM usuarios WHERE id_usuario = ? FOR UPDATE", [req.usuario.id_usuario]);
    if (await turnoAbierto(conn, req.usuario.id_usuario)) {
      await conn.rollback();
      return res.status(409).json({ message: "Ya tienes un turno abierto." });
    }
    const [r] = await conn.query("INSERT INTO cajas_turnos (id_cajero, id_sucursal, fondo_inicial) VALUES (?, ?, ?)", [
      req.usuario.id_usuario, idSucursal, r2(fondo),
    ]);
    await conn.query("UPDATE usuarios SET id_sucursal = ? WHERE id_usuario = ?", [idSucursal, req.usuario.id_usuario]);
    await conn.query(`INSERT INTO bitacora (id_usuario, accion, detalle, fecha) VALUES (?, ?, ?, NOW())`, [
      req.usuario.id_usuario, "Apertura de turno de caja", `Turno #${r.insertId} con fondo inicial de ${dinero(fondo)}`,
    ]);
    await conn.commit();
    res.status(201).json({ success: true, message: "Turno abierto.", id_turno: r.insertId });
  } catch (error) {
    await conn.rollback().catch(() => {});
    console.error("ERROR AL ABRIR TURNO:", error);
    res.status(500).json({ message: "No se pudo abrir el turno" });
  } finally {
    conn.release();
  }
});

// POST /api/caja/turno/cerrar  { efectivo_contado, observacion }
router.post("/turno/cerrar", async (req, res) => {
  try {
    const abierto = await turnoAbierto(pool, req.usuario.id_usuario);
    if (!abierto) return res.status(400).json({ message: "No tienes un turno abierto." });
    const contado = parseFloat(req.body?.efectivo_contado);
    if (isNaN(contado) || contado < 0) {
      return res.status(400).json({ message: "Indica el efectivo contado (número mayor o igual a 0)." });
    }
    const observacion = String(req.body?.observacion || "").trim().substring(0, 255);
    const [[t]] = await pool.query("SELECT * FROM cajas_turnos WHERE id_turno = ?", [abierto.id_turno]);
    const tot = await totalesTurno(t);
    const diferencia = r2(contado - tot.efectivo_esperado);
    if (Math.abs(diferencia) > 0.005 && !observacion) {
      return res.status(400).json({
        message: `Hay una diferencia de ${dinero(diferencia)}. Explica el motivo en la observación para cerrar.`,
        diferencia,
      });
    }
    const [r] = await pool.query(
      `UPDATE cajas_turnos
       SET estado = 'cerrado', cerrado_en = NOW(), ingresos_efectivo = ?, egresos_efectivo = ?, efectivo_esperado = ?,
           efectivo_contado = ?, diferencia = ?, observacion = ?
       WHERE id_turno = ? AND estado = 'abierto'`,
      [tot.ingresos_efectivo, tot.egresos_efectivo, tot.efectivo_esperado, r2(contado), diferencia, observacion || null, t.id_turno]
    );
    if (!r.affectedRows) return res.status(409).json({ message: "El turno ya fue cerrado." });
    await pool.query(`INSERT INTO bitacora (id_usuario, accion, detalle, fecha) VALUES (?, ?, ?, NOW())`, [
      req.usuario.id_usuario,
      "Cierre de turno de caja",
      `Turno #${t.id_turno}. Esperado: ${dinero(tot.efectivo_esperado)}, contado: ${dinero(contado)}, diferencia: ${dinero(diferencia)}`,
    ]);
    res.json({ success: true, message: "Turno cerrado.", diferencia, ...tot });
  } catch (error) {
    console.error("ERROR AL CERRAR TURNO:", error);
    res.status(500).json({ message: "No se pudo cerrar el turno" });
  }
});

// GET /api/caja/turnos?fecha=YYYY-MM-DD&id_sucursal= → turnos del día (los abiertos con sus totales al momento)
router.get("/turnos", async (req, res) => {
  try {
    const fecha = esFecha(req.query.fecha) ? req.query.fecha : hoyISO();
    const params = [fecha];
    let filtro = "";
    if (parseInt(req.query.id_sucursal)) {
      filtro = " AND t.id_sucursal = ?";
      params.push(parseInt(req.query.id_sucursal));
    }
    const [filas] = await pool.query(
      `${SQL_TURNO} WHERE (DATE(t.abierto_en) = ? OR t.estado = 'abierto')${filtro} ORDER BY t.abierto_en DESC`,
      params
    );
    for (const t of filas) {
      if (t.estado === "abierto") Object.assign(t, await totalesTurno(t));
    }
    res.json({ success: true, data: filas });
  } catch (error) {
    console.error("ERROR AL LISTAR TURNOS:", error);
    res.status(500).json({ message: "No se pudieron leer los turnos" });
  }
});

module.exports = router;
