// País de la cooperativa: moneda, formato de los montos, documento de identidad, teléfono y
// zona horaria. Se elige una vez en Configuración (Super Administrador) y se guarda en
// configuracion_sitio con la clave "pais". Sin elegir, es Honduras (como siempre fue).
// Cambiar el país NO convierte montos: solo cambia cómo se muestran y se validan los datos.

const PAISES = {
  HN: {
    codigo: "HN",
    nombre: "Honduras",
    locale: "es-HN",
    zona: "America/Tegucigalpa",
    moneda: { iso: "HNL", simbolo: "L.", nombre: "lempiras" },
    numeros: { miles: ",", decimal: "." },
    telefono: { codigo: "504", digitos: 8 },
    identidad: {
      nombre: "DNI",
      nombre_largo: "Documento Nacional de Identificación",
      patron: "^\\d{13}$",
      solo_digitos: true,
      largo_max: 13,
      ayuda: "13 dígitos, sin guiones.",
      ejemplo: "0801199012345",
    },
  },
  GT: {
    codigo: "GT",
    nombre: "Guatemala",
    locale: "es-GT",
    zona: "America/Guatemala",
    moneda: { iso: "GTQ", simbolo: "Q", nombre: "quetzales" },
    numeros: { miles: ",", decimal: "." },
    telefono: { codigo: "502", digitos: 8 },
    identidad: {
      nombre: "DPI",
      nombre_largo: "Documento Personal de Identificación (CUI)",
      patron: "^\\d{13}$",
      solo_digitos: true,
      largo_max: 13,
      ayuda: "Los 13 dígitos del CUI, sin espacios.",
      ejemplo: "2547896320101",
    },
  },
  SV: {
    codigo: "SV",
    nombre: "El Salvador",
    locale: "es-SV",
    zona: "America/El_Salvador",
    moneda: { iso: "USD", simbolo: "$", nombre: "dólares" },
    numeros: { miles: ",", decimal: "." },
    telefono: { codigo: "503", digitos: 8 },
    identidad: {
      nombre: "DUI",
      nombre_largo: "Documento Único de Identidad",
      patron: "^\\d{9}$",
      solo_digitos: true,
      largo_max: 9,
      ayuda: "9 dígitos, sin guion.",
      ejemplo: "012345678",
    },
  },
  NI: {
    codigo: "NI",
    nombre: "Nicaragua",
    locale: "es-NI",
    zona: "America/Managua",
    moneda: { iso: "NIO", simbolo: "C$", nombre: "córdobas" },
    numeros: { miles: ",", decimal: "." },
    telefono: { codigo: "505", digitos: 8 },
    identidad: {
      nombre: "Cédula",
      nombre_largo: "Cédula de identidad",
      patron: "^\\d{13}[A-Z]$",
      solo_digitos: false,
      largo_max: 14,
      ayuda: "13 dígitos y la letra final, sin guiones.",
      ejemplo: "0011505900000A",
    },
  },
  CR: {
    codigo: "CR",
    nombre: "Costa Rica",
    locale: "es-CR",
    zona: "America/Costa_Rica",
    moneda: { iso: "CRC", simbolo: "₡", nombre: "colones" },
    numeros: { miles: " ", decimal: "," },
    telefono: { codigo: "506", digitos: 8 },
    identidad: {
      nombre: "Cédula",
      nombre_largo: "Cédula de identidad",
      patron: "^\\d{9}$",
      solo_digitos: true,
      largo_max: 9,
      ayuda: "9 dígitos, sin guiones (ejemplo: 109870654).",
      ejemplo: "109870654",
    },
  },
  PA: {
    codigo: "PA",
    nombre: "Panamá",
    locale: "es-PA",
    zona: "America/Panama",
    moneda: { iso: "PAB", simbolo: "B/.", nombre: "balboas" },
    numeros: { miles: ",", decimal: "." },
    telefono: { codigo: "507", digitos: 8 },
    identidad: {
      nombre: "Cédula",
      nombre_largo: "Cédula de identidad personal",
      patron: "^(\\d{1,2}|PE|E|N|\\d{1,2}AV|\\d{1,2}PI)-\\d{1,4}-\\d{1,6}$",
      solo_digitos: false,
      largo_max: 15,
      conserva_guiones: true, // los guiones separan provincia, tomo y asiento
      ayuda: "Con sus guiones, como aparece en la cédula (ejemplo: 8-123-4567).",
      ejemplo: "8-123-4567",
    },
  },
  BZ: {
    codigo: "BZ",
    nombre: "Belice",
    locale: "es-BZ",
    zona: "America/Belize",
    moneda: { iso: "BZD", simbolo: "BZ$", nombre: "dólares beliceños" },
    numeros: { miles: ",", decimal: "." },
    telefono: { codigo: "501", digitos: 7 },
    identidad: {
      nombre: "N.º de Seguro Social",
      nombre_largo: "Número de Seguro Social",
      patron: "^\\d{9}$",
      solo_digitos: true,
      largo_max: 9,
      ayuda: "9 dígitos, sin espacios.",
      ejemplo: "123456789",
    },
  },
};

