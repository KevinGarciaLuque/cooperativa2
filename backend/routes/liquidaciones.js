const express = require("express");
const router = express.Router();
const pool = require("../db");

// ============================================
// FUNCIÓN AUXILIAR: REGISTRAR EN BITÁCORA
// ============================================
async function registrarBitacora(connection, id_usuario, accion, descripcion) {
  await connection.query(
    `INSERT INTO bitacora (id_usuario, accion, detalle) VALUES (?, ?, ?)`,
    [id_usuario, accion, descripcion]
  );
}

// ============================================
// FUNCIÓN AUXILIAR: REGISTRAR MOVIMIENTO EN CUENTA
// ============================================
async function registrarMovimiento(connection, id_cuenta, tipo, monto, descripcion) {
  const [cuenta] = await connection.query(
    'SELECT saldo_actual FROM cuentas WHERE id_cuenta = ?',
    [id_cuenta]
  );

  if (cuenta.length === 0) {
    throw new Error(`Cuenta ${id_cuenta} no encontrada`);
  }

  const saldo_anterior = parseFloat(cuenta[0].saldo_actual);
  const saldo_nuevo = saldo_anterior + parseFloat(monto);

  await connection.query(
    `INSERT INTO movimientos_cuenta 
     (id_cuenta, tipo, monto, saldo_anterior, saldo_nuevo, descripcion)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id_cuenta, tipo, monto, saldo_anterior, saldo_nuevo, descripcion]
  );

  return saldo_nuevo;
}

// ============================================
// OBTENER TODAS LAS LIQUIDACIONES CON FILTROS Y PAGINACIÓN
// ============================================
router.get("/", async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      fecha_inicio = '', 
      fecha_fin = '',
      tipo_reparto = '', // 'proporcional', 'igualitario'
      search = ''
    } = req.query;

    const offset = (page - 1) * limit;

    let whereClause = "WHERE 1=1";
    let params = [];

    // Filtro por rango de fechas
    if (fecha_inicio && fecha_fin) {
      whereClause += ` AND DATE(l.fecha) BETWEEN ? AND ?`;
      params.push(fecha_inicio, fecha_fin);
    }

    // Filtro por tipo de reparto
    if (tipo_reparto) {
      whereClause += ` AND l.tipo_reparto = ?`;
      params.push(tipo_reparto);
    }

    // Búsqueda en descripción o nombre de actividad
    if (search) {
      whereClause += ` AND (l.descripcion LIKE ? OR a.nombre LIKE ?)`;
      const searchParam = `%${search}%`;
      params.push(searchParam, searchParam);
    }

    // Contar total de registros
    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total 
       FROM liquidaciones l
       INNER JOIN actividades a ON l.id_actividad = a.id_actividad
       ${whereClause}`,
      params
    );
    const total = countResult[0].total;

    // Obtener liquidaciones paginadas
    const [liquidaciones] = await pool.query(
      `SELECT l.*, 
       a.nombre as nombre_actividad,
       a.tipo as tipo_actividad,
       (SELECT COUNT(*) FROM liquidacion_socios ls WHERE ls.id_liquidacion = l.id_liquidacion) as total_socios_beneficiados
       FROM liquidaciones l
       INNER JOIN actividades a ON l.id_actividad = a.id_actividad
       ${whereClause}
       ORDER BY l.fecha DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), parseInt(offset)]
    );

    // Calcular totales
    const [totales] = await pool.query(
      `SELECT 
       COUNT(*) as total_liquidaciones,
       IFNULL(SUM(l.monto_total), 0) as monto_total_distribuido
       FROM liquidaciones l
       INNER JOIN actividades a ON l.id_actividad = a.id_actividad
       ${whereClause}`,
      params
    );

    res.json({
      success: true,
      data: liquidaciones,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit),
      },
      totales: totales[0],
    });
  } catch (error) {
    console.error("ERROR AL OBTENER LIQUIDACIONES:", error);
    res.status(500).json({ 
      success: false,
      message: "Error al obtener las liquidaciones", 
      error: error.message 
    });
  }
});

// ============================================
// OBTENER LIQUIDACIÓN POR ID
// ============================================
router.get("/:id", async (req, res) => {
  try {
    const [liquidacion] = await pool.query(
      `SELECT l.*, 
       a.nombre as nombre_actividad,
       a.tipo as tipo_actividad,
       a.monto as monto_actividad
       FROM liquidaciones l
       INNER JOIN actividades a ON l.id_actividad = a.id_actividad
       WHERE l.id_liquidacion = ?`,
      [req.params.id]
    );
    
    if (liquidacion.length === 0) {
      return res.status(404).json({ 
        success: false,
        message: "Liquidación no encontrada" 
      });
    }

    // Obtener socios beneficiados
    const [socios] = await pool.query(
      `SELECT ls.*, 
       u.nombre_completo,
       u.dni,
       u.correo
       FROM liquidacion_socios ls
       INNER JOIN usuarios u ON ls.id_usuario = u.id_usuario
       WHERE ls.id_liquidacion = ?
       ORDER BY ls.monto_recibido DESC`,
      [req.params.id]
    );
    
    res.json({
      success: true,
      data: liquidacion[0],
      socios_beneficiados: socios,
      total_socios: socios.length,
    });
  } catch (error) {
    console.error("ERROR AL OBTENER LIQUIDACIÓN:", error);
    res.status(500).json({ 
      success: false,
      message: "Error al obtener la liquidación", 
      error: error.message 
    });
  }
});

// ============================================
// OBTENER LIQUIDACIONES DE UN SOCIO
// ============================================
router.get("/socio/:id_usuario", async (req, res) => {
  try {
    const { fecha_inicio = '', fecha_fin = '' } = req.query;

    let whereClause = "WHERE ls.id_usuario = ?";
    let params = [req.params.id_usuario];

    if (fecha_inicio && fecha_fin) {
      whereClause += ` AND DATE(l.fecha) BETWEEN ? AND ?`;
      params.push(fecha_inicio, fecha_fin);
    }

    const [liquidaciones] = await pool.query(
      `SELECT l.*, 
       ls.monto_recibido,
       ls.desembolsado,
       a.nombre as nombre_actividad,
       a.tipo as tipo_actividad
       FROM liquidacion_socios ls
       INNER JOIN liquidaciones l ON ls.id_liquidacion = l.id_liquidacion
       INNER JOIN actividades a ON l.id_actividad = a.id_actividad
       ${whereClause}
       ORDER BY l.fecha DESC`,
      params
    );

    // Calcular totales del socio
    const [totales] = await pool.query(
      `SELECT 
       COUNT(*) as total_liquidaciones,
       IFNULL(SUM(ls.monto_recibido), 0) as monto_total_recibido,
       COUNT(CASE WHEN ls.desembolsado = 1 THEN 1 END) as total_desembolsadas,
       COUNT(CASE WHEN ls.desembolsado = 0 THEN 1 END) as total_pendientes
       FROM liquidacion_socios ls
       INNER JOIN liquidaciones l ON ls.id_liquidacion = l.id_liquidacion
       ${whereClause}`,
      params
    );

    res.json({
      success: true,
      data: liquidaciones,
      totales: totales[0],
    });
  } catch (error) {
    console.error("ERROR AL OBTENER LIQUIDACIONES DEL SOCIO:", error);
    res.status(500).json({ 
      success: false,
      message: "Error al obtener liquidaciones del socio", 
      error: error.message 
    });
  }
});

// ============================================
// CÁLCULO DEL REPARTO (compartido por la vista previa y el registro)
// Solo reciben utilidades los usuarios con rol Socio y estado activo.
// ============================================
const calcularReparto = async (conn, montoTotal, tipoReparto) => {
  const [socios] = await conn.query(
    `SELECT u.id_usuario, u.nombre_completo, u.dni,
            IFNULL((SELECT SUM(ap.monto) FROM aportaciones ap WHERE ap.id_usuario = u.id_usuario), 0) AS total_aportado
     FROM usuarios u
     INNER JOIN roles r ON u.rol_id = r.id_rol
     WHERE u.estado = 'activo' AND r.nombre = 'Socio'
     ORDER BY u.nombre_completo`
  );

  if (socios.length === 0) {
    throw new Error("No hay socios activos para liquidar");
  }

  let detalle;
  if (tipoReparto === "igualitario") {
    detalle = socios.map((s) => ({
      id_usuario: s.id_usuario,
      nombre_completo: s.nombre_completo,
      dni: s.dni,
      total_aportado: parseFloat(s.total_aportado),
      porcentaje: parseFloat((100 / socios.length).toFixed(4)),
      monto_recibido: Math.floor((montoTotal / socios.length) * 100) / 100,
    }));
  } else {
    const totalSistema = socios.reduce((sum, s) => sum + parseFloat(s.total_aportado), 0);
    if (totalSistema === 0) {
      throw new Error("No hay aportaciones registradas para hacer reparto proporcional. Use reparto igualitario.");
    }
    detalle = socios.map((s) => {
      const porcentaje = (parseFloat(s.total_aportado) / totalSistema) * 100;
      return {
        id_usuario: s.id_usuario,
        nombre_completo: s.nombre_completo,
        dni: s.dni,
        total_aportado: parseFloat(s.total_aportado),
        porcentaje: parseFloat(porcentaje.toFixed(4)),
        monto_recibido: Math.floor(((montoTotal * porcentaje) / 100) * 100) / 100,
      };
    });
  }

  // Los centavos que sobran por redondeo se asignan al socio con mayor participación,
  // para que la suma repartida sea exactamente el monto de la utilidad.
  const repartido = detalle.reduce((s, d) => s + d.monto_recibido, 0);
  const residuo = parseFloat((montoTotal - repartido).toFixed(2));
  if (Math.abs(residuo) > 0 && detalle.length) {
    const mayor = detalle.reduce((a, b) => (b.monto_recibido > a.monto_recibido ? b : a));
    mayor.monto_recibido = parseFloat((mayor.monto_recibido + residuo).toFixed(2));
  }

  return detalle;
};

// ============================================
// VISTA PREVIA: GET /api/liquidaciones/preview?id_actividad=&tipo_reparto=
// ============================================
router.get("/preview", async (req, res) => {
  try {
    const { id_actividad, tipo_reparto = "proporcional" } = req.query;
    if (!id_actividad) return res.status(400).json({ message: "Indica la actividad a liquidar." });
    if (!["proporcional", "igualitario"].includes(tipo_reparto)) {
      return res.status(400).json({ message: "Tipo de reparto inválido." });
    }
    const [act] = await pool.query("SELECT * FROM actividades WHERE id_actividad = ?", [id_actividad]);
    if (!act.length) return res.status(404).json({ message: "Actividad no encontrada" });

    const [liq] = await pool.query("SELECT id_liquidacion FROM liquidaciones WHERE id_actividad = ?", [id_actividad]);
    const monto = parseFloat(act[0].monto);
    const detalle = await calcularReparto(pool, monto, tipo_reparto);

    res.json({
      success: true,
      actividad: { id_actividad: act[0].id_actividad, nombre: act[0].nombre, tipo: act[0].tipo, monto },
      ya_liquidada: liq.length > 0,
      tipo_reparto,
      total_socios: detalle.length,
      total_repartido: parseFloat(detalle.reduce((s, d) => s + d.monto_recibido, 0).toFixed(2)),
      detalle,
    });
  } catch (error) {
    res.status(400).json({ message: error.message || "No se pudo calcular el reparto" });
  }
});

// ============================================
// ACTIVIDADES PENDIENTES DE LIQUIDAR
// ============================================
router.get("/actividades-disponibles", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT a.id_actividad, a.nombre, a.tipo, a.monto, a.fecha
       FROM actividades a
       WHERE NOT EXISTS (SELECT 1 FROM liquidaciones l WHERE l.id_actividad = a.id_actividad)
       ORDER BY a.fecha DESC`
    );
    res.json({ success: true, data: rows.map((r) => ({ ...r, monto: parseFloat(r.monto) })) });
  } catch (error) {
    console.error("ERROR AL LISTAR ACTIVIDADES DISPONIBLES:", error);
    res.status(500).json({ message: "Error al listar las actividades" });
  }
});

