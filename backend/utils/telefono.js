// Teléfonos: los del país de la cooperativa se guardan solo con sus dígitos locales (8 en
// Honduras, como siempre); los de otro país, con su código internacional: "+" seguido de
// 8 a 15 dígitos (por ejemplo +13055551234).
const pais = require("./pais");

const digitosLocales = () => pais.obtener().telefono.digitos;

const validarTelefono = (v) => {
  const t = String(v || "");
  return new RegExp(`^\\d{${digitosLocales()}}$`).test(t) || /^\+\d{8,15}$/.test(t);
};

const mensajeTelefono = (v) =>
  String(v || "").trim().startsWith("+")
    ? "Revisa el número de teléfono y el código del país."
    : `El teléfono debe tener ${digitosLocales()} dígitos.`;

// Quita espacios y guiones: "+1 305-555-1234" → "+13055551234"
const limpiarTelefono = (v) => {
  const t = String(v || "").trim();
  return (t.startsWith("+") ? "+" : "") + t.replace(/\D/g, "");
};

module.exports = { validarTelefono, limpiarTelefono, mensajeTelefono };
