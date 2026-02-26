const express = require("express");
const router = express.Router();
const pool = require("../db");

// ============================================
// FUNCIONES AUXILIARES
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

// Registrar movimiento de cuenta
const registrarMovimiento = async (id_cuenta, tipo, monto, descripcion) => {
  try {
    await pool.query(
      `INSERT INTO movimientos_cuenta (id_cuenta, tipo, monto, descripcion, fecha) 
       VALUES (?, ?, ?, ?, NOW())`,
      [id_cuenta, tipo, monto, descripcion]
    );
  } catch (error) {
    console.error("Error al registrar movimiento:", error);
  }
};

// ============================================
// OBTENER TODAS LAS CUENTAS CON FILTROS
// ============================================
router.get("/", async (req, res) => {
  try {
    const { tipo_cuenta = '', estado = '', id_usuario = '' } = req.query;

    let whereClause = "WHERE 1=1";
    let params = [];

    if (tipo_cuenta) {
      whereClause += ` AND c.tipo_cuenta = ?`;
      params.push(tipo_cuenta);
    }

    if (estado) {
      whereClause += ` AND c.estado = ?`;
      params.push(estado);
    }

    if (id_usuario) {
      whereClause += ` AND c.id_usuario = ?`;
      params.push(id_usuario);
    }

    const [cuentas] = await pool.query(
      `SELECT c.*, 
       u.nombre_completo, 
       u.dni,
       (SELECT COUNT(*) FROM movimientos_cuenta WHERE id_cuenta = c.id_cuenta) as total_movimientos,
       (SELECT fecha FROM movimientos_cuenta WHERE id_cuenta = c.id_cuenta ORDER BY fecha DESC LIMIT 1) as ultimo_movimiento
       FROM cuentas c
       INNER JOIN usuarios u ON c.id_usuario = u.id_usuario
       ${whereClause}
       ORDER BY c.fecha_apertura DESC`,
      params
    );

    res.json({
      success: true,
      data: cuentas,
      total: cuentas.length,
    });
  } catch (error) {
    console.error("ERROR AL OBTENER CUENTAS:", error);
    res.status(500).json({ 
      message: "Error al obtener las cuentas", 
      error: error.message 
    });
  }
});

// ============================================
// OBTENER UNA CUENTA POR ID CON MOVIMIENTOS
// ============================================
router.get("/:id", async (req, res) => {
  try {
    const [cuenta] = await pool.query(
      `SELECT c.*, 
       u.nombre_completo, 
       u.dni, 
       u.telefono,
       u.correo
       FROM cuentas c
       INNER JOIN usuarios u ON c.id_usuario = u.id_usuario
       WHERE c.id_cuenta = ?`,
      [req.params.id]
    );
    
    if (cuenta.length === 0) {
      return res.status(404).json({ message: "Cuenta no encontrada" });
    }

    // Obtener últimos movimientos
    const [movimientos] = await pool.query(
      `SELECT * FROM movimientos_cuenta 
       WHERE id_cuenta = ? 
       ORDER BY fecha DESC 
       LIMIT 20`,
      [req.params.id]
    );

    // Obtener resumen de movimientos
    const [resumen] = await pool.query(
      `SELECT 
       COUNT(*) as total_movimientos,
       IFNULL(SUM(CASE WHEN tipo = 'aporte' THEN monto ELSE 0 END), 0) as total_aportes,
       IFNULL(SUM(CASE WHEN tipo = 'retiro' THEN monto ELSE 0 END), 0) as total_retiros,
       IFNULL(SUM(CASE WHEN tipo = 'transferencia' THEN monto ELSE 0 END), 0) as total_transferencias
       FROM movimientos_cuenta 
       WHERE id_cuenta = ?`,
      [req.params.id]
    );

    res.json({
      success: true,
      cuenta: cuenta[0],
      movimientos: movimientos,
      resumen: resumen[0],
    });
  } catch (error) {
    console.error("ERROR AL OBTENER CUENTA:", error);
    res.status(500).json({ 
      message: "Error al obtener la cuenta", 
      error: error.message 
    });
  }
});

