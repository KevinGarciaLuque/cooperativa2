// utils/sendEmail.js
const nodemailer = require("nodemailer");
const { esPruebas } = require("./ambiente");

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

async function sendEmail({ to, subject, html, text, attachments }) {
  // Ambiente de pruebas: ningún correo llega a los socios. Si hay CORREO_PRUEBAS, todo se
  // desvía a esa dirección (con el destinatario original en el asunto); si no, no se envía.
  if (esPruebas()) {
    const desvio = String(process.env.CORREO_PRUEBAS || "").trim();
    if (!desvio) {
      console.log(`✉️  [pruebas] Correo NO enviado a ${to}: ${subject}`);
      return { omitido: true };
    }
    subject = `[PRUEBAS → ${to}] ${subject}`;
    to = desvio;
  }
  const mailOptions = {
    from: `"SmartCoop" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html,
    text,
    attachments,
  };
  return sendEmail.transporter.sendMail(mailOptions);
}

sendEmail.transporter = transporter; // las pruebas lo reemplazan para no enviar nada de verdad
module.exports = sendEmail;
