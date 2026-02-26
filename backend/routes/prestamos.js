const express = require("express");
const router = express.Router();
const pool = require("../db");

// ============================================
// FUNCIONES AUXILIARES Y CÁLCULOS
// ============================================

// Calcular cuota mensual (sistema francés de amortización)
const calcularCuotaMensual = (monto, tasaAnual, plazoMeses) => {
  const tasaMensual = (tasaAnual / 100) / 12;
  const cuota = monto * (tasaMensual * Math.pow(1 + tasaMensual, plazoMeses)) / 
                (Math.pow(1 + tasaMensual, plazoMeses) - 1);
  return cuota;
};

// Generar tabla de amortización
const generarTablaAmortizacion = (monto, tasaAnual, plazoMeses, fechaOtorgado) => {
  const tasaMensual = (tasaAnual / 100) / 12;
  const cuotaMensual = calcularCuotaMensual(monto, tasaAnual, plazoMeses);
  let saldoRestante = monto;
  const tabla = [];

  for (let i = 1; i <= plazoMeses; i++) {
    const interesCuota = saldoRestante * tasaMensual;
    const capitalCuota = cuotaMensual - interesCuota;
    saldoRestante = Math.max(0, saldoRestante - capitalCuota);

    // Calcular fecha de vencimiento (mes a mes)
    const fechaVencimiento = new Date(fechaOtorgado);
    fechaVencimiento.setMonth(fechaVencimiento.getMonth() + i);

    tabla.push({
      numero_cuota: i,
      cuota_total: parseFloat(cuotaMensual.toFixed(2)),
      capital: parseFloat(capitalCuota.toFixed(2)),
      interes: parseFloat(interesCuota.toFixed(2)),
      saldo_restante: parseFloat(saldoRestante.toFixed(2)),
      fecha_vencimiento: fechaVencimiento.toISOString().split('T')[0],
    });
  }

  return tabla;
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

// ============================================
// OBTENER TODOS LOS PRÉSTAMOS CON FILTROS
// ============================================
router.get("/", async (req, res) => {
  try {
    const { estado = '', id_usuario = '', search = '' } = req.query;

    let whereClause = "WHERE 1=1";
    let params = [];

    if (estado) {
      whereClause += ` AND p.estado = ?`;
      params.push(estado);
    }

    if (id_usuario) {
      whereClause += ` AND p.id_usuario = ?`;
      params.push(id_usuario);
    }

    if (search) {
      whereClause += ` AND (u.nombre_completo LIKE ? OR u.dni LIKE ?)`;
      const searchParam = `%${search}%`;
      params.push(searchParam, searchParam);
    }

    const [prestamos] = await pool.query(
      `SELECT p.*, 
       u.nombre_completo, 
       u.dni,
       (SELECT COUNT(*) FROM pagos_prestamo WHERE id_prestamo = p.id_prestamo) as total_pagos,
       (SELECT IFNULL(SUM(monto_pagado), 0) FROM pagos_prestamo WHERE id_prestamo = p.id_prestamo) as total_pagado
       FROM prestamos p 
       INNER JOIN usuarios u ON p.id_usuario = u.id_usuario
       ${whereClause}
       ORDER BY p.fecha_otorgado DESC`,
      params
    );

    // Calcular cuotas mensuales para cada préstamo
    const prestamosConCuotas = prestamos.map(p => ({
      ...p,
      cuota_mensual: parseFloat(calcularCuotaMensual(
        parseFloat(p.monto),
        parseFloat(p.tasa_interes),
        parseInt(p.plazo_meses)
      ).toFixed(2)),
    }));

    res.json({
      success: true,
      data: prestamosConCuotas,
      total: prestamos.length,
    });
  } catch (error) {
    console.error("ERROR AL OBTENER PRÉSTAMOS:", error);
    res.status(500).json({ 
      message: "Error al obtener los préstamos", 
      error: error.message 
    });
  }
});

// ============================================
// OBTENER UN PRÉSTAMO POR ID CON TABLA DE AMORTIZACIÓN
// ============================================
router.get("/:id", async (req, res) => {
  try {
    const [prestamo] = await pool.query(
      `SELECT p.*, 
       u.nombre_completo, 
       u.dni, 
       u.telefono, 
       u.correo
       FROM prestamos p 
       INNER JOIN usuarios u ON p.id_usuario = u.id_usuario
       WHERE p.id_prestamo = ?`,
      [req.params.id]
    );
    
    if (prestamo.length === 0) {
      return res.status(404).json({ message: "Préstamo no encontrado" });
    }

    const prestamoData = prestamo[0];

    // Calcular cuota mensual
    const cuotaMensual = calcularCuotaMensual(
      parseFloat(prestamoData.monto),
      parseFloat(prestamoData.tasa_interes),
      parseInt(prestamoData.plazo_meses)
    );

    // Generar tabla de amortización
    const tablaAmortizacion = generarTablaAmortizacion(
      parseFloat(prestamoData.monto),
      parseFloat(prestamoData.tasa_interes),
      parseInt(prestamoData.plazo_meses),
      prestamoData.fecha_otorgado
    );

    // Obtener historial de pagos
    const [pagos] = await pool.query(
      `SELECT * FROM pagos_prestamo 
       WHERE id_prestamo = ? 
       ORDER BY fecha_pago DESC`,
      [req.params.id]
    );

    res.json({
      success: true,
      prestamo: {
        ...prestamoData,
        cuota_mensual: parseFloat(cuotaMensual.toFixed(2)),
      },
      tabla_amortizacion: tablaAmortizacion,
      historial_pagos: pagos,
    });
  } catch (error) {
    console.error("ERROR AL OBTENER PRÉSTAMO:", error);
    res.status(500).json({ 
      message: "Error al obtener el préstamo", 
      error: error.message 
    });
  }
});

// ============================================
// OBTENER PRÉSTAMOS POR USUARIO
// ============================================
router.get("/usuario/:id_usuario", async (req, res) => {
  try {
    const [prestamos] = await pool.query(
      `SELECT p.*,
       (SELECT COUNT(*) FROM pagos_prestamo WHERE id_prestamo = p.id_prestamo) as total_pagos,
       (SELECT IFNULL(SUM(monto_pagado), 0) FROM pagos_prestamo WHERE id_prestamo = p.id_prestamo) as total_pagado
       FROM prestamos p
       WHERE p.id_usuario = ?
       ORDER BY p.fecha_otorgado DESC`,
      [req.params.id_usuario]
    );

    // Agregar cuota mensual a cada préstamo
    const prestamosConCuotas = prestamos.map(p => ({
      ...p,
      cuota_mensual: parseFloat(calcularCuotaMensual(
        parseFloat(p.monto),
        parseFloat(p.tasa_interes),
        parseInt(p.plazo_meses)
      ).toFixed(2)),
    }));

    // Calcular estadísticas
    const totales = {
      total_prestamos: prestamos.length,
      prestamos_activos: prestamos.filter(p => p.estado === 'activo').length,
      prestamos_en_mora: prestamos.filter(p => p.estado === 'mora').length,
      monto_total_prestado: prestamos.reduce((sum, p) => sum + parseFloat(p.monto), 0),
      saldo_total_pendiente: prestamos.reduce((sum, p) => sum + parseFloat(p.saldo_restante), 0),
    };

    res.json({
      success: true,
      data: prestamosConCuotas,
      estadisticas: totales,
    });
  } catch (error) {
    console.error("ERROR AL OBTENER PRÉSTAMOS DEL USUARIO:", error);
    res.status(500).json({ 
      message: "Error al obtener préstamos del usuario", 
      error: error.message 
    });
  }
});

// ============================================
// SOLICITAR UN NUEVO PRÉSTAMO
// ============================================
router.post("/solicitar", async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const { id_usuario, monto, tasa_interes, plazo_meses, descripcion } = req.body;

    // Validaciones
    if (!id_usuario || !monto || !tasa_interes || !plazo_meses) {
      return res.status(400).json({ 
        message: "Usuario, monto, tasa de interés y plazo son requeridos." 
      });
    }

    const montoNum = parseFloat(monto);
    const tasaNum = parseFloat(tasa_interes);
    const plazoNum = parseInt(plazo_meses);

    if (isNaN(montoNum) || montoNum <= 0) {
      return res.status(400).json({ message: "El monto debe ser positivo" });
    }

    if (isNaN(tasaNum) || tasaNum < 0 || tasaNum > 100) {
      return res.status(400).json({ message: "La tasa de interés debe estar entre 0 y 100" });
    }

    if (isNaN(plazoNum) || plazoNum <= 0 || plazoNum > 360) {
      return res.status(400).json({ message: "El plazo debe ser entre 1 y 360 meses" });
    }

    // Verificar que el usuario existe y está activo
    const [usuario] = await connection.query(
      `SELECT * FROM usuarios WHERE id_usuario = ? AND estado = 'activo'`,
      [id_usuario]
    );

    if (usuario.length === 0) {
      return res.status(404).json({ message: "Usuario no encontrado o inactivo" });
    }

    // Verificar si tiene préstamos en mora
    const [prestamosEnMora] = await connection.query(
      `SELECT COUNT(*) as total FROM prestamos 
       WHERE id_usuario = ? AND estado = 'mora'`,
      [id_usuario]
    );

    if (prestamosEnMora[0].total > 0) {
      return res.status(400).json({ 
        message: "El socio tiene préstamos en mora. No puede solicitar un nuevo préstamo." 
      });
    }

    // Calcular cuota mensual
    const cuotaMensual = calcularCuotaMensual(montoNum, tasaNum, plazoNum);

    await connection.beginTransaction();

    // Crear el préstamo con estado "pendiente"
    const [result] = await connection.query(
      `INSERT INTO prestamos (id_usuario, monto, tasa_interes, plazo_meses, saldo_restante, estado, fecha_otorgado) 
       VALUES (?, ?, ?, ?, ?, 'pendiente', NOW())`,
      [id_usuario, montoNum, tasaNum, plazoNum, montoNum]
    );

    const nuevoPrestamoId = result.insertId;

    // Registrar en bitácora
    await connection.query(
      `INSERT INTO bitacora (id_usuario, accion, detalle, fecha) 
       VALUES (?, ?, ?, NOW())`,
      [
        id_usuario,
        "Solicitud de préstamo",
        `Solicitud de préstamo por L. ${montoNum.toFixed(2)} a ${plazoNum} meses. Cuota mensual: L. ${cuotaMensual.toFixed(2)}`
      ]
    );

    await connection.commit();

    res.status(201).json({
      success: true,
      message: "Préstamo solicitado correctamente. Pendiente de aprobación.",
      id_prestamo: nuevoPrestamoId,
      cuota_mensual: parseFloat(cuotaMensual.toFixed(2)),
    });

  } catch (error) {
    await connection.rollback();
    console.error("ERROR AL SOLICITAR PRÉSTAMO:", error);
    res.status(500).json({ 
      message: "Error al solicitar el préstamo", 
      error: error.message 
    });
  } finally {
    connection.release();
  }
});

