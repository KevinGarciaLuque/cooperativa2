// País de la cooperativa: moneda, formato de los montos, documento de identidad y teléfono.
// El servidor lo envía en /api/configuracion (lo elige el Super Administrador) y se carga
// antes de mostrar la aplicación. Mientras tanto, o si no hay conexión, se usa el último
// conocido y, si no hay ninguno, Honduras.

const HONDURAS = {
  codigo: "HN",
  nombre: "Honduras",
  locale: "es-HN",
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
};

const CLAVE = "pais_cooperativa";

const valido = (d) => d && d.codigo && d.moneda?.simbolo && d.numeros && d.identidad?.patron && d.telefono;

let actual = (() => {
  try {
    const guardado = JSON.parse(localStorage.getItem(CLAVE));
    return valido(guardado) ? guardado : HONDURAS;
  } catch {
    return HONDURAS;
  }
})();

export const establecerPais = (datos) => {
  if (!valido(datos)) return;
  actual = datos;
  try {
    localStorage.setItem(CLAVE, JSON.stringify(datos));
  } catch {
    // sin almacenamiento: se usa solo en esta visita
  }
};

export const pais = () => actual;
export const simboloMoneda = () => actual.moneda.simbolo;
export const localeApp = () => actual.locale;
export const separadores = () => actual.numeros;

// 1234.5 → "1,234.50" (o "1 234,50" en Costa Rica)
export const cifra = (n, decimales = 2) => {
  const v = parseFloat(n);
  const x = Number.isFinite(v) ? v : 0;
  const [entero, dec] = Math.abs(x).toFixed(decimales).split(".");
  const conMiles = entero.replace(/\B(?=(\d{3})+(?!\d))/g, actual.numeros.miles);
  const negativo = x < 0 && parseFloat(Math.abs(x).toFixed(decimales)) !== 0;
  return `${negativo ? "-" : ""}${conMiles}${dec ? actual.numeros.decimal + dec : ""}`;
};

// Campos de monto mientras se escriben: "50000.5" ↔ "50,000.5" (o "50 000,5" en Costa Rica)
export const montoATexto = (valor) => {
  if (valor === "" || valor === null || valor === undefined) return "";
  const { miles, decimal } = actual.numeros;
  const [entero, decimales] = String(valor).split(".");
  const conMiles = entero.replace(/\B(?=(\d{3})+(?!\d))/g, miles);
  return decimales !== undefined ? `${conMiles}${decimal}${decimales}` : conMiles;
};
export const textoAMonto = (texto) => {
  const { miles, decimal } = actual.numeros;
  let t = String(texto).split(miles).join("");
  if (/\s/.test(miles)) t = t.replace(/\s/g, "");
  if (decimal !== ".") t = t.replace(/\./g, "").split(decimal).join(".");
  return t;
};

// 1234.5 → "L. 1,234.50"
// (con un espacio que no se corta: el símbolo nunca queda solo al final de una línea)
export const dinero = (n, decimales = 2) => `${actual.moneda.simbolo}\u00a0${cifra(n, decimales)}`;

// Documento de identidad del país (DNI, DPI, DUI, cédula...)
export const docIdentidad = () => actual.identidad;
export const normalizarIdentidad = (valor) => {
  const t = String(valor || "").trim().toUpperCase().replace(/\s+/g, "");
  if (actual.identidad.solo_digitos) return t.replace(/\D/g, "");
  return actual.identidad.conserva_guiones ? t : t.replace(/-/g, "");
};
export const validarIdentidad = (valor) => new RegExp(actual.identidad.patron).test(normalizarIdentidad(valor));

// Número para abrir WhatsApp: los locales llevan el código del país; los de otro país ya lo traen
export const numeroWhatsApp = (telefono) => {
  const t = String(telefono || "").trim();
  const d = t.replace(/\D/g, "");
  if (!d || t.startsWith("+")) return d;
  return d.length === actual.telefono.digitos ? `${actual.telefono.codigo}${d}` : d;
};
