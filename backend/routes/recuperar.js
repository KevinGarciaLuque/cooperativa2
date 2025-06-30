// routes/recuperar.js
const express = require("express");
const router = express.Router();
const pool = require("../db");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const sendEmail = require("../utils/sendEmail");

// 1. Enviar enlace de recuperación al correo
router.post("/", async (req, res) => {
  const { correo } = req.body;
  try {
    // Buscar usuario por correo
    const [users] = await pool.query(
      "SELECT * FROM usuarios WHERE correo = ? AND estado = 'activo'",
      [correo]
    );
    if (!users.length)
      return res.status(404).json({ message: "Correo no registrado" });

    const user = users[0];

    // Genera token temporal (1 hora)
    const token = jwt.sign(
      { id_usuario: user.id_usuario },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    // Construye enlace de recuperación
    const enlace = `${
      process.env.FRONTEND_URL || "http://localhost:5173"
    }/recuperar/${token}`;

    // Envía el correo
    await sendEmail({
      to: correo,
      subject: "Recupera tu contraseña - Cooperativa",
      html: `
        <h3>Hola, ${user.nombre_completo}</h3>
        <p>Haz clic en el siguiente enlace para recuperar tu contraseña:</p>
        <p><a href="${enlace}" style="color:#a8cd3a;font-weight:bold;">Recuperar contraseña</a></p>
        <p>Si no solicitaste esto, ignora este mensaje.</p>
        <small>Enlace válido por 1 hora.</small>
      `,
      text: `Recupera tu contraseña aquí: ${enlace}`,
    });

    res.json({ message: "Correo de recuperación enviado correctamente" });
  } catch (error) {
    console.error("Error en recuperación:", error);
    res.status(500).json({ message: "Error enviando correo", error });
  }
});

// 2. Cambiar contraseña usando el token
router.post("/:token", async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  try {
    // Verifica el token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Hashea la nueva contraseña
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Actualiza la contraseña
    const [result] = await pool.query(
      "UPDATE usuarios SET password = ? WHERE id_usuario = ?",
      [passwordHash, decoded.id_usuario]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    res.json({
      message:
        "Contraseña actualizada correctamente. Ya puedes iniciar sesión.",
    });
  } catch (error) {
    console.error("Error al restablecer contraseña:", error);
    if (error.name === "TokenExpiredError") {
      return res
        .status(400)
        .json({ message: "El enlace ha expirado. Solicita uno nuevo." });
    }
    res.status(400).json({ message: "Enlace inválido o expirado." });
  }
});

module.exports = router;
