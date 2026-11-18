// Informe al supervisor (INACOP / INGECOP u otro): indicadores financieros con semáforo,
// cartera por categoría y mayores deudores; en pantalla y en Excel. Función nueva
// "reportes_supervisor" (la enciende el Super Administrador). Módulo de permisos: contabilidad.
const express = require("express");
const router = express.Router();
const ExcelJS = require("exceljs");
const pool = require("../db");
const { habilitada } = require("../utils/funciones");
const { calcularIndicadores } = require("../utils/indicadores");
const { obtener: paisActual } = require("../utils/pais");
const { hoyISO } = require("../utils/fechas");

const esFecha = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

router.use(async (req, res, next) => {
  if (await habilitada("reportes_supervisor", req.usuario)) return next();
  res.status(403).json({ message: "El informe al supervisor no está habilitado." });
});

const fechaCorte = (q) => (esFecha(q.hasta) && q.hasta <= hoyISO() ? q.hasta : hoyISO());

// GET /api/supervisor/indicadores?hasta=YYYY-MM-DD
router.get("/indicadores", async (req, res) => {
  try {
    res.json({ success: true, ...(await calcularIndicadores(fechaCorte(req.query))) });
  } catch (error) {
    console.error("ERROR AL CALCULAR INDICADORES:", error);
    res.status(500).json({ message: "No se pudieron calcular los indicadores" });
  }
});

const ESTADO_TEXTO = { bien: "Cumple", atencion: "En observación", mal: "No cumple", sin_dato: "—" };
const ESTADO_COLOR = { bien: "FFD1FAE5", atencion: "FFFEF3C7", mal: "FFFEE2E2" };

// GET /api/supervisor/exportar?hasta=YYYY-MM-DD → Excel con el informe completo
router.get("/exportar", async (req, res) => {
  try {
    const d = await calcularIndicadores(fechaCorte(req.query));
    const [[sitio]] = await pool.query("SELECT valor FROM configuracion_sitio WHERE clave = 'site_name'");
    const coop = sitio?.valor || "Cooperativa";
    const moneda = paisActual().moneda.iso;
    const libro = new ExcelJS.Workbook();
    const MONEDA = "#,##0.00";

    const encabezado = (ws, titulo, columnas) => {
      ws.mergeCells(1, 1, 1, columnas);
      ws.getCell(1, 1).value = coop;
      ws.getCell(1, 1).font = { size: 15, bold: true };
      ws.mergeCells(2, 1, 2, columnas);
      ws.getCell(2, 1).value = titulo;
      ws.getCell(2, 1).font = { size: 12, bold: true };
      ws.mergeCells(3, 1, 3, columnas);
      ws.getCell(3, 1).value = `Fecha de corte: ${d.fecha} · Moneda: ${moneda} · Fuente: ${d.fuente === "contabilidad" ? "contabilidad" : "datos de operación (aproximado)"}`;
      ws.getCell(3, 1).font = { size: 10, color: { argb: "FF666666" } };
      ws.addRow([]);
    };
    const cabecera = (ws, valores) => {
      const r = ws.addRow(valores);
      r.font = { bold: true };
      r.eachCell((c) => (c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } }));
    };

    // Indicadores
    const wi = libro.addWorksheet("Indicadores");
    encabezado(wi, "Indicadores financieros", 5);
    cabecera(wi, ["Indicador", "Valor (%)", "Meta", "Resultado", "Cómo se calcula"]);
    d.indicadores.forEach((i) => {
      const r = wi.addRow([i.nombre, i.valor, i.regla || "—", ESTADO_TEXTO[i.estado], i.formula]);
      if (ESTADO_COLOR[i.estado]) r.getCell(4).fill = { type: "pattern", pattern: "solid", fgColor: { argb: ESTADO_COLOR[i.estado] } };
    });
    if (d.aviso) {
      wi.addRow([]);
      wi.addRow([`Nota: ${d.aviso}`]).font = { italic: true, color: { argb: "FF92400E" } };
    }
    wi.getColumn(2).numFmt = "0.00";
    [42, 12, 18, 16, 60].forEach((w, i) => (wi.getColumn(i + 1).width = w));

    // Cifras base
    const wc = libro.addWorksheet("Cifras");
    encabezado(wc, "Cifras usadas en los indicadores", 2);
    cabecera(wc, ["Concepto", `Monto (${moneda})`]);
    const c = d.cifras;
    [
      ["Cartera de préstamos total", c.cartera_total],
      ["Cartera con cuotas atrasadas", c.cartera_con_atraso],
      ["Cartera con atraso mayor al primer rango", c.cartera_atraso_30],
      ["Provisión requerida según la cartera", c.provision_requerida],
      ["Provisión registrada en contabilidad", c.provision_contable],
      ["Caja y bancos", c.disponibilidades],
      ["Depósitos de socios (ahorro y plazo fijo)", c.depositos_socios],
      ["Activo total", c.activo_total],
      ["Pasivo total", c.pasivo_total],
      ["Patrimonio", c.patrimonio],
      ["Ingresos del año", c.ingresos_anio],
      ["Gastos del año", c.gastos_anio],
      ["Excedente del año", c.excedente_anio],
    ].forEach(([k, v]) => wc.addRow([k, v ?? "—"]));
    wc.addRow([]);
    [
      ["Préstamos vigentes", c.prestamos_vigentes],
      ["Préstamos con atraso", c.prestamos_con_atraso],
      ["Socios activos", c.socios_activos],
      ["Socios nuevos en el año", c.socios_nuevos_anio],
      ["Socios con préstamo", c.socios_con_prestamo],
    ].forEach(([k, v]) => wc.addRow([k, v]));
    wc.getColumn(2).numFmt = MONEDA;
    wc.getColumn(1).width = 44;
    wc.getColumn(2).width = 20;

    // Cartera por categoría
    const wk = libro.addWorksheet("Cartera por categoría");
    encabezado(wk, "Cartera por categoría de atraso y provisión", 6);
    cabecera(wk, ["Categoría", "Préstamos", "Saldo", "Mora generada", "% provisión", "Provisión"]);
    d.cartera_por_categoria.forEach((k) => wk.addRow([k.nombre, k.cantidad, k.saldo, k.mora, k.porcentaje_provision / 100, k.provision]));
    [3, 4, 6].forEach((i) => (wk.getColumn(i).numFmt = MONEDA));
    wk.getColumn(5).numFmt = "0%";
    [28, 12, 18, 16, 14, 18].forEach((w, i) => (wk.getColumn(i + 1).width = w));

    // Mayores deudores
    const wm = libro.addWorksheet("Mayores deudores");
    encabezado(wm, "Los 10 mayores deudores", 5);
    cabecera(wm, ["#", "Socio", "Identidad", "Préstamos", "Saldo"]);
    d.mayores_deudores.forEach((m, i) => wm.addRow([i + 1, m.socio, m.dni, m.prestamos, m.saldo]));
    wm.getColumn(5).numFmt = MONEDA;
    [6, 36, 18, 12, 18].forEach((w, i) => (wm.getColumn(i + 1).width = w));

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="informe_supervisor_${d.fecha}.xlsx"`);
    await libro.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("ERROR AL EXPORTAR INFORME AL SUPERVISOR:", error);
    if (!res.headersSent) res.status(500).json({ message: "No se pudo generar el informe" });
  }
});

module.exports = router;
