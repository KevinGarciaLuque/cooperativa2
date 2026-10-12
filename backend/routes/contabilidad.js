const express = require("express");
const { hoyISO, anioMesActual } = require("../utils/fechas");
const router = express.Router();
const ExcelJS = require("exceljs");
const pool = require("../db");
const { obtenerCartera, resumirCartera, CATEGORIAS } = require("../utils/cartera");

const num = (v) => parseFloat(v || 0);
const redondear = (v) => parseFloat(num(v).toFixed(2));

const ETIQUETAS_CARTERA = {
  al_dia: "Al día",
  por_vencer: "Por vencer (7 días)",
  mora_1_30: "Mora 1-30 días",
  mora_31_60: "Mora 31-60 días",
  mora_61_90: "Mora 61-90 días",
  mora_90_mas: "Mora más de 90 días",
};

const ETIQUETAS_GASTO = {
  gasto_servicios: "Servicios (agua, luz, internet)",
  gasto_salarios: "Salarios y honorarios",
  gasto_alquiler: "Alquiler",
  gasto_papeleria: "Papelería y útiles",
  gasto_transporte: "Transporte y viáticos",
  gasto_otros: "Otros gastos",
};

const ETIQUETAS_ACTIVIDAD = {
  rifas: "Rifas",
  ventas: "Ventas",
  intereses_ganados: "Intereses ganados",
  donaciones: "Donaciones",
  alquileres: "Alquileres",
  otros_ingresos: "Otros ingresos",
};

const nombreCooperativa = async () => {
  try {
    const [rows] = await pool.query("SELECT valor FROM configuracion_sitio WHERE clave = 'site_name'");
    return rows.length ? rows[0].valor : "Cooperativa";
  } catch {
    return "Cooperativa";
  }
};

const rangoDelMes = (anio, mes) => ({
  desde: new Date(Date.UTC(anio, mes - 1, 1)).toISOString().substring(0, 10),
  hasta: new Date(Date.UTC(anio, mes, 1)).toISOString().substring(0, 10),
});

const esFecha = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(Date.parse(v));

// ───────────────────────────────────────────────────────────
// Estado de resultados de un período [desde, hasta)
// ───────────────────────────────────────────────────────────
const estadoResultados = async (desde, hasta) => {
  const [[pagos]] = await pool.query(
    `SELECT COUNT(*) AS cantidad,
            IFNULL(SUM(monto_pagado), 0) AS total,
            IFNULL(SUM(monto_capital), 0) AS capital,
            IFNULL(SUM(monto_interes), 0) AS interes,
            IFNULL(SUM(CASE
              WHEN monto_capital IS NOT NULL AND monto_interes IS NOT NULL
                   AND monto_pagado - monto_capital - monto_interes > 0.005
              THEN monto_pagado - monto_capital - monto_interes ELSE 0 END), 0) AS mora
     FROM pagos_prestamo WHERE fecha_pago >= ? AND fecha_pago < ?`,
    [desde, hasta]
  );

  const [actividades] = await pool.query(
    `SELECT tipo, IFNULL(SUM(monto), 0) AS total
     FROM actividades WHERE fecha >= ? AND fecha < ? GROUP BY tipo ORDER BY total DESC`,
    [desde, hasta]
  );

  const [gastos] = await pool.query(
    `SELECT categoria,
            IFNULL(SUM(CASE WHEN tipo = 'egreso' THEN monto ELSE -monto END), 0) AS total
     FROM caja_movimientos
     WHERE categoria LIKE 'gasto\\_%' AND fecha >= ? AND fecha < ?
     GROUP BY categoria ORDER BY total DESC`,
    [desde, hasta]
  );

  const interes = redondear(pagos.interes);
  const mora = redondear(pagos.mora);
  const otros = actividades.map((a) => ({
    tipo: a.tipo,
    etiqueta: ETIQUETAS_ACTIVIDAD[a.tipo] || a.tipo,
    total: redondear(a.total),
  }));
  const totalOtros = redondear(otros.reduce((s, a) => s + a.total, 0));
  const totalIngresos = redondear(interes + mora + totalOtros);

  const detalleGastos = gastos.map((g) => ({
    categoria: g.categoria,
    etiqueta: ETIQUETAS_GASTO[g.categoria] || g.categoria.replace("gasto_", ""),
    total: redondear(g.total),
  }));
  const totalGastos = redondear(detalleGastos.reduce((s, g) => s + g.total, 0));

  return {
    desde,
    hasta,
    ingresos: {
      intereses_prestamos: interes,
      mora,
      otros,
      total_otros: totalOtros,
      total: totalIngresos,
    },
    gastos: { detalle: detalleGastos, total: totalGastos },
    excedente: redondear(totalIngresos - totalGastos),
    pagos_recibidos: pagos.cantidad,
    capital_recuperado: redondear(pagos.capital),
  };
};

