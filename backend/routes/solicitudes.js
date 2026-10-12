// Solicitudes de nuevos socios y de préstamos hechas desde el panel del socio,
// y su revisión por parte del personal.
const express = require("express");
const router = express.Router();
const pool = require("../db");
const config = require("../utils/configFinanciera");
const { calcularCuotaMensual } = require("../utils/calculosPrestamo");
const { leerRegistro, guardarRegistro } = require("../utils/registroConfig");
const { notificarAdministradores } = require("../utils/notificaciones");
const { invalidarEstado } = require("../middleware/seguridad");

const PROPOSITOS = ["negocio", "vivienda", "educacion", "salud", "agricultura", "consumo", "otro"];
const OCUPACIONES = ["empleado", "negocio_propio", "agricultor", "independiente", "jubilado", "otro"];

const num = (v) => parseFloat(v || 0);
const esSocio = (req) => req.usuario?.rol === "Socio";
const soloPersonal = (req, res, next) => {
  if (esSocio(req)) return res.status(403).json({ message: "No tienes permiso para realizar esta acción." });
  next();
};

const aTexto = (v, max) => String(v || "").trim().substring(0, max);

// ============================================
// PARÁMETROS PARA EL FORMULARIO (socio)
// ============================================
router.get("/parametros", (req, res) => {
  const c = config.obtener();
  res.json({
    success: true,
    data: {
      tasa_mensual: c.sol_tasa_mensual,
      monto_max: c.sol_monto_max,
      plazo_max: c.sol_plazo_max,
      pct_ingreso_max: c.sol_pct_ingreso_max,
      propositos: PROPOSITOS,
      ocupaciones: OCUPACIONES,
    },
  });
});