// ============================================
// APROBAR UN PRÉSTAMO Y DESEMBOLSAR
// ============================================
router.patch("/:id/aprobar", async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const { desembolsar_a_cuenta } = req.body;

    // Obtener el préstamo
    const [prestamo] = await connection.query(
      `SELECT p.*, u.nombre_completo 
       FROM prestamos p
       INNER JOIN usuarios u ON p.id_usuario = u.id_usuario
       WHERE p.id_prestamo = ?`,
      [req.params.id]
    );

    if (prestamo.length === 0) {
      return res.status(404).json({ message: "Préstamo no encontrado" });
    }

    if (prestamo[0].estado !== 'pendiente') {
      return res.status(400).json({ 
        message: `El préstamo no está pendiente de aprobación (estado actual: ${prestamo[0].estado})` 
      });
    }

    await connection.beginTransaction();

    // Actualizar estado  a "activo"
    await connection.query(
      `UPDATE prestamos SET estado = 'activo', fecha_otorgado = NOW() WHERE id_prestamo = ?`,
      [req.params.id]
    );

    // Si se solicita desembolsar a cuenta, agregar monto a cuenta del usuario
    if (desembolsar_a_cuenta) {
      // Buscar cuenta de Aportaciones del usuario
      const [cuenta] = await connection.query(
        `SELECT * FROM cuentas WHERE id_usuario = ? AND tipo_cuenta = 'Aportaciones' AND estado = 'activa' LIMIT 1`,
        [prestamo[0].id_usuario]
      );

      if (cuenta.length > 0) {
        const nuevoSaldo = parseFloat(cuenta[0].saldo_actual) + parseFloat(prestamo[0].monto);
        
        // Actualizar saldo
        await connection.query(
          `UPDATE cuentas SET saldo_actual = ? WHERE id_cuenta = ?`,
          [nuevoSaldo, cuenta[0].id_cuenta]
        );

        // Registrar movimiento
        await connection.query(
          `INSERT INTO movimientos_cuenta (id_cuenta, tipo, monto, descripcion, fecha) 
           VALUES (?, 'aporte', ?, ?, NOW())`,
          [
            cuenta[0].id_cuenta,
            parseFloat(prestamo[0].monto),
            `Desembolso de préstamo #${req.params.id}`
          ]
        );
      }
    }

    // Registrar en bitácora
    await connection.query(
      `INSERT INTO bitacora (id_usuario, accion, detalle, fecha) 
       VALUES (?, ?, ?, NOW())`,
      [
        prestamo[0].id_usuario,
        "Préstamo aprobado",
        `Préstamo #${req.params.id} aprobado por L. ${parseFloat(prestamo[0].monto).toFixed(2)}${desembolsar_a_cuenta ? ' y desembolsado a cuenta' : ''}`
      ]
    );

    await connection.commit();

    res.json({
      success: true,
      message: `Préstamo aprobado correctamente${desembolsar_a_cuenta ? ' y fondos desembolsados' : ''}`,
    });

  } catch (error) {
    await connection.rollback();
    console.error("ERROR AL APROBAR PRÉSTAMO:", error);
    res.status(500).json({ 
      message: "Error al aprobar el préstamo", 
      error: error.message 
    });
  } finally {
    connection.release();
  }
});

