// Reportes ampliados (función "reportes_ampliados", la enciende el Super Administrador).
// Cada reporte se ve en pantalla (JSON) o se baja en Excel con ?formato=excel.
// Respetan la sucursal que se está viendo.
const express = require("express");
const router = express.Router();
const ExcelJS = require("exceljs");
const pool = require("../db");
const { habilitada } = require("../utils/funciones");
const { filtroSocio } = require("../utils/sucursal");
const { planDePrestamo } = require("../utils/planPagos");
const { hoyISO } = require("../utils/fechas");

const num = (v) => parseFloat(v || 0);
const r2 = (v) => Math.round(num(v) * 100) / 100;
const esFecha = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ""));
const soloFecha = (v) => (v instanceof Date ? v.toISOString().substring(0, 10) : v ? String(v).substring(0, 10) : "");

router.use(async (req, res, next) => {
  if (await habilitada("reportes_ampliados", req.usuario)) return next();
  res.status(403).json({ message: "Los reportes ampliados no están habilitados." });
});

// Préstamos con datos del socio, respetando la sucursal
const prestamos = async (req, estados, extra = "", params = []) => {
  const suc = await filtroSocio(req, "u");
  const [filas] = await pool.query(
    `SELECT p.*, u.nombre_completo, u.dni, u.numero_socio, u.telefono, u.municipio, u.departamento,
            s.nombre AS sucursal, pr.nombre_completo AS promotor, pc.nombre AS producto,
            (SELECT g.nombre FROM creditos_grupales cg JOIN grupos g ON g.id_grupo = cg.id_grupo WHERE cg.id_credito_grupal = p.id_credito_grupal) AS grupo,
            (SELECT MAX(fecha_pago) FROM pagos_prestamo pp WHERE pp.id_prestamo = p.id_prestamo) AS ultimo_pago,
            (SELECT IFNULL(SUM(monto_pagado), 0) FROM pagos_prestamo pp WHERE pp.id_prestamo = p.id_prestamo) AS total_pagado
     FROM prestamos p
     JOIN usuarios u ON u.id_usuario = p.id_usuario
     LEFT JOIN sucursales s ON s.id_sucursal = u.id_sucursal
     LEFT JOIN usuarios pr ON pr.id_usuario = p.id_promotor
     LEFT JOIN productos_credito pc ON pc.id_producto = p.id_producto
     WHERE p.estado IN (?)${extra}${suc.sql}
     ORDER BY u.nombre_completo, p.id_prestamo`,
    [estados, ...params, ...suc.params]
  );
  return filas.map((f) => ({ ...f, monto: num(f.monto), saldo_restante: num(f.saldo_restante), total_pagado: num(f.total_pagado) }));
};