// ============================================
// CREAR NUEVA LIQUIDACIÓN (REPARTO PROPORCIONAL O IGUALITARIO)
// ============================================
router.post("/", async (req, res) => {
  try {
    const { 
      id_actividad, 
      descripcion,
      tipo_reparto = 'proporcional', // 'proporcional' o 'igualitario'
      desembolsar_a_cuenta = false, // Si true, deposita en cuenta de aportaciones
      id_usuario_registro
    } = req.body;

    // Validaciones
    if (!id_actividad) {
      return res.status(400).json({ 
        success: false,
        message: "El ID de actividad es requerido" 
      });
    }

    if (!['proporcional', 'igualitario'].includes(tipo_reparto)) {
      return res.status(400).json({ 
        success: false,
        message: "Tipo de reparto debe ser 'proporcional' o 'igualitario'" 
      });
    }

    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();

      // Obtener información de la actividad
      const [actividad] = await connection.query(
        'SELECT * FROM actividades WHERE id_actividad = ?',
        [id_actividad]
      );

      if (actividad.length === 0) {
        throw new Error('Actividad no encontrada');
      }

      // Verificar que no esté liquidada ya
      const [liquidacionExistente] = await connection.query(
        'SELECT id_liquidacion FROM liquidaciones WHERE id_actividad = ?',
        [id_actividad]
      );

      if (liquidacionExistente.length > 0) {
        throw new Error('Esta actividad ya fue liquidada');
      }

      const monto_total = parseFloat(actividad[0].monto);

      const repartoDetalle = await calcularReparto(connection, monto_total, tipo_reparto);

      // Crear la liquidación
      const [resultLiq] = await connection.query(
        `INSERT INTO liquidaciones (id_actividad, monto_total, tipo_reparto, descripcion)
         VALUES (?, ?, ?, ?)`,
        [id_actividad, monto_total, tipo_reparto, descripcion || null]
      );

      const id_liquidacion = resultLiq.insertId;

      // Insertar detalle por cada socio
      for (const detalle of repartoDetalle) {
        await connection.query(
          `INSERT INTO liquidacion_socios (id_liquidacion, id_usuario, monto_recibido, desembolsado)
           VALUES (?, ?, ?, ?)`,
          [id_liquidacion, detalle.id_usuario, detalle.monto_recibido, desembolsar_a_cuenta ? 1 : 0]
        );

        // Si se debe desembolsar a cuenta de aportaciones
        if (desembolsar_a_cuenta) {
          // Obtener cuenta de aportaciones del socio
          const [cuenta] = await connection.query(
            `SELECT id_cuenta FROM cuentas 
             WHERE id_usuario = ? AND tipo_cuenta = 'aportaciones' AND estado = 'activa'
             LIMIT 1`,
            [detalle.id_usuario]
          );

          if (cuenta.length > 0) {
            const id_cuenta = cuenta[0].id_cuenta;
            
            // Actualizar saldo de cuenta
            const nuevo_saldo = await registrarMovimiento(
              connection,
              id_cuenta,
              'aporte',
              detalle.monto_recibido,
              `Liquidación de utilidades - ${actividad[0].nombre}`
            );

            await connection.query(
              'UPDATE cuentas SET saldo_actual = ? WHERE id_cuenta = ?',
              [nuevo_saldo, id_cuenta]
            );
          }
        }
      }

      // Registrar en bitácora
      if (id_usuario_registro) {
        await registrarBitacora(
          connection,
          id_usuario_registro,
          'CREAR_LIQUIDACION',
          `Creó liquidación ${tipo_reparto} de ${monto_total} para ${repartoDetalle.length} socios - Actividad: ${actividad[0].nombre}`
        );
      }

      await connection.commit();

      res.status(201).json({
        success: true,
        message: "Liquidación registrada exitosamente",
        id_liquidacion,
        tipo_reparto,
        total_socios_beneficiados: repartoDetalle.length,
        monto_total,
        desembolsado_a_cuentas: desembolsar_a_cuenta,
        detalle: repartoDetalle,
      });

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

  } catch (error) {
    console.error("ERROR AL CREAR LIQUIDACIÓN:", error);
    res.status(500).json({ 
      success: false,
      message: error.message || "Error al crear la liquidación", 
      error: error.message 
    });
  }
});

