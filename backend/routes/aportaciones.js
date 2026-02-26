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

// ============================================
// OBTENER TODAS LAS APORTACIONES CON FILTROS Y PAGINACIÓN
// ============================================
router.get("/", async (req, res) => {
  try {
    const { page = 1, limit = 1000, search = '', fecha_inicio = '', fecha_fin = '', id_usuario = '' } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = "WHERE 1=1";
    let params = [];

    if (search) {
      whereClause += ` AND (u.nombre_completo LIKE ? OR u.dni LIKE ?)`;
      const searchParam = `%${search}%`;
      params.push(searchParam, searchParam);
    }

    if (fecha_inicio && fecha_fin) {
      whereClause += ` AND a.fecha BETWEEN ? AND ?`;
      params.push(fecha_inicio, fecha_fin);
    }

    if (id_usuario) {
      whereClause += ` AND a.id_usuario = ?`;
      params.push(id_usuario);
    }

    // Obtener aportaciones (simplificado - sin paginación obligatoria)
    const [aportaciones] = await pool.query(
      `SELECT a.*, u.nombre_completo, u.dni 
       FROM aportaciones a
       INNER JOIN usuarios u ON a.id_usuario = u.id_usuario
       ${whereClause}
       ORDER BY a.fecha DESC`,
      params
    );

    // Calcular totales del período
    const [totales] = await pool.query(
      `SELECT 
       IFNULL(SUM(monto), 0) as total_aportado,
       COUNT(*) as total_aportaciones,
       COUNT(DISTINCT a.id_usuario) as total_socios
       FROM aportaciones a
       INNER JOIN usuarios u ON a.id_usuario = u.id_usuario
       ${whereClause}`,
      params
    );

    res.json({
      success: true,
      data: aportaciones,
      total: aportaciones.length,
      totales: totales[0],
    });
  } catch (error) {
    console.error("ERROR AL OBTENER APORTACIONES:", error);
    res.status(500).json({ 
      message: "Error al obtener las aportaciones", 
      error: error.message 
    });
  }
});

// ============================================
// OBTENER APORTACIONES POR USUARIO
// ============================================
router.get("/usuario/:id_usuario", async (req, res) => {
  try {
    const { fecha_inicio = '', fecha_fin = '' } = req.query;

    let whereClause = "WHERE id_usuario = ?";
    let params = [req.params.id_usuario];

    if (fecha_inicio && fecha_fin) {
      whereClause += ` AND fecha BETWEEN ? AND ?`;
      params.push(fecha_inicio, fecha_fin);
    }

    const [aportaciones] = await pool.query(
      `SELECT * FROM aportaciones 
       ${whereClause}
       ORDER BY fecha DESC`,
      params
    );

    // Calcular totales
    const [totales] = await pool.query(
      `SELECT 
       COUNT(*) as total_aportaciones,
       IFNULL(SUM(monto), 0) as total_aportado,
       IFNULL(AVG(monto), 0) as promedio_aportacion
       FROM aportaciones 
       ${whereClause}`,
      params
    );

    res.json({
      success: true,
      data: aportaciones,
      totales: totales[0],
    });
  } catch (error) {
    console.error("ERROR AL OBTENER APORTACIONES DEL USUARIO:", error);
    res.status(500).json({ 
      message: "Error al obtener las aportaciones del usuario", 
      error: error.message 
    });
  }
});

// ============================================
// OBTENER UNA APORTACIÓN POR ID
// ============================================
router.get("/:id", async (req, res) => {
  try {
    const [aportacion] = await pool.query(
      `SELECT a.*, u.nombre_completo, u.dni, u.telefono, u.correo 
       FROM aportaciones a
       INNER JOIN usuarios u ON a.id_usuario = u.id_usuario
       WHERE a.id_aportacion = ?`,
      [req.params.id]
    );
    
    if (aportacion.length === 0) {
      return res.status(404).json({ message: "Aportación no encontrada" });
    }
    
    res.json({
      success: true,
      data: aportacion[0],
    });
  } catch (error) {
    console.error("ERROR AL OBTENER APORTACIÓN:", error);
    res.status(500).json({ 
      message: "Error al obtener la aportación", 
      error: error.message 
    });
  }
});