// ============================================
// SOLICITUDES DEL SOCIO
// ============================================
router.get("/mias", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT p.id_prestamo, p.monto, p.plazo_meses, p.estado, p.motivo_rechazo,
              s.cuota_estimada, s.proposito, s.creada_en
       FROM solicitudes_prestamo s
       INNER JOIN prestamos p ON s.id_prestamo = p.id_prestamo
       WHERE s.id_usuario = ?
       ORDER BY s.creada_en DESC LIMIT 20`,
      [req.usuario.id_usuario]
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error("ERROR AL LISTAR SOLICITUDES PROPIAS:", error);
    res.status(500).json({ message: "No se pudieron cargar tus solicitudes" });
  }
});

router.post("/prestamo", async (req, res) => {
  const connection = await pool.getConnection();
  try {
    if (!esSocio(req)) {
      return res.status(403).json({ message: "Solo un socio puede enviar su propia solicitud." });
    }
    const c = config.obtener();
    const b = req.body;

    const monto = num(b.monto);
    const plazo = parseInt(b.plazo_meses);
    const cuotaPosible = num(b.cuota_posible);
    const ingreso = num(b.ingreso_mensual);

    if (!(monto > 0) || monto > c.sol_monto_max) {
      return res.status(400).json({ message: `El monto debe ser mayor a 0 y no superar L. ${c.sol_monto_max.toLocaleString("es-HN")}.` });
    }
    if (!Number.isInteger(plazo) || plazo < 1 || plazo > c.sol_plazo_max) {
      return res.status(400).json({ message: `El plazo debe estar entre 1 y ${c.sol_plazo_max} meses.` });
    }
    if (!(cuotaPosible > 0)) {
      return res.status(400).json({ message: "Indica cuánto puedes pagar al mes." });
    }
    if (!PROPOSITOS.includes(b.proposito)) {
      return res.status(400).json({ message: "Selecciona el destino del préstamo." });
    }
    if (!OCUPACIONES.includes(b.ocupacion)) {
      return res.status(400).json({ message: "Selecciona tu fuente de ingresos." });
    }
    if (!(ingreso > 0)) {
      return res.status(400).json({ message: "Indica tu ingreso mensual aproximado." });
    }
    if (b.acepta !== true) {
      return res.status(400).json({ message: "Debes confirmar que la información es verdadera." });
    }

    const referencias = (Array.isArray(b.referencias) ? b.referencias : [])
      .slice(0, 2)
      .map((r) => ({
        nombre: aTexto(r.nombre, 100),
        telefono: aTexto(r.telefono, 20),
        parentesco: aTexto(r.parentesco, 50),
      }))
      .filter((r) => r.nombre && r.telefono);

    await connection.beginTransaction();

    const [abiertas] = await connection.query(
      `SELECT id_prestamo FROM prestamos WHERE id_usuario = ? AND estado = 'pendiente' LIMIT 1 FOR UPDATE`,
      [req.usuario.id_usuario]
    );
    if (abiertas.length) {
      await connection.rollback();
      return res.status(409).json({
        message: "Ya tienes una solicitud en revisión. Espera la respuesta de la cooperativa antes de enviar otra.",
      });
    }

    const tasaMensual = c.sol_tasa_mensual;
    const tasaAnual = parseFloat((tasaMensual * 12).toFixed(4));
    const cuotaEstimada = parseFloat(calcularCuotaMensual(monto, tasaAnual, plazo).toFixed(2));

    const [pr] = await connection.query(
      `INSERT INTO prestamos (id_usuario, monto, tasa_interes, tipo_tasa, tasa_original, plazo_meses, saldo_restante, estado)
       VALUES (?, ?, ?, 'nominal_mensual', ?, ?, ?, 'pendiente')`,
      [req.usuario.id_usuario, monto, tasaAnual, tasaMensual, plazo, monto]
    );

    await connection.query(
      `INSERT INTO solicitudes_prestamo
         (id_prestamo, id_usuario, proposito, descripcion, ocupacion, lugar_trabajo, ingreso_mensual,
          cuota_posible, cuota_estimada, tasa_referencial, referencias)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        pr.insertId,
        req.usuario.id_usuario,
        b.proposito,
        aTexto(b.descripcion, 300) || null,
        b.ocupacion,
        aTexto(b.lugar_trabajo, 120) || null,
        ingreso,
        cuotaPosible,
        cuotaEstimada,
        tasaMensual,
        JSON.stringify(referencias),
      ]
    );

    await connection.query(
      `INSERT INTO bitacora (id_usuario, accion, detalle, fecha) VALUES (?, ?, ?, NOW())`,
      [
        req.usuario.id_usuario,
        "Solicitud de préstamo",
        `${req.usuario.nombre_completo || "Socio"} solicitó L. ${monto.toFixed(2)} a ${plazo} meses (cuota estimada L. ${cuotaEstimada.toFixed(2)}). Préstamo #${pr.insertId}`,
      ]
    );

    await connection.commit();

    notificarAdministradores(
      "Nueva solicitud de préstamo",
      `<p><strong>${req.usuario.nombre_completo || "Un socio"}</strong> solicitó <strong>L. ${monto.toLocaleString("es-HN", { minimumFractionDigits: 2 })}</strong> a ${plazo} meses.</p>`
    );

    res.status(201).json({
      success: true,
      message: "Solicitud enviada. La cooperativa la revisará y te responderá pronto.",
      id_prestamo: pr.insertId,
      cuota_estimada: cuotaEstimada,
    });
  } catch (error) {
    await connection.rollback().catch(() => {});
    console.error("ERROR AL CREAR SOLICITUD DE PRÉSTAMO:", error);
    res.status(500).json({ message: "No se pudo enviar la solicitud. Intenta de nuevo." });
  } finally {
    connection.release();
  }
});

// ============================================
// REVISIÓN DEL PERSONAL
// ============================================
router.get("/resumen", soloPersonal, async (req, res) => {
  try {
    const [[s]] = await pool.query(`SELECT COUNT(*) AS n FROM usuarios WHERE estado = 'pendiente'`);
    const [[p]] = await pool.query(
      `SELECT COUNT(*) AS n FROM solicitudes_prestamo sp
       INNER JOIN prestamos pr ON sp.id_prestamo = pr.id_prestamo WHERE pr.estado = 'pendiente'`
    );
    const [[c]] = await pool.query(
      `SELECT COUNT(DISTINCT id_recibo) AS n FROM comprobantes_firmados
       WHERE subido_por_rol = 'Socio' AND revisado_en IS NULL`
    );
    res.json({
      success: true,
      socios_pendientes: s.n,
      prestamos_pendientes: p.n,
      comprobantes_por_revisar: c.n,
      total: s.n + p.n + c.n,
    });
  } catch (error) {
    res.status(500).json({ message: "No se pudo obtener el resumen" });
  }
});

