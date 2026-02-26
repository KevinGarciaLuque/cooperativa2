const express = require("express");
const router = express.Router();
const pool = require("../db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// ============================================
// FUNCIONES AUXILIARES DE VALIDACIÓN
// ============================================

// Validar DNI hondureño (13 dígitos)
const validarDNI = (dni) => {
  const dniRegex = /^\d{13}$/;
  return dniRegex.test(dni);
};

// Validar teléfono hondureño (8 dígitos)
const validarTelefono = (telefono) => {
  const telefonoRegex = /^\d{8}$/;
  return telefonoRegex.test(telefono);
};

// Validar email
const validarEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Validar edad mínima (18 años)
const validarEdadMinima = (fechaNacimiento) => {
  const hoy = new Date();
  const fechaNac = new Date(fechaNacimiento);
  const edad = hoy.getFullYear() - fechaNac.getFullYear();
  const mes = hoy.getMonth() - fechaNac.getMonth();
  
  if (mes < 0 || (mes === 0 && hoy.getDate() < fechaNac.getDate())) {
    return edad - 1 >= 18;
  }
  return edad >= 18;
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

// Crear cuentas automáticas para nuevo socio
const crearCuentasAutomaticas = async (id_usuario) => {
  const tiposCuenta = ['Aportaciones', 'Vivienda', 'Pensiones'];
  
  try {
    for (const tipo of tiposCuenta) {
      await pool.query(
        `INSERT INTO cuentas (id_usuario, tipo_cuenta, saldo_actual, estado) 
         VALUES (?, ?, 0.00, 'activa')`,
        [id_usuario, tipo]
      );
    }
    return true;
  } catch (error) {
    console.error("Error al crear cuentas automáticas:", error);
    return false;
  }
};

// ============================================
// AUTENTICACIÓN Y SEGURIDAD
// ============================================

// LOGIN (con JOIN de roles y registro en bitácora)
router.post("/login", async (req, res) => {
  const { dni, password } = req.body;
  
  try {
    // Validaciones básicas
    if (!dni || !password) {
      return res.status(400).json({ message: "DNI y contraseña son requeridos" });
    }

    const [rows] = await pool.query(
      `SELECT u.*, r.nombre AS rol 
       FROM usuarios u 
       INNER JOIN roles r ON u.rol_id = r.id_rol 
       WHERE u.dni = ? 
       LIMIT 1`,
      [dni]
    );

    if (rows.length === 0) {
      return res.status(401).json({ message: "Credenciales incorrectas" });
    }

    const user = rows[0];

    // Verificar estado del usuario
    if (user.estado === "inactivo") {
      return res.status(403).json({ message: "Usuario inactivo. Contacte al administrador." });
    }

    if (user.estado === "suspendido") {
      return res.status(403).json({ message: "Usuario suspendido. Contacte al administrador." });
    }

    // Verificar contraseña
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ message: "Credenciales incorrectas" });
    }

    // Registrar en bitácora
    await registrarBitacora(user.id_usuario, "Inicio de sesión", `Usuario ${user.nombre_completo} inició sesión`);

    // Generar JWT
    const token = jwt.sign(
      {
        id_usuario: user.id_usuario,
        rol_id: user.rol_id,
        nombre_completo: user.nombre_completo,
        rol: user.rol,
        dni: user.dni,
      },
      process.env.JWT_SECRET || "clave_secreta",
      { expiresIn: "8h" }
    );

    res.json({
      success: true,
      token,
      usuario: {
        id_usuario: user.id_usuario,
        nombre_completo: user.nombre_completo,
        dni: user.dni,
        telefono: user.telefono,
        correo: user.correo,
        rol_id: user.rol_id,
        rol: user.rol,
        foto: user.foto,
        fecha_registro: user.fecha_registro,
      },
    });
  } catch (error) {
    console.error("ERROR LOGIN:", error);
    res.status(500).json({ message: "Error al autenticar", error: error.message });
  }
});

