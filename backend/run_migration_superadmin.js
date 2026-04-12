require('dotenv').config();
const pool = require('./db');
const bcrypt = require('bcryptjs');

(async () => {
  try {
    // 1. Obtener todos los roles existentes
    const [roles] = await pool.query('SELECT id_rol, nombre FROM roles');
    console.log('Roles existentes:', roles.map(r => `${r.id_rol}:${r.nombre}`).join(', '));

    // 2. Verificar si ya existe Super Administrador
    const yaExiste = roles.find(r => r.nombre === 'Super Administrador');
    let superAdminRolId;

    if (yaExiste) {
      superAdminRolId = yaExiste.id_rol;
      console.log('Rol Super Administrador ya existe con id:', superAdminRolId);
    } else {
      const [ins] = await pool.query(
        "INSERT INTO roles (nombre, descripcion) VALUES ('Super Administrador', 'Control total del sistema y configuración de permisos por rol')"
      );
      superAdminRolId = ins.insertId;
      console.log('Rol Super Administrador creado con id:', superAdminRolId);
    }

    // 3. Crear tabla permisos_modulos
    await pool.query(`
      CREATE TABLE IF NOT EXISTS permisos_modulos (
        id INT AUTO_INCREMENT PRIMARY KEY,
        rol_id INT NOT NULL,
        modulo VARCHAR(50) NOT NULL,
        activo TINYINT(1) NOT NULL DEFAULT 1,
        UNIQUE KEY uq_rol_modulo (rol_id, modulo),
        FOREIGN KEY (rol_id) REFERENCES roles(id_rol) ON DELETE CASCADE
      )
    `);
    console.log('Tabla permisos_modulos OK');

    // 4. Módulos del sistema
    const modulos = [
      'dashboard','usuarios','roles','cuentas','prestamos',
      'aportaciones','pagos','movimientos','reportes',
      'actividades','liquidaciones','bitacora','basedatos'
    ];

    // 5. Insertar permisos para TODOS los roles (activados por defecto)
    const todosRoles = await pool.query('SELECT id_rol, nombre FROM roles').then(([r]) => r);
    for (const rol of todosRoles) {
      if (rol.nombre === 'Super Administrador') continue; // Super Admin no necesita permisos de módulos
      for (const modulo of modulos) {
        await pool.query(
          `INSERT IGNORE INTO permisos_modulos (rol_id, modulo, activo) VALUES (?, ?, 1)`,
          [rol.id_rol, modulo]
        );
      }
      console.log(`Permisos insertados para rol: ${rol.nombre}`);
    }

    // 6. Crear usuario Super Administrador
    const [existeUser] = await pool.query("SELECT id_usuario FROM usuarios WHERE dni = '000000001'");
    if (existeUser.length > 0) {
      console.log('Usuario Super Admin ya existe');
    } else {
      const hash = await bcrypt.hash('admin123*', 10);
      await pool.query(
        "INSERT INTO usuarios (nombre_completo, dni, password, rol_id, estado) VALUES ('Super Administrador', '000000001', ?, ?, 'activo')",
        [hash, superAdminRolId]
      );
      console.log('Usuario Super Admin creado (DNI: 000000001, Pass: admin123*)');
    }

    console.log('\n✅ Migración completada exitosamente');
    process.exit(0);
  } catch (e) {
    console.error('ERROR:', e.message);
    process.exit(1);
  }
})();
