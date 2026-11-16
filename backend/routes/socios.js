const express = require("express");
const router = express.Router();
const pool = require("../db");
const {
  LADOS,
  subidaIdentidad,
  mensajeErrorSubida,
  guardarLado,
  estadoIdentidad,
  leerLado,
} = require("../utils/identidad");
const { notificarAdministradores, escaparHtml } = require("../utils/notificaciones");

const num = (v) => parseFloat(v || 0);

// GET /api/socios/:id/estado-cuenta?desde=YYYY-MM-DD&hasta=YYYY-MM-DD
router.get("/:id/estado-cuenta", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { desde, hasta } = req.query;
    const filtroFecha = (campo) => {
      const partes = [];
      const params = [];
      if (/^\d{4}-\d{2}-\d{2}$/.test(desde || "")) {
        partes.push(`DATE(${campo}) >= ?`);
        params.push(desde);
      }
      if (/^\d{4}-\d{2}-\d{2}$/.test(hasta || "")) {
        partes.push(`DATE(${campo}) <= ?`);
        params.push(hasta);
      }
      return { sql: partes.length ? " AND " + partes.join(" AND ") : "", params };
    };

    const [socio] = await pool.query(
      `SELECT id_usuario, numero_socio, nombre_completo, dni, telefono, correo, direccion, fecha_registro
       FROM usuarios WHERE id_usuario = ?`,
      [id]
    );
    if (!socio.length) return res.status(404).json({ message: "Socio no encontrado" });

    const [cuentas] = await pool.query(
      `SELECT id_cuenta, tipo_cuenta, saldo_actual, estado FROM cuentas WHERE id_usuario = ?`,
      [id]
    );

    const fa = filtroFecha("fecha");
    const [aportaciones] = await pool.query(
      `SELECT id_aportacion, monto, fecha, descripcion FROM aportaciones
       WHERE id_usuario = ?${fa.sql} ORDER BY fecha DESC`,
      [id, ...fa.params]
    );

    const [prestamos] = await pool.query(
      `SELECT id_prestamo, monto, tasa_interes, plazo_meses, saldo_restante, estado, fecha_otorgado
       FROM prestamos WHERE id_usuario = ? AND estado IN ('activo','mora','pagado') ORDER BY fecha_otorgado DESC`,
      [id]
    );

    const fp = filtroFecha("pp.fecha_pago");
    const [pagos] = await pool.query(
      `SELECT pp.id_pago, pp.id_prestamo, pp.monto_pagado, pp.monto_capital, pp.monto_interes,
              pp.saldo_restante, pp.metodo_pago, pp.fecha_pago
       FROM pagos_prestamo pp INNER JOIN prestamos pr ON pp.id_prestamo = pr.id_prestamo
       WHERE pr.id_usuario = ?${fp.sql} ORDER BY pp.fecha_pago DESC`,
      [id, ...fp.params]
    );

    res.json({
      success: true,
      generado: new Date().toISOString(),
      periodo: { desde: desde || null, hasta: hasta || null },
      socio: socio[0],
      resumen: {
        saldo_cuentas: cuentas.reduce((s, c) => s + num(c.saldo_actual), 0),
        total_aportaciones: aportaciones.reduce((s, a) => s + num(a.monto), 0),
        saldo_prestamos: prestamos
          .filter((p) => p.estado !== "pagado")
          .reduce((s, p) => s + num(p.saldo_restante), 0),
        total_pagado: pagos.reduce((s, p) => s + num(p.monto_pagado), 0),
      },
      cuentas,
      aportaciones,
      prestamos,
      pagos,
    });
  } catch (error) {
    console.error("ERROR EN ESTADO DE CUENTA:", error);
    res.status(500).json({ message: "Error al generar el estado de cuenta" });
  }
});

// ============================================
// IDENTIDAD (fotos del frente y reverso del DNI)
// El socio solo llega aquí con su propio id (lo controla la guardia de seguridad).
// ============================================
router.get("/:id/identidad", async (req, res) => {
  try {
    res.json({ success: true, data: await estadoIdentidad(parseInt(req.params.id)) });
  } catch (error) {
    console.error("ERROR AL LEER IDENTIDAD:", error);
    res.status(500).json({ message: "No se pudo consultar la identidad" });
  }
});