// ============================================
// OBTENER TODOS LOS USUARIOS CON PAGINACIÓN Y BÚSQUEDA
// ============================================
router.get("/", async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', estado = '' } = req.query;
    const offset = (page - 1) * limit;

    // Construir condiciones de búsqueda
    let whereClause = "WHERE 1=1";
    let params = [];

    if (search) {
      whereClause += ` AND (u.nombre_completo LIKE ? OR u.dni LIKE ? OR u.correo LIKE ?)`;
      const searchParam = `%${search}%`;
      params.push(searchParam, searchParam, searchParam);
    }

    if (estado) {
      whereClause += ` AND u.estado = ?`;
      params.push(estado);
    }

    // Obtener total de registros
    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total FROM usuarios u ${whereClause}`,
      params
    );
    const total = countResult[0].total;

    // Obtener usuarios con paginación
    const [usuarios] = await pool.query(
      `SELECT u.*, r.nombre AS rol,
       (SELECT COUNT(*) FROM prestamos WHERE id_usuario = u.id_usuario AND estado = 'activo') as prestamos_activos,
       (SELECT IFNULL(SUM(saldo_actual), 0) FROM cuentas WHERE id_usuario = u.id_usuario) as saldo_total
       FROM usuarios u 
       INNER JOIN roles r ON u.rol_id = r.id_rol 
       ${whereClause}
       ORDER BY u.fecha_registro DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), parseInt(offset)]
    );

    res.json({
      success: true,
      data: usuarios,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("ERROR AL OBTENER USUARIOS:", error);
    res.status(500).json({ message: "Error al obtener los usuarios", error: error.message });
  }
});

// ============================================
// OBTENER USUARIO POR ID (CON ESTADÍSTICAS)
// ============================================
router.get("/:id", async (req, res) => {
  try {
    const [usuario] = await pool.query(
      `SELECT u.*, r.nombre AS rol 
       FROM usuarios u 
       INNER JOIN roles r ON u.rol_id = r.id_rol 
       WHERE u.id_usuario = ?`,
      [req.params.id]
    );
    
    if (usuario.length === 0) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    // Obtener estadísticas del socio
    const [cuentas] = await pool.query(
      `SELECT tipo_cuenta, saldo_actual, estado FROM cuentas WHERE id_usuario = ?`,
      [req.params.id]
    );

    const [prestamos] = await pool.query(
      `SELECT COUNT(*) as total, 
       IFNULL(SUM(CASE WHEN estado = 'activo' THEN 1 ELSE 0 END), 0) as activos,
       IFNULL(SUM(CASE WHEN estado = 'mora' THEN 1 ELSE 0 END), 0) as en_mora,
       IFNULL(SUM(saldo_restante), 0) as saldo_total_prestamos
       FROM prestamos WHERE id_usuario = ?`,
      [req.params.id]
    );

    const [aportaciones] = await pool.query(
      `SELECT COUNT(*) as total_aportaciones, 
       IFNULL(SUM(monto), 0) as total_aportado
       FROM aportaciones WHERE id_usuario = ?`,
      [req.params.id]
    );

    res.json({
      success: true,
      usuario: usuario[0],
      cuentas: cuentas,
      estadisticas: {
        prestamos: prestamos[0],
        aportaciones: aportaciones[0],
      },
    });
  } catch (error) {
    console.error("ERROR AL OBTENER USUARIO:", error);
    res.status(500).json({ message: "Error al obtener el usuario", error: error.message });
  }
});

