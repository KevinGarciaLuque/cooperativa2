// Cumplimiento (prevención de lavado de dinero): alertas que el sistema genera al registrar
// movimientos en caja, su revisión por el oficial de cumplimiento y el reporte en Excel.
// Es información reservada: Super Administrador, Administrador (salvo que se le quite) o un rol
// con el módulo "Cumplimiento" activado expresamente.
const express = require("express");
const router = express.Router();
const ExcelJS = require("exceljs");
const pool = require("../db");
const { umbral } = require("../utils/cumplimiento");
const { obtener: paisActual } = require("../utils/pais");
const { habilitada } = require("../utils/funciones");
const { hoyISO } = require("../utils/fechas");

const TIPOS = {
  efectivo_umbral: "Efectivo sobre el umbral",
  fraccionamiento: "Posible fraccionamiento",
  pep: "Persona expuesta políticamente",
};
const ESTADOS = ["pendiente", "revisada", "reportada"];
const esFecha = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v || "");

router.use(async (req, res, next) => {
  const u = req.usuario;
  if (!u) return res.status(401).json({ message: "Sesión requerida" });
  if (u.rol === "Super Administrador") return next();
  try {
    const [[p]] = await pool.query(
      "SELECT activo FROM permisos_modulos WHERE rol_id = ? AND modulo = 'cumplimiento'",
      [u.rol_id]
    );
    // El Administrador entra salvo que se le quite; los demás roles, solo si se les activa
    if (p?.activo === 1 || (u.rol === "Administrador" && p?.activo !== 0)) return next();
  } catch {}
  res.status(403).json({ message: "No tienes acceso al módulo de cumplimiento." });
});

const filtrar = (q) => {
  const w = [];
  const p = [];
  if (ESTADOS.includes(q.estado)) {
    w.push("a.estado = ?");
    p.push(q.estado);
  }
  if (TIPOS[q.tipo]) {
    w.push("a.tipo = ?");
    p.push(q.tipo);
  }
  if (esFecha(q.desde)) {
    w.push("DATE(a.fecha) >= ?");
    p.push(q.desde);
  }
  if (esFecha(q.hasta)) {
    w.push("DATE(a.fecha) <= ?");
    p.push(q.hasta);
  }
  if (parseInt(q.id_socio)) {
    w.push("a.id_socio = ?");
    p.push(parseInt(q.id_socio));
  }
  return { where: w.length ? `WHERE ${w.join(" AND ")}` : "", params: p };
};

const listar = async (q, limite = 500) => {
  const f = filtrar(q);
  const [filas] = await pool.query(
    `SELECT a.*, u.nombre_completo, u.numero_socio, u.dni, u.es_pep, r.nombre_completo AS revisor
     FROM alertas_cumplimiento a
     JOIN usuarios u ON u.id_usuario = a.id_socio
     LEFT JOIN usuarios r ON r.id_usuario = a.revisado_por
     ${f.where}
     ORDER BY a.fecha DESC, a.id_alerta DESC
     LIMIT ${limite}`,
    f.params
  );
  return filas.map((a) => ({ ...a, tipo_texto: TIPOS[a.tipo] || a.tipo, monto: parseFloat(a.monto) }));
};