// ============================================
// CREAR UNA NUEVA APORTACIÓN (CON ACTUALIZACIÓN DE CUENTA)
// ============================================
router.post("/", async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const { id_usuario, monto, descripcion, id_cuenta } = req.body;
    
    // Validaciones
    if (!id_usuario || !monto) {
      return res.status(400).json({ 
        message: "Usuario y monto son requeridos." 
      });
    }

    const montoNum = parseFloat(monto);
    if (isNaN(montoNum) || montoNum <= 0) {
      return res.status(400).json({ 
        message: "El monto debe ser un número positivo" 
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

    // Si se especifica cuenta, validarla; sino, usar cuenta de Aportaciones por defecto
    let cuentaDestino;
    if (id_cuenta) {
      const [cuenta] = await connection.query(
        `SELECT * FROM cuentas WHERE id_cuenta = ? AND id_usuario = ? AND estado = 'activa'`,
        [id_cuenta, id_usuario]
      );
      if (cuenta.length === 0) {
        return res.status(404).json({ 
          message: "Cuenta no encontrada o no pertenece al usuario" 
        });
      }
      cuentaDestino = cuenta[0];
    } else {
      // Buscar cuenta de Aportaciones del usuario
      const [cuentaAportaciones] = await connection.query(
        `SELECT * FROM cuentas WHERE id_usuario = ? AND tipo_cuenta = 'Aportaciones' AND estado = 'activa' LIMIT 1`,
        [id_usuario]
      );
      
      if (cuentaAportaciones.length === 0) {
        return res.status(404).json({ 
          message: "El usuario no tiene una cuenta de Aportaciones activa" 
        });
      }
      cuentaDestino = cuentaAportaciones[0];
    }

    await connection.beginTransaction();

    // Registrar la aportación
    const [result] = await connection.query(
      `INSERT INTO aportaciones (id_usuario, monto, descripcion, fecha) 
       VALUES (?, ?, ?, NOW())`,
      [id_usuario, montoNum, descripcion || 'Aportación mensual']
    );

    const nuevaAportacionId = result.insertId;

    // Actualizar saldo de la cuenta
    const nuevoSaldo = parseFloat(cuentaDestino.saldo_actual) + montoNum;
    await connection.query(
      `UPDATE cuentas SET saldo_actual = ? WHERE id_cuenta = ?`,
      [nuevoSaldo, cuentaDestino.id_cuenta]
    );

    // Registrar movimiento en la cuenta
    await connection.query(
      `INSERT INTO movimientos_cuenta (id_cuenta, tipo_movimiento, monto, descripcion, fecha) 
       VALUES (?, 'aporte', ?, ?, NOW())`,
      [cuentaDestino.id_cuenta, montoNum, descripcion || 'Aportación mensual']
    );

    // Registrar en bitácora
    await connection.query(
      `INSERT INTO bitacora (id_usuario, accion, detalle, fecha) 
       VALUES (?, ?, ?, NOW())`,
      [
        id_usuario, 
        "Registro de aportación", 
        `Aportación de L. ${montoNum.toFixed(2)} registrada en cuenta ${cuentaDestino.tipo_cuenta}. Saldo actualizado: L. ${nuevoSaldo.toFixed(2)}`
      ]
    );

    await connection.commit();

    res.status(201).json({
      success: true,
      message: "Aportación registrada correctamente y cuenta actualizada",
      id_aportacion: nuevaAportacionId,
      cuenta_actualizada: {
        id_cuenta: cuentaDestino.id_cuenta,
        tipo_cuenta: cuentaDestino.tipo_cuenta,
        saldo_anterior: parseFloat(cuentaDestino.saldo_actual),
        saldo_nuevo: nuevoSaldo,
      },
    });

  } catch (error) {
    await connection.rollback();
    console.error("ERROR AL REGISTRAR APORTACIÓN:", error);
    res.status(500).json({ 
      message: "Error al registrar la aportación", 
      error: error.message 
    });
  } finally {
    connection.release();
  }
});

// ============================================
// ACTUALIZAR UNA APORTACIÓN
// ============================================
router.put("/:id", async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const { monto, descripcion } = req.body;

    // Obtener aportación actual
    const [aportacionActual] = await connection.query(
      `SELECT * FROM aportaciones WHERE id_aportacion = ?`,
      [req.params.id]
    );

    if (aportacionActual.length === 0) {
      return res.status(404).json({ message: "Aportación no encontrada" });
    }

    const montoAnterior = parseFloat(aportacionActual[0].monto);
    const montoNuevo = monto ? parseFloat(monto) : montoAnterior;

    if (isNaN(montoNuevo) || montoNuevo <= 0) {
      return res.status(400).json({ 
        message: "El monto debe ser un número positivo" 
      });
    }

    await connection.beginTransaction();

    // Actualizar la aportación
    let updateFields = [];
    let values = [];

    if (monto) {
      updateFields.push("monto = ?");
      values.push(montoNuevo);
    }
    if (descripcion) {
      updateFields.push("descripcion = ?");
      values.push(descripcion);
    }

    if (updateFields.length > 0) {
      values.push(req.params.id);
      await connection.query(
        `UPDATE aportaciones SET ${updateFields.join(", ")} WHERE id_aportacion = ?`,
        values
      );
    }

    // Si cambió el monto, actualizar el saldo de la cuenta
    if (monto && montoAnterior !== montoNuevo) {
      const diferencia = montoNuevo - montoAnterior;
      
      // Obtener cuenta de Aportaciones del usuario
      const [cuenta] = await connection.query(
        `SELECT * FROM cuentas WHERE id_usuario = ? AND tipo_cuenta = 'Aportaciones' LIMIT 1`,
        [aportacionActual[0].id_usuario]
      );

      if (cuenta.length > 0) {
        const nuevoSaldo = parseFloat(cuenta[0].saldo_actual) + diferencia;
        
        await connection.query(
          `UPDATE cuentas SET saldo_actual = ? WHERE id_cuenta = ?`,
          [nuevoSaldo, cuenta[0].id_cuenta]
        );

        // Registrar movimiento de ajuste
        await connection.query(
          `INSERT INTO movimientos_cuenta (id_cuenta, tipo_movimiento, monto, descripcion, fecha) 
           VALUES (?, 'aporte', ?, ?, NOW())`,
          [
            cuenta[0].id_cuenta, 
            Math.abs(diferencia),
            `Ajuste por modificación de aportación (ID: ${req.params.id})`
          ]
        );
      }
    }

    // Registrar en bitácora
    await connection.query(
      `INSERT INTO bitacora (id_usuario, accion, detalle, fecha) 
       VALUES (?, ?, ?, NOW())`,
      [
        aportacionActual[0].id_usuario,
        "Actualización de aportación",
        `Se actualizó la aportación ID: ${req.params.id}`
      ]
    );

    await connection.commit();

    res.json({ 
      success: true,
      message: "Aportación actualizada correctamente" 
    });

  } catch (error) {
    await connection.rollback();
    console.error("ERROR AL ACTUALIZAR APORTACIÓN:", error);
    res.status(500).json({ 
      message: "Error al actualizar la aportación", 
      error: error.message 
    });
  } finally {
    connection.release();
  }
});

