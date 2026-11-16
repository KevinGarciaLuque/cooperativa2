// Número de socio: correlativo (1, 2, 3...) que identifica al socio en recibos, listas y
// expediente. Se asigna una sola vez, cuando la persona queda como socio (activo o inactivo);
// las solicitudes pendientes o rechazadas no gastan números. Nunca se cambia ni se reutiliza.

const asignarNumeroSocio = async (conn, idUsuario) => {
  // Si dos se asignan a la vez, el índice único rechaza uno y se reintenta con el siguiente
  for (let intento = 0; ; intento++) {
    try {
      const [r] = await conn.query(
        `UPDATE usuarios u
           INNER JOIN roles r ON r.id_rol = u.rol_id AND r.nombre = 'Socio'
           INNER JOIN (SELECT COALESCE(MAX(numero_socio), 0) + 1 AS siguiente FROM usuarios) s
            SET u.numero_socio = s.siguiente
          WHERE u.id_usuario = ? AND u.numero_socio IS NULL AND u.estado IN ('activo', 'inactivo')`,
        [idUsuario]
      );
      return r.affectedRows > 0;
    } catch (e) {
      if (e.code !== "ER_DUP_ENTRY" || intento >= 4) throw e;
    }
  }
};

module.exports = { asignarNumeroSocio };
