// Cálculos de interés compartidos por pagos y préstamos.
// Regla de la cooperativa: mes completo siempre.
//   - Pagar antes de 30 días cobra igual el mes completo de interés.
//   - Pasados los 30 días, el interés sigue por días reales (tasa mensual / 30).
//   - Cuota fija: siempre un mes (30 días).

const DIAS_MES = 30;

const pad = (n) => String(n).padStart(2, "0");

// Devuelve "YYYY-MM-DD" desde un string, un Date de MySQL (hora local) o null.
const soloFecha = (valor) => {
  if (!valor) return null;
  if (typeof valor === "string") return valor.substring(0, 10);
  if (valor instanceof Date && !isNaN(valor)) {
    return `${valor.getFullYear()}-${pad(valor.getMonth() + 1)}-${pad(valor.getDate())}`;
  }
  return null;
};

const esFechaISO = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(Date.parse(v));

const hoyISO = () => new Date().toISOString().split("T")[0];

// Días entre dos fechas "YYYY-MM-DD"
const diasEntre = (desde, hasta) => {
  const [y1, m1, d1] = desde.split("-").map(Number);
  const [y2, m2, d2] = hasta.split("-").map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
};

// Interés del período sobre el saldo. tasaAnual viene de prestamos.tasa_interes.
const calcularInteresPeriodo = (saldo, tasaAnual, dias) => {
  const tasaDiaria = parseFloat(tasaAnual) / 100 / 12 / DIAS_MES;
  return parseFloat((parseFloat(saldo) * tasaDiaria * dias).toFixed(2));
};

// Días para cobrar interés según el modo de pago (mínimo un mes completo).
const diasDeInteres = (modo, fechaBase, fechaPago) =>
  modo === "cuota_fija" ? DIAS_MES : Math.max(DIAS_MES, diasEntre(fechaBase, fechaPago));

// Días de atraso: pasados 30 días desde el último pago (o desde el otorgamiento)
const calcularDiasMora = (fechaOtorgado, fechaUltimoPago = null) => {
  const base = soloFecha(fechaUltimoPago) || soloFecha(fechaOtorgado);
  if (!base) return 0;
  return Math.max(0, diasEntre(base, hoyISO()) - DIAS_MES);
};

// Mora: 24% anual (2% mensual) sobre el saldo, por día de atraso
const calcularInteresMoratorio = (saldo, diasMora) =>
  parseFloat(saldo) * (24 / 365 / 100) * diasMora;

module.exports = {
  calcularDiasMora,
  calcularInteresMoratorio,
  DIAS_MES,
  soloFecha,
  esFechaISO,
  hoyISO,
  diasEntre,
  calcularInteresPeriodo,
  diasDeInteres,
};