router.get("/", soloPersonal, async (req, res) => {
  try {
    const [socios] = await pool.query(
      `SELECT id_usuario, nombre_completo, dni, telefono, correo, direccion, fecha_nacimiento, fecha_registro
       FROM usuarios WHERE estado = 'pendiente' ORDER BY fecha_registro ASC`
    );

    const [filas] = await pool.query(
      `SELECT pr.id_prestamo, pr.id_usuario, pr.monto, pr.plazo_meses, pr.tasa_original, pr.estado,
              u.nombre_completo, u.dni, u.telefono, u.estado AS estado_socio,
              s.proposito, s.descripcion, s.ocupacion, s.lugar_trabajo, s.ingreso_mensual,
              s.cuota_posible, s.cuota_estimada, s.tasa_referencial, s.referencias, s.creada_en,
              (SELECT IFNULL(SUM(monto), 0) FROM aportaciones a WHERE a.id_usuario = pr.id_usuario) AS total_aportado,
              (SELECT IFNULL(SUM(saldo_restante), 0) FROM prestamos x
                 WHERE x.id_usuario = pr.id_usuario AND x.estado IN ('activo','mora')) AS saldo_vigente,
              (SELECT COUNT(*) FROM prestamos x WHERE x.id_usuario = pr.id_usuario AND x.estado = 'pagado') AS prestamos_pagados
       FROM solicitudes_prestamo s
       INNER JOIN prestamos pr ON s.id_prestamo = pr.id_prestamo
       INNER JOIN usuarios u ON pr.id_usuario = u.id_usuario
       WHERE pr.estado IN ('pendiente', 'aprobado')
       ORDER BY s.creada_en ASC`
    );

    const prestamos = filas.map((f) => {
      let referencias = [];
      try {
        referencias = f.referencias ? JSON.parse(f.referencias) : [];
      } catch {
        referencias = [];
      }
      const ingreso = num(f.ingreso_mensual);
      return {
        ...f,
        referencias,
        monto: num(f.monto),
        ingreso_mensual: ingreso,
        cuota_posible: num(f.cuota_posible),
        cuota_estimada: num(f.cuota_estimada),
        total_aportado: num(f.total_aportado),
        saldo_vigente: num(f.saldo_vigente),
        relacion_cuota_ingreso: ingreso > 0 ? parseFloat(((num(f.cuota_estimada) / ingreso) * 100).toFixed(1)) : null,
      };
    });

    res.json({ success: true, socios, prestamos });
  } catch (error) {
    console.error("ERROR AL LISTAR SOLICITUDES:", error);
    res.status(500).json({ message: "No se pudieron cargar las solicitudes" });
  }
});

// Activa a un socio pendiente y le crea sus cuentas
const activarSocio = async (conn, idUsuario, aprobadoPor) => {
  const [[u]] = await conn.query(`SELECT id_usuario, nombre_completo, estado FROM usuarios WHERE id_usuario = ? FOR UPDATE`, [idUsuario]);
  if (!u) throw Object.assign(new Error("Socio no encontrado"), { codigo: 404 });
  if (u.estado === "activo") return u;
  if (u.estado !== "pendiente") {
    throw Object.assign(new Error(`El socio está en estado "${u.estado}" y no se puede aprobar.`), { codigo: 400 });
  }
  await conn.query(`UPDATE usuarios SET estado = 'activo', motivo_rechazo = NULL WHERE id_usuario = ?`, [idUsuario]);

  const [cuentas] = await conn.query(`SELECT COUNT(*) AS n FROM cuentas WHERE id_usuario = ?`, [idUsuario]);
  if (!cuentas[0].n) {
    for (const tipo of ["Aportaciones", "Vivienda", "Pensiones"]) {
      await conn.query(
        `INSERT INTO cuentas (id_usuario, tipo_cuenta, saldo_actual, estado, fecha_apertura) VALUES (?, ?, 0.00, 'activa', NOW())`,
        [idUsuario, tipo]
      );
    }
  }
  await conn.query(
    `INSERT INTO bitacora (id_usuario, accion, detalle, fecha) VALUES (?, ?, ?, NOW())`,
    [idUsuario, "Socio aprobado", `${u.nombre_completo} fue aprobado como socio (usuario #${aprobadoPor})`]
  );
  invalidarEstado(idUsuario);
  return u;
};

router.post("/socios/:id/aprobar", soloPersonal, async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await activarSocio(connection, parseInt(req.params.id), req.usuario.id_usuario);
    await connection.commit();
    res.json({ success: true, message: "Socio aprobado y cuentas creadas." });
  } catch (error) {
    await connection.rollback().catch(() => {});
    if (error.codigo) return res.status(error.codigo).json({ message: error.message });
    console.error("ERROR AL APROBAR SOCIO:", error);
    res.status(500).json({ message: "No se pudo aprobar al socio" });
  } finally {
    connection.release();
  }
});