// ============================================
// CREAR NUEVO USUARIO/SOCIO (CON VALIDACIONES Y CUENTAS AUTOMÁTICAS)
// ============================================
router.post("/", async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const {
      nombre_completo,
      dni,
      telefono,
      correo,
      direccion,
      fecha_nacimiento,
      password,
      rol_id,
    } = req.body;

    // Validaciones obligatorias
    if (!nombre_completo || !dni || !password) {
      return res.status(400).json({ 
        message: "Nombre completo, DNI y contraseña son obligatorios." 
      });
    }

    // Validar DNI hondureño (13 dígitos)
    if (!validarDNI(dni)) {
      return res.status(400).json({ 
        message: "DNI inválido. Debe contener 13 dígitos." 
      });
    }

    // Validar teléfono hondureño (8 dígitos)
    if (telefono && !validarTelefono(telefono)) {
      return res.status(400).json({ 
        message: "Teléfono inválido. Debe contener 8 dígitos." 
      });
    }

    // Validar email
    if (correo && !validarEmail(correo)) {
      return res.status(400).json({ 
        message: "Correo electrónico inválido." 
      });
    }

    // Validar edad mínima (18 años)
    if (fecha_nacimiento && !validarEdadMinima(fecha_nacimiento)) {
      return res.status(400).json({ 
        message: "El socio debe ser mayor de 18 años." 
      });
    }

    // Verificar si el usuario ya existe
    const [existe] = await connection.query(
      `SELECT * FROM usuarios WHERE dni = ? OR (correo = ? AND correo IS NOT NULL) LIMIT 1`,
      [dni, correo]
    );
    
    if (existe.length > 0) {
      return res.status(400).json({ 
        message: "Ya existe un usuario con ese DNI o correo electrónico." 
      });
    }

    // Iniciar transacción
    await connection.beginTransaction();

    // Hashear contraseña
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Insertar usuario
    const [result] = await connection.query(
      `INSERT INTO usuarios 
      (nombre_completo, dni, telefono, correo, direccion, fecha_nacimiento, password, rol_id, estado, fecha_registro) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'activo', NOW())`,
      [
        nombre_completo,
        dni,
        telefono || null,
        correo || null,
        direccion || null,
        fecha_nacimiento || null,
        passwordHash,
        rol_id || 2, // Por defecto rol "Socio"
      ]
    );

    const nuevoUsuarioId = result.insertId;

    // Crear cuentas automáticas (Aportaciones, Vivienda, Pensiones)
    const tiposCuenta = ['Aportaciones', 'Vivienda', 'Pensiones'];
    for (const tipo of tiposCuenta) {
      await connection.query(
        `INSERT INTO cuentas (id_usuario, tipo_cuenta, saldo_actual, estado, fecha_apertura) 
         VALUES (?, ?, 0.00, 'activa', NOW())`,
        [nuevoUsuarioId, tipo]
      );
    }

    // Registrar en bitácora
    await connection.query(
      `INSERT INTO bitacora (id_usuario, accion, detalle, fecha) 
       VALUES (?, ?, ?, NOW())`,
      [nuevoUsuarioId, "Registro de nuevo socio", `Se registró el socio: ${nombre_completo} con DNI: ${dni}`]
    );

    // Confirmar transacción
    await connection.commit();

    res.status(201).json({
      success: true,
      message: "Socio registrado correctamente con sus cuentas automáticas",
      id_usuario: nuevoUsuarioId,
    });

  } catch (error) {
    // Revertir transacción en caso de error
    await connection.rollback();
    console.error("ERROR AL CREAR USUARIO:", error);
    res.status(500).json({ 
      message: "Error al crear el usuario", 
      error: error.message 
    });
  } finally {
    connection.release();
  }
});

