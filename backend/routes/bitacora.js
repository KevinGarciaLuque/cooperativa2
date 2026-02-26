const express = require("express");
const router = express.Router();
const pool = require("../db");

// ============================================
// CATEGORÍAS DE ACCIONES PARA FILTRADO
// ============================================
const CATEGORIAS_ACCIONES = {
  AUTENTICACION: ['LOGIN', 'LOGOUT', 'CAMBIO_PASSWORD', 'RECUPERAR_PASSWORD'],
  USUARIOS: ['CREAR_USUARIO', 'ACTUALIZAR_USUARIO', 'ELIMINAR_USUARIO', 'CAMBIAR_ESTADO_USUARIO'],
  CUENTAS: ['CREAR_CUENTA', 'ACTUALIZAR_CUENTA', 'AJUSTE_CUENTA', 'CAMBIAR_ESTADO_CUENTA', 'TRANSFERENCIA'],
  APORTACIONES: ['CREAR_APORTACION', 'ACTUALIZAR_APORTACION', 'ELIMINAR_APORTACION'],
  PRESTAMOS: ['SOLICITAR_PRESTAMO', 'APROBAR_PRESTAMO', 'RECHAZAR_PRESTAMO', 'CAMBIAR_ESTADO_PRESTAMO', 'LIQUIDAR_PRESTAMO'],
  PAGOS: ['REGISTRAR_PAGO', 'REVERSAR_PAGO'],
  ROLES: ['CREAR_ROL', 'ACTUALIZAR_ROL', 'ELIMINAR_ROL'],
  SISTEMA: ['ERROR', 'ADVERTENCIA', 'RESPALDO', 'CONFIGURACION']
};

// ============================================
// OBTENER REGISTROS DE BITÁCORA CON FILTROS Y PAGINACIÓN
// ============================================
router.get("/", async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 50, 
      id_usuario = '',
      accion = '',
      categoria = '',
      fecha_inicio = '',
      fecha_fin = '',
      search = ''
    } = req.query;

    const offset = (page - 1) * limit;

    let whereClause = "WHERE 1=1";
    let params = [];

    // Filtro por usuario
    if (id_usuario) {
      whereClause += ` AND b.id_usuario = ?`;
      params.push(id_usuario);
    }

    // Filtro por acción específica
    if (accion) {
      whereClause += ` AND b.accion = ?`;
      params.push(accion);
    }

    // Filtro por categoría
    if (categoria && CATEGORIAS_ACCIONES[categoria]) {
      const acciones = CATEGORIAS_ACCIONES[categoria];
      const placeholders = acciones.map(() => '?').join(',');
      whereClause += ` AND b.accion IN (${placeholders})`;
      params.push(...acciones);
    }

    // Filtro por rango de fechas
    if (fecha_inicio && fecha_fin) {
      whereClause += ` AND DATE(b.fecha) BETWEEN ? AND ?`;
      params.push(fecha_inicio, fecha_fin);
    }

    // Búsqueda en detalle o nombre de usuario
    if (search) {
      whereClause += ` AND (b.detalle LIKE ? OR u.nombre_completo LIKE ? OR b.accion LIKE ?)`;
      const searchParam = `%${search}%`;
      params.push(searchParam, searchParam, searchParam);
    }

    // Contar total de registros
    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total 
       FROM bitacora b
       LEFT JOIN usuarios u ON b.id_usuario = u.id_usuario
       ${whereClause}`,
      params
    );
    const total = countResult[0].total;

    // Obtener registros paginados
    const [registros] = await pool.query(
      `SELECT b.*, 
       u.nombre_completo,
       u.dni,
       u.correo
       FROM bitacora b
       LEFT JOIN usuarios u ON b.id_usuario = u.id_usuario
       ${whereClause}
       ORDER BY b.fecha DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), parseInt(offset)]
    );

    res.json({
      success: true,
      data: registros,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("ERROR AL OBTENER BITÁCORA:", error);
    res.status(500).json({ 
      message: "Error al obtener los registros de bitácora", 
      error: error.message 
    });
  }
});

