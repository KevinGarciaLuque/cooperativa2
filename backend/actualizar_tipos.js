const mysql = require('mysql2/promise');

async function actualizarTipos() {
  try {
    const conn = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '123456789',
      database: 'cooperativa'
    });

    console.log('=== Actualizando tipos de movimiento ===');
    
    // Mostrar registros actuales
    const [antes] = await conn.query('SELECT tipo_movimiento, COUNT(*) as total FROM movimientos_cuenta GROUP BY tipo_movimiento');
    console.log('\n📊 ANTES de la actualización:');
    console.table(antes);

    // Actualizar de 'aporte' a 'abono'
    const [result] = await conn.query(
      'UPDATE movimientos_cuenta SET tipo_movimiento = ? WHERE tipo_movimiento = ?',
      ['abono', 'aporte']
    );
    
    console.log(`\n✅ Se actualizaron ${result.affectedRows} registros`);

    // Mostrar registros después
    const [despues] = await conn.query('SELECT tipo_movimiento, COUNT(*) as total FROM movimientos_cuenta GROUP BY tipo_movimiento');
    console.log('\n📊 DESPUÉS de la actualización:');
    console.table(despues);

    // Mostrar todos los registros
    const [todos] = await conn.query('SELECT id_movimiento, id_cuenta, tipo_movimiento, monto, fecha, descripcion FROM movimientos_cuenta ORDER BY id_movimiento');
    console.log('\n📋 Todos los movimientos:');
    console.table(todos);

    await conn.end();
    console.log('\n✅ Actualización completada exitosamente');
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

actualizarTipos();