// ───────────────────────────────────────────────────────────
// Situación financiera (administrativa) a la fecha
// ───────────────────────────────────────────────────────────
const situacionFinanciera = async () => {
  const [[caja]] = await pool.query(
    `SELECT
       IFNULL(SUM(CASE WHEN metodo = 'efectivo' THEN (CASE WHEN tipo = 'ingreso' THEN monto ELSE -monto END) ELSE 0 END), 0) AS efectivo,
       IFNULL(SUM(CASE WHEN metodo <> 'efectivo' THEN (CASE WHEN tipo = 'ingreso' THEN monto ELSE -monto END) ELSE 0 END), 0) AS bancos
     FROM caja_movimientos`
  );
  const [[prest]] = await pool.query(
    `SELECT IFNULL(SUM(saldo_restante), 0) AS saldo, COUNT(*) AS cantidad
     FROM prestamos WHERE estado IN ('activo', 'mora')`
  );
  const [[cuentas]] = await pool.query(
    `SELECT IFNULL(SUM(saldo_actual), 0) AS saldo FROM cuentas WHERE estado = 'activa'`
  );
  const [porTipo] = await pool.query(
    `SELECT tipo_cuenta, IFNULL(SUM(saldo_actual), 0) AS saldo
     FROM cuentas WHERE estado = 'activa' GROUP BY tipo_cuenta`
  );

  const filas = await obtenerCartera();
  const { totales } = resumirCartera(filas);

  const efectivo = redondear(caja.efectivo);
  const bancos = redondear(caja.bancos);
  const cartera = redondear(prest.saldo);
  const provision = totales.provision;
  const activos = redondear(efectivo + bancos + cartera - provision);
  const obligaciones = redondear(cuentas.saldo);

  const advertencias = [];
  if (efectivo < 0 || bancos < 0) {
    advertencias.push(
      "El libro de caja muestra saldo negativo: falta registrar el saldo inicial o el capital con el que se otorgaron los préstamos anteriores (Caja → Registrar ingreso → Saldo inicial)."
    );
  }

  return {
    advertencias,
    activos: {
      efectivo,
      bancos,
      cartera_prestamos: cartera,
      prestamos_vigentes: prest.cantidad,
      provision_cartera: provision,
      total: activos,
    },
    obligaciones_socios: {
      por_cuenta: porTipo.map((c) => ({ tipo: c.tipo_cuenta, saldo: redondear(c.saldo) })),
      total: obligaciones,
    },
    patrimonio_neto: redondear(activos - obligaciones),
  };
};

