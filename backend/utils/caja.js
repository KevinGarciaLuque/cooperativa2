// Registro en el libro de caja. Se llama dentro de la misma transacción de la
// operación (pago, aportación, desembolso...). Si el libro no existe todavía,
// el error se registra pero no se interrumpe la operación principal.
//
// Cada movimiento genera además su partida contable (utils/contabilidad.js). Las ediciones y
// anulaciones (ajuste_*, anulacion_pago, anulacion_aportacion...) no: esas rutas registran
// la partida por la diferencia con registrarCambio, porque saben cómo estaba la operación.
const { contabilizar, registrarCambio, conSalvaguarda } = require("./contabilidad");
const { evaluarMovimiento } = require("./cumplimiento");
const { sucursalOperacion } = require("./sucursal");

// debito_ahorro: el socio pagó desde su cuenta de ahorro en la app (no pasa por la caja física)
const METODOS = ["efectivo", "transferencia", "cheque", "deposito", "debito_ahorro"];

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

// Turno de caja abierto del usuario (o null)
const turnoAbierto = async (conn, idUsuario) => {
  if (!idUsuario) return null;
  try {
    const [[t]] = await conn.query(
      "SELECT id_turno, id_sucursal FROM cajas_turnos WHERE id_cajero = ? AND estado = 'abierto' ORDER BY id_turno DESC LIMIT 1",
      [idUsuario]
    );
    return t || null;
  } catch {
    return null; // la tabla aún no existe
  }
};

const registrarCaja = async (conn, mov) => {
  let id = null;
  try {
    // El movimiento queda en el turno abierto de quien lo registra (si tiene uno)
    const turno = await turnoAbierto(conn, mov.id_registrado_por);
    // Y en la sucursal donde se hizo (turno, sucursal de quien registra, la del socio o la principal)
    const idSucursal = await sucursalOperacion(conn, mov.id_registrado_por, mov.id_socio, turno);
    const [r] = await conn.query(
      `INSERT INTO caja_movimientos
         (fecha, tipo, categoria, monto, metodo, descripcion, referencia_tipo, referencia_id, id_socio, id_registrado_por, id_turno, id_sucursal)
       VALUES (COALESCE(?, NOW()), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        turno?.id_turno || null,
        idSucursal || null,
      ]
    );
    id = r.insertId;
  } catch (error) {
    console.error("No se pudo registrar el movimiento de caja:", error.message);
  }
  if (mov.contable !== false) await contabilizarMovimiento(conn, mov, id);
  // Prevención de lavado: alertas para el oficial de cumplimiento (nunca detienen la operación)
  if (id && mov.id_socio && !/^(anulacion|ajuste)_/.test(mov.categoria)) {
    try {
      await conn.query("SAVEPOINT alerta_cumplimiento");
      await evaluarMovimiento(conn, mov, id);
    } catch (error) {
      await conn.query("ROLLBACK TO SAVEPOINT alerta_cumplimiento").catch(() => {});
      console.error("No se pudo evaluar la alerta de cumplimiento:", error.message);
    }
  }
  return id;
};

module.exports = {
  turnoAbierto,
  registrarCaja,
  normalizarMetodo,
};