// ============================================
// ACTUALIZAR USUARIO (CON VALIDACIONES Y BITÁCORA)
// ============================================
router.put("/:id", async (req, res) => {
  try {
    const {
      nombre_completo,
      telefono,
      correo,
      direccion,
      fecha_nacimiento,
      password,
      rol_id,
      estado,
    } = req.body;

    // Verificar que el usuario existe
    const [usuarioExiste] = await pool.query(
      `SELECT * FROM usuarios WHERE id_usuario = ?`,
      [req.params.id]
    );

    if (usuarioExiste.length === 0) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    // Validar teléfono si se proporciona
    if (telefono && !validarTelefono(telefono)) {
      return res.status(400).json({ 
        message: "Teléfono inválido. Debe contener 8 dígitos." 
      });
    }

    // Validar email si se proporciona
    if (correo && !validarEmail(correo)) {
      return res.status(400).json({ 
        message: "Correo electrónico inválido." 
      });
    }

    // Validar edad mínima si se proporciona fecha de nacimiento
    if (fecha_nacimiento && !validarEdadMinima(fecha_nacimiento)) {
      return res.status(400).json({ 
        message: "El socio debe ser mayor de 18 años." 
      });
    }

    let updateFields = [];
    let values = [];

    if (nombre_completo) {
      updateFields.push("nombre_completo = ?");
      values.push(nombre_completo);
    }
    if (telefono) {
      updateFields.push("telefono = ?");
      values.push(telefono);
    }
    if (correo) {
      updateFields.push("correo = ?");
      values.push(correo);
    }
    if (direccion) {
      updateFields.push("direccion = ?");
      values.push(direccion);
    }
    if (fecha_nacimiento) {
      updateFields.push("fecha_nacimiento = ?");
      values.push(fecha_nacimiento);
    }
    if (rol_id) {
      updateFields.push("rol_id = ?");
      values.push(rol_id);
    }
    if (estado) {
      updateFields.push("estado = ?");
      values.push(estado);
    }

    // Si hay nueva contraseña, hashearla
    if (password) {
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);
      updateFields.push("password = ?");
      values.push(passwordHash);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ message: "No hay campos para actualizar" });
    }

    values.push(req.params.id);

    const sql = `UPDATE usuarios SET ${updateFields.join(", ")} WHERE id_usuario = ?`;
    const [result] = await pool.query(sql, values);

    // Registrar en bitácora
    await registrarBitacora(
      req.params.id,
      "Actualización de datos",
      `Se actualizaron los datos del usuario ${usuarioExiste[0].nombre_completo}`
    );

    res.json({ 
      success: true,
      message: "Usuario actualizado correctamente" 
    });
  } catch (error) {
    console.error("ERROR AL ACTUALIZAR USUARIO:", error);
    res.status(500).json({ 
      message: "Error al actualizar el usuario", 
      error: error.message 
    });
  }
});

// ============================================
// ELIMINAR USUARIO (BORRADO LÓGICO CON BITÁCORA)
// ============================================
router.delete("/:id", async (req, res) => {
  try {
    // Verificar que el usuario existe
    const [usuario] = await pool.query(
      `SELECT * FROM usuarios WHERE id_usuario = ?`,
      [req.params.id]
    );

    if (usuario.length === 0) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    // No permitir eliminar si tiene préstamos activos
    const [prestamosActivos] = await pool.query(
      `SELECT COUNT(*) as total FROM prestamos 
       WHERE id_usuario = ? AND estado IN ('activo', 'mora')`,
      [req.params.id]
    );

    if (prestamosActivos[0].total > 0) {
      return res.status(400).json({ 
        message: "No se puede eliminar el usuario. Tiene préstamos activos o en mora." 
      });
    }

    const [result] = await pool.query(
      `UPDATE usuarios SET estado = 'inactivo' WHERE id_usuario = ?`,
      [req.params.id]
    );

    // Cerrar todas las cuentas del usuario
    await pool.query(
      `UPDATE cuentas SET estado = 'cerrada' WHERE id_usuario = ?`,
      [req.params.id]
    );

    // Registrar en bitácora
    await registrarBitacora(
      req.params.id,
      "Usuario eliminado",
      `Se desactivó el usuario: ${usuario[0].nombre_completo}`
    );

    res.json({ 
      success: true,
      message: "Usuario desactivado correctamente (borrado lógico)" 
    });
  } catch (error) {
    console.error("ERROR AL ELIMINAR USUARIO:", error);
    res.status(500).json({ 
      message: "Error al eliminar el usuario", 
      error: error.message 
    });
  }
});