// Cada reporte: { titulo, columnas: [[clave, encabezado, tipo]], filas, totales? }
const REPORTES = {
  // Historial crediticio de un socio: todos sus préstamos y su comportamiento de pago
  async historial(req) {
    const id = parseInt(req.query.id_usuario);
    if (!id) throw Object.assign(new Error("Elige un socio."), { codigo: 400 });
    const [[u]] = await pool.query("SELECT nombre_completo, dni FROM usuarios WHERE id_usuario = ?", [id]);
    if (!u) throw Object.assign(new Error("Socio no encontrado."), { codigo: 404 });
    const lista = await prestamos(req, ["pendiente", "aprobado", "activo", "mora", "pagado", "rechazado", "consolidado"], " AND p.id_usuario = ?", [id]);
    const filas = lista.map((p) => {
      const plan = planDePrestamo(p);
      return {
        id_prestamo: p.id_prestamo,
        fecha: soloFecha(p.fecha_otorgado),
        tipo: p.grupo ? `Grupal (${p.grupo})` : "Individual",
        linea: p.linea_credito || "",
        monto: p.monto,
        plazo: p.plazo_meses,
        pagado: p.total_pagado,
        saldo: p.saldo_restante,
        estado: p.estado,
        dias_atraso: plan?.resumen.dias_atraso || 0,
        cuotas: plan ? `${plan.resumen.cuotas_pagadas}/${plan.resumen.total_cuotas}` : "",
        ultimo_pago: soloFecha(p.ultimo_pago),
      };
    });
    const peorAtraso = Math.max(0, ...filas.map((f) => f.dias_atraso));
    return {
      titulo: `Historial crediticio · ${u.nombre_completo} (${u.dni})`,
      subtitulo: `${filas.length} préstamo(s) · ${filas.filter((f) => f.estado === "pagado").length} pagado(s) · mayor atraso actual: ${peorAtraso} días`,
      columnas: [
        ["id_prestamo", "Préstamo"], ["fecha", "Otorgado"], ["tipo", "Tipo"], ["linea", "Línea"], ["monto", "Monto", "dinero"],
        ["plazo", "Plazo"], ["pagado", "Pagado", "dinero"], ["saldo", "Saldo", "dinero"], ["estado", "Estado"],
        ["cuotas", "Cuotas pagadas"], ["dias_atraso", "Días de atraso"], ["ultimo_pago", "Último pago"],
      ],
      filas,
    };
  },

  // Proyección de cobros: cuotas por vencer (y vencidas sin pagar) en un rango de fechas
  async proyeccion(req) {
    const hoy = hoyISO();
    const desde = esFecha(req.query.desde) ? req.query.desde : hoy;
    const hasta = esFecha(req.query.hasta) ? req.query.hasta : `${hoy.substring(0, 7)}-31`;
    const filas = [];
    for (const p of await prestamos(req, ["activo", "mora"])) {
      const plan = planDePrestamo(p);
      if (!plan) continue;
      for (const c of plan.cuotas) {
        if (c.estado === "pagada") continue;
        const vencida = c.estado === "vencida";
        if (!vencida && (c.fecha_vencimiento < desde || c.fecha_vencimiento > hasta)) continue;
        if (vencida && c.fecha_vencimiento > hasta) continue;
        filas.push({
          fecha: c.fecha_vencimiento,
          socio: p.nombre_completo,
          telefono: p.telefono || "",
          id_prestamo: p.id_prestamo,
          cuota_numero: c.numero,
          cuota: r2(c.capital_pendiente + (c.capital_pagado > 0 ? 0 : c.interes)),
          capital: c.capital_pendiente,
          interes: c.capital_pagado > 0 ? 0 : c.interes,
          estado: vencida ? "Vencida" : "Por vencer",
          promotor: p.promotor || "",
        });
      }
    }
    filas.sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : a.socio.localeCompare(b.socio)));
    return {
      titulo: "Proyección de cobros",
      subtitulo: `Cuotas del ${desde} al ${hasta} y vencidas sin pagar`,
      columnas: [
        ["fecha", "Vence"], ["socio", "Socio"], ["telefono", "Teléfono"], ["id_prestamo", "Préstamo"], ["cuota_numero", "Cuota n.º"],
        ["cuota", "A cobrar", "dinero"], ["capital", "Capital", "dinero"], ["interes", "Interés", "dinero"], ["estado", "Estado"], ["promotor", "Promotor"],
      ],
      filas,
      totales: { cuota: r2(filas.reduce((t, f) => t + f.cuota, 0)), capital: r2(filas.reduce((t, f) => t + f.capital, 0)), interes: r2(filas.reduce((t, f) => t + f.interes, 0)) },
    };
  },

  // Créditos vencidos: ya pasó la fecha de la última cuota y todavía deben
  async vencidos(req) {
    const hoy = hoyISO();
    const filas = [];
    for (const p of await prestamos(req, ["activo", "mora"])) {
      const plan = planDePrestamo(p);
      const ultima = plan?.resumen.fecha_ultima_cuota;
      if (!ultima || ultima >= hoy || p.saldo_restante <= 0.01) continue;
      filas.push({
        id_prestamo: p.id_prestamo, socio: p.nombre_completo, telefono: p.telefono || "", vencio: ultima,
        dias: plan.resumen.dias_atraso, monto: p.monto, saldo: p.saldo_restante, ultimo_pago: soloFecha(p.ultimo_pago), promotor: p.promotor || "",
      });
    }
    filas.sort((a, b) => b.dias - a.dias);
    return {
      titulo: "Créditos vencidos",
      subtitulo: "Préstamos cuyo plazo ya terminó y todavía tienen saldo",
      columnas: [
        ["id_prestamo", "Préstamo"], ["socio", "Socio"], ["telefono", "Teléfono"], ["vencio", "Venció"], ["dias", "Días de atraso"],
        ["monto", "Monto", "dinero"], ["saldo", "Saldo", "dinero"], ["ultimo_pago", "Último pago"], ["promotor", "Promotor"],
      ],
      filas,
      totales: { saldo: r2(filas.reduce((t, f) => t + f.saldo, 0)) },
    };
  },

  // Pendientes de cerrar: sin saldo de capital pero aún activos (falta el último trámite)
  async por_cerrar(req) {
    const filas = (await prestamos(req, ["activo", "mora"])).filter((p) => p.saldo_restante <= 0.01).map((p) => ({
      id_prestamo: p.id_prestamo, socio: p.nombre_completo, monto: p.monto, pagado: p.total_pagado, ultimo_pago: soloFecha(p.ultimo_pago), estado: p.estado,
    }));
    return {
      titulo: "Créditos pendientes de cerrar",
      subtitulo: "Sin saldo de capital pero todavía activos: revisar intereses o mora pendientes y marcarlos como pagados",
      columnas: [["id_prestamo", "Préstamo"], ["socio", "Socio"], ["monto", "Monto", "dinero"], ["pagado", "Total pagado", "dinero"], ["ultimo_pago", "Último pago"], ["estado", "Estado"]],
      filas,
    };
  },

  // Créditos cerrados (pagados) en un rango de fechas del último pago
  async cerrados(req) {
    const extra = [];
    const params = [];
    if (esFecha(req.query.desde)) {
      extra.push(" AND (SELECT MAX(fecha_pago) FROM pagos_prestamo pp WHERE pp.id_prestamo = p.id_prestamo) >= ?");
      params.push(req.query.desde);
    }
    if (esFecha(req.query.hasta)) {
      extra.push(" AND (SELECT MAX(fecha_pago) FROM pagos_prestamo pp WHERE pp.id_prestamo = p.id_prestamo) <= ?");
      params.push(`${req.query.hasta} 23:59:59`);
    }
    const filas = (await prestamos(req, ["pagado"], extra.join(""), params)).map((p) => ({
      id_prestamo: p.id_prestamo, socio: p.nombre_completo, otorgado: soloFecha(p.fecha_otorgado), cerrado: soloFecha(p.ultimo_pago),
      monto: p.monto, pagado: p.total_pagado, intereses: r2(p.total_pagado - p.monto), linea: p.linea_credito || "", grupo: p.grupo || "",
    }));
    return {
      titulo: "Créditos cerrados",
      subtitulo: [req.query.desde && `desde ${req.query.desde}`, req.query.hasta && `hasta ${req.query.hasta}`].filter(Boolean).join(" ") || "Todos",
      columnas: [
        ["id_prestamo", "Préstamo"], ["socio", "Socio"], ["otorgado", "Otorgado"], ["cerrado", "Último pago"], ["monto", "Monto", "dinero"],
        ["pagado", "Total pagado", "dinero"], ["intereses", "Intereses y mora", "dinero"], ["linea", "Línea"], ["grupo", "Grupo"],
      ],
      filas,
      totales: { monto: r2(filas.reduce((t, f) => t + f.monto, 0)), pagado: r2(filas.reduce((t, f) => t + f.pagado, 0)) },
    };
  },

  // Cartera agrupada por promotor, línea, municipio, sucursal, producto o tipo
  async cartera(req) {
    const POR = {
      promotor: ["Promotor", (p) => p.promotor || "(sin promotor)"],
      linea: ["Línea", (p) => p.linea_credito || "(sin línea)"],
      municipio: ["Municipio", (p) => [p.municipio, p.departamento].filter(Boolean).join(", ") || "(sin municipio)"],
      sucursal: ["Sucursal", (p) => p.sucursal || "(sin sucursal)"],
      producto: ["Producto", (p) => p.producto || "(sin producto)"],
      tipo: ["Tipo", (p) => (p.grupo ? "Grupal" : "Individual")],
    };
    const [nombre, clave] = POR[req.query.por] || POR.promotor;
    const grupos = new Map();
    for (const p of await prestamos(req, ["activo", "mora"])) {
      const k = clave(p);
      const g = grupos.get(k) || { grupo: k, prestamos: 0, monto: 0, saldo: 0, en_mora: 0, saldo_mora: 0 };
      g.prestamos += 1;
      g.monto = r2(g.monto + p.monto);
      g.saldo = r2(g.saldo + p.saldo_restante);
      const atraso = planDePrestamo(p)?.resumen.dias_atraso || 0;
      if (p.estado === "mora" || atraso > 0) {
        g.en_mora += 1;
        g.saldo_mora = r2(g.saldo_mora + p.saldo_restante);
      }
      grupos.set(k, g);
    }
    const filas = [...grupos.values()]
      .map((g) => ({ ...g, pct_mora: g.saldo > 0 ? r2((g.saldo_mora / g.saldo) * 100) : 0 }))
      .sort((a, b) => b.saldo - a.saldo);
    return {
      titulo: `Cartera por ${nombre.toLowerCase()}`,
      subtitulo: "Préstamos vigentes",
      columnas: [
        ["grupo", nombre], ["prestamos", "Préstamos"], ["monto", "Monto otorgado", "dinero"], ["saldo", "Saldo", "dinero"],
        ["en_mora", "Con atraso"], ["saldo_mora", "Saldo con atraso", "dinero"], ["pct_mora", "% en riesgo"],
      ],
      filas,
      totales: { prestamos: filas.reduce((t, f) => t + f.prestamos, 0), saldo: r2(filas.reduce((t, f) => t + f.saldo, 0)), saldo_mora: r2(filas.reduce((t, f) => t + f.saldo_mora, 0)) },
    };
  },
};