// ============================================
// OBTENER BITÁCORA DE UN USUARIO ESPECÍFICO
// ============================================
router.get("/usuario/:id_usuario", async (req, res) => {
  try {
    const { fecha_inicio = '', fecha_fin = '', categoria = '' } = req.query;

    let whereClause = "WHERE b.id_usuario = ?";
    let params = [req.params.id_usuario];

    if (fecha_inicio && fecha_fin) {
      whereClause += ` AND DATE(b.fecha) BETWEEN ? AND ?`;
      params.push(fecha_inicio, fecha_fin);
    }

    if (categoria && CATEGORIAS_ACCIONES[categoria]) {
      const acciones = CATEGORIAS_ACCIONES[categoria];
      const placeholders = acciones.map(() => '?').join(',');
      whereClause += ` AND b.accion IN (${placeholders})`;
      params.push(...acciones);
    }

    const [registros] = await pool.query(
      `SELECT b.*, u.nombre_completo
       FROM bitacora b
       INNER JOIN usuarios u ON b.id_usuario = u.id_usuario
       ${whereClause}
       ORDER BY b.fecha DESC`,
      params
    );

    // Agrupar por acción
    const porAccion = registros.reduce((acc, reg) => {
      if (!acc[reg.accion]) {
        acc[reg.accion] = { cantidad: 0, registros: [] };
      }
      acc[reg.accion].cantidad++;
      acc[reg.accion].registros.push(reg);
      return acc;
    }, {});

    res.json({
      success: true,
      data: registros,
      total_registros: registros.length,
      por_accion: porAccion,
    });
  } catch (error) {
    console.error("ERROR AL OBTENER BITÁCORA DEL USUARIO:", error);
    res.status(500).json({ 
      message: "Error al obtener bitácora del usuario", 
      error: error.message 
    });
  }
});

// ============================================
// OBTENER UN REGISTRO ESPECÍFICO
// ============================================
router.get("/:id", async (req, res) => {
  try {
    const [registro] = await pool.query(
      `SELECT b.*, 
       u.nombre_completo,
       u.dni,
       u.correo,
       u.telefono
       FROM bitacora b
       LEFT JOIN usuarios u ON b.id_usuario = u.id_usuario
       WHERE b.id_bitacora = ?`,
      [req.params.id]
    );
    
    if (registro.length === 0) {
      return res.status(404).json({ 
        success: false,
        message: "Registro no encontrado" 
      });
    }
    
    res.json({
      success: true,
      data: registro[0],
    });
  } catch (error) {
    console.error("ERROR AL OBTENER REGISTRO:", error);
    res.status(500).json({ 
      message: "Error al obtener el registro", 
      error: error.message 
    });
  }
});

