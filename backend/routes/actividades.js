const express = require("express");
const router = express.Router();
const pool = require("../db");

// ============================================
// TIPOS DE ACTIVIDADES
// ============================================
const TIPOS_ACTIVIDAD = [
  'rifas',
  'ventas',
  'intereses_ganados',
  'donaciones',
  'alquileres',
  'otros_ingresos'
];

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
// OBTENER TODAS LAS ACTIVIDADES CON FILTROS Y PAGINACIÓN
// ============================================
router.get("/", async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      tipo = '', 
      fecha_inicio = '', 
      fecha_fin = '',
      monto_min = '',
      monto_max = '',
      search = '',
      estado_liquidacion = '' // 'pendiente', 'liquidada'
    } = req.query;

    const offset = (page - 1) * limit;

    let whereClause = "WHERE 1=1";
    let params = [];

    // Filtro por tipo
    if (tipo) {
      whereClause += ` AND a.tipo = ?`;
      params.push(tipo);
    }

    // Filtro por rango de fechas
    if (fecha_inicio && fecha_fin) {
      whereClause += ` AND DATE(a.fecha) BETWEEN ? AND ?`;
      params.push(fecha_inicio, fecha_fin);
    }

    // Filtro por rango de montos
    if (monto_min) {
      whereClause += ` AND a.monto >= ?`;
      params.push(parseFloat(monto_min));
    }

    if (monto_max) {
      whereClause += ` AND a.monto <= ?`;
      params.push(parseFloat(monto_max));
    }

    // Búsqueda en nombre o descripción
    if (search) {
      whereClause += ` AND (a.nombre LIKE ? OR a.descripcion LIKE ?)`;
      const searchParam = `%${search}%`;
      params.push(searchParam, searchParam);
    }

    // Filtro por estado de liquidación
    if (estado_liquidacion === 'liquidada') {
      whereClause += ` AND EXISTS (SELECT 1 FROM liquidaciones l WHERE l.id_actividad = a.id_actividad)`;
    } else if (estado_liquidacion === 'pendiente') {
      whereClause += ` AND NOT EXISTS (SELECT 1 FROM liquidaciones l WHERE l.id_actividad = a.id_actividad)`;
    }

    // Contar total de registros
    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total 
       FROM actividades a
       ${whereClause}`,
      params
    );
    const total = countResult[0].total;

    // Obtener actividades paginadas con estado de liquidación
    const [actividades] = await pool.query(
      `SELECT a.*, 
       CASE 
         WHEN EXISTS (SELECT 1 FROM liquidaciones l WHERE l.id_actividad = a.id_actividad)
         THEN 'liquidada'
         ELSE 'pendiente'
       END as estado_liquidacion,
       (SELECT id_liquidacion FROM liquidaciones WHERE id_actividad = a.id_actividad LIMIT 1) as id_liquidacion
       FROM actividades a
       ${whereClause}
       ORDER BY a.fecha DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), parseInt(offset)]
    );

    // Calcular totales del filtro actual
    const [totales] = await pool.query(
      `SELECT 
       COUNT(*) as total_actividades,
       IFNULL(SUM(a.monto), 0) as monto_total,
       IFNULL(AVG(a.monto), 0) as monto_promedio
       FROM actividades a
       ${whereClause}`,
      params
    );

    res.json({
      success: true,
      data: actividades,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit),
      },
      totales: totales[0],
    });
  } catch (error) {
    console.error("ERROR AL OBTENER ACTIVIDADES:", error);
    res.status(500).json({ 
      success: false,
      message: "Error al obtener las actividades", 
      error: error.message 
    });
  }
});

// ============================================
// OBTENER UNA ACTIVIDAD POR ID
// ============================================
router.get("/:id", async (req, res) => {
  try {
    const [actividad] = await pool.query(
      `SELECT a.*,
       CASE 
         WHEN EXISTS (SELECT 1 FROM liquidaciones l WHERE l.id_actividad = a.id_actividad)
         THEN 'liquidada'
         ELSE 'pendiente'
       END as estado_liquidacion,
       l.id_liquidacion,
       l.fecha as fecha_liquidacion,
       l.descripcion as descripcion_liquidacion
       FROM actividades a
       LEFT JOIN liquidaciones l ON l.id_actividad = a.id_actividad
       WHERE a.id_actividad = ?`,
      [req.params.id]
    );
    
    if (actividad.length === 0) {
      return res.status(404).json({ 
        success: false,
        message: "Actividad no encontrada" 
      });
    }

    // Si está liquidada, obtener información de la liquidación
    let detalles_liquidacion = null;
    if (actividad[0].id_liquidacion) {
      const [socios] = await pool.query(
        `SELECT ls.*, u.nombre_completo, u.dni
         FROM liquidacion_socios ls
         INNER JOIN usuarios u ON ls.id_usuario = u.id_usuario
         WHERE ls.id_liquidacion = ?
         ORDER BY ls.monto_recibido DESC`,
        [actividad[0].id_liquidacion]
      );
      detalles_liquidacion = {
        total_socios_beneficiados: socios.length,
        socios: socios
      };
    }
    
    res.json({
      success: true,
      data: actividad[0],
      detalles_liquidacion,
    });
  } catch (error) {
    console.error("ERROR AL OBTENER ACTIVIDAD:", error);
    res.status(500).json({ 
      success: false,
      message: "Error al obtener la actividad", 
      error: error.message 
    });
  }
});

