const express = require("express");
const router = express.Router();
const pool = require("../db");

const esFecha = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(Date.parse(v));
const hoyISO = () => new Date().toISOString().split("T")[0];
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
        message: `Hay una diferencia de L. ${diferencia.toFixed(2)}. Explica el motivo en la observación para cerrar.`,
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
        `Caja del ${fecha} cerrada. Esperado: L. ${e.efectivo_esperado.toFixed(2)}, contado: L. ${contado.toFixed(2)}, diferencia: L. ${diferencia.toFixed(2)}`,
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

    await pool.query(
      `INSERT INTO caja_movimientos
         (fecha, tipo, categoria, monto, metodo, descripcion, referencia_tipo, id_registrado_por)
       VALUES (COALESCE(?, NOW()), 'egreso', ?, ?, ?, ?, 'gasto', ?)`,
      [fechaMov, `gasto_${cat}`, valor, metodoFinal, String(concepto).trim().substring(0, 255), req.usuario?.id_usuario || null]
    );
    await pool.query(
      `INSERT INTO bitacora (id_usuario, accion, detalle, fecha) VALUES (?, ?, ?, NOW())`,
      [req.usuario?.id_usuario, "Registro de gasto", `Gasto (${cat}) de L. ${valor.toFixed(2)}: ${String(concepto).trim().substring(0, 120)}`]
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

    await pool.query(
      `INSERT INTO caja_movimientos
         (fecha, tipo, categoria, monto, metodo, descripcion, referencia_tipo, id_registrado_por)
       VALUES (COALESCE(?, NOW()), 'ingreso', ?, ?, ?, ?, 'ingreso_manual', ?)`,
      [fechaMov, `ingreso_${cat}`, valor, metodoFinal, descripcion.substring(0, 255), req.usuario?.id_usuario || null]
    );
    await pool.query(
      `INSERT INTO bitacora (id_usuario, accion, detalle, fecha) VALUES (?, ?, ?, NOW())`,
      [req.usuario?.id_usuario, "Ingreso manual a caja", `${CATEGORIAS_INGRESO[cat]}: L. ${valor.toFixed(2)} (${metodoFinal})`]
    );
    res.status(201).json({ success: true, message: "Ingreso registrado" });
  } catch (error) {
    console.error("ERROR AL REGISTRAR INGRESO:", error);
    res.status(500).json({ message: "Error al registrar el ingreso" });
  }
});

module.exports = router;