// ───────────────────────────────────────────────────────────
// Construye el resumen completo de un mes
// ───────────────────────────────────────────────────────────
const construirCierre = async (anio, mes) => {
  const { desde, hasta } = rangoDelMes(anio, mes);
  const resultados = await estadoResultados(desde, hasta);

  const [[aport]] = await pool.query(
    `SELECT COUNT(*) AS cantidad, IFNULL(SUM(monto), 0) AS total
     FROM aportaciones WHERE fecha >= ? AND fecha < ?`,
    [desde, hasta]
  );
  const [[otorgados]] = await pool.query(
    `SELECT COUNT(*) AS cantidad, IFNULL(SUM(monto), 0) AS monto
     FROM prestamos WHERE fecha_otorgado >= ? AND fecha_otorgado < ?
     AND estado IN ('activo','mora','pagado')`,
    [desde, hasta]
  );
  const [[socios]] = await pool.query(
    `SELECT COUNT(*) AS cantidad FROM usuarios WHERE rol_id != 1 AND fecha_registro >= ? AND fecha_registro < ?`,
    [desde, hasta]
  );
  const [flujoCaja] = await pool.query(
    `SELECT tipo, IFNULL(SUM(monto), 0) AS total
     FROM caja_movimientos WHERE fecha >= ? AND fecha < ? GROUP BY tipo`,
    [desde, hasta]
  );

  const filas = await obtenerCartera();
  const cartera = resumirCartera(filas);
  const situacion = await situacionFinanciera();

  return {
    periodo: { anio, mes, desde, hasta },
    resultados,
    aportaciones: { cantidad: aport.cantidad, total: redondear(aport.total) },
    prestamos_otorgados: { cantidad: otorgados.cantidad, monto: redondear(otorgados.monto) },
    nuevos_socios: socios.cantidad,
    caja: {
      ingresos: redondear(flujoCaja.find((f) => f.tipo === "ingreso")?.total),
      egresos: redondear(flujoCaja.find((f) => f.tipo === "egreso")?.total),
    },
    cartera,
    situacion,
    generado_en: new Date().toISOString(),
  };
};

// ============================================
// CIERRE MENSUAL: consulta (guardado si existe, si no calculado en vivo)
// GET /api/contabilidad/cierre-mensual?anio=2026&mes=9
// ============================================
router.get("/cierre-mensual", async (req, res) => {
  try {
    const hoy = new Date();
    const anio = parseInt(req.query.anio) || anioMesActual().anio;
    const mes = parseInt(req.query.mes) || anioMesActual().mes;
    if (mes < 1 || mes > 12 || anio < 2000 || anio > 2100) {
      return res.status(400).json({ message: "Mes o año inválido" });
    }

    const [guardado] = await pool.query(
      `SELECT c.*, u.nombre_completo AS cerrado_por_nombre
       FROM cierres_mensuales c LEFT JOIN usuarios u ON c.cerrado_por = u.id_usuario
       WHERE c.anio = ? AND c.mes = ?`,
      [anio, mes]
    );

    const mesTerminado = new Date(Date.UTC(anio, mes, 1)) <= new Date();

    if (guardado.length) {
      let data = null;
      try {
        data = JSON.parse(guardado[0].datos);
      } catch {
        data = null;
      }
      return res.json({
        success: true,
        cerrado: true,
        puede_cerrar: false,
        cierre: {
          cerrado_en: guardado[0].fecha_cierre,
          cerrado_por: guardado[0].cerrado_por_nombre,
          observacion: guardado[0].observacion,
        },
        data,
      });
    }

    res.json({
      success: true,
      cerrado: false,
      puede_cerrar: mesTerminado,
      cierre: null,
      data: await construirCierre(anio, mes),
    });
  } catch (error) {
    console.error("ERROR AL CONSULTAR CIERRE MENSUAL:", error);
    res.status(500).json({ message: "Error al consultar el cierre mensual" });
  }
});