// ============================================
// REGISTRAR NUEVA ACTIVIDAD
// ============================================
router.post("/", async (req, res) => {
  try {
    const { 
      nombre, 
      tipo, 
      monto, 
      descripcion,
      id_usuario_registro // Usuario que registra la actividad
    } = req.body;

    // Validaciones
    if (!nombre || !tipo || !monto) {
      return res.status(400).json({ 
        success: false,
        message: "Nombre, tipo y monto son requeridos" 
      });
    }

    if (!TIPOS_ACTIVIDAD.includes(tipo)) {
      return res.status(400).json({ 
        success: false,
        message: `Tipo inválido. Debe ser uno de: ${TIPOS_ACTIVIDAD.join(', ')}` 
      });
    }

    if (parseFloat(monto) <= 0) {
      return res.status(400).json({ 
        success: false,
        message: "El monto debe ser mayor a 0" 
      });
    }

    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();

      // Insertar actividad
      const [result] = await connection.query(
        `INSERT INTO actividades (nombre, tipo, monto, descripcion)
         VALUES (?, ?, ?, ?)`,
        [nombre, tipo, parseFloat(monto), descripcion || null]
      );

      const id_actividad = result.insertId;

      // Registrar en bitácora
      if (id_usuario_registro) {
        await registrarBitacora(
          connection,
          id_usuario_registro,
          'CREAR_ACTIVIDAD',
          `Registró actividad "${nombre}" (${tipo}) por ${monto}`
        );
      }

      await connection.commit();

      res.status(201).json({
        success: true,
        message: "Actividad registrada exitosamente",
        id_actividad,
      });

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

  } catch (error) {
    console.error("ERROR AL REGISTRAR ACTIVIDAD:", error);
    res.status(500).json({ 
      success: false,
      message: "Error al registrar la actividad", 
      error: error.message 
    });
  }
});

// ============================================
// ACTUALIZAR ACTIVIDAD
// ============================================
router.put("/:id", async (req, res) => {
  try {
    const { nombre, tipo, monto, descripcion, id_usuario_actualiza } = req.body;

    // Verificar que la actividad no esté liquidada
    const [actividad] = await pool.query(
      `SELECT a.*, 
       EXISTS (SELECT 1 FROM liquidaciones l WHERE l.id_actividad = a.id_actividad) as liquidada
       FROM actividades a
       WHERE a.id_actividad = ?`,
      [req.params.id]
    );

    if (actividad.length === 0) {
      return res.status(404).json({ 
        success: false,
        message: "Actividad no encontrada" 
      });
    }

    if (actividad[0].liquidada) {
      return res.status(400).json({ 
        success: false,
        message: "No se puede actualizar una actividad que ya fue liquidada" 
      });
    }

    // Validaciones
    if (tipo && !TIPOS_ACTIVIDAD.includes(tipo)) {
      return res.status(400).json({ 
        success: false,
        message: `Tipo inválido. Debe ser uno de: ${TIPOS_ACTIVIDAD.join(', ')}` 
      });
    }

    if (monto && parseFloat(monto) <= 0) {
      return res.status(400).json({ 
        success: false,
        message: "El monto debe ser mayor a 0" 
      });
    }

    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();

      // Actualizar actividad
      await connection.query(
        `UPDATE actividades 
         SET nombre = COALESCE(?, nombre),
             tipo = COALESCE(?, tipo),
             monto = COALESCE(?, monto),
             descripcion = COALESCE(?, descripcion)
         WHERE id_actividad = ?`,
        [nombre, tipo, monto ? parseFloat(monto) : null, descripcion, req.params.id]
      );

      // Registrar en bitácora
      if (id_usuario_actualiza) {
        await registrarBitacora(
          connection,
          id_usuario_actualiza,
          'ACTUALIZAR_ACTIVIDAD',
          `Actualizó actividad ID ${req.params.id}`
        );
      }

      await connection.commit();

      res.json({
        success: true,
        message: "Actividad actualizada exitosamente",
      });

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

  } catch (error) {
    console.error("ERROR AL ACTUALIZAR ACTIVIDAD:", error);
    res.status(500).json({ 
      success: false,
      message: "Error al actualizar la actividad", 
      error: error.message 
    });
  }
});

