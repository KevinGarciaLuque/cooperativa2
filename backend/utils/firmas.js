// Firma digital del personal: se dibuja una vez en "Mi perfil" y se coloca en los
// documentos que esa persona emite o aprueba (carta de aprobación, recibos, finiquitos).
const pool = require("../db");

const leerFirma = async (idUsuario) => {
  if (!idUsuario) return null;
  try {
    const [rows] = await pool.query("SELECT mime, contenido FROM firmas_usuario WHERE id_usuario = ?", [idUsuario]);
    return rows[0] || null;
  } catch {
    return null;
  }
};

// Para enviarla dentro de un JSON (los recibos se arman en el navegador)
const firmaDataUrl = async (idUsuario) => {
  const f = await leerFirma(idUsuario);
  return f ? `data:${f.mime};base64,${Buffer.from(f.contenido).toString("base64")}` : null;
};

module.exports = { leerFirma, firmaDataUrl };
