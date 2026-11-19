const express = require("express");
const router = express.Router();
const pool = require("../db");
const { filtroSocio } = require("../utils/sucursal");
const { DIAS_MES } = require("../utils/calculosPrestamo");
const { obtenerCartera, resumirCartera, etiquetasCartera } = require("../utils/cartera");
const { notificarSocio } = require("../utils/notificaciones");
const { habilitada } = require("../utils/funciones");
const { hoyISO, diasEntre, soloFecha } = require("../utils/calculosPrestamo");
const {
  mensajeRecordatorio,
  ejecutarRecordatorios,
  registrarGestion,
  htmlDe,
  nombreCooperativa,
} = require("../utils/recordatorios");

// ============================================
// CARTERA: préstamos vigentes clasificados por antigüedad
// GET /api/cobranza/cartera
// ============================================
router.get("/cartera", async (req, res) => {
  try {
    let filas = await obtenerCartera(await filtroSocio(req));
    // Cartera de un asesor (función "cartera_asesor"): ?id_asesor=N, "yo" o "sin"
    if (req.query.id_asesor && (await habilitada("cartera_asesor", req.usuario))) {
      const q = String(req.query.id_asesor);
      const id = q === "yo" ? req.usuario.id_usuario : parseInt(q);
      filas = q === "sin" ? filas.filter((f) => !f.id_asesor) : filas.filter((f) => f.id_asesor === id);
    }
    const { resumen } = resumirCartera(filas);
    res.json({ success: true, dias_mes: DIAS_MES, resumen, data: filas, etiquetas: etiquetasCartera() });
  } catch (error) {
    console.error("ERROR AL OBTENER CARTERA:", error);
    res.status(500).json({ message: "Error al obtener la cartera" });
  }
});

// ============================================
// GESTIONES (llamadas, visitas, promesas)
// ============================================
router.get("/gestiones/:id_prestamo", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT g.*, u.nombre_completo AS registrado_por
       FROM gestiones_cobro g LEFT JOIN usuarios u ON g.id_usuario = u.id_usuario
       WHERE g.id_prestamo = ? ORDER BY g.fecha DESC, g.id_gestion DESC LIMIT 50`,
      [req.params.id_prestamo]
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error("ERROR AL LISTAR GESTIONES:", error);
    res.status(500).json({ message: "Error al obtener las gestiones" });
  }
});

router.post("/gestiones", async (req, res) => {
  try {
    const { id_prestamo, medio, nota, promesa_fecha, promesa_monto } = req.body;
    if (!id_prestamo || !String(nota || "").trim()) {
      return res.status(400).json({ message: "Indica el préstamo y una nota de la gestión." });
    }
    const medios = ["llamada", "visita", "mensaje", "correo", "otro"];
    const medioFinal = medios.includes(medio) ? medio : "llamada";
    const fechaPromesa = /^\d{4}-\d{2}-\d{2}$/.test(promesa_fecha || "") ? promesa_fecha : null;
    const montoPromesa = promesa_monto ? parseFloat(promesa_monto) : null;

    const [existe] = await pool.query("SELECT id_prestamo, id_usuario FROM prestamos WHERE id_prestamo = ?", [id_prestamo]);
    if (!existe.length) return res.status(404).json({ message: "Préstamo no encontrado" });

    await pool.query(
      `INSERT INTO gestiones_cobro (id_prestamo, medio, nota, promesa_fecha, promesa_monto, id_usuario)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id_prestamo, medioFinal, String(nota).trim().substring(0, 500), fechaPromesa, montoPromesa, req.usuario?.id_usuario || null]
    );
    await pool.query(
      `INSERT INTO bitacora (id_usuario, accion, detalle, fecha) VALUES (?, ?, ?, NOW())`,
      [existe[0].id_usuario, "Gestión de cobranza", `Préstamo #${id_prestamo}: ${medioFinal}. ${String(nota).trim().substring(0, 150)}`]
    );
    res.status(201).json({ success: true, message: "Gestión registrada" });
  } catch (error) {
    console.error("ERROR AL REGISTRAR GESTIÓN:", error);
    res.status(500).json({ message: "Error al registrar la gestión" });
  }
});

