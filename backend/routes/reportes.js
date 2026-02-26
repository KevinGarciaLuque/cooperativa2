// routes/reportes.js
const express = require("express");
const router = express.Router();
const pool = require("../db");
const ExcelJS = require("exceljs");

// ============================================
// FUNCIÓN AUXILIAR: CONFIGURAR ESTILOS DE EXCEL
// ============================================
function aplicarEstilosEncabezado(worksheet) {
  worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4472C4' }
  };
  worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
  worksheet.getRow(1).height = 25;
}

function formatearMoneda(valor) {
  return `L. ${parseFloat(valor).toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,')}`;
}

// ============================================
// REPORTE 1: ESTADO DE CUENTA POR SOCIO (MEJORADO)
// ============================================
router.get("/estado-cuenta/:id_usuario", async (req, res) => {
  try {
    const { fecha_inicio = '', fecha_fin = '' } = req.query;

    // Obtener información del socio
    const [socio] = await pool.query(
      `SELECT nombre_completo, dni, correo, telefono 
       FROM usuarios WHERE id_usuario = ?`,
      [req.params.id_usuario]
    );

    if (socio.length === 0) {
      return res.status(404).json({ message: "Socio no encontrado" });
    }

    // Obtener cuentas del socio
    const [cuentas] = await pool.query(
      `SELECT * FROM cuentas WHERE id_usuario = ?`,
      [req.params.id_usuario]
    );

    // Crear libro y hoja
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Estado de Cuenta");

    // ENCABEZADO DEL REPORTE
    worksheet.mergeCells('A1:F1');
    worksheet.getCell('A1').value = 'COOPERATIVA - ESTADO DE CUENTA';
    worksheet.getCell('A1').font = { size: 16, bold: true };
    worksheet.getCell('A1').alignment = { horizontal: 'center' };

    worksheet.mergeCells('A2:F2');
    worksheet.getCell('A2').value = `Socio: ${socio[0].nombre_completo} - DNI: ${socio[0].dni}`;
    worksheet.getCell('A2').font = { size: 12 };

    worksheet.mergeCells('A3:F3');
    const fechaReporte = fecha_inicio && fecha_fin 
      ? `Período: ${fecha_inicio} al ${fecha_fin}` 
      : `Fecha de generación: ${new Date().toLocaleDateString('es-HN')}`;
    worksheet.getCell('A3').value = fechaReporte;

    // Espacio
    worksheet.addRow([]);

    let currentRow = 5;

    // Por cada cuenta, mostrar movimientos
    for (const cuenta of cuentas) {
      // Título de cuenta
      worksheet.mergeCells(`A${currentRow}:F${currentRow}`);
      worksheet.getCell(`A${currentRow}`).value = `CUENTA: ${cuenta.tipo_cuenta.toUpperCase()} - Saldo: ${formatearMoneda(cuenta.saldo_actual)}`;
      worksheet.getCell(`A${currentRow}`).font = { bold: true, size: 12 };
      worksheet.getCell(`A${currentRow}`).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE7E6E6' }
      };
      currentRow++;

      // Encabezados de movimientos
      const headerRow = worksheet.getRow(currentRow);
      headerRow.values = ['Fecha', 'Tipo', 'Monto', 'Saldo Anterior', 'Saldo Nuevo', 'Descripción'];
      headerRow.font = { bold: true };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFD9D9D9' }
      };
      currentRow++;

      // Obtener movimientos de esta cuenta
      let whereClause = "WHERE m.id_cuenta = ?";
      let params = [cuenta.id_cuenta];

      if (fecha_inicio && fecha_fin) {
        whereClause += ` AND DATE(m.fecha) BETWEEN ? AND ?`;
        params.push(fecha_inicio, fecha_fin);
      }

      const [movimientos] = await pool.query(
        `SELECT * FROM movimientos_cuenta m ${whereClause} ORDER BY m.fecha DESC`,
        params
      );

      if (movimientos.length === 0) {
        worksheet.addRow(['Sin movimientos', '', '', '', '', '']);
        currentRow++;
      } else {
        movimientos.forEach((m) => {
          worksheet.addRow([
            new Date(m.fecha).toLocaleString('es-HN'),
            m.tipo,
            formatearMoneda(m.monto),
            formatearMoneda(m.saldo_anterior),
            formatearMoneda(m.saldo_nuevo),
            m.descripcion || ''
          ]);
          currentRow++;
        });
      }

      // Espacio entre cuentas
      worksheet.addRow([]);
      currentRow++;
    }

    // Configurar anchos de columnas
    worksheet.columns = [
      { width: 22 }, // Fecha
      { width: 15 }, // Tipo
      { width: 15 }, // Monto
      { width: 15 }, // Saldo Anterior
      { width: 15 }, // Saldo Nuevo
      { width: 40 }  // Descripción
    ];

    // Exportar archivo
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=estado_cuenta_${socio[0].dni}_${new Date().toISOString().split('T')[0]}.xlsx`
    );
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("ERROR AL GENERAR ESTADO DE CUENTA:", error);
    res.status(500).json({ message: "Error generando el reporte", error: error.message });
  }
});

// ============================================
// REPORTE 2: BALANCE GENERAL DE LA COOPERATIVA
// ============================================
router.get("/balance-general", async (req, res) => {
  try {
    const { fecha_inicio = '', fecha_fin = '' } = req.query;

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Balance General");

    // ENCABEZADO
    worksheet.mergeCells('A1:C1');
    worksheet.getCell('A1').value = 'BALANCE GENERAL DE LA COOPERATIVA';
    worksheet.getCell('A1').font = { size: 16, bold: true };
    worksheet.getCell('A1').alignment = { horizontal: 'center' };

    worksheet.mergeCells('A2:C2');
    const fechaReporte = fecha_inicio && fecha_fin 
      ? `Período: ${fecha_inicio} al ${fecha_fin}` 
      : `Al ${new Date().toLocaleDateString('es-HN')}`;
    worksheet.getCell('A2').value = fechaReporte;
    worksheet.getCell('A2').alignment = { horizontal: 'center' };

    worksheet.addRow([]);

    let currentRow = 4;

    // ========== ACTIVOS ==========
    worksheet.getCell(`A${currentRow}`).value = 'ACTIVOS';
    worksheet.getCell(`A${currentRow}`).font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
    worksheet.getCell(`A${currentRow}`).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' }
    };
    worksheet.mergeCells(`A${currentRow}:C${currentRow}`);
    currentRow++;

    // Efectivo en cuentas
    const [totalCuentas] = await pool.query(
      `SELECT SUM(saldo_actual) as total FROM cuentas WHERE estado = 'activa'`
    );
    worksheet.addRow(['Efectivo en Cuentas de Socios', '', formatearMoneda(totalCuentas[0].total || 0)]);
    currentRow++;

    // Préstamos por cobrar
    const [totalPrestamos] = await pool.query(
      `SELECT SUM(monto_pendiente) as total FROM prestamos WHERE estado IN ('activo', 'mora')`
    );
    worksheet.addRow(['Préstamos por Cobrar', '', formatearMoneda(totalPrestamos[0].total || 0)]);
    currentRow++;

    // Intereses por cobrar (mora)
    const [totalMora] = await pool.query(
      `SELECT SUM(p.monto_pendiente * 0.24 * GREATEST(DATEDIFF(CURDATE(), DATE_ADD(p.fecha_aprobacion, INTERVAL 35 DAY)), 0) / 365) as mora_estimada
       FROM prestamos p
       WHERE p.estado = 'mora'`
    );
    worksheet.addRow(['Intereses Moratorios por Cobrar', '', formatearMoneda(totalMora[0].mora_estimada || 0)]);
    currentRow++;

    const totalActivos = parseFloat(totalCuentas[0].total || 0) + 
                         parseFloat(totalPrestamos[0].total || 0) + 
                         parseFloat(totalMora[0].mora_estimada || 0);

    worksheet.addRow(['TOTAL ACTIVOS', '', formatearMoneda(totalActivos)]);
    worksheet.getCell(`A${currentRow}`).font = { bold: true };
    worksheet.getCell(`C${currentRow}`).font = { bold: true };
    currentRow++;
    worksheet.addRow([]);
    currentRow++;

    // ========== PASIVOS ==========
    worksheet.getCell(`A${currentRow}`).value = 'PASIVOS';
    worksheet.getCell(`A${currentRow}`).font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
    worksheet.getCell(`A${currentRow}`).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE74C3C' }
    };
    worksheet.mergeCells(`A${currentRow}:C${currentRow}`);
    currentRow++;

    // Aportaciones de socios (pasivo porque son obligaciones con los socios)
    const [totalAportaciones] = await pool.query(
      `SELECT SUM(monto) as total FROM aportaciones`
    );
    worksheet.addRow(['Aportaciones de Socios', '', formatearMoneda(totalAportaciones[0].total || 0)]);
    currentRow++;

    // Liquidaciones pendientes de desembolso
    const [liquidacionesPendientes] = await pool.query(
      `SELECT SUM(monto_recibido) as total 
       FROM liquidacion_socios 
       WHERE desembolsado = 0`
    );
    worksheet.addRow(['Liquidaciones Pendientes', '', formatearMoneda(liquidacionesPendientes[0].total || 0)]);
    currentRow++;

    const totalPasivos = parseFloat(totalAportaciones[0].total || 0) + 
                        parseFloat(liquidacionesPendientes[0].total || 0);

    worksheet.addRow(['TOTAL PASIVOS', '', formatearMoneda(totalPasivos)]);
    worksheet.getCell(`A${currentRow}`).font = { bold: true };
    worksheet.getCell(`C${currentRow}`).font = { bold: true };
    currentRow++;
    worksheet.addRow([]);
    currentRow++;

    // ========== PATRIMONIO ==========
    worksheet.getCell(`A${currentRow}`).value = 'PATRIMONIO';
    worksheet.getCell(`A${currentRow}`).font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
    worksheet.getCell(`A${currentRow}`).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF2ECC71' }
    };
    worksheet.mergeCells(`A${currentRow}:C${currentRow}`);
    currentRow++;

    const patrimonio = totalActivos - totalPasivos;
    worksheet.addRow(['Capital Social', '', formatearMoneda(patrimonio)]);
    currentRow++;

    worksheet.addRow(['TOTAL PATRIMONIO', '', formatearMoneda(patrimonio)]);
    worksheet.getCell(`A${currentRow}`).font = { bold: true };
    worksheet.getCell(`C${currentRow}`).font = { bold: true };
    currentRow++;
    worksheet.addRow([]);
    currentRow++;

    // ========== RESUMEN ==========
    worksheet.mergeCells(`A${currentRow}:C${currentRow}`);
    worksheet.getCell(`A${currentRow}`).value = 'ECUACIÓN PATRIMONIAL';
    worksheet.getCell(`A${currentRow}`).font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
    worksheet.getCell(`A${currentRow}`).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF34495E' }
    };
    worksheet.getCell(`A${currentRow}`).alignment = { horizontal: 'center' };
    currentRow++;

    worksheet.addRow(['Activos', '=', formatearMoneda(totalActivos)]);
    worksheet.addRow(['Pasivos + Patrimonio', '=', formatearMoneda(totalPasivos + patrimonio)]);
    worksheet.addRow(['Diferencia', '=', formatearMoneda(totalActivos - (totalPasivos + patrimonio))]);

    // Configurar anchos
    worksheet.columns = [
      { width: 35 },
      { width: 5 },
      { width: 20 }
    ];

    // Exportar
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename=balance_general_${new Date().toISOString().split('T')[0]}.xlsx`);
    res.end();
  } catch (error) {
    console.error("ERROR AL GENERAR BALANCE GENERAL:", error);
    res.status(500).json({ message: "Error generando el reporte", error: error.message });
  }
});

