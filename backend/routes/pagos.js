const express = require("express");
const router = express.Router();
const pool = require("../db");

// ============================================
// FUNCIONES AUXILIARES Y CÁLCULOS
// ============================================

// Calcular cuota mensual (sistema francés)
const calcularCuotaMensual = (monto, tasaAnual, plazoMeses) => {
  const tasaMensual = (tasaAnual / 100) / 12;
  const cuota = monto * (tasaMensual * Math.pow(1 + tasaMensual, plazoMeses)) / 
                (Math.pow(1 + tasaMensual, plazoMeses) - 1);
  return cuota;
};

// Calcular interés moratorio (tasa adicional del 2% mensual sobre saldo vencido)
const calcularInteresMoratorio = (saldoVencido, diasMora) => {
  const tasaMoratoriaAnual = 24; // 2% mensual = 24% anual
  const tasaMoratoriaDiaria = tasaMoratoriaAnual / 365 / 100;
  const interesMoratorio = saldoVencido * tasaMoratoriaDiaria * diasMora;
  return interesMoratorio;
};

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

// Calcular días de mora
const calcularDiasMora = (fechaOtorgado, fechaUltimoPago = null) => {
  const hoy = new Date();
  const fechaReferencia = fechaUltimoPago ? new Date(fechaUltimoPago) : new Date(fechaOtorgado);
  
  // Agregar 30 días (un mes) a la fecha de referencia
  const fechaVencimiento = new Date(fechaReferencia);
  fechaVencimiento.setDate(fechaVencimiento.getDate() + 30);
  
  if (hoy > fechaVencimiento) {
    const diasMora = Math.floor((hoy - fechaVencimiento) / (1000 * 60 * 60 * 24));
    return diasMora;
  }
  
  return 0;
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
  
  try {
    const { id_prestamo, monto_pagado, metodo_pago, incluir_mora } = req.body;

    // Validaciones
    if (!id_prestamo || !monto_pagado) {
      return res.status(400).json({ 
        message: "Préstamo y monto pagado son requeridos." 
      });
    }

    const montoPagadoNum = parseFloat(monto_pagado);
    if (isNaN(montoPagadoNum) || montoPagadoNum <= 0) {
      return res.status(400).json({ 
        message: "El monto debe ser un número positivo" 
      });
    }

    // Obtener información del préstamo
    const [prestamo] = await connection.query(
      `SELECT p.*, u.nombre_completo 
       FROM prestamos p
       INNER JOIN usuarios u ON p.id_usuario = u.id_usuario
       WHERE p.id_prestamo = ?`,
      [id_prestamo]
    );

    if (prestamo.length === 0) {
      return res.status(404).json({ message: "Préstamo no encontrado" });
    }

    const prestamoData = prestamo[0];

    if (prestamoData.estado === 'pagado') {
      return res.status(400).json({ 
        message: "El préstamo ya está completamente pagado" 
      });
    }

    if (prestamoData.estado === 'pendiente') {
      return res.status(400).json({ 
        message: "El préstamo aún no ha sido aprobado" 
      });
    }

    const saldoActual = parseFloat(prestamoData.saldo_restante);

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

    // Calcular interés moratorio si aplica
    let interesMoratorio = 0;
    if (diasMora > 0 && incluir_mora) {
      interesMoratorio = calcularInteresMoratorio(saldoActual, diasMora);
    }

    // Calcular nuevo saldo
    let montoAplicado = montoPagadoNum;
    
    // Si hay interés moratorio, aplicarlo primero
    if (interesMoratorio > 0) {
      montoAplicado -= interesMoratorio;
    }

    const nuevoSaldo = Math.max(0, saldoActual - montoAplicado);
    const prestamoLiquidado = nuevoSaldo <= 0.01; // Considerar liquidado si queda menos de 1 centavo

    await connection.beginTransaction();

    // Registrar el pago
    const [result] = await connection.query(
      `INSERT INTO pagos_prestamo (id_prestamo, monto_pagado, metodo_pago, saldo_restante, fecha_pago) 
       VALUES (?, ?, ?, ?, NOW())`,
      [id_prestamo, montoPagadoNum, metodo_pago || 'Efectivo', nuevoSaldo]
    );

    const nuevoPagoId = result.insertId;

    // Actualizar saldo del préstamo
    await connection.query(
      `UPDATE prestamos SET saldo_restante = ? WHERE id_prestamo = ?`,
      [nuevoSaldo, id_prestamo]
    );

    // Si el préstamo fue liquidado, cambiar estado
    if (prestamoLiquidado) {
      await connection.query(
        `UPDATE prestamos SET estado = 'pagado', saldo_restante = 0.00 WHERE id_prestamo = ?`,
        [id_prestamo]
      );
    } else if (prestamoData.estado === 'mora' && diasMora === 0) {
      // Si estaba en mora pero ya no tiene días de mora, volver a activo
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
    
    if (prestamoLiquidado) {
      detalleBitacora += `. PRÉSTAMO LIQUIDADO TOTALMENTE`;
    }

    await connection.query(
      `INSERT INTO bitacora (id_usuario, accion, detalle, fecha) 
       VALUES (?, ?, ?, NOW())`,
      [prestamoData.id_usuario, "Registro de pago de préstamo", detalleBitacora]
    );

    await connection.commit();

    res.status(201).json({
      success: true,
      message: prestamoLiquidado ? "Pago registrado. ¡PRÉSTAMO LIQUIDADO!" : "Pago registrado correctamente",
      id_pago: nuevoPagoId,
      detalles: {
        monto_pagado: montoPagadoNum,
        saldo_anterior: saldoActual,
        saldo_nuevo: nuevoSaldo,
        cuota_mensual_esperada: parseFloat(cuotaMensual.toFixed(2)),
        dias_mora: diasMora,
        interes_moratorio: parseFloat(interesMoratorio.toFixed(2)),
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
        total_a_pagar: parseFloat(totalAPagar.toFixed(2)),
        cuotas_pagadas: cuotasPagadas,
        cuotas_faltantes: cuotasFaltantes,
        en_mora: diasMora > 0,
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
      fecha_emision: new Date().toISOString().split('T')[0],
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
// ANULAR/ELIMINAR UN PAGO (CON REVERSIÓN)
// ============================================
router.delete("/:id", async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    // Obtener el pago
    const [pago] = await connection.query(
      `SELECT p.*, pre.id_usuario, pre.saldo_restante as saldo_prestamo_actual
       FROM pagos_prestamo p
       INNER JOIN prestamos pre ON p.id_prestamo = pre.id_prestamo
       WHERE p.id_pago = ?`,
      [req.params.id]
    );

    if (pago.length === 0) {
      return res.status(404).json({ message: "Pago no encontrado" });
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
      return res.status(400).json({ 
        message: "Solo se puede anular el último pago registrado" 
      });
    }

    await connection.beginTransaction();

    // Calcular nuevo saldo del préstamo (reversión)
    const nuevoSaldo = parseFloat(pagoData.saldo_prestamo_actual) + parseFloat(pagoData.monto_pagado);

    // Actualizar saldo del préstamo
    await connection.query(
      `UPDATE prestamos SET saldo_restante = ?, estado = 'activo' WHERE id_prestamo = ?`,
      [nuevoSaldo, pagoData.id_prestamo]
    );

    // Eliminar el pago
    await connection.query(
      `DELETE FROM pagos_prestamo WHERE id_pago = ?`,
      [req.params.id]
    );

    // Registrar en bitácora
    await connection.query(
      `INSERT INTO bitacora (id_usuario, accion, detalle, fecha) 
       VALUES (?, ?, ?, NOW())`,
      [
        pagoData.id_usuario,
        "Anulación de pago",
        `Pago #${req.params.id} anulado. Monto: L. ${parseFloat(pagoData.monto_pagado).toFixed(2)}. Saldo restaurado a: L. ${nuevoSaldo.toFixed(2)}`
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
      fecha_reporte: new Date().toISOString().split('T')[0],
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
