const pool = require('./db');

async function verificarUsuarios() {
  try {
    console.log('Verificando tabla usuarios...');
    
    // Verificar estructura
    const [estructura] = await pool.query("DESCRIBE usuarios");
    console.log('\nEstructura de la tabla usuarios:');
    console.table(estructura);
    
    // Probar el JOIN que usa el backend
    console.log('\nProbando el JOIN de aportaciones...');
    const [result] = await pool.query(`
      SELECT a.*, u.nombre_completo, u.dni 
      FROM aportaciones a
      INNER JOIN usuarios u ON a.id_usuario = u.id_usuario
      LIMIT 1
    `);
    
    if (result.length > 0) {
      console.log('✅ JOIN funciona correctamente');
      console.log('Ejemplo de registro:', result[0]);
    } else {
      console.log('⚠️ No hay datos para mostrar');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

verificarUsuarios();
