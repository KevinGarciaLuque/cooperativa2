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

const numeroRecibo = (id) => `R-${String(id).padStart(6, "0")}`;

module.exports = { crearRecibo, numeroRecibo };