// ============================================
// REPORTE 3: PRÉSTAMOS ACTIVOS
// ============================================
router.get("/prestamos-activos", async (req, res) => {
  try {
    const { estado = 'activo' } = req.query;

    const [prestamos] = await pool.query(
      `SELECT 
       p.*,
       u.nombre_completo,
       u.dni,
       u.telefono,
       u.correo
       FROM prestamos p
       INNER JOIN usuarios u ON p.id_usuario = u.id_usuario
       WHERE p.estado = ?
       ORDER BY p.fecha_aprobacion DESC`,
      [estado]
    );

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Préstamos Activos");

    // ENCABEZADO
    worksheet.mergeCells('A1:J1');
    worksheet.getCell('A1').value = `REPORTE DE PRÉSTAMOS - ESTADO: ${estado.toUpperCase()}`;
    worksheet.getCell('A1').font = { size: 16, bold: true };
    worksheet.getCell('A1').alignment = { horizontal: 'center' };

    worksheet.mergeCells('A2:J2');
    worksheet.getCell('A2').value = `Fecha de generación: ${new Date().toLocaleDateString('es-HN')}`;
    worksheet.getCell('A2').alignment = { horizontal: 'center' };

    worksheet.addRow([]);

    // Encabezados de columnas
    const headerRow = worksheet.getRow(4);
    headerRow.values = [
      'ID Préstamo',
      'Socio',
      'DNI',
      'Monto Original',
      'Monto Pendiente',
      'Tasa Anual',
      'Plazo (Meses)',
      'Cuota Mensual',
      'Fecha Aprobación',
      'Estado'
    ];
    aplicarEstilosEncabezado(worksheet);

    // Datos
    let totalOriginal = 0;
    let totalPendiente = 0;

    prestamos.forEach((p) => {
      worksheet.addRow([
        p.id_prestamo,
        p.nombre_completo,
        p.dni,
        formatearMoneda(p.monto),
        formatearMoneda(p.monto_pendiente),
        `${parseFloat(p.tasa_interes_anual)}%`,
        p.plazo_meses,
        formatearMoneda(p.cuota_mensual),
        new Date(p.fecha_aprobacion).toLocaleDateString('es-HN'),
        p.estado
      ]);

      totalOriginal += parseFloat(p.monto);
      totalPendiente += parseFloat(p.monto_pendiente);
    });

    // Totales
    worksheet.addRow([]);
    const totalRow = worksheet.addRow([
      '', '', 'TOTALES:',
      formatearMoneda(totalOriginal),
      formatearMoneda(totalPendiente),
      '', '', '', '', ''
    ]);
    totalRow.font = { bold: true };
    totalRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFD966' }
    };

    // Configurar anchos
    worksheet.columns = [
      { width: 12 },
      { width: 30 },
      { width: 15 },
      { width: 15 },
      { width: 15 },
      { width: 12 },
      { width: 12 },
      { width: 15 },
      { width: 18 },
      { width: 12 }
    ];

    // Exportar
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename=prestamos_${estado}_${new Date().toISOString().split('T')[0]}.xlsx`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("ERROR AL GENERAR REPORTE DE PRÉSTAMOS:", error);
    res.status(500).json({ message: "Error generando el reporte", error: error.message });
  }
});

// ============================================
// REPORTE 4: MOROSIDAD DETALLADA
// ============================================
router.get("/morosidad", async (req, res) => {
  try {
    const [prestamos] = await pool.query(
      `SELECT 
       p.*,
       u.nombre_completo,
       u.dni,
       u.telefono,
       u.correo,
       GREATEST(DATEDIFF(CURDATE(), DATE_ADD(p.fecha_aprobacion, INTERVAL (30 * (
         SELECT COUNT(*) FROM pagos_prestamo pp WHERE pp.id_prestamo = p.id_prestamo
       ) + 35) DAY)), 0) as dias_mora,
       (p.monto_pendiente * 0.24 * GREATEST(DATEDIFF(CURDATE(), DATE_ADD(p.fecha_aprobacion, INTERVAL 35 DAY)), 0) / 365) as interes_mora_estimado
       FROM prestamos p
       INNER JOIN usuarios u ON p.id_usuario = u.id_usuario
       WHERE p.estado = 'mora'
       ORDER BY dias_mora DESC`
    );

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Reporte de Morosidad");

    // ENCABEZADO
    worksheet.mergeCells('A1:K1');
    worksheet.getCell('A1').value = 'REPORTE DE MOROSIDAD';
    worksheet.getCell('A1').font = { size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
    worksheet.getCell('A1').fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE74C3C' }
    };
    worksheet.getCell('A1').alignment = { horizontal: 'center' };

    worksheet.mergeCells('A2:K2');
    worksheet.getCell('A2').value = `Fecha de generación: ${new Date().toLocaleDateString('es-HN')}`;
    worksheet.getCell('A2').alignment = { horizontal: 'center' };

    worksheet.addRow([]);

    // Encabezados
    const headerRow = worksheet.getRow(4);
    headerRow.values = [
      'ID Préstamo',
      'Socio',
      'DNI',
      'Teléfono',
      'Monto Prestado',
      'Monto Pendiente',
      'Días en Mora',
      'Interés Moratorio',
      'Total Adeudado',
      'Fecha Aprobación',
      'Estado'
    ];
    aplicarEstilosEncabezado(worksheet);

    // Datos
    let totalPendiente = 0;
    let totalInteresMora = 0;

    prestamos.forEach((p) => {
      const diasMora = parseInt(p.dias_mora) || 0;
      const interesMora = parseFloat(p.interes_mora_estimado) || 0;
      const totalAdeudado = parseFloat(p.monto_pendiente) + interesMora;

      const row = worksheet.addRow([
        p.id_prestamo,
        p.nombre_completo,
        p.dni,
        p.telefono,
        formatearMoneda(p.monto),
        formatearMoneda(p.monto_pendiente),
        diasMora,
        formatearMoneda(interesMora),
        formatearMoneda(totalAdeudado),
        new Date(p.fecha_aprobacion).toLocaleDateString('es-HN'),
        p.estado
      ]);

      // Colorear según nivel de mora
      if (diasMora > 90) {
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFF0000' } // Rojo fuerte
        };
        row.font = { color: { argb: 'FFFFFFFF' }, bold: true };
      } else if (diasMora > 60) {
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFF6B6B' } // Rojo claro
        };
      } else if (diasMora > 30) {
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFD93D' } // Amarillo
        };
      }

      totalPendiente += parseFloat(p.monto_pendiente);
      totalInteresMora += interesMora;
    });

    // Totales
    worksheet.addRow([]);
    const totalRow = worksheet.addRow([
      '', '', '', '', 'TOTALES:',
      formatearMoneda(totalPendiente),
      '',
      formatearMoneda(totalInteresMora),
      formatearMoneda(totalPendiente + totalInteresMora),
      '', ''
    ]);
    totalRow.font = { bold: true, size: 12 };
    totalRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF95A5A6' }
    };

    // Resumen
    worksheet.addRow([]);
    worksheet.addRow([]);
    worksheet.addRow(['RESUMEN DE MOROSIDAD']);
    worksheet.addRow(['Total préstamos en mora:', prestamos.length]);
    worksheet.addRow(['Capital total en mora:', formatearMoneda(totalPendiente)]);
    worksheet.addRow(['Intereses moratorios estimados:', formatearMoneda(totalInteresMora)]);
    worksheet.addRow(['Total a recuperar:', formatearMoneda(totalPendiente + totalInteresMora)]);

    // Configurar anchos
    worksheet.columns = [
      { width: 12 },
      { width: 30 },
      { width: 15 },
      { width: 12 },
      { width: 15 },
      { width: 15 },
      { width: 12 },
      { width: 15 },
      { width: 15 },
      { width: 18 },
      { width: 12 }
    ];

    // Exportar
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename=reporte_morosidad_${new Date().toISOString().split('T')[0]}.xlsx`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    res.status(500).json({ message: "Error generando el reporte", error: error.message });
  }
});

