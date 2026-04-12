-- ============================================
-- MIGRACIÓN: SUPER ADMINISTRADOR Y PERMISOS DE MÓDULOS
-- ============================================

-- 1. Insertar rol Super Administrador (sin forzar ID fijo)
INSERT INTO roles (nombre, descripcion)
SELECT 'Super Administrador', 'Control total del sistema y configuración de permisos por rol'
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE nombre = 'Super Administrador');

-- 5. Insertar el usuario Super Administrador usando el ID del rol por nombre
--    DNI: 000000001 | Password: admin123*
INSERT INTO usuarios (nombre_completo, dni, password, rol_id, estado)
SELECT 'Super Administrador', '000000001', '$2b$10$9LiYFVVCDiRVaq0SRHJoSOyvCiTwmh3dDr8.m200c/MNBn5PXyUEa',
       (SELECT id_rol FROM roles WHERE nombre = 'Super Administrador' LIMIT 1),
       'activo'
WHERE NOT EXISTS (SELECT 1 FROM usuarios WHERE dni = '000000001');

-- 2. Crear tabla de permisos de módulos por rol
CREATE TABLE IF NOT EXISTS permisos_modulos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  rol_id INT NOT NULL,
  modulo VARCHAR(50) NOT NULL,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  UNIQUE KEY uq_rol_modulo (rol_id, modulo),
  FOREIGN KEY (rol_id) REFERENCES roles(id_rol) ON DELETE CASCADE
);

-- 3. Insertar permisos por defecto para Administrador (todos activos)
INSERT INTO permisos_modulos (rol_id, modulo, activo) VALUES
(1, 'dashboard',      1),
(1, 'usuarios',       1),
(1, 'roles',          1),
(1, 'cuentas',        1),
(1, 'prestamos',      1),
(1, 'aportaciones',   1),
(1, 'pagos',          1),
(1, 'movimientos',    1),
(1, 'reportes',       1),
(1, 'actividades',    1),
(1, 'liquidaciones',  1),
(1, 'bitacora',       1),
(1, 'basedatos',      1)
ON DUPLICATE KEY UPDATE modulo=modulo;

-- 4. Insertar permisos por defecto para Socio (solo lo básico)
INSERT INTO permisos_modulos (rol_id, modulo, activo) VALUES
(2, 'dashboard',      0),
(2, 'usuarios',       0),
(2, 'roles',          0),
(2, 'cuentas',        0),
(2, 'prestamos',      0),
(2, 'aportaciones',   0),
(2, 'pagos',          0),
(2, 'movimientos',    0),
(2, 'reportes',       0),
(2, 'actividades',    0),
(2, 'liquidaciones',  0),
(2, 'bitacora',       0),
(2, 'basedatos',      0)
ON DUPLICATE KEY UPDATE modulo=modulo;

-- 5. Insertar el usuario Super Administrador
--    DNI: 000000001 | Password: admin123*
INSERT INTO usuarios (nombre_completo, dni, password, rol_id, estado) VALUES
('Super Administrador', '000000001', '$2b$10$9LiYFVVCDiRVaq0SRHJoSOyvCiTwmh3dDr8.m200c/MNBn5PXyUEa', 3, 'activo')
ON DUPLICATE KEY UPDATE nombre_completo=nombre_completo;
