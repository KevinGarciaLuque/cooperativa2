// Emisión de recibos numerados. Se llama dentro de la transacción de la operación.
const crearRecibo = async (conn, r) => {
  try {
    const [res] = await conn.query(
      `INSERT INTO recibos
         (tipo, referencia_tipo, referencia_id, id_socio, monto, metodo, concepto, detalle, fecha, emitido_por)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, NOW()), ?)`,
      [
        r.tipo,
        r.referencia_tipo || null,
        r.referencia_id || null,
        r.id_socio || null,
        Math.abs(parseFloat(r.monto)),
        r.metodo || null,
        r.concepto ? String(r.concepto).substring(0, 255) : null,
        r.detalle ? JSON.stringify(r.detalle) : null,
        r.fecha || null,
        r.emitido_por || null,
      ]
    );
    return res.insertId;
  } catch (error) {
    console.error("No se pudo emitir el recibo:", error.message);
    return null;
  }
};

// Los finiquitos llevan prefijo propio (F-) para distinguirlos de los recibos de dinero
const PREFIJOS = { finiquito: "F", consolidacion: "C" };
const numeroRecibo = (id, tipo) => `${PREFIJOS[tipo] || "R"}-${String(id).padStart(6, "0")}`;

// Emite la constancia de cancelación (finiquito) de un préstamo ya pagado.
// Si ya existe una vigente, devuelve esa. Devuelve null si el préstamo no está pagado.
const emitirFiniquito = async (conn, idPrestamo, emitidoPor) => {
  const [rows] = await conn.query(
    `SELECT p.*, u.nombre_completo FROM prestamos p
     INNER JOIN usuarios u ON p.id_usuario = u.id_usuario WHERE p.id_prestamo = ?`,
    [idPrestamo]
  );
  if (!rows.length || rows[0].estado !== "pagado") return null;
  const p = rows[0];

  const [previo] = await conn.query(
    `SELECT id_recibo FROM recibos
     WHERE tipo = 'finiquito' AND referencia_tipo = 'finiquito' AND referencia_id = ? AND anulado = 0
     ORDER BY id_recibo DESC LIMIT 1`,
    [idPrestamo]
  );
  if (previo.length) return previo[0].id_recibo;

  const [[pagos]] = await conn.query(
    `SELECT COUNT(*) AS cuotas, IFNULL(SUM(monto_pagado), 0) AS total, MAX(fecha_pago) AS ultimo
     FROM pagos_prestamo WHERE id_prestamo = ?`,
    [idPrestamo]
  );

  return crearRecibo(conn, {
    tipo: "finiquito",
    referencia_tipo: "finiquito",
    referencia_id: idPrestamo,
    id_socio: p.id_usuario,
    monto: p.monto,
    concepto: `Cancelación total del préstamo #${idPrestamo}`,
    detalle: {
      id_prestamo: idPrestamo,
      monto_otorgado: parseFloat(p.monto),
      plazo_meses: p.plazo_meses,
      fecha_otorgado: p.fecha_otorgado,
      fecha_cancelacion: pagos.ultimo || new Date().toISOString(),
      total_pagado: parseFloat(pagos.total),
      pagos: pagos.cuotas,
    },
    fecha: pagos.ultimo || null,
    emitido_por: emitidoPor,
  });
};

module.exports = { crearRecibo, numeroRecibo, emitirFiniquito };
