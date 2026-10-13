const express = require("express");
const router = express.Router();
const pool = require("../db");
const { notificarSocio, crearNotificacion } = require("../utils/notificaciones");
const jwt = require("jsonwebtoken");
const { registrarCaja } = require("../utils/caja");
const { crearRecibo, emitirFiniquito } = require("../utils/recibos");
const {
  calcularCuotaMensual,
  calcularDiasMora,
  calcularInteresMoratorio,
  soloFecha,
  esFechaISO,
  hoyISO,
  calcularInteresPeriodo,
  diasDeInteres,
  liquidacionAlDia,
} = require("../utils/calculosPrestamo");

// ============================================
// FUNCIONES AUXILIARES Y CÁLCULOS
// ============================================

// Registrar en bitácora
const registrarBitacora = async (id_usuario, accion, detalle) => {
  try {
    await pool.query(
      `INSERT INTO bitacora (id_usuario, accion, detalle) VALUES (?, ?, ?)`,
      [id_usuario, accion, detalle]
    );
  } catch (error) {
    console.error("Error al registrar en bitácora:", error);
  }
};

// ============================================
// OBTENER TODOS LOS PAGOS CON FILTROS
// ============================================
router.get("/", async (req, res) => {
  try {
    const { fecha_inicio = '', fecha_fin = '', id_prestamo = '', id_usuario = '' } = req.query;

    let whereClause = "WHERE 1=1";
    let params = [];

    if (fecha_inicio && fecha_fin) {
      whereClause += ` AND p.fecha_pago BETWEEN ? AND ?`;
      params.push(fecha_inicio, fecha_fin);
    }

    if (id_prestamo) {
      whereClause += ` AND p.id_prestamo = ?`;
      params.push(id_prestamo);
    }

    if (id_usuario) {
      whereClause += ` AND pre.id_usuario = ?`;
      params.push(id_usuario);
    }

    const [pagos] = await pool.query(
      `SELECT p.*, 
       pre.monto AS monto_prestamo, 
       pre.tasa_interes,
       pre.plazo_meses,
       pre.estado AS estado_prestamo,
       u.nombre_completo,
       u.dni
       FROM pagos_prestamo p
       INNER JOIN prestamos pre ON p.id_prestamo = pre.id_prestamo
       INNER JOIN usuarios u ON pre.id_usuario = u.id_usuario
       ${whereClause}
       ORDER BY p.fecha_pago DESC`,
      params
    );

    // Calcular totales
    const totales = {
      total_pagos: pagos.length,
      monto_total_pagado: pagos.reduce((sum, p) => sum + parseFloat(p.monto_pagado), 0),
    };

    res.json({
      success: true,
      data: pagos,
      totales: totales,
    });
  } catch (error) {
    console.error("ERROR AL OBTENER PAGOS:", error);
    res.status(500).json({ 
      message: "Error al obtener los pagos", 
      error: error.message 
    });
  }
});

// ============================================
// OBTENER PAGOS DE UN PRÉSTAMO ESPECÍFICO
// ============================================
router.get("/prestamo/:id_prestamo", async (req, res) => {
  try {
    const [pagos] = await pool.query(
      `SELECT * FROM pagos_prestamo 
       WHERE id_prestamo = ?
       ORDER BY fecha_pago DESC`,
      [req.params.id_prestamo]
    );

    // Calcular totales
    const totalPagado = pagos.reduce((sum, p) => sum + parseFloat(p.monto_pagado), 0);

    res.json({
      success: true,
      data: pagos,
      total_pagos: pagos.length,
      total_pagado: totalPagado,
    });
  } catch (error) {
    console.error("ERROR AL OBTENER PAGOS DEL PRÉSTAMO:", error);
    res.status(500).json({ 
      message: "Error al obtener los pagos del préstamo", 
      error: error.message 
    });
  }
});

// ============================================
// OBTENER UN PAGO POR ID CON DETALLES
// ============================================
router.get("/:id", async (req, res) => {
  try {
    const [pago] = await pool.query(
      `SELECT p.*, 
       pre.monto AS monto_prestamo, 
       pre.tasa_interes,
       pre.plazo_meses,
       pre.fecha_otorgado,
       u.nombre_completo,
       u.dni,
       u.telefono,
       u.correo
       FROM pagos_prestamo p
       INNER JOIN prestamos pre ON p.id_prestamo = pre.id_prestamo
       INNER JOIN usuarios u ON pre.id_usuario = u.id_usuario
       WHERE p.id_pago = ?`,
      [req.params.id]
    );
    
    if (pago.length === 0) {
      return res.status(404).json({ message: "Pago no encontrado" });
    }
    
    res.json({
      success: true,
      data: pago[0],
    });
  } catch (error) {
    console.error("ERROR AL OBTENER PAGO:", error);
    res.status(500).json({ 
      message: "Error al obtener el pago", 
      error: error.message 
    });
  }
});

