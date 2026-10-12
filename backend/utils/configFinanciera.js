// Parámetros financieros configurables por el Super Administrador.
// Se guardan en configuracion_sitio con prefijo "fin_" y se mantienen en caché.
const pool = require("../db");

const DEFAULTS = {
  mora_tasa_anual: 24, // 24% anual = 2% mensual
  mora_dias_gracia: 30, // días desde el último pago antes de que cuente la mora
  // Provisión de cartera (% del saldo) según antigüedad de atraso
  prov_al_dia: 1,
  prov_1_30: 5,
  prov_31_60: 20,
  prov_61_90: 50,
  prov_90_mas: 100,
};

let cache = { ...DEFAULTS };

const refrescar = async () => {
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

refrescar();
setInterval(refrescar, 30 * 1000).unref();

module.exports = { obtener, refrescar, DEFAULTS };