// GET /api/cumplimiento/resumen
router.get("/resumen", async (req, res) => {
  try {
    const [porEstado] = await pool.query("SELECT estado, COUNT(*) AS n FROM alertas_cumplimiento GROUP BY estado");
    const [[pep]] = await pool.query("SELECT COUNT(*) AS n FROM usuarios WHERE es_pep = 1");
    const [[incompletos]] = await pool.query(
      `SELECT COUNT(*) AS n FROM usuarios u JOIN roles r ON r.id_rol = u.rol_id
       WHERE r.nombre = 'Socio' AND u.estado = 'activo'
         AND (u.actividad_economica IS NULL OR u.ingreso_mensual IS NULL OR u.origen_fondos IS NULL
              OR NOT EXISTS (SELECT 1 FROM beneficiarios b WHERE b.id_usuario = u.id_usuario))`
    );
    const conteo = Object.fromEntries(ESTADOS.map((e) => [e, 0]));
    porEstado.forEach((r) => (conteo[r.estado] = r.n));
    res.json({
      success: true,
      data: {
        umbral: umbral(),
        umbral_pais: parseFloat(paisActual().umbral_efectivo || 0),
        alertas: conteo,
        socios_pep: pep.n,
        expedientes_incompletos: incompletos.n,
        tipos: TIPOS,
      },
    });
  } catch (error) {
    console.error("ERROR EN RESUMEN DE CUMPLIMIENTO:", error);
    res.status(500).json({ message: "No se pudo leer el resumen" });
  }
});

// GET /api/cumplimiento/alertas?estado=&tipo=&desde=&hasta=&id_socio=
router.get("/alertas", async (req, res) => {
  try {
    res.json({ success: true, data: await listar(req.query) });
  } catch (error) {
    console.error("ERROR AL LISTAR ALERTAS:", error);
    res.status(500).json({ message: "No se pudieron leer las alertas" });
  }
});

// PUT /api/cumplimiento/alertas/:id  { estado: revisada|reportada|pendiente, nota }
router.put("/alertas/:id", async (req, res) => {
  try {
    const { estado } = req.body || {};
    const nota = String(req.body?.nota || "").trim().substring(0, 500);
    if (!ESTADOS.includes(estado)) return res.status(400).json({ message: "Estado inválido." });
    if (estado !== "pendiente" && !nota) {
      return res.status(400).json({ message: "Escribe la nota de la revisión (qué se verificó o a quién se reportó)." });
    }
    const [r] = await pool.query(
      `UPDATE alertas_cumplimiento
       SET estado = ?, nota = ?, revisado_por = ?, revisado_en = ${estado === "pendiente" ? "NULL" : "NOW()"}
       WHERE id_alerta = ?`,
      [estado, nota || null, estado === "pendiente" ? null : req.usuario.id_usuario, parseInt(req.params.id)]
    );
    if (!r.affectedRows) return res.status(404).json({ message: "Alerta no encontrada" });
    // La bitácora queda a nombre del revisor (no del socio: la alerta es reservada)
    await pool.query(`INSERT INTO bitacora (id_usuario, accion, detalle, fecha) VALUES (?, ?, ?, NOW())`, [
      req.usuario.id_usuario,
      "Alerta de cumplimiento",
      `Alerta #${req.params.id} marcada como ${estado}`,
    ]);
    res.json({ success: true, message: "Alerta actualizada." });
  } catch (error) {
    console.error("ERROR AL ACTUALIZAR ALERTA:", error);
    res.status(500).json({ message: "No se pudo actualizar la alerta" });
  }
});