// ============================================
// REGISTRAR UN NUEVO PAGO (CON ACTUALIZACIÓN AUTOMÁTICA)
// ============================================
router.post("/", async (req, res) => {
  const connection = await pool.getConnection();

  // Toda la operación va en una transacción; los retornos anticipados la revierten
  const fail = async (codigo, cuerpo) => {
    await connection.rollback().catch(() => {});
    return res.status(codigo).json(cuerpo);
  };

  try {
    await connection.beginTransaction();
    const { id_prestamo, monto_pagado, metodo_pago, condonar_mora, tipo_pago, fecha_pago, fecha_referencia, id_reporte } = req.body;

    // Pago reportado por el socio desde su panel: se confirma junto con este registro
    let reporte = null;
    if (id_reporte) {
      const [[r]] = await connection.query(
        "SELECT id_reporte, id_prestamo, id_usuario, estado FROM pagos_reportados WHERE id_reporte = ? FOR UPDATE",
        [id_reporte]
      );
      if (!r || r.id_prestamo !== parseInt(id_prestamo)) {
        return fail(400, { message: "El pago reportado no corresponde a este préstamo." });
      }
      if (r.estado !== "pendiente") {
        return fail(400, { message: "Ese pago reportado ya fue revisado." });
      }
      reporte = r;
    }

    // Validaciones
    if (!id_prestamo || !monto_pagado) {
      return fail(400, { 
        message: "Préstamo y monto pagado son requeridos." 
      });
    }

    const montoPagadoNum = parseFloat(monto_pagado);
    if (isNaN(montoPagadoNum) || montoPagadoNum <= 0) {
      return fail(400, { 
        message: "El monto debe ser un número positivo" 
      });
    }

    // Obtener información del préstamo
    const [prestamo] = await connection.query(
      `SELECT p.*, u.nombre_completo 
       FROM prestamos p
       INNER JOIN usuarios u ON p.id_usuario = u.id_usuario
       WHERE p.id_prestamo = ?
       FOR UPDATE OF p`,
      [id_prestamo]
    );

    if (prestamo.length === 0) {
      return fail(404, { message: "Préstamo no encontrado" });
    }

    const prestamoData = prestamo[0];

    if (prestamoData.estado === 'pagado') {
      return fail(400, { 
        message: "El préstamo ya está completamente pagado" 
      });
    }

    if (prestamoData.estado === 'pendiente') {
      return fail(400, { 
        message: "El préstamo aún no ha sido aprobado" 
      });
    }

    const saldoActual = parseFloat(prestamoData.saldo_restante);

    const [duplicado] = await connection.query(
      `SELECT id_pago FROM pagos_prestamo
       WHERE id_prestamo = ? AND monto_pagado = ? AND fecha_pago >= DATE_SUB(NOW(), INTERVAL 30 SECOND)
       LIMIT 1`,
      [id_prestamo, montoPagadoNum]
    );
    if (duplicado.length > 0) {
      return fail(409, {
        message: "Este pago ya fue registrado hace unos segundos. Revisa el historial antes de repetirlo.",
      });
    }

    // Calcular cuota mensual esperada
    const cuotaMensual = calcularCuotaMensual(
      parseFloat(prestamoData.monto),
      parseFloat(prestamoData.tasa_interes),
      parseInt(prestamoData.plazo_meses)
    );

    // Obtener último pago
    const [ultimoPago] = await connection.query(
      `SELECT fecha_pago FROM pagos_prestamo 
       WHERE id_prestamo = ? 
       ORDER BY fecha_pago DESC 
       LIMIT 1`,
      [id_prestamo]
    );

    // Calcular días de mora
    const diasMora = calcularDiasMora(
      prestamoData.fecha_otorgado,
      ultimoPago.length > 0 ? ultimoPago[0].fecha_pago : null
    );

    // ── Mora ───────────────────────────────────────────────────────────────
    // Se cobra siempre que haya días de atraso. Solo un Super Administrador
    // puede omitirla (condonar_mora): entonces se cobra como si no hubiera mora.
    const moraGenerada = diasMora > 0 ? calcularInteresMoratorio(saldoActual, diasMora) : 0;
    let moraCondonada = false;
    if (condonar_mora && moraGenerada > 0) {
      let rolSolicitante = null;
      try {
        const token = req.header("Authorization")?.replace("Bearer ", "");
        rolSolicitante = token
          ? jwt.verify(token, process.env.JWT_SECRET).rol
          : null;
      } catch {
        rolSolicitante = null;
      }
      if (rolSolicitante !== "Super Administrador") {
        return fail(403, { message: "Solo el Super Administrador puede omitir la mora." });
      }
      moraCondonada = true;
    }
    const interesMoratorio = moraCondonada ? 0 : moraGenerada;

    // ── Interés del período ────────────────────────────────────────────────
    // Mes completo siempre: mínimo 30 días de interés; pasado el mes, por días reales.
    const modo = ["desglose", "indefinido"].includes(tipo_pago) ? tipo_pago : "cuota_fija";
    const hoy = hoyISO();
    const fechaPagoStr = esFechaISO(fecha_pago) ? fecha_pago : hoy;
    if (fechaPagoStr > hoy) {
      return fail(400, { message: "La fecha del pago no puede ser futura." });
    }
    const fechaUltimoPago = ultimoPago.length > 0 ? soloFecha(ultimoPago[0].fecha_pago) : null;
    if (fechaUltimoPago && fechaPagoStr < fechaUltimoPago) {
      return fail(400, {
        message: `La fecha del pago no puede ser anterior al último pago registrado (${fechaUltimoPago}).`,
      });
    }
    const fechaBase = esFechaISO(fecha_referencia)
      ? fecha_referencia
      : fechaUltimoPago || soloFecha(prestamoData.fecha_otorgado) || fechaPagoStr;
    const diasInteres = diasDeInteres(modo, fechaBase, fechaPagoStr);

    const interesDelPeriodo = calcularInteresPeriodo(
      saldoActual,
      prestamoData.tasa_interes,
      diasInteres
    );

    // El monto neto que se aplica al préstamo (descontando mora si aplica)
    let montoAplicado = montoPagadoNum;
    if (interesMoratorio > 0) {
      montoAplicado -= interesMoratorio;
    }

    if (montoPagadoNum < interesMoratorio - 0.005) {
      return fail(400, {
        message: `El pago no alcanza a cubrir la mora generada (L. ${interesMoratorio.toFixed(2)}).`,
        interes_moratorio: parseFloat(interesMoratorio.toFixed(2)),
      });
    }

    // No se acepta más de lo adeudado: saldo + interés del período + mora
    const totalAdeudado = parseFloat((saldoActual + interesDelPeriodo + interesMoratorio).toFixed(2));
    if (montoPagadoNum > totalAdeudado + 0.01) {
      return fail(400, {
        message: `El monto (L. ${montoPagadoNum.toFixed(2)}) excede el total adeudado (L. ${totalAdeudado.toFixed(2)}).`,
        total_adeudado: totalAdeudado,
      });
    }

    // Capital = lo que queda después de cubrir el interés del período
    const capitalDelPeriodo = parseFloat(Math.max(0, montoAplicado - interesDelPeriodo).toFixed(2));
    // Interés efectivamente pagado (no puede superar el monto aplicado)
    const interesEfectivo   = parseFloat(Math.min(montoAplicado, interesDelPeriodo).toFixed(2));

    // Nuevo saldo = saldo anterior - capital amortizado (método francés)
    const nuevoSaldo = parseFloat(Math.max(0, saldoActual - capitalDelPeriodo).toFixed(2));
    const prestamoLiquidado = nuevoSaldo <= 0.01; // Considerar liquidado si queda menos de 1 centavo

    // Registrar el pago
    const [result] = await connection.query(
      `INSERT INTO pagos_prestamo (id_prestamo, monto_pagado, monto_capital, monto_interes, metodo_pago, saldo_restante, fecha_pago) 
       VALUES (?, ?, ?, ?, ?, ?, COALESCE(?, NOW()))`,
      [
        id_prestamo, montoPagadoNum, capitalDelPeriodo, interesEfectivo,
        metodo_pago || 'Efectivo', nuevoSaldo,
        fechaPagoStr === hoy ? null : `${fechaPagoStr} 12:00:00`,
      ]
    );

    const nuevoPagoId = result.insertId;

    await registrarCaja(connection, {
      tipo: "ingreso",
      categoria: "pago_prestamo",
      monto: montoPagadoNum,
      metodo: metodo_pago,
      descripcion: `Pago préstamo #${id_prestamo} (capital L. ${capitalDelPeriodo.toFixed(2)}, interés L. ${interesEfectivo.toFixed(2)}${interesMoratorio > 0 ? `, mora L. ${interesMoratorio.toFixed(2)}` : ""})`,
      referencia_tipo: "pago",
      referencia_id: nuevoPagoId,
      id_socio: prestamoData.id_usuario,
      id_registrado_por: req.usuario?.id_usuario,
      fecha: fechaPagoStr === hoy ? null : `${fechaPagoStr} 12:00:00`,
    });

    // Actualizar saldo del préstamo
    await connection.query(
      `UPDATE prestamos SET saldo_restante = ? WHERE id_prestamo = ?`,
      [nuevoSaldo, id_prestamo]
    );

    // Recibo numerado del pago
    const idRecibo = await crearRecibo(connection, {
      tipo: "pago_prestamo",
      referencia_tipo: "pago",
      referencia_id: nuevoPagoId,
      id_socio: prestamoData.id_usuario,
      monto: montoPagadoNum,
      metodo: metodo_pago,
      concepto: `Pago de préstamo #${id_prestamo}`,
      detalle: {
        id_prestamo,
        capital: capitalDelPeriodo,
        interes: interesEfectivo,
        mora: parseFloat(interesMoratorio.toFixed(2)),
        mora_condonada: moraCondonada ? parseFloat(moraGenerada.toFixed(2)) : 0,
        saldo_anterior: saldoActual,
        saldo_nuevo: nuevoSaldo,
        liquidado: prestamoLiquidado,
      },
      fecha: fechaPagoStr === hoy ? null : `${fechaPagoStr} 12:00:00`,
      emitido_por: req.usuario?.id_usuario,
    });

    // Si el préstamo fue liquidado, cambiar estado y emitir la constancia de finiquito
    let idFiniquito = null;
    if (prestamoLiquidado) {
      await connection.query(
        `UPDATE prestamos SET estado = 'pagado', saldo_restante = 0.00 WHERE id_prestamo = ?`,
        [id_prestamo]
      );
      idFiniquito = await emitirFiniquito(connection, id_prestamo, req.usuario?.id_usuario);
    } else if (prestamoData.estado === 'mora' && (diasMora === 0 || interesMoratorio > 0 || moraCondonada)) {
      // La mora quedó pagada (o fue omitida) con este pago: el préstamo vuelve a activo
      await connection.query(
        `UPDATE prestamos SET estado = 'activo' WHERE id_prestamo = ?`,
        [id_prestamo]
      );
    }

    // Registrar en bitácora
    let detalleBitacora = `Pago de L. ${montoPagadoNum.toFixed(2)} registrado en préstamo #${id_prestamo}. Saldo actualizado: L. ${nuevoSaldo.toFixed(2)}`;
    
    if (interesMoratorio > 0) {
      detalleBitacora += `. Incluye interés moratorio: L. ${interesMoratorio.toFixed(2)} (${diasMora} días de mora)`;
    }
    if (moraCondonada) {
      detalleBitacora += `. MORA OMITIDA por Super Administrador: L. ${moraGenerada.toFixed(2)} (${diasMora} días de mora)`;
    }
    
    if (prestamoLiquidado) {
      detalleBitacora += `. PRÉSTAMO LIQUIDADO TOTALMENTE`;
    }

    await connection.query(
      `INSERT INTO bitacora (id_usuario, accion, detalle, fecha) 
       VALUES (?, ?, ?, NOW())`,
      [prestamoData.id_usuario, "Registro de pago de préstamo", detalleBitacora]
    );

    if (reporte) {
      await connection.query(
        `UPDATE pagos_reportados SET estado = 'confirmado', id_pago = ?, revisado_por = ?, revisado_en = NOW()
         WHERE id_reporte = ?`,
        [nuevoPagoId, req.usuario?.id_usuario || null, reporte.id_reporte]
      );
    }

    await connection.commit();

    // Aviso al socio con su recibo: por correo si reportó el pago desde la app, y siempre en su campanita
    const lps = (n) => `L. ${n.toLocaleString("es-HN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const tituloAviso = prestamoLiquidado
      ? `¡Préstamo #${id_prestamo} cancelado!`
      : reporte
      ? "Tu pago fue confirmado"
      : "Pago registrado";
    const mensajeAviso =
      `${reporte ? "Confirmamos el pago" : "Registramos tu pago"} de ${lps(montoPagadoNum)} a tu préstamo #${id_prestamo}. ` +
      (prestamoLiquidado ? "Tu préstamo quedó totalmente pagado. " : `Tu nuevo saldo es ${lps(nuevoSaldo)}. `) +
      "Ya puedes ver tu recibo.";
    if (reporte) {
      notificarSocio(
        reporte.id_usuario,
        tituloAviso,
        `<p>${mensajeAviso}</p><p>¡Gracias por tu pago!</p>`,
        undefined,
        { tipo: "pago", idRecibo }
      );
    } else {
      crearNotificacion(prestamoData.id_usuario, { titulo: tituloAviso, mensaje: mensajeAviso, tipo: "pago", idRecibo });
    }

    res.status(201).json({
      success: true,
      message: prestamoLiquidado ? "Pago registrado. ¡PRÉSTAMO LIQUIDADO!" : "Pago registrado correctamente",
      id_pago: nuevoPagoId,
      id_recibo: idRecibo,
      id_finiquito: idFiniquito,
      detalles: {
        monto_pagado: montoPagadoNum,
        monto_capital: capitalDelPeriodo,
        monto_interes: interesEfectivo,
        saldo_anterior: saldoActual,
        saldo_nuevo: nuevoSaldo,
        cuota_mensual_esperada: parseFloat(cuotaMensual.toFixed(2)),
        dias_mora: diasMora,
        dias_interes: diasInteres,
        modo_interes: modo,
        interes_moratorio: parseFloat(interesMoratorio.toFixed(2)),
        mora_condonada: moraCondonada ? parseFloat(moraGenerada.toFixed(2)) : 0,
        prestamo_liquidado: prestamoLiquidado,
      },
    });

  } catch (error) {
    await connection.rollback();
    console.error("ERROR AL REGISTRAR PAGO:", error);
    res.status(500).json({ 
      message: "Error al registrar el pago", 
      error: error.message 
    });
  } finally {
    connection.release();
  }
});