router.post("/socios/:id/rechazar", soloPersonal, async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const motivo = aTexto(req.body.motivo, 255);
    if (motivo.length < 3) {
      return res.status(400).json({ message: "Indica el motivo del rechazo (mínimo 3 caracteres)." });
    }
    await connection.beginTransaction();
    const [[u]] = await connection.query(`SELECT id_usuario, nombre_completo, estado FROM usuarios WHERE id_usuario = ? FOR UPDATE`, [req.params.id]);
    if (!u) {
      await connection.rollback();
      return res.status(404).json({ message: "Socio no encontrado" });
    }
    if (u.estado !== "pendiente") {
      await connection.rollback();
      return res.status(400).json({ message: "Solo se pueden rechazar socios pendientes de aprobación." });
    }
    await connection.query(`UPDATE usuarios SET estado = 'rechazado', motivo_rechazo = ? WHERE id_usuario = ?`, [motivo, u.id_usuario]);
    await connection.query(
      `UPDATE prestamos SET estado = 'rechazado', motivo_rechazo = ? WHERE id_usuario = ? AND estado IN ('pendiente','aprobado')`,
      [`Socio no aprobado: ${motivo}`.substring(0, 255), u.id_usuario]
    );
    await connection.query(
      `INSERT INTO bitacora (id_usuario, accion, detalle, fecha) VALUES (?, ?, ?, NOW())`,
      [u.id_usuario, "Socio rechazado", `${u.nombre_completo} no fue aprobado. Motivo: ${motivo}`]
    );
    await connection.commit();
    invalidarEstado(u.id_usuario);
    res.json({ success: true, message: "Solicitud de socio rechazada." });
  } catch (error) {
    await connection.rollback().catch(() => {});
    console.error("ERROR AL RECHAZAR SOCIO:", error);
    res.status(500).json({ message: "No se pudo rechazar la solicitud" });
  } finally {
    connection.release();
  }
});

// Aprobar una solicitud de préstamo (opcionalmente aprobando también al socio y ajustando condiciones)
router.post("/prestamos/:id/aprobar", soloPersonal, async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query(`SELECT * FROM prestamos WHERE id_prestamo = ? FOR UPDATE`, [req.params.id]);
    if (!rows.length) {
      await connection.rollback();
      return res.status(404).json({ message: "Solicitud no encontrada" });
    }
    const p = rows[0];
    if (p.estado !== "pendiente") {
      await connection.rollback();
      return res.status(400).json({ message: `La solicitud ya está en estado "${p.estado}".` });
    }

    const [[socio]] = await connection.query(`SELECT estado FROM usuarios WHERE id_usuario = ?`, [p.id_usuario]);
    if (socio.estado === "pendiente") {
      if (!req.body.aprobar_socio) {
        await connection.rollback();
        return res.status(400).json({ message: "Primero aprueba la cuenta del socio (o marca 'Aprobar también al socio')." });
      }
      await activarSocio(connection, p.id_usuario, req.usuario.id_usuario);
    } else if (socio.estado !== "activo") {
      await connection.rollback();
      return res.status(400).json({ message: "El socio no está activo." });
    }

    // Condiciones definitivas (el personal puede ajustarlas antes de aprobar)
    const c = config.obtener();
    const monto = req.body.monto !== undefined ? num(req.body.monto) : num(p.monto);
    const plazo = req.body.plazo_meses !== undefined ? parseInt(req.body.plazo_meses) : p.plazo_meses;
    const tasaMensual = req.body.tasa_mensual !== undefined ? num(req.body.tasa_mensual) : num(p.tasa_original);
    if (!(monto > 0) || monto > c.sol_monto_max * 5) {
      await connection.rollback();
      return res.status(400).json({ message: "Monto inválido." });
    }
    if (!Number.isInteger(plazo) || plazo < 0 || plazo > 360) {
      await connection.rollback();
      return res.status(400).json({ message: "Plazo inválido." });
    }
    if (!(tasaMensual >= 0) || tasaMensual > 30) {
      await connection.rollback();
      return res.status(400).json({ message: "Tasa mensual inválida." });
    }

    await connection.query(
      `UPDATE prestamos
       SET monto = ?, saldo_restante = ?, plazo_meses = ?, tasa_interes = ?, tasa_original = ?, tipo_tasa = 'nominal_mensual',
           estado = 'aprobado', aprobado_por = ?, fecha_aprobacion = NOW()
       WHERE id_prestamo = ?`,
      [monto, monto, plazo, parseFloat((tasaMensual * 12).toFixed(4)), tasaMensual, req.usuario.id_usuario, req.params.id]
    );
    await connection.query(
      `INSERT INTO bitacora (id_usuario, accion, detalle, fecha) VALUES (?, ?, ?, NOW())`,
      [p.id_usuario, "Préstamo aprobado", `Solicitud #${req.params.id} aprobada: L. ${monto.toFixed(2)} a ${plazo} meses, ${tasaMensual}% mensual. Pendiente de desembolso.`]
    );
    await connection.commit();
    res.json({ success: true, message: "Solicitud aprobada. Falta registrar el desembolso en Préstamos." });
  } catch (error) {
    await connection.rollback().catch(() => {});
    if (error.codigo) return res.status(error.codigo).json({ message: error.message });
    console.error("ERROR AL APROBAR SOLICITUD:", error);
    res.status(500).json({ message: "No se pudo aprobar la solicitud" });
  } finally {
    connection.release();
  }
});

