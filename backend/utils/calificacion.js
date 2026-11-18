// Calificación del socio para decidir un crédito (función "calificacion_credito").
// Puntaje de 0 a 100 con su letra (A a E), el detalle de cada factor y las alertas:
//   - Historial de pagos (30): préstamos pagados, atraso actual y gestiones de cobro recientes
//   - Capacidad de pago (25): cuotas (las vigentes más la nueva) frente al ingreso mensual
//   - Ahorro y aportaciones (20): lo que tiene ahorrado frente al monto que pide
//   - Antigüedad como socio (15)
//   - Endeudamiento actual (10): préstamos vigentes
// Reglas de aprobación (Parámetros): no aprobar con cuotas atrasadas y mandar al comité
// los créditos con puntaje bajo.
const pool = require("../db");
const config = require("./configFinanciera");
const { obtenerCartera } = require("./cartera");
const { cuotaDelPrestamo } = require("./planPagos");
const { dinero } = require("./pais");

const num = (v) => parseFloat(v || 0);
const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

// Cuota llevada a un mes (los préstamos semanales pagan 52/12 cuotas al mes, los quincenales 2)
const cuotaMensual = (p) => {
  const c = cuotaDelPrestamo(p);
  return r2(c * (p.frecuencia_pago === "semanal" ? 52 / 12 : p.frecuencia_pago === "quincenal" ? 2 : 1));
};

const letraDe = (puntaje) => (puntaje >= 80 ? "A" : puntaje >= 65 ? "B" : puntaje >= 50 ? "C" : puntaje >= 35 ? "D" : "E");
const NIVEL = { A: "Excelente", B: "Bueno", C: "Aceptable", D: "Riesgoso", E: "Alto riesgo" };

const mesesEntre = (desde) => {
  if (!desde) return 0;
  const d = new Date(desde);
  if (isNaN(d)) return 0;
  return Math.max(0, (Date.now() - d.getTime()) / (30.44 * 24 * 3600 * 1000));
};

