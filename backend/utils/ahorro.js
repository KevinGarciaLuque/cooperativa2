// Ahorro: productos, intereses sobre el saldo promedio diario y depósitos a plazo fijo.
//
// Intereses: cada noche se guarda la foto del saldo de cada cuenta (saldos_diarios). Al cerrar
// un mes, el interés de cada cuenta es: saldo promedio diario × tasa anual × días del mes / 365.
// Se acredita el día 1 del mes siguiente (o a mano), una sola vez por cuenta y mes, con su
// movimiento en la cuenta y su partida contable. La tasa la define el producto de ahorro; con
// tasa 0 no se acredita nada.
//
// Plazo fijo: interés simple, base 365, que se paga al vencimiento junto con el capital. Si se
// retira antes, se paga el interés de los días transcurridos menos la penalización del producto.
const cron = require("node-cron");
const pool = require("../db");
const config = require("./configFinanciera");
const { hoyISO, zona } = require("./fechas");
const { diasEntre } = require("./calculosPrestamo");
const { contabilizar, conSalvaguarda } = require("./contabilidad");

const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const num = (v) => parseFloat(v || 0);
const pad = (n) => String(n).padStart(2, "0");

const diasDelMes = (anio, mes) => new Date(Date.UTC(anio, mes, 0)).getUTCDate();

// Saldo promedio diario del mes. `fotos`: [{ fecha: "YYYY-MM-DD", saldo }] ordenadas, que pueden
// incluir días anteriores al mes. Un día sin foto toma el saldo de la última foto anterior; los
// días antes de la primera foto toman esa primera foto; sin ninguna foto se usa `respaldo`.
const saldoPromedio = (fotos, anio, mes, respaldo = 0) => {
  const dias = diasDelMes(anio, mes);
  const prefijo = `${anio}-${pad(mes)}-`;
  if (!fotos.length) return { promedio: r2(respaldo), dias, dias_con_foto: 0 };
  let i = 0;
  let actual = num(fotos[0].saldo);
  let suma = 0;
  let conFoto = 0;
  for (let d = 1; d <= dias; d++) {
    const dia = `${prefijo}${pad(d)}`;
    while (i < fotos.length && fotos[i].fecha <= dia) {
      actual = num(fotos[i].saldo);
      if (fotos[i].fecha === dia) conFoto++;
      i++;
    }
    suma += actual;
  }
  return { promedio: r2(suma / dias), dias, dias_con_foto: conFoto };
};

const interesDelMes = ({ promedio, tasaAnual, dias, retencionPct = 0 }) => {
  const bruto = promedio > 0 ? r2((promedio * num(tasaAnual)) / 100 * dias / 365) : 0;
  const retencion = r2((bruto * num(retencionPct)) / 100);
  return { bruto, retencion, neto: r2(bruto - retencion) };
};

// Lo que corresponde pagar de un plazo fijo hoy (o en `hoy`)
const liquidacionPlazo = (d, hoy = hoyISO()) => {
  const monto = num(d.monto);
  const tasa = num(d.tasa_anual);
  const inicio = String(d.fecha_inicio).substring(0, 10);
  const vence = String(d.fecha_vencimiento).substring(0, 10);
  const anticipado = hoy < vence;
  const dias = anticipado ? Math.max(0, diasEntre(inicio, hoy)) : parseInt(d.plazo_dias);
  const devengado = r2((monto * tasa) / 100 * dias / 365);
  const penalizacion = anticipado ? r2((devengado * num(d.penalizacion_pct)) / 100) : 0;
  const interes = r2(devengado - penalizacion);
  const retencion = r2((interes * num(config.obtener().aho_retencion_pct)) / 100);
  return { anticipado, dias, interes_devengado: devengado, penalizacion, interes, retencion, total: r2(monto + interes - retencion), capital: monto };
};

const sumarDias = (iso, dias) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + dias)).toISOString().substring(0, 10);
};

// ── Fotos diarias ──────────────────────────────────────────────────────────
const registrarSaldosDelDia = async (fecha = hoyISO(), conn = pool) => {
  const [r] = await conn.query(
    `INSERT INTO saldos_diarios (id_cuenta, fecha, saldo)
     SELECT id_cuenta, ?, saldo_actual FROM cuentas WHERE estado = 'activa'
     ON DUPLICATE KEY UPDATE saldo = VALUES(saldo)`,
    [fecha]
  );
  return r.affectedRows;
};