// ============================================
// RECORDATORIOS DE PAGO
// ============================================
const filaDe = async (idPrestamo) => (await obtenerCartera()).find((f) => f.id_prestamo === idPrestamo);

// Texto del recordatorio (para WhatsApp) y teléfono del socio
router.get("/recordatorio/:id_prestamo", async (req, res) => {
  try {
    const f = await filaDe(parseInt(req.params.id_prestamo));
    if (!f) return res.status(404).json({ message: "El préstamo no está vigente." });
    const m = mensajeRecordatorio(f, await nombreCooperativa());
    res.json({ success: true, data: { tipo: m.tipo, texto: m.texto, telefono: f.telefono, correo: f.correo } });
  } catch (error) {
    console.error("ERROR AL PREPARAR RECORDATORIO:", error);
    res.status(500).json({ message: "No se pudo preparar el recordatorio" });
  }
});

// Enviar ahora el recordatorio por correo a un socio
router.post("/recordatorio/:id_prestamo", async (req, res) => {
  try {
    const f = await filaDe(parseInt(req.params.id_prestamo));
    if (!f) return res.status(404).json({ message: "El préstamo no está vigente." });
    const m = mensajeRecordatorio(f, await nombreCooperativa());
    const envio = await notificarSocio(f.id_usuario, m.asunto, htmlDe(m.texto));
    if (!envio.enviado) return res.status(400).json({ message: envio.motivo });
    await registrarGestion(
      f.id_prestamo,
      "correo",
      `Recordatorio de pago enviado por correo a ${envio.correo}.`,
      req.usuario?.id_usuario || null
    );
    res.json({ success: true, message: `Recordatorio enviado a ${envio.correo}.` });
  } catch (error) {
    console.error("ERROR AL ENVIAR RECORDATORIO:", error);
    res.status(500).json({ message: "No se pudo enviar el recordatorio" });
  }
});

// Ejecutar ya el envío automático del día (solo Super Administrador)
router.post("/recordatorios/ejecutar", async (req, res) => {
  try {
    if (req.usuario?.rol !== "Super Administrador") {
      return res.status(403).json({ message: "Solo el Super Administrador puede hacerlo." });
    }
    const r = await ejecutarRecordatorios();
    if (r.motivo) return res.status(400).json({ message: r.motivo, data: r });
    res.json({
      success: true,
      message:
        `Se enviaron ${r.enviados} recordatorio(s): ${r.previos} antes del vencimiento y ${r.mora} de mora.` +
        (r.ya_enviados ? ` ${r.ya_enviados} ya se habían enviado.` : "") +
        (r.sin_correo ? ` ${r.sin_correo} socio(s) sin correo.` : "") +
        (r.errores ? ` ${r.errores} no se pudieron enviar.` : ""),
      data: r,
    });
  } catch (error) {
    console.error("ERROR AL EJECUTAR RECORDATORIOS:", error);
    res.status(500).json({ message: "No se pudieron enviar los recordatorios" });
  }
});

// ============================================
// CARTERA POR ASESOR Y AGENDA DE COBRO (función "cartera_asesor")
// ============================================
const conAsesor = async (req, res, next) => {
  if (await habilitada("cartera_asesor", req.usuario)) return next();
  res.status(403).json({ message: "La cartera por asesor no está habilitada." });
};
const num = (v) => parseFloat(v || 0);
const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