// ============================================
// RECHAZAR UN PRÉSTAMO
// ============================================
router.patch("/:id/rechazar", async (req, res) => {
  try {
    const { motivo } = req.body;

    // Obtener el préstamo
    const [prestamo] = await pool.query(
      `SELECT * FROM prestamos WHERE id_prestamo = ?`,
      [req.params.id]
    );

    if (prestamo.length === 0) {
      return res.status(404).json({ message: "Préstamo no encontrado" });
    }

    if (prestamo[0].estado !== 'pendiente') {
      return res.status(400).json({ 
        message: "Solo se pueden rechazar préstamos pendientes" 
      });
    }

    // Eliminar el préstamo
    await pool.query(
      `DELETE FROM prestamos WHERE id_prestamo = ?`,
      [req.params.id]
    );

    // Registrar en bitácora
    await registrarBitacora(
      prestamo[0].id_usuario,
      "Préstamo rechazado",
      `Préstamo #${req.params.id} rechazado. Motivo: ${motivo || 'No especificado'}`
    );

    res.json({
      success: true,
      message: "Préstamo rechazado",
    });

  } catch (error) {
    console.error("ERROR AL RECHAZAR PRÉSTAMO:", error);
    res.status(500).json({ 
      message: "Error al rechazar el préstamo", 
      error: error.message 
    });
  }
});

