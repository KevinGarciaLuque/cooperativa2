// Fechas según la zona horaria de la cooperativa (por defecto Honduras, UTC-6).
// El servidor en la nube trabaja en UTC: sin esto, después de las 6 p. m. "hoy"
// ya sería el día siguiente.
const ZONA = process.env.APP_TIMEZONE || "America/Tegucigalpa";

const formateador = new Intl.DateTimeFormat("en-CA", {
  timeZone: ZONA,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

// "YYYY-MM-DD" del día actual en la zona de la cooperativa
const hoyISO = (fecha = new Date()) => formateador.format(fecha);

const anioMesActual = () => {
  const [anio, mes] = hoyISO().split("-").map(Number);
  return { anio, mes };
};

module.exports = { ZONA, hoyISO, anioMesActual };
