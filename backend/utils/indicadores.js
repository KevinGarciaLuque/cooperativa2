// Indicadores financieros para el informe al supervisor (INACOP / INGECOP u otro):
// morosidad, cobertura de provisiones, liquidez, solvencia, rentabilidad y concentración.
// Con la contabilidad iniciada se usan sus saldos; si no, se calculan con los datos de la
// operación (caja, cuentas y préstamos) y se avisa que son aproximados.
const pool = require("../db");
const config = require("./configFinanciera");
const { obtenerCartera, resumirCartera, etiquetasCartera, limites } = require("./cartera");
const { hoyISO } = require("./fechas");

const num = (v) => parseFloat(v || 0);
const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const pct = (a, b) => (b > 0 ? r2((a / b) * 100) : null);

// Saldos contables por clave a una fecha, con signo según el tipo de cuenta (activo y gasto
// positivos al debe; pasivo, patrimonio e ingreso al haber), y el movimiento del año
const saldosContables = async (hasta) => {
  const inicioAnio = `${hasta.substring(0, 4)}-01-01`;
  const [rows] = await pool.query(
    `SELECT c.clave, c.tipo,
            IFNULL(SUM(l.debe - l.haber), 0) AS neto,
            IFNULL(SUM(CASE WHEN p.fecha >= ? THEN l.debe - l.haber ELSE 0 END), 0) AS neto_anio
     FROM cuentas_contables c
     INNER JOIN partida_lineas l ON l.id_cuenta_contable = c.id_cuenta_contable
     INNER JOIN partidas p ON p.id_partida = l.id_partida AND p.fecha <= ?
     GROUP BY c.id_cuenta_contable`,
    [inicioAnio, hasta]
  );
  if (!rows.length) return null;
  const signo = (tipo) => (["activo", "gasto"].includes(tipo) ? 1 : -1);
  const total = (tipos, campo = "neto") => r2(rows.filter((r) => tipos.includes(r.tipo)).reduce((t, r) => t + signo(r.tipo) * num(r[campo]), 0));
  const deClaves = (claves) => r2(rows.filter((r) => claves.includes(r.clave)).reduce((t, r) => t + signo(r.tipo) * num(r.neto), 0));
  const ingresosAnio = total(["ingreso"], "neto_anio");
  const gastosAnio = total(["gasto"], "neto_anio");
  return {
    disponibilidades: deClaves(["caja", "bancos"]),
    depositos: deClaves(["ahorro_vivienda", "ahorro_pensiones", "ahorro_otros", "depositos_plazo"]),
    provision_contable: -deClaves(["provision_cartera"]), // cuenta que resta al activo
    activo: total(["activo"]),
    pasivo: total(["pasivo"]),
    // El resultado acumulado de ingresos menos gastos forma parte del patrimonio
    patrimonio: r2(total(["patrimonio"]) + total(["ingreso"]) - total(["gasto"])),
    ingresos_anio: ingresosAnio,
    gastos_anio: gastosAnio,
    excedente_anio: r2(ingresosAnio - gastosAnio),
  };
};

// Los mismos datos a partir de la operación, cuando aún no hay contabilidad
const saldosOperativos = async (provision) => {
  const [[caja]] = await pool.query(
    "SELECT IFNULL(SUM(CASE WHEN tipo = 'ingreso' THEN monto ELSE -monto END), 0) AS s FROM caja_movimientos"
  );
  const [[ahorro]] = await pool.query("SELECT IFNULL(SUM(saldo_actual), 0) AS s FROM cuentas WHERE estado = 'activa'");
  let plazos = 0;
  try {
    const [[p]] = await pool.query("SELECT IFNULL(SUM(monto), 0) AS s FROM depositos_plazo WHERE estado = 'vigente'");
    plazos = num(p.s);
  } catch {
    plazos = 0;
  }
  const [[cartera]] = await pool.query(
    "SELECT IFNULL(SUM(saldo_restante), 0) AS s FROM prestamos WHERE estado IN ('activo','mora')"
  );
  const disponibilidades = r2(caja.s);
  const depositos = r2(num(ahorro.s) + plazos);
  const activo = r2(disponibilidades + num(cartera.s) - provision);
  return {
    disponibilidades,
    depositos,
    provision_contable: null,
    activo,
    pasivo: depositos,
    patrimonio: r2(activo - depositos),
    ingresos_anio: null,
    gastos_anio: null,
    excedente_anio: null,
  };
};

// Semáforo: "bien", "atencion" o "mal" según la meta (mayor es mejor o menor es mejor)
const semaforo = (valor, meta, mayorEsMejor) => {
  if (valor === null || valor === undefined) return "sin_dato";
  if (mayorEsMejor) return valor >= meta ? "bien" : valor >= meta * 0.75 ? "atencion" : "mal";
  return valor <= meta ? "bien" : valor <= meta * 1.5 ? "atencion" : "mal";
};

