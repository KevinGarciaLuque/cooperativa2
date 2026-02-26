const express = require("express");
const router = express.Router();
const pool = require("../db");

// ============================================
// OBTENER TODOS LOS MOVIMIENTOS CON FILTROS Y PAGINACIÓN
// ============================================
router.get("/", async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      tipo = '', 
      fecha_inicio = '', 
      fecha_fin = '',
      id_cuenta = '',
      id_usuario = '',
      monto_min = '',
      monto_max = '',
      search = ''
    } = req.query;

    const offset = (page - 1) * limit;

    let whereClause = "WHERE 1=1";
    let params = [];

    // Filtro por tipo
    if (tipo) {
      whereClause += ` AND m.tipo_movimiento = ?`;
      params.push(tipo);
    }

    // Filtro por rango de fechas
    if (fecha_inicio && fecha_fin) {
      whereClause += ` AND DATE(m.fecha) BETWEEN ? AND ?`;
      params.push(fecha_inicio, fecha_fin);
    }

    // Filtro por cuenta
    if (id_cuenta) {
      whereClause += ` AND m.id_cuenta = ?`;
      params.push(id_cuenta);
    }

    // Filtro por usuario
    if (id_usuario) {
      whereClause += ` AND c.id_usuario = ?`;
      params.push(id_usuario);
    }

    // Filtro por rango de montos
    if (monto_min) {
      whereClause += ` AND m.monto >= ?`;
      params.push(parseFloat(monto_min));
    }

    if (monto_max) {
      whereClause += ` AND m.monto <= ?`;
      params.push(parseFloat(monto_max));
    }

    // Búsqueda en descripción
    if (search) {
      whereClause += ` AND (m.descripcion LIKE ? OR u.nombre_completo LIKE ?)`;
      const searchParam = `%${search}%`;
      params.push(searchParam, searchParam);
    }

    // Contar total de registros
    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total 
       FROM movimientos_cuenta m
       INNER JOIN cuentas c ON m.id_cuenta = c.id_cuenta
       INNER JOIN usuarios u ON c.id_usuario = u.id_usuario
       ${whereClause}`,
      params
    );
    const total = countResult[0].total;

    // Obtener movimientos paginados
    const [movimientos] = await pool.query(
      `SELECT 
       m.id_movimiento,
       m.id_cuenta,
       m.tipo_movimiento as tipo,
       m.monto,
       m.fecha,
       m.descripcion,
       m.saldo_anterior,
       m.saldo_nuevo,
       m.referencia,
       c.tipo_cuenta, 
       c.saldo_actual as saldo_cuenta_actual,
       u.id_usuario,
       u.nombre_completo,
       u.dni
       FROM movimientos_cuenta m
       INNER JOIN cuentas c ON m.id_cuenta = c.id_cuenta
       INNER JOIN usuarios u ON c.id_usuario = u.id_usuario
       ${whereClause}
       ORDER BY m.fecha DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), parseInt(offset)]
    );

    // Calcular totales del filtro actual
    const [totales] = await pool.query(
      `SELECT 
       COUNT(*) as total_movimientos,
       IFNULL(SUM(CASE WHEN m.tipo_movimiento = 'abono' THEN m.monto ELSE 0 END), 0) as total_aportes,
       IFNULL(SUM(CASE WHEN m.tipo_movimiento = 'retiro' THEN m.monto ELSE 0 END), 0) as total_retiros,
       IFNULL(SUM(CASE WHEN m.tipo_movimiento = 'transferencia' THEN m.monto ELSE 0 END), 0) as total_transferencias
       FROM movimientos_cuenta m
       INNER JOIN cuentas c ON m.id_cuenta = c.id_cuenta
       INNER JOIN usuarios u ON c.id_usuario = u.id_usuario
       ${whereClause}`,
      params
    );

    res.json({
      success: true,
      data: movimientos,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit),
      },
      totales: totales[0],
    });
  } catch (error) {
    console.error("Error al obtener movimientos:", error);
    res.status(500).json({ 
      message: "Error al obtener los movimientos", 
      error: error.message 
    });
  }
});

