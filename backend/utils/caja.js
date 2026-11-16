// Registro en el libro de caja. Se llama dentro de la misma transacción de la
// operación (pago, aportación, desembolso...). Si el libro no existe todavía,
// el error se registra pero no se interrumpe la operación principal.
//
// Cada movimiento genera además su partida contable (utils/contabilidad.js). Las ediciones y
// anulaciones (ajuste_*, anulacion_pago, anulacion_aportacion...) no: esas rutas registran
// la partida por la diferencia con registrarCambio, porque saben cómo estaba la operación.
const { contabilizar, registrarCambio, conSalvaguarda } = require("./contabilidad");

const METODOS = ["efectivo", "transferencia", "cheque", "deposito"];

const normalizarMetodo = (m) => {
  const v = String(m || "efectivo").toLowerCase();
  return METODOS.includes(v) ? v : "efectivo";
};

// Qué partida le corresponde a un movimiento de caja: [tipo, datos] o null
const operacionContable = async (conn, mov) => {
  const c = mov.categoria;
  const base = { monto: Math.abs(parseFloat(mov.monto)), metodo: normalizarMetodo(mov.metodo) };
  const tipoCuenta = mov.contable?.tipo_cuenta;
  if (c === "pago_prestamo") {
    const [[p]] = await conn.query("SELECT monto_capital, monto_interes FROM pagos_prestamo WHERE id_pago = ?", [mov.referencia_id]);
    if (!p) throw new Error(`No se encontró el pago #${mov.referencia_id} para su partida.`);
    return ["pago_prestamo", { ...base, capital: p.monto_capital, interes: p.monto_interes }];
  }
  if (c === "desembolso_prestamo") return ["desembolso_prestamo", base];
  if (c === "anulacion_desembolso") return ["anulacion", { tipo: "desembolso_prestamo", datos: base }];
  if (c === "aportacion" || c === "deposito_ahorro") return ["deposito_socio", { ...base, tipo_cuenta: tipoCuenta || "Aportaciones" }];
  if (c === "retiro_ahorro") return ["retiro_socio", { ...base, tipo_cuenta: tipoCuenta }];
  if (c === "actividad") return ["actividad", base];
  if (c === "apertura_plazo") return ["apertura_plazo", base];
  if (c === "pago_plazo") return ["pago_plazo", { ...base, ...mov.contable }]; // capital, interés y retención
  if (c.startsWith("gasto_")) return ["gasto", { ...base, categoria: c.substring(6) }];
  if (c.startsWith("ingreso_")) return ["ingreso_caja", { ...base, categoria: c.substring(8) }];
  return null;
};

const contabilizarMovimiento = (conn, mov, idMovimiento) => {
  const info = {
    concepto: mov.descripcion || mov.categoria,
    origen: mov.referencia_tipo || "caja",
    origen_id: mov.referencia_id || idMovimiento,
  };
  return conSalvaguarda(conn, info, async () => {
    const op = await operacionContable(conn, mov);
    if (!op) return null;
    const opciones = { ...info, fecha: mov.fecha, creada_por: mov.id_registrado_por };
    if (op[0] === "anulacion") return registrarCambio(conn, { ...opciones, antes: op[1], despues: null });
    return contabilizar(conn, op[0], op[1], opciones);
  });
};

const registrarCaja = async (conn, mov) => {
  let id = null;
  try {
    const [r] = await conn.query(
      `INSERT INTO caja_movimientos
         (fecha, tipo, categoria, monto, metodo, descripcion, referencia_tipo, referencia_id, id_socio, id_registrado_por)
       VALUES (COALESCE(?, NOW()), ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        mov.fecha || null,
        mov.tipo,
        mov.categoria,
        Math.abs(parseFloat(mov.monto)),
        normalizarMetodo(mov.metodo),
        mov.descripcion ? String(mov.descripcion).substring(0, 255) : null,
        mov.referencia_tipo || null,
        mov.referencia_id || null,
        mov.id_socio || null,
        mov.id_registrado_por || null,
      ]
    );
    id = r.insertId;
  } catch (error) {
    console.error("No se pudo registrar el movimiento de caja:", error.message);
  }
  if (mov.contable !== false) await contabilizarMovimiento(conn, mov, id);
  return id;
};

module.exports = { registrarCaja, normalizarMetodo };
