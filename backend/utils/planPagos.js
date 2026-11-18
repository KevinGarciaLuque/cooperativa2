// Plan de pagos de un préstamo: las cuotas con su fecha de vencimiento, según las condiciones
// pactadas (monto, tasa, plazo y fecha del desembolso), por el sistema francés.
//
// No se guarda: se calcula siempre igual a partir de esas condiciones, así que sirve también
// para los préstamos que ya existían y no se desincroniza con lo guardado.
//
// El estado de cada cuota sale del capital ya abonado (monto - saldo). Un pago de "cuota fija"
// cobra un mes de interés aunque llegue tarde (la mora se cobra aparte), así que su capital
// coincide con el del plan; los abonos extra cubren por adelantado las cuotas siguientes.
//
// La mora que se COBRA no sale de aquí (sigue en calculosPrestamo.js); el plan sirve para
// mostrar vencimientos y para clasificar la cartera por días de atraso de la cuota.
const { soloFecha, diasEntre, hoyISO, calcularCuotaMensual } = require("./calculosPrestamo");

const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

// Suma meses a "YYYY-MM-DD" sin desbordar: 31 de enero + 1 mes = 28 (o 29) de febrero
const sumarMeses = (iso, meses) => {
  const [y, m, d] = iso.split("-").map(Number);
  const total = m - 1 + meses;
  const anio = y + Math.floor(total / 12);
  const mes = ((total % 12) + 12) % 12;
  const ultimoDia = new Date(Date.UTC(anio, mes + 1, 0)).getUTCDate();
  const dia = Math.min(d, ultimoDia);
  return `${anio}-${String(mes + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
};

// Cuotas del plan. tasaAnual = prestamos.tasa_interes (nominal anual; la mensual es /12).
// La última cuota ajusta los centavos para que el capital sume exactamente el monto.
// "redondeo" (configuración por producto): la cuota se sube al múltiplo indicado (1, 5, 10...)
// y la última cuota ajusta la diferencia.
const redondearCuota = (cuota, redondeo) => {
  const r = parseFloat(redondeo);
  return r > 0 ? r2(Math.ceil(r2(cuota) / r - 1e-9) * r) : cuota;
};

// Frecuencia (configuración por producto): el plazo sigue en meses; las cuotas quincenales son
// 2 por mes y las semanales 52 por año. Su interés usa la misma tasa diaria que los pagos
// (tasa anual / 360 por día).
const DIAS_FREC = { semanal: 7, quincenal: 15 };
const numeroDeCuotas = (plazoMeses, frecuencia) =>
  frecuencia === "semanal" ? Math.round((parseInt(plazoMeses) * 52) / 12) : frecuencia === "quincenal" ? parseInt(plazoMeses) * 2 : parseInt(plazoMeses);
const fechaCuota = (inicio, k, frecuencia) => {
  if (!DIAS_FREC[frecuencia]) return sumarMeses(inicio, k);
  const d = new Date(`${inicio}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + DIAS_FREC[frecuencia] * k);
  return d.toISOString().substring(0, 10);
};

const generarPlan = ({ monto, tasaAnual, plazo, fechaInicio, redondeo = null, metodo = null, frecuencia = null }) => {
  const capitalTotal = r2(monto);
  const n = numeroDeCuotas(plazo, frecuencia);
  const inicio = soloFecha(fechaInicio);
  if (!(capitalTotal > 0) || !(n > 0) || !inicio) return [];

  const i = DIAS_FREC[frecuencia] ? (parseFloat(tasaAnual) / 100 / 360) * DIAS_FREC[frecuencia] : parseFloat(tasaAnual) / 100 / 12;
  const sumarMesesF = (base, k) => fechaCuota(base, k, frecuencia);
  // Interés fijo ("flat"): cada cuota paga el mismo interés sobre el monto original y el mismo capital
  if (metodo === "flat") {
    const interesFijo = r2(capitalTotal * i);
    const cuota = redondearCuota(r2(capitalTotal / n + interesFijo), redondeo);
    const cuotasFlat = [];
    let saldoF = capitalTotal;
    for (let k = 1; k <= n; k++) {
      const capital = k === n ? saldoF : Math.min(saldoF, r2(cuota - interesFijo));
      saldoF = r2(saldoF - capital);
      cuotasFlat.push({ numero: k, fecha_vencimiento: sumarMesesF(inicio, k), cuota: r2(capital + interesFijo), capital, interes: interesFijo, saldo: saldoF });
    }
    return cuotasFlat;
  }
  const cuotaFija = redondearCuota(
    r2(i === 0 ? capitalTotal / n : (capitalTotal * i * Math.pow(1 + i, n)) / (Math.pow(1 + i, n) - 1)),
    redondeo
  );

  const cuotas = [];
  let saldo = capitalTotal;
  for (let k = 1; k <= n; k++) {
    const interes = r2(saldo * i);
    const capital = k === n ? saldo : Math.min(saldo, r2(cuotaFija - interes));
    saldo = r2(saldo - capital);
    cuotas.push({
      numero: k,
      fecha_vencimiento: sumarMesesF(inicio, k),
      cuota: r2(capital + interes),
      capital,
      interes,
      saldo,
    });
  }
  return cuotas;
};

