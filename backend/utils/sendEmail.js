// utils/sendEmail.js
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

async function sendEmail({ to, subject, html, text }) {
  const mailOptions = {
    from: `"Cooperativa" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html,
    text,
  };
  return transporter.sendMail(mailOptions);
}

module.exports = sendEmail;
