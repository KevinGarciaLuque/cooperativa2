// Script para recalcular saldo_restante, monto_capital y monto_interes
// en todos los pagos existentes usando amortización francesa correcta.
require('dotenv').config();
const pool = require('./db');

async function fix() {
  const [prestamos] = await pool.query(
    "SELECT * FROM prestamos WHERE estado IN ('activo', 'mora', 'pendiente', 'pagado')"
  );

  for (const pr of prestamos) {
    const tasaMensual = parseFloat(pr.tasa_interes) / 100 / 12;
    const [pagos] = await pool.query(
      'SELECT * FROM pagos_prestamo WHERE id_prestamo = ? ORDER BY fecha_pago ASC, id_pago ASC',
      [pr.id_prestamo]
    );

    if (pagos.length === 0) continue;

    let saldo = parseFloat(pr.monto);

    for (const pago of pagos) {
      const montoPagado = parseFloat(pago.monto_pagado);
      const interes     = parseFloat((saldo * tasaMensual).toFixed(2));
      const capital     = parseFloat(Math.max(0, montoPagado - interes).toFixed(2));
      const interesEf   = parseFloat(Math.min(montoPagado, interes).toFixed(2));
      saldo             = parseFloat(Math.max(0, saldo - capital).toFixed(2));

      await pool.query(
        'UPDATE pagos_prestamo SET monto_capital=?, monto_interes=?, saldo_restante=? WHERE id_pago=?',
        [capital, interesEf, saldo, pago.id_pago]
      );
    }

    // Actualizar saldo del préstamo solo si aún no está como pagado
    if (pr.estado !== 'pagado') {
      await pool.query(
        'UPDATE prestamos SET saldo_restante=? WHERE id_prestamo=?',
        [saldo, pr.id_prestamo]
      );
    }

    console.log(`Prestamo #${pr.id_prestamo} (${pr.estado}) -> saldo corregido: L.${saldo}`);
  }

  console.log('Listo.');
  process.exit(0);
}

fix().catch(e => { console.error(e.message); process.exit(1); });