// Comprobantes firmados que subieron los socios y nadie ha revisado
router.get("/comprobantes-recibidos", soloPersonal, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT r.id_recibo, r.referencia_id AS id_prestamo, r.monto,
              u.nombre_completo, u.telefono, MAX(c.subido_en) AS subido_en
       FROM comprobantes_firmados c
       INNER JOIN recibos r ON c.id_recibo = r.id_recibo
       INNER JOIN usuarios u ON r.id_socio = u.id_usuario
       WHERE c.subido_por_rol = 'Socio' AND c.revisado_en IS NULL AND r.anulado = 0
       GROUP BY r.id_recibo, r.referencia_id, r.monto, u.nombre_completo, u.telefono
       ORDER BY subido_en DESC LIMIT 100`
    );
    res.json({ success: true, data: rows.map((r) => ({ ...r, monto: num(r.monto) })) });
  } catch (error) {
    console.error("ERROR AL LISTAR COMPROBANTES RECIBIDOS:", error);
    res.status(500).json({ message: "No se pudo cargar la lista" });
  }
});

// Desembolsos recientes que todavía no tienen la copia firmada
router.get("/desembolsos-sin-firma", soloPersonal, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT r.id_recibo, r.referencia_id AS id_prestamo, r.monto, r.fecha, r.metodo,
              u.nombre_completo, u.telefono
       FROM recibos r
       INNER JOIN usuarios u ON r.id_socio = u.id_usuario
       WHERE r.tipo = 'desembolso' AND r.anulado = 0
         AND r.fecha >= DATE_SUB(NOW(), INTERVAL 120 DAY)
         AND NOT EXISTS (SELECT 1 FROM comprobantes_firmados c WHERE c.id_recibo = r.id_recibo)
       ORDER BY r.fecha DESC LIMIT 100`
    );
    res.json({ success: true, data: rows.map((r) => ({ ...r, monto: num(r.monto) })) });
  } catch (error) {
    console.error("ERROR AL LISTAR DESEMBOLSOS SIN FIRMA:", error);
    res.status(500).json({ message: "No se pudo cargar la lista" });
  }
});

// ============================================
// ENLACE DE REGISTRO
// ============================================
router.get("/enlace", soloPersonal, async (req, res) => {
  try {
    const cfg = await leerRegistro();
    res.json({ success: true, habilitado: cfg.habilitado, codigo: cfg.codigo });
  } catch (error) {
    res.status(500).json({ message: "No se pudo leer el enlace de registro" });
  }
});

router.put("/enlace", soloPersonal, async (req, res) => {
  try {
    const cfg = await guardarRegistro({
      habilitado: req.body.habilitado === undefined ? undefined : !!req.body.habilitado,
      regenerar: !!req.body.regenerar,
    });
    await pool.query(
      `INSERT INTO bitacora (id_usuario, accion, detalle, fecha) VALUES (?, ?, ?, NOW())`,
      [
        req.usuario.id_usuario,
        "Enlace de registro",
        `${req.body.regenerar ? "Se generó un nuevo enlace. " : ""}Registro ${cfg.habilitado ? "habilitado" : "deshabilitado"}.`,
      ]
    );
    res.json({ success: true, habilitado: cfg.habilitado, codigo: cfg.codigo });
  } catch (error) {
    console.error("ERROR AL ACTUALIZAR ENLACE:", error);
    res.status(500).json({ message: "No se pudo actualizar el enlace" });
  }
});

module.exports = router;