// Cerrar (congelar) un mes ya terminado
router.post("/cierre-mensual", async (req, res) => {
  try {
    const anio = parseInt(req.body.anio);
    const mes = parseInt(req.body.mes);
    if (!anio || !mes || mes < 1 || mes > 12) {
      return res.status(400).json({ message: "Indica el año y el mes a cerrar." });
    }
    if (new Date(Date.UTC(anio, mes, 1)) > new Date()) {
      return res.status(400).json({ message: "Solo se puede cerrar un mes que ya terminó." });
    }

    const [existe] = await pool.query(`SELECT id_cierre FROM cierres_mensuales WHERE anio = ? AND mes = ?`, [anio, mes]);
    if (existe.length) return res.status(409).json({ message: "Este mes ya está cerrado." });

    const datos = await construirCierre(anio, mes);
    await pool.query(
      `INSERT INTO cierres_mensuales (anio, mes, datos, observacion, cerrado_por) VALUES (?, ?, ?, ?, ?)`,
      [anio, mes, JSON.stringify(datos), String(req.body.observacion || "").substring(0, 255) || null, req.usuario?.id_usuario || null]
    );
    await pool.query(
      `INSERT INTO bitacora (id_usuario, accion, detalle, fecha) VALUES (?, ?, ?, NOW())`,
      [req.usuario?.id_usuario, "Cierre mensual", `Se cerró ${String(mes).padStart(2, "0")}/${anio}. Excedente: L. ${datos.resultados.excedente.toFixed(2)}`]
    );
    res.status(201).json({ success: true, message: "Mes cerrado correctamente." });
  } catch (error) {
    console.error("ERROR AL CERRAR MES:", error);
    res.status(500).json({ message: "Error al cerrar el mes" });
  }
});

// Reabrir un mes (solo Super Administrador, con motivo)
router.delete("/cierre-mensual/:anio/:mes", async (req, res) => {
  try {
    if (req.usuario?.rol !== "Super Administrador") {
      return res.status(403).json({ message: "Solo el Super Administrador puede reabrir un mes." });
    }
    const motivo = String(req.body?.motivo || req.query.motivo || "").trim();
    if (motivo.length < 5) {
      return res.status(400).json({ message: "Indica el motivo de la reapertura (mínimo 5 caracteres)." });
    }
    const [r] = await pool.query(`DELETE FROM cierres_mensuales WHERE anio = ? AND mes = ?`, [req.params.anio, req.params.mes]);
    if (!r.affectedRows) return res.status(404).json({ message: "Ese mes no estaba cerrado." });
    await pool.query(
      `INSERT INTO bitacora (id_usuario, accion, detalle, fecha) VALUES (?, ?, ?, NOW())`,
      [req.usuario.id_usuario, "Reapertura de mes", `Se reabrió ${req.params.mes}/${req.params.anio}. Motivo: ${motivo}`]
    );
    res.json({ success: true, message: "Mes reabierto." });
  } catch (error) {
    console.error("ERROR AL REABRIR MES:", error);
    res.status(500).json({ message: "Error al reabrir el mes" });
  }
});

