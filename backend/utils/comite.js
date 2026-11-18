// Comité de crédito por niveles de monto.
// Con "aprob_monto_admin" en 0 (lo predeterminado) no hay comité: se aprueba como siempre.
// Si es mayor que 0, un préstamo por encima de ese monto necesita "aprob_votos_comite" votos a
// favor de miembros del comité; con ese mismo número de votos en contra, queda rechazado.
// Cada voto guarda el monto votado: si después cambian las condiciones, los votos anteriores
// ya no cuentan.
const config = require("./configFinanciera");
const { dinero } = require("./pais");

const num = (v) => parseFloat(v || 0);

const limite = () => num(config.obtener().aprob_monto_admin);
const votosRequeridos = () => Math.max(1, parseInt(config.obtener().aprob_votos_comite) || 1);
const requiere = (monto) => limite() > 0 && num(monto) > limite() + 0.001;
// Un préstamo va al comité por su monto o porque la calificación del socio lo mandó (comite_motivo)
const requierePrestamo = (p) => requiere(p.monto) || !!p.comite_motivo;

const esMiembro = async (conn, idUsuario) => {
  const [[m]] = await conn.query("SELECT 1 AS si FROM comite_credito WHERE id_usuario = ?", [idUsuario]);
  return !!m;
};

// Votos vigentes (los del monto actual del préstamo)
const conteo = async (conn, idPrestamo, monto) => {
  const [votos] = await conn.query(
    `SELECT v.id_usuario, v.voto, v.comentario, v.fecha, u.nombre_completo
     FROM prestamo_votos v JOIN usuarios u ON u.id_usuario = v.id_usuario
     WHERE v.id_prestamo = ? AND ABS(v.monto - ?) < 0.005
     ORDER BY v.fecha`,
    [idPrestamo, num(monto)]
  );
  const a_favor = votos.filter((v) => v.voto === "aprobar").length;
  const en_contra = votos.length - a_favor;
  const requeridos = votosRequeridos();
  return {
    votos,
    a_favor,
    en_contra,
    requeridos,
    aprobado: a_favor >= requeridos,
    rechazado: en_contra >= requeridos,
  };
};

// Registra (o cambia) el voto del usuario. Lanza un error con .codigo si no puede votar.
const votar = async (conn, prestamo, idUsuario, voto, comentario, { motivo } = {}) => {
  if (!["aprobar", "rechazar"].includes(voto)) throw Object.assign(new Error("Voto inválido."), { codigo: 400 });
  if (!(await esMiembro(conn, idUsuario))) {
    throw Object.assign(
      new Error(
        motivo
          ? `${motivo} No eres miembro del comité: los miembros votan en Comité de crédito.`
          : `Los préstamos de más de ${dinero(limite())} los aprueba el comité de crédito, y no eres miembro.`
      ),
      { codigo: 409, noMiembro: true }
    );
  }
  if (voto === "rechazar" && !String(comentario || "").trim()) {
    throw Object.assign(new Error("Escribe el motivo del voto en contra."), { codigo: 400 });
  }
  await conn.query(
    `INSERT INTO prestamo_votos (id_prestamo, id_usuario, voto, comentario, monto) VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE voto = VALUES(voto), comentario = VALUES(comentario), monto = VALUES(monto), fecha = NOW()`,
    [prestamo.id_prestamo, idUsuario, voto, String(comentario || "").trim().substring(0, 500) || null, num(prestamo.monto)]
  );
  return conteo(conn, prestamo.id_prestamo, prestamo.monto);
};

// Para las rutas que cambian el estado a mano (crear, editar): un préstamo que requiere comité
// no pasa de pendiente a aprobado/activo por fuera de la votación (salvo el Super Administrador,
// que registra préstamos históricos).
// conCalificacion: con la calificación del socio encendida, todo préstamo pendiente se aprueba con
// "Aprobar" (así se aplican sus reglas), no cambiando el estado a mano.
const bloqueaCambioDirecto = (usuario, monto, estadoAntes, estadoNuevo, conCalificacion = false) =>
  usuario?.rol !== "Super Administrador" &&
  (requiere(monto) || conCalificacion) &&
  (estadoAntes === "pendiente" || estadoAntes == null) &&
  ["aprobado", "activo", "mora", "pagado"].includes(estadoNuevo);

const mensajeBloqueo = () => `Los préstamos de más de ${dinero(limite())} se aprueban por votación del comité de crédito.`;

module.exports = { limite, votosRequeridos, requiere, requierePrestamo, esMiembro, conteo, votar, bloqueaCambioDirecto, mensajeBloqueo };
