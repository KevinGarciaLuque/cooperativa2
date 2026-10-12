// Configuración del enlace de registro público (se guarda en configuracion_sitio).
const crypto = require("crypto");
const pool = require("../db");

const generarCodigo = () => crypto.randomBytes(5).toString("hex"); // 10 caracteres

const leer = async (clave) => {
  const [rows] = await pool.query("SELECT valor FROM configuracion_sitio WHERE clave = ?", [clave]);
  return rows.length ? rows[0].valor : null;
};

const guardar = async (clave, valor) => {
  await pool.query(
    "INSERT INTO configuracion_sitio (clave, valor) VALUES (?, ?) ON DUPLICATE KEY UPDATE valor = VALUES(valor)",
    [clave, String(valor)]
  );
};

// Devuelve { habilitado, codigo }. Si nunca se configuró, se crea un código.
const leerRegistro = async () => {
  let codigo = await leer("reg_codigo");
  if (!codigo) {
    codigo = generarCodigo();
    await guardar("reg_codigo", codigo);
  }
  const habilitado = (await leer("reg_habilitado")) !== "0";
  return { habilitado, codigo };
};

const guardarRegistro = async ({ habilitado, regenerar }) => {
  if (habilitado !== undefined) await guardar("reg_habilitado", habilitado ? "1" : "0");
  if (regenerar) await guardar("reg_codigo", generarCodigo());
  return leerRegistro();
};

module.exports = { leerRegistro, guardarRegistro };