// ============================================
// ACTUALIZAR ESTADO DE PRÉSTAMO (mora/activo/pagado)
// ============================================
router.patch("/:id/estado", async (req, res) => {
  try {
    const { estado } = req.body;

    const estadosValidos = ['pendiente', 'activo', 'pagado', 'mora'];
    if (!estado || !estadosValidos.includes(estado)) {
      return res.status(400).json({ 
        message: "Estado inválido. Debe ser: pendiente, activo, pagado o mora" 
      });
    }

    const [prestamo] = await pool.query(
      `SELECT * FROM prestamos WHERE id_prestamo = ?`,
      [req.params.id]
    );

    if (prestamo.length === 0) {
      return res.status(404).json({ message: "Préstamo no encontrado" });
    }

    await pool.query(
      `UPDATE prestamos SET estado = ? WHERE id_prestamo = ?`,
      [estado, req.params.id]
    );

    // Registrar en bitácora
    await registrarBitacora(
      prestamo[0].id_usuario,
      "Cambio de estado de préstamo",
      `Préstamo #${req.params.id} cambió de estado a: ${estado}`
    );

    res.json({
      success: true,
      message: `Estado del préstamo actualizado a: ${estado}`,
    });

  } catch (error) {
    console.error("ERROR AL ACTUALIZAR ESTADO:", error);
    res.status(500).json({ 
      message: "Error al actualizar el estado", 
      error: error.message 
    });
  }
});

