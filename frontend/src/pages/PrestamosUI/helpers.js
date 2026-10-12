

// ==================== HELPERS TASA ====================
export const TIPOS_TASA = [
  {
    value: "nominal_mensual",
    label: "Tasa Nominal Mensual (TNM)",
    desc: "Estándar cooperativas: tasa por mes sobre saldo. Ej: 12% mensual = L.1,260/mes sobre L.10,500.",
    abbr: "TNM",
    color: "#2980b9",
  },
  {
    value: "nominal_anual",
    label: "Tasa Nominal Anual (TNA)",
    desc: "Se divide entre 12 para obtener la tasa mensual. Ej: 12% TNA = 1% mensual.",
    abbr: "TNA",
    color: "#27ae60",
  },
  {
    value: "efectiva_anual",
    label: "Tasa Efectiva Anual (TEA)",
    desc: "Incluye la capitalización. Común en créditos formales y microfinanzas.",
    abbr: "TEA",
    color: "#8e44ad",
  },
  {
    value: "efectiva_mensual",
    label: "Tasa Efectiva Mensual (TEM)",
    desc: "Se convierte a TEA mediante: (1 + TEM)^12 - 1.",
    abbr: "TEM",
    color: "#e67e22",
  },
];

export const calcularTasaAnual = (tasa, tipo) => {
  const t = parseFloat(tasa) || 0;
  if (tipo === "nominal_mensual") return t * 12;
  if (tipo === "efectiva_mensual") return (Math.pow(1 + t / 100, 12) - 1) * 100;
  return t; // nominal_anual y efectiva_anual ya son anuales
};

export const calcularCuotaSimulador = (monto, tasaAnual, plazo) => {
  if (!monto || !tasaAnual) return 0;
  if (plazo === 0) return monto * (tasaAnual / 100) / 12; // Indefinido: solo interés mensual
  if (!plazo) return 0;
  const tm = tasaAnual / 100 / 12;
  if (tm === 0) return monto / plazo;
  return (monto * (tm * Math.pow(1 + tm, plazo))) / (Math.pow(1 + tm, plazo) - 1);
};