// ============================================
// OBTENER MOVIMIENTOS DE UNA CUENTA ESPECÍFICA
// ============================================
router.get("/cuenta/:id_cuenta", async (req, res) => {
  try {
    const { fecha_inicio = '', fecha_fin = '', tipo = '' } = req.query;

    let whereClause = "WHERE id_cuenta = ?";
    let params = [req.params.id_cuenta];

    if (fecha_inicio && fecha_fin) {
      whereClause += ` AND DATE(fecha) BETWEEN ? AND ?`;
      params.push(fecha_inicio, fecha_fin);
    }

    if (tipo) {
      whereClause += ` AND tipo_movimiento = ?`;
      params.push(tipo);
    }

    const [movimientos] = await pool.query(
      `SELECT 
         id_movimiento,
         id_cuenta,
         tipo_movimiento as tipo,
         monto,
         fecha,
         descripcion,
         saldo_anterior,
         saldo_nuevo,
         referencia
       FROM movimientos_cuenta 
       ${whereClause}
       ORDER BY fecha DESC`,
      params
    );

    // Calcular resumen
    const resumen = movimientos.reduce((acc, mov) => {
      const monto = parseFloat(mov.monto);
      if (mov.tipo === 'abono') acc.total_aportes += monto;
      if (mov.tipo === 'retiro') acc.total_retiros += monto;
      if (mov.tipo === 'transferencia') acc.total_transferencias += monto;
      return acc;
    }, { total_aportes: 0, total_retiros: 0, total_transferencias: 0 });

    res.json({
      success: true,
      data: movimientos,
      total_movimientos: movimientos.length,
      resumen: resumen,
    });
  } catch (error) {
    console.error("ERROR AL OBTENER MOVIMIENTOS DE CUENTA:", error);
    res.status(500).json({ 
      message: "Error al obtener movimientos de la cuenta", 
      error: error.message 
    });
  }
});

// ============================================
// OBTENER MOVIMIENTOS DE UN USUARIO ESPECÍFICO
// ============================================
router.get("/usuario/:id_usuario", async (req, res) => {
  try {
    const { fecha_inicio = '', fecha_fin = '', tipo_cuenta = '' } = req.query;

    let whereClause = "WHERE c.id_usuario = ?";
    let params = [req.params.id_usuario];

    if (fecha_inicio && fecha_fin) {
      whereClause += ` AND DATE(m.fecha) BETWEEN ? AND ?`;
      params.push(fecha_inicio, fecha_fin);
    }

    if (tipo_cuenta) {
      whereClause += ` AND c.tipo_cuenta = ?`;
      params.push(tipo_cuenta);
    }

    const [movimientos] = await pool.query(
      `SELECT 
       m.id_movimiento,
       m.id_cuenta,
       m.tipo_movimiento as tipo,
       m.monto,
       m.fecha,
       m.descripcion,
       m.saldo_anterior,
       m.saldo_nuevo,
       m.referencia,
       c.tipo_cuenta, 
       c.id_cuenta as cuenta_id
       FROM movimientos_cuenta m
       INNER JOIN cuentas c ON m.id_cuenta = c.id_cuenta
       ${whereClause}
       ORDER BY m.fecha DESC`,
      params
    );

    // Agrupar por tipo de cuenta
    const porCuenta = movimientos.reduce((acc, mov) => {
      if (!acc[mov.tipo_cuenta]) {
        acc[mov.tipo_cuenta] = {
          movimientos: [],
          total_aportes: 0,
          total_retiros: 0,
          total_transferencias: 0,
        };
      }
      
      acc[mov.tipo_cuenta].movimientos.push(mov);
      const monto = parseFloat(mov.monto);
      
      if (mov.tipo === 'abono') acc[mov.tipo_cuenta].total_aportes += monto;
      if (mov.tipo === 'retiro') acc[mov.tipo_cuenta].total_retiros += monto;
      if (mov.tipo === 'transferencia') acc[mov.tipo_cuenta].total_transferencias += monto;
      
      return acc;
    }, {});

    res.json({
      success: true,
      data: movimientos,
      por_cuenta: porCuenta,
      total_movimientos: movimientos.length,
    });
  } catch (error) {
    console.error("ERROR AL OBTENER MOVIMIENTOS DEL USUARIO:", error);
    res.status(500).json({ 
      message: "Error al obtener movimientos del usuario", 
      error: error.message 
    });
  }
});

