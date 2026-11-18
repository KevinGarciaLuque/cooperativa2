// Números en letras para documentos: 1250.5 → "un mil doscientos cincuenta con 50/100"
const UNIDADES = ["", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez", "once", "doce", "trece", "catorce", "quince", "dieciséis", "diecisiete", "dieciocho", "diecinueve", "veinte", "veintiuno", "veintidós", "veintitrés", "veinticuatro", "veinticinco", "veintiséis", "veintisiete", "veintiocho", "veintinueve"];
const DECENAS = ["", "", "", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa"];
const CENTENAS = ["", "ciento", "doscientos", "trescientos", "cuatrocientos", "quinientos", "seiscientos", "setecientos", "ochocientos", "novecientos"];

const menorDeMil = (n) => {
  if (n === 0) return "";
  if (n === 100) return "cien";
  const c = Math.floor(n / 100);
  const r = n % 100;
  let t = CENTENAS[c];
  if (r) {
    let d;
    if (r < 30) d = UNIDADES[r];
    else d = DECENAS[Math.floor(r / 10)] + (r % 10 ? ` y ${UNIDADES[r % 10]}` : "");
    t = t ? `${t} ${d}` : d;
  }
  return t;
};

// Entero en letras ("uno" se apocopa a "un" antes de mil/millón)
const enteroALetras = (n) => {
  n = Math.floor(Math.abs(n));
  if (n === 0) return "cero";
  const millones = Math.floor(n / 1000000);
  const miles = Math.floor((n % 1000000) / 1000);
  const resto = n % 1000;
  const partes = [];
  const apocope = (t) => t.replace(/veintiuno$/, "veintiún").replace(/uno$/, "un");
  if (millones) partes.push(millones === 1 ? "un millón" : `${apocope(menorDeMil(millones))} millones`);
  if (miles) partes.push(miles === 1 ? "mil" : `${apocope(menorDeMil(miles))} mil`);
  if (resto) partes.push(menorDeMil(resto));
  return partes.join(" ");
};

// Monto con centavos: "mil doscientos cincuenta con 50/100"
const montoALetras = (monto) => {
  const v = Math.round(Math.abs(parseFloat(monto) || 0) * 100);
  const entero = Math.floor(v / 100);
  const cent = String(v % 100).padStart(2, "0");
  return `${enteroALetras(entero)} con ${cent}/100`;
};

module.exports = { enteroALetras, montoALetras };