// ============================================
// ESTADÍSTICAS DE BITÁCORA
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

    // Total de acciones por tipo
    const [accionesPorTipo] = await pool.query(
      `SELECT 
       accion,
       COUNT(*) as cantidad
       FROM bitacora
       ${whereClause}
       GROUP BY accion
       ORDER BY cantidad DESC
       LIMIT 20`,
      params
    );

    // Usuarios más activos
    const [usuariosMasActivos] = await pool.query(
      `SELECT 
       u.id_usuario,
       u.nombre_completo,
       u.correo,
       COUNT(b.id_bitacora) as total_acciones
       FROM bitacora b
       INNER JOIN usuarios u ON b.id_usuario = u.id_usuario
       ${whereClause.replace('WHERE 1=1', 'WHERE 1=1')}
       GROUP BY u.id_usuario, u.nombre_completo, u.correo
       ORDER BY total_acciones DESC
       LIMIT 10`,
      params
    );

    // Actividad por día (últimas 2 semanas si no hay filtro)
    let dateFilter = whereClause;
    let dateParams = [...params];
    
    if (!fecha_inicio && !fecha_fin) {
      dateFilter += ` AND fecha >= DATE_SUB(CURDATE(), INTERVAL 14 DAY)`;
    }

    const [actividadPorDia] = await pool.query(
      `SELECT 
       DATE(fecha) as dia,
       COUNT(*) as total_acciones
       FROM bitacora
       ${dateFilter}
       GROUP BY dia
       ORDER BY dia DESC`,
      dateParams
    );

    // Actividad por hora del día
    const [actividadPorHora] = await pool.query(
      `SELECT 
       HOUR(fecha) as hora,
       COUNT(*) as cantidad
       FROM bitacora
       ${whereClause}
       GROUP BY hora
       ORDER BY hora`,
      params
    );

    // Resumen por categoría
    const resumenCategorias = {};
    for (const [categoria, acciones] of Object.entries(CATEGORIAS_ACCIONES)) {
      const placeholders = acciones.map(() => '?').join(',');
      const [result] = await pool.query(
        `SELECT COUNT(*) as cantidad
         FROM bitacora
         ${whereClause} AND accion IN (${placeholders})`,
        [...params, ...acciones]
      );
      resumenCategorias[categoria] = result[0].cantidad;
    }

    res.json({
      success: true,
      acciones_por_tipo: accionesPorTipo,
      usuarios_mas_activos: usuariosMasActivos,
      actividad_por_dia: actividadPorDia,
      actividad_por_hora: actividadPorHora,
      resumen_categorias: resumenCategorias,
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
// OBTENER CATEGORÍAS DE ACCIONES (PARA FILTROS)
// ============================================
router.get("/categorias/lista", (req, res) => {
  const categorias = Object.keys(CATEGORIAS_ACCIONES).map(categoria => ({
    categoria,
    acciones: CATEGORIAS_ACCIONES[categoria],
  }));

  res.json({
    success: true,
    data: categorias,
  });
});

// ============================================
// REGISTRAR ACCIÓN EN BITÁCORA (CREAR)
// ============================================
router.post("/", async (req, res) => {
  try {
    const { id_usuario, accion, detalle } = req.body;

    if (!accion) {
      return res.status(400).json({ 
        success: false,
        message: "La acción es requerida" 
      });
    }

    const [result] = await pool.query(
      `INSERT INTO bitacora (id_usuario, accion, detalle)
       VALUES (?, ?, ?)`,
      [id_usuario || null, accion, detalle || null]
    );

    res.status(201).json({
      success: true,
      message: "Registro creado exitosamente",
      id_bitacora: result.insertId,
    });
  } catch (error) {
    console.error("ERROR AL REGISTRAR EN BITÁCORA:", error);
    res.status(500).json({ 
      message: "Error al registrar en bitácora", 
      error: error.message 
    });
  }
});

// ============================================
// NOTA IMPORTANTE: INMUTABILIDAD DE BITÁCORA
// ============================================
// Los registros de bitácora NO deben editarse ni eliminarse por razones de auditoría.
// La bitácora es un registro histórico inmutable para seguridad y cumplimiento normativo.
// Solo se permiten políticas de retención automáticas (archivo o eliminación masiva
// de registros antiguos después de X años según políticas de la cooperativa).

// ============================================
// POLÍTICA DE RETENCIÓN: ARCHIVAR REGISTROS ANTIGUOS
// ============================================
router.post("/retencion/archivar", async (req, res) => {
  try {
    const { meses_antiguedad = 12, id_usuario_admin } = req.body;

    if (!id_usuario_admin) {
      return res.status(400).json({ 
        success: false,
        message: "Se requiere ID de usuario administrador" 
      });
    }

    // Contar registros a archivar
    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total
       FROM bitacora
       WHERE fecha < DATE_SUB(CURDATE(), INTERVAL ? MONTH)`,
      [meses_antiguedad]
    );

    const totalArchivar = countResult[0].total;

    if (totalArchivar === 0) {
      return res.json({
        success: true,
        message: "No hay registros para archivar",
        total_archivados: 0,
      });
    }

    // TODO: Implementar tabla bitacora_archivo y mover registros allí
    // Por ahora solo reportamos cuántos serían archivados

    // Registrar acción de archivo
    await pool.query(
      `INSERT INTO bitacora (id_usuario, accion, detalle)
       VALUES (?, ?, ?)`,
      [
        id_usuario_admin,
        'ARCHIVAR_BITACORA',
        `Se preparan ${totalArchivar} registros para archivo (mayores a ${meses_antiguedad} meses)`
      ]
    );

    res.json({
      success: true,
      message: `${totalArchivar} registros están listos para archivar`,
      total_registros: totalArchivar,
      meses: meses_antiguedad,
      nota: "Implementar tabla bitacora_archivo para completar el proceso",
    });
  } catch (error) {
    console.error("ERROR AL ARCHIVAR BITÁCORA:", error);
    res.status(500).json({ 
      message: "Error al archivar registros", 
      error: error.message 
    });
  }
});

module.exports = router;
