// Consolidación de préstamos: varios préstamos vigentes de un socio se juntan en uno nuevo,
// con la tasa y el plazo que se decidan. Solo el Super Administrador.
//
// Reglas:
//  - El interés acumulado (y la mora, salvo que se omita) se SUMA al capital del préstamo nuevo.
//  - Los préstamos anteriores quedan "consolidados" con su historial intacto y saldo 0.
//  - El préstamo nuevo nace activo. Solo el monto adicional (si lo hay) sale de caja.
const express = require("express");
const router = express.Router();
const pool = require("../db");
const { calcularCuotaMensual, liquidacionAlDia, hoyISO } = require("../utils/calculosPrestamo");
const { registrarCaja } = require("../utils/caja");
const { crearRecibo } = require("../utils/recibos");
const { notificarSocio } = require("../utils/notificaciones");

const num = (v) => parseFloat(v || 0);
const redondear = (v) => parseFloat(num(v).toFixed(2));

const soloSuperAdmin = (req, res, next) => {
  if (req.usuario?.rol !== "Super Administrador") {
    return res.status(403).json({ message: "Solo el Super Administrador puede consolidar préstamos." });
  }
  next();
};

const sumarMeses = (fecha, meses) => {
  const [y, m, d] = fecha.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + meses, d)).toISOString().substring(0, 10);
};

// Calcula lo que se consolida y las condiciones del préstamo nuevo.
// `bloquear` bloquea las filas (se usa dentro de la transacción al confirmar).
const calcular = async (conn, { idUsuario, ids, tasaMensual, plazo, adicional, omitirMora, bloquear = false }) => {
  const lista = [...new Set((ids || []).map((n) => parseInt(n)).filter((n) => n > 0))];
  if (lista.length < 2) throw Object.assign(new Error("Elige al menos 2 préstamos para consolidar."), { codigo: 400 });

  const [rows] = await conn.query(
    `SELECT p.*, (SELECT MAX(fecha_pago) FROM pagos_prestamo WHERE id_prestamo = p.id_prestamo) AS ultimo_pago
     FROM prestamos p
     WHERE p.id_prestamo IN (?) ${bloquear ? "FOR UPDATE" : ""}`,
    [lista]
  );
  if (rows.length !== lista.length) throw Object.assign(new Error("Alguno de los préstamos no existe."), { codigo: 404 });
  for (const p of rows) {
    if (p.id_usuario !== idUsuario) throw Object.assign(new Error("Los préstamos deben ser del mismo socio."), { codigo: 400 });
    if (!["activo", "mora"].includes(p.estado)) {
      throw Object.assign(new Error(`El préstamo #${p.id_prestamo} no está vigente (estado: ${p.estado}).`), { codigo: 400 });
    }
  }

  if (!(tasaMensual >= 0) || tasaMensual > 30) throw Object.assign(new Error("La tasa mensual debe estar entre 0 y 30."), { codigo: 400 });
  if (!Number.isInteger(plazo) || plazo < 1 || plazo > 360) {
    throw Object.assign(new Error("El plazo debe ser de 1 a 360 meses."), { codigo: 400 });
  }
  if (!(adicional >= 0)) throw Object.assign(new Error("El monto adicional no puede ser negativo."), { codigo: 400 });

  const prestamos = rows.map((p) => {
    const l = liquidacionAlDia({
      saldo: p.saldo_restante,
      tasaAnual: p.tasa_interes,
      fechaOtorgado: p.fecha_otorgado,
      fechaUltimoPago: p.ultimo_pago,
    });
    return {
      id_prestamo: p.id_prestamo,
      monto_original: redondear(p.monto),
      saldo: redondear(p.saldo_restante),
      interes: redondear(l.interes),
      mora: redondear(l.mora),
      dias_mora: l.diasMora,
      estado: p.estado,
      plazo_meses: p.plazo_meses,
      tasa_mensual: redondear(num(p.tasa_interes) / 12),
      cuota_actual: redondear(calcularCuotaMensual(num(p.monto), num(p.tasa_interes), parseInt(p.plazo_meses))),
    };
  });

  const capital = redondear(prestamos.reduce((s, p) => s + p.saldo, 0));
  const interes = redondear(prestamos.reduce((s, p) => s + p.interes, 0));
  const moraTotal = redondear(prestamos.reduce((s, p) => s + p.mora, 0));
  const moraCobrada = omitirMora ? 0 : moraTotal;
  const moraCondonada = omitirMora ? moraTotal : 0;
  const montoNuevo = redondear(capital + interes + moraCobrada + adicional);
  if (!(montoNuevo > 0)) throw Object.assign(new Error("El monto consolidado debe ser mayor a 0."), { codigo: 400 });

  const cuota = redondear(calcularCuotaMensual(montoNuevo, tasaMensual * 12, plazo));
  return {
    prestamos,
    capital,
    interes_capitalizado: interes,
    mora_capitalizada: moraCobrada,
    mora_condonada: moraCondonada,
    adicional: redondear(adicional),
    monto_nuevo: montoNuevo,
    tasa_mensual: tasaMensual,
    plazo_meses: plazo,
    cuota_nueva: cuota,
    total_a_pagar: redondear(cuota * plazo),
    cuotas_actuales: redondear(prestamos.reduce((s, p) => s + p.cuota_actual, 0)),
    primer_vencimiento: sumarMeses(hoyISO(), 1),
  };
};

