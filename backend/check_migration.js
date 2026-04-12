require('dotenv').config();
const pool = require('./db');
const fs = require('fs');

(async () => {
  try {
    // Check roles
    const [roles] = await pool.query('SELECT id_rol, nombre FROM roles');
    console.log('ROLES:', JSON.stringify(roles));

    // Check if table exists
    const [tables] = await pool.query("SHOW TABLES LIKE 'permisos_modulos'");
    console.log('TABLE EXISTS:', tables.length > 0);

    // Check super admin user
    const [u] = await pool.query("SELECT id_usuario, nombre_completo, dni, rol_id FROM usuarios WHERE dni = '000000001'");
    console.log('SUPER ADMIN:', JSON.stringify(u));

    process.exit(0);
  } catch(e) {
    console.error(e.message);
    process.exit(1);
  }
})();
