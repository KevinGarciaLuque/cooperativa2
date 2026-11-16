// Verificación en dos pasos por correo para el personal.
// Si está activada en Parámetros (desactivada por defecto), después de la contraseña el sistema
// envía un código de 6 dígitos al correo del usuario: vence en 10 minutos y admite 5 intentos.
// Mientras tanto el usuario solo tiene un token temporal que no sirve como sesión.
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const pool = require("../db");
const config = require("./configFinanciera");
const sendEmail = require("./sendEmail");
const { esPruebas } = require("./ambiente");

const MINUTOS = 10;
const INTENTOS = 5;

const correoConfigurado = () => !!(process.env.EMAIL_HOST && process.env.EMAIL_USER);

const activada = () => !!parseInt(config.obtener().seg_2fa_personal);

// ¿Este usuario debe confirmar con código? (personal con correo, con el envío de correo disponible)
const requiere = (usuario) => {
  if (!activada() || usuario.rol === "Socio") return false;
  if (!String(usuario.correo || "").includes("@")) return false;
  if (!correoConfigurado()) return false;
  // En el ambiente de pruebas solo si los correos se desvían a una dirección (si no, nadie los recibiría)
  if (esPruebas() && !String(process.env.CORREO_PRUEBAS || "").trim()) return false;
  return true;
};

const huella = (codigo) => crypto.createHmac("sha256", process.env.JWT_SECRET).update(String(codigo)).digest("hex");

const enmascarar = (correo) => {
  const [u, d] = String(correo).split("@");
  return `${u.substring(0, 2)}${"•".repeat(Math.max(1, u.length - 2))}@${d}`;
};

// Crea y envía un código; devuelve { token_temporal, correo }
const enviarCodigo = async (usuario) => {
  const codigo = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
  // Los códigos anteriores sin usar quedan anulados
  await pool.query("UPDATE codigos_verificacion SET usado = 1 WHERE id_usuario = ? AND usado = 0", [usuario.id_usuario]);
  const [r] = await pool.query(
    `INSERT INTO codigos_verificacion (id_usuario, codigo_hash, expira_en) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ${MINUTOS} MINUTE))`,
    [usuario.id_usuario, huella(codigo)]
  );
  await sendEmail({
    to: usuario.correo,
    subject: `Tu código de acceso: ${codigo}`,
    text: `Tu código para entrar al sistema es ${codigo}. Vence en ${MINUTOS} minutos. Si no fuiste tú, cambia tu contraseña y avisa al administrador.`,
    html: `<p>Tu código para entrar al sistema es:</p>
           <p style="font-size:28px;font-weight:bold;letter-spacing:6px">${codigo}</p>
           <p>Vence en ${MINUTOS} minutos. Si no fuiste tú, cambia tu contraseña y avisa al administrador.</p>`,
  });
  const token = jwt.sign({ id_usuario: usuario.id_usuario, verificacion: r.insertId, tipo: "2fa" }, process.env.JWT_SECRET, {
    expiresIn: `${MINUTOS}m`,
  });
  return { token_temporal: token, correo: enmascarar(usuario.correo) };
};

const leerToken = (token) => {
  try {
    const d = jwt.verify(String(token || ""), process.env.JWT_SECRET);
    return d.tipo === "2fa" && d.id_usuario && d.verificacion ? d : null;
  } catch {
    return null;
  }
};

// Comprueba el código. Devuelve el id del usuario o lanza un error con .codigo
const verificar = async (token, codigo) => {
  const d = leerToken(token);
  if (!d) throw Object.assign(new Error("El código venció. Vuelve a iniciar sesión."), { codigo: 401 });
  const [[v]] = await pool.query(
    "SELECT *, expira_en < NOW() AS vencido FROM codigos_verificacion WHERE id_codigo = ? AND id_usuario = ?",
    [d.verificacion, d.id_usuario]
  );
  if (!v || v.usado || v.vencido) throw Object.assign(new Error("El código venció. Vuelve a iniciar sesión."), { codigo: 401 });
  if (v.intentos >= INTENTOS) {
    throw Object.assign(new Error("Demasiados intentos. Vuelve a iniciar sesión para recibir otro código."), { codigo: 429 });
  }
  const ok = crypto.timingSafeEqual(Buffer.from(huella(String(codigo || "").trim())), Buffer.from(v.codigo_hash));
  if (!ok) {
    await pool.query("UPDATE codigos_verificacion SET intentos = intentos + 1 WHERE id_codigo = ?", [v.id_codigo]);
    const quedan = INTENTOS - v.intentos - 1;
    throw Object.assign(
      new Error(quedan > 0 ? `Código incorrecto. Te quedan ${quedan} intento(s).` : "Demasiados intentos. Vuelve a iniciar sesión."),
      { codigo: quedan > 0 ? 400 : 429 }
    );
  }
  const [u] = await pool.query("UPDATE codigos_verificacion SET usado = 1 WHERE id_codigo = ? AND usado = 0", [v.id_codigo]);
  if (!u.affectedRows) throw Object.assign(new Error("El código ya fue usado. Vuelve a iniciar sesión."), { codigo: 401 });
  return d.id_usuario;
};

// Reenviar: solo una vez por minuto
const reenviar = async (token, usuario) => {
  const d = leerToken(token);
  if (!d || d.id_usuario !== usuario.id_usuario) throw Object.assign(new Error("Vuelve a iniciar sesión."), { codigo: 401 });
  const [[ultimo]] = await pool.query(
    "SELECT TIMESTAMPDIFF(SECOND, creado_en, NOW()) AS seg FROM codigos_verificacion WHERE id_usuario = ? ORDER BY id_codigo DESC LIMIT 1",
    [usuario.id_usuario]
  );
  if (ultimo && ultimo.seg < 60) {
    throw Object.assign(new Error(`Espera ${60 - ultimo.seg} segundos para pedir otro código.`), { codigo: 429 });
  }
  return enviarCodigo(usuario);
};

module.exports = { requiere, activada, correoConfigurado, enviarCodigo, verificar, reenviar, leerToken };