// GET /api/cobranza/asesores → cartera, atraso y cobros del mes de cada asesor
router.get("/asesores", conAsesor, async (req, res) => {
  try {
    const filas = await obtenerCartera(await filtroSocio(req));
    const mes = hoyISO().substring(0, 7);
    const [cobros] = await pool.query(
      `SELECT p.id_promotor AS id, IFNULL(SUM(pp.monto_pagado), 0) AS cobrado, COUNT(*) AS pagos
       FROM pagos_prestamo pp JOIN prestamos p ON p.id_prestamo = pp.id_prestamo
       WHERE DATE_FORMAT(pp.fecha_pago, '%Y-%m') = ? GROUP BY p.id_promotor`,
      [mes]
    );
    const [gestiones] = await pool.query(
      `SELECT p.id_promotor AS id, COUNT(*) AS n FROM gestiones_cobro g JOIN prestamos p ON p.id_prestamo = g.id_prestamo
       WHERE DATE_FORMAT(g.fecha, '%Y-%m') = ? GROUP BY p.id_promotor`,
      [mes]
    );
    const grupos = new Map();
    for (const f of filas) {
      const k = f.id_asesor || 0;
      const g = grupos.get(k) || { id_asesor: f.id_asesor, asesor: f.asesor || "Sin asesor", prestamos: 0, saldo: 0, saldo_atraso: 0, con_atraso: 0, mora: 0, promesas_vencidas: 0 };
      g.prestamos += 1;
      g.saldo = r2(g.saldo + f.saldo);
      g.mora = r2(g.mora + f.mora_generada);
      if (f.dias_atraso > 0 || f.dias_mora > 0) {
        g.con_atraso += 1;
        g.saldo_atraso = r2(g.saldo_atraso + f.saldo);
      }
      if (f.promesa_vencida) g.promesas_vencidas += 1;
      grupos.set(k, g);
    }
    const data = [...grupos.values()].map((g) => {
      const c = cobros.find((x) => (x.id || 0) === (g.id_asesor || 0));
      const ge = gestiones.find((x) => (x.id || 0) === (g.id_asesor || 0));
      return {
        ...g,
        morosidad: g.saldo > 0 ? r2((g.saldo_atraso / g.saldo) * 100) : 0,
        cobrado_mes: r2(num(c?.cobrado)),
        pagos_mes: c ? c.pagos : 0,
        gestiones_mes: ge ? ge.n : 0,
      };
    });
    data.sort((a, b) => (a.id_asesor ? 0 : 1) - (b.id_asesor ? 0 : 1) || b.saldo - a.saldo);
    res.json({ success: true, mes, data });
  } catch (error) {
    console.error("ERROR EN CARTERA POR ASESOR:", error);
    res.status(500).json({ message: "No se pudo calcular la cartera por asesor" });
  }
});

// GET /api/cobranza/agenda?id_asesor=yo|N|todos → a quién llamar o visitar hoy, en orden
router.get("/agenda", conAsesor, async (req, res) => {
  try {
    let filas = await obtenerCartera(await filtroSocio(req));
    const q = String(req.query.id_asesor || "yo");
    if (q !== "todos") {
      const id = q === "yo" ? req.usuario.id_usuario : parseInt(q);
      filas = q === "sin" ? filas.filter((f) => !f.id_asesor) : filas.filter((f) => f.id_asesor === id);
    }
    const hoy = hoyISO();
    const items = [];
    for (const f of filas) {
      // Con plan de pagos manda la cuota vencida; sin plan, los días de mora
      const atraso = f.con_plan ? f.dias_atraso : f.dias_mora;
      const ultima = soloFecha(f.ultima_gestion);
      const gestionHoy = ultima === hoy;
      const diasSinGestion = ultima ? diasEntre(ultima, hoy) : null;
      let prioridad = null;
      let motivo = null;
      if (f.promesa_fecha && f.promesa_fecha === hoy && atraso > 0) {
        prioridad = 1;
        motivo = "Prometió pagar hoy";
      } else if (f.promesa_vencida) {
        prioridad = 1;
        motivo = `Incumplió la promesa del ${f.promesa_fecha}`;
      } else if (atraso > 0 && (diasSinGestion === null || diasSinGestion >= 3) && !(f.promesa_fecha && f.promesa_fecha > hoy)) {
        prioridad = atraso > 30 ? 1 : 2;
        motivo = `${atraso} días de atraso${diasSinGestion === null ? ", nunca se ha gestionado" : `, última gestión hace ${diasSinGestion} días`}`;
      } else if (atraso === 0 && f.dias_para_vencer === 0) {
        prioridad = 3;
        motivo = "Su cuota vence hoy";
      } else if (atraso === 0 && f.dias_para_vencer > 0 && f.dias_para_vencer <= 3) {
        prioridad = 4;
        motivo = `Su cuota vence en ${f.dias_para_vencer} días`;
      }
      if (prioridad) {
        items.push({
          prioridad, motivo, gestionado_hoy: !!gestionHoy,
          id_prestamo: f.id_prestamo, socio: f.socio, telefono: f.telefono, cuota: f.cuota, saldo: f.saldo,
          mora_generada: f.mora_generada, dias_atraso: atraso, monto_vencido: f.monto_vencido,
          ultima_nota: f.ultima_nota, ultima_gestion: f.ultima_gestion, promesa_fecha: f.promesa_fecha, asesor: f.asesor,
        });
      }
    }
    items.sort((a, b) => a.gestionado_hoy - b.gestionado_hoy || a.prioridad - b.prioridad || b.dias_atraso - a.dias_atraso);
    res.json({ success: true, fecha: hoy, data: items, pendientes: items.filter((i) => !i.gestionado_hoy).length });
  } catch (error) {
    console.error("ERROR EN AGENDA DE COBRO:", error);
    res.status(500).json({ message: "No se pudo armar la agenda" });
  }
});

