// Teléfonos: los de Honduras se guardan como 8 dígitos (como siempre); los de otro país,
// con su código internacional: "+" seguido de 8 a 15 dígitos (por ejemplo +13055551234).
const validarTelefono = (v) => /^\d{8}$/.test(String(v || "")) || /^\+\d{8,15}$/.test(String(v || ""));

// Quita espacios y guiones: "+1 305-555-1234" → "+13055551234"
const limpiarTelefono = (v) => {
  const t = String(v || "").trim();
  return (t.startsWith("+") ? "+" : "") + t.replace(/\D/g, "");
};

module.exports = { validarTelefono, limpiarTelefono };
