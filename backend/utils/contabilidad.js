// Contabilidad de partida doble.
//
// Cada operación (pago, aportación, desembolso, depósito, gasto...) genera su partida sola,
// dentro de la misma transacción. Las cuentas del sistema se identifican por una clave fija
// (caja, cartera, ingreso_intereses...), así el contador puede cambiarles código y nombre.
//
// La contabilidad empieza con la partida de apertura (fecha guardada en configuracion_sitio,
// clave "cont_inicio"). Antes de abrirla no se registra nada.
//
// Ediciones y anulaciones nunca borran partidas: se registra una partida por la diferencia
// entre cómo quedó la operación y cómo estaba (registrarCambio).
const { hoyISO } = require("./fechas");

const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

// ── Catálogo base para cooperativas de ahorro y crédito ────────────────────
// [código, nombre, tipo, clave del sistema (o null), código del padre (o null)]
const CATALOGO_BASE = [
  ["1", "ACTIVO", "activo", null, null],
  ["11", "Disponibilidades", "activo", null, "1"],
  ["1101", "Caja general", "activo", "caja", "11"],
  ["1102", "Bancos", "activo", "bancos", "11"],
  ["12", "Cartera de préstamos", "activo", null, "1"],
  ["1201", "Préstamos a socios", "activo", "cartera", "12"],
  ["1209", "Estimación para préstamos incobrables", "activo", "provision_cartera", "12"],
  ["19", "Otros activos", "activo", null, "1"],
  ["1901", "Partidas pendientes de conciliar", "activo", "transitoria", "19"],
  ["2", "PASIVO", "pasivo", null, null],
  ["21", "Depósitos de socios", "pasivo", null, "2"],
  ["2101", "Ahorro para vivienda", "pasivo", "ahorro_vivienda", "21"],
  ["2102", "Ahorro para pensiones", "pasivo", "ahorro_pensiones", "21"],
  ["2109", "Otros depósitos de socios", "pasivo", "ahorro_otros", "21"],
  ["3", "PATRIMONIO", "patrimonio", null, null],
  ["31", "Capital social", "patrimonio", null, "3"],
  ["3101", "Aportaciones de socios", "patrimonio", "aportaciones", "31"],
  ["3102", "Capital institucional", "patrimonio", "capital_institucional", "31"],
  ["33", "Resultados", "patrimonio", null, "3"],
  ["3301", "Resultados acumulados", "patrimonio", "resultados_acumulados", "33"],
  ["3303", "Excedentes distribuidos a socios", "patrimonio", "distribucion_excedentes", "33"],
  ["4", "INGRESOS", "ingreso", null, null],
  ["41", "Ingresos financieros", "ingreso", null, "4"],
  ["4101", "Intereses sobre préstamos", "ingreso", "ingreso_intereses", "41"],
  ["4102", "Intereses moratorios", "ingreso", "ingreso_mora", "41"],
  ["42", "Otros ingresos", "ingreso", null, "4"],
  ["4201", "Ingresos por actividades", "ingreso", "ingreso_actividades", "42"],
  ["4209", "Otros ingresos", "ingreso", "otros_ingresos", "42"],
  ["5", "GASTOS", "gasto", null, null],
  ["51", "Gastos de administración", "gasto", null, "5"],
  ["5101", "Servicios básicos", "gasto", "gasto_servicios", "51"],
  ["5102", "Salarios y honorarios", "gasto", "gasto_salarios", "51"],
  ["5103", "Alquiler", "gasto", "gasto_alquiler", "51"],
  ["5104", "Papelería y útiles", "gasto", "gasto_papeleria", "51"],
  ["5105", "Transporte y viáticos", "gasto", "gasto_transporte", "51"],
  ["5109", "Otros gastos", "gasto", "gasto_otros", "51"],
  ["52", "Gastos financieros", "gasto", null, "5"],
  ["5201", "Intereses sobre ahorros", "gasto", "gasto_intereses_ahorro", "52"],
];

// Activo y gasto son de naturaleza deudora; pasivo, patrimonio e ingreso, acreedora.
// (Excepciones: la estimación de incobrables resta al activo y los excedentes distribuidos
// restan al patrimonio.)
const naturalezaDe = (tipo, clave) => {
  if (clave === "provision_cartera") return "acreedora";
  if (clave === "distribucion_excedentes") return "deudora";
  return ["activo", "gasto"].includes(tipo) ? "deudora" : "acreedora";
};