// GET /api/cobranza/personal → a quién se le puede asignar cartera (personal activo)
router.get("/personal", conAsesor, async (req, res) => {
  try {
    const [filas] = await pool.query(
      `SELECT u.id_usuario, u.nombre_completo, r.nombre AS rol FROM usuarios u JOIN roles r ON r.id_rol = u.rol_id
       WHERE u.estado = 'activo' AND r.nombre <> 'Socio' ORDER BY u.nombre_completo`
    );
    res.json({ success: true, data: filas });
  } catch (error) {
    res.status(500).json({ message: "No se pudo cargar el personal" });
  }
});

// POST /api/cobranza/asignar { ids: [id_prestamo], id_asesor (null = quitar) }
router.post("/asignar", conAsesor, async (req, res) => {
  try {
    const ids = (Array.isArray(req.body?.ids) ? req.body.ids : []).map((x) => parseInt(x)).filter(Boolean);
    if (!ids.length) return res.status(400).json({ message: "Elige al menos un préstamo." });
    let asesor = null;
    if (req.body?.id_asesor) {
      const [[a]] = await pool.query(
        `SELECT u.id_usuario, u.nombre_completo FROM usuarios u JOIN roles r ON r.id_rol = u.rol_id
         WHERE u.id_usuario = ? AND u.estado = 'activo' AND r.nombre <> 'Socio'`,
        [parseInt(req.body.id_asesor)]
      );
      if (!a) return res.status(400).json({ message: "El asesor debe ser alguien del personal activo." });
      asesor = a;
    }
    const [r] = await pool.query("UPDATE prestamos SET id_promotor = ? WHERE id_prestamo IN (?)", [asesor ? asesor.id_usuario : null, ids]);
    await pool.query("INSERT INTO bitacora (id_usuario, accion, detalle, fecha) VALUES (?, ?, ?, NOW())", [
      req.usuario.id_usuario,
      "Asignación de cartera",
      `${r.affectedRows} préstamo(s) ${asesor ? `asignados a ${asesor.nombre_completo}` : "sin asesor"}: #${ids.join(", #")}`.substring(0, 500),
    ]);
    res.json({ success: true, message: asesor ? `Asignado a ${asesor.nombre_completo}.` : "Quedó sin asesor." });
  } catch (error) {
    console.error("ERROR AL ASIGNAR CARTERA:", error);
    res.status(500).json({ message: "No se pudo asignar" });
  }
});

module.exports = router;