// ============================================
// ELIMINAR UNA APORTACIÓN (CON AJUSTE DE CUENTA)
// ============================================
router.delete("/:id", async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    // Obtener la aportación
    const [aportacion] = await connection.query(
      `SELECT * FROM aportaciones WHERE id_aportacion = ?`,
      [req.params.id]
    );

    if (aportacion.length === 0) {
      return res.status(404).json({ message: "Aportación no encontrada" });
    }

    const montoAportacion = parseFloat(aportacion[0].monto);
    const id_usuario = aportacion[0].id_usuario;

    await connection.beginTransaction();

    // Eliminar la aportación
    await connection.query(
      `DELETE FROM aportaciones WHERE id_aportacion = ?`,
      [req.params.id]
    );

    // Ajustar saldo de la cuenta
    const [cuenta] = await connection.query(
      `SELECT * FROM cuentas WHERE id_usuario = ? AND tipo_cuenta = 'Aportaciones' LIMIT 1`,
      [id_usuario]
    );

    if (cuenta.length > 0 && parseFloat(cuenta[0].saldo_actual) >= montoAportacion) {
      const nuevoSaldo = parseFloat(cuenta[0].saldo_actual) - montoAportacion;
      
      await connection.query(
        `UPDATE cuentas SET saldo_actual = ? WHERE id_cuenta = ?`,
        [nuevoSaldo, cuenta[0].id_cuenta]
      );

      // Registrar movimiento de ajuste
      await connection.query(
        `INSERT INTO movimientos_cuenta (id_cuenta, tipo_movimiento, monto, descripcion, fecha) 
         VALUES (?, 'retiro', ?, ?, NOW())`,
        [
          cuenta[0].id_cuenta,
          montoAportacion,
          `Ajuste por eliminación de aportación (ID: ${req.params.id})`
        ]
      );
    }

    // Registrar en bitácora
    await connection.query(
      `INSERT INTO bitacora (id_usuario, accion, detalle, fecha) 
       VALUES (?, ?, ?, NOW())`,
      [id_usuario, "Eliminación de aportación", `Se eliminó la aportación ID: ${req.params.id} de L. ${montoAportacion.toFixed(2)}`]
    );

    await connection.commit();

    res.json({ 
      success: true,
      message: "Aportación eliminada correctamente y cuenta ajustada" 
    });

  } catch (error) {
    await connection.rollback();
    console.error("ERROR AL ELIMINAR APORTACIÓN:", error);
    res.status(500).json({ 
      message: "Error al eliminar la aportación", 
      error: error.message 
    });
  } finally {
    connection.release();
  }
});