// ============================================
// ESTADÍSTICAS DE MOVIMIENTOS
// ============================================
router.get("/estadisticas/general", async (req, res) => {
  try {
    const { fecha_inicio = '', fecha_fin = '' } = req.query;

    let whereClause = "WHERE 1=1";
    let params = [];

    if (fecha_inicio && fecha_fin) {
      whereClause += ` AND DATE(fecha) BETWEEN ? AND ?`;
      params.push(fecha_inicio, fecha_fin);
    }

    // Totales por tipo
    const [totalesPorTipo] = await pool.query(
      `SELECT 
       tipo_movimiento as tipo,
       COUNT(*) as cantidad,
       SUM(monto) as total_monto
       FROM movimientos_cuenta
       ${whereClause}
       GROUP BY tipo_movimiento
       ORDER BY total_monto DESC`,
      params
    );

    // Resumen general
    const [resumenGeneral] = await pool.query(
      `SELECT 
       COUNT(*) as total_movimientos,
       IFNULL(SUM(monto), 0) as monto_total,
       IFNULL(AVG(monto), 0) as monto_promedio,
       IFNULL(MIN(monto), 0) as monto_minimo,
       IFNULL(MAX(monto), 0) as monto_maximo
       FROM movimientos_cuenta
       ${whereClause}`,
      params
    );

    // Movimientos por mes (últimos 12 meses si no hay filtro)
    let dateFilter = whereClause;
    let dateParams = [...params];
    
    if (!fecha_inicio && !fecha_fin) {
      dateFilter += ` AND fecha >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)`;
    }

    const [movimientosPorMes] = await pool.query(
      `SELECT 
       DATE_FORMAT(fecha, '%Y-%m') as mes,
       tipo_movimiento as tipo,
       COUNT(*) as cantidad,
       SUM(monto) as total
       FROM movimientos_cuenta
       ${dateFilter}
       GROUP BY mes, tipo_movimiento
       ORDER BY mes DESC, tipo_movimiento`,
      dateParams
    );

    // Cuentas más activas
    const [cuentasMasActivas] = await pool.query(
      `SELECT 
       c.id_cuenta,
       c.tipo_cuenta,
       u.nombre_completo,
       COUNT(m.id_movimiento) as total_movimientos,
       SUM(m.monto) as monto_total
       FROM movimientos_cuenta m
       INNER JOIN cuentas c ON m.id_cuenta = c.id_cuenta
       INNER JOIN usuarios u ON c.id_usuario = u.id_usuario
       ${whereClause.replace('WHERE 1=1', 'WHERE 1=1')}
       GROUP BY c.id_cuenta, c.tipo_cuenta, u.nombre_completo
       ORDER BY total_movimientos DESC
       LIMIT 10`,
      params
    );

    res.json({
      success: true,
      totales_por_tipo: totalesPorTipo,
      resumen_general: resumenGeneral[0],
      movimientos_por_mes: movimientosPorMes,
      cuentas_mas_activas: cuentasMasActivas,
    });
  } catch (error) {
    console.error("ERROR AL OBTENER ESTADÍSTICAS:", error);
    res.status(500).json({ 
      message: "Error al obtener las estadísticas", 
      error: error.message 
    });
  }
});

// ============================================
// NOTA IMPORTANTE: INMUTABILIDAD DE MOVIMIENTOS
// ============================================
// Los movimientos NO se deben editar ni eliminar manualmente por razones de auditoría.
// Los movimientos se crean automáticamente desde:
// - Aportaciones (aporte)
// - Retiros (retiro)  
// - Transferencias entre cuentas (transferencia)
// - Desembolsos de préstamos (aporte)
// Los ajustes deben hacerse eliminando/modificando la transacción original,
// lo cual generará los movimientos de reversión correspondientes.

