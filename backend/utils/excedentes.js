// Distribución de los excedentes de un ejercicio (año) ya terminado.
//
// Excedente = ingresos − gastos del año según la contabilidad (o un monto escrito a mano si la
// contabilidad no estaba abierta ese año). Primero se separan las reservas (porcentajes de los
// estatutos) y el resto se reparte entre los socios: una parte según sus aportaciones y otra
// según los intereses que pagaron en el año. Cada socio recibe su parte en su cuenta de
// aportaciones. Se aplica una sola vez por año y queda la partida de cierre del ejercicio.
const pool = require("../db");
const { fechaInicio, registrarPartida, conSalvaguarda } = require("./contabilidad");
const { crearNotificacion } = require("./notificaciones");
const { dinero } = require("./pais");

const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const num = (v) => parseFloat(v || 0);

const RESERVAS_BASE = [
  { clave: "reserva_legal", nombre: "Reserva legal", pct: 10 },
  { clave: "fondo_educacion", nombre: "Fondo de educación", pct: 5 },
  { clave: "fondo_prevision", nombre: "Fondo de previsión social", pct: 5 },
];
const CLAVES_RESERVA = ["reserva_legal", "fondo_educacion", "fondo_prevision", "otras_reservas"];

// Reparte `total` en proporción a `pesos` (centavos exactos: el redondeo va al mayor)
const repartir = (total, pesos) => {
  const suma = pesos.reduce((t, p) => t + Math.max(0, p), 0);
  if (!(total > 0) || !(suma > 0)) return pesos.map(() => 0);
  const partes = pesos.map((p) => r2((total * Math.max(0, p)) / suma));
  const diferencia = r2(total - partes.reduce((t, p) => t + p, 0));
  if (diferencia !== 0) {
    const i = pesos.indexOf(Math.max(...pesos));
    partes[i] = r2(partes[i] + diferencia);
  }
  return partes;
};

// Ingresos y gastos acumulados hasta el fin del año, por cuenta (lo que cierra el ejercicio)
const resultadosDelAnio = async (conn, anio) => {
  const [rows] = await conn.query(
    `SELECT c.id_cuenta_contable, c.tipo, c.naturaleza, IFNULL(SUM(l.debe), 0) AS d, IFNULL(SUM(l.haber), 0) AS h
     FROM cuentas_contables c
     INNER JOIN partida_lineas l ON l.id_cuenta_contable = c.id_cuenta_contable
     INNER JOIN partidas p ON p.id_partida = l.id_partida AND p.fecha <= ?
     WHERE c.tipo IN ('ingreso','gasto') GROUP BY c.id_cuenta_contable`,
    [`${anio}-12-31`]
  );
  const cuentas = rows.map((r) => ({ ...r, saldo: r2(r.naturaleza === "deudora" ? num(r.d) - num(r.h) : num(r.h) - num(r.d)) }));
  const ingresos = r2(cuentas.filter((c) => c.tipo === "ingreso").reduce((t, c) => t + c.saldo, 0));
  const gastos = r2(cuentas.filter((c) => c.tipo === "gasto").reduce((t, c) => t + c.saldo, 0));
  return { cuentas, ingresos, gastos, excedente: r2(ingresos - gastos) };
};

const normalizarParametros = (p = {}) => {
  const reservas = (Array.isArray(p.reservas) ? p.reservas : RESERVAS_BASE)
    .map((r) => ({ clave: CLAVES_RESERVA.includes(r.clave) ? r.clave : "otras_reservas", nombre: String(r.nombre || "Reserva").substring(0, 60), pct: num(r.pct) }))
    .filter((r) => r.pct > 0);
  const pctAportaciones = p.pct_aportaciones === undefined || p.pct_aportaciones === "" ? 50 : num(p.pct_aportaciones);
  return { reservas, pct_aportaciones: pctAportaciones, monto_manual: p.monto_manual === undefined || p.monto_manual === "" ? null : num(p.monto_manual) };
};