router.get("/:id/identidad/:lado", async (req, res) => {
  try {
    if (!LADOS.includes(req.params.lado)) return res.status(404).json({ message: "No encontrado" });
    const foto = await leerLado(parseInt(req.params.id), req.params.lado);
    if (!foto) return res.status(404).json({ message: "Aún no hay foto de este lado." });
    res.setHeader("Content-Type", foto.mime);
    res.setHeader("Cache-Control", "private, no-store");
    res.send(foto.contenido);
  } catch (error) {
    console.error("ERROR AL LEER FOTO DE IDENTIDAD:", error);
    res.status(500).json({ message: "No se pudo cargar la foto" });
  }
});

// POST /api/socios/:id/identidad/:lado   (campo "foto")
router.post("/:id/identidad/:lado", (req, res) => {
  subidaIdentidad.single("foto")(req, res, async (err) => {
    if (err) return res.status(400).json({ message: mensajeErrorSubida(err) });
    try {
      const id = parseInt(req.params.id);
      const lado = req.params.lado;
      if (!LADOS.includes(lado)) return res.status(404).json({ message: "No encontrado" });
      if (!req.file) return res.status(400).json({ message: "Selecciona la foto de tu identidad." });

      const [[u]] = await pool.query("SELECT nombre_completo, estado FROM usuarios WHERE id_usuario = ?", [id]);
      if (!u) return res.status(404).json({ message: "Socio no encontrado" });

      // Ya aprobada la cuenta, el socio no puede cambiar una foto que la cooperativa revisó
      const esSocio = req.usuario.rol === "Socio";
      if (esSocio && u.estado !== "pendiente") {
        const previa = (await estadoIdentidad(id))[lado];
        if (previa) {
          return res.status(403).json({
            message: "Tu identidad ya fue revisada por la cooperativa. Comunícate con ella si necesitas cambiar la foto.",
          });
        }
      }

      await guardarLado(pool, id, lado, req.file, req.usuario.id_usuario);
      await pool.query(
        `INSERT INTO bitacora (id_usuario, accion, detalle, fecha) VALUES (?, ?, ?, NOW())`,
        [id, "Foto de identidad", `Se subió la foto del ${lado} de la identidad (usuario #${req.usuario.id_usuario})`]
      );
      if (esSocio) {
        notificarAdministradores(
          "Foto de identidad recibida",
          `<p><strong>${escaparHtml(u.nombre_completo)}</strong> subió la foto del ${lado} de su identidad.</p>`
        );
      }
      res.status(201).json({ success: true, message: "Foto guardada.", data: await estadoIdentidad(id) });
    } catch (error) {
      console.error("ERROR AL GUARDAR FOTO DE IDENTIDAD:", error);
      res.status(500).json({ message: "No se pudo guardar la foto" });
    }
  });
});

// ── Expediente del socio (conozca a su cliente) ─────────────────────────────
const CAMPOS_PERFIL = [
  "genero", "estado_civil", "nacionalidad", "profesion", "actividad_economica",
  "lugar_trabajo", "ingreso_mensual", "origen_fondos", "es_pep", "pep_detalle",
];

const expediente = async (id) => {
  const [[perfil]] = await pool.query(
    `SELECT id_usuario, estado, ${CAMPOS_PERFIL.join(", ")}, perfil_actualizado_en FROM usuarios WHERE id_usuario = ?`,
    [id]
  );
  if (!perfil) return null;
  const [beneficiarios] = await pool.query(
    "SELECT id_beneficiario, nombre, parentesco, identidad, telefono, porcentaje FROM beneficiarios WHERE id_usuario = ? ORDER BY id_beneficiario",
    [id]
  );
  const [[alertas]] = await pool.query(
    "SELECT COUNT(*) AS pendientes FROM alertas_cumplimiento WHERE id_socio = ? AND estado = 'pendiente'",
    [id]
  );
  // Qué falta para tener el expediente completo
  const faltantes = [];
  if (!perfil.actividad_economica) faltantes.push("actividad económica");
  if (perfil.ingreso_mensual == null) faltantes.push("ingreso mensual");
  if (!perfil.origen_fondos) faltantes.push("origen de los fondos");
  if (!beneficiarios.length) faltantes.push("beneficiarios");
  return { ...perfil, es_pep: !!perfil.es_pep, beneficiarios, alertas_pendientes: alertas.pendientes, faltantes };
};

// GET /api/socios/:id/expediente
router.get("/:id/expediente", async (req, res) => {
  try {
    const datos = await expediente(parseInt(req.params.id));
    if (!datos) return res.status(404).json({ message: "Socio no encontrado" });
    res.json({ success: true, data: datos });
  } catch (error) {
    console.error("ERROR AL LEER EL EXPEDIENTE:", error);
    res.status(500).json({ message: "No se pudo leer el expediente" });
  }
});