// ============================================
// CAMBIAR CONTRASEÑA
// ============================================
router.post("/:id/cambiar-password", async (req, res) => {
  try {
    const { password_actual, password_nuevo } = req.body;

    if (!password_actual || !password_nuevo) {
      return res.status(400).json({ 
        message: "La contraseña actual y la nueva son requeridas" 
      });
    }

    // Obtener usuario
    const [usuario] = await pool.query(
      `SELECT * FROM usuarios WHERE id_usuario = ?`,
      [req.params.id]
    );

    if (usuario.length === 0) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    // Verificar contraseña actual
    const isValid = await bcrypt.compare(password_actual, usuario[0].password);
    if (!isValid) {
      return res.status(401).json({ message: "Contraseña actual incorrecta" });
    }

    // Hashear nueva contraseña
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password_nuevo, salt);

    // Actualizar contraseña
    await pool.query(
      `UPDATE usuarios SET password = ? WHERE id_usuario = ?`,
      [passwordHash, req.params.id]
    );

    // Registrar en bitácora
    await registrarBitacora(
      req.params.id,
      "Cambio de contraseña",
      `El usuario ${usuario[0].nombre_completo} cambió su contraseña`
    );

    res.json({ 
      success: true,
      message: "Contraseña actualizada correctamente" 
    });
  } catch (error) {
    console.error("ERROR AL CAMBIAR CONTRASEÑA:", error);
    res.status(500).json({ 
      message: "Error al cambiar la contraseña", 
      error: error.message 
    });
  }
});

// ============================================
// CAMBIAR ESTADO DEL USUARIO (activar/suspender/desactivar)
// ============================================
router.patch("/:id/estado", async (req, res) => {
  try {
    const { estado } = req.body;

    if (!estado || !['activo', 'inactivo', 'suspendido'].includes(estado)) {
      return res.status(400).json({ 
        message: "Estado inválido. Debe ser: activo, inactivo o suspendido" 
      });
    }

    // Verificar que el usuario existe
    const [usuario] = await pool.query(
      `SELECT * FROM usuarios WHERE id_usuario = ?`,
      [req.params.id]
    );

    if (usuario.length === 0) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    // Actualizar estado
    await pool.query(
      `UPDATE usuarios SET estado = ? WHERE id_usuario = ?`,
      [estado, req.params.id]
    );

    // Actualizar estado de cuentas
    const estadoCuenta = estado === 'activo' ? 'activa' : 'cerrada';
    await pool.query(
      `UPDATE cuentas SET estado = ? WHERE id_usuario = ?`,
      [estadoCuenta, req.params.id]
    );

    // Registrar en bitácora
    await registrarBitacora(
      req.params.id,
      "Cambio de estado",
      `El usuario ${usuario[0].nombre_completo} cambió a estado: ${estado}`
    );

    res.json({ 
      success: true,
      message: `Usuario ${estado === 'activo' ? 'activado' : estado === 'suspendido' ? 'suspendido' : 'desactivado'} correctamente` 
    });
  } catch (error) {
    console.error("ERROR AL CAMBIAR ESTADO:", error);
    res.status(500).json({ 
      message: "Error al cambiar el estado del usuario", 
      error: error.message 
    });
  }
});

// ============================================
// ESTADÍSTICAS GENERALES DE SOCIOS
// ============================================
router.get("/estadisticas/general", async (req, res) => {
  try {
    // Total de socios por estado
    const [porEstado] = await pool.query(
      `SELECT estado, COUNT(*) as total 
       FROM usuarios 
       GROUP BY estado`
    );

    // Total de socios
    const [totalSocios] = await pool.query(
      `SELECT COUNT(*) as total FROM usuarios WHERE estado = 'activo'`
    );

    // Total de saldos en todas las cuentas
    const [saldoTotal] = await pool.query(
      `SELECT IFNULL(SUM(saldo_actual), 0) as saldo_total FROM cuentas`
    );

    // Nuevos socios este mes
    const [nuevosSocios] = await pool.query(
      `SELECT COUNT(*) as total FROM usuarios 
       WHERE MONTH(fecha_registro) = MONTH(CURRENT_DATE()) 
       AND YEAR(fecha_registro) = YEAR(CURRENT_DATE())`
    );

    // Socios con préstamos activos
    const [sociosConPrestamos] = await pool.query(
      `SELECT COUNT(DISTINCT id_usuario) as total 
       FROM prestamos 
       WHERE estado IN ('activo', 'mora')`
    );

    res.json({
      success: true,
      estadisticas: {
        total_socios: totalSocios[0].total,
        por_estado: porEstado,
        saldo_total_cooperativa: parseFloat(saldoTotal[0].saldo_total),
        nuevos_este_mes: nuevosSocios[0].total,
        socios_con_prestamos: sociosConPrestamos[0].total,
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