// ============================================
// CALCULAR INFORMACIÓN DE PRÓXIMO PAGO
// ============================================
router.get("/prestamo/:id_prestamo/proximo-pago", async (req, res) => {
  try {
    // Obtener préstamo
    const [prestamo] = await pool.query(
      `SELECT * FROM prestamos WHERE id_prestamo = ?`,
      [req.params.id_prestamo]
    );

    if (prestamo.length === 0) {
      return res.status(404).json({ message: "Préstamo no encontrado" });
    }

    const prestamoData = prestamo[0];

    if (prestamoData.estado === 'pagado') {
      return res.json({
        success: true,
        mensaje: "El préstamo ya está completamente pagado",
        prestamo_liquidado: true,
      });
    }

    // Calcular cuota mensual
    const cuotaMensual = calcularCuotaMensual(
      parseFloat(prestamoData.monto),
      parseFloat(prestamoData.tasa_interes),
      parseInt(prestamoData.plazo_meses)
    );

    // Obtener último pago
    const [ultimoPago] = await pool.query(
      `SELECT fecha_pago FROM pagos_prestamo 
       WHERE id_prestamo = ? 
       ORDER BY fecha_pago DESC 
       LIMIT 1`,
      [req.params.id_prestamo]
    );

    // Calcular fecha de vencimiento del próximo pago
    let fechaProximoPago;
    if (ultimoPago.length > 0) {
      fechaProximoPago = new Date(ultimoPago[0].fecha_pago);
      fechaProximoPago.setMonth(fechaProximoPago.getMonth() + 1);
    } else {
      fechaProximoPago = new Date(prestamoData.fecha_otorgado);
      fechaProximoPago.setMonth(fechaProximoPago.getMonth() + 1);
    }

    // Calcular días de mora
    const diasMora = calcularDiasMora(
      prestamoData.fecha_otorgado,
      ultimoPago.length > 0 ? ultimoPago[0].fecha_pago : null
    );

    // Calcular interés moratorio si aplica
    let interesMoratorio = 0;
    if (diasMora > 0) {
      interesMoratorio = calcularInteresMoratorio(
        parseFloat(prestamoData.saldo_restante),
        diasMora
      );
    }

    // Total a pagar (cuota + mora si aplica)
    const totalAPagar = cuotaMensual + interesMoratorio;

    // Calcular cuántas cuotas faltan
    const [totalPagos] = await pool.query(
      `SELECT COUNT(*) as total FROM pagos_prestamo WHERE id_prestamo = ?`,
      [req.params.id_prestamo]
    );

    // Monto para saldar hoy: saldo + interés proporcional por días desde el último pago
    const liq = liquidacionAlDia({
      saldo: prestamoData.saldo_restante,
      tasaAnual: prestamoData.tasa_interes,
      fechaOtorgado: prestamoData.fecha_otorgado,
      fechaUltimoPago: ultimoPago.length > 0 ? ultimoPago[0].fecha_pago : null,
    });

    const cuotasPagadas = totalPagos[0].total;
    const cuotasFaltantes = parseInt(prestamoData.plazo_meses) - cuotasPagadas;

    res.json({
      success: true,
      proximo_pago: {
        fecha_vencimiento: fechaProximoPago.toISOString().split('T')[0],
        cuota_mensual: parseFloat(cuotaMensual.toFixed(2)),
        saldo_actual: parseFloat(prestamoData.saldo_restante),
        dias_mora: diasMora,
        interes_moratorio: parseFloat(interesMoratorio.toFixed(2)),
        mora_por_dia: parseFloat(calcularInteresMoratorio(parseFloat(prestamoData.saldo_restante), 1).toFixed(2)),
        total_a_pagar: parseFloat(totalAPagar.toFixed(2)),
        cuotas_pagadas: cuotasPagadas,
        cuotas_faltantes: cuotasFaltantes,
        en_mora: diasMora > 0,
        dias_desde_ultimo_pago: liq.dias,
        interes_para_saldar: liq.interes,
        total_para_saldar: parseFloat((parseFloat(prestamoData.saldo_restante) + liq.interes + interesMoratorio).toFixed(2)),
      },
    });

  } catch (error) {
    console.error("ERROR AL CALCULAR PRÓXIMO PAGO:", error);
    res.status(500).json({ 
      message: "Error al calcular el próximo pago", 
      error: error.message 
    });
  }
});

