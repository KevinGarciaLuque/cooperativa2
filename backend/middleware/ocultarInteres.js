const jwt = require("jsonwebtoken");

// Campos que un socio no debe ver: intereses, tasas y el desglose de capital.
// El interés moratorio sí se muestra: el socio debe saber cuánto genera su atraso.
const CAMPO_OCULTO_RE = /interes|tasa|capital/i;
const CAMPO_OCULTO = { test: (k) => CAMPO_OCULTO_RE.test(k) && !/morator|mora_/i.test(k) };

// Cuota mínima calculada igual que el backend (tasa_interes anual / 12), para que
// el socio siga viendo su cuota sin ver la tasa.
const cuotaMinima = (p) => {
  const monto = parseFloat(p.monto);
  const plazo = parseInt(p.plazo_meses);
  if (!(monto > 0) || isNaN(plazo)) return null;
  const tasaMensual = parseFloat(p.tasa_interes) / 100 / 12;
  if (isNaN(tasaMensual)) return null;
  if (plazo === 0) return parseFloat((monto * tasaMensual).toFixed(2));
  if (tasaMensual === 0) return parseFloat((monto / plazo).toFixed(2));
  const f = Math.pow(1 + tasaMensual, plazo);
  return parseFloat(((monto * tasaMensual * f) / (f - 1)).toFixed(2));
};

const limpiar = (valor) => {
  if (Array.isArray(valor)) return valor.map(limpiar);
  if (valor && typeof valor === "object" && !(valor instanceof Date)) {
    const salida = {};
    const cuota = valor.tasa_interes !== undefined ? cuotaMinima(valor) : null;
    for (const [k, v] of Object.entries(valor)) {
      if (!CAMPO_OCULTO.test(k)) salida[k] = limpiar(v);
    }
    if (cuota !== null) salida.cuota_minima = cuota;
    return salida;
  }
  return valor;
};

// Si la petición viene de un usuario con rol Socio, elimina de la respuesta
// todo dato de intereses/tasas. El personal recibe la respuesta completa.
const ocultarInteresSocio = (req, res, next) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || "clave_secreta");
      if (decoded.rol === "Socio") {
        const jsonOriginal = res.json.bind(res);
        res.json = (body) => jsonOriginal(limpiar(body));
      }
    }
  } catch {
    // token ausente o inválido: lo manejan las rutas como hasta ahora
  }
  next();
};

module.exports = { ocultarInteresSocio };
