const express = require("express");
const router = express.Router();
const pool = require("../db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// =========== LOGIN (con JOIN de roles) =========== //
router.post("/login", async (req, res) => {
  const { dni, password } = req.body;
  try {
    const [rows] = await pool.query(
      `SELECT u.*, r.nombre AS rol 
       FROM usuarios u 
       INNER JOIN roles r ON u.rol_id = r.id_rol 
       WHERE u.dni = ? 
       LIMIT 1`,
      [dni]
    );

    if (rows.length === 0) {
      return res.status(401).json({ message: "Usuario no encontrado" });
    }

    const user = rows[0];

    if (user.estado === "inactivo") {
      return res.status(403).json({ message: "Usuario inactivo" });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ message: "Contraseña incorrecta" });
    }

    // Generar JWT
    const token = jwt.sign(
      {
        id_usuario: user.id_usuario,
        rol_id: user.rol_id,
        nombre_completo: user.nombre_completo,
        rol: user.rol,
      },
      process.env.JWT_SECRET || "clave_secreta",
      { expiresIn: "8h" }
    );

    res.json({
      token,
      usuario: {
        id_usuario: user.id_usuario,
        nombre_completo: user.nombre_completo,
        dni: user.dni,
        rol_id: user.rol_id,
        rol: user.rol,
        correo: user.correo,
      },
    });
  } catch (error) {
    console.error("ERROR LOGIN:", error);
    res.status(500).json({ message: "Error al autenticar", error });
  }
});

// =========== OBTENER TODOS LOS USUARIOS =========== //
router.get("/", async (req, res) => {
  try {
    const [usuarios] = await pool.query(
      `SELECT u.*, r.nombre AS rol 
       FROM usuarios u 
       INNER JOIN roles r ON u.rol_id = r.id_rol 
       WHERE u.estado != "inactivo"`
    );
    res.json(usuarios);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener los usuarios", error });
  }
});

// =========== OBTENER USUARIO POR ID =========== //
router.get("/:id", async (req, res) => {
  try {
    const [usuario] = await pool.query(
      `SELECT u.*, r.nombre AS rol 
       FROM usuarios u 
       INNER JOIN roles r ON u.rol_id = r.id_rol 
       WHERE u.id_usuario = ?`,
      [req.params.id]
    );
    if (usuario.length === 0)
      return res.status(404).json({ message: "Usuario no encontrado" });
    res.json(usuario[0]);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener el usuario", error });
  }
});

// =========== CREAR NUEVO USUARIO =========== //
router.post("/", async (req, res) => {
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

    if (!nombre_completo || !dni || !password) {
      return res
        .status(400)
        .json({ message: "Nombre, DNI y contraseña son requeridos." });
    }

    // Revisar si el usuario ya existe
    const [existe] = await pool.query(
      `SELECT * FROM usuarios WHERE dni = ? OR correo = ? LIMIT 1`,
      [dni, correo]
    );
    if (existe.length > 0) {
      return res.status(400).json({ message: "DNI o correo ya registrado." });
    }

    // Hashear contraseña
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const [result] = await pool.query(
      `INSERT INTO usuarios 
      (nombre_completo, dni, telefono, correo, direccion, fecha_nacimiento, password, rol_id, estado) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'activo')`,
      [
        nombre_completo,
        dni,
        telefono,
        correo,
        direccion,
        fecha_nacimiento,
        passwordHash,
        rol_id,
      ]
    );

    res.status(201).json({
      message: "Usuario creado correctamente",
      id_usuario: result.insertId,
    });
  } catch (error) {
    res.status(500).json({ message: "Error al crear el usuario", error });
  }
});

// =========== ACTUALIZAR USUARIO =========== //
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

    let setPassword = "";
    let values = [
      nombre_completo,
      telefono,
      correo,
      direccion,
      fecha_nacimiento,
      rol_id,
      estado,
      req.params.id,
    ];

    // Si hay nueva contraseña, hashearla
    if (password) {
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);
      setPassword = ", password = ?";
      values.splice(5, 0, passwordHash); // insertar en la posición correcta
    }

    const sql = `
      UPDATE usuarios SET 
        nombre_completo = IFNULL(?, nombre_completo),
        telefono = IFNULL(?, telefono),
        correo = IFNULL(?, correo),
        direccion = IFNULL(?, direccion),
        fecha_nacimiento = IFNULL(?, fecha_nacimiento)
        ${setPassword}
        , rol_id = IFNULL(?, rol_id),
        estado = IFNULL(?, estado)
      WHERE id_usuario = ?
    `;

    const [result] = await pool.query(sql, values);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    res.json({ message: "Usuario actualizado correctamente" });
  } catch (error) {
    res.status(500).json({ message: "Error al actualizar el usuario", error });
  }
});

// =========== ELIMINAR USUARIO (Borrado lógico) =========== //
router.delete("/:id", async (req, res) => {
  try {
    const [result] = await pool.query(
      `UPDATE usuarios SET estado = 'inactivo' WHERE id_usuario = ?`,
      [req.params.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }
    res.json({ message: "Usuario eliminado correctamente (borrado lógico)" });
  } catch (error) {
    res.status(500).json({ message: "Error al eliminar el usuario", error });
  }
});

module.exports = router;