// ============================================
// OBTENER COMPROBANTE DE PAGO
// ============================================
router.get("/:id/comprobante", async (req, res) => {
  try {
    const [pago] = await pool.query(
      `SELECT p.*, 
       pre.monto AS monto_prestamo, 
       pre.tasa_interes,
       pre.plazo_meses,
       pre.fecha_otorgado,
       u.nombre_completo,
       u.dni,
       u.telefono,
       u.direccion,
       u.correo
       FROM pagos_prestamo p
       INNER JOIN prestamos pre ON p.id_prestamo = pre.id_prestamo
       INNER JOIN usuarios u ON pre.id_usuario = u.id_usuario
       WHERE p.id_pago = ?`,
      [req.params.id]
    );

    if (pago.length === 0) {
      return res.status(404).json({ message: "Pago no encontrado" });
    }

    const pagoData = pago[0];

    // Calcular cuota mensual
    const cuotaMensual = calcularCuotaMensual(
      parseFloat(pagoData.monto_prestamo),
      parseFloat(pagoData.tasa_interes),
      parseInt(pagoData.plazo_meses)
    );

    // Obtener número de cuota (cuántos pagos lleva)
    const [totalPagos] = await pool.query(
      `SELECT COUNT(*) as total 
       FROM pagos_prestamo 
       WHERE id_prestamo = ? AND id_pago <= ?`,
      [pagoData.id_prestamo, req.params.id]
    );

    const comprobante = {
      numero_comprobante: `PAGO-${String(req.params.id).padStart(6, '0')}`,
      fecha_emision: hoyISO(),
      fecha_pago: pagoData.fecha_pago,
      
      // Datos del socio
      socio: {
        nombre: pagoData.nombre_completo,
        dni: pagoData.dni,
        telefono: pagoData.telefono,
        direccion: pagoData.direccion,
        correo: pagoData.correo,
      },
      
      // Datos del préstamo
      prestamo: {
        numero: pagoData.id_prestamo,
        monto_original: parseFloat(pagoData.monto_prestamo),
        tasa_interes: parseFloat(pagoData.tasa_interes),
        plazo_meses: parseInt(pagoData.plazo_meses),
        cuota_mensual: parseFloat(cuotaMensual.toFixed(2)),
      },
      
      // Datos del pago
      pago: {
        numero_cuota: totalPagos[0].total,
        monto_pagado: parseFloat(pagoData.monto_pagado),
        metodo_pago: pagoData.metodo_pago,
        saldo_restante: parseFloat(pagoData.saldo_restante),
      },
    };

    res.json({
      success: true,
      comprobante: comprobante,
    });

  } catch (error) {
    console.error("ERROR AL OBTENER COMPROBANTE:", error);
    res.status(500).json({ 
      message: "Error al obtener el comprobante", 
      error: error.message 
    });
  }
});