// ============================================
// DESEMBOLSAR LIQUIDACIÓN A CUENTA DE SOCIO
// ============================================
router.post("/:id/desembolsar/:id_usuario", async (req, res) => {
  try {
    const { id_usuario_autoriza } = req.body;

    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();

      // Obtener información de la liquidación y socio
      const [liquidacionSocio] = await connection.query(
        `SELECT ls.*, l.id_actividad, a.nombre as nombre_actividad
         FROM liquidacion_socios ls
         INNER JOIN liquidaciones l ON ls.id_liquidacion = l.id_liquidacion
         INNER JOIN actividades a ON l.id_actividad = a.id_actividad
         WHERE ls.id_liquidacion = ? AND ls.id_usuario = ?`,
        [req.params.id, req.params.id_usuario]
      );

      if (liquidacionSocio.length === 0) {
        throw new Error('Registro de liquidación no encontrado');
      }

      if (liquidacionSocio[0].desembolsado) {
        throw new Error('Esta liquidación ya fue desembolsada al socio');
      }

      // Obtener cuenta de aportaciones del socio
      const [cuenta] = await connection.query(
        `SELECT id_cuenta FROM cuentas 
         WHERE id_usuario = ? AND tipo_cuenta = 'aportaciones' AND estado = 'activa'
         LIMIT 1`,
        [req.params.id_usuario]
      );

      if (cuenta.length === 0) {
        throw new Error('El socio no tiene una cuenta de aportaciones activa');
      }

      const id_cuenta = cuenta[0].id_cuenta;
      const monto = parseFloat(liquidacionSocio[0].monto_recibido);

      // Actualizar saldo de cuenta
      const nuevo_saldo = await registrarMovimiento(
        connection,
        id_cuenta,
        'aporte',
        monto,
        `Desembolso de liquidación - ${liquidacionSocio[0].nombre_actividad}`
      );

      await connection.query(
        'UPDATE cuentas SET saldo_actual = ? WHERE id_cuenta = ?',
        [nuevo_saldo, id_cuenta]
      );

      // Marcar como desembolsado
      await connection.query(
        `UPDATE liquidacion_socios 
         SET desembolsado = 1
         WHERE id_liquidacion = ? AND id_usuario = ?`,
        [req.params.id, req.params.id_usuario]
      );

      // Registrar en bitácora
      if (id_usuario_autoriza) {
        await registrarBitacora(
          connection,
          id_usuario_autoriza,
          'DESEMBOLSAR_LIQUIDACION',
          `Desembolsó ${monto} de liquidación ID ${req.params.id} al socio ID ${req.params.id_usuario}`
        );
      }

      await connection.commit();

      res.json({
        success: true,
        message: "Liquidación desembolsada exitosamente",
        monto_desembolsado: monto,
        nuevo_saldo_cuenta: nuevo_saldo,
      });

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

  } catch (error) {
    console.error("ERROR AL DESEMBOLSAR LIQUIDACIÓN:", error);
    res.status(500).json({ 
      success: false,
      message: error.message || "Error al desembolsar la liquidación", 
      error: error.message 
    });
  }
});