const excel = async (res, r, nombre) => {
  const [[coop]] = await pool.query("SELECT valor FROM configuracion_sitio WHERE clave = 'site_name'");
  const libro = new ExcelJS.Workbook();
  const ws = libro.addWorksheet(r.titulo.substring(0, 30).replace(/[\\/*?:[\]]/g, " "));
  ws.addRow([coop?.valor || "Cooperativa"]).font = { size: 14, bold: true };
  ws.addRow([r.titulo]).font = { size: 12, bold: true };
  if (r.subtitulo) ws.addRow([r.subtitulo]).font = { size: 10, color: { argb: "FF666666" } };
  ws.addRow([]);
  ws.addRow(r.columnas.map((c) => c[1])).font = { bold: true };
  r.filas.forEach((f) => ws.addRow(r.columnas.map((c) => f[c[0]])));
  if (r.totales) {
    ws.addRow(r.columnas.map((c, i) => (i === 0 ? "Totales" : r.totales[c[0]] ?? ""))).font = { bold: true };
  }
  r.columnas.forEach((c, i) => {
    const col = ws.getColumn(i + 1);
    col.width = Math.max(12, c[1].length + 4);
    if (c[2] === "dinero") col.numFmt = "#,##0.00";
  });
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${nombre}.xlsx"`);
  await libro.xlsx.write(res);
  res.end();
};

// GET /api/reportes-ampliados/:tipo?formato=excel&...
router.get("/:tipo", async (req, res) => {
  const fn = REPORTES[req.params.tipo];
  if (!fn) return res.status(404).json({ message: "Reporte no encontrado" });
  try {
    const r = await fn(req);
    if (req.query.formato === "excel") return excel(res, r, req.params.tipo);
    res.json({ success: true, ...r });
  } catch (e) {
    if (e.codigo) return res.status(e.codigo).json({ message: e.message });
    console.error("ERROR EN REPORTE AMPLIADO:", e);
    res.status(500).json({ message: "No se pudo generar el reporte" });
  }
});

module.exports = router;
