// Ambiente del servidor. En Railway, el ambiente de pruebas lleva AMBIENTE=pruebas: puede tener
// una copia de los datos reales, así que nunca debe escribirles a los socios de verdad ni
// mezclar sus respaldos con los de la cooperativa.
const esPruebas = () => /^(pruebas|staging)$/i.test(String(process.env.AMBIENTE || "").trim());

const nombreAmbiente = () => (esPruebas() ? "pruebas" : "produccion");

module.exports = { esPruebas, nombreAmbiente };