// ============================================
// OBTENER TODAS LAS CUENTAS DE UN USUARIO
// ============================================
router.get("/usuario/:id_usuario", async (req, res) => {
  try {
    const [cuentas] = await pool.query(
      `SELECT c.*,
       (SELECT COUNT(*) FROM movimientos_cuenta WHERE id_cuenta = c.id_cuenta) as total_movimientos
       FROM cuentas c
       WHERE c.id_usuario = ?
       ORDER BY c.tipo_cuenta`,
      [req.params.id_usuario]
    );

    // Calcular totales
    const saldoTotal = cuentas.reduce((sum, cuenta) => sum + parseFloat(cuenta.saldo_actual), 0);

    res.json({
      success: true,
      data: cuentas,
      saldo_total: saldoTotal,
      total_cuentas: cuentas.length,
    });
  } catch (error) {
    console.error("ERROR AL OBTENER CUENTAS DEL USUARIO:", error);
    res.status(500).json({ 
      message: "Error al obtener las cuentas del usuario", 
      error: error.message 
    });
  }
});

// ============================================
// CREAR UNA NUEVA CUENTA
// ============================================
router.post("/", async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const { id_usuario, tipo_cuenta, saldo_inicial } = req.body;

    // Validaciones
    if (!id_usuario || !tipo_cuenta) {
      return res.status(400).json({ 
        message: "Usuario y tipo de cuenta son requeridos." 
      });
    }

    // Validar tipo de cuenta
    const tiposValidos = ['Aportaciones', 'Vivienda', 'Pensiones'];
    if (!tiposValidos.includes(tipo_cuenta)) {
      return res.status(400).json({ 
        message: "Tipo de cuenta inválido. Debe ser: Aportaciones, Vivienda o Pensiones" 
      });
    }

    // Verificar que el usuario existe y está activo
    const [usuario] = await connection.query(
      `SELECT * FROM usuarios WHERE id_usuario = ? AND estado = 'activo'`,
      [id_usuario]
    );

    if (usuario.length === 0) {
      return res.status(404).json({ 
        message: "Usuario no encontrado o inactivo" 
      });
    }

    // Verificar si ya tiene una cuenta de ese tipo
    const [cuentaExiste] = await connection.query(
      `SELECT * FROM cuentas WHERE id_usuario = ? AND tipo_cuenta = ?`,
      [id_usuario, tipo_cuenta]
    );

    if (cuentaExiste.length > 0) {
      return res.status(400).json({ 
        message: `El usuario ya tiene una cuenta de tipo ${tipo_cuenta}` 
      });
    }

    await connection.beginTransaction();

    // Crear la cuenta
    const saldoInicial = parseFloat(saldo_inicial) || 0.00;
    const [result] = await connection.query(
      `INSERT INTO cuentas (id_usuario, tipo_cuenta, saldo_actual, estado, fecha_apertura) 
       VALUES (?, ?, ?, 'activa', NOW())`,
      [id_usuario, tipo_cuenta, saldoInicial]
    );

    const nuevaCuentaId = result.insertId;

    // Si hay saldo inicial, registrar movimiento
    if (saldoInicial > 0) {
      await connection.query(
        `INSERT INTO movimientos_cuenta (id_cuenta, tipo, monto, descripcion, fecha) 
         VALUES (?, 'aporte', ?, 'Saldo inicial de la cuenta', NOW())`,
        [nuevaCuentaId, saldoInicial]
      );
    }

    // Registrar en bitácora
    await connection.query(
      `INSERT INTO bitacora (id_usuario, accion, detalle, fecha) 
       VALUES (?, ?, ?, NOW())`,
      [id_usuario, "Apertura de cuenta", `Se abrió cuenta de ${tipo_cuenta} con saldo inicial de L. ${saldoInicial.toFixed(2)}`]
    );

    await connection.commit();

    res.status(201).json({
      success: true,
      message: "Cuenta creada correctamente",
      id_cuenta: nuevaCuentaId,
    });

  } catch (error) {
    await connection.rollback();
    console.error("ERROR AL CREAR CUENTA:", error);
    res.status(500).json({ 
      message: "Error al crear la cuenta", 
      error: error.message 
    });
  } finally {
    connection.release();
  }
});