// GET /api/cumplimiento/exportar?...  (mismos filtros que /alertas)
router.get("/exportar", async (req, res) => {
  try {
    const filas = await listar(req.query, 100000);
    const [[sitio]] = await pool.query("SELECT valor FROM configuracion_sitio WHERE clave = 'site_name'");
    const libro = new ExcelJS.Workbook();
    const ws = libro.addWorksheet("Alertas");
    ws.addRow([sitio?.valor || "Cooperativa"]).font = { size: 14, bold: true };
    ws.addRow(["Alertas de prevención de lavado de dinero (reservado)"]).font = { size: 12, bold: true };
    ws.addRow([
      `${esFecha(req.query.desde) ? `Del ${req.query.desde}` : "Desde el inicio"} ${esFecha(req.query.hasta) ? `al ${req.query.hasta}` : "a la fecha"} · Moneda: ${paisActual().moneda.iso}`,
    ]).font = { size: 10, color: { argb: "FF666666" } };
    ws.addRow([]);
    ws.addRow(["#", "Fecha", "N.º socio", "Socio", "Identidad", "Tipo", "Monto", "Detalle", "Estado", "Nota", "Revisó", "Revisado en"]).font = { bold: true };
    filas.forEach((a) =>
      ws.addRow([
        a.id_alerta, a.fecha, a.numero_socio || "", a.nombre_completo, a.dni, a.tipo_texto, a.monto,
        a.detalle, a.estado, a.nota || "", a.revisor || "", a.revisado_en || "",
      ])
    );
    ws.getColumn(2).numFmt = "yyyy-mm-dd hh:mm";
    ws.getColumn(12).numFmt = "yyyy-mm-dd hh:mm";
    ws.getColumn(7).numFmt = "#,##0.00";
    [4, 8, 10].forEach((c) => (ws.getColumn(c).width = 40));
    [2, 6, 12].forEach((c) => (ws.getColumn(c).width = 20));
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="alertas_cumplimiento.xlsx"`);
    await libro.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("ERROR AL EXPORTAR ALERTAS:", error);
    if (!res.headersSent) res.status(500).json({ message: "No se pudo exportar" });
  }
});

// ============================================================================
// Reportes para la IVE (función "reportes_supervisor")
//  - Transacciones en efectivo: cada movimiento igual o mayor al umbral, y las "múltiples":
//    varios movimientos menores del mismo socio en un mismo día que juntos lo alcanzan.
//  - Transacciones sospechosas: las alertas que el oficial marcó como "reportada".
// Formato estándar en Excel; se ajusta al formulario que use la cooperativa.
// ============================================================================
const conIve = async (req, res, next) => {
  if (await habilitada("reportes_supervisor", req.usuario)) return next();
  res.status(403).json({ message: "Los reportes para la IVE no están habilitados." });
};

const rangoIve = (q) => {
  const hoy = hoyISO();
  const hasta = esFecha(q.hasta) ? q.hasta : hoy;
  const desde = esFecha(q.desde) ? q.desde : `${hasta.substring(0, 7)}-01`;
  return { desde, hasta };
};

const DATOS_SOCIO = `u.numero_socio, u.nombre_completo, u.dni, u.nacionalidad, u.fecha_nacimiento, u.profesion,
  u.actividad_economica, u.lugar_trabajo, u.direccion, u.municipio, u.departamento, u.origen_fondos, u.es_pep`;

const transaccionesEfectivo = async (q) => {
  const { desde, hasta } = rangoIve(q);
  const limite = umbral();
  const [movs] = await pool.query(
    `SELECT m.id_movimiento, m.fecha, DATE_FORMAT(m.fecha, '%Y-%m-%d') AS dia, DATE_FORMAT(m.fecha, '%H:%i') AS hora, m.tipo, m.categoria, m.descripcion, m.monto, m.id_socio,
            s.nombre AS agencia, c.nombre_completo AS cajero, ${DATOS_SOCIO}
     FROM caja_movimientos m
     JOIN usuarios u ON u.id_usuario = m.id_socio
     LEFT JOIN sucursales s ON s.id_sucursal = m.id_sucursal
     LEFT JOIN usuarios c ON c.id_usuario = m.id_registrado_por
     WHERE m.metodo = 'efectivo' AND DATE(m.fecha) BETWEEN ? AND ?
     ORDER BY m.fecha, m.id_movimiento`,
    [desde, hasta]
  );
  const filas = movs.map((m) => ({ ...m, monto: parseFloat(m.monto) }));
  const individuales = filas.filter((m) => m.monto >= limite);
  // Múltiples: mismo socio, mismo día y sentido, cada uno menor al umbral pero juntos lo alcanzan
  const grupos = {};
  filas
    .filter((m) => m.monto < limite)
    .forEach((m) => {
      const dia = m.dia;
      const k = `${m.id_socio}|${dia}|${m.tipo}`;
      (grupos[k] = grupos[k] || { dia, tipo: m.tipo, movimientos: [] }).movimientos.push(m);
    });
  const multiples = Object.values(grupos)
    .filter((g) => g.movimientos.length > 1 && g.movimientos.reduce((t, m) => t + m.monto, 0) >= limite)
    .map((g) => ({ ...g, total: Math.round(g.movimientos.reduce((t, m) => t + m.monto, 0) * 100) / 100, socio: g.movimientos[0] }));
  return { desde, hasta, umbral: limite, individuales, multiples };
};

// GET /api/cumplimiento/ive/efectivo?desde=&hasta=  (por defecto, el mes en curso)
router.get("/ive/efectivo", conIve, async (req, res) => {
  try {
    res.json({ success: true, ...(await transaccionesEfectivo(req.query)) });
  } catch (error) {
    console.error("ERROR EN REPORTE DE EFECTIVO:", error);
    res.status(500).json({ message: "No se pudo generar el reporte" });
  }
});

const sospechosas = async (q) => {
  const { desde, hasta } = rangoIve(q);
  const [filas] = await pool.query(
    `SELECT a.id_alerta, a.fecha, a.tipo, a.monto, a.detalle, a.nota, a.revisado_en,
            r.nombre_completo AS revisor, ${DATOS_SOCIO}
     FROM alertas_cumplimiento a
     JOIN usuarios u ON u.id_usuario = a.id_socio
     LEFT JOIN usuarios r ON r.id_usuario = a.revisado_por
     WHERE a.estado = 'reportada' AND DATE(COALESCE(a.revisado_en, a.fecha)) BETWEEN ? AND ?
     ORDER BY a.revisado_en, a.id_alerta`,
    [desde, hasta]
  );
  return { desde, hasta, data: filas.map((a) => ({ ...a, monto: parseFloat(a.monto), tipo_texto: TIPOS[a.tipo] || a.tipo })) };
};

// GET /api/cumplimiento/ive/sospechosas?desde=&hasta=  (alertas marcadas como reportadas)
router.get("/ive/sospechosas", conIve, async (req, res) => {
  try {
    res.json({ success: true, ...(await sospechosas(req.query)) });
  } catch (error) {
    console.error("ERROR EN REPORTE DE SOSPECHOSAS:", error);
    res.status(500).json({ message: "No se pudo generar el reporte" });
  }
});

const COLS_SOCIO = ["N.º socio", "Nombre", "Identidad", "Nacionalidad", "Fecha de nacimiento", "Profesión u oficio", "Actividad económica", "Lugar de trabajo", "Dirección", "Municipio", "Departamento", "Origen de los fondos", "PEP"];
const valoresSocio = (u) => [
  u.numero_socio || "", u.nombre_completo, u.dni, u.nacionalidad || "", u.fecha_nacimiento ? new Date(u.fecha_nacimiento) : "",
  u.profesion || "", u.actividad_economica || "", u.lugar_trabajo || "", u.direccion || "", u.municipio || "",
  u.departamento || "", u.origen_fondos || "", u.es_pep ? "Sí" : "No",
];

const libroIve = async (titulo, subtitulo) => {
  const [[sitio]] = await pool.query("SELECT valor FROM configuracion_sitio WHERE clave = 'site_name'");
  const libro = new ExcelJS.Workbook();
  const hoja = (nombre, columnas) => {
    const ws = libro.addWorksheet(nombre);
    ws.addRow([sitio?.valor || "Cooperativa"]).font = { size: 14, bold: true };
    ws.addRow([titulo]).font = { size: 12, bold: true };
    ws.addRow([subtitulo]).font = { size: 10, color: { argb: "FF666666" } };
    ws.addRow([]);
    const r = ws.addRow(columnas);
    r.font = { bold: true };
    r.eachCell((c) => (c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } }));
    columnas.forEach((_, i) => (ws.getColumn(i + 1).width = 18));
    return ws;
  };
  return { libro, hoja };
};

const enviarLibro = async (res, libro, nombre) => {
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${nombre}"`);
  await libro.xlsx.write(res);
  res.end();
};

router.get("/ive/efectivo/exportar", conIve, async (req, res) => {
  try {
    const d = await transaccionesEfectivo(req.query);
    const moneda = paisActual().moneda.iso;
    const { libro, hoja } = await libroIve(
      "Reporte de transacciones en efectivo (IVE)",
      `Del ${d.desde} al ${d.hasta} · Umbral: ${d.umbral} ${moneda} · Moneda: ${moneda}`
    );
    const base = ["Fecha y hora", "Operación", "Concepto", "Monto", "Agencia", "Registró"];
    const ws1 = hoja("Individuales", [...base, ...COLS_SOCIO]);
    d.individuales.forEach((m) =>
      ws1.addRow([new Date(m.fecha), m.tipo === "ingreso" ? "Ingreso de efectivo" : "Salida de efectivo", m.descripcion || m.categoria, m.monto, m.agencia || "", m.cajero || "", ...valoresSocio(m)])
    );
    const ws2 = hoja("Múltiples", ["Fecha", "Operación", "Movimientos", "Total del día", "Detalle", ...COLS_SOCIO]);
    d.multiples.forEach((g) =>
      ws2.addRow([
        g.dia, g.tipo === "ingreso" ? "Ingresos de efectivo" : "Salidas de efectivo", g.movimientos.length, g.total,
        g.movimientos.map((m) => `${m.hora} ${m.monto.toFixed(2)}`).join(" · "),
        ...valoresSocio(g.socio),
      ])
    );
    ws1.getColumn(1).numFmt = "yyyy-mm-dd hh:mm";
    ws1.getColumn(4).numFmt = "#,##0.00";
    ws1.getColumn(11).numFmt = "yyyy-mm-dd";
    ws2.getColumn(4).numFmt = "#,##0.00";
    ws2.getColumn(10).numFmt = "yyyy-mm-dd";
    ws2.getColumn(5).width = 40;
    await enviarLibro(res, libro, `ive_efectivo_${d.desde}_${d.hasta}.xlsx`);
  } catch (error) {
    console.error("ERROR AL EXPORTAR REPORTE DE EFECTIVO:", error);
    if (!res.headersSent) res.status(500).json({ message: "No se pudo exportar" });
  }
});

router.get("/ive/sospechosas/exportar", conIve, async (req, res) => {
  try {
    const d = await sospechosas(req.query);
    const moneda = paisActual().moneda.iso;
    const { libro, hoja } = await libroIve(
      "Reporte de transacciones sospechosas (IVE) — reservado",
      `Reportadas del ${d.desde} al ${d.hasta} · Moneda: ${moneda}`
    );
    const ws = hoja("Sospechosas", ["#", "Fecha de la operación", "Tipo de alerta", "Monto", "Descripción de la operación", "Análisis del oficial", "Revisó", "Fecha del reporte", ...COLS_SOCIO]);
    d.data.forEach((a) =>
      ws.addRow([a.id_alerta, new Date(a.fecha), a.tipo_texto, a.monto, a.detalle, a.nota || "", a.revisor || "", a.revisado_en ? new Date(a.revisado_en) : "", ...valoresSocio(a)])
    );
    ws.getColumn(2).numFmt = "yyyy-mm-dd hh:mm";
    ws.getColumn(8).numFmt = "yyyy-mm-dd";
    ws.getColumn(4).numFmt = "#,##0.00";
    ws.getColumn(13).numFmt = "yyyy-mm-dd";
    [5, 6].forEach((c) => (ws.getColumn(c).width = 45));
    await enviarLibro(res, libro, `ive_sospechosas_${d.desde}_${d.hasta}.xlsx`);
  } catch (error) {
    console.error("ERROR AL EXPORTAR SOSPECHOSAS:", error);
    if (!res.headersSent) res.status(500).json({ message: "No se pudo exportar" });
  }
});

module.exports = router;
