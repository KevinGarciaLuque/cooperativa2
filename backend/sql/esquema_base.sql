-- Esquema base de la cooperativa (sin datos). Generado con `npm run db:exportar`.
-- Las migraciones de utils/migraciones.js se aplican encima de este esquema.
SET FOREIGN_KEY_CHECKS = 0;
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `actividades` (
  `id_actividad` int NOT NULL AUTO_INCREMENT,
  `nombre` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tipo` enum('Rifa','Venta','Interes','Otro') COLLATE utf8mb4_unicode_ci NOT NULL,
  `fecha` datetime DEFAULT CURRENT_TIMESTAMP,
  `monto` decimal(12,2) NOT NULL,
  `descripcion` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id_actividad`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `aportaciones` (
  `id_aportacion` int NOT NULL AUTO_INCREMENT,
  `id_usuario` int NOT NULL,
  `monto` decimal(12,2) NOT NULL,
  `fecha` datetime DEFAULT CURRENT_TIMESTAMP,
  `descripcion` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id_aportacion`),
  KEY `id_usuario` (`id_usuario`),
  CONSTRAINT `aportaciones_ibfk_1` FOREIGN KEY (`id_usuario`) REFERENCES `usuarios` (`id_usuario`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `bitacora` (
  `id_bitacora` int NOT NULL AUTO_INCREMENT,
  `id_usuario` int NOT NULL,
  `accion` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `fecha` datetime DEFAULT CURRENT_TIMESTAMP,
  `detalle` text COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (`id_bitacora`),
  KEY `id_usuario` (`id_usuario`),
  CONSTRAINT `bitacora_ibfk_1` FOREIGN KEY (`id_usuario`) REFERENCES `usuarios` (`id_usuario`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `caja_movimientos` (
  `id_movimiento` bigint NOT NULL AUTO_INCREMENT,
  `fecha` datetime NOT NULL,
  `tipo` enum('ingreso','egreso') COLLATE utf8mb4_unicode_ci NOT NULL,
  `categoria` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `monto` decimal(12,2) NOT NULL,
  `metodo` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'efectivo',
  `descripcion` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `referencia_tipo` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `referencia_id` int DEFAULT NULL,
  `id_socio` int DEFAULT NULL,
  `id_registrado_por` int DEFAULT NULL,
  `origen` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'sistema',
  PRIMARY KEY (`id_movimiento`),
  KEY `idx_caja_fecha` (`fecha`),
  KEY `idx_caja_ref` (`referencia_tipo`,`referencia_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `cierres_caja` (
  `id_cierre` int NOT NULL AUTO_INCREMENT,
  `fecha` date NOT NULL,
  `saldo_inicial` decimal(12,2) NOT NULL DEFAULT '0.00',
  `ingresos_efectivo` decimal(12,2) NOT NULL DEFAULT '0.00',
  `egresos_efectivo` decimal(12,2) NOT NULL DEFAULT '0.00',
  `efectivo_esperado` decimal(12,2) NOT NULL DEFAULT '0.00',
  `efectivo_contado` decimal(12,2) NOT NULL DEFAULT '0.00',
  `diferencia` decimal(12,2) NOT NULL DEFAULT '0.00',
  `observacion` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `id_cerrado_por` int DEFAULT NULL,
  `fecha_cierre` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_cierre`),
  UNIQUE KEY `uq_cierre_fecha` (`fecha`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `cierres_mensuales` (
  `id_cierre` int NOT NULL AUTO_INCREMENT,
  `anio` smallint NOT NULL,
  `mes` tinyint NOT NULL,
  `datos` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `observacion` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `cerrado_por` int DEFAULT NULL,
  `fecha_cierre` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_cierre`),
  UNIQUE KEY `uq_cierre_mes` (`anio`,`mes`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `configuracion_sitio` (
  `clave` varchar(100) NOT NULL,
  `valor` text NOT NULL,
  PRIMARY KEY (`clave`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `cuentas` (
  `id_cuenta` int NOT NULL AUTO_INCREMENT,
  `id_usuario` int NOT NULL,
  `tipo_cuenta` enum('Aportaciones','Vivienda','Pensiones') COLLATE utf8mb4_unicode_ci NOT NULL,
  `saldo_actual` decimal(12,2) DEFAULT '0.00',
  `fecha_apertura` datetime DEFAULT CURRENT_TIMESTAMP,
  `estado` enum('activa','cerrada') COLLATE utf8mb4_unicode_ci DEFAULT 'activa',
  PRIMARY KEY (`id_cuenta`),
  KEY `id_usuario` (`id_usuario`),
  CONSTRAINT `cuentas_ibfk_1` FOREIGN KEY (`id_usuario`) REFERENCES `usuarios` (`id_usuario`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `gestiones_cobro` (
  `id_gestion` int NOT NULL AUTO_INCREMENT,
  `id_prestamo` int NOT NULL,
  `fecha` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `medio` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'llamada',
  `nota` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
  `promesa_fecha` date DEFAULT NULL,
  `promesa_monto` decimal(12,2) DEFAULT NULL,
  `id_usuario` int DEFAULT NULL,
  PRIMARY KEY (`id_gestion`),
  KEY `idx_gestion_prestamo` (`id_prestamo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `liquidacion_socios` (
  `id_liquidacion_socio` int NOT NULL AUTO_INCREMENT,
  `id_liquidacion` int NOT NULL,
  `id_usuario` int NOT NULL,
  `monto_recibido` decimal(12,2) NOT NULL,
  `desembolsado` tinyint(1) DEFAULT '0',
  `fecha_desembolso` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id_liquidacion_socio`),
  KEY `id_liquidacion` (`id_liquidacion`),
  KEY `id_usuario` (`id_usuario`),
  CONSTRAINT `liquidacion_socios_ibfk_1` FOREIGN KEY (`id_liquidacion`) REFERENCES `liquidaciones` (`id_liquidacion`),
  CONSTRAINT `liquidacion_socios_ibfk_2` FOREIGN KEY (`id_usuario`) REFERENCES `usuarios` (`id_usuario`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `liquidaciones` (
  `id_liquidacion` int NOT NULL AUTO_INCREMENT,
  `id_actividad` int NOT NULL,
  `fecha` datetime DEFAULT CURRENT_TIMESTAMP,
  `monto_total` decimal(12,2) NOT NULL,
  `descripcion` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id_liquidacion`),
  KEY `id_actividad` (`id_actividad`),
  CONSTRAINT `liquidaciones_ibfk_1` FOREIGN KEY (`id_actividad`) REFERENCES `actividades` (`id_actividad`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `movimientos_cuenta` (
  `id_movimiento` int NOT NULL AUTO_INCREMENT,
  `id_cuenta` int NOT NULL,
  `tipo_movimiento` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `monto` decimal(12,2) NOT NULL,
  `fecha` datetime DEFAULT CURRENT_TIMESTAMP,
  `descripcion` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `saldo_anterior` decimal(10,2) NOT NULL DEFAULT '0.00',
  `saldo_nuevo` decimal(10,2) NOT NULL DEFAULT '0.00',
  `referencia` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id_movimiento`),
  KEY `idx_cuenta_fecha` (`id_cuenta`,`fecha`),
  KEY `idx_tipo` (`tipo_movimiento`),
  KEY `idx_fecha_mov` (`fecha`),
  CONSTRAINT `movimientos_cuenta_ibfk_1` FOREIGN KEY (`id_cuenta`) REFERENCES `cuentas` (`id_cuenta`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `pagos_anulados` (
  `id_anulacion` int NOT NULL AUTO_INCREMENT,
  `id_pago` int NOT NULL,
  `id_prestamo` int NOT NULL,
  `monto_pagado` decimal(12,2) NOT NULL,
  `monto_capital` decimal(12,2) DEFAULT NULL,
  `monto_interes` decimal(12,2) DEFAULT NULL,
  `metodo_pago` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `saldo_restante` decimal(12,2) DEFAULT NULL,
  `fecha_pago` datetime DEFAULT NULL,
  `motivo` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `anulado_por` int DEFAULT NULL,
  `fecha_anulacion` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_anulacion`),
  KEY `idx_anulado_prestamo` (`id_prestamo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `pagos_prestamo` (
  `id_pago` int NOT NULL AUTO_INCREMENT,
  `id_prestamo` int NOT NULL,
  `monto_pagado` decimal(12,2) NOT NULL,
  `monto_capital` decimal(12,2) DEFAULT '0.00',
  `monto_interes` decimal(12,2) DEFAULT '0.00',
  `fecha_pago` datetime DEFAULT CURRENT_TIMESTAMP,
  `metodo_pago` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `saldo_restante` decimal(12,2) DEFAULT NULL,
  PRIMARY KEY (`id_pago`),
  KEY `id_prestamo` (`id_prestamo`),
  CONSTRAINT `pagos_prestamo_ibfk_1` FOREIGN KEY (`id_prestamo`) REFERENCES `prestamos` (`id_prestamo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `password_resets` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `token` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `expires_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `password_resets_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `usuarios` (`id_usuario`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `permisos_modulos` (
  `id` int NOT NULL AUTO_INCREMENT,
  `rol_id` int NOT NULL,
  `modulo` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_rol_modulo` (`rol_id`,`modulo`),
  CONSTRAINT `permisos_modulos_ibfk_1` FOREIGN KEY (`rol_id`) REFERENCES `roles` (`id_rol`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `prestamos` (
  `id_prestamo` int NOT NULL AUTO_INCREMENT,
  `id_usuario` int NOT NULL,
  `monto` decimal(12,2) NOT NULL,
  `fecha_otorgado` datetime DEFAULT CURRENT_TIMESTAMP,
  `tasa_interes` decimal(5,2) NOT NULL,
  `tipo_tasa` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT 'nominal_anual',
  `tasa_original` decimal(10,4) DEFAULT NULL,
  `plazo_meses` int NOT NULL,
  `saldo_restante` decimal(12,2) NOT NULL,
  `estado` enum('pendiente','aprobado','activo','pagado','mora','rechazado') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pendiente',
  `aprobado_por` int DEFAULT NULL,
  `fecha_aprobacion` datetime DEFAULT NULL,
  `motivo_rechazo` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id_prestamo`),
  KEY `id_usuario` (`id_usuario`),
  CONSTRAINT `prestamos_ibfk_1` FOREIGN KEY (`id_usuario`) REFERENCES `usuarios` (`id_usuario`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `recibos` (
  `id_recibo` int NOT NULL AUTO_INCREMENT,
  `tipo` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `referencia_tipo` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `referencia_id` int DEFAULT NULL,
  `id_socio` int DEFAULT NULL,
  `monto` decimal(12,2) NOT NULL,
  `metodo` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `concepto` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `detalle` text COLLATE utf8mb4_unicode_ci,
  `fecha` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `emitido_por` int DEFAULT NULL,
  `anulado` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id_recibo`),
  KEY `idx_recibo_ref` (`referencia_tipo`,`referencia_id`),
  KEY `idx_recibo_socio` (`id_socio`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `roles` (
  `id_rol` int NOT NULL AUTO_INCREMENT,
  `nombre` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `descripcion` text COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (`id_rol`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `solicitudes_prestamo` (
  `id_solicitud` int NOT NULL AUTO_INCREMENT,
  `id_prestamo` int NOT NULL,
  `id_usuario` int NOT NULL,
  `proposito` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `descripcion` varchar(300) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ocupacion` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `lugar_trabajo` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ingreso_mensual` decimal(12,2) NOT NULL,
  `cuota_posible` decimal(12,2) NOT NULL,
  `cuota_estimada` decimal(12,2) NOT NULL,
  `tasa_referencial` decimal(6,3) NOT NULL,
  `referencias` text COLLATE utf8mb4_unicode_ci,
  `creada_en` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_solicitud`),
  UNIQUE KEY `uq_solicitud_prestamo` (`id_prestamo`),
  KEY `idx_solicitud_usuario` (`id_usuario`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `usuarios` (
  `id_usuario` int NOT NULL AUTO_INCREMENT,
  `nombre_completo` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `dni` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `telefono` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `correo` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `direccion` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `fecha_nacimiento` date DEFAULT NULL,
  `fecha_registro` datetime DEFAULT CURRENT_TIMESTAMP,
  `estado` enum('activo','inactivo','pendiente','rechazado') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'activo',
  `password` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `foto` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `rol_id` int DEFAULT NULL,
  `motivo_rechazo` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id_usuario`),
  UNIQUE KEY `dni` (`dni`),
  UNIQUE KEY `correo` (`correo`),
  KEY `rol_id` (`rol_id`),
  CONSTRAINT `usuarios_ibfk_1` FOREIGN KEY (`rol_id`) REFERENCES `roles` (`id_rol`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Roles base
INSERT INTO roles (id_rol, nombre, descripcion) VALUES (1, 'Administrador', 'Acceso total al sistema') ON DUPLICATE KEY UPDATE nombre = VALUES(nombre);
INSERT INTO roles (id_rol, nombre, descripcion) VALUES (2, 'Socio', 'Usuario regular de la cooperativa') ON DUPLICATE KEY UPDATE nombre = VALUES(nombre);
INSERT INTO roles (id_rol, nombre, descripcion) VALUES (3, 'Contador', 'Gestión financiera y reportes') ON DUPLICATE KEY UPDATE nombre = VALUES(nombre);
INSERT INTO roles (id_rol, nombre, descripcion) VALUES (5, 'Super Administrador', 'Control total y configuración') ON DUPLICATE KEY UPDATE nombre = VALUES(nombre);

SET FOREIGN_KEY_CHECKS = 1;