// ============================================
// ACTUALIZAR SALDO DE CUENTA (TRANSACCIONAL)
// ============================================
router.post("/:id/actualizar-saldo", async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const { tipo, monto, descripcion } = req.body;

    // Validaciones
    if (!tipo || !monto) {
      return res.status(400).json({ 
        message: "Tipo de transacción y monto son requeridos" 
      });
    }

    const tiposValidos = ['aporte', 'retiro', 'transferencia'];
    if (!tiposValidos.includes(tipo)) {
      return res.status(400).json({ 
        message: "Tipo inválido. Debe ser: aporte, retiro o transferencia" 
      });
    }

    const montoNum = parseFloat(monto);
    if (isNaN(montoNum) || montoNum <= 0) {
      return res.status(400).json({ 
        message: "El monto debe ser un número positivo" 
      });
    }

    // Obtener cuenta
    const [cuenta] = await connection.query(
      `SELECT c.*, u.nombre_completo 
       FROM cuentas c
       INNER JOIN usuarios u ON c.id_usuario = u.id_usuario
       WHERE c.id_cuenta = ?`,
      [req.params.id]
    );

    if (cuenta.length === 0) {
      return res.status(404).json({ message: "Cuenta no encontrada" });
    }

    if (cuenta[0].estado !== 'activa') {
      return res.status(400).json({ message: "La cuenta no está activa" });
    }

    await connection.beginTransaction();

    let nuevoSaldo = parseFloat(cuenta[0].saldo_actual);

    // Calcular nuevo saldo según el tipo
    if (tipo === 'aporte') {
      nuevoSaldo += montoNum;
    } else if (tipo === 'retiro') {
      if (nuevoSaldo < montoNum) {
        await connection.rollback();
        return res.status(400).json({ 
          message: "Saldo insuficiente para realizar el retiro" 
        });
      }
      nuevoSaldo -= montoNum;
    }

    // Actualizar saldo
    await connection.query(
      `UPDATE cuentas SET saldo_actual = ? WHERE id_cuenta = ?`,
      [nuevoSaldo, req.params.id]
    );

    // Registrar movimiento
    await connection.query(
      `INSERT INTO movimientos_cuenta (id_cuenta, tipo, monto, descripcion, fecha) 
       VALUES (?, ?, ?, ?, NOW())`,
      [req.params.id, tipo, montoNum, descripcion || `${tipo.charAt(0).toUpperCase() + tipo.slice(1)} en cuenta`]
    );

    // Registrar en bitácora
    await connection.query(
      `INSERT INTO bitacora (id_usuario, accion, detalle, fecha) 
       VALUES (?, ?, ?, NOW())`,
      [
        cuenta[0].id_usuario, 
        `${tipo.charAt(0).toUpperCase() + tipo.slice(1)} en cuenta`,
        `${tipo.charAt(0).toUpperCase() + tipo.slice(1)} de L. ${montoNum.toFixed(2)} en cuenta ${cuenta[0].tipo_cuenta}. Saldo actual: L. ${nuevoSaldo.toFixed(2)}`
      ]
    );

    await connection.commit();

    res.json({
      success: true,
      message: "Saldo actualizado correctamente",
      saldo_anterior: parseFloat(cuenta[0].saldo_actual),
      saldo_nuevo: nuevoSaldo,
    });

  } catch (error) {
    await connection.rollback();
    console.error("ERROR AL ACTUALIZAR SALDO:", error);
    res.status(500).json({ 
      message: "Error al actualizar el saldo", 
      error: error.message 
    });
  } finally {
    connection.release();
  }
});