// Lista de meses cerrados
router.get("/cierres", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT anio, mes, fecha_cierre, observacion FROM cierres_mensuales ORDER BY anio DESC, mes DESC LIMIT 36`
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ message: "Error al listar los cierres" });
  }
});

// ============================================
// ANTIGÜEDAD DE CARTERA
// GET /api/contabilidad/antiguedad-cartera
// ============================================
router.get("/antiguedad-cartera", async (req, res) => {
  try {
    const filas = await obtenerCartera();
    const { resumen, totales } = resumirCartera(filas);
    res.json({
      success: true,
      fecha: hoyISO(),
      etiquetas: ETIQUETAS_CARTERA,
      resumen,
      totales,
      detalle: filas,
    });
  } catch (error) {
    console.error("ERROR EN ANTIGÜEDAD DE CARTERA:", error);
    res.status(500).json({ message: "Error al calcular la antigüedad de cartera" });
  }
});

// ============================================
// ESTADO DE RESULTADOS: ?anio=&mes=  o  ?desde=&hasta= (hasta inclusive)
// ============================================
router.get("/estado-resultados", async (req, res) => {
  try {
    let desde;
    let hasta;
    if (esFecha(req.query.desde) && esFecha(req.query.hasta)) {
      desde = req.query.desde;
      const h = new Date(req.query.hasta + "T00:00:00Z");
      h.setUTCDate(h.getUTCDate() + 1);
      hasta = h.toISOString().substring(0, 10);
    } else {
      const hoy = new Date();
      const anio = parseInt(req.query.anio) || anioMesActual().anio;
      const mes = parseInt(req.query.mes) || anioMesActual().mes;
      ({ desde, hasta } = rangoDelMes(anio, mes));
    }
    res.json({ success: true, data: await estadoResultados(desde, hasta) });
  } catch (error) {
    console.error("ERROR EN ESTADO DE RESULTADOS:", error);
    res.status(500).json({ message: "Error al calcular el estado de resultados" });
  }
});

// ============================================
// SITUACIÓN FINANCIERA
// ============================================
router.get("/situacion-financiera", async (req, res) => {
  try {
    res.json({ success: true, fecha: hoyISO(), data: await situacionFinanciera() });
  } catch (error) {
    console.error("ERROR EN SITUACIÓN FINANCIERA:", error);
    res.status(500).json({ message: "Error al calcular la situación financiera" });
  }
});

// ============================================
// EXPORTAR A EXCEL
// ============================================
const encabezadoExcel = async (ws, titulo, subtitulo, columnas) => {
  const coop = await nombreCooperativa();
  ws.mergeCells(1, 1, 1, columnas);
  ws.getCell(1, 1).value = coop;
  ws.getCell(1, 1).font = { size: 16, bold: true };
  ws.mergeCells(2, 1, 2, columnas);
  ws.getCell(2, 1).value = titulo;
  ws.getCell(2, 1).font = { size: 13, bold: true };
  ws.mergeCells(3, 1, 3, columnas);
  ws.getCell(3, 1).value = subtitulo;
  ws.getCell(3, 1).font = { size: 10, color: { argb: "FF666666" } };
  ws.addRow([]);
};

const enviarExcel = async (res, wb, nombre) => {
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename=${nombre}`);
  await wb.xlsx.write(res);
  res.end();
};

const estiloEncabezado = (row) => {
  row.font = { bold: true };
  row.eachCell((c) => {
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };
  });
};

router.get("/exportar/antiguedad-cartera", async (req, res) => {
  try {
    const filas = await obtenerCartera();
    const { resumen, totales } = resumirCartera(filas);
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Antigüedad de cartera");
    await encabezadoExcel(ws, "Antigüedad de cartera", `Al ${new Date().toLocaleDateString("es-HN")}`, 6);

    estiloEncabezado(ws.addRow(["Categoría", "Préstamos", "Saldo", "Mora generada", "% provisión", "Provisión"]));
    CATEGORIAS.forEach((c) => {
      const r = resumen[c];
      ws.addRow([ETIQUETAS_CARTERA[c], r.cantidad, r.saldo, r.mora, r.porcentaje_provision / 100, r.provision]);
    });
    const t = ws.addRow(["TOTAL", totales.cantidad, totales.saldo, totales.mora, "", totales.provision]);
    t.font = { bold: true };

    ws.addRow([]);
    estiloEncabezado(ws.addRow(["Socio", "Préstamo", "Categoría", "Días de mora", "Saldo", "Mora generada"]));
    filas.forEach((f) => ws.addRow([f.socio, `#${f.id_prestamo}`, ETIQUETAS_CARTERA[f.categoria], f.dias_mora, f.saldo, f.mora_generada]));

    ws.columns = [{ width: 34 }, { width: 12 }, { width: 24 }, { width: 16 }, { width: 16 }, { width: 16 }];
    ws.getColumn(3).numFmt = "#,##0.00";
    ws.getColumn(4).numFmt = "#,##0.00";
    ws.getColumn(5).numFmt = "0%";
    ws.getColumn(6).numFmt = "#,##0.00";
    await enviarExcel(res, wb, `antiguedad_cartera_${hoyISO()}.xlsx`);
  } catch (error) {
    console.error("ERROR AL EXPORTAR ANTIGÜEDAD:", error);
    res.status(500).json({ message: "Error al exportar" });
  }
});