const sembrarCatalogo = async (conn) => {
  for (const [codigo, nombre, tipo, clave, padre] of CATALOGO_BASE) {
    const [[existe]] = await conn.query(
      "SELECT id_cuenta_contable FROM cuentas_contables WHERE codigo = ? OR (clave IS NOT NULL AND clave = ?)",
      [codigo, clave]
    );
    if (existe) continue;
    let idPadre = null;
    if (padre) {
      const [[p]] = await conn.query("SELECT id_cuenta_contable FROM cuentas_contables WHERE codigo = ?", [padre]);
      idPadre = p ? p.id_cuenta_contable : null;
    }
    await conn.query(
      `INSERT INTO cuentas_contables (codigo, nombre, tipo, naturaleza, clave, id_padre, acepta_movimientos)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [codigo, nombre, tipo, naturalezaDe(tipo, clave), clave, idPadre, codigo.length >= 4 ? 1 : 0]
    );
  }
};

// ── Cuentas según la operación ─────────────────────────────────────────────
// Efectivo a caja; transferencia, cheque o depósito bancario a bancos
const medio = (metodo) => (String(metodo || "efectivo").toLowerCase() === "efectivo" ? "caja" : "bancos");

// Cuentas de los socios: Aportaciones es capital social; Vivienda y Pensiones son ahorro
const cuentaDeSocio = (tipoCuenta) => {
  const t = String(tipoCuenta || "").toLowerCase();
  if (t === "aportaciones") return "aportaciones";
  if (t === "vivienda") return "ahorro_vivienda";
  if (t === "pensiones") return "ahorro_pensiones";
  return "ahorro_otros";
};

// Líneas de cada tipo de operación: [{ clave, debe, haber }]. Montos ya redondeados.
const L = (clave, debe, haber) => ({ clave, debe: r2(debe || 0), haber: r2(haber || 0) });

const lineasDe = (tipo, d) => {
  const monto = r2(d.monto);
  switch (tipo) {
    case "pago_prestamo": {
      const capital = r2(d.capital);
      const interes = r2(d.interes);
      const mora = r2(monto - capital - interes);
      return [L(medio(d.metodo), monto), L("cartera", 0, capital), L("ingreso_intereses", 0, interes), L("ingreso_mora", 0, mora)];
    }
    case "desembolso_prestamo":
      return [L("cartera", monto), L(d.metodo === "cuenta" ? cuentaDeSocio(d.tipo_cuenta) : medio(d.metodo), 0, monto)];
    case "deposito_socio": // aportación o depósito de ahorro
      return [L(medio(d.metodo), monto), L(cuentaDeSocio(d.tipo_cuenta), 0, monto)];
    case "retiro_socio":
      return [L(cuentaDeSocio(d.tipo_cuenta), monto), L(medio(d.metodo), 0, monto)];
    case "transferencia_socio":
      return [L(cuentaDeSocio(d.tipo_origen), monto), L(cuentaDeSocio(d.tipo_destino), 0, monto)];
    case "gasto":
      return [L(`gasto_${d.categoria}`, monto), L(medio(d.metodo), 0, monto)];
    case "ingreso_caja": {
      const contra = { saldo_inicial: "resultados_acumulados", capital: "capital_institucional" }[d.categoria] || "otros_ingresos";
      return [L(medio(d.metodo), monto), L(contra, 0, monto)];
    }
    case "actividad":
      return [L(medio(d.metodo), monto), L("ingreso_actividades", 0, monto)];
    case "liquidacion_socio": // reparto de excedentes de una actividad a la cuenta del socio
      return [L("distribucion_excedentes", monto), L(cuentaDeSocio(d.tipo_cuenta), 0, monto)];
    case "consolidacion": {
      // El préstamo nuevo absorbe el capital de los anteriores más el interés y la mora capitalizados
      const capital = r2(d.capital);
      const interes = r2(d.interes);
      const mora = r2(d.mora);
      return [L("cartera", capital + interes + mora), L("cartera", 0, capital), L("ingreso_intereses", 0, interes), L("ingreso_mora", 0, mora)];
    }
    case "ajuste_socio": // ajuste manual de saldo de una cuenta del socio (sin dinero de por medio)
      return monto >= 0
        ? [L("transitoria", monto), L(cuentaDeSocio(d.tipo_cuenta), 0, monto)]
        : [L(cuentaDeSocio(d.tipo_cuenta), -monto), L("transitoria", 0, -monto)];
    default:
      throw new Error(`Operación contable desconocida: ${tipo}`);
  }
};

// ── Estado de la contabilidad ──────────────────────────────────────────────
const fechaInicio = async (conn) => {
  const [[f]] = await conn.query("SELECT valor FROM configuracion_sitio WHERE clave = 'cont_inicio'");
  return f ? f.valor : null;
};

const idsDeClaves = async (conn, claves) => {
  const [rows] = await conn.query("SELECT id_cuenta_contable, clave FROM cuentas_contables WHERE clave IN (?)", [claves]);
  return Object.fromEntries(rows.map((r) => [r.clave, r.id_cuenta_contable]));
};

// Junta las líneas por cuenta (debe - haber) y quita las que quedan en cero
const neto = (lineas) => {
  const m = new Map();
  for (const l of lineas) {
    const k = l.id_cuenta_contable ? `id:${l.id_cuenta_contable}` : `clave:${l.clave}`;
    m.set(k, r2((m.get(k) || 0) + r2(l.debe) - r2(l.haber)));
  }
  return [...m.entries()]
    .filter(([, v]) => Math.abs(v) >= 0.005)
    .map(([k, v]) => {
      const [tipo, valor] = k.split(/:(.*)/s);
      return { ...(tipo === "id" ? { id_cuenta_contable: Number(valor) } : { clave: valor }), debe: v > 0 ? v : 0, haber: v < 0 ? -v : 0 };
    });
};

// Registra una partida balanceada. Devuelve su id, o null si la contabilidad no ha empezado
// o si las líneas se anulan entre sí. `forzar` la registra aunque no haya empezado (apertura).
const registrarPartida = async (conn, { fecha, concepto, origen, origen_id = null, lineas, creada_por = null, forzar = false }) => {
  const inicio = await fechaInicio(conn);
  if (!inicio && !forzar) return null;
  const dia = fecha ? String(fecha).substring(0, 10) : hoyISO();
  if (inicio && dia < inicio && !forzar) return null;

  const netas = neto(lineas);
  if (!netas.length) return null;
  const debe = r2(netas.reduce((t, l) => t + l.debe, 0));
  const haber = r2(netas.reduce((t, l) => t + l.haber, 0));
  if (Math.abs(debe - haber) >= 0.005) {
    throw new Error(`La partida no cuadra: debe ${debe.toFixed(2)} y haber ${haber.toFixed(2)} (${concepto}).`);
  }

  const claves = [...new Set(netas.filter((l) => l.clave).map((l) => l.clave))];
  const ids = claves.length ? await idsDeClaves(conn, claves) : {};
  for (const c of claves) if (!ids[c]) throw new Error(`Falta la cuenta contable del sistema "${c}".`);

  // Número correlativo de partida (bloqueo para que dos operaciones no tomen el mismo)
  await conn.query("SELECT valor FROM configuracion_sitio WHERE clave = 'cont_inicio' FOR UPDATE");
  const [[{ siguiente }]] = await conn.query("SELECT COALESCE(MAX(numero), 0) + 1 AS siguiente FROM partidas");
  const [p] = await conn.query(
    `INSERT INTO partidas (numero, fecha, concepto, origen, origen_id, total, creada_por) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [siguiente, dia, String(concepto).substring(0, 255), origen, origen_id, debe, creada_por]
  );
  for (const l of netas) {
    await conn.query(
      `INSERT INTO partida_lineas (id_partida, id_cuenta_contable, debe, haber) VALUES (?, ?, ?, ?)`,
      [p.insertId, l.id_cuenta_contable || ids[l.clave], l.debe, l.haber]
    );
  }
  return p.insertId;
};

// Partida de una operación por tipo (ver lineasDe)
const contabilizar = (conn, tipo, datos, { fecha, concepto, origen, origen_id, creada_por } = {}) =>
  registrarPartida(conn, { fecha, concepto, origen: origen || tipo, origen_id, lineas: lineasDe(tipo, datos), creada_por });

// Edición o anulación: partida por la diferencia entre cómo quedó y cómo estaba.
// antes/despues: { tipo, datos }, una lista de ellos (una edición que recalcula varios pagos)
// o null (no existía / ya no existe).
const lineasDeVarias = (ops) => (ops ? [].concat(ops) : []).flatMap((o) => lineasDe(o.tipo, o.datos));
const registrarCambio = (conn, { antes, despues, fecha, concepto, origen, origen_id, creada_por }) => {
  const lineasAntes = lineasDeVarias(antes);
  const lineasDespues = lineasDeVarias(despues);
  const lineas = [
    ...lineasDespues,
    ...lineasAntes.map((l) => ({ ...l, debe: l.haber, haber: l.debe })), // se invierte lo anterior
  ];
  return registrarPartida(conn, { fecha, concepto, origen, origen_id, lineas, creada_por });
};

// Registra la partida sin poner en riesgo la operación del socio: si falla (por ejemplo,
// alguien desactivó una cuenta del sistema), se deshace solo la partida (SAVEPOINT), queda
// anotada en contabilidad_errores para el contador y la operación sigue.
// `conn` debe estar dentro de una transacción.
const conSalvaguarda = async (conn, info, fn) => {
  let punto = false;
  try {
    await conn.query("SAVEPOINT partida_contable");
    punto = true;
    return await fn();
  } catch (error) {
    if (punto) await conn.query("ROLLBACK TO SAVEPOINT partida_contable").catch(() => {});
    console.error(`⚠️  Partida contable no registrada (${info.concepto}):`, error.message);
    await conn
      .query(
        `INSERT INTO contabilidad_errores (origen, origen_id, concepto, error) VALUES (?, ?, ?, ?)`,
        [info.origen || null, info.origen_id || null, String(info.concepto || "").substring(0, 255), String(error.message).substring(0, 500)]
      )
      .catch(() => {});
    return null;
  }
};

module.exports = {
  conSalvaguarda,
  CATALOGO_BASE,
  sembrarCatalogo,
  medio,
  cuentaDeSocio,
  lineasDe,
  neto,
  fechaInicio,
  registrarPartida,
  contabilizar,
  registrarCambio,
};