// ============================================
// EDITAR UN PAGO (monto, método, descripción)
// Solo recalcula si el monto cambia; si solo cambia método/descripción actualiza directo
// ============================================
router.put("/:id", async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { monto_pagado, metodo_pago, descripcion } = req.body;
    const montoPagadoNum = parseFloat(monto_pagado);
    if (isNaN(montoPagadoNum) || montoPagadoNum <= 0)
      return res.status(400).json({ message: "El monto debe ser un número positivo." });

    // El ENUM del DB es lowercase — normalizar
    const metodosValidos = ['efectivo', 'transferencia', 'cheque', 'deposito'];
    const metodoNorm = metodo_pago
      ? (metodosValidos.find(m => m === metodo_pago.toLowerCase()) || 'efectivo')
      : 'efectivo';

    // Obtener el pago actual junto con datos del préstamo
    const [pagoRows] = await connection.query(
      `SELECT p.id_pago, p.id_prestamo, p.monto_pagado, p.fecha_pago,
              pre.monto AS monto_original, pre.tasa_interes, pre.id_usuario
       FROM pagos_prestamo p
       INNER JOIN prestamos pre ON p.id_prestamo = pre.id_prestamo
       WHERE p.id_pago = ?`,
      [req.params.id]
    );
    if (pagoRows.length === 0)
      return res.status(404).json({ message: "Pago no encontrado." });

    const pagoData   = pagoRows[0];
    const idPrestamo = pagoData.id_prestamo;
    const montoAnterior = parseFloat(pagoData.monto_pagado);
    const montoChanged  = Math.abs(montoPagadoNum - montoAnterior) >= 0.005;

    await connection.beginTransaction();

    if (!montoChanged) {
      // Solo actualizar método — sin tocar montos ni saldos
      await connection.query(
        `UPDATE pagos_prestamo SET metodo_pago = ? WHERE id_pago = ?`,
        [metodoNorm, req.params.id]
      );
    } else {
      // Monto cambió → recalcular este pago y todos los posteriores
      const tasaMensual = parseFloat(pagoData.tasa_interes) / 100 / 12;

      const [todosPagos] = await connection.query(
        `SELECT * FROM pagos_prestamo WHERE id_prestamo = ? ORDER BY fecha_pago ASC, id_pago ASC`,
        [idPrestamo]
      );

      // Calcular el saldo antes del pago editado
      let saldo = parseFloat(pagoData.monto_original);
      let encontrado = false;
      for (const pg of todosPagos) {
        if (pg.id_pago === parseInt(req.params.id)) { encontrado = true; break; }
        saldo = parseFloat(pg.saldo_restante ?? saldo);
      }
      if (!encontrado) {
        await connection.rollback();
        return res.status(404).json({ message: "Pago no encontrado en la secuencia." });
      }

      // Recalcular desde el pago editado en adelante
      let actualizando = false;
      for (const pg of todosPagos) {
        if (pg.id_pago === parseInt(req.params.id)) actualizando = true;
        if (!actualizando) continue;

        const montoEste  = pg.id_pago === parseInt(req.params.id) ? montoPagadoNum : parseFloat(pg.monto_pagado);
        const interes    = parseFloat((saldo * tasaMensual).toFixed(2));
        const capital    = parseFloat(Math.max(0, montoEste - interes).toFixed(2));
        const nuevoSaldo = parseFloat(Math.max(0, saldo - capital).toFixed(2));
        const metodoEste = pg.id_pago === parseInt(req.params.id) ? metodoNorm : pg.metodo_pago;

        await connection.query(
          `UPDATE pagos_prestamo
           SET monto_pagado = ?, monto_capital = ?, monto_interes = ?, saldo_restante = ?, metodo_pago = ?
           WHERE id_pago = ?`,
          [montoEste, capital, interes, nuevoSaldo, metodoEste, pg.id_pago]
        );
        saldo = nuevoSaldo;
      }

      // Actualizar saldo del préstamo
      await connection.query(
        `UPDATE prestamos SET saldo_restante = ?, estado = IF(? <= 0.01, 'pagado', estado) WHERE id_prestamo = ?`,
        [saldo, saldo, idPrestamo]
      );

      // Caja: la diferencia del monto editado entra o sale como ajuste
      const diferenciaCaja = parseFloat((montoPagadoNum - montoAnterior).toFixed(2));
      if (Math.abs(diferenciaCaja) >= 0.01) {
        await registrarCaja(connection, {
          tipo: diferenciaCaja > 0 ? "ingreso" : "egreso",
          categoria: "ajuste_pago",
          monto: Math.abs(diferenciaCaja),
          metodo: metodoNorm,
          descripcion: `Ajuste por edición del pago #${req.params.id}: de L. ${montoAnterior.toFixed(2)} a L. ${montoPagadoNum.toFixed(2)}`,
          referencia_tipo: "pago",
          referencia_id: parseInt(req.params.id),
          id_socio: pagoData.id_usuario,
          id_registrado_por: req.usuario?.id_usuario,
        });
      }
    }

    await connection.commit();
    res.json({ success: true, message: "Pago actualizado correctamente." });
  } catch (error) {
    await connection.rollback();
    console.error("ERROR AL EDITAR PAGO:", error);
    res.status(500).json({ message: error.message || "Error al editar el pago." });
  } finally {
    connection.release();
  }
});