// solicitud: { monto, plazo_meses, tasa_interes (anual), frecuencia_pago, metodo_interes, redondeo_cuota, id_prestamo? }
const calificarSocio = async (idUsuario, solicitud = {}, conn = pool) => {
  const cfg = config.obtener();
  const [[u]] = await conn.query(
    `SELECT u.id_usuario, u.nombre_completo, u.ingreso_mensual, u.fecha_ingreso, u.fecha_registro, u.es_pep,
            (SELECT s.ingreso_mensual FROM solicitudes_prestamo s WHERE s.id_usuario = u.id_usuario AND s.ingreso_mensual > 0
              ORDER BY s.id_solicitud DESC LIMIT 1) AS ingreso_solicitud
     FROM usuarios u WHERE u.id_usuario = ?`,
    [idUsuario]
  );
  if (!u) return null;
  const idExcluir = parseInt(solicitud.id_prestamo) || 0;

  const [prestamos] = await conn.query(
    `SELECT id_prestamo, monto, saldo_restante, tasa_interes, plazo_meses, estado, redondeo_cuota, metodo_interes, frecuencia_pago
     FROM prestamos WHERE id_usuario = ? AND id_prestamo <> ?`,
    [idUsuario, idExcluir]
  );
  const vigentes = prestamos.filter((p) => ["activo", "mora"].includes(p.estado));
  const pagados = prestamos.filter((p) => p.estado === "pagado").length;
  const cartera = await obtenerCartera({ sql: " AND p.id_usuario = ? AND p.id_prestamo <> ?", params: [idUsuario, idExcluir] });
  const atrasoMax = cartera.reduce((m, c) => Math.max(m, c.dias_atraso, c.dias_mora), 0);
  const promesaIncumplida = cartera.some((c) => c.promesa_vencida);
  const [[gest]] = await conn.query(
    `SELECT COUNT(*) AS n FROM gestiones_cobro g JOIN prestamos p ON p.id_prestamo = g.id_prestamo
     WHERE p.id_usuario = ? AND g.fecha >= DATE_SUB(NOW(), INTERVAL 12 MONTH)`,
    [idUsuario]
  );
  const [[ahorro]] = await conn.query("SELECT IFNULL(SUM(saldo_actual), 0) AS s FROM cuentas WHERE id_usuario = ? AND estado = 'activa'", [idUsuario]);
  const [[aport]] = await conn.query("SELECT IFNULL(SUM(monto), 0) AS s FROM aportaciones WHERE id_usuario = ?", [idUsuario]);

  const monto = num(solicitud.monto);
  const cuotaNueva =
    monto > 0 && parseInt(solicitud.plazo_meses) > 0
      ? cuotaMensual({
          monto,
          tasa_interes: num(solicitud.tasa_interes),
          plazo_meses: parseInt(solicitud.plazo_meses),
          frecuencia_pago: solicitud.frecuencia_pago,
          metodo_interes: solicitud.metodo_interes,
          redondeo_cuota: solicitud.redondeo_cuota,
        })
      : 0;
  const cuotasVigentes = r2(vigentes.reduce((t, p) => t + cuotaMensual(p), 0));
  const ingreso = num(u.ingreso_mensual) || num(u.ingreso_solicitud);
  const cuotaTotal = r2(cuotasVigentes + cuotaNueva);
  const pctCuota = ingreso > 0 ? r2((cuotaTotal / ingreso) * 100) : null;

  const factores = [];
  const alertas = [];

  // 1. Historial de pagos (30)
  let h;
  let hDet;
  if (atrasoMax > 30) {
    h = 0;
    hDet = `Tiene cuotas con ${atrasoMax} días de atraso.`;
  } else if (atrasoMax > 0) {
    h = 10;
    hDet = `Tiene cuotas con ${atrasoMax} días de atraso.`;
  } else if (pagados > 0) {
    h = 30;
    hDet = `${pagados} ${pagados === 1 ? "préstamo pagado" : "préstamos pagados"} y está al día.`;
  } else if (vigentes.length) {
    h = 24;
    hDet = "Está al día; todavía no termina de pagar un préstamo.";
  } else {
    h = 18;
    hDet = "Sin historial de préstamos en la cooperativa.";
  }
  if (promesaIncumplida) {
    h = Math.max(0, h - 5);
    hDet += " Incumplió una promesa de pago.";
  }
  if (gest.n > 0 && atrasoMax === 0) {
    h = Math.max(0, h - Math.min(8, gest.n * 2));
    hDet += ` ${gest.n} ${gest.n === 1 ? "gestión" : "gestiones"} de cobro en los últimos 12 meses.`;
  }
  factores.push({ clave: "historial", nombre: "Historial de pagos", puntos: h, max: 30, detalle: hDet });
  if (atrasoMax > 0) alertas.push(`Tiene cuotas atrasadas (${atrasoMax} días).`);

  // 2. Capacidad de pago (25)
  let cp;
  let cpDet;
  if (pctCuota === null) {
    cp = 10;
    cpDet = "No tiene ingreso mensual registrado: no se puede medir.";
    alertas.push("Falta el ingreso mensual del socio para medir su capacidad de pago.");
  } else {
    cp = pctCuota <= 20 ? 25 : pctCuota <= 30 ? 20 : pctCuota <= 40 ? 12 : pctCuota <= 50 ? 5 : 0;
    cpDet = `Sus cuotas (${dinero(cuotaTotal)} al mes${cuotasVigentes > 0 ? `, ${dinero(cuotasVigentes)} de préstamos vigentes` : ""}) son el ${pctCuota}% de su ingreso de ${dinero(ingreso)}.`;
    const tope = num(cfg.sol_pct_ingreso_max) || 40;
    if (pctCuota > tope) alertas.push(`Las cuotas superan el ${tope}% de su ingreso (${pctCuota}%).`);
  }
  factores.push({ clave: "capacidad", nombre: "Capacidad de pago", puntos: cp, max: 25, detalle: cpDet });

  // 3. Ahorro y aportaciones (20)
  const ahorrado = r2(num(ahorro.s) + num(aport.s));
  const pctAhorro = monto > 0 ? (ahorrado / monto) * 100 : ahorrado > 0 ? 100 : 0;
  const ah = pctAhorro >= 30 ? 20 : pctAhorro >= 20 ? 16 : pctAhorro >= 10 ? 11 : ahorrado > 0 ? 6 : 0;
  factores.push({
    clave: "ahorro",
    nombre: "Ahorro y aportaciones",
    puntos: ah,
    max: 20,
    detalle: monto > 0 ? `Tiene ${dinero(ahorrado)} ahorrado: el ${r2(pctAhorro)}% del monto que pide.` : `Tiene ${dinero(ahorrado)} ahorrado.`,
  });

  // 4. Antigüedad (15)
  const meses = mesesEntre(u.fecha_ingreso || u.fecha_registro);
  const an = meses >= 36 ? 15 : meses >= 12 ? 11 : meses >= 6 ? 7 : 3;
  const anios = Math.floor(meses / 12);
  factores.push({
    clave: "antiguedad",
    nombre: "Antigüedad como socio",
    puntos: an,
    max: 15,
    detalle: meses >= 12 ? `${anios} ${anios === 1 ? "año" : "años"} en la cooperativa.` : `${Math.floor(meses)} ${Math.floor(meses) === 1 ? "mes" : "meses"} en la cooperativa.`,
  });

  // 5. Endeudamiento actual (10)
  const en = atrasoMax > 0 ? 0 : vigentes.length === 0 ? 10 : vigentes.length === 1 ? 6 : 2;
  const saldoVig = r2(vigentes.reduce((t, p) => t + num(p.saldo_restante), 0));
  factores.push({
    clave: "endeudamiento",
    nombre: "Endeudamiento actual",
    puntos: en,
    max: 10,
    detalle: vigentes.length ? `${vigentes.length} ${vigentes.length === 1 ? "préstamo vigente" : "préstamos vigentes"} con saldo de ${dinero(saldoVig)}.` : "Sin préstamos vigentes.",
  });

  if (u.es_pep) alertas.push("Es persona expuesta políticamente: revisar con cumplimiento.");

  const puntaje = factores.reduce((t, f) => t + f.puntos, 0);
  const letra = letraDe(puntaje);
  return {
    puntaje,
    letra,
    nivel: NIVEL[letra],
    factores,
    alertas,
    datos: {
      ingreso_mensual: ingreso || null,
      cuota_nueva: cuotaNueva,
      cuotas_vigentes: cuotasVigentes,
      porcentaje_cuota_ingreso: pctCuota,
      ahorrado,
      dias_atraso: atrasoMax,
      prestamos_vigentes: vigentes.length,
      prestamos_pagados: pagados,
    },
  };
};