// ============================================
// TRANSFERIR ENTRE CUENTAS
// ============================================
router.post("/transferir", async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const { id_cuenta_origen, id_cuenta_destino, monto, descripcion } = req.body;

    // Validaciones
    if (!id_cuenta_origen || !id_cuenta_destino || !monto) {
      return res.status(400).json({ 
        message: "Cuenta origen, cuenta destino y monto son requeridos" 
      });
    }

    if (id_cuenta_origen === id_cuenta_destino) {
      return res.status(400).json({ 
        message: "No se puede transferir a la misma cuenta" 
      });
    }

    const montoNum = parseFloat(monto);
    if (isNaN(montoNum) || montoNum <= 0) {
      return res.status(400).json({ 
        message: "El monto debe ser un número positivo" 
      });
    }

    // Obtener cuentas
    const [cuentaOrigen] = await connection.query(
      `SELECT c.*, u.nombre_completo 
       FROM cuentas c
       INNER JOIN usuarios u ON c.id_usuario = u.id_usuario
       WHERE c.id_cuenta = ?`,
      [id_cuenta_origen]
    );

    const [cuentaDestino] = await connection.query(
      `SELECT c.*, u.nombre_completo 
       FROM cuentas c
       INNER JOIN usuarios u ON c.id_usuario = u.id_usuario
       WHERE c.id_cuenta = ?`,
      [id_cuenta_destino]
    );

    if (cuentaOrigen.length === 0 || cuentaDestino.length === 0) {
      return res.status(404).json({ message: "Una o ambas cuentas no existen" });
    }

    if (cuentaOrigen[0].estado !== 'activa' || cuentaDestino[0].estado !== 'activa') {
      return res.status(400).json({ message: "Una o ambas cuentas no están activas" });
    }

    // Verificar saldo suficiente
    if (parseFloat(cuentaOrigen[0].saldo_actual) < montoNum) {
      return res.status(400).json({ 
        message: "Saldo insuficiente en la cuenta origen" 
      });
    }

    await connection.beginTransaction();

    // Actualizar saldos
    const nuevoSaldoOrigen = parseFloat(cuentaOrigen[0].saldo_actual) - montoNum;
    const nuevoSaldoDestino = parseFloat(cuentaDestino[0].saldo_actual) + montoNum;

    await connection.query(
      `UPDATE cuentas SET saldo_actual = ? WHERE id_cuenta = ?`,
      [nuevoSaldoOrigen, id_cuenta_origen]
    );

    await connection.query(
      `UPDATE cuentas SET saldo_actual = ? WHERE id_cuenta = ?`,
      [nuevoSaldoDestino, id_cuenta_destino]
    );

    // Registrar movimientos
    const desc = descripcion || 'Transferencia entre cuentas';
    
    await connection.query(
      `INSERT INTO movimientos_cuenta (id_cuenta, tipo, monto, descripcion, fecha) 
       VALUES (?, 'transferencia', ?, ?, NOW())`,
      [id_cuenta_origen, montoNum, `${desc} - Enviado a ${cuentaDestino[0].tipo_cuenta}`]
    );

    await connection.query(
      `INSERT INTO movimientos_cuenta (id_cuenta, tipo, monto, descripcion, fecha) 
       VALUES (?, 'transferencia', ?, ?, NOW())`,
      [id_cuenta_destino, montoNum, `${desc} - Recibido de ${cuentaOrigen[0].tipo_cuenta}`]
    );

    // Registrar en bitácora
    await connection.query(
      `INSERT INTO bitacora (id_usuario, accion, detalle, fecha) 
       VALUES (?, ?, ?, NOW())`,
      [
        cuentaOrigen[0].id_usuario,
        "Transferencia entre cuentas",
        `Transferencia de L. ${montoNum.toFixed(2)} de ${cuentaOrigen[0].tipo_cuenta} a ${cuentaDestino[0].tipo_cuenta}`
      ]
    );

    await connection.commit();

    res.json({
      success: true,
      message: "Transferencia realizada correctamente",
      cuenta_origen: {
        saldo_anterior: parseFloat(cuentaOrigen[0].saldo_actual),
        saldo_nuevo: nuevoSaldoOrigen,
      },
      cuenta_destino: {
        saldo_anterior: parseFloat(cuentaDestino[0].saldo_actual),
        saldo_nuevo: nuevoSaldoDestino,
      },
    });

  } catch (error) {
    await connection.rollback();
    console.error("ERROR EN TRANSFERENCIA:", error);
    res.status(500).json({ 
      message: "Error al realizar la transferencia", 
      error: error.message 
    });
  } finally {
    connection.release();
  }
});