// ============================================
// CANCELAR/LIQUIDAR PRÉSTAMO COMPLETAMENTE
// ============================================
router.post("/:id/liquidar", async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    // Obtener el préstamo
    const [prestamo] = await connection.query(
      `SELECT * FROM prestamos WHERE id_prestamo = ?`,
      [req.params.id]
    );

    if (prestamo.length === 0) {
      return res.status(404).json({ message: "Préstamo no encontrado" });
    }

    if (prestamo[0].estado === 'pagado') {
      return res.status(400).json({ message: "El préstamo ya está pagado" });
    }

    const saldoRestante = parseFloat(prestamo[0].saldo_restante);

    await connection.beginTransaction();

    // Registrar el pago final
    await connection.query(
      `INSERT INTO pagos_prestamo (id_prestamo, monto_pagado, saldo_restante, metodo_pago, fecha_pago) 
       VALUES (?, ?, 0.00, 'Liquidación total', NOW())`,
      [req.params.id, saldoRestante]
    );

    // Actualizar préstamo a pagado
    await connection.query(
      `UPDATE prestamos SET saldo_restante = 0.00, estado = 'pagado' WHERE id_prestamo = ?`,
      [req.params.id]
    );

    // Registrar en bitácora
    await connection.query(
      `INSERT INTO bitacora (id_usuario, accion, detalle, fecha) 
       VALUES (?, ?, ?, NOW())`,
      [
        prestamo[0].id_usuario,
        "Liquidación de préstamo",
        `Préstamo #${req.params.id} liquidado completamente. Monto final: L. ${saldoRestante.toFixed(2)}`
      ]
    );

    await connection.commit();

    res.json({
      success: true,
      message: "Préstamo liquidado completamente",
      monto_liquidado: saldoRestante,
    });

  } catch (error) {
    await connection.rollback();
    console.error("ERROR AL LIQUIDAR PRÉSTAMO:", error);
    res.status(500).json({ 
      message: "Error al liquidar el préstamo", 
      error: error.message 
    });
  } finally {
    connection.release();
  }
});

// ============================================
// VERIFICAR Y ACTUALIZAR PRÉSTAMOS EN MORA
// ============================================
router.post("/verificar-mora", async (req, res) => {
  try {
    const hoy = new Date();
    
    // Obtener préstamos activos
    const [prestamosActivos] = await pool.query(
      `SELECT p.*, 
       (SELECT MAX(fecha_pago) FROM pagos_prestamo WHERE id_prestamo = p.id_prestamo) as ultimo_pago
       FROM prestamos p
       WHERE p.estado = 'activo'`
    );

    let prestamosEnMora = [];

    for (const prestamo of prestamosActivos) {
      const cuotaMensual = calcularCuotaMensual(
        parseFloat(prestamo.monto),
        parseFloat(prestamo.tasa_interes),
        parseInt(prestamo.plazo_meses)
      );

      // Calcular días desde el último pago o desde el otorgamiento
      const fechaReferencia = prestamo.ultimo_pago ? new Date(prestamo.ultimo_pago) : new Date(prestamo.fecha_otorgado);
      const diasTranscurridos = Math.floor((hoy - fechaReferencia) / (1000 * 60 * 60 * 24));

      // Si han pasado más de 35 días (un mes + 5 días de gracia), está en mora
      if (diasTranscurridos > 35) {
        await pool.query(
          `UPDATE prestamos SET estado = 'mora' WHERE id_prestamo = ?`,
          [prestamo.id_prestamo]
        );

        prestamosEnMora.push({
          id_prestamo: prestamo.id_prestamo,
          id_usuario: prestamo.id_usuario,
          dias_mora: diasTranscurridos - 30,
        });

        // Registrar en bitácora
        await registrarBitacora(
          prestamo.id_usuario,
          "Préstamo en mora",
          `Préstamo #${prestamo.id_prestamo} marcado en mora. Días de atraso: ${diasTranscurridos - 30}`
        );
      }
    }

    res.json({
      success: true,
      message: "Verificación de mora completada",
      prestamos_en_mora: prestamosEnMora.length,
      detalle: prestamosEnMora,
    });

  } catch (error) {
    console.error("ERROR AL VERIFICAR MORA:", error);
    res.status(500).json({ 
      message: "Error al verificar mora", 
      error: error.message 
    });
  }
});

