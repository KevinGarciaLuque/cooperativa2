// Avisos por correo al personal y a los socios (mejor esfuerzo: nunca interrumpe la operación).
const pool = require("../db");
const sendEmail = require("./sendEmail");

const correoConfigurado = () => !!(process.env.EMAIL_USER && process.env.EMAIL_HOST);

// Para insertar en el HTML del correo texto que escribió una persona
const escaparHtml = (v) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const notificarAdministradores = async (asunto, html) => {
  try {
    if (!correoConfigurado()) return;
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

// Texto plano a partir del HTML de un correo (para la notificación dentro de la app)
const textoDeHtml = (html) =>
  String(html || "")
    .replace(/<\/p>|<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

// Notificación dentro de la app (campanita del socio). Mejor esfuerzo: nunca falla la operación.
const crearNotificacion = async (idUsuario, { titulo, mensaje, tipo = "aviso", idRecibo = null }) => {
  try {
    if (!idUsuario || !titulo) return;
    await pool.query(
      "INSERT INTO notificaciones (id_usuario, tipo, titulo, mensaje, id_recibo) VALUES (?, ?, ?, ?, ?)",
      [idUsuario, String(tipo).substring(0, 30), String(titulo).substring(0, 150), mensaje ? String(mensaje).substring(0, 600) : null, idRecibo || null]
    );
  } catch (error) {
    console.error("No se pudo guardar la notificación:", error.message);
  }
};

// Correo a un socio (y su notificación en la app). Devuelve { enviado, correo, motivo }
// para que el personal sepa qué pasó con el correo.
const notificarSocio = async (idUsuario, asunto, html, adjuntos, { conEnlace = true, tipo = "aviso", idRecibo = null } = {}) => {
  await crearNotificacion(idUsuario, { titulo: asunto, mensaje: textoDeHtml(html), tipo, idRecibo });
  try {
    if (!correoConfigurado()) return { enviado: false, motivo: "El envío de correos no está configurado." };
    const [[u]] = await pool.query("SELECT correo FROM usuarios WHERE id_usuario = ?", [idUsuario]);
    const correo = String(u?.correo || "").trim();
    if (!correo) return { enviado: false, motivo: "El socio no tiene correo registrado." };
    const frontend = process.env.FRONTEND_URL || "";
    await sendEmail({
      to: correo,
      subject: asunto,
      html: `${html}${frontend && conEnlace ? `<p><a href="${frontend}/login">Entrar a mi cuenta</a></p>` : ""}`,
      text: asunto,
      attachments: adjuntos,
    });
    return { enviado: true, correo };
  } catch (error) {
    console.error("No se pudo enviar el correo al socio:", error.message);
    return { enviado: false, motivo: "No se pudo enviar el correo. Intenta de nuevo más tarde." };
  }
};

module.exports = { notificarAdministradores, notificarSocio, crearNotificacion, correoConfigurado, escaparHtml };