const calcularIndicadores = async (hasta = hoyISO()) => {
  const cfg = config.obtener();
  const [l1] = limites();
  const cartera = await obtenerCartera();
  const { resumen, totales } = resumirCartera(cartera);

  const carteraTotal = r2(cartera.reduce((t, c) => t + c.saldo, 0));
  const conAtraso = cartera.filter((c) => c.dias_atraso > 0 || c.dias_mora > 0);
  const atraso = r2(conAtraso.reduce((t, c) => t + c.saldo, 0));
  const atraso30 = r2(cartera.filter((c) => Math.max(c.dias_atraso, c.dias_mora) > l1).reduce((t, c) => t + c.saldo, 0));

  const contables = await saldosContables(hasta);
  const base = contables || (await saldosOperativos(totales.provision));
  // Provisión: la registrada en contabilidad o, si no hay, la que se requiere según la cartera
  const provision = contables && contables.provision_contable > 0 ? contables.provision_contable : totales.provision;

  // Concentración: los 10 mayores deudores (por socio)
  const porSocio = {};
  cartera.forEach((c) => {
    porSocio[c.id_usuario] = porSocio[c.id_usuario] || { socio: c.socio, dni: c.dni, saldo: 0, prestamos: 0 };
    porSocio[c.id_usuario].saldo = r2(porSocio[c.id_usuario].saldo + c.saldo);
    porSocio[c.id_usuario].prestamos += 1;
  });
  const mayores = Object.values(porSocio).sort((a, b) => b.saldo - a.saldo).slice(0, 10);
  const top10 = r2(mayores.reduce((t, m) => t + m.saldo, 0));

  // Rentabilidad anualizada: excedente del año / activo, llevado a 12 meses
  const mes = parseInt(hasta.substring(5, 7));
  const roa = base.excedente_anio !== null && base.activo > 0 ? r2(((base.excedente_anio / base.activo) * 100 * 12) / mes) : null;

  const [[socios]] = await pool.query(
    `SELECT COUNT(*) AS activos,
            SUM(CASE WHEN YEAR(u.fecha_registro) = ? THEN 1 ELSE 0 END) AS nuevos_anio
     FROM usuarios u JOIN roles r ON r.id_rol = u.rol_id WHERE r.nombre = 'Socio' AND u.estado = 'activo'`,
    [hasta.substring(0, 4)]
  );
  const [[prestatarios]] = await pool.query(
    "SELECT COUNT(DISTINCT id_usuario) AS n FROM prestamos WHERE estado IN ('activo','mora')"
  );

  const ind = (clave, nombre, valor, meta, mayorEsMejor, formula, unidad = "%") => ({
    clave, nombre, valor, meta, unidad, formula,
    regla: meta === null ? null : `${mayorEsMejor ? "Al menos" : "No más de"} ${meta}${unidad}`,
    estado: meta === null ? "sin_dato" : semaforo(valor, meta, mayorEsMejor),
  });

  const indicadores = [
    ind("morosidad", "Morosidad", pct(atraso, carteraTotal), num(cfg.ind_meta_morosidad), false,
      "Saldo de préstamos con cuotas atrasadas ÷ cartera total"),
    ind("morosidad_30", `Morosidad mayor a ${l1} días`, pct(atraso30, carteraTotal), num(cfg.ind_meta_morosidad), false,
      `Saldo con más de ${l1} días de atraso ÷ cartera total`),
    ind("cobertura", "Cobertura de provisiones", pct(provision, atraso30), num(cfg.ind_meta_cobertura), true,
      `Provisión para incobrables ÷ saldo con más de ${l1} días de atraso`),
    ind("liquidez", "Liquidez", pct(base.disponibilidades, base.depositos), num(cfg.ind_meta_liquidez), true,
      "Caja y bancos ÷ depósitos de ahorro y plazo fijo de los socios"),
    ind("solvencia", "Solvencia (patrimonio sobre activo)", pct(base.patrimonio, base.activo), num(cfg.ind_meta_solvencia), true,
      "Patrimonio ÷ activo total"),
    ind("rentabilidad", "Rentabilidad sobre activos (anualizada)", roa, null, true,
      "Excedente del año ÷ activo total, llevado a 12 meses"),
    ind("concentracion", "Concentración en los 10 mayores deudores", pct(top10, carteraTotal), null, false,
      "Saldo de los 10 socios que más deben ÷ cartera total"),
  ];

  const etiquetas = etiquetasCartera();
  return {
    fecha: hasta,
    fuente: contables ? "contabilidad" : "operacion",
    aviso: contables
      ? null
      : "La contabilidad todavía no tiene partidas: liquidez y solvencia se calcularon con los saldos de caja, ahorro y préstamos, y la rentabilidad necesita la contabilidad.",
    indicadores,
    cifras: {
      cartera_total: carteraTotal,
      cartera_con_atraso: atraso,
      cartera_atraso_30: atraso30,
      prestamos_vigentes: cartera.length,
      prestamos_con_atraso: conAtraso.length,
      provision_requerida: totales.provision,
      provision_contable: base.provision_contable,
      disponibilidades: base.disponibilidades,
      depositos_socios: base.depositos,
      activo_total: base.activo,
      pasivo_total: base.pasivo,
      patrimonio: base.patrimonio,
      ingresos_anio: base.ingresos_anio,
      gastos_anio: base.gastos_anio,
      excedente_anio: base.excedente_anio,
      socios_activos: num(socios.activos),
      socios_nuevos_anio: num(socios.nuevos_anio),
      socios_con_prestamo: prestatarios.n,
    },
    cartera_por_categoria: Object.keys(resumen).map((k) => ({ categoria: k, nombre: etiquetas[k], ...resumen[k] })),
    mayores_deudores: mayores,
  };
};

module.exports = { calcularIndicadores, semaforo };