// ============================================
// REPORTE 5: APORTACIONES POR SOCIO
// ============================================
router.get("/aportaciones", async (req, res) => {
  try {
    const { fecha_inicio = '', fecha_fin = '' } = req.query;

    let whereClause = "WHERE 1=1";
    let params = [];

    if (fecha_inicio && fecha_fin) {
      whereClause += ` AND DATE(a.fecha) BETWEEN ? AND ?`;
      params.push(fecha_inicio, fecha_fin);
    }

    const [aportaciones] = await pool.query(
      `SELECT 
       u.id_usuario,
       u.nombre_completo,
       u.dni,
       COUNT(a.id_aportacion) as total_aportaciones,
       IFNULL(SUM(a.monto), 0) as total_aportado,
       MIN(a.fecha) as primera_aportacion,
       MAX(a.fecha) as ultima_aportacion
       FROM usuarios u
       LEFT JOIN aportaciones a ON u.id_usuario = a.id_usuario ${whereClause.replace('WHERE 1=1', 'AND 1=1')}
       GROUP BY u.id_usuario, u.nombre_completo, u.dni
       HAVING total_aportado > 0
       ORDER BY total_aportado DESC`,
      params
    );

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Aportaciones");

    // ENCABEZADO
    worksheet.mergeCells('A1:G1');
    worksheet.getCell('A1').value = 'REPORTE DE APORTACIONES POR SOCIO';
    worksheet.getCell('A1').font = { size: 16, bold: true };
    worksheet.getCell('A1').alignment = { horizontal: 'center' };

    worksheet.mergeCells('A2:G2');
    const fechaReporte = fecha_inicio && fecha_fin 
      ? `Período: ${fecha_inicio} al ${fecha_fin}` 
      : `Fecha de generación: ${new Date().toLocaleDateString('es-HN')}`;
    worksheet.getCell('A2').value = fechaReporte;
    worksheet.getCell('A2').alignment = { horizontal: 'center' };

    worksheet.addRow([]);

    // Encabezados
    const headerRow = worksheet.getRow(4);
    headerRow.values = [
      'ID Socio',
      'Nombre Completo',
      'DNI',
      'Total Aportaciones',
      'Monto Total Aportado',
      'Primera Aportación',
      'Última Aportación'
    ];
    aplicarEstilosEncabezado(worksheet);

    // Datos
    let totalGeneral = 0;
    let totalTransacciones = 0;

    aportaciones.forEach((a) => {
      worksheet.addRow([
        a.id_usuario,
        a.nombre_completo,
        a.dni,
        a.total_aportaciones,
        formatearMoneda(a.total_aportado),
        a.primera_aportacion ? new Date(a.primera_aportacion).toLocaleDateString('es-HN') : '',
        a.ultima_aportacion ? new Date(a.ultima_aportacion).toLocaleDateString('es-HN') : ''
      ]);

      totalGeneral += parseFloat(a.total_aportado);
      totalTransacciones += parseInt(a.total_aportaciones);
    });

    // Totales
    worksheet.addRow([]);
    const totalRow = worksheet.addRow([
      '', '', 'TOTALES:',
      totalTransacciones,
      formatearMoneda(totalGeneral),
      '', ''
    ]);
    totalRow.font = { bold: true };
    totalRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF2ECC71' }
    };

    // Resumen
    worksheet.addRow([]);
    worksheet.addRow([]);
    worksheet.addRow(['RESUMEN']);
    worksheet.addRow(['Total de socios con aportaciones:', aportaciones.length]);
    worksheet.addRow(['Total de transacciones:', totalTransacciones]);
    worksheet.addRow(['Monto total aportado:', formatearMoneda(totalGeneral)]);
    worksheet.addRow(['Promedio por socio:', formatearMoneda(aportaciones.length > 0 ? totalGeneral / aportaciones.length : 0)]);

    // Configurar anchos
    worksheet.columns = [
      { width: 12 },
      { width: 35 },
      { width: 15 },
      { width: 18 },
      { width: 20 },
      { width: 18 },
      { width: 18 }
    ];

    // Exportar
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename=reporte_aportaciones_${new Date().toISOString().split('T')[0]}.xlsx`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("ERROR AL GENERAR REPORTE DE APORTACIONES:", error);
    res.status(500).json({ message: "Error generando el reporte", error: error.message });
  }
});

// ============================================
// REPORTE 6: LIQUIDACIONES Y UTILIDADES
// ============================================
router.get("/liquidaciones", async (req, res) => {
  try {
    const { fecha_inicio = '', fecha_fin = '' } = req.query;

    let whereClause = "WHERE 1=1";
    let params = [];

    if (fecha_inicio && fecha_fin) {
      whereClause += ` AND DATE(l.fecha) BETWEEN ? AND ?`;
      params.push(fecha_inicio, fecha_fin);
    }

    const [liquidaciones] = await pool.query(
      `SELECT 
       l.*,
       a.nombre as nombre_actividad,
       a.tipo as tipo_actividad,
       (SELECT COUNT(*) FROM liquidacion_socios ls WHERE ls.id_liquidacion = l.id_liquidacion) as total_socios_beneficiados,
       IFNULL((SELECT SUM(monto_recibido) FROM liquidacion_socios ls WHERE ls.id_liquidacion = l.id_liquidacion AND ls.desembolsado = 1), 0) as monto_desembolsado,
       IFNULL((SELECT SUM(monto_recibido) FROM liquidacion_socios ls WHERE ls.id_liquidacion = l.id_liquidacion AND ls.desembolsado = 0), 0) as monto_pendiente
       FROM liquidaciones l
       INNER JOIN actividades a ON l.id_actividad = a.id_actividad
       ${whereClause}
       ORDER BY l.fecha DESC`,
      params
    );

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Liquidaciones");

    // ENCABEZADO
    worksheet.mergeCells('A1:I1');
    worksheet.getCell('A1').value = 'REPORTE DE LIQUIDACIONES Y UTILIDADES';
    worksheet.getCell('A1').font = { size: 16, bold: true };
    worksheet.getCell('A1').alignment = { horizontal: 'center' };

    worksheet.mergeCells('A2:I2');
    const fechaReporte = fecha_inicio && fecha_fin 
      ? `Período: ${fecha_inicio} al ${fecha_fin}` 
      : `Fecha de generación: ${new Date().toLocaleDateString('es-HN')}`;
    worksheet.getCell('A2').value = fechaReporte;
    worksheet.getCell('A2').alignment = { horizontal: 'center' };

    worksheet.addRow([]);

    // Encabezados
    const headerRow = worksheet.getRow(4);
    headerRow.values = [
      'ID',
      'Actividad',
      'Tipo',
      'Monto Total',
      'Tipo Reparto',
      'Socios Beneficiados',
      'Desembolsado',
      'Pendiente',
      'Fecha'
    ];
    aplicarEstilosEncabezado(worksheet);

    // Datos
    let totalDistribuido = 0;
    let totalDesembolsado = 0;
    let totalPendiente = 0;

    liquidaciones.forEach((l) => {
      worksheet.addRow([
        l.id_liquidacion,
        l.nombre_actividad,
        l.tipo_actividad,
        formatearMoneda(l.monto_total),
        l.tipo_reparto,
        l.total_socios_beneficiados,
        formatearMoneda(l.monto_desembolsado || 0),
        formatearMoneda(l.monto_pendiente || 0),
        new Date(l.fecha).toLocaleDateString('es-HN')
      ]);

      totalDistribuido += parseFloat(l.monto_total);
      totalDesembolsado += parseFloat(l.monto_desembolsado || 0);
      totalPendiente += parseFloat(l.monto_pendiente || 0);
    });

    // Totales
    worksheet.addRow([]);
    const totalRow = worksheet.addRow([
      '', '', 'TOTALES:',
      formatearMoneda(totalDistribuido),
      '',
      '',
      formatearMoneda(totalDesembolsado),
      formatearMoneda(totalPendiente),
      ''
    ]);
    totalRow.font = { bold: true };
    totalRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFE599' }
    };

    // Configurar anchos
    worksheet.columns = [
      { width: 8 },
      { width: 30 },
      { width: 18 },
      { width: 15 },
      { width: 15 },
      { width: 18 },
      { width: 15 },
      { width: 15 },
      { width: 18 }
    ];

    // Exportar
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename=reporte_liquidaciones_${new Date().toISOString().split('T')[0]}.xlsx`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("ERROR AL GENERAR REPORTE DE LIQUIDACIONES:", error);
    res.status(500).json({ message: "Error generando el reporte", error: error.message });
  }
});