// ============================================
// ESTADÍSTICAS DE LIQUIDACIONES
// ============================================
router.get("/estadisticas/general", async (req, res) => {
  try {
    const { fecha_inicio = '', fecha_fin = '' } = req.query;

    let whereClause = "WHERE 1=1";
    let params = [];

    if (fecha_inicio && fecha_fin) {
      whereClause += ` AND DATE(l.fecha) BETWEEN ? AND ?`;
      params.push(fecha_inicio, fecha_fin);
    }

    // Resumen general
    const [resumenGeneral] = await pool.query(
      `SELECT 
       COUNT(*) as total_liquidaciones,
       IFNULL(SUM(l.monto_total), 0) as monto_total_distribuido,
       IFNULL(AVG(l.monto_total), 0) as promedio_por_liquidacion,
       COUNT(CASE WHEN l.tipo_reparto = 'proporcional' THEN 1 END) as total_proporcionales,
       COUNT(CASE WHEN l.tipo_reparto = 'igualitario' THEN 1 END) as total_igualitarias
       FROM liquidaciones l
       ${whereClause}`,
      params
    );

    // Liquidaciones por mes
    let dateFilter = whereClause;
    let dateParams = [...params];
    
    if (!fecha_inicio && !fecha_fin) {
      dateFilter += ` AND l.fecha >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)`;
    }

    const [liquidacionesPorMes] = await pool.query(
      `SELECT 
       DATE_FORMAT(l.fecha, '%Y-%m') as mes,
       COUNT(*) as cantidad,
       SUM(l.monto_total) as total_distribuido
       FROM liquidaciones l
       ${dateFilter}
       GROUP BY mes
       ORDER BY mes DESC`,
      dateParams
    );

    // Top socios beneficiados
    const [topSocios] = await pool.query(
      `SELECT 
       u.id_usuario,
       u.nombre_completo,
       u.dni,
       COUNT(ls.id_liquidacion) as total_liquidaciones_recibidas,
       SUM(ls.monto_recibido) as monto_total_recibido,
       SUM(CASE WHEN ls.desembolsado = 1 THEN ls.monto_recibido ELSE 0 END) as monto_desembolsado,
       SUM(CASE WHEN ls.desembolsado = 0 THEN ls.monto_recibido ELSE 0 END) as monto_pendiente
       FROM liquidacion_socios ls
       INNER JOIN usuarios u ON ls.id_usuario = u.id_usuario
       INNER JOIN liquidaciones l ON ls.id_liquidacion = l.id_liquidacion
       ${whereClause.replace('WHERE 1=1', 'WHERE 1=1')}
       GROUP BY u.id_usuario, u.nombre_completo, u.dni
       ORDER BY monto_total_recibido DESC
       LIMIT 10`,
      params
    );

    // Estadísticas de desembolsos
    const [estadisticasDesembolsos] = await pool.query(
      `SELECT 
       COUNT(*) as total_registros,
       COUNT(CASE WHEN desembolsado = 1 THEN 1 END) as total_desembolsados,
       COUNT(CASE WHEN desembolsado = 0 THEN 1 END) as total_pendientes,
       SUM(CASE WHEN desembolsado = 1 THEN monto_recibido ELSE 0 END) as monto_desembolsado,
       SUM(CASE WHEN desembolsado = 0 THEN monto_recibido ELSE 0 END) as monto_pendiente
       FROM liquidacion_socios ls
       INNER JOIN liquidaciones l ON ls.id_liquidacion = l.id_liquidacion
       ${whereClause.replace('WHERE 1=1', 'WHERE 1=1')}`,
      params
    );

    res.json({
      success: true,
      resumen_general: resumenGeneral[0],
      liquidaciones_por_mes: liquidacionesPorMes,
      top_socios_beneficiados: topSocios,
      estadisticas_desembolsos: estadisticasDesembolsos[0],
    });
  } catch (error) {
    console.error("ERROR AL OBTENER ESTADÍSTICAS:", error);
    res.status(500).json({ 
      success: false,
      message: "Error al obtener las estadísticas", 
      error: error.message 
    });
  }
});

module.exports = router;