// Vista previa: nada se guarda
const simularExcedentes = async (anio, parametros, conn = pool) => {
  const p = normalizarParametros(parametros);
  const pctReservas = p.reservas.reduce((t, r) => t + r.pct, 0);
  if (pctReservas > 100) throw Object.assign(new Error("Las reservas no pueden sumar más del 100%."), { codigo: 400 });
  if (p.pct_aportaciones < 0 || p.pct_aportaciones > 100) throw Object.assign(new Error("El porcentaje por aportaciones va de 0 a 100."), { codigo: 400 });

  const inicio = await fechaInicio(conn);
  const conContabilidad = Boolean(inicio) && inicio <= `${anio}-12-31`;
  let excedente;
  let origen;
  if (p.monto_manual !== null) {
    excedente = r2(p.monto_manual);
    origen = "manual";
  } else if (conContabilidad) {
    excedente = (await resultadosDelAnio(conn, anio)).excedente;
    origen = "contabilidad";
  } else {
    throw Object.assign(new Error("La contabilidad no estaba abierta ese año: escribe el excedente a distribuir."), { codigo: 400 });
  }

  const reservas = p.reservas.map((r) => ({ ...r, monto: excedente > 0 ? r2((excedente * r.pct) / 100) : 0 }));
  const distribuible = r2(Math.max(0, excedente - reservas.reduce((t, r) => t + r.monto, 0)));
  const porAportaciones = r2((distribuible * p.pct_aportaciones) / 100);
  const porIntereses = r2(distribuible - porAportaciones);

  // Socios activos: saldo de aportaciones e intereses que pagaron en el año
  const [socios] = await conn.query(
    `SELECT u.id_usuario, u.nombre_completo, u.numero_socio,
            (SELECT IFNULL(SUM(c.saldo_actual), 0) FROM cuentas c WHERE c.id_usuario = u.id_usuario AND c.tipo_cuenta = 'Aportaciones' AND c.estado = 'activa') AS base_aportaciones,
            (SELECT IFNULL(SUM(pg.monto_interes), 0) FROM pagos_prestamo pg INNER JOIN prestamos pr ON pr.id_prestamo = pg.id_prestamo
              WHERE pr.id_usuario = u.id_usuario AND YEAR(pg.fecha_pago) = ?) AS base_intereses
     FROM usuarios u INNER JOIN roles r ON r.id_rol = u.rol_id AND r.nombre = 'Socio'
     WHERE u.estado = 'activo' ORDER BY u.numero_socio, u.nombre_completo`,
    [anio]
  );
  const ap = repartir(porAportaciones, socios.map((s) => num(s.base_aportaciones)));
  const it = repartir(porIntereses, socios.map((s) => num(s.base_intereses)));
  const filas = socios
    .map((s, i) => ({
      id_usuario: s.id_usuario,
      socio: s.nombre_completo,
      numero_socio: s.numero_socio,
      base_aportaciones: r2(s.base_aportaciones),
      base_intereses: r2(s.base_intereses),
      por_aportaciones: ap[i],
      por_intereses: it[i],
      total: r2(ap[i] + it[i]),
    }))
    .filter((f) => f.total > 0);
  // Si nadie tiene base para una de las partes, esa parte no se reparte (queda en resultados)
  const repartido = r2(filas.reduce((t, f) => t + f.total, 0));
  return { anio, origen, excedente, reservas, distribuible, por_aportaciones: porAportaciones, por_intereses: porIntereses, repartido, pct_aportaciones: p.pct_aportaciones, socios: filas };
};