const PREDETERMINADO = "HN";

let actual = PAISES[PREDETERMINADO];

// Lee el país guardado (si la tabla aún no existe, queda Honduras)
const refrescar = async () => {
  const pool = require("../db");
  try {
    const [[fila]] = await pool.query("SELECT valor FROM configuracion_sitio WHERE clave = 'pais'");
    return establecer(fila?.valor);
  } catch {
    return establecer(PREDETERMINADO);
  }
};

const obtener = () => actual;

// Cambia el país en memoria (lo usa refrescar; también las pruebas)
const establecer = (codigo) => {
  actual = PAISES[codigo] || PAISES[PREDETERMINADO];
  return actual;
};

let iniciado = false;
const iniciar = async () => {
  if (iniciado) return actual;
  iniciado = true;
  setInterval(refrescar, 30 * 1000).unref();
  return refrescar();
};

// 1234.5 → "1,234.50" (o "1 234,50" en Costa Rica)
const numero = (n, decimales = 2) => {
  const v = parseFloat(n);
  const x = Number.isFinite(v) ? v : 0;
  const [entero, dec] = Math.abs(x).toFixed(decimales).split(".");
  const conMiles = entero.replace(/\B(?=(\d{3})+(?!\d))/g, actual.numeros.miles);
  const negativo = x < 0 && parseFloat(Math.abs(x).toFixed(decimales)) !== 0;
  return `${negativo ? "-" : ""}${conMiles}${dec ? actual.numeros.decimal + dec : ""}`;
};

// 1234.5 → "L. 1,234.50"
const dinero = (n, decimales = 2) => `${actual.moneda.simbolo} ${numero(n, decimales)}`;

// Idioma de fechas y números del país (es-HN, es-GT...)
const locale = () => actual.locale;

// Fechas en el idioma del país (mismo día que antes: no se cambia la zona de la fecha)
const fechaTexto = (fecha, opciones = {}) => {
  const d = fecha instanceof Date ? fecha : new Date(fecha);
  return isNaN(d) ? "" : d.toLocaleDateString(actual.locale, opciones);
};
const fechaHoraTexto = (fecha) => {
  const d = fecha instanceof Date ? fecha : new Date(fecha);
  return isNaN(d) ? "" : d.toLocaleString(actual.locale);
};

// Documento de identidad: se quitan espacios y guiones (salvo en Panamá, donde son parte
// del número) y se valida
const normalizarIdentidad = (valor, p = actual) => {
  const t = String(valor || "").trim().toUpperCase().replace(/\s+/g, "");
  if (p.identidad.solo_digitos) return t.replace(/\D/g, "");
  return p.identidad.conserva_guiones ? t : t.replace(/-/g, "");
};
const validarIdentidad = (valor, p = actual) => new RegExp(p.identidad.patron).test(normalizarIdentidad(valor, p));
const mensajeIdentidad = (p = actual) => `${p.identidad.nombre} inválido: ${p.identidad.ayuda}`;

module.exports = {
  PAISES,
  PREDETERMINADO,
  refrescar,
  obtener,
  establecer,
  iniciar,
  numero,
  dinero,
  locale,
  fechaTexto,
  fechaHoraTexto,
  normalizarIdentidad,
  validarIdentidad,
  mensajeIdentidad,
};