// ── Intereses del mes ──────────────────────────────────────────────────────
// Cuentas que ganan interés en ese mes, con lo que les toca. No acredita nada.
const previaIntereses = async (anio, mes, conn = pool) => {
  const inicio = `${anio}-${pad(mes)}-01`;
  const fin = `${anio}-${pad(mes)}-${pad(diasDelMes(anio, mes))}`;
  const [cuentas] = await conn.query(
    `SELECT c.id_cuenta, c.id_usuario, c.tipo_cuenta, c.saldo_actual, p.tasa_anual, u.nombre_completo,
            (SELECT COUNT(*) FROM intereses_ahorro i WHERE i.id_cuenta = c.id_cuenta AND i.anio = ? AND i.mes = ?) AS ya
     FROM cuentas c
     INNER JOIN productos_ahorro p ON p.id_producto_ahorro = c.id_producto_ahorro
     INNER JOIN usuarios u ON u.id_usuario = c.id_usuario
     WHERE c.estado = 'activa' AND p.tasa_anual > 0 AND p.clase <> 'plazo_fijo'
     ORDER BY u.nombre_completo`,
    [anio, mes]
  );
  if (!cuentas.length) return [];
  // Fotos del mes más la última anterior (para los primeros días sin foto)
  const [fotos] = await conn.query(
    `SELECT s.id_cuenta, DATE_FORMAT(s.fecha, '%Y-%m-%d') AS fecha, s.saldo FROM saldos_diarios s
     WHERE s.id_cuenta IN (?) AND (s.fecha BETWEEN ? AND ?
       OR s.fecha = (SELECT MAX(x.fecha) FROM saldos_diarios x WHERE x.id_cuenta = s.id_cuenta AND x.fecha < ?))
     ORDER BY s.id_cuenta, s.fecha`,
    [cuentas.map((c) => c.id_cuenta), inicio, fin, inicio]
  );
  const retencionPct = num(config.obtener().aho_retencion_pct);
  return cuentas.map((c) => {
    const propias = fotos.filter((f) => f.id_cuenta === c.id_cuenta);
    const p = saldoPromedio(propias, anio, mes, num(c.saldo_actual));
    const i = interesDelMes({ promedio: p.promedio, tasaAnual: c.tasa_anual, dias: p.dias, retencionPct });
    return {
      id_cuenta: c.id_cuenta,
      id_usuario: c.id_usuario,
      socio: c.nombre_completo,
      tipo_cuenta: c.tipo_cuenta,
      tasa_anual: num(c.tasa_anual),
      saldo_promedio: p.promedio,
      dias: p.dias,
      dias_con_foto: p.dias_con_foto,
      interes_bruto: i.bruto,
      retencion: i.retencion,
      interes_neto: i.neto,
      ya_acreditado: c.ya > 0,
    };
  });
};

// Acredita los intereses de un mes ya terminado. Idempotente: una vez por cuenta y mes.
const liquidarIntereses = async (anio, mes, idUsuario = null) => {
  const hoy = hoyISO();
  if (`${anio}-${pad(mes)}` >= hoy.substring(0, 7)) {
    throw Object.assign(new Error("Solo se liquidan meses que ya terminaron."), { codigo: 400 });
  }
  const filas = (await previaIntereses(anio, mes)).filter((f) => !f.ya_acreditado && f.interes_neto > 0);
  let total = 0;
  for (const f of filas) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      // La marca única evita acreditar dos veces si dos procesos corren a la vez
      await conn.query(
        `INSERT INTO intereses_ahorro (id_cuenta, anio, mes, saldo_promedio, tasa_anual, dias, interes_bruto, retencion, interes_neto)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [f.id_cuenta, anio, mes, f.saldo_promedio, f.tasa_anual, f.dias, f.interes_bruto, f.retencion, f.interes_neto]
      );
      const [[c]] = await conn.query("SELECT saldo_actual FROM cuentas WHERE id_cuenta = ? FOR UPDATE", [f.id_cuenta]);
      const nuevo = r2(num(c.saldo_actual) + f.interes_neto);
      await conn.query("UPDATE cuentas SET saldo_actual = ? WHERE id_cuenta = ?", [nuevo, f.id_cuenta]);
      const concepto = `Intereses de ${pad(mes)}/${anio} (${f.tasa_anual}% anual sobre saldo promedio)`;
      await conn.query(
        `INSERT INTO movimientos_cuenta (id_cuenta, tipo_movimiento, monto, saldo_anterior, saldo_nuevo, descripcion, fecha)
         VALUES (?, 'interes', ?, ?, ?, ?, NOW())`,
        [f.id_cuenta, f.interes_neto, num(c.saldo_actual), nuevo, concepto]
      );
      await conSalvaguarda(conn, { concepto, origen: "interes_ahorro", origen_id: f.id_cuenta }, () =>
        contabilizar(conn, "interes_ahorro", { interes: f.interes_bruto, retencion: f.retencion, tipo_cuenta: f.tipo_cuenta }, {
          concepto: `${concepto} — ${f.socio}`,
          origen: "interes_ahorro",
          origen_id: f.id_cuenta,
          creada_por: idUsuario,
        })
      );
      await conn.commit();
      total = r2(total + f.interes_neto);
    } catch (error) {
      await conn.rollback().catch(() => {});
      if (error.code !== "ER_DUP_ENTRY") throw error;
    } finally {
      conn.release();
    }
  }
  if (filas.length) {
    await pool.query(`INSERT INTO bitacora (id_usuario, accion, detalle, fecha) VALUES (?, ?, ?, NOW())`, [
      idUsuario,
      "Intereses de ahorro",
      `Intereses de ${pad(mes)}/${anio} acreditados a ${filas.length} cuenta(s)`,
    ]);
  }
  return { cuentas: filas.length, total };
};

// Cada noche la foto de saldos; el día 1 de cada mes, los intereses del mes anterior
const iniciarAhorroScheduler = () => {
  const foto = () => registrarSaldosDelDia().catch((e) => console.error("Fotos de saldos:", e.message));
  const intereses = () => {
    const [y, m] = hoyISO().split("-").map(Number);
    const anio = m === 1 ? y - 1 : y;
    const mes = m === 1 ? 12 : m - 1;
    liquidarIntereses(anio, mes)
      .then((r) => r.cuentas && console.log(`💰 Intereses de ${pad(mes)}/${anio}: ${r.cuentas} cuenta(s)`))
      .catch((e) => console.error("Intereses de ahorro:", e.message));
  };
  try {
    cron.schedule("55 23 * * *", foto, { timezone: zona() });
    cron.schedule("20 1 1 * *", intereses, { timezone: zona() });
  } catch {
    cron.schedule("55 5 * * *", foto);
    cron.schedule("20 7 1 * *", intereses);
  }
  foto(); // la de hoy, por si el servidor estuvo apagado anoche
};

module.exports = {
  diasDelMes,
  saldoPromedio,
  interesDelMes,
  liquidacionPlazo,
  sumarDias,
  registrarSaldosDelDia,
  previaIntereses,
  liquidarIntereses,
  iniciarAhorroScheduler,
};