// Si necesitas crear un movimiento manual por razones administrativas
// (ajustes, correcciones), usa este endpoint con precaución:
router.post("/ajuste-manual", async (req, res) => {
  try {
    const { 
      id_cuenta, 
      tipo, 
      monto, 
      descripcion,
      id_usuario_admin  // Usuario administrativo que realiza el ajuste
    } = req.body;

    // Validaciones
    if (!id_cuenta || !tipo || !monto || !descripcion || !id_usuario_admin) {
      return res.status(400).json({ 
        success: false, 
        message: "Faltan datos requeridos" 
      });
    }

    if (!['abono', 'retiro', 'transferencia'].includes(tipo)) {
      return res.status(400).json({ 
        success: false, 
        message: "Tipo de movimiento inválido" 
      });
    }

    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();

      // Obtener saldo actual
      const [cuenta] = await connection.query(
        'SELECT saldo_actual FROM cuentas WHERE id_cuenta = ?',
        [id_cuenta]
      );

      if (cuenta.length === 0) {
        throw new Error('Cuenta no encontrada');
      }

      const saldo_anterior = parseFloat(cuenta[0].saldo_actual);
      let saldo_nuevo = saldo_anterior;
      
      // Calcular nuevo saldo según tipo
      if (tipo === 'abono') {
        saldo_nuevo += parseFloat(monto);
      } else if (tipo === 'retiro') {
        saldo_nuevo -= parseFloat(monto);
      }

      // Registrar movimiento
      await connection.query(
        `INSERT INTO movimientos_cuenta 
         (id_cuenta, tipo_movimiento, monto, saldo_anterior, saldo_nuevo, descripcion)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [id_cuenta, tipo, monto, saldo_anterior, saldo_nuevo, `[AJUSTE MANUAL] ${descripcion}`]
      );

      // Actualizar saldo de cuenta
      await connection.query(
        'UPDATE cuentas SET saldo_actual = ? WHERE id_cuenta = ?',
        [saldo_nuevo, id_cuenta]
      );

      // Registrar en bitácora
      await connection.query(
        `INSERT INTO bitacora (id_usuario, accion, descripcion)
         VALUES (?, ?, ?)`,
        [
          id_usuario_admin, 
          'AJUSTE_CUENTA',
          `Ajuste manual en cuenta ${id_cuenta}: ${tipo} de ${monto}. Motivo: ${descripcion}`
        ]
      );

      await connection.commit();

      res.json({
        success: true,
        message: "Ajuste manual registrado exitosamente",
        saldo_anterior,
        saldo_nuevo,
      });

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

  } catch (error) {
    console.error("ERROR AL CREAR AJUSTE MANUAL:", error);
    res.status(500).json({ 
      success: false,
      message: "Error al crear el ajuste manual", 
      error: error.message 
    });
  }
});

// ============================================
// CREAR MOVIMIENTO (POST)
// ============================================
router.post("/", async (req, res) => {
  try {
    const { 
      id_cuenta, 
      tipo, 
      monto, 
      fecha,
      descripcion
    } = req.body;

    // Validaciones
    if (!id_cuenta || !tipo || !monto) {
      return res.status(400).json({ 
        success: false, 
        message: "Faltan datos requeridos (id_cuenta, tipo, monto)" 
      });
    }

    if (!['abono', 'retiro', 'transferencia'].includes(tipo)) {
      return res.status(400).json({ 
        success: false, 
        message: "Tipo de movimiento inválido (abono, retiro, transferencia)" 
      });
    }

    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();

      // Obtener saldo actual
      const [cuenta] = await connection.query(
        'SELECT saldo_actual FROM cuentas WHERE id_cuenta = ?',
        [id_cuenta]
      );

      if (cuenta.length === 0) {
        throw new Error('Cuenta no encontrada');
      }

      const saldo_anterior = parseFloat(cuenta[0].saldo_actual);
      let saldo_nuevo = saldo_anterior;
      
      // Calcular nuevo saldo según tipo
      if (tipo === 'abono') {
        saldo_nuevo += parseFloat(monto);
      } else if (tipo === 'retiro') {
        saldo_nuevo -= parseFloat(monto);
      }

      // Validar saldo suficiente para retiro
      if (tipo === 'retiro' && saldo_nuevo < 0) {
        throw new Error('Saldo insuficiente para realizar el retiro');
      }

      // Registrar movimiento
      const [result] = await connection.query(
        `INSERT INTO movimientos_cuenta 
         (id_cuenta, tipo_movimiento, monto, saldo_anterior, saldo_nuevo, descripcion, fecha)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id_cuenta, tipo, monto, saldo_anterior, saldo_nuevo, descripcion || '', fecha || new Date()]
      );

      // Actualizar saldo de cuenta
      await connection.query(
        'UPDATE cuentas SET saldo_actual = ? WHERE id_cuenta = ?',
        [saldo_nuevo, id_cuenta]
      );

      await connection.commit();

      res.json({
        success: true,
        message: "Movimiento registrado exitosamente",
        id_movimiento: result.insertId,
        saldo_anterior,
        saldo_nuevo,
      });

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

  } catch (error) {
    console.error("ERROR AL CREAR MOVIMIENTO:", error);
    res.status(500).json({ 
      success: false,
      message: error.message || "Error al crear el movimiento"
    });
  }
});