// ============================================
// ANULAR/ELIMINAR UN PAGO (CON REVERSIÓN)
// ============================================
router.delete("/:id", async (req, res) => {
  const connection = await pool.getConnection();
  
  const fail = async (codigo, cuerpo) => {
    await connection.rollback().catch(() => {});
    return res.status(codigo).json(cuerpo);
  };

  try {
    const motivo = String(req.body?.motivo || req.query.motivo || "").trim();
    if (motivo.length < 3) {
      return fail(400, { message: "Indica el motivo de la anulación (mínimo 3 caracteres)." });
    }

    await connection.beginTransaction();

    // Obtener el pago (bloqueando el préstamo para evitar cambios simultáneos)
    const [pago] = await connection.query(
      `SELECT p.*, pre.id_usuario, pre.saldo_restante as saldo_prestamo_actual
       FROM pagos_prestamo p
       INNER JOIN prestamos pre ON p.id_prestamo = pre.id_prestamo
       WHERE p.id_pago = ?
       FOR UPDATE`,
      [req.params.id]
    );

    if (pago.length === 0) {
      return fail(404, { message: "Pago no encontrado" });
    }

    const pagoData = pago[0];

    // Verificar que sea el último pago registrado
    const [ultimoPago] = await connection.query(
      `SELECT id_pago FROM pagos_prestamo 
       WHERE id_prestamo = ? 
       ORDER BY fecha_pago DESC 
       LIMIT 1`,
      [pagoData.id_prestamo]
    );

    if (ultimoPago.length > 0 && ultimoPago[0].id_pago !== parseInt(req.params.id)) {
      return fail(400, { 
        message: "Solo se puede anular el último pago registrado" 
      });
    }

    // Calcular nuevo saldo del préstamo (reversión)
    // Se restaura solo el capital amortizado, no el monto total del pago
    const capitalAnulado = parseFloat(pagoData.monto_capital || pagoData.monto_pagado);
    const nuevoSaldo = parseFloat(pagoData.saldo_prestamo_actual) + capitalAnulado;

    // Actualizar saldo del préstamo
    await connection.query(
      `UPDATE prestamos SET saldo_restante = ?, estado = 'activo' WHERE id_prestamo = ?`,
      [nuevoSaldo, pagoData.id_prestamo]
    );

    // Archivar el pago anulado (auditoría) y retirarlo del historial activo
    await connection.query(
      `INSERT INTO pagos_anulados
         (id_pago, id_prestamo, monto_pagado, monto_capital, monto_interes, metodo_pago,
          saldo_restante, fecha_pago, motivo, anulado_por)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        pagoData.id_pago, pagoData.id_prestamo, pagoData.monto_pagado, pagoData.monto_capital,
        pagoData.monto_interes, pagoData.metodo_pago, pagoData.saldo_restante, pagoData.fecha_pago,
        motivo.substring(0, 255), req.usuario?.id_usuario || null,
      ]
    );

    await connection.query(
      `DELETE FROM pagos_prestamo WHERE id_pago = ?`,
      [req.params.id]
    );

    await connection.query(
      `UPDATE recibos SET anulado = 1 WHERE referencia_tipo = 'pago' AND referencia_id = ?`,
      [pagoData.id_pago]
    );

    // El préstamo vuelve a quedar con saldo: la constancia de finiquito deja de ser válida
    await connection.query(
      `UPDATE recibos SET anulado = 1
       WHERE tipo = 'finiquito' AND referencia_tipo = 'finiquito' AND referencia_id = ?`,
      [pagoData.id_prestamo]
    );

    // Contrapartida en caja: sale el dinero que había entrado por este pago
    await registrarCaja(connection, {
      tipo: "egreso",
      categoria: "anulacion_pago",
      monto: pagoData.monto_pagado,
      metodo: pagoData.metodo_pago,
      descripcion: `Anulación del pago #${pagoData.id_pago} (préstamo #${pagoData.id_prestamo}). Motivo: ${motivo}`,
      referencia_tipo: "pago",
      referencia_id: pagoData.id_pago,
      id_socio: pagoData.id_usuario,
      id_registrado_por: req.usuario?.id_usuario,
    });

    // Registrar en bitácora
    await connection.query(
      `INSERT INTO bitacora (id_usuario, accion, detalle, fecha) 
       VALUES (?, ?, ?, NOW())`,
      [
        pagoData.id_usuario,
        "Anulación de pago",
        `Pago #${req.params.id} anulado. Monto: L. ${parseFloat(pagoData.monto_pagado).toFixed(2)}. Saldo restaurado a: L. ${nuevoSaldo.toFixed(2)}. Motivo: ${motivo}`
      ]
    );

    await connection.commit();

    res.json({ 
      success: true,
      message: "Pago anulado correctamente y saldo restaurado",
      saldo_restaurado: nuevoSaldo,
    });

  } catch (error) {
    await connection.rollback();
    console.error("ERROR AL ANULAR PAGO:", error);
    res.status(500).json({ 
      message: "Error al anular el pago", 
      error: error.message 
    });
  } finally {
    connection.release();
  }
});

