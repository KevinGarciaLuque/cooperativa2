// Recordatorios de pago al socio por correo: unos días antes de que venza su cuota y,
// si cae en mora, al primer día de atraso y luego cada cierto tiempo. Usa las mismas
// cifras que la pantalla de Cobranza. Cada envío queda registrado como gestión de cobro.
const cron = require("node-cron");
const pool = require("../db");
const config = require("./configFinanciera");
const { obtenerCartera } = require("./cartera");
const { notificarSocio, correoConfigurado, escaparHtml } = require("./notificaciones");

const fmt = (n) => `L. ${parseFloat(n || 0).toLocaleString("es-HN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fechaLarga = (iso) => {
  const [y, m, d] = String(iso).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString("es-HN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
};

const nombreCooperativa = async () => {
  try {
    const [rows] = await pool.query("SELECT valor FROM configuracion_sitio WHERE clave = 'site_name'");
    return rows.length ? rows[0].valor : "SmartCoop";
  } catch {
    return "SmartCoop";
  }
};

// Mensaje del recordatorio (el mismo texto sirve para el correo y para WhatsApp)
const mensajeRecordatorio = (f, cooperativa) => {
  const nombre = String(f.socio || "").split(" ")[0] || "socio";
  if (f.dias_mora > 0) {
    return {
      tipo: "mora",
      asunto: `Tu préstamo tiene ${f.dias_mora} día(s) de atraso — ${cooperativa}`,
      texto:
        `Hola ${nombre}, te saludamos de ${cooperativa}. Tu préstamo #${f.id_prestamo} tiene ${f.dias_mora} día(s) de atraso. ` +
        `Cuota: ${fmt(f.cuota)}` +
        (f.mora_generada > 0 ? `. Mora generada a la fecha: ${fmt(f.mora_generada)} y sigue aumentando cada día` : "") +
        `. Te invitamos a ponerte al día lo antes posible o a comunicarte con nosotros para acordar tu pago.`,
    };
  }
  return {
    tipo: "previo",
    asunto: `Recordatorio: tu cuota vence el ${fechaLarga(f.vencimiento)} — ${cooperativa}`,
    texto:
      `Hola ${nombre}, te saludamos de ${cooperativa}. Te recordamos que la cuota de tu préstamo #${f.id_prestamo} ` +
      `por ${fmt(f.cuota)} vence el ${fechaLarga(f.vencimiento)}` +
      (f.dias_para_vencer > 0 ? ` (en ${f.dias_para_vencer} día${f.dias_para_vencer === 1 ? "" : "s"})` : "") +
      `. Paga a tiempo y evita cargos por mora. ¡Gracias por tu puntualidad!`,
  };
};

const htmlDe = (texto) => `<p>${escaparHtml(texto)}</p><p style="color:#64748b;font-size:12px">Si ya realizaste tu pago, ignora este mensaje.</p>`;

// Registra el envío en el historial de cobranza del préstamo
const registrarGestion = (idPrestamo, medio, nota, idUsuario = null) =>
  pool.query(
    `INSERT INTO gestiones_cobro (id_prestamo, medio, nota, id_usuario) VALUES (?, ?, ?, ?)`,
    [idPrestamo, medio, nota.substring(0, 500), idUsuario]
  );

// Qué recordatorio le toca hoy a una fila de la cartera (o null). La clave evita repetirlo.
const recordatorioDelDia = (f, c) => {
  if (f.dias_mora > 0) {
    const cada = parseInt(c.rec_mora_cada) || 0;
    const tramo = cada > 0 ? Math.floor((f.dias_mora - 1) / cada) : 0;
    return { tipo: "mora", clave: `mora:${f.id_prestamo}:${f.vencimiento}:${tramo}` };
  }
  const antes = parseInt(c.rec_dias_antes) || 0;
  if (antes > 0 && f.dias_para_vencer > 0 && f.dias_para_vencer <= antes) {
    return { tipo: "previo", clave: `previo:${f.id_prestamo}:${f.vencimiento}` };
  }
  return null;
};

// Envío automático diario. Devuelve un resumen.
const ejecutarRecordatorios = async () => {
  const resumen = { enviados: 0, previos: 0, mora: 0, sin_correo: 0, ya_enviados: 0, errores: 0 };
  if (!correoConfigurado()) return { ...resumen, motivo: "El envío de correos no está configurado." };
  const c = config.obtener();
  const cooperativa = await nombreCooperativa();

  for (const f of await obtenerCartera()) {
    const toca = recordatorioDelDia(f, c);
    if (!toca) continue;
    if (!f.correo) {
      resumen.sin_correo++;
      continue;
    }
    // Se reserva la clave antes de enviar: si ya existe, otro proceso lo envió
    const [r] = await pool.query(
      "INSERT IGNORE INTO recordatorios_pago (clave, id_prestamo, tipo, medio) VALUES (?, ?, ?, 'correo')",
      [toca.clave, f.id_prestamo, toca.tipo]
    );
    if (!r.affectedRows) {
      resumen.ya_enviados++;
      continue;
    }
    const m = mensajeRecordatorio(f, cooperativa);
    const envio = await notificarSocio(f.id_usuario, m.asunto, htmlDe(m.texto));
    if (!envio.enviado) {
      await pool.query("DELETE FROM recordatorios_pago WHERE clave = ?", [toca.clave]);
      resumen.errores++;
      continue;
    }
    await registrarGestion(
      f.id_prestamo,
      "correo",
      m.tipo === "mora"
        ? `Recordatorio automático por correo: ${f.dias_mora} día(s) de atraso.`
        : `Recordatorio automático por correo: la cuota vence el ${f.vencimiento}.`
    );
    resumen.enviados++;
    resumen[m.tipo === "mora" ? "mora" : "previos"]++;
  }
  return resumen;
};

const iniciarRecordatoriosScheduler = () => {
  const tarea = async () => {
    if (!parseInt(config.obtener().rec_activo)) return;
    try {
      const r = await ejecutarRecordatorios();
      console.log(`📨 Recordatorios de pago: ${r.enviados} enviados (${r.previos} previos, ${r.mora} de mora)`);
    } catch (error) {
      console.error("Error al enviar los recordatorios de pago:", error.message);
    }
  };
  // Todos los días a las 8:00 de la mañana, hora de Honduras
  try {
    cron.schedule("0 8 * * *", tarea, { timezone: "America/Tegucigalpa" });
  } catch {
    cron.schedule("0 14 * * *", tarea); // 8:00 en Honduras (UTC-6)
  }
};

module.exports = { recordatorioDelDia, mensajeRecordatorio, ejecutarRecordatorios, iniciarRecordatoriosScheduler, registrarGestion, htmlDe, nombreCooperativa };
