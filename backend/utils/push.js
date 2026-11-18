// Notificaciones en el teléfono del socio (Web Push), con la función "app_socio" encendida.
// Las claves VAPID vienen de VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY o, si no están, se generan
// una vez y se guardan en configuracion_sitio. Todo es de mejor esfuerzo: nunca detiene una operación.
const webpush = require("web-push");
const pool = require("../db");
const { leer } = require("./funciones");

let claves = null;

const obtenerClaves = async () => {
  if (claves) return claves;
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    claves = { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY };
  } else {
    const [[g]] = await pool.query("SELECT valor FROM configuracion_sitio WHERE clave = 'vapid_claves'");
    if (g?.valor) {
      claves = JSON.parse(g.valor);
    } else {
      claves = webpush.generateVAPIDKeys();
      await pool.query(
        "INSERT INTO configuracion_sitio (clave, valor) VALUES ('vapid_claves', ?) ON DUPLICATE KEY UPDATE valor = valor",
        [JSON.stringify(claves)]
      );
      // Si otro proceso las creó al mismo tiempo, se usan las guardadas
      const [[otra]] = await pool.query("SELECT valor FROM configuracion_sitio WHERE clave = 'vapid_claves'");
      claves = JSON.parse(otra.valor);
    }
  }
  const contacto = process.env.VAPID_SUBJECT || `mailto:${process.env.EMAIL_USER || "avisos@cooperativa.local"}`;
  webpush.setVapidDetails(contacto, claves.publicKey, claves.privateKey);
  return claves;
};

const clavePublica = async () => (await obtenerClaves()).publicKey;

const activa = async () => !!(await leer()).app_socio;

const suscribir = async (idUsuario, s) => {
  const endpoint = String(s?.endpoint || "");
  const p256dh = String(s?.keys?.p256dh || "");
  const auth = String(s?.keys?.auth || "");
  if (!/^https:\/\//.test(endpoint) || endpoint.length > 600 || !p256dh || !auth || p256dh.length > 200 || auth.length > 100) {
    return false;
  }
  await pool.query(
    `INSERT INTO push_suscripciones (id_usuario, endpoint, p256dh, auth) VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE id_usuario = VALUES(id_usuario), p256dh = VALUES(p256dh), auth = VALUES(auth)`,
    [idUsuario, endpoint, p256dh, auth]
  );
  return true;
};

const cancelar = (idUsuario, endpoint) =>
  pool.query("DELETE FROM push_suscripciones WHERE id_usuario = ? AND endpoint = ?", [idUsuario, String(endpoint || "")]);

// Envía a todos los teléfonos del usuario. Las suscripciones vencidas (404/410) se borran.
const enviarPush = async (idUsuario, { titulo, cuerpo, url = "/perfil", etiqueta } = {}) => {
  try {
    if (!idUsuario || !titulo || !(await activa())) return 0;
    const [subs] = await pool.query("SELECT id_suscripcion, endpoint, p256dh, auth FROM push_suscripciones WHERE id_usuario = ?", [idUsuario]);
    if (!subs.length) return 0;
    await obtenerClaves();
    const datos = JSON.stringify({
      titulo: String(titulo).substring(0, 120),
      cuerpo: cuerpo ? String(cuerpo).substring(0, 240) : "",
      url,
      etiqueta: etiqueta || undefined,
    });
    let enviadas = 0;
    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, datos, { TTL: 24 * 3600 });
          enviadas += 1;
        } catch (error) {
          if ([404, 410].includes(error.statusCode)) {
            await pool.query("DELETE FROM push_suscripciones WHERE id_suscripcion = ?", [s.id_suscripcion]).catch(() => {});
          } else {
            console.error("No se pudo enviar la notificación al teléfono:", error.statusCode || error.message);
          }
        }
      })
    );
    return enviadas;
  } catch (error) {
    console.error("Error en notificaciones al teléfono:", error.message);
    return 0;
  }
};

module.exports = { clavePublica, activa, suscribir, cancelar, enviarPush };