// ============================================
// OBTENER HISTORIAL DE PAGOS DE UN USUARIO
// ============================================
router.get("/usuario/:id_usuario/historial", async (req, res) => {
  try {
    const [pagos] = await pool.query(
      `SELECT p.*, 
       pre.monto AS monto_prestamo,
       pre.tasa_interes,
       pre.plazo_meses
       FROM pagos_prestamo p
       INNER JOIN prestamos pre ON p.id_prestamo = pre.id_prestamo
       WHERE pre.id_usuario = ?
       ORDER BY p.fecha_pago DESC`,
      [req.params.id_usuario]
    );

    // Calcular totales
    const totales = {
      total_pagos: pagos.length,
      monto_total_pagado: pagos.reduce((sum, p) => sum + parseFloat(p.monto_pagado), 0),
      prestamos_distintos: [...new Set(pagos.map(p => p.id_prestamo))].length,
    };

    res.json({
      success: true,
      data: pagos,
      totales: totales,
    });

  } catch (error) {
    console.error("ERROR AL OBTENER HISTORIAL:", error);
    res.status(500).json({ 
      message: "Error al obtener el historial de pagos", 
      error: error.message 
    });
  }
});

// ============================================
// ESTADÍSTICAS GENERALES DE PAGOS
// ============================================
router.get("/estadisticas/general", async (req, res) => {
  try {
    // Totales generales
    const [totales] = await pool.query(`
      SELECT 
      COUNT(*) as total_pagos,
      IFNULL(SUM(monto_pagado), 0) as monto_total_recaudado,
      IFNULL(AVG(monto_pagado), 0) as promedio_pago,
      COUNT(DISTINCT id_prestamo) as prestamos_con_pagos
      FROM pagos_prestamo
    `);

    // Pagos este mes
    const [esteMes] = await pool.query(`
      SELECT 
      COUNT(*) as total_pagos,
      IFNULL(SUM(monto_pagado), 0) as monto_total
      FROM pagos_prestamo
      WHERE MONTH(fecha_pago) = MONTH(CURRENT_DATE())
      AND YEAR(fecha_pago) = YEAR(CURRENT_DATE())
    `);

    // Pagos por método
    const [porMetodo] = await pool.query(`
      SELECT 
      metodo_pago,
      COUNT(*) as cantidad,
      IFNULL(SUM(monto_pagado), 0) as monto_total
      FROM pagos_prestamo
      GROUP BY metodo_pago
    `);

    // Últimos 5 pagos
    const [ultimosPagos] = await pool.query(`
      SELECT p.*, u.nombre_completo
      FROM pagos_prestamo p
      INNER JOIN prestamos pre ON p.id_prestamo = pre.id_prestamo
      INNER JOIN usuarios u ON pre.id_usuario = u.id_usuario
      ORDER BY p.fecha_pago DESC
      LIMIT 5
    `);

    // Pagos por mes (últimos 6 meses)
    const [porMes] = await pool.query(`
      SELECT 
      DATE_FORMAT(fecha_pago, '%Y-%m') as mes,
      COUNT(*) as cantidad,
      IFNULL(SUM(monto_pagado), 0) as monto_total
      FROM pagos_prestamo
      WHERE fecha_pago >= DATE_SUB(CURRENT_DATE(), INTERVAL 6 MONTH)
      GROUP BY DATE_FORMAT(fecha_pago, '%Y-%m')
      ORDER BY mes DESC
    `);

    res.json({
      success: true,
      estadisticas: {
        totales: totales[0],
        este_mes: esteMes[0],
        por_metodo: porMetodo,
        ultimos_pagos: ultimosPagos,
        por_mes: porMes,
      },
    });

  } catch (error) {
    console.error("ERROR AL OBTENER ESTADÍSTICAS:", error);
    res.status(500).json({ 
      message: "Error al obtener estadísticas", 
      error: error.message 
    });
  }
});