// ============================================
// CERRAR O REACTIVAR CUENTA
// ============================================
router.patch("/:id/estado", async (req, res) => {
  try {
    const { estado } = req.body;

    if (!estado || !['activa', 'cerrada'].includes(estado)) {
      return res.status(400).json({ 
        message: "Estado inválido. Debe ser: activa o cerrada" 
      });
    }

    // Obtener cuenta
    const [cuenta] = await pool.query(
      `SELECT c.*, u.nombre_completo 
       FROM cuentas c
       INNER JOIN usuarios u ON c.id_usuario = u.id_usuario
       WHERE c.id_cuenta = ?`,
      [req.params.id]
    );

    if (cuenta.length === 0) {
      return res.status(404).json({ message: "Cuenta no encontrada" });
    }

    // Si se va a cerrar, verificar que el saldo sea 0
    if (estado === 'cerrada' && parseFloat(cuenta[0].saldo_actual) > 0) {
      return res.status(400).json({ 
        message: "No se puede cerrar una cuenta con saldo. Retire todo el saldo primero." 
      });
    }

    // Actualizar estado
    await pool.query(
      `UPDATE cuentas SET estado = ? WHERE id_cuenta = ?`,
      [estado, req.params.id]
    );

    // Registrar en bitácora
    await registrarBitacora(
      cuenta[0].id_usuario,
      estado === 'cerrada' ? "Cierre de cuenta" : "Reactivación de cuenta",
      `Cuenta ${cuenta[0].tipo_cuenta} ${estado === 'cerrada' ? 'cerrada' : 'reactivada'}`
    );

    res.json({
      success: true,
      message: `Cuenta ${estado === 'cerrada' ? 'cerrada' : 'reactivada'} correctamente`,
    });

  } catch (error) {
    console.error("ERROR AL CAMBIAR ESTADO DE CUENTA:", error);
    res.status(500).json({ 
      message: "Error al cambiar el estado de la cuenta", 
      error: error.message 
    });
  }
});

// ============================================
// OBTENER ESTADO DE CUENTA DETALLADO
// ============================================
router.get("/:id/estado-cuenta", async (req, res) => {
  try {
    const { fecha_inicio, fecha_fin } = req.query;

    // Obtener información de la cuenta
    const [cuenta] = await pool.query(
      `SELECT c.*, u.nombre_completo, u.dni, u.telefono, u.correo 
       FROM cuentas c
       INNER JOIN usuarios u ON c.id_usuario = u.id_usuario
       WHERE c.id_cuenta = ?`,
      [req.params.id]
    );

    if (cuenta.length === 0) {
      return res.status(404).json({ message: "Cuenta no encontrada" });
    }

    // Construir condición de fecha
    let whereClause = "WHERE id_cuenta = ?";
    let params = [req.params.id];

    if (fecha_inicio && fecha_fin) {
      whereClause += ` AND fecha BETWEEN ? AND ?`;
      params.push(fecha_inicio, fecha_fin);
    }

    // Obtener movimientos
    const [movimientos] = await pool.query(
      `SELECT * FROM movimientos_cuenta 
       ${whereClause}
       ORDER BY fecha DESC`,
      params
    );

    // Calcular totales
    const totales = movimientos.reduce((acc, mov) => {
      const monto = parseFloat(mov.monto);
      if (mov.tipo === 'aporte') acc.total_aportes += monto;
      if (mov.tipo === 'retiro') acc.total_retiros += monto;
      if (mov.tipo === 'transferencia') acc.total_transferencias += monto;
      return acc;
    }, { total_aportes: 0, total_retiros: 0, total_transferencias: 0 });

    res.json({
      success: true,
      cuenta: cuenta[0],
      movimientos: movimientos,
      totales: totales,
      periodo: {
        fecha_inicio: fecha_inicio || 'Desde el inicio',
        fecha_fin: fecha_fin || 'Hasta ahora',
      },
    });

  } catch (error) {
    console.error("ERROR AL OBTENER ESTADO DE CUENTA:", error);
    res.status(500).json({ 
      message: "Error al obtener el estado de cuenta", 
      error: error.message 
    });
  }
});

module.exports = router;
