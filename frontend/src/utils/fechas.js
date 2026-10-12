// Fecha de hoy según el reloj del dispositivo, en formato YYYY-MM-DD.
// toISOString() usa UTC: después de las 6 p. m. en Honduras daría el día siguiente.
export const hoyLocal = (fecha = new Date()) => {
  const p = (n) => String(n).padStart(2, "0");
  return `${fecha.getFullYear()}-${p(fecha.getMonth() + 1)}-${p(fecha.getDate())}`;
};