// ============================================
// ACTUALIZAR MOVIMIENTO (PUT)
// ============================================
router.put("/:id", async (req, res) => {
  try {
    const { tipo, monto, fecha, descripcion } = req.body;
    const id_movimiento = req.params.id;

    // Validaciones
    if (tipo && !['abono', 'retiro', 'transferencia'].includes(tipo)) {
      return res.status(400).json({ 
        success: false, 
        message: "Tipo de movimiento inválido" 
      });
    }

    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();

      // Obtener movimiento actual
      const [movActual] = await connection.query(
        'SELECT * FROM movimientos_cuenta WHERE id_movimiento = ?',
        [id_movimiento]
      );

      if (movActual.length === 0) {
        throw new Error('Movimiento no encontrado');
      }

      const movimiento = movActual[0];
      
      // Si cambia el monto o tipo, recalcular saldos
      const nuevoTipo = tipo || movimiento.tipo_movimiento;
      const nuevoMonto = monto !== undefined ? parseFloat(monto) : parseFloat(movimiento.monto);
      
      // Obtener saldo actual de la cuenta
      const [cuenta] = await connection.query(
        'SELECT saldo_actual FROM cuentas WHERE id_cuenta = ?',
        [movimiento.id_cuenta]
      );

      if (cuenta.length === 0) {
        throw new Error('Cuenta no encontrada');
      }

      // Revertir movimiento anterior
      let saldoActual = parseFloat(cuenta[0].saldo_actual);
      const montoAnterior = parseFloat(movimiento.monto);
      const tipoAnterior = movimiento.tipo_movimiento;
      
      if (tipoAnterior === 'abono') {
        saldoActual -= montoAnterior;
      } else if (tipoAnterior === 'retiro') {
        saldoActual += montoAnterior;
      }

      // Aplicar nuevo movimiento
      const saldo_anterior = saldoActual;
      let saldo_nuevo = saldoActual;
      
      if (nuevoTipo === 'abono') {
        saldo_nuevo += nuevoMonto;
      } else if (nuevoTipo === 'retiro') {
        saldo_nuevo -= nuevoMonto;
      }

      if (saldo_nuevo < 0) {
        throw new Error('El cambio resultaría en saldo negativo');
      }

      // Actualizar movimiento
      const updateFields = [];
      const updateValues = [];

      if (tipo !== undefined) {
        updateFields.push('tipo_movimiento = ?');
        updateValues.push(tipo);
      }
      if (monto !== undefined) {
        updateFields.push('monto = ?');
        updateValues.push(monto);
      }
      if (fecha !== undefined) {
        updateFields.push('fecha = ?');
        updateValues.push(fecha);
      }
      if (descripcion !== undefined) {
        updateFields.push('descripcion = ?');
        updateValues.push(descripcion);
      }

      updateFields.push('saldo_anterior = ?', 'saldo_nuevo = ?');
      updateValues.push(saldo_anterior, saldo_nuevo);
      updateValues.push(id_movimiento);

      await connection.query(
        `UPDATE movimientos_cuenta SET ${updateFields.join(', ')} WHERE id_movimiento = ?`,
        updateValues
      );

      // Actualizar saldo de cuenta
      await connection.query(
        'UPDATE cuentas SET saldo_actual = ? WHERE id_cuenta = ?',
        [saldo_nuevo, movimiento.id_cuenta]
      );

      await connection.commit();

      res.json({
        success: true,
        message: "Movimiento actualizado exitosamente",
        saldo_nuevo
      });

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

  } catch (error) {
    console.error("ERROR AL ACTUALIZAR MOVIMIENTO:", error);
    res.status(500).json({ 
      success: false,
      message: error.message || "Error al actualizar el movimiento"
    });
  }
});

