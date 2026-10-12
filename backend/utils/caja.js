// Registro en el libro de caja. Se llama dentro de la misma transacción de la
// operación (pago, aportación, desembolso...). Si el libro no existe todavía,
// el error se registra pero no se interrumpe la operación principal.

const METODOS = ["efectivo", "transferencia", "cheque", "deposito"];

const normalizarMetodo = (m) => {
  const v = String(m || "efectivo").toLowerCase();
  return METODOS.includes(v) ? v : "efectivo";
};

const registrarCaja = async (conn, mov) => {
  try {
    await conn.query(
      `INSERT INTO caja_movimientos
         (fecha, tipo, categoria, monto, metodo, descripcion, referencia_tipo, referencia_id, id_socio, id_registrado_por)
       VALUES (COALESCE(?, NOW()), ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      ]
    );
  } catch (error) {
    console.error("No se pudo registrar el movimiento de caja:", error.message);
  }
};

module.exports = { registrarCaja, normalizarMetodo };
