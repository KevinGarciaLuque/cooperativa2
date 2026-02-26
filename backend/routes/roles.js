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
// OBTENER TODOS LOS ROLES CON ESTADÍSTICAS
// ============================================
router.get("/", async (req, res) => {
  try {
    const [roles] = await pool.query(`
      SELECT r.*, 
      COUNT(u.id_usuario) as total_usuarios,
      (SELECT COUNT(*) FROM usuarios WHERE rol_id = r.id_rol AND estado = 'activo') as usuarios_activos
      FROM roles r
      LEFT JOIN usuarios u ON r.id_rol = u.rol_id
      GROUP BY r.id_rol
      ORDER BY r.id_rol
    `);
    
    res.json({
      success: true,
      data: roles,
    });
  } catch (error) {
    console.error("ERROR AL OBTENER ROLES:", error);
    res.status(500).json({ 
      message: "Error al obtener los roles", 
      error: error.message 
    });
  }
});

// ============================================
// OBTENER UN ROL POR ID CON USUARIOS
// ============================================
router.get("/:id", async (req, res) => {
  try {
    // Obtener información del rol
    const [rol] = await pool.query(
      `SELECT * FROM roles WHERE id_rol = ?`, 
      [req.params.id]
    );
    
    if (rol.length === 0) {
      return res.status(404).json({ message: "Rol no encontrado" });
    }

    // Obtener usuarios con este rol
    const [usuarios] = await pool.query(
      `SELECT id_usuario, nombre_completo, dni, estado, fecha_registro 
       FROM usuarios 
       WHERE rol_id = ?
       ORDER BY fecha_registro DESC`,
      [req.params.id]
    );

    res.json({
      success: true,
      rol: rol[0],
      usuarios: usuarios,
      total_usuarios: usuarios.length,
    });
  } catch (error) {
    console.error("ERROR AL OBTENER ROL:", error);
    res.status(500).json({ 
      message: "Error al obtener el rol", 
      error: error.message 
    });
  }
});

// ============================================
// CREAR UN NUEVO ROL
// ============================================
router.post("/", async (req, res) => {
  try {
    const { nombre, descripcion } = req.body;
    
    // Validación
    if (!nombre || nombre.trim() === '') {
      return res.status(400).json({ 
        message: "El nombre del rol es requerido." 
      });
    }

    // Verificar si el rol ya existe
    const [existe] = await pool.query(
      `SELECT * FROM roles WHERE nombre = ? LIMIT 1`,
      [nombre.trim()]
    );

    if (existe.length > 0) {
      return res.status(400).json({ 
        message: "Ya existe un rol con ese nombre." 
      });
    }

    // Insertar el nuevo rol
    const [result] = await pool.query(
      `INSERT INTO roles (nombre, descripcion) VALUES (?, ?)`, 
      [nombre.trim(), descripcion || null]
    );

    res.status(201).json({ 
      success: true,
      message: "Rol creado correctamente", 
      id_rol: result.insertId 
    });
  } catch (error) {
    console.error("ERROR AL CREAR ROL:", error);
    res.status(500).json({ 
      message: "Error al crear el rol", 
      error: error.message 
    });
  }
});

// ============================================
// ACTUALIZAR UN ROL POR ID
// ============================================
router.put("/:id", async (req, res) => {
  try {
    const { nombre, descripcion } = req.body;

    // Validación
    if (!nombre || nombre.trim() === '') {
      return res.status(400).json({ 
        message: "El nombre del rol es requerido." 
      });
    }

    // Verificar que el rol existe
    const [rolExiste] = await pool.query(
      `SELECT * FROM roles WHERE id_rol = ?`,
      [req.params.id]
    );

    if (rolExiste.length === 0) {
      return res.status(404).json({ message: "Rol no encontrado" });
    }

    // No permitir editar roles del sistema (1: Administrador, 2: Socio)
    if (parseInt(req.params.id) <= 2) {
      return res.status(403).json({ 
        message: "No se puede modificar un rol del sistema." 
      });
    }

    // Verificar si ya existe otro rol con ese nombre
    const [nombreExiste] = await pool.query(
      `SELECT * FROM roles WHERE nombre = ? AND id_rol != ? LIMIT 1`,
      [nombre.trim(), req.params.id]
    );

    if (nombreExiste.length > 0) {
      return res.status(400).json({ 
        message: "Ya existe otro rol con ese nombre." 
      });
    }

    // Actualizar el rol
    const [result] = await pool.query(
      `UPDATE roles SET nombre = ?, descripcion = ? WHERE id_rol = ?`,
      [nombre.trim(), descripcion || null, req.params.id]
    );

    res.json({ 
      success: true,
      message: "Rol actualizado correctamente" 
    });
  } catch (error) {
    console.error("ERROR AL ACTUALIZAR ROL:", error);
    res.status(500).json({ 
      message: "Error al actualizar el rol", 
      error: error.message 
    });
  }
});

// ============================================
// ELIMINAR UN ROL POR ID
// ============================================
router.delete("/:id", async (req, res) => {
  try {
    // Verificar que el rol existe
    const [rol] = await pool.query(
      `SELECT * FROM roles WHERE id_rol = ?`,
      [req.params.id]
    );

    if (rol.length === 0) {
      return res.status(404).json({ message: "Rol no encontrado" });
    }

    // No permitir eliminar roles del sistema (1: Administrador, 2: Socio)
    if (parseInt(req.params.id) <= 2) {
      return res.status(403).json({ 
        message: "No se puede eliminar un rol del sistema." 
      });
    }

    // Verificar si hay usuarios con este rol
    const [usuariosConRol] = await pool.query(
      `SELECT COUNT(*) as total FROM usuarios WHERE rol_id = ?`,
      [req.params.id]
    );

    if (usuariosConRol[0].total > 0) {
      return res.status(400).json({ 
        message: `No se puede eliminar el rol. Hay ${usuariosConRol[0].total} usuario(s) asignado(s) a este rol.` 
      });
    }

    // Eliminar el rol
    const [result] = await pool.query(
      `DELETE FROM roles WHERE id_rol = ?`, 
      [req.params.id]
    );

    res.json({ 
      success: true,
      message: "Rol eliminado correctamente" 
    });
  } catch (error) {
    console.error("ERROR AL ELIMINAR ROL:", error);
    res.status(500).json({ 
      message: "Error al eliminar el rol", 
      error: error.message 
    });
  }
});

// ============================================
// OBTENER ROLES DISPONIBLES PARA ASIGNACIÓN
// ============================================
router.get("/disponibles/asignacion", async (req, res) => {
  try {
    const [roles] = await pool.query(`
      SELECT id_rol, nombre 
      FROM roles 
      ORDER BY id_rol
    `);
    
    res.json({
      success: true,
      data: roles,
    });
  } catch (error) {
    console.error("ERROR AL OBTENER ROLES DISPONIBLES:", error);
    res.status(500).json({ 
      message: "Error al obtener roles disponibles", 
      error: error.message 
    });
  }
});

module.exports = router;