// ============================================
// ELIMINAR MOVIMIENTO (DELETE)
// ============================================
router.delete("/:id", async (req, res) => {
  try {
    const id_movimiento = req.params.id;

    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();

      // Obtener movimiento
      const [movimiento] = await connection.query(
        'SELECT * FROM movimientos_cuenta WHERE id_movimiento = ?',
        [id_movimiento]
      );

      if (movimiento.length === 0) {
        throw new Error('Movimiento no encontrado');
      }

      const mov = movimiento[0];
      
      // Obtener saldo actual de la cuenta
      const [cuenta] = await connection.query(
        'SELECT saldo_actual FROM cuentas WHERE id_cuenta = ?',
        [mov.id_cuenta]
      );

      if (cuenta.length === 0) {
        throw new Error('Cuenta no encontrada');
      }

      // Revertir el movimiento del saldo
      let nuevoSaldo = parseFloat(cuenta[0].saldo_actual);
      const monto = parseFloat(mov.monto);
      
      if (mov.tipo_movimiento === 'abono') {
        nuevoSaldo -= monto;
      } else if (mov.tipo_movimiento === 'retiro') {
        nuevoSaldo += monto;
      }

      if (nuevoSaldo < 0) {
        throw new Error('Eliminar este movimiento resultaría en saldo negativo');
      }

      // Eliminar movimiento
      await connection.query(
        'DELETE FROM movimientos_cuenta WHERE id_movimiento = ?',
        [id_movimiento]
      );

      // Actualizar saldo de cuenta
      await connection.query(
        'UPDATE cuentas SET saldo_actual = ? WHERE id_cuenta = ?',
        [nuevoSaldo, mov.id_cuenta]
      );

      await connection.commit();

      res.json({
        success: true,
        message: "Movimiento eliminado exitosamente",
        saldo_nuevo: nuevoSaldo
      });

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

  } catch (error) {
    console.error("ERROR AL ELIMINAR MOVIMIENTO:", error);
    res.status(500).json({ 
      success: false,
      message: error.message || "Error al eliminar el movimiento"
    });
  }
});

// ============================================
// OBTENER UN MOVIMIENTO POR ID
// ============================================
router.get("/:id", async (req, res) => {
  try {
    const [movimiento] = await pool.query(
      `SELECT 
       m.id_movimiento,
       m.id_cuenta,
       m.tipo_movimiento as tipo,
       m.monto,
       m.fecha,
       m.descripcion,
       m.saldo_anterior,
       m.saldo_nuevo,
       m.referencia,
       c.tipo_cuenta, 
       c.saldo_actual,
       u.id_usuario,
       u.nombre_completo,
       u.dni,
       u.telefono
       FROM movimientos_cuenta m
       INNER JOIN cuentas c ON m.id_cuenta = c.id_cuenta
       INNER JOIN usuarios u ON c.id_usuario = u.id_usuario
       WHERE m.id_movimiento = ?`,
      [req.params.id]
    );
    
    if (movimiento.length === 0) {
      return res.status(404).json({ message: "Movimiento no encontrado" });
    }
    
    res.json({
      success: true,
      data: movimiento[0],
    });
  } catch (error) {
    console.error("ERROR AL OBTENER MOVIMIENTO:", error);
    res.status(500).json({ 
      message: "Error al obtener el movimiento", 
      error: error.message 
    });
  }
});

module.exports = router;