const leerParametros = (src) => ({
  idUsuario: parseInt(src.id_usuario),
  ids: Array.isArray(src.ids) ? src.ids : String(src.ids || "").split(","),
  tasaMensual: parseFloat(src.tasa_mensual),
  plazo: parseInt(src.plazo_meses),
  adicional: src.adicional === undefined || src.adicional === "" ? 0 : parseFloat(src.adicional),
  omitirMora: src.omitir_mora === true || src.omitir_mora === "1" || src.omitir_mora === "true",
});

// GET /api/consolidaciones/simular?id_usuario=&ids=1,2&tasa_mensual=&plazo_meses=&adicional=&omitir_mora=1
router.get("/simular", soloSuperAdmin, async (req, res) => {
  try {
    const r = await calcular(pool, leerParametros(req.query));
    res.json({ success: true, data: r });
  } catch (error) {
    if (error.codigo) return res.status(error.codigo).json({ message: error.message });
    console.error("ERROR AL SIMULAR CONSOLIDACIÓN:", error);
    res.status(500).json({ message: "No se pudo calcular la consolidación." });
  }
});

// POST /api/consolidaciones
router.post("/", soloSuperAdmin, async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const motivo = String(req.body.motivo || "").trim();
    if (motivo.length < 5) {
      return res.status(400).json({ message: "Indica el motivo de la consolidación (mínimo 5 caracteres)." });
    }
    const metodoAdicional = ["efectivo", "transferencia", "cheque"].includes(String(req.body.metodo_adicional || "").toLowerCase())
      ? String(req.body.metodo_adicional).toLowerCase()
      : "efectivo";

    await connection.beginTransaction();
    const [[socio]] = await connection.query("SELECT id_usuario, nombre_completo, estado FROM usuarios WHERE id_usuario = ?", [
      parseInt(req.body.id_usuario),
    ]);
    if (!socio || socio.estado !== "activo") {
      await connection.rollback();
      return res.status(400).json({ message: "El socio no existe o no está activo." });
    }

    const c = await calcular(connection, { ...leerParametros(req.body), bloquear: true });

    // Préstamo nuevo: activo de inmediato, el plazo empieza hoy
    const [nuevo] = await connection.query(
      `INSERT INTO prestamos
         (id_usuario, monto, tasa_interes, tipo_tasa, tasa_original, plazo_meses, saldo_restante, estado,
          fecha_otorgado, aprobado_por, fecha_aprobacion)
       VALUES (?, ?, ?, 'nominal_mensual', ?, ?, ?, 'activo', NOW(), ?, NOW())`,
      [socio.id_usuario, c.monto_nuevo, redondear(c.tasa_mensual * 12), c.tasa_mensual, c.plazo_meses, c.monto_nuevo, req.usuario.id_usuario]
    );
    const idNuevo = nuevo.insertId;

    // Los préstamos anteriores quedan consolidados, con su historial intacto
    await connection.query(
      `UPDATE prestamos SET estado = 'consolidado', saldo_restante = 0.00, consolidado_en = NOW(), consolidado_en_prestamo = ?
       WHERE id_prestamo IN (?)`,
      [idNuevo, c.prestamos.map((p) => p.id_prestamo)]
    );

    await connection.query(
      `INSERT INTO consolidaciones
         (id_usuario, id_prestamo_nuevo, prestamos_origen, capital, interes_capitalizado, mora_capitalizada,
          mora_condonada, monto_adicional, monto_nuevo, tasa_mensual, plazo_meses, motivo, creada_por)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        socio.id_usuario, idNuevo, JSON.stringify(c.prestamos), c.capital, c.interes_capitalizado, c.mora_capitalizada,
        c.mora_condonada, c.adicional, c.monto_nuevo, c.tasa_mensual, c.plazo_meses, motivo.substring(0, 255), req.usuario.id_usuario,
      ]
    );

    // Solo el dinero adicional sale de caja; lo demás es un traspaso entre préstamos
    if (c.adicional > 0) {
      await registrarCaja(connection, {
        tipo: "egreso",
        categoria: "desembolso_prestamo",
        monto: c.adicional,
        metodo: metodoAdicional,
        descripcion: `Monto adicional de la consolidación (préstamo #${idNuevo})`,
        referencia_tipo: "prestamo",
        referencia_id: idNuevo,
        id_socio: socio.id_usuario,
        id_registrado_por: req.usuario.id_usuario,
      });
    }

    const idRecibo = await crearRecibo(connection, {
      tipo: "consolidacion",
      referencia_tipo: "prestamo",
      referencia_id: idNuevo,
      id_socio: socio.id_usuario,
      monto: c.monto_nuevo,
      metodo: c.adicional > 0 ? metodoAdicional : null,
      concepto: `Consolidación de ${c.prestamos.length} préstamos en el préstamo #${idNuevo}`,
      detalle: {
        id_prestamo: idNuevo,
        prestamos: c.prestamos,
        capital: c.capital,
        interes_capitalizado: c.interes_capitalizado,
        mora_capitalizada: c.mora_capitalizada,
        mora_condonada: c.mora_condonada,
        adicional: c.adicional,
        tasa_mensual: c.tasa_mensual,
        plazo_meses: c.plazo_meses,
        cuota: c.cuota_nueva,
        primer_vencimiento: c.primer_vencimiento,
        motivo,
      },
      emitido_por: req.usuario.id_usuario,
    });

    await connection.query(
      `INSERT INTO bitacora (id_usuario, accion, detalle, fecha) VALUES (?, ?, ?, NOW())`,
      [
        socio.id_usuario,
        "Consolidación de préstamos",
        `Préstamos ${c.prestamos.map((p) => "#" + p.id_prestamo).join(", ")} consolidados en #${idNuevo}: ` +
          `L. ${c.monto_nuevo.toFixed(2)} a ${c.plazo_meses} meses, ${c.tasa_mensual}% mensual. Motivo: ${motivo}`,
      ]
    );

    await connection.commit();

    notificarSocio(
      socio.id_usuario,
      "Tus préstamos fueron consolidados",
      `<p>Tus préstamos ${c.prestamos.map((p) => "#" + p.id_prestamo).join(", ")} se unieron en uno solo por ` +
        `<strong>L. ${c.monto_nuevo.toLocaleString("es-HN", { minimumFractionDigits: 2 })}</strong> a ${c.plazo_meses} meses. ` +
        `Tu nueva cuota mensual es de <strong>L. ${c.cuota_nueva.toLocaleString("es-HN", { minimumFractionDigits: 2 })}</strong>. ` +
        `Revisa y firma el convenio en tu cuenta.</p>`,
      undefined,
      { tipo: "consolidacion", idRecibo }
    ).catch(() => {});

    res.status(201).json({
      success: true,
      message: "Préstamos consolidados correctamente.",
      id_prestamo_nuevo: idNuevo,
      id_recibo: idRecibo,
      data: c,
    });
  } catch (error) {
    await connection.rollback().catch(() => {});
    if (error.codigo) return res.status(error.codigo).json({ message: error.message });
    console.error("ERROR AL CONSOLIDAR PRÉSTAMOS:", error);
    res.status(500).json({ message: "No se pudo consolidar los préstamos." });
  } finally {
    connection.release();
  }
});

module.exports = router;
