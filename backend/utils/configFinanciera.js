// Parámetros financieros configurables por el Super Administrador.
// Se guardan en configuracion_sitio con prefijo "fin_" y se mantienen en caché.

const DEFAULTS = {
  mora_tasa_anual: 24, // 24% anual = 2% mensual
  mora_dias_gracia: 30, // días desde el último pago antes de que cuente la mora
  // Provisión de cartera (% del saldo) según antigüedad de atraso
  prov_al_dia: 1,
  prov_1_30: 5,
  prov_31_60: 20,
  prov_61_90: 50,
  prov_90_mas: 100,
  // Solicitudes de préstamo hechas por el socio
  sol_tasa_mensual: 10, // tasa referencial mensual (%) para la cuota estimada
  sol_monto_max: 200000,
  sol_plazo_max: 60,
  sol_pct_ingreso_max: 40, // % del ingreso que no conviene superar con la cuota
  // Recordatorios de pago por correo al socio
  rec_activo: 1, // 1 = se envían solos cada mañana
  rec_dias_antes: 3, // días antes del vencimiento para el aviso previo
  rec_mora_cada: 7, // en mora, repetir cada N días (0 = solo el primer aviso)
  // Ahorro: retención de impuesto sobre los intereses que se pagan a los socios (%)
  aho_retencion_pct: 0,
  // Prevención de lavado: monto en efectivo que genera alerta (0 = el del país)
  aml_umbral: 0,
  // Aprobación de préstamos por niveles: hasta este monto aprueba el personal; por encima, el
  // comité de crédito con el número de votos indicado (0 = sin comité, como siempre)
  aprob_monto_admin: 0,
  aprob_votos_comite: 2,
  // Caja: 1 = para recibir o entregar efectivo, el usuario debe tener su turno de caja abierto
  caja_exigir_turno: 0,
};

let cache = { ...DEFAULTS };

const refrescar = async () => {
  const pool = require("../db");
  try {
    const [rows] = await pool.query(
      "SELECT clave, valor FROM configuracion_sitio WHERE clave LIKE 'fin\\_%'"
    );
    const nuevo = { ...DEFAULTS };
    rows.forEach(({ clave, valor }) => {
      const v = parseFloat(valor);
      if (!isNaN(v)) nuevo[clave.replace("fin_", "")] = v;
    });
    cache = nuevo;
  } catch {
    // la tabla puede no existir todavía: se usan los valores por defecto
  }
};

const obtener = () => cache;

let iniciado = false;
const iniciar = () => {
  if (iniciado) return;
  iniciado = true;
  refrescar();
  setInterval(refrescar, 30 * 1000).unref();
};

module.exports = { obtener, refrescar, iniciar, DEFAULTS };
