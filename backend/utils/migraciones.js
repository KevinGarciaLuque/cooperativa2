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
  {
    id: "2026_10_011_documentos_identidad",
    descripcion: "Fotos del frente y reverso de la identidad del socio (privadas, fuera del almacén público)",
    async up(conn) {
      await conn.query(`
        CREATE TABLE IF NOT EXISTS documentos_identidad (
          id_documento INT AUTO_INCREMENT PRIMARY KEY,
          id_usuario INT NOT NULL,
          lado ENUM('frente','reverso') NOT NULL,
          mime VARCHAR(80) NOT NULL,
          tamano INT NOT NULL,
          contenido MEDIUMBLOB NOT NULL,
          subido_por INT NULL,
          subido_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY uq_identidad_lado (id_usuario, lado)
        )
      `);
    },
  },
  {
    id: "2026_10_012_marca_smartcoop",
    descripcion: "La marca del sitio pasa a ser SmartCoop: nombre, textos que decían Demo y logo predeterminado",
    async up(conn) {
      await conn.query(
        "INSERT INTO configuracion_sitio (clave, valor) VALUES ('site_name', 'SmartCoop') ON DUPLICATE KEY UPDATE valor = 'SmartCoop'"
      );
      // Sin logo subido se usa el de SmartCoop
      await conn.query("DELETE FROM configuracion_sitio WHERE clave = 'logo_url'");
      // Textos de la portada y del inicio de sesión que decían "Demo" o "Tu logo"
      const [filas] = await conn.query(
        "SELECT clave, valor FROM configuracion_sitio WHERE clave LIKE 'home\\_%' OR clave LIKE 'login\\_%'"
      );
      for (const { clave, valor } of filas) {
        const nuevo = String(valor).replace(/\btu logo\b/gi, "SmartCoop").replace(/\bdemo\b/gi, "SmartCoop");
        if (nuevo !== valor) {
          await conn.query("UPDATE configuracion_sitio SET valor = ? WHERE clave = ?", [nuevo, clave]);
        }
      }
    },
  },
  {
    id: "2026_10_013_firmas_usuario",
    descripcion: "Firma digital del personal para los documentos que emite o aprueba",
    async up(conn) {
      await conn.query(`
        CREATE TABLE IF NOT EXISTS firmas_usuario (
          id_usuario INT PRIMARY KEY,
          mime VARCHAR(40) NOT NULL,
          contenido MEDIUMBLOB NOT NULL,
          actualizado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `);
    },
  },
  {
    id: "2026_10_014_recordatorios_pago",
    descripcion: "Recordatorios de pago enviados a los socios (evita repetirlos)",
    async up(conn) {
      await conn.query(`
        CREATE TABLE IF NOT EXISTS recordatorios_pago (
          clave VARCHAR(120) PRIMARY KEY,
          id_prestamo INT NOT NULL,
          tipo VARCHAR(20) NOT NULL,
          medio VARCHAR(20) NOT NULL DEFAULT 'correo',
          enviado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_recordatorio_prestamo (id_prestamo)
        )
      `);
    },
  },
  {
    id: "2026_10_015_pagos_reportados",
    descripcion: "Pagos por transferencia o depósito que reporta el socio con su comprobante",
    async up(conn) {
      await conn.query(`
        CREATE TABLE IF NOT EXISTS pagos_reportados (
          id_reporte INT AUTO_INCREMENT PRIMARY KEY,
          id_prestamo INT NOT NULL,
          id_usuario INT NOT NULL,
          monto DECIMAL(12,2) NOT NULL,
          metodo VARCHAR(30) NOT NULL,
          banco VARCHAR(60) NULL,
          referencia VARCHAR(60) NULL,
          fecha_pago DATE NOT NULL,
          nota VARCHAR(300) NULL,
          nombre_archivo VARCHAR(150) NOT NULL,
          mime VARCHAR(80) NOT NULL,
          tamano INT NOT NULL,
          contenido MEDIUMBLOB NOT NULL,
          estado ENUM('pendiente','confirmado','rechazado') NOT NULL DEFAULT 'pendiente',
          motivo_rechazo VARCHAR(255) NULL,
          id_pago INT NULL,
          revisado_por INT NULL,
          revisado_en DATETIME NULL,
          creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_reporte_estado (estado),
          INDEX idx_reporte_usuario (id_usuario),
          INDEX idx_reporte_prestamo (id_prestamo)
        )
      `);
    },
  },
  {
    id: "2026_10_016_notificaciones",
    descripcion: "Notificaciones dentro de la app para los socios (campanita)",
    async up(conn) {
      await conn.query(`
        CREATE TABLE IF NOT EXISTS notificaciones (
          id_notificacion INT AUTO_INCREMENT PRIMARY KEY,
          id_usuario INT NOT NULL,
          tipo VARCHAR(30) NOT NULL DEFAULT 'aviso',
          titulo VARCHAR(150) NOT NULL,
          mensaje VARCHAR(600) NULL,
          id_recibo INT NULL,
          leida TINYINT(1) NOT NULL DEFAULT 0,
          creada_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_notif_usuario (id_usuario, leida)
        )
      `);
    },
  },
  {
    id: "2026_10_017_firmas_documento",
    descripcion: "Firma digital del socio en sus recibos y comprobantes (copia de la firma al momento de firmar)",
    async up(conn) {
      await conn.query(`
        CREATE TABLE IF NOT EXISTS firmas_documento (
          id_recibo INT PRIMARY KEY,
          id_usuario INT NOT NULL,
          mime VARCHAR(40) NOT NULL,
          contenido MEDIUMBLOB NOT NULL,
          ip VARCHAR(60) NULL,
          firmado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_firma_doc_usuario (id_usuario)
        )
      `);
    },
  },
  {
    id: "2026_10_018_politicas",
    descripcion: "Políticas de la cooperativa con versiones y aceptación de los socios (borradores iniciales sin publicar)",
    async up(conn) {
      await conn.query(`
        CREATE TABLE IF NOT EXISTS politicas (
          id_politica INT AUTO_INCREMENT PRIMARY KEY,
          clave VARCHAR(40) NULL UNIQUE,
          titulo VARCHAR(150) NOT NULL,
          contenido MEDIUMTEXT NOT NULL,
          obligatoria TINYINT(1) NOT NULL DEFAULT 1,
          activa TINYINT(1) NOT NULL DEFAULT 1,
          orden INT NOT NULL DEFAULT 0,
          version INT NOT NULL DEFAULT 0,
          version_requerida INT NOT NULL DEFAULT 0,
          actualizado_por INT NULL,
          actualizado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `);
      await conn.query(`
        CREATE TABLE IF NOT EXISTS politicas_versiones (
          id_politica INT NOT NULL,
          version INT NOT NULL,
          titulo VARCHAR(150) NOT NULL,
          contenido MEDIUMTEXT NOT NULL,
          publicada_por INT NULL,
          publicada_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (id_politica, version)
        )
      `);
      await conn.query(`
        CREATE TABLE IF NOT EXISTS politicas_aceptaciones (
          id_aceptacion INT AUTO_INCREMENT PRIMARY KEY,
          id_politica INT NOT NULL,
          id_usuario INT NOT NULL,
          version INT NOT NULL,
          ip VARCHAR(60) NULL,
          aceptada_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY uq_aceptacion (id_politica, id_usuario, version),
          INDEX idx_aceptacion_usuario (id_usuario)
        )
      `);
      const { BORRADORES } = require("./politicas");
      for (const [i, b] of BORRADORES.entries()) {
        await conn.query(
          "INSERT IGNORE INTO politicas (clave, titulo, contenido, orden) VALUES (?, ?, ?, ?)",
          [b.clave, b.titulo, b.contenido, i + 1]
        );
      }
    },
  },
  {
    id: "2026_10_019_consolidaciones",
    descripcion: "Consolidación de préstamos",
    async up(conn) {
      const [[col]] = await conn.query(
        `SELECT COLUMN_TYPE AS tipo FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'prestamos' AND COLUMN_NAME = 'estado'`
      );
      if (col && !col.tipo.includes("'consolidado'")) {
        await conn.query(
          `ALTER TABLE prestamos MODIFY estado ENUM('pendiente','aprobado','activo','pagado','mora','rechazado','consolidado') NOT NULL DEFAULT 'pendiente'`
        );
      }
      const agregar = async (nombre, definicion) => {
        const [[e]] = await conn.query(
          `SELECT COUNT(*) AS n FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'prestamos' AND COLUMN_NAME = ?`,
          [nombre]
        );
        if (!e.n) await conn.query(`ALTER TABLE prestamos ADD COLUMN ${nombre} ${definicion}`);
      };
      await agregar("consolidado_en", "DATETIME NULL");
      await agregar("consolidado_en_prestamo", "INT NULL");

      await conn.query(`
        CREATE TABLE IF NOT EXISTS consolidaciones (
          id_consolidacion INT AUTO_INCREMENT PRIMARY KEY,
          id_usuario INT NOT NULL,
          id_prestamo_nuevo INT NOT NULL,
          prestamos_origen TEXT NOT NULL,
          capital DECIMAL(12,2) NOT NULL,
          interes_capitalizado DECIMAL(12,2) NOT NULL DEFAULT 0,
          mora_capitalizada DECIMAL(12,2) NOT NULL DEFAULT 0,
          mora_condonada DECIMAL(12,2) NOT NULL DEFAULT 0,
          monto_adicional DECIMAL(12,2) NOT NULL DEFAULT 0,
          monto_nuevo DECIMAL(12,2) NOT NULL,
          tasa_mensual DECIMAL(6,3) NOT NULL,
          plazo_meses INT NOT NULL,
          motivo VARCHAR(255) NULL,
          creada_por INT NULL,
          creada_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_consolidacion_usuario (id_usuario),
          INDEX idx_consolidacion_fecha (creada_en)
        )
      `);
    },
  },
  {
    id: "2026_11_001_numero_socio",
    descripcion: "Número de socio correlativo",
    async up(conn) {
      const [[e]] = await conn.query(
        `SELECT COUNT(*) AS n FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'usuarios' AND COLUMN_NAME = 'numero_socio'`
      );
      if (!e.n) {
        await conn.query(`ALTER TABLE usuarios ADD COLUMN numero_socio INT NULL AFTER id_usuario`);
        await conn.query(`ALTER TABLE usuarios ADD UNIQUE KEY uq_numero_socio (numero_socio)`);
      }
      // Los socios que ya existen reciben su número por orden de registro (el más antiguo, el 1)
      const [[{ ultimo }]] = await conn.query(`SELECT COALESCE(MAX(numero_socio), 0) AS ultimo FROM usuarios`);
      const [socios] = await conn.query(
        `SELECT u.id_usuario FROM usuarios u
           INNER JOIN roles r ON r.id_rol = u.rol_id AND r.nombre = 'Socio'
          WHERE u.numero_socio IS NULL AND u.estado IN ('activo', 'inactivo')
          ORDER BY u.fecha_registro, u.id_usuario`
      );
      let n = ultimo;
      for (const { id_usuario } of socios) {
        await conn.query(`UPDATE usuarios SET numero_socio = ? WHERE id_usuario = ?`, [++n, id_usuario]);
      }
    },
  },
  {
    id: "2026_11_002_productos_credito",
    descripcion: "Productos de crédito y producto de cada préstamo",
    async up(conn) {
      await conn.query(`
        CREATE TABLE IF NOT EXISTS productos_credito (
          id_producto INT AUTO_INCREMENT PRIMARY KEY,
          nombre VARCHAR(80) NOT NULL,
          descripcion VARCHAR(300) NULL,
          tasa_mensual DECIMAL(6,3) NOT NULL,
          monto_min DECIMAL(12,2) NOT NULL DEFAULT 0,
          monto_max DECIMAL(12,2) NOT NULL,
          plazo_min INT NOT NULL DEFAULT 1,
          plazo_max INT NOT NULL,
          garantia_requerida ENUM('ninguna','aval','real') NOT NULL DEFAULT 'aval',
          visible_socios TINYINT(1) NOT NULL DEFAULT 1,
          activo TINYINT(1) NOT NULL DEFAULT 1,
          orden INT NOT NULL DEFAULT 0,
          creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          actualizado_en DATETIME NULL,
          UNIQUE KEY uq_producto_nombre (nombre)
        )
      `);
      const [[e]] = await conn.query(
        `SELECT COUNT(*) AS n FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'prestamos' AND COLUMN_NAME = 'id_producto'`
      );
      if (!e.n) {
        await conn.query(`ALTER TABLE prestamos ADD COLUMN id_producto INT NULL`);
        await conn.query(`ALTER TABLE prestamos ADD INDEX idx_prestamo_producto (id_producto)`);
      }
    },
  },
  {
    id: "2026_11_003_garantias",
    descripcion: "Garantías de los préstamos (el aval de las solicitudes pasa a ser garantía)",
    async up(conn) {
      await conn.query(`
        CREATE TABLE IF NOT EXISTS garantias (
          id_garantia INT AUTO_INCREMENT PRIMARY KEY,
          id_prestamo INT NOT NULL,
          tipo ENUM('aval','prendaria','hipotecaria','ahorros','otra') NOT NULL,
          descripcion VARCHAR(300) NULL,
          valor_estimado DECIMAL(12,2) NULL,
          aval_nombre VARCHAR(100) NULL,
          aval_identidad VARCHAR(20) NULL,
          aval_telefono VARCHAR(20) NULL,
          aval_parentesco VARCHAR(50) NULL,
          estado ENUM('vigente','liberada') NOT NULL DEFAULT 'vigente',
          motivo_liberacion VARCHAR(255) NULL,
          liberada_en DATETIME NULL,
          liberada_por INT NULL,
          registrada_por INT NULL,
          registrada_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_garantia_prestamo (id_prestamo)
        )
      `);
      // El aval que el socio puso en su solicitud queda como garantía fiduciaria del préstamo
      const [solicitudes] = await conn.query(
        `SELECT s.id_prestamo, s.referencias, s.creada_en FROM solicitudes_prestamo s
         INNER JOIN prestamos p ON p.id_prestamo = s.id_prestamo
         WHERE p.estado <> 'rechazado'
           AND NOT EXISTS (SELECT 1 FROM garantias g WHERE g.id_prestamo = s.id_prestamo AND g.tipo = 'aval')`
      );
      for (const s of solicitudes) {
        let refs = [];
        try {
          refs = JSON.parse(s.referencias || "[]");
        } catch {
          refs = [];
        }
        const aval = refs.find((r) => r.tipo === "aval") || refs[0];
        if (!aval?.nombre) continue;
        await conn.query(
          `INSERT INTO garantias (id_prestamo, tipo, descripcion, aval_nombre, aval_telefono, aval_parentesco, registrada_en)
           VALUES (?, 'aval', 'Aval indicado en la solicitud', ?, ?, ?, ?)`,
          [s.id_prestamo, String(aval.nombre).substring(0, 100), String(aval.telefono || "").substring(0, 20) || null,
            String(aval.parentesco || "").substring(0, 50) || null, s.creada_en]
        );
      }
    },
  },
  {
    id: "2026_11_004_contabilidad",
    descripcion: "Contabilidad de partida doble: catálogo de cuentas y partidas",
    async up(conn) {
      await conn.query(`
        CREATE TABLE IF NOT EXISTS cuentas_contables (
          id_cuenta_contable INT AUTO_INCREMENT PRIMARY KEY,
          codigo VARCHAR(20) NOT NULL,
          nombre VARCHAR(120) NOT NULL,
          tipo ENUM('activo','pasivo','patrimonio','ingreso','gasto') NOT NULL,
          naturaleza ENUM('deudora','acreedora') NOT NULL,
          clave VARCHAR(40) NULL,
          id_padre INT NULL,
          acepta_movimientos TINYINT(1) NOT NULL DEFAULT 1,
          activa TINYINT(1) NOT NULL DEFAULT 1,
          UNIQUE KEY uq_cuenta_codigo (codigo),
          UNIQUE KEY uq_cuenta_clave (clave)
        )
      `);
      await conn.query(`
        CREATE TABLE IF NOT EXISTS partidas (
          id_partida INT AUTO_INCREMENT PRIMARY KEY,
          numero INT NOT NULL,
          fecha DATE NOT NULL,
          concepto VARCHAR(255) NOT NULL,
          origen VARCHAR(30) NOT NULL,
          origen_id INT NULL,
          total DECIMAL(14,2) NOT NULL,
          creada_por INT NULL,
          creada_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY uq_partida_numero (numero),
          INDEX idx_partida_fecha (fecha),
          INDEX idx_partida_origen (origen, origen_id)
        )
      `);
      await conn.query(`
        CREATE TABLE IF NOT EXISTS partida_lineas (
          id_linea INT AUTO_INCREMENT PRIMARY KEY,
          id_partida INT NOT NULL,
          id_cuenta_contable INT NOT NULL,
          debe DECIMAL(14,2) NOT NULL DEFAULT 0,
          haber DECIMAL(14,2) NOT NULL DEFAULT 0,
          INDEX idx_linea_partida (id_partida),
          INDEX idx_linea_cuenta (id_cuenta_contable)
        )
      `);
      // Operaciones cuya partida no se pudo registrar (las revisa el contador)
      await conn.query(`
        CREATE TABLE IF NOT EXISTS contabilidad_errores (
          id_error INT AUTO_INCREMENT PRIMARY KEY,
          fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          origen VARCHAR(30) NULL,
          origen_id INT NULL,
          concepto VARCHAR(255) NULL,
          error VARCHAR(500) NOT NULL,
          resuelto TINYINT(1) NOT NULL DEFAULT 0
        )
      `);
      await require("./contabilidad").sembrarCatalogo(conn);
    },
  },
  {
    id: "2026_11_005_ahorro",
    descripcion: "Productos de ahorro, intereses sobre ahorros y depósitos a plazo fijo",
    async up(conn) {
      await conn.query(`
        CREATE TABLE IF NOT EXISTS productos_ahorro (
          id_producto_ahorro INT AUTO_INCREMENT PRIMARY KEY,
          nombre VARCHAR(60) NOT NULL,
          descripcion VARCHAR(300) NULL,
          clase ENUM('aportacion','ahorro','plazo_fijo') NOT NULL,
          tasa_anual DECIMAL(6,3) NOT NULL DEFAULT 0,
          saldo_minimo DECIMAL(12,2) NOT NULL DEFAULT 0,
          permite_retiros TINYINT(1) NOT NULL DEFAULT 1,
          apertura_automatica TINYINT(1) NOT NULL DEFAULT 0,
          monto_min DECIMAL(12,2) NOT NULL DEFAULT 0,
          plazo_min_dias INT NOT NULL DEFAULT 30,
          plazo_max_dias INT NOT NULL DEFAULT 1825,
          penalizacion_pct DECIMAL(5,2) NOT NULL DEFAULT 50,
          activo TINYINT(1) NOT NULL DEFAULT 1,
          orden INT NOT NULL DEFAULT 0,
          UNIQUE KEY uq_producto_ahorro_nombre (nombre)
        ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      // Los tres tipos de cuenta de siempre, sin interés (nada cambia hasta que se configure)
      for (const [nombre, clase, orden] of [["Aportaciones", "aportacion", 1], ["Vivienda", "ahorro", 2], ["Pensiones", "ahorro", 3]]) {
        await conn.query(
          `INSERT IGNORE INTO productos_ahorro (nombre, clase, apertura_automatica, orden) VALUES (?, ?, 1, ?)`,
          [nombre, clase, orden]
        );
      }
      // El tipo de cuenta deja de ser una lista fija (los valores existentes se conservan)
      const [[col]] = await conn.query(
        `SELECT DATA_TYPE AS tipo FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cuentas' AND COLUMN_NAME = 'tipo_cuenta'`
      );
      if (col && col.tipo === "enum") {
        await conn.query(`ALTER TABLE cuentas MODIFY tipo_cuenta VARCHAR(60) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL`);
      }
      const [[e]] = await conn.query(
        `SELECT COUNT(*) AS n FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cuentas' AND COLUMN_NAME = 'id_producto_ahorro'`
      );
      if (!e.n) await conn.query(`ALTER TABLE cuentas ADD COLUMN id_producto_ahorro INT NULL`);
      await conn.query(
        `UPDATE cuentas c INNER JOIN productos_ahorro p
           ON LOWER(p.nombre) COLLATE utf8mb4_unicode_ci = LOWER(c.tipo_cuenta) COLLATE utf8mb4_unicode_ci
         SET c.id_producto_ahorro = p.id_producto_ahorro WHERE c.id_producto_ahorro IS NULL`
      );

      // Foto diaria del saldo de cada cuenta (para el interés sobre el saldo promedio diario)
      await conn.query(`
        CREATE TABLE IF NOT EXISTS saldos_diarios (
          id_cuenta INT NOT NULL,
          fecha DATE NOT NULL,
          saldo DECIMAL(14,2) NOT NULL,
          PRIMARY KEY (id_cuenta, fecha)
        )
      `);
      await conn.query(`
        CREATE TABLE IF NOT EXISTS intereses_ahorro (
          id_interes INT AUTO_INCREMENT PRIMARY KEY,
          id_cuenta INT NOT NULL,
          anio SMALLINT NOT NULL,
          mes TINYINT NOT NULL,
          saldo_promedio DECIMAL(14,2) NOT NULL,
          tasa_anual DECIMAL(6,3) NOT NULL,
          dias INT NOT NULL,
          interes_bruto DECIMAL(12,2) NOT NULL,
          retencion DECIMAL(12,2) NOT NULL DEFAULT 0,
          interes_neto DECIMAL(12,2) NOT NULL,
          acreditado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY uq_interes_cuenta_mes (id_cuenta, anio, mes)
        )
      `);
      await conn.query(`
        CREATE TABLE IF NOT EXISTS depositos_plazo (
          id_deposito INT AUTO_INCREMENT PRIMARY KEY,
          id_usuario INT NOT NULL,
          id_producto_ahorro INT NOT NULL,
          monto DECIMAL(14,2) NOT NULL,
          tasa_anual DECIMAL(6,3) NOT NULL,
          plazo_dias INT NOT NULL,
          penalizacion_pct DECIMAL(5,2) NOT NULL,
          fecha_inicio DATE NOT NULL,
          fecha_vencimiento DATE NOT NULL,
          origen VARCHAR(20) NOT NULL,
          estado ENUM('vigente','pagado','cancelado') NOT NULL DEFAULT 'vigente',
          interes_pagado DECIMAL(12,2) NULL,
          retencion DECIMAL(12,2) NULL,
          pagado_en DATETIME NULL,
          destino_pago VARCHAR(20) NULL,
          creado_por INT NULL,
          creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_plazo_socio (id_usuario),
          INDEX idx_plazo_estado (estado, fecha_vencimiento)
        )
      `);
      // Cuentas contables nuevas (plazo fijo, retenciones, reservas) si la contabilidad ya existía
      await require("./contabilidad").sembrarCatalogo(conn);
    },
  },
  {
    id: "2026_11_006_excedentes",
    descripcion: "Distribución de excedentes del ejercicio",
    async up(conn) {
      await conn.query(`
        CREATE TABLE IF NOT EXISTS excedentes_ejercicio (
          id_ejercicio INT AUTO_INCREMENT PRIMARY KEY,
          anio SMALLINT NOT NULL,
          origen VARCHAR(20) NOT NULL,
          excedente DECIMAL(14,2) NOT NULL,
          reservas TEXT NOT NULL,
          pct_aportaciones DECIMAL(5,2) NOT NULL,
          por_aportaciones DECIMAL(14,2) NOT NULL,
          por_intereses DECIMAL(14,2) NOT NULL,
          repartido DECIMAL(14,2) NOT NULL,
          aplicado_por INT NULL,
          aplicado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY uq_excedentes_anio (anio)
        )
      `);
      await conn.query(`
        CREATE TABLE IF NOT EXISTS excedentes_socios (
          id INT AUTO_INCREMENT PRIMARY KEY,
          id_ejercicio INT NOT NULL,
          id_usuario INT NOT NULL,
          base_aportaciones DECIMAL(14,2) NOT NULL,
          base_intereses DECIMAL(14,2) NOT NULL,
          por_aportaciones DECIMAL(14,2) NOT NULL,
          por_intereses DECIMAL(14,2) NOT NULL,
          total DECIMAL(14,2) NOT NULL,
          INDEX idx_excedente_socio (id_usuario)
        )
      `);
    },
  },
  {
    id: "2026_11_007_cumplimiento",
    descripcion: "Expediente del socio (cumplimiento), beneficiarios y alertas de prevención de lavado",
    async up(conn) {
      const columnas = [
        ["genero", "VARCHAR(20) NULL"],
        ["estado_civil", "VARCHAR(20) NULL"],
        ["nacionalidad", "VARCHAR(60) NULL"],
        ["profesion", "VARCHAR(100) NULL"],
        ["actividad_economica", "VARCHAR(150) NULL"],
        ["lugar_trabajo", "VARCHAR(150) NULL"],
        ["ingreso_mensual", "DECIMAL(12,2) NULL"],
        ["origen_fondos", "VARCHAR(255) NULL"],
        ["es_pep", "TINYINT(1) NOT NULL DEFAULT 0"],
        ["pep_detalle", "VARCHAR(255) NULL"],
        ["perfil_actualizado_en", "DATETIME NULL"],
      ];
      for (const [nombre, def] of columnas) {
        const [[e]] = await conn.query(
          `SELECT COUNT(*) AS n FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'usuarios' AND COLUMN_NAME = ?`,
          [nombre]
        );
        if (!e.n) await conn.query(`ALTER TABLE usuarios ADD COLUMN ${nombre} ${def}`);
      }
      // Estados del socio que se retira o fallece (los existentes no cambian)
      const [[col]] = await conn.query(
        `SELECT COLUMN_TYPE AS tipo FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'usuarios' AND COLUMN_NAME = 'estado'`
      );
      // (también "suspendido", que la pantalla de usuarios ya ofrecía)
      if (col && col.tipo.startsWith("enum(") && !col.tipo.includes("'fallecido'")) {
        // Se conservan todos los valores que ya tenga la columna y se agregan los nuevos
        const actuales = [...col.tipo.matchAll(/'((?:[^']|'')*)'/g)].map((m) => m[1]);
        const todos = [...new Set([...actuales, "activo", "inactivo", "pendiente", "rechazado", "suspendido", "retirado", "fallecido"])];
        await conn.query(
          `ALTER TABLE usuarios MODIFY estado ENUM(${todos.map((v) => conn.escape(v)).join(",")}) NOT NULL DEFAULT 'activo'`
        );
      }
      await conn.query(`
        CREATE TABLE IF NOT EXISTS beneficiarios (
          id_beneficiario INT AUTO_INCREMENT PRIMARY KEY,
          id_usuario INT NOT NULL,
          nombre VARCHAR(100) NOT NULL,
          parentesco VARCHAR(50) NULL,
          identidad VARCHAR(20) NULL,
          telefono VARCHAR(20) NULL,
          porcentaje DECIMAL(5,2) NOT NULL,
          INDEX idx_beneficiario_socio (id_usuario)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      await conn.query(`
        CREATE TABLE IF NOT EXISTS alertas_cumplimiento (
          id_alerta INT AUTO_INCREMENT PRIMARY KEY,
          fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          id_socio INT NOT NULL,
          tipo VARCHAR(30) NOT NULL,
          monto DECIMAL(14,2) NOT NULL,
          detalle VARCHAR(500) NULL,
          id_movimiento_caja BIGINT NULL,
          estado ENUM('pendiente','revisada','reportada') NOT NULL DEFAULT 'pendiente',
          nota VARCHAR(500) NULL,
          revisado_por INT NULL,
          revisado_en DATETIME NULL,
          INDEX idx_alerta_estado (estado, fecha),
          INDEX idx_alerta_socio (id_socio, tipo, fecha)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
    },
  },
  {
    id: "2026_11_008_comite_credito",
    descripcion: "Comité de crédito: miembros y votos por préstamo",
    async up(conn) {
      await conn.query(`
        CREATE TABLE IF NOT EXISTS comite_credito (
          id_usuario INT PRIMARY KEY,
          cargo VARCHAR(60) NULL,
          agregado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      await conn.query(`
        CREATE TABLE IF NOT EXISTS prestamo_votos (
          id_voto INT AUTO_INCREMENT PRIMARY KEY,
          id_prestamo INT NOT NULL,
          id_usuario INT NOT NULL,
          voto ENUM('aprobar','rechazar') NOT NULL,
          comentario VARCHAR(500) NULL,
          monto DECIMAL(14,2) NOT NULL,
          fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY uq_voto (id_prestamo, id_usuario),
          INDEX idx_voto_prestamo (id_prestamo)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
    },
  },
  {
    id: "2026_11_009_turnos_caja",
    descripcion: "Sucursales y turnos de caja por cajero",
    async up(conn) {
      await conn.query(`
        CREATE TABLE IF NOT EXISTS sucursales (
          id_sucursal INT AUTO_INCREMENT PRIMARY KEY,
          nombre VARCHAR(100) NOT NULL,
          direccion VARCHAR(255) NULL,
          activa TINYINT(1) NOT NULL DEFAULT 1,
          creada_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      const [[hay]] = await conn.query("SELECT COUNT(*) AS n FROM sucursales");
      if (!hay.n) await conn.query("INSERT INTO sucursales (nombre) VALUES ('Oficina principal')");
      await conn.query(`
        CREATE TABLE IF NOT EXISTS cajas_turnos (
          id_turno INT AUTO_INCREMENT PRIMARY KEY,
          id_cajero INT NOT NULL,
          id_sucursal INT NOT NULL,
          abierto_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          fondo_inicial DECIMAL(14,2) NOT NULL DEFAULT 0,
          cerrado_en DATETIME NULL,
          ingresos_efectivo DECIMAL(14,2) NULL,
          egresos_efectivo DECIMAL(14,2) NULL,
          efectivo_esperado DECIMAL(14,2) NULL,
          efectivo_contado DECIMAL(14,2) NULL,
          diferencia DECIMAL(14,2) NULL,
          observacion VARCHAR(255) NULL,
          estado ENUM('abierto','cerrado') NOT NULL DEFAULT 'abierto',
          INDEX idx_turno_cajero (id_cajero, estado),
          INDEX idx_turno_fecha (abierto_en)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      const columnas = [
        ["usuarios", "id_sucursal", "INT NULL"],
        ["caja_movimientos", "id_turno", "INT NULL"],
        ["caja_movimientos", "id_sucursal", "INT NULL"],
      ];
      for (const [tabla, nombre, def] of columnas) {
        const [[e]] = await conn.query(
          `SELECT COUNT(*) AS n FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
          [tabla, nombre]
        );
        if (!e.n) await conn.query(`ALTER TABLE ${tabla} ADD COLUMN ${nombre} ${def}`);
      }
      const [[idx]] = await conn.query(
        `SELECT COUNT(*) AS n FROM information_schema.STATISTICS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'caja_movimientos' AND INDEX_NAME = 'idx_caja_turno'`
      );
      if (!idx.n) await conn.query("ALTER TABLE caja_movimientos ADD INDEX idx_caja_turno (id_turno)");
    },
  },
  {
    id: "2026_11_010_verificacion_dos_pasos",
    descripcion: "Códigos de verificación en dos pasos",
    async up(conn) {
      await conn.query(`
        CREATE TABLE IF NOT EXISTS codigos_verificacion (
          id_codigo INT AUTO_INCREMENT PRIMARY KEY,
          id_usuario INT NOT NULL,
          codigo_hash CHAR(64) NOT NULL,
          creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          expira_en DATETIME NOT NULL,
          intentos INT NOT NULL DEFAULT 0,
          usado TINYINT(1) NOT NULL DEFAULT 0,
          INDEX idx_codigo_usuario (id_usuario, usado)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
    },
  },
  {
    id: "2026_11_011_sucursales_operacion",
    descripcion: "Socios y personal por sucursal; movimientos de caja con su sucursal",
    async up(conn) {
      const [[e]] = await conn.query(
        `SELECT COUNT(*) AS n FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'usuarios' AND COLUMN_NAME = 'sucursal_restringida'`
      );
      if (!e.n) await conn.query("ALTER TABLE usuarios ADD COLUMN sucursal_restringida TINYINT(1) NOT NULL DEFAULT 0");
      const [[idx]] = await conn.query(
        `SELECT COUNT(*) AS n FROM information_schema.STATISTICS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'usuarios' AND INDEX_NAME = 'idx_usuario_sucursal'`
      );
      if (!idx.n) await conn.query("ALTER TABLE usuarios ADD INDEX idx_usuario_sucursal (id_sucursal)");
      // Todo lo que ya existe queda en la sucursal principal (una cooperativa con una sola
      // oficina no nota ningún cambio)
      const [[p]] = await conn.query("SELECT id_sucursal FROM sucursales ORDER BY id_sucursal LIMIT 1");
      if (p) {
        await conn.query("UPDATE usuarios SET id_sucursal = ? WHERE id_sucursal IS NULL", [p.id_sucursal]);
        await conn.query("UPDATE caja_movimientos SET id_sucursal = ? WHERE id_sucursal IS NULL", [p.id_sucursal]);
      }
      const [[ic]] = await conn.query(
        `SELECT COUNT(*) AS n FROM information_schema.STATISTICS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'caja_movimientos' AND INDEX_NAME = 'idx_caja_sucursal'`
      );
      if (!ic.n) await conn.query("ALTER TABLE caja_movimientos ADD INDEX idx_caja_sucursal (id_sucursal, fecha)");
    },
  },
  {
    id: "2026_11_012_recibos_sucursal",
    descripcion: "Sucursal donde se emitió cada recibo",
    async up(conn) {
      const [[e]] = await conn.query(
        `SELECT COUNT(*) AS n FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'recibos' AND COLUMN_NAME = 'id_sucursal'`
      );
      if (!e.n) await conn.query("ALTER TABLE recibos ADD COLUMN id_sucursal INT NULL");
      const [[p]] = await conn.query("SELECT id_sucursal FROM sucursales ORDER BY id_sucursal LIMIT 1");
      if (p) await conn.query("UPDATE recibos SET id_sucursal = ? WHERE id_sucursal IS NULL", [p.id_sucursal]);
    },
  },
  {
    id: "2026_11_013_datos_ampliados",
    descripcion: "Datos ampliados del socio (escolaridad, cónyuge, ubicación) y del crédito (línea, promotor, pagaré)",
    async up(conn) {
      const columnas = [
        ["usuarios", "escolaridad", "VARCHAR(40) NULL"],
        ["usuarios", "conyuge_nombre", "VARCHAR(100) NULL"],
        ["usuarios", "conyuge_identidad", "VARCHAR(20) NULL"],
        ["usuarios", "conyuge_telefono", "VARCHAR(20) NULL"],
        ["usuarios", "departamento", "VARCHAR(60) NULL"],
        ["usuarios", "municipio", "VARCHAR(80) NULL"],
        ["usuarios", "comunidad", "VARCHAR(120) NULL"],
        ["usuarios", "fecha_ingreso", "DATE NULL"],
        ["prestamos", "linea_credito", "VARCHAR(50) NULL"],
        ["prestamos", "destino", "VARCHAR(150) NULL"],
        ["prestamos", "id_promotor", "INT NULL"],
        ["prestamos", "numero_pagare", "VARCHAR(30) NULL"],
        ["prestamos", "numero_acta", "VARCHAR(30) NULL"],
        ["prestamos", "numero_cheque", "VARCHAR(30) NULL"],
      ];
      for (const [tabla, nombre, def] of columnas) {
        const [[e]] = await conn.query(
          `SELECT COUNT(*) AS n FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
          [tabla, nombre]
        );
        if (!e.n) await conn.query(`ALTER TABLE ${tabla} ADD COLUMN ${nombre} ${def}`);
      }
    },
  },
  {
    id: "2026_11_014_creditos_grupales",
    descripcion: "Grupos de socios, integrantes con cargo y créditos grupales",
    async up(conn) {
      await conn.query(`
        CREATE TABLE IF NOT EXISTS grupos (
          id_grupo INT AUTO_INCREMENT PRIMARY KEY,
          nombre VARCHAR(100) NOT NULL,
          id_sucursal INT NULL,
          id_promotor INT NULL,
          comunidad VARCHAR(120) NULL,
          estado ENUM('activo','inactivo') NOT NULL DEFAULT 'activo',
          creado_por INT NULL,
          creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      await conn.query(`
        CREATE TABLE IF NOT EXISTS grupo_integrantes (
          id_grupo INT NOT NULL,
          id_usuario INT NOT NULL,
          cargo VARCHAR(30) NOT NULL DEFAULT 'integrante',
          agregado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (id_grupo, id_usuario),
          INDEX idx_integrante_usuario (id_usuario)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      await conn.query(`
        CREATE TABLE IF NOT EXISTS creditos_grupales (
          id_credito_grupal INT AUTO_INCREMENT PRIMARY KEY,
          id_grupo INT NOT NULL,
          monto_total DECIMAL(14,2) NOT NULL,
          tasa_mensual DECIMAL(8,4) NOT NULL,
          plazo_meses INT NOT NULL,
          id_producto INT NULL,
          descripcion VARCHAR(255) NULL,
          creado_por INT NULL,
          creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_credito_grupo (id_grupo)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      const [[e]] = await conn.query(
        `SELECT COUNT(*) AS n FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'prestamos' AND COLUMN_NAME = 'id_credito_grupal'`
      );
      if (!e.n) {
        await conn.query("ALTER TABLE prestamos ADD COLUMN id_credito_grupal INT NULL, ADD INDEX idx_prestamo_grupal (id_credito_grupal)");
      }
    },
  },
  {
    id: "2026_11_015_pagos_ampliados",
    descripcion: "Boleta, lugar de pago, otros cargos y conciliación de pagos",
    async up(conn) {
      const columnas = [
        ["numero_boleta", "VARCHAR(40) NULL"],
        ["lugar_pago", "VARCHAR(80) NULL"],
        ["otros_cargos", "DECIMAL(12,2) NOT NULL DEFAULT 0"],
        ["otros_cargos_detalle", "VARCHAR(150) NULL"],
        ["conciliado", "TINYINT(1) NOT NULL DEFAULT 0"],
        ["conciliado_por", "INT NULL"],
        ["conciliado_en", "DATETIME NULL"],
      ];
      for (const [nombre, def] of columnas) {
        const [[e]] = await conn.query(
          `SELECT COUNT(*) AS n FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pagos_prestamo' AND COLUMN_NAME = ?`,
          [nombre]
        );
        if (!e.n) await conn.query(`ALTER TABLE pagos_prestamo ADD COLUMN ${nombre} ${def}`);
      }
    },
  },
  {
    id: "2026_11_016_nombres_apellidos",
    descripcion: "Nombres y apellidos del socio por separado (opcional)",
    async up(conn) {
      for (const [nombre, def] of [["nombres", "VARCHAR(80) NULL"], ["apellidos", "VARCHAR(80) NULL"]]) {
        const [[e]] = await conn.query(
          `SELECT COUNT(*) AS n FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'usuarios' AND COLUMN_NAME = ?`,
          [nombre]
        );
        if (!e.n) await conn.query(`ALTER TABLE usuarios ADD COLUMN ${nombre} ${def}`);
      }
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
