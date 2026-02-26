-- ============================================
-- SCRIPT PARA CORREGIR Y ACTUALIZAR TABLAS
-- Compatible con MySQL 5.7+
-- ============================================

-- IMPORTANTE: Este script puede mostrar algunos errores si las columnas ya existen.
-- ¡ESO ES NORMAL! Ignora los errores de "Duplicate column name"

-- 1. Agregar columna descripcion a roles (si no existe, ignorar error)
-- ALTER TABLE roles 
-- ADD COLUMN descripcion TEXT AFTER nombre;
-- (Ya ejecutado exitosamente)

-- 2. Agregar columnas faltantes en liquidacion_socios (YA EJECUTADO ✅)
-- ALTER TABLE liquidacion_socios 
-- ADD COLUMN desembolsado TINYINT(1) DEFAULT 0;
-- ALTER TABLE liquidacion_socios 
-- ADD COLUMN fecha_desembolso TIMESTAMP NULL;

-- 3. IMPORTANTE: Renombrar 'tipo' a 'tipo_movimiento' en movimientos_cuenta
ALTER TABLE movimientos_cuenta 
CHANGE COLUMN tipo tipo_movimiento VARCHAR(50) NOT NULL;

-- 4. Las columnas saldo_anterior, saldo_nuevo y referencia YA EXISTEN ✅
-- No es necesario agregarlas

-- Actualizar o insertar roles
INSERT INTO roles (id_rol, nombre, descripcion) VALUES
(1, 'Administrador', 'Acceso total al sistema'),
(2, 'Socio', 'Usuario regular de la cooperativa'),
(3, 'Contador', 'Manejo de reportes financieros'),
(4, 'Supervisor', 'Supervisión de operaciones')
ON DUPLICATE KEY UPDATE descripcion=VALUES(descripcion);

-- Verificar que el usuario administrador exista con la contraseña correcta
-- Contraseña hasheada para 'admin123' usando bcrypt
UPDATE usuarios 
SET password = '$2b$10$YzQxWJHEHQ1ux4NtC7lhGuqHqYzD3KLD4BsCBqHQFWqPwGKP6Uwie',
    rol_id = 1,
    estado = 'activo'
WHERE dni = '00000000';

-- Si no existe, créalo
INSERT INTO usuarios (nombre_completo, dni, password, rol_id, estado)
SELECT 'Administrador', '00000000', '$2b$10$YzQxWJHEHQ1ux4NtC7lhGuqHqYzD3KLD4BsCBqHQFWqPwGKP6Uwie', 1, 'activo'
WHERE NOT EXISTS (SELECT 1 FROM usuarios WHERE dni = '00000000');

-- 5. Agregar índices (ignorar errores si ya existen)
CREATE INDEX idx_cuenta_fecha ON movimientos_cuenta (id_cuenta, fecha);
CREATE INDEX idx_tipo ON movimientos_cuenta (tipo_movimiento);
CREATE INDEX idx_fecha_mov ON movimientos_cuenta (fecha);

-- Mensaje de confirmación
SELECT 'Tablas actualizadas correctamente' as status;