router.get("/exportar/estado-resultados", async (req, res) => {
  try {
    const hoy = new Date();
    const anio = parseInt(req.query.anio) || anioMesActual().anio;
    const mes = parseInt(req.query.mes) || anioMesActual().mes;
    const { desde, hasta } = rangoDelMes(anio, mes);
    const r = await estadoResultados(desde, hasta);

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Estado de resultados");
    await encabezadoExcel(ws, "Estado de resultados", `Período: ${String(mes).padStart(2, "0")}/${anio}`, 2);

    const seccion = (t) => {
      const row = ws.addRow([t, ""]);
      row.font = { bold: true };
      estiloEncabezado(row);
    };
    seccion("INGRESOS");
    ws.addRow(["Intereses de préstamos", r.ingresos.intereses_prestamos]);
    ws.addRow(["Mora cobrada", r.ingresos.mora]);
    r.ingresos.otros.forEach((o) => ws.addRow([o.etiqueta, o.total]));
    ws.addRow(["Total ingresos", r.ingresos.total]).font = { bold: true };
    ws.addRow([]);
    seccion("GASTOS");
    if (!r.gastos.detalle.length) ws.addRow(["Sin gastos registrados", 0]);
    r.gastos.detalle.forEach((g) => ws.addRow([g.etiqueta, g.total]));
    ws.addRow(["Total gastos", r.gastos.total]).font = { bold: true };
    ws.addRow([]);
    const ex = ws.addRow(["EXCEDENTE DEL PERÍODO", r.excedente]);
    ex.font = { bold: true, size: 12 };

    ws.columns = [{ width: 42 }, { width: 18 }];
    ws.getColumn(2).numFmt = "#,##0.00";
    await enviarExcel(res, wb, `estado_resultados_${anio}_${String(mes).padStart(2, "0")}.xlsx`);
  } catch (error) {
    console.error("ERROR AL EXPORTAR RESULTADOS:", error);
    res.status(500).json({ message: "Error al exportar" });
  }
});

router.get("/exportar/situacion-financiera", async (req, res) => {
  try {
    const s = await situacionFinanciera();
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Situación financiera");
    await encabezadoExcel(ws, "Situación financiera (administrativa)", `Al ${new Date().toLocaleDateString("es-HN")}`, 2);

    const seccion = (t) => {
      const row = ws.addRow([t, ""]);
      estiloEncabezado(row);
    };
    seccion("ACTIVOS");
    ws.addRow(["Efectivo (libro de caja)", s.activos.efectivo]);
    ws.addRow(["Bancos y otros medios (libro de caja)", s.activos.bancos]);
    ws.addRow([`Cartera de préstamos (${s.activos.prestamos_vigentes})`, s.activos.cartera_prestamos]);
    ws.addRow(["(−) Provisión de cartera", -s.activos.provision_cartera]);
    ws.addRow(["Total activos", s.activos.total]).font = { bold: true };
    ws.addRow([]);
    seccion("OBLIGACIONES CON SOCIOS");
    s.obligaciones_socios.por_cuenta.forEach((c) => ws.addRow([`Cuenta ${c.tipo}`, c.saldo]));
    ws.addRow(["Total obligaciones", s.obligaciones_socios.total]).font = { bold: true };
    ws.addRow([]);
    ws.addRow(["PATRIMONIO NETO (activos − obligaciones)", s.patrimonio_neto]).font = { bold: true, size: 12 };

    ws.columns = [{ width: 48 }, { width: 18 }];
    ws.getColumn(2).numFmt = "#,##0.00";
    await enviarExcel(res, wb, `situacion_financiera_${hoyISO()}.xlsx`);
  } catch (error) {
    console.error("ERROR AL EXPORTAR SITUACIÓN:", error);
    res.status(500).json({ message: "Error al exportar" });
  }
});

module.exports = router;
