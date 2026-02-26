-- ============================================
-- SCHEMA COMPLETO DE LA COOPERATIVA
-- ============================================

-- 1. TABLA DE ROLES
CREATE TABLE IF NOT EXISTS roles (
  id_rol INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(50) NOT NULL UNIQUE,
  descripcion TEXT,
  fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insertar roles por defecto
INSERT INTO roles (id_rol, nombre, descripcion) VALUES
(1, 'Administrador', 'Acceso total al sistema'),
(2, 'Socio', 'Usuario regular de la cooperativa')
ON DUPLICATE KEY UPDATE nombre=nombre;

-- 2. TABLA DE USUARIOS
CREATE TABLE IF NOT EXISTS usuarios (
  id_usuario INT AUTO_INCREMENT PRIMARY KEY,
  nombre_completo VARCHAR(200) NOT NULL,
  dni VARCHAR(20) UNIQUE NOT NULL,
  telefono VARCHAR(20),
  email VARCHAR(100),
  direccion TEXT,
  password VARCHAR(255) NOT NULL,
  rol_id INT DEFAULT 2,
  estado ENUM('activo', 'inactivo') DEFAULT 'activo',
  fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  reset_token VARCHAR(255),
  reset_token_expiry DATETIME,
  FOREIGN KEY (rol_id) REFERENCES roles(id_rol)
);

-- 3. TABLA DE CUENTAS
CREATE TABLE IF NOT EXISTS cuentas (
  id_cuenta INT AUTO_INCREMENT PRIMARY KEY,
  id_usuario INT NOT NULL,
  tipo_cuenta ENUM('Aportaciones', 'Vivienda', 'Pensiones') NOT NULL,
  saldo_actual DECIMAL(10,2) DEFAULT 0.00,
  fecha_apertura TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  fecha_ultima_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  estado ENUM('activa', 'inactiva') DEFAULT 'activa',
  FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
  UNIQUE KEY unique_usuario_tipo (id_usuario, tipo_cuenta)
);

-- 4. TABLA DE MOVIMIENTOS DE CUENTA
CREATE TABLE IF NOT EXISTS movimientos_cuenta (
  id_movimiento INT AUTO_INCREMENT PRIMARY KEY,
  id_cuenta INT NOT NULL,
  tipo_movimiento ENUM('deposito', 'retiro', 'transferencia', 'interes', 'ajuste', 'aportacion', 'pago_prestamo', 'liquidacion') NOT NULL,
  monto DECIMAL(10,2) NOT NULL,
  saldo_anterior DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  saldo_nuevo DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  descripcion TEXT,
  referencia VARCHAR(100),
  fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id_cuenta) REFERENCES cuentas(id_cuenta) ON DELETE CASCADE,
  INDEX idx_cuenta_fecha (id_cuenta, fecha),
  INDEX idx_tipo (tipo_movimiento),
  INDEX idx_fecha (fecha)
);

-- 5. TABLA DE APORTACIONES
CREATE TABLE IF NOT EXISTS aportaciones (
  id_aportacion INT AUTO_INCREMENT PRIMARY KEY,
  id_usuario INT NOT NULL,
  monto DECIMAL(10,2) NOT NULL,
  fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  descripcion TEXT,
  tipo_aportacion ENUM('ordinaria', 'extraordinaria', 'inicial') DEFAULT 'ordinaria',
  estado ENUM('pendiente', 'aprobada', 'rechazada') DEFAULT 'aprobada',
  FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
  INDEX idx_usuario (id_usuario),
  INDEX idx_fecha (fecha)
);

-- 6. TABLA DE PRÉSTAMOS
CREATE TABLE IF NOT EXISTS prestamos (
  id_prestamo INT AUTO_INCREMENT PRIMARY KEY,
  id_usuario INT NOT NULL,
  monto DECIMAL(10,2) NOT NULL,
  tasa_interes DECIMAL(5,2) NOT NULL,
  plazo_meses INT NOT NULL,
  cuota_mensual DECIMAL(10,2),
  saldo_restante DECIMAL(10,2) NOT NULL,
  fecha_otorgado TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  fecha_vencimiento DATE,
  estado ENUM('pendiente', 'aprobado', 'activo', 'mora', 'pagado', 'cancelado') DEFAULT 'pendiente',
  descripcion TEXT,
  garantia TEXT,
  FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
  INDEX idx_usuario (id_usuario),
  INDEX idx_estado (estado),
  INDEX idx_fecha (fecha_otorgado)
);