// PUT /api/socios/:id/expediente  { ...perfil, beneficiarios: [{nombre, parentesco, identidad, telefono, porcentaje}] }
router.put("/:id/expediente", async (req, res) => {
  const id = parseInt(req.params.id);
  const b = req.body || {};
  const texto = (v, max) => {
    const t = String(v ?? "").trim();
    return t ? t.substring(0, max) : null;
  };
  const perfil = {
    genero: texto(b.genero, 20),
    estado_civil: texto(b.estado_civil, 20),
    nacionalidad: texto(b.nacionalidad, 60),
    profesion: texto(b.profesion, 100),
    actividad_economica: texto(b.actividad_economica, 150),
    lugar_trabajo: texto(b.lugar_trabajo, 150),
    ingreso_mensual: b.ingreso_mensual === "" || b.ingreso_mensual == null ? null : parseFloat(b.ingreso_mensual),
    origen_fondos: texto(b.origen_fondos, 255),
    es_pep: b.es_pep ? 1 : 0,
    pep_detalle: b.es_pep ? texto(b.pep_detalle, 255) : null,
  };
  if (perfil.ingreso_mensual != null && !(perfil.ingreso_mensual >= 0)) {
    return res.status(400).json({ message: "El ingreso mensual no es válido." });
  }
  if (perfil.es_pep && !perfil.pep_detalle) {
    return res.status(400).json({ message: "Indica el cargo o la relación por la que es persona expuesta políticamente." });
  }
  const lista = Array.isArray(b.beneficiarios) ? b.beneficiarios : [];
  const beneficiarios = [];
  for (const x of lista) {
    const nombre = texto(x?.nombre, 100);
    const porcentaje = parseFloat(x?.porcentaje);
    if (!nombre) return res.status(400).json({ message: "Cada beneficiario necesita su nombre." });
    if (!(porcentaje > 0 && porcentaje <= 100)) {
      return res.status(400).json({ message: `El porcentaje de ${nombre} debe estar entre 1 y 100.` });
    }
    beneficiarios.push([id, nombre, texto(x.parentesco, 50), texto(x.identidad, 20), texto(x.telefono, 20), porcentaje]);
  }
  const suma = beneficiarios.reduce((t, x) => t + x[5], 0);
  if (beneficiarios.length && Math.abs(suma - 100) > 0.01) {
    return res.status(400).json({ message: `Los porcentajes de los beneficiarios suman ${suma}%: deben sumar 100%.` });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [[antes]] = await conn.query("SELECT nombre_completo, es_pep FROM usuarios WHERE id_usuario = ? FOR UPDATE", [id]);
    if (!antes) {
      await conn.rollback();
      return res.status(404).json({ message: "Socio no encontrado" });
    }
    await conn.query(
      `UPDATE usuarios SET ${CAMPOS_PERFIL.map((c) => `${c} = ?`).join(", ")}, perfil_actualizado_en = NOW() WHERE id_usuario = ?`,
      [...CAMPOS_PERFIL.map((c) => perfil[c]), id]
    );
    await conn.query("DELETE FROM beneficiarios WHERE id_usuario = ?", [id]);
    if (beneficiarios.length) {
      await conn.query(
        "INSERT INTO beneficiarios (id_usuario, nombre, parentesco, identidad, telefono, porcentaje) VALUES ?",
        [beneficiarios]
      );
    }
    const cambioPep = !!antes.es_pep !== !!perfil.es_pep;
    await conn.query(
      `INSERT INTO bitacora (id_usuario, accion, detalle, fecha) VALUES (?, ?, ?, NOW())`,
      [
        id,
        "Expediente actualizado",
        `Usuario #${req.usuario.id_usuario} actualizó el expediente${cambioPep ? (perfil.es_pep ? " (marcado como PEP)" : " (ya no es PEP)") : ""}; ${beneficiarios.length} beneficiario(s)`,
      ]
    );
    await conn.commit();
    res.json({ success: true, message: "Expediente guardado.", data: await expediente(id) });
  } catch (error) {
    await conn.rollback();
    console.error("ERROR AL GUARDAR EL EXPEDIENTE:", error);
    res.status(500).json({ message: "No se pudo guardar el expediente" });
  } finally {
    conn.release();
  }
});

module.exports = router;