// ============================================
// ESTADÍSTICAS DE APORTACIONES
// ============================================
router.get("/estadisticas/general", async (req, res) => {
  try {
    // Totales generales
    const [totales] = await pool.query(`
      SELECT 
      COUNT(*) as total_aportaciones,
      IFNULL(SUM(monto), 0) as monto_total,
      IFNULL(AVG(monto), 0) as promedio_aportacion,
      COUNT(DISTINCT id_usuario) as total_socios_aportantes
      FROM aportaciones
    `);

    // Aportaciones este mes
    const [esteMes] = await pool.query(`
      SELECT 
      COUNT(*) as total_aportaciones,
      IFNULL(SUM(monto), 0) as monto_total
      FROM aportaciones
      WHERE MONTH(fecha) = MONTH(CURRENT_DATE())
      AND YEAR(fecha) = YEAR(CURRENT_DATE())
    `);

    // Top 5 socios con más aportaciones
    const [topSocios] = await pool.query(`
      SELECT 
      u.id_usuario,
      u.nombre_completo,
      u.dni,
      COUNT(a.id_aportacion) as total_aportaciones,
      IFNULL(SUM(a.monto), 0) as monto_total
      FROM aportaciones a
      INNER JOIN usuarios u ON a.id_usuario = u.id_usuario
      GROUP BY u.id_usuario
      ORDER BY monto_total DESC
      LIMIT 5
    `);

    res.json({
      success: true,
      estadisticas: {
        totales: totales[0],
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

module.exports = router;