// ============================================
// ELIMINAR ACTIVIDAD
// ============================================
router.delete("/:id", async (req, res) => {
  try {
    const { id_usuario_elimina } = req.body;

    // Verificar que la actividad no esté liquidada
    const [actividad] = await pool.query(
      `SELECT a.nombre,
       EXISTS (SELECT 1 FROM liquidaciones l WHERE l.id_actividad = a.id_actividad) as liquidada
       FROM actividades a
       WHERE a.id_actividad = ?`,
      [req.params.id]
    );

    if (actividad.length === 0) {
      return res.status(404).json({ 
        success: false,
        message: "Actividad no encontrada" 
      });
    }

    if (actividad[0].liquidada) {
      return res.status(400).json({ 
        success: false,
        message: "No se puede eliminar una actividad que ya fue liquidada" 
      });
    }

    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();

      // Eliminar actividad
      await connection.query(
        `DELETE FROM actividades WHERE id_actividad = ?`,
        [req.params.id]
      );

      // Registrar en bitácora
      if (id_usuario_elimina) {
        await registrarBitacora(
          connection,
          id_usuario_elimina,
          'ELIMINAR_ACTIVIDAD',
          `Eliminó actividad "${actividad[0].nombre}" ID ${req.params.id}`
        );
      }

      await connection.commit();

      res.json({
        success: true,
        message: "Actividad eliminada exitosamente",
      });

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

  } catch (error) {
    console.error("ERROR AL ELIMINAR ACTIVIDAD:", error);
    res.status(500).json({ 
      success: false,
      message: "Error al eliminar la actividad", 
      error: error.message 
    });
  }
});

// ============================================
// ESTADÍSTICAS DE ACTIVIDADES
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
       tipo,
       COUNT(*) as cantidad,
       SUM(monto) as total_monto,
       AVG(monto) as promedio_monto
       FROM actividades
       ${whereClause}
       GROUP BY tipo
       ORDER BY total_monto DESC`,
      params
    );

    // Resumen general
    const [resumenGeneral] = await pool.query(
      `SELECT 
       COUNT(*) as total_actividades,
       IFNULL(SUM(monto), 0) as monto_total,
       IFNULL(AVG(monto), 0) as monto_promedio,
       COUNT(CASE WHEN EXISTS (SELECT 1 FROM liquidaciones l WHERE l.id_actividad = actividades.id_actividad) THEN 1 END) as total_liquidadas,
       COUNT(CASE WHEN NOT EXISTS (SELECT 1 FROM liquidaciones l WHERE l.id_actividad = actividades.id_actividad) THEN 1 END) as total_pendientes
       FROM actividades
       ${whereClause}`,
      params
    );

    // Actividades por mes
    let dateFilter = whereClause;
    let dateParams = [...params];
    
    if (!fecha_inicio && !fecha_fin) {
      dateFilter += ` AND fecha >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)`;
    }

    const [actividadesPorMes] = await pool.query(
      `SELECT 
       DATE_FORMAT(fecha, '%Y-%m') as mes,
       COUNT(*) as cantidad,
       SUM(monto) as total
       FROM actividades
       ${dateFilter}
       GROUP BY mes
       ORDER BY mes DESC`,
      dateParams
    );

    // Top 10 actividades por monto
    const [topActividades] = await pool.query(
      `SELECT 
       id_actividad,
       nombre,
       tipo,
       monto,
       fecha,
       CASE 
         WHEN EXISTS (SELECT 1 FROM liquidaciones l WHERE l.id_actividad = actividades.id_actividad)
         THEN 'liquidada'
         ELSE 'pendiente'
       END as estado_liquidacion
       FROM actividades
       ${whereClause}
       ORDER BY monto DESC
       LIMIT 10`,
      params
    );

    res.json({
      success: true,
      totales_por_tipo: totalesPorTipo,
      resumen_general: resumenGeneral[0],
      actividades_por_mes: actividadesPorMes,
      top_actividades: topActividades,
      tipos_disponibles: TIPOS_ACTIVIDAD,
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