// ============================================
// ESTADÍSTICAS GENERALES DE PRÉSTAMOS
// ============================================
router.get("/estadisticas/general", async (req, res) => {
  try {
    // Totales generales
    const [totales] = await pool.query(`
      SELECT 
      COUNT(*) as total_prestamos,
      IFNULL(SUM(monto), 0) as monto_total_prestado,
      IFNULL(SUM(saldo_restante), 0) as saldo_total_pendiente,
      IFNULL(AVG(tasa_interes), 0) as tasa_promedio,
      COUNT(DISTINCT id_usuario) as total_prestatarios
      FROM prestamos
    `);

    // Por estado
    const [porEstado] = await pool.query(`
      SELECT 
      estado,
      COUNT(*) as cantidad,
      IFNULL(SUM(saldo_restante), 0) as saldo_pendiente
      FROM prestamos
      GROUP BY estado
    `);

    // Préstamos del mes actual
    const [esteMes] = await pool.query(`
      SELECT 
      COUNT(*) as total,
      IFNULL(SUM(monto), 0) as monto_total
      FROM prestamos
      WHERE MONTH(fecha_otorgado) = MONTH(CURRENT_DATE())
      AND YEAR(fecha_otorgado) = YEAR(CURRENT_DATE())
    `);

    // Top socios con más préstamos
    const [topSocios] = await pool.query(`
      SELECT 
      u.id_usuario,
      u.nombre_completo,
      u.dni,
      COUNT(p.id_prestamo) as total_prestamos,
      IFNULL(SUM(p.monto), 0) as monto_total,
      IFNULL(SUM(p.saldo_restante), 0) as saldo_pendiente
      FROM prestamos p
      INNER JOIN usuarios u ON p.id_usuario = u.id_usuario
      WHERE p.estado IN ('activo', 'mora')
      GROUP BY u.id_usuario
      ORDER BY monto_total DESC
      LIMIT 5
    `);

    res.json({
      success: true,
      estadisticas: {
        totales: totales[0],
        por_estado: porEstado,
        este_mes: esteMes[0],
        top_socios: topSocios,
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
// POST / → alias de /solicitar (compatibilidad frontend)
// ============================================
router.post("/", async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { id_usuario, monto, tasa_interes, plazo_meses, descripcion, estado, fecha_otorgado } = req.body;

    if (!id_usuario || !monto || !tasa_interes || !plazo_meses) {
      return res.status(400).json({ message: "Usuario, monto, tasa de interés y plazo son requeridos." });
    }

    const montoNum = parseFloat(monto);
    const tasaNum = parseFloat(tasa_interes);
    const plazoNum = parseInt(plazo_meses);

    if (isNaN(montoNum) || montoNum <= 0)
      return res.status(400).json({ message: "El monto debe ser positivo" });
    if (isNaN(tasaNum) || tasaNum < 0 || tasaNum > 100)
      return res.status(400).json({ message: "La tasa de interés debe estar entre 0 y 100" });
    if (isNaN(plazoNum) || plazoNum <= 0 || plazoNum > 360)
      return res.status(400).json({ message: "El plazo debe ser entre 1 y 360 meses" });

    const [usuario] = await connection.query(
      `SELECT * FROM usuarios WHERE id_usuario = ? AND estado = 'activo'`,
      [id_usuario]
    );
    if (usuario.length === 0)
      return res.status(404).json({ message: "Usuario no encontrado o inactivo" });

    const cuotaMensual = calcularCuotaMensual(montoNum, tasaNum, plazoNum);
    const estadoPrestamo = estado || "pendiente";
    const fechaOtorgado = fecha_otorgado || null;

    await connection.beginTransaction();

    const [result] = await connection.query(
      `INSERT INTO prestamos (id_usuario, monto, tasa_interes, plazo_meses, saldo_restante, estado, fecha_otorgado)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id_usuario, montoNum, tasaNum, plazoNum, montoNum, estadoPrestamo, fechaOtorgado]
    );

    await connection.query(
      `INSERT INTO bitacora (id_usuario, accion, detalle, fecha) VALUES (?, ?, ?, NOW())`,
      [id_usuario, "Registro de préstamo", `Préstamo por L. ${montoNum.toFixed(2)} a ${plazoNum} meses. Cuota: L. ${cuotaMensual.toFixed(2)}`]
    );

    await connection.commit();

    res.status(201).json({
      success: true,
      message: "Préstamo registrado correctamente.",
      id_prestamo: result.insertId,
      cuota_mensual: parseFloat(cuotaMensual.toFixed(2)),
    });
  } catch (error) {
    await connection.rollback();
    console.error("ERROR AL REGISTRAR PRÉSTAMO:", error);
    res.status(500).json({ message: "Error al registrar el préstamo", error: error.message });
  } finally {
    connection.release();
  }
});

// ============================================
// PUT /:id → actualizar datos de un préstamo
// ============================================
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { monto, tasa_interes, plazo_meses, fecha_otorgado, estado } = req.body;

    const [existing] = await pool.query(`SELECT * FROM prestamos WHERE id_prestamo = ?`, [id]);
    if (existing.length === 0)
      return res.status(404).json({ message: "Préstamo no encontrado" });

    const montoNum = parseFloat(monto) || existing[0].monto;
    const tasaNum = parseFloat(tasa_interes) || existing[0].tasa_interes;
    const plazoNum = parseInt(plazo_meses) || existing[0].plazo_meses;
    const nuevoEstado = estado || existing[0].estado;
    const nuevaFecha = fecha_otorgado || existing[0].fecha_otorgado;

    await pool.query(
      `UPDATE prestamos SET monto = ?, tasa_interes = ?, plazo_meses = ?, estado = ?, fecha_otorgado = ? WHERE id_prestamo = ?`,
      [montoNum, tasaNum, plazoNum, nuevoEstado, nuevaFecha, id]
    );

    res.json({ success: true, message: "Préstamo actualizado correctamente." });
  } catch (error) {
    console.error("ERROR AL ACTUALIZAR PRÉSTAMO:", error);
    res.status(500).json({ message: "Error al actualizar el préstamo", error: error.message });
  }
});

// ============================================
// DELETE /:id → eliminar un préstamo
// ============================================
router.delete("/:id", async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { id } = req.params;

    const [existing] = await connection.query(`SELECT * FROM prestamos WHERE id_prestamo = ?`, [id]);
    if (existing.length === 0)
      return res.status(404).json({ message: "Préstamo no encontrado" });

    await connection.beginTransaction();

    // Eliminar cuotas relacionadas si existen
    await connection.query(`DELETE FROM cuotas WHERE id_prestamo = ?`, [id]);
    await connection.query(`DELETE FROM prestamos WHERE id_prestamo = ?`, [id]);

    await connection.commit();

    res.json({ success: true, message: "Préstamo eliminado correctamente." });
  } catch (error) {
    await connection.rollback();
    console.error("ERROR AL ELIMINAR PRÉSTAMO:", error);
    res.status(500).json({ message: "Error al eliminar el préstamo", error: error.message });
  } finally {
    connection.release();
  }
});

module.exports = router;
