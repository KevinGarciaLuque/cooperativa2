const pool = require('./db');

async function verificarTabla() {
  try {
    console.log('Verificando tabla aportaciones...');
    
    // Verificar si la tabla existe
    const [tables] = await pool.query("SHOW TABLES LIKE 'aportaciones'");
    console.log('Resultado de SHOW TABLES:', tables);
    
    if (tables.length === 0) {
      console.log('❌ La tabla aportaciones NO existe');
      return;
    }
    
    console.log('✅ La tabla aportaciones existe');
    
    // Verificar estructura
    const [estructura] = await pool.query("DESCRIBE aportaciones");
    console.log('\nEstructura de la tabla:');
    console.table(estructura);
    
    // Contar registros
    const [count] = await pool.query("SELECT COUNT(*) as total FROM aportaciones");
    console.log('\nTotal de registros:', count[0].total);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

verificarTabla();