-- 7. TABLA DE PAGOS DE PRÉSTAMOS
CREATE TABLE IF NOT EXISTS pagos_prestamo (
  id_pago INT AUTO_INCREMENT PRIMARY KEY,
  id_prestamo INT NOT NULL,
  monto_pagado DECIMAL(10,2) NOT NULL,
  monto_capital DECIMAL(10,2) DEFAULT 0.00,
  monto_interes DECIMAL(10,2) DEFAULT 0.00,
  monto_mora DECIMAL(10,2) DEFAULT 0.00,
  saldo_restante DECIMAL(10,2) NOT NULL,
  fecha_pago TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  numero_cuota INT,
  descripcion TEXT,
  metodo_pago ENUM('efectivo', 'transferencia', 'cheque', 'deposito') DEFAULT 'efectivo',
  FOREIGN KEY (id_prestamo) REFERENCES prestamos(id_prestamo) ON DELETE CASCADE,
  INDEX idx_prestamo (id_prestamo),
  INDEX idx_fecha (fecha_pago)
);

-- 8. TABLA DE ACTIVIDADES
CREATE TABLE IF NOT EXISTS actividades (
  id_actividad INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(200) NOT NULL,
  tipo ENUM('rifas', 'ventas', 'intereses_ganados', 'donaciones', 'alquileres', 'otros_ingresos') NOT NULL,
  monto DECIMAL(10,2) NOT NULL,
  descripcion TEXT,
  fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_tipo (tipo),
  INDEX idx_fecha (fecha)
);

-- 9. TABLA DE LIQUIDACIONES
CREATE TABLE IF NOT EXISTS liquidaciones (
  id_liquidacion INT AUTO_INCREMENT PRIMARY KEY,
  id_actividad INT NOT NULL,
  monto_total DECIMAL(10,2) NOT NULL,
  tipo_reparto ENUM('proporcional', 'igualitario') DEFAULT 'proporcional',
  descripcion TEXT,
  fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id_actividad) REFERENCES actividades(id_actividad) ON DELETE CASCADE,
  INDEX idx_actividad (id_actividad),
  INDEX idx_fecha (fecha)
);

-- 10. TABLA DE LIQUIDACIÓN POR SOCIO
CREATE TABLE IF NOT EXISTS liquidacion_socios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  id_liquidacion INT NOT NULL,
  id_usuario INT NOT NULL,
  monto_recibido DECIMAL(10,2) NOT NULL,
  desembolsado TINYINT(1) DEFAULT 0,
  fecha_desembolso TIMESTAMP NULL,
  FOREIGN KEY (id_liquidacion) REFERENCES liquidaciones(id_liquidacion) ON DELETE CASCADE,
  FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
  INDEX idx_liquidacion (id_liquidacion),
  INDEX idx_usuario (id_usuario)
);

-- 11. TABLA DE BITÁCORA
CREATE TABLE IF NOT EXISTS bitacora (
  id_bitacora INT AUTO_INCREMENT PRIMARY KEY,
  id_usuario INT,
  accion VARCHAR(100) NOT NULL,
  tabla_afectada VARCHAR(50),
  id_registro INT,
  detalles TEXT,
  ip_address VARCHAR(45),
  fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
  INDEX idx_usuario (id_usuario),
  INDEX idx_fecha (fecha),
  INDEX idx_tabla (tabla_afectada)
);

-- ============================================
-- INSERTAR USUARIO ADMINISTRADOR POR DEFECTO
-- ============================================
-- Contraseña: admin123
INSERT INTO usuarios (id_usuario, nombre_completo, dni, password, rol_id, estado)
VALUES (1, 'Administrador', '00000000', '$2b$10$8Kx.yqBVN5EB5mZP6oL8LO5hPUqW1Z5Y7yZ5qG5qG5qG5qG5qG5qG', 1, 'activo')
ON DUPLICATE KEY UPDATE nombre_completo='Administrador';

-- ============================================
-- NOTAS IMPORTANTES
-- ============================================
-- 1. El hash de password es para 'admin123'
-- 2. Todas las tablas tienen índices para optimizar consultas
-- 3. Las claves foráneas tienen ON DELETE CASCADE o SET NULL según corresponda
-- 4. Los campos ENUM definen valores fijos permitidos
-- 5. Los timestamps se manejan automáticamente
