// Con "caja_exigir_turno" activado (Parámetros), recibir o entregar efectivo exige que quien lo
// registra tenga su turno de caja abierto. Por transferencia, cheque, depósito o desde una cuenta
// no hace falta. Desactivado (lo predeterminado), todo funciona como siempre.
const pool = require("../db");
const config = require("../utils/configFinanciera");
const { turnoAbierto } = require("../utils/caja");

// Operaciones que mueven efectivo de la caja
const RUTAS = [
  /^\/pagos$/,
  /^\/aportaciones$/,
  /^\/movimientos$/,
  /^\/actividades$/,
  /^\/prestamos\/\d+\/desembolsar$/,
  /^\/caja\/(gasto|ingreso)$/,
  /^\/ahorro\/plazos(\/\d+\/pagar)?$/,
];

const esEfectivo = (body = {}) => {
  const medio = body.metodo ?? body.metodo_pago ?? body.destino ?? body.origen;
  return medio == null || medio === "" || String(medio).toLowerCase() === "efectivo";
};

const exigirTurno = async (req, res, next) => {
  try {
    if (req.method !== "POST" || !req.usuario || req.usuario.rol === "Socio") return next();
    if (!parseInt(config.obtener().caja_exigir_turno)) return next();
    if (!RUTAS.some((r) => r.test(req.path))) return next();
    if (!esEfectivo(req.body)) return next();
    if (await turnoAbierto(pool, req.usuario.id_usuario)) return next();
    return res.status(409).json({
      message: "Abre tu turno de caja (Caja → Mi turno) para recibir o entregar efectivo.",
      requiere_turno: true,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { exigirTurno };
