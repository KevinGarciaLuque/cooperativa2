// Fechas según la zona horaria de la cooperativa: la del país elegido en Configuración
// (Honduras por defecto, UTC-6), salvo que APP_TIMEZONE la fije. El servidor en la nube
// trabaja en UTC: sin esto, después de las 6 p. m. "hoy" ya sería el día siguiente.
const pais = require("./pais");

const zona = () => process.env.APP_TIMEZONE || pais.obtener().zona;

const formateadores = {};
const formateadorDe = (z) =>
  (formateadores[z] ||= new Intl.DateTimeFormat("en-CA", {
    timeZone: z,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }));

// "YYYY-MM-DD" del día actual en la zona de la cooperativa
const hoyISO = (fecha = new Date()) => formateadorDe(zona()).format(fecha);

const anioMesActual = () => {
  const [anio, mes] = hoyISO().split("-").map(Number);
  return { anio, mes };
};

module.exports = { zona, hoyISO, anioMesActual };
