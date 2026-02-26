-- ============================================
-- MIGRACIONES PARA MÓDULO 8: ACTIVIDADES Y LIQUIDACIONES
-- ============================================
-- Ejecutar estas migraciones si las columnas no existen en tu base de datos

-- 1. Agregar columna tipo_reparto a liquidaciones (si no existe)
ALTER TABLE liquidaciones 
ADD COLUMN IF NOT EXISTS tipo_reparto ENUM('proporcional', 'igualitario') DEFAULT 'proporcional' 
AFTER monto_total;

-- 2. Agregar columna desembolsado a liquidacion_socios (si no existe)
ALTER TABLE liquidacion_socios 
ADD COLUMN IF NOT EXISTS desembolsado TINYINT(1) DEFAULT 0 
AFTER monto_recibido;

-- 3. Verificar estructura de tabla actividades (debe tener estos campos)
-- Si necesitas crear la tabla desde cero:
/*
CREATE TABLE IF NOT EXISTS actividades (
  id_actividad INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(200) NOT NULL,
  tipo ENUM('rifas', 'ventas', 'intereses_ganados', 'donaciones', 'alquileres', 'otros_ingresos') NOT NULL,
  monto DECIMAL(10,2) NOT NULL,
  descripcion TEXT,
  fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
*/

-- 4. Verificar estructura de tabla liquidaciones (debe tener estos campos)
-- Si necesitas crear la tabla desde cero:
/*
CREATE TABLE IF NOT EXISTS liquidaciones (
  id_liquidacion INT AUTO_INCREMENT PRIMARY KEY,
  id_actividad INT NOT NULL,
  monto_total DECIMAL(10,2) NOT NULL,
  tipo_reparto ENUM('proporcional', 'igualitario') DEFAULT 'proporcional',
  descripcion TEXT,
  fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id_actividad) REFERENCES actividades(id_actividad)
);
*/

-- 5. Verificar estructura de tabla liquidacion_socios (debe tener estos campos)
-- Si necesitas crear la tabla desde cero:
/*
CREATE TABLE IF NOT EXISTS liquidacion_socios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  id_liquidacion INT NOT NULL,
  id_usuario INT NOT NULL,
  monto_recibido DECIMAL(10,2) NOT NULL,
  desembolsado TINYINT(1) DEFAULT 0,
  FOREIGN KEY (id_liquidacion) REFERENCES liquidaciones(id_liquidacion),
  FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario)
);
*/

-- ============================================
-- NOTAS IMPORTANTES:
-- ============================================
-- 1. tipo_reparto: Permite liquidaciones proporcionales (basadas en aportaciones) o igualitarias
-- 2. desembolsado: Indica si el monto ya fue depositado en la cuenta del socio
-- 3. Si las tablas ya existen, solo necesitas ejecutar los ALTER TABLE
-- 4. Estas migraciones son compatibles con MySQL 5.7+
