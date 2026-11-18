// Conteo de lo que espera revisión en Solicitudes. Usa exactamente las mismas condiciones que
// las listas de cada pestaña, para que el número rojo del menú y la campanita nunca muestren
// algo que no aparece en la pantalla.
const pool = require("../db");
const { filtroSocio } = require("./sucursal");

const contarSolicitudes = async (req) => {
  const f = await filtroSocio(req, "u");
  const [[s]] = await pool.query(`SELECT COUNT(*) AS n FROM usuarios u WHERE u.estado = 'pendiente'${f.sql}`, f.params);
  const [[p]] = await pool.query(
    `SELECT COUNT(*) AS n FROM solicitudes_prestamo sp
     INNER JOIN prestamos pr ON sp.id_prestamo = pr.id_prestamo
     INNER JOIN usuarios u ON u.id_usuario = pr.id_usuario
     WHERE pr.estado = 'pendiente'${f.sql}`,
    f.params
  );
  const [[c]] = await pool.query(
    `SELECT COUNT(DISTINCT c.id_recibo) AS n FROM comprobantes_firmados c
     INNER JOIN recibos r ON c.id_recibo = r.id_recibo
     INNER JOIN usuarios u ON r.id_socio = u.id_usuario
     WHERE c.subido_por_rol = 'Socio' AND c.revisado_en IS NULL AND r.anulado = 0`
  );
  const [[pr]] = await pool.query(
    `SELECT COUNT(*) AS n FROM pagos_reportados r
     INNER JOIN usuarios u ON r.id_usuario = u.id_usuario
     INNER JOIN prestamos p ON r.id_prestamo = p.id_prestamo
     WHERE r.estado = 'pendiente'`
  );
  return {
    socios_pendientes: s.n,
    prestamos_pendientes: p.n,
    comprobantes_por_revisar: c.n,
    pagos_reportados: pr.n,
    total: s.n + p.n + c.n + pr.n,
  };
};

module.exports = { contarSolicitudes };