// ============================================
// REPORTE 7: FLUJO DE CAJA
// ============================================
router.get("/flujo-caja", async (req, res) => {
  try {
    const { fecha_inicio = '', fecha_fin = '' } = req.query;

    let whereClause = "WHERE 1=1";
    let params = [];

    if (fecha_inicio && fecha_fin) {
      whereClause += ` AND DATE(fecha) BETWEEN ? AND ?`;
      params.push(fecha_inicio, fecha_fin);
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Flujo de Caja");

    // ENCABEZADO
    worksheet.mergeCells('A1:D1');
    worksheet.getCell('A1').value = 'FLUJO DE CAJA DE LA COOPERATIVA';
    worksheet.getCell('A1').font = { size: 16, bold: true };
    worksheet.getCell('A1').alignment = { horizontal: 'center' };

    worksheet.mergeCells('A2:D2');
    const fechaReporte = fecha_inicio && fecha_fin 
      ? `Período: ${fecha_inicio} al ${fecha_fin}` 
      : `Fecha de generación: ${new Date().toLocaleDateString('es-HN')}`;
    worksheet.getCell('A2').value = fechaReporte;
    worksheet.getCell('A2').alignment = { horizontal: 'center' };

    worksheet.addRow([]);

    let currentRow = 4;

    // ========== INGRESOS ==========
    worksheet.getCell(`A${currentRow}`).value = 'INGRESOS';
    worksheet.getCell(`A${currentRow}`).font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
    worksheet.getCell(`A${currentRow}`).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF2ECC71' }
    };
    worksheet.mergeCells(`A${currentRow}:D${currentRow}`);
    currentRow++;

    // Aportaciones
    const [ingresoAportaciones] = await pool.query(
      `SELECT IFNULL(SUM(monto), 0) as total 
       FROM aportaciones ${whereClause}`,
      params
    );
    worksheet.addRow(['Aportaciones de socios', '', '', formatearMoneda(ingresoAportaciones[0].total)]);
    currentRow++;

    // Pagos de préstamos (capital + intereses)
    const [ingresoPagos] = await pool.query(
      `SELECT IFNULL(SUM(monto_pagado), 0) as total 
       FROM pagos_prestamo ${whereClause}`,
      params
    );
    worksheet.addRow(['Pagos de préstamos recibidos', '', '', formatearMoneda(ingresoPagos[0].total)]);
    currentRow++;

    // Actividades (rifas, ventas, etc)
    const [ingresoActividades] = await pool.query(
      `SELECT IFNULL(SUM(monto), 0) as total 
       FROM actividades ${whereClause}`,
      params
    );
    worksheet.addRow(['Actividades (rifas, ventas, intereses)', '', '', formatearMoneda(ingresoActividades[0].total)]);
    currentRow++;

    const totalIngresos = parseFloat(ingresoAportaciones[0].total) + 
                         parseFloat(ingresoPagos[0].total) + 
                         parseFloat(ingresoActividades[0].total);

    worksheet.addRow(['TOTAL INGRESOS', '', '', formatearMoneda(totalIngresos)]);
    worksheet.getCell(`A${currentRow}`).font = { bold: true };
    worksheet.getCell(`D${currentRow}`).font = { bold: true };
    currentRow++;
    worksheet.addRow([]);
    currentRow++;

    // ========== EGRESOS ==========
    worksheet.getCell(`A${currentRow}`).value = 'EGRESOS';
    worksheet.getCell(`A${currentRow}`).font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
    worksheet.getCell(`A${currentRow}`).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE74C3C' }
    };
    worksheet.mergeCells(`A${currentRow}:D${currentRow}`);
    currentRow++;

    // Préstamos desembolsados
    let egresoWhereClause = whereClause.replace('WHERE 1=1', 'WHERE estado IN ("activo", "mora", "pagado")');
    if (fecha_inicio && fecha_fin) {
      egresoWhereClause += ` AND DATE(fecha_aprobacion) BETWEEN ? AND ?`;
    }
    
    const [egresoPrestamos] = await pool.query(
      `SELECT IFNULL(SUM(monto), 0) as total 
       FROM prestamos 
       ${egresoWhereClause}`,
      params
    );
    worksheet.addRow(['Préstamos desembolsados', '', '', formatearMoneda(egresoPrestamos[0].total)]);
    currentRow++;

    // Liquidaciones desembolsadas
    let liqWhereClause = "WHERE ls.desembolsado = 1";
    if (fecha_inicio && fecha_fin) {
      liqWhereClause += ` AND DATE(l.fecha) BETWEEN ? AND ?`;
    }
    
    const [egresoLiquidaciones] = await pool.query(
      `SELECT IFNULL(SUM(ls.monto_recibido), 0) as total 
       FROM liquidacion_socios ls
       INNER JOIN liquidaciones l ON ls.id_liquidacion = l.id_liquidacion
       ${liqWhereClause}`,
      params
    );
    worksheet.addRow(['Liquidaciones desembolsadas', '', '', formatearMoneda(egresoLiquidaciones[0].total)]);
    currentRow++;

    const totalEgresos = parseFloat(egresoPrestamos[0].total) + 
                        parseFloat(egresoLiquidaciones[0].total);

    worksheet.addRow(['TOTAL EGRESOS', '', '', formatearMoneda(totalEgresos)]);
    worksheet.getCell(`A${currentRow}`).font = { bold: true };
    worksheet.getCell(`D${currentRow}`).font = { bold: true };
    currentRow++;
    worksheet.addRow([]);
    currentRow++;

    // ========== FLUJO NETO ==========
    worksheet.getCell(`A${currentRow}`).value = 'FLUJO NETO DE CAJA';
    worksheet.getCell(`A${currentRow}`).font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
    worksheet.getCell(`A${currentRow}`).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF3498DB' }
    };
    worksheet.mergeCells(`A${currentRow}:D${currentRow}`);
    currentRow++;

    const flujoNeto = totalIngresos - totalEgresos;
    const row = worksheet.addRow(['Flujo Neto del Período', '', '', formatearMoneda(flujoNeto)]);
    row.font = { bold: true, size: 12 };
    row.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: flujoNeto >= 0 ? 'FF2ECC71' : 'FFFF6B6B' }
    };

    // Configurar anchos
    worksheet.columns = [
      { width: 35 },
      { width: 15 },
      { width: 15 },
      { width: 20 }
    ];

    // Exportar
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename=flujo_caja_${new Date().toISOString().split('T')[0]}.xlsx`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("ERROR AL GENERAR FLUJO DE CAJA:", error);
    res.status(500).json({ message: "Error generando el reporte", error: error.message });
  }
});

module.exports = router;