// ============================================
// GENERAR REPORTE DE MOROSIDAD
// ============================================
router.get("/reportes/morosidad", async (req, res) => {
  try {
    // Obtener préstamos activos y en mora
    const [prestamos] = await pool.query(
      `SELECT p.*, 
       u.nombre_completo,
       u.dni,
       u.telefono,
       (SELECT MAX(fecha_pago) FROM pagos_prestamo WHERE id_prestamo = p.id_prestamo) as ultimo_pago,
       (SELECT COUNT(*) FROM pagos_prestamo WHERE id_prestamo = p.id_prestamo) as total_pagos
       FROM prestamos p
       INNER JOIN usuarios u ON p.id_usuario = u.id_usuario
       WHERE p.estado IN ('activo', 'mora')`
    );

    const prestamosConMora = [];

    for (const prestamo of prestamos) {
      // Calcular días de mora
      const diasMora = calcularDiasMora(
        prestamo.fecha_otorgado,
        prestamo.ultimo_pago
      );

      if (diasMora > 0) {
        const cuotaMensual = calcularCuotaMensual(
          parseFloat(prestamo.monto),
          parseFloat(prestamo.tasa_interes),
          parseInt(prestamo.plazo_meses)
        );

        const interesMoratorio = calcularInteresMoratorio(
          parseFloat(prestamo.saldo_restante),
          diasMora
        );

        prestamosConMora.push({
          id_prestamo: prestamo.id_prestamo,
          socio: {
            nombre: prestamo.nombre_completo,
            dni: prestamo.dni,
            telefono: prestamo.telefono,
          },
          monto_prestamo: parseFloat(prestamo.monto),
          saldo_restante: parseFloat(prestamo.saldo_restante),
          cuota_mensual: parseFloat(cuotaMensual.toFixed(2)),
          dias_mora: diasMora,
          interes_moratorio: parseFloat(interesMoratorio.toFixed(2)),
          total_adeudado: parseFloat((parseFloat(prestamo.saldo_restante) + interesMoratorio).toFixed(2)),
          cuotas_pagadas: prestamo.total_pagos,
          estado: prestamo.estado,
        });
      }
    }

    // Ordenar por días de mora (mayor a menor)
    prestamosConMora.sort((a, b) => b.dias_mora - a.dias_mora);

    // Calcular totales
    const totales = {
      total_prestamos_mora: prestamosConMora.length,
      monto_total_mora: prestamosConMora.reduce((sum, p) => sum + p.saldo_restante, 0),
      intereses_moratorios_total: prestamosConMora.reduce((sum, p) => sum + p.interes_moratorio, 0),
    };

    res.json({
      success: true,
      fecha_reporte: hoyISO(),
      totales: totales,
      prestamos_en_mora: prestamosConMora,
    });

  } catch (error) {
    console.error("ERROR AL GENERAR REPORTE DE MOROSIDAD:", error);
    res.status(500).json({ 
      message: "Error al generar reporte de morosidad", 
      error: error.message 
    });
  }
});

module.exports = router;
