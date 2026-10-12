// Avisos por correo al personal (mejor esfuerzo: nunca interrumpe la operación).
const pool = require("../db");
const sendEmail = require("./sendEmail");

const notificarAdministradores = async (asunto, html) => {
  try {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_HOST) return;
    const [rows] = await pool.query(
      `SELECT DISTINCT u.correo FROM usuarios u
       INNER JOIN roles r ON u.rol_id = r.id_rol
       WHERE r.nombre = 'Super Administrador' AND u.estado = 'activo'
         AND u.correo IS NOT NULL AND u.correo <> ''`
    );
    if (!rows.length) return;
    const frontend = process.env.FRONTEND_URL || "";
    await sendEmail({
      to: rows.map((r) => r.correo).join(","),
      subject: asunto,
      html: `${html}${frontend ? `<p><a href="${frontend}/solicitudes">Revisar solicitudes</a></p>` : ""}`,
      text: asunto,
    });
  } catch (error) {
    console.error("No se pudo enviar el aviso por correo:", error.message);
  }
};

module.exports = { notificarAdministradores };
