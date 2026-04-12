const express = require("express");
const router = express.Router();
const pool = require("../db");
const { verificarToken } = require("../middleware/auth");

// Módulos disponibles en el sistema
const MODULOS_SISTEMA = [
  { key: "dashboard",     label: "Dashboard" },
  { key: "usuarios",      label: "Usuarios" },
  { key: "roles",         label: "Roles" },
  { key: "cuentas",       label: "Cuentas" },
  { key: "prestamos",     label: "Préstamos" },
  { key: "aportaciones",  label: "Aportaciones" },
  { key: "pagos",         label: "Pagos" },
  { key: "movimientos",   label: "Movimientos" },
  { key: "reportes",      label: "Reportes" },
  { key: "actividades",   label: "Actividades" },
  { key: "liquidaciones", label: "Liquidaciones" },
  { key: "bitacora",      label: "Bitácora" },
  { key: "basedatos",     label: "Base de Datos" },
];

// Middleware: solo Super Administrador
const soloSuperAdmin = (req, res, next) => {
  if (!req.usuario || req.usuario.rol !== "Super Administrador") {
    return res.status(403).json({ message: "Acceso denegado. Solo el Super Administrador puede realizar esta acción." });
  }
  next();
};

// ============================================================
// GET /api/permisos/modulos
// Lista todos los módulos del sistema
// ============================================================
router.get("/modulos", verificarToken, soloSuperAdmin, (req, res) => {
  res.json({ success: true, data: MODULOS_SISTEMA });
});

// ============================================================
// GET /api/permisos/todos/roles
// Obtiene todos los roles NO Super Admin con sus permisos
// IMPORTANTE: debe ir ANTES de /:rol_id para no ser capturada por el param
// ============================================================
router.get("/todos/roles", verificarToken, soloSuperAdmin, async (req, res) => {
  try {
    const [roles] = await pool.query(
      "SELECT id_rol, nombre, descripcion FROM roles WHERE nombre != 'Super Administrador' ORDER BY id_rol"
    );

    const resultado = [];
    for (const rol of roles) {
      const [rows] = await pool.query(
        "SELECT modulo, activo FROM permisos_modulos WHERE rol_id = ?",
        [rol.id_rol]
      );

      const permisos = {};
      if (rows.length === 0) {
        MODULOS_SISTEMA.forEach(m => { permisos[m.key] = true; });
      } else {
        rows.forEach(r => { permisos[r.modulo] = r.activo === 1; });
      }

      resultado.push({ ...rol, permisos });
    }

    res.json({ success: true, data: resultado, modulos: MODULOS_SISTEMA });
  } catch (error) {
    console.error("Error al obtener permisos de roles:", error);
    res.status(500).json({ message: "Error al obtener permisos", error: error.message });
  }
});

// ============================================================
// GET /api/permisos/:rol_id
// Obtiene los permisos de un rol específico
// ============================================================
router.get("/:rol_id", verificarToken, async (req, res) => {
  const { rol_id } = req.params;

  // Solo Super Admin o el propio rol puede consultar
  if (
    req.usuario.rol !== "Super Administrador" &&
    String(req.usuario.rol_id) !== String(rol_id)
  ) {
    return res.status(403).json({ message: "Acceso denegado." });
  }

  try {
    const [rows] = await pool.query(
      "SELECT modulo, activo FROM permisos_modulos WHERE rol_id = ?",
      [rol_id]
    );

    // Si el rol no tiene registros, devuelve todos activos por defecto
    const permisos = {};
    if (rows.length === 0) {
      MODULOS_SISTEMA.forEach(m => { permisos[m.key] = true; });
    } else {
      rows.forEach(r => { permisos[r.modulo] = r.activo === 1; });
    }

    res.json({ success: true, data: permisos });
  } catch (error) {
    console.error("Error al obtener permisos:", error);
    res.status(500).json({ message: "Error al obtener permisos", error: error.message });
  }
});

// ============================================================
// PUT /api/permisos/:rol_id
// Actualiza los permisos de un rol (solo Super Admin)
// ============================================================
router.put("/:rol_id", verificarToken, soloSuperAdmin, async (req, res) => {
  const { rol_id } = req.params;
  const { permisos } = req.body; // { dashboard: true, usuarios: false, ... }

  if (!permisos || typeof permisos !== "object") {
    return res.status(400).json({ message: "El campo 'permisos' es requerido." });
  }

  try {
    // Verificar que el rol existe y no es Super Admin
    const [rol] = await pool.query("SELECT nombre FROM roles WHERE id_rol = ?", [rol_id]);
    if (rol.length === 0) {
      return res.status(404).json({ message: "Rol no encontrado." });
    }
    if (rol[0].nombre === "Super Administrador") {
      return res.status(400).json({ message: "No se pueden modificar los permisos del Super Administrador." });
    }

    // Actualizar cada módulo
    const entries = Object.entries(permisos);
    for (const [modulo, activo] of entries) {
      // Validar que el módulo es válido
      if (!MODULOS_SISTEMA.find(m => m.key === modulo)) continue;

      await pool.query(
        `INSERT INTO permisos_modulos (rol_id, modulo, activo)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE activo = VALUES(activo)`,
        [rol_id, modulo, activo ? 1 : 0]
      );
    }

    // Registrar en bitácora
    try {
      await pool.query(
        "INSERT INTO bitacora (id_usuario, accion, detalle) VALUES (?, ?, ?)",
        [
          req.usuario.id_usuario,
          "Modificar permisos de módulos",
          `Super Admin actualizó permisos del rol ID ${rol_id} (${rol[0].nombre})`,
        ]
      );
    } catch (_) {}

    res.json({ success: true, message: "Permisos actualizados correctamente." });
  } catch (error) {
    console.error("Error al actualizar permisos:", error);
    res.status(500).json({ message: "Error al actualizar permisos", error: error.message });
  }
});

module.exports = router;