// Datos de la solicitud a partir de la fila del préstamo
const solicitudDe = (p) => ({
  id_prestamo: p.id_prestamo,
  monto: p.monto,
  plazo_meses: p.plazo_meses,
  tasa_interes: p.tasa_interes,
  frecuencia_pago: p.frecuencia_pago,
  metodo_interes: p.metodo_interes,
  redondeo_cuota: p.redondeo_cuota,
});

// Reglas de aprobación con la función encendida. Devuelve
//   { bloqueo: "mensaje" }        → no se puede aprobar
//   { comite: "motivo", cal }     → lo decide el comité aunque el monto no lo pida
//   { cal }                       → sigue como siempre
// El Super Administrador no queda bloqueado (registra casos especiales), pero sí ve la calificación.
const evaluarReglas = async (conn, p, usuario) => {
  const cfg = config.obtener();
  const cal = await calificarSocio(p.id_usuario, solicitudDe(p), conn);
  if (!cal) return {};
  const esSuper = usuario?.rol === "Super Administrador";
  if (parseInt(cfg.cred_bloquear_mora) === 1 && cal.datos.dias_atraso > 0 && !esSuper) {
    return {
      cal,
      bloqueo: `El socio tiene cuotas atrasadas (${cal.datos.dias_atraso} días): primero debe ponerse al día. Solo el Super Administrador puede aprobarlo.`,
    };
  }
  const minimo = parseInt(cfg.cred_puntaje_comite) || 0;
  if (minimo > 0 && cal.puntaje < minimo && !esSuper) {
    return { cal, comite: `Calificación ${cal.letra} (${cal.puntaje} puntos), menor a ${minimo}: lo decide el comité de crédito.` };
  }
  return { cal };
};

// Para las rutas que aprueban: con la función encendida aplica las reglas y deja anotado en el
// préstamo si pasa al comité por la calificación. Devuelve { bloqueo, cal, porComite }.
const reglasDeAprobacion = async (conn, p, usuario, { habilitada, comite }) => {
  const conCal = await habilitada("calificacion_credito", usuario);
  const esSuper = usuario?.rol === "Super Administrador";
  const r = conCal ? await evaluarReglas(conn, p, usuario) : {};
  if (r.bloqueo) return r;
  if (r.comite && !p.comite_motivo) {
    await conn.query("UPDATE prestamos SET comite_motivo = ? WHERE id_prestamo = ?", [r.comite.substring(0, 200), p.id_prestamo]);
    p.comite_motivo = r.comite;
  }
  const porCalificacion = conCal && !!p.comite_motivo && !esSuper;
  return { cal: r.cal, porComite: comite.requiere(p.monto) || porCalificacion, motivo: porCalificacion && !comite.requiere(p.monto) ? p.comite_motivo : null };
};

// Guarda en el préstamo la calificación con la que se aprobó
const guardarCalificacion = (conn, idPrestamo, cal) =>
  cal ? conn.query("UPDATE prestamos SET calificacion_puntaje = ?, calificacion_letra = ? WHERE id_prestamo = ?", [cal.puntaje, cal.letra, idPrestamo]) : null;

module.exports = { calificarSocio, evaluarReglas, reglasDeAprobacion, guardarCalificacion, solicitudDe, letraDe };