// Cuánto capital puede faltarle a una cuota para considerarla pagada (redondeos)
const tolerancia = (cuota) => Math.max(0.5, r2(cuota.cuota * 0.01));

// Estado de cada cuota y resumen del atraso, según el saldo actual del préstamo
const estadoDelPlan = (cuotas, { saldoActual, monto, hoy = hoyISO(), cancelado = false }) => {
  const capitalPagado = cancelado ? r2(monto) : r2(Math.max(0, parseFloat(monto) - parseFloat(saldoActual)));
  let acumulado = 0;
  let primeraVencida = null;
  let capitalVencido = 0;
  let proxima = null;

  const detalle = cuotas.map((c) => {
    const antes = acumulado;
    acumulado = r2(acumulado + c.capital);
    const cubierto = r2(Math.min(c.capital, Math.max(0, capitalPagado - antes)));
    const pendiente = r2(c.capital - cubierto);
    const pagada = cancelado || pendiente <= tolerancia(c);
    const vencida = !pagada && c.fecha_vencimiento < hoy;
    let estado = "pendiente";
    if (pagada) estado = "pagada";
    else if (vencida) estado = "vencida";
    else if (cubierto > 0) estado = "parcial";

    if (vencida) {
      if (!primeraVencida) primeraVencida = c;
      capitalVencido = r2(capitalVencido + pendiente);
    }
    if (!pagada && !vencida && !proxima) proxima = c;
    return { ...c, capital_pagado: pagada ? c.capital : cubierto, capital_pendiente: pagada ? 0 : pendiente, estado };
  });

  const vencidas = detalle.filter((c) => c.estado === "vencida");
  return {
    cuotas: detalle,
    resumen: {
      total_cuotas: cuotas.length,
      cuotas_pagadas: detalle.filter((c) => c.estado === "pagada").length,
      cuotas_vencidas: vencidas.length,
      dias_atraso: primeraVencida ? Math.max(0, diasEntre(primeraVencida.fecha_vencimiento, hoy)) : 0,
      capital_vencido: capitalVencido,
      // Lo que debería haber pagado ya según el plan (cuotas completas vencidas, sin mora)
      // (si una cuota ya tiene parte del capital abonado, su interés ya se cobró)
      monto_vencido: r2(vencidas.reduce((t, c) => t + c.capital_pendiente + (c.capital_pagado > 0 ? 0 : c.interes), 0)),
      proxima_cuota: proxima ? { numero: proxima.numero, fecha_vencimiento: proxima.fecha_vencimiento, cuota: proxima.cuota } : null,
      fecha_ultima_cuota: cuotas.length ? cuotas[cuotas.length - 1].fecha_vencimiento : null,
    },
  };
};

// Plan con estado para una fila de la tabla prestamos (null si es de plazo indefinido o no
// se ha desembolsado)
const planDePrestamo = (p, hoy = hoyISO()) => {
  if (!["activo", "mora", "pagado", "consolidado"].includes(p.estado)) return null;
  const cuotas = generarPlan({
    monto: p.monto,
    tasaAnual: p.tasa_interes,
    plazo: p.plazo_meses,
    fechaInicio: p.fecha_otorgado,
    redondeo: p.redondeo_cuota,
    metodo: p.metodo_interes,
    frecuencia: p.frecuencia_pago,
  });
  if (!cuotas.length) return null;
  return estadoDelPlan(cuotas, {
    saldoActual: p.saldo_restante,
    monto: p.monto,
    hoy,
    cancelado: ["pagado", "consolidado"].includes(p.estado),
  });
};

// Cuota pactada de un préstamo según su configuración (redondeo, interés sobre saldos o fijo)
const cuotaDelPrestamo = (p) => {
  const plan = generarPlan({
    monto: p.monto, tasaAnual: p.tasa_interes, plazo: p.plazo_meses, fechaInicio: "2000-01-01",
    redondeo: p.redondeo_cuota, metodo: p.metodo_interes, frecuencia: p.frecuencia_pago,
  });
  return plan.length ? plan[0].cuota : calcularCuotaMensual(parseFloat(p.monto), parseFloat(p.tasa_interes), parseInt(p.plazo_meses));
};

module.exports = { generarPlan, estadoDelPlan, planDePrestamo, sumarMeses, redondearCuota, cuotaDelPrestamo, numeroDeCuotas };
