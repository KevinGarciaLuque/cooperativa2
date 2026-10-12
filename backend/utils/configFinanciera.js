// Parámetros financieros configurables por el Super Administrador.
// Se guardan en configuracion_sitio con prefijo "fin_" y se mantienen en caché.
const pool = require("../db");

const DEFAULTS = {
  mora_tasa_anual: 24, // 24% anual = 2% mensual
  mora_dias_gracia: 30, // días desde el último pago antes de que cuente la mora
};

let cache = { ...DEFAULTS };

const refrescar = async () => {
  try {
    const [rows] = await pool.query(
      "SELECT clave, valor FROM configuracion_sitio WHERE clave IN ('fin_mora_tasa_anual','fin_mora_dias_gracia')"
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
