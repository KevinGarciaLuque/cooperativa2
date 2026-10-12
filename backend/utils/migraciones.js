// Migraciones versionadas: cada una se aplica una sola vez y queda registrada.
// Todas son aditivas (tablas nuevas) y no modifican ni borran datos existentes.
const pool = require("../db");

const MIGRACIONES = [
  {
    id: "2026_10_001_caja",
    descripcion: "Libro de caja y cierres diarios",
    async up(conn) {
      await conn.query(`
        CREATE TABLE IF NOT EXISTS caja_movimientos (
          id_movimiento BIGINT AUTO_INCREMENT PRIMARY KEY,
          fecha DATETIME NOT NULL,
          tipo ENUM('ingreso','egreso') NOT NULL,
          categoria VARCHAR(40) NOT NULL,
          monto DECIMAL(12,2) NOT NULL,
          metodo VARCHAR(30) NOT NULL DEFAULT 'efectivo',
          descripcion VARCHAR(255) NULL,
          referencia_tipo VARCHAR(30) NULL,
          referencia_id INT NULL,
          id_socio INT NULL,
          id_registrado_por INT NULL,
          origen VARCHAR(20) NOT NULL DEFAULT 'sistema',
          INDEX idx_caja_fecha (fecha),
          INDEX idx_caja_ref (referencia_tipo, referencia_id)
        )
      `);
      await conn.query(`
        CREATE TABLE IF NOT EXISTS cierres_caja (
          id_cierre INT AUTO_INCREMENT PRIMARY KEY,
          fecha DATE NOT NULL,
          saldo_inicial DECIMAL(12,2) NOT NULL DEFAULT 0,
          ingresos_efectivo DECIMAL(12,2) NOT NULL DEFAULT 0,
          egresos_efectivo DECIMAL(12,2) NOT NULL DEFAULT 0,
          efectivo_esperado DECIMAL(12,2) NOT NULL DEFAULT 0,
          efectivo_contado DECIMAL(12,2) NOT NULL DEFAULT 0,
          diferencia DECIMAL(12,2) NOT NULL DEFAULT 0,
          observacion VARCHAR(255) NULL,
          id_cerrado_por INT NULL,
          fecha_cierre DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY uq_cierre_fecha (fecha)
        )
      `);
    },
  },
  {
    id: "2026_10_002_pagos_anulados",
    descripcion: "Archivo de pagos anulados (auditoría)",
    async up(conn) {
      await conn.query(`
        CREATE TABLE IF NOT EXISTS pagos_anulados (
          id_anulacion INT AUTO_INCREMENT PRIMARY KEY,
          id_pago INT NOT NULL,
          id_prestamo INT NOT NULL,
          monto_pagado DECIMAL(12,2) NOT NULL,
          monto_capital DECIMAL(12,2) NULL,
          monto_interes DECIMAL(12,2) NULL,
          metodo_pago VARCHAR(50) NULL,
          saldo_restante DECIMAL(12,2) NULL,
          fecha_pago DATETIME NULL,
          motivo VARCHAR(255) NULL,
          anulado_por INT NULL,
          fecha_anulacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_anulado_prestamo (id_prestamo)
        )
      `);
    },
  },
  {
    id: "2026_10_003_caja_historial",
    descripcion: "Carga inicial del libro de caja con pagos, aportaciones y desembolsos existentes",
    async up(conn) {
      const [[{ n }]] = await conn.query("SELECT COUNT(*) AS n FROM caja_movimientos");
      if (n > 0) return; // ya tiene datos: no duplicar

      await conn.query(`
        INSERT INTO caja_movimientos
          (fecha, tipo, categoria, monto, metodo, descripcion, referencia_tipo, referencia_id, id_socio, origen)
        SELECT p.fecha_pago, 'ingreso', 'pago_prestamo', p.monto_pagado,
               LOWER(COALESCE(NULLIF(p.metodo_pago, ''), 'efectivo')),
               CONCAT('Pago de préstamo #', p.id_prestamo), 'pago', p.id_pago, pr.id_usuario, 'migracion'
        FROM pagos_prestamo p
        INNER JOIN prestamos pr ON p.id_prestamo = pr.id_prestamo
      `);
      await conn.query(`
        INSERT INTO caja_movimientos
          (fecha, tipo, categoria, monto, metodo, descripcion, referencia_tipo, referencia_id, id_socio, origen)
        SELECT a.fecha, 'ingreso', 'aportacion', a.monto, 'efectivo',
               COALESCE(a.descripcion, 'Aportación'), 'aportacion', a.id_aportacion, a.id_usuario, 'migracion'
        FROM aportaciones a
      `);
      await conn.query(`
        INSERT INTO caja_movimientos
          (fecha, tipo, categoria, monto, metodo, descripcion, referencia_tipo, referencia_id, id_socio, origen)
        SELECT pr.fecha_otorgado, 'egreso', 'desembolso_prestamo', pr.monto, 'efectivo',
               CONCAT('Desembolso de préstamo #', pr.id_prestamo), 'prestamo', pr.id_prestamo, pr.id_usuario, 'migracion'
        FROM prestamos pr
        WHERE pr.estado IN ('activo','mora','pagado') AND pr.fecha_otorgado IS NOT NULL
      `);
    },
  },
  {
    id: "2026_10_004_flujo_prestamos",
    descripcion: "Estados aprobado/rechazado y datos de aprobación en préstamos",
    async up(conn) {
      const [[col]] = await conn.query(
        `SELECT COLUMN_TYPE AS tipo FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'prestamos' AND COLUMN_NAME = 'estado'`
      );
      if (col && !col.tipo.includes("'aprobado'")) {
        await conn.query(
          `ALTER TABLE prestamos MODIFY estado ENUM('pendiente','aprobado','activo','pagado','mora','rechazado') NOT NULL DEFAULT 'pendiente'`
        );
      }
      const agregar = async (nombre, definicion) => {
        const [[existe]] = await conn.query(
          `SELECT COUNT(*) AS n FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'prestamos' AND COLUMN_NAME = ?`,
          [nombre]
        );
        if (!existe.n) await conn.query(`ALTER TABLE prestamos ADD COLUMN ${nombre} ${definicion}`);
      };
      await agregar("aprobado_por", "INT NULL");
      await agregar("fecha_aprobacion", "DATETIME NULL");
      await agregar("motivo_rechazo", "VARCHAR(255) NULL");
    },
  },
  {
    id: "2026_10_005_recibos_cobranza",
    descripcion: "Recibos numerados y gestiones de cobranza",
    async up(conn) {
      await conn.query(`
        CREATE TABLE IF NOT EXISTS recibos (
          id_recibo INT AUTO_INCREMENT PRIMARY KEY,
          tipo VARCHAR(30) NOT NULL,
          referencia_tipo VARCHAR(30) NULL,
          referencia_id INT NULL,
          id_socio INT NULL,
          monto DECIMAL(12,2) NOT NULL,
          metodo VARCHAR(30) NULL,
          concepto VARCHAR(255) NULL,
          detalle TEXT NULL,
          fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          emitido_por INT NULL,
          anulado TINYINT(1) NOT NULL DEFAULT 0,
          INDEX idx_recibo_ref (referencia_tipo, referencia_id),
          INDEX idx_recibo_socio (id_socio)
        )
      `);
      await conn.query(`
        CREATE TABLE IF NOT EXISTS gestiones_cobro (
          id_gestion INT AUTO_INCREMENT PRIMARY KEY,
          id_prestamo INT NOT NULL,
          fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          medio VARCHAR(30) NOT NULL DEFAULT 'llamada',
          nota VARCHAR(500) NOT NULL,
          promesa_fecha DATE NULL,
          promesa_monto DECIMAL(12,2) NULL,
          id_usuario INT NULL,
          INDEX idx_gestion_prestamo (id_prestamo)
        )
      `);
    },
  },
  {
    id: "2026_10_006_cierres_mensuales",
    descripcion: "Cierres mensuales congelados",
    async up(conn) {
      await conn.query(`
        CREATE TABLE IF NOT EXISTS cierres_mensuales (
          id_cierre INT AUTO_INCREMENT PRIMARY KEY,
          anio SMALLINT NOT NULL,
          mes TINYINT NOT NULL,
          datos LONGTEXT NOT NULL,
          observacion VARCHAR(255) NULL,
          cerrado_por INT NULL,
          fecha_cierre DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY uq_cierre_mes (anio, mes)
        )
      `);
    },
  },
  {
    id: "2026_10_007_registro_solicitudes",
    descripcion: "Socios pendientes de aprobación y solicitudes de préstamo del socio",
    async up(conn) {
      const [[col]] = await conn.query(
        `SELECT COLUMN_TYPE AS tipo FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'usuarios' AND COLUMN_NAME = 'estado'`
      );
      if (col && !col.tipo.includes("'pendiente'")) {
        await conn.query(
          `ALTER TABLE usuarios MODIFY estado ENUM('activo','inactivo','pendiente','rechazado') NOT NULL DEFAULT 'activo'`
        );
      }
      const [[existe]] = await conn.query(
        `SELECT COUNT(*) AS n FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'usuarios' AND COLUMN_NAME = 'motivo_rechazo'`
      );
      if (!existe.n) await conn.query(`ALTER TABLE usuarios ADD COLUMN motivo_rechazo VARCHAR(255) NULL`);

      await conn.query(`
        CREATE TABLE IF NOT EXISTS solicitudes_prestamo (
          id_solicitud INT AUTO_INCREMENT PRIMARY KEY,
          id_prestamo INT NOT NULL,
          id_usuario INT NOT NULL,
          proposito VARCHAR(30) NOT NULL,
          descripcion VARCHAR(300) NULL,
          ocupacion VARCHAR(30) NOT NULL,
          lugar_trabajo VARCHAR(120) NULL,
          ingreso_mensual DECIMAL(12,2) NOT NULL,
          cuota_posible DECIMAL(12,2) NOT NULL,
          cuota_estimada DECIMAL(12,2) NOT NULL,
          tasa_referencial DECIMAL(6,3) NOT NULL,
          referencias TEXT NULL,
          creada_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY uq_solicitud_prestamo (id_prestamo),
          INDEX idx_solicitud_usuario (id_usuario)
        )
      `);
    },
  },
  {
    id: "2026_10_008_comprobantes_firmados",
    descripcion: "Copias firmadas de los comprobantes de desembolso (foto o archivo)",
    async up(conn) {
      await conn.query(`
        CREATE TABLE IF NOT EXISTS comprobantes_firmados (
          id_comprobante INT AUTO_INCREMENT PRIMARY KEY,
          id_recibo INT NOT NULL,
          id_socio INT NULL,
          nombre_archivo VARCHAR(150) NOT NULL,
          mime VARCHAR(80) NOT NULL,
          tamano INT NOT NULL,
          contenido MEDIUMBLOB NOT NULL,
          subido_por INT NULL,
          subido_por_rol VARCHAR(40) NULL,
          subido_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_comprobante_recibo (id_recibo)
        )
      `);
    },
  },
  {
    id: "2026_10_009_archivos",
    descripcion: "Almacén de imágenes (fotos de perfil y logo) en la base de datos",
    async up(conn) {
      await conn.query(`
        CREATE TABLE IF NOT EXISTS archivos (
          id_archivo INT AUTO_INCREMENT PRIMARY KEY,
          ruta VARCHAR(255) NOT NULL,
          mime VARCHAR(80) NOT NULL,
          tamano INT NOT NULL,
          contenido MEDIUMBLOB NOT NULL,
          creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY uq_archivo_ruta (ruta)
        )
      `);
    },
  },
  {
    id: "2026_10_010_comprobantes_revision",
    descripcion: "Seguimiento de comprobantes firmados revisados por el personal",
    async up(conn) {
      const agregar = async (nombre, definicion) => {
        const [[e]] = await conn.query(
          `SELECT COUNT(*) AS n FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'comprobantes_firmados' AND COLUMN_NAME = ?`,
          [nombre]
        );
        if (!e.n) await conn.query(`ALTER TABLE comprobantes_firmados ADD COLUMN ${nombre} ${definicion}`);
      };
      await agregar("revisado_en", "DATETIME NULL");
      await agregar("revisado_por", "INT NULL");
      // Lo recibido antes de este cambio se considera ya revisado
      await conn.query("UPDATE comprobantes_firmados SET revisado_en = subido_en WHERE revisado_en IS NULL");
    },
  },
];

const aplicarMigraciones = async () => {
  const conn = await pool.getConnection();
  try {
    await conn.query(`
      CREATE TABLE IF NOT EXISTS schema_migraciones (
        id VARCHAR(80) PRIMARY KEY,
        descripcion VARCHAR(255) NULL,
        aplicada_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    const [hechas] = await conn.query("SELECT id FROM schema_migraciones");
    const aplicadas = new Set(hechas.map((r) => r.id));

    for (const m of MIGRACIONES) {
      if (aplicadas.has(m.id)) continue;
      await m.up(conn);
      await conn.query("INSERT INTO schema_migraciones (id, descripcion) VALUES (?, ?)", [
        m.id,
        m.descripcion,
      ]);
      console.log(`📦 Migración aplicada: ${m.id} — ${m.descripcion}`);
    }
  } finally {
    conn.release();
  }
};

module.exports = { aplicarMigraciones };
