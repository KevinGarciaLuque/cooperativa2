const mysql = require('mysql2/promise');

async function verificarTablaMovimientos() {
  try {
    const conn = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '123456789',
      database: 'cooperativa'
    });

    console.log('=== Buscando tablas de movimientos ===');
    const [tables] = await conn.query("SHOW TABLES LIKE 'movimientos%'");
    
    if (tables.length === 0) {
      console.log('❌ No se encontraron tablas de movimientos');
      
      // Buscar otras variantes
      const [allTables] = await conn.query("SHOW TABLES");
      console.log('\n📋 Todas las tablas disponibles:');
      allTables.forEach(t => console.log('  -', Object.values(t)[0]));
    } else {
      console.log('✅ Tablas encontradas:');
      for (let t of tables) {
        const tableName = Object.values(t)[0];
        console.log(`\n=== Tabla: ${tableName} ===`);
        
        const [desc] = await conn.query(`DESCRIBE ${tableName}`);
        console.table(desc);
        
        const [count] = await conn.query(`SELECT COUNT(*) as total FROM ${tableName}`);
        console.log(`Total de registros: ${count[0].total}`);
        
        if (count[0].total > 0) {
          const [sample] = await conn.query(`SELECT * FROM ${tableName} LIMIT 1`);
          console.log('\nEjemplo de registro:');
          console.log(sample[0]);
        }
      }
    }

    await conn.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

verificarTablaMovimientos();