// Aplica la distribución (una sola vez por año)
const aplicarExcedentes = async (anio, parametros, idUsuario) => {
  const hoy = new Date().getFullYear();
  if (!(anio < hoy)) throw Object.assign(new Error("Solo se distribuyen los excedentes de un año ya terminado."), { codigo: 400 });
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [[ya]] = await conn.query("SELECT id_ejercicio FROM excedentes_ejercicio WHERE anio = ? FOR UPDATE", [anio]);
    if (ya) throw Object.assign(new Error(`Los excedentes de ${anio} ya se distribuyeron.`), { codigo: 409 });
    const s = await simularExcedentes(anio, parametros, conn);
    if (!(s.excedente > 0)) throw Object.assign(new Error("Ese año no hubo excedente que distribuir."), { codigo: 400 });

    const [e] = await conn.query(
      `INSERT INTO excedentes_ejercicio (anio, origen, excedente, reservas, pct_aportaciones, por_aportaciones, por_intereses, repartido, aplicado_por)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [anio, s.origen, s.excedente, JSON.stringify(s.reservas), s.pct_aportaciones, s.por_aportaciones, s.por_intereses, s.repartido, idUsuario]
    );
    for (const f of s.socios) {
      await conn.query(
        `INSERT INTO excedentes_socios (id_ejercicio, id_usuario, base_aportaciones, base_intereses, por_aportaciones, por_intereses, total) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [e.insertId, f.id_usuario, f.base_aportaciones, f.base_intereses, f.por_aportaciones, f.por_intereses, f.total]
      );
      const [[c]] = await conn.query(
        `SELECT id_cuenta, saldo_actual FROM cuentas WHERE id_usuario = ? AND tipo_cuenta = 'Aportaciones' AND estado = 'activa' ORDER BY id_cuenta LIMIT 1 FOR UPDATE`,
        [f.id_usuario]
      );
      if (!c) throw Object.assign(new Error(`${f.socio} no tiene una cuenta de aportaciones activa.`), { codigo: 400 });
      const nuevo = r2(num(c.saldo_actual) + f.total);
      await conn.query("UPDATE cuentas SET saldo_actual = ? WHERE id_cuenta = ?", [nuevo, c.id_cuenta]);
      await conn.query(
        `INSERT INTO movimientos_cuenta (id_cuenta, tipo_movimiento, monto, saldo_anterior, saldo_nuevo, descripcion, fecha)
         VALUES (?, 'excedente', ?, ?, ?, ?, NOW())`,
        [c.id_cuenta, f.total, num(c.saldo_actual), nuevo, `Excedentes del ejercicio ${anio}`]
      );
    }

    // Contabilidad: cierre de ingresos y gastos contra el excedente del ejercicio, y su distribución
    if (s.origen === "contabilidad") {
      const inicio = await fechaInicio(conn);
      const fecha = `${anio}-12-31` >= inicio ? `${anio}-12-31` : inicio;
      const { cuentas } = await resultadosDelAnio(conn, anio);
      const cierre = cuentas
        .filter((c) => Math.abs(c.saldo) >= 0.005)
        .map((c) => (c.tipo === "ingreso"
          ? { id_cuenta_contable: c.id_cuenta_contable, debe: c.saldo, haber: 0 }
          : { id_cuenta_contable: c.id_cuenta_contable, debe: 0, haber: c.saldo }));
      cierre.push({ clave: "resultado_ejercicio", debe: 0, haber: s.excedente });
      await conSalvaguarda(conn, { concepto: `Cierre del ejercicio ${anio}`, origen: "cierre_ejercicio", origen_id: anio }, async () => {
        await registrarPartida(conn, { fecha, concepto: `Cierre del ejercicio ${anio}`, origen: "cierre_ejercicio", origen_id: anio, lineas: cierre, creada_por: idUsuario });
        await registrarPartida(conn, {
          fecha,
          concepto: `Distribución de los excedentes del ejercicio ${anio}`,
          origen: "excedentes",
          origen_id: anio,
          lineas: [
            { clave: "resultado_ejercicio", debe: r2(s.reservas.reduce((t, r) => t + r.monto, 0) + s.repartido), haber: 0 },
            ...s.reservas.map((r) => ({ clave: r.clave, debe: 0, haber: r.monto })),
            { clave: "aportaciones", debe: 0, haber: s.repartido },
          ],
          creada_por: idUsuario,
        });
      });
    }
    await conn.query(`INSERT INTO bitacora (id_usuario, accion, detalle, fecha) VALUES (?, ?, ?, NOW())`, [
      idUsuario,
      "Distribución de excedentes",
      `Ejercicio ${anio}: excedente ${dinero(s.excedente)}, reservas ${dinero(s.reservas.reduce((t, r) => t + r.monto, 0))}, repartido a ${s.socios.length} socio(s) ${dinero(s.repartido)}`,
    ]);
    await conn.commit();
    for (const f of s.socios) {
      crearNotificacion(f.id_usuario, {
        titulo: `Excedentes del ${anio}`,
        mensaje: `Te acreditamos ${dinero(f.total)} de los excedentes del ejercicio ${anio} en tu cuenta de aportaciones.`,
        tipo: "aviso",
      });
    }
    return s;
  } catch (error) {
    await conn.rollback().catch(() => {});
    throw error;
  } finally {
    conn.release();
  }
};

module.exports = { RESERVAS_BASE, repartir, resultadosDelAnio, simularExcedentes, aplicarExcedentes };
