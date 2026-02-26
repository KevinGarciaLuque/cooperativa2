const express = require("express");
const router = express.Router();
const pool = require("../db");

// ============================================
// ENDPOINT 1: KPIs PRINCIPALES
// ============================================
router.get("/kpis", async (req, res) => {
  try {
    // Total de socios
    const [socios] = await pool.query(
      `SELECT 
       COUNT(*) as total,
       SUM(CASE WHEN estado = 'activo' THEN 1 ELSE 0 END) as activos,
       SUM(CASE WHEN estado = 'inactivo' THEN 1 ELSE 0 END) as inactivos
       FROM usuarios WHERE rol_id != 1`
    );

    // Préstamos
    const [prestamos] = await pool.query(
      `SELECT 
       COUNT(*) as total,
       SUM(CASE WHEN estado = 'activo' THEN 1 ELSE 0 END) as activos,
       SUM(CASE WHEN estado = 'mora' THEN 1 ELSE 0 END) as mora,
       SUM(CASE WHEN estado = 'pagado' THEN 1 ELSE 0 END) as pagados,
       IFNULL(SUM(CASE WHEN estado IN ('activo', 'mora') THEN monto ELSE 0 END), 0) as monto_cartera,
       IFNULL(SUM(CASE WHEN estado IN ('activo', 'mora') THEN saldo_restante ELSE 0 END), 0) as saldo_pendiente
       FROM prestamos`
    );

    // Tasa de morosidad
    const tasaMorosidad = prestamos[0].activos > 0 
      ? ((prestamos[0].mora / (prestamos[0].activos + prestamos[0].mora)) * 100).toFixed(2)
      : 0;

    // Total aportaciones
    const [aportaciones] = await pool.query(
      `SELECT IFNULL(SUM(monto), 0) as total FROM aportaciones`
    );

    // Saldos en cuentas por tipo
    const [cuentas] = await pool.query(
      `SELECT 
       tipo_cuenta,
       IFNULL(SUM(saldo_actual), 0) as saldo_total
       FROM cuentas
       GROUP BY tipo_cuenta`
    );

    // Ingresos del mes actual
    const [ingresosMes] = await pool.query(
      `SELECT 
       IFNULL(SUM(monto), 0) as aportaciones_mes
       FROM aportaciones 
       WHERE MONTH(fecha) = MONTH(CURRENT_DATE()) 
       AND YEAR(fecha) = YEAR(CURRENT_DATE())`
    );

    const [pagosMes] = await pool.query(
      `SELECT 
       IFNULL(SUM(monto_pagado), 0) as pagos_mes
       FROM pagos_prestamo 
       WHERE MONTH(fecha_pago) = MONTH(CURRENT_DATE()) 
       AND YEAR(fecha_pago) = YEAR(CURRENT_DATE())`
    );

    const [actividadesMes] = await pool.query(
      `SELECT 
       IFNULL(SUM(monto), 0) as actividades_mes
       FROM actividades 
       WHERE MONTH(fecha) = MONTH(CURRENT_DATE()) 
       AND YEAR(fecha) = YEAR(CURRENT_DATE())`
    );

    const ingresosTotalesMes = parseFloat(ingresosMes[0].aportaciones_mes) + 
                               parseFloat(pagosMes[0].pagos_mes) + 
                               parseFloat(actividadesMes[0].actividades_mes);

    // Liquidaciones del año
    const [liquidaciones] = await pool.query(
      `SELECT 
       IFNULL(SUM(monto_total), 0) as total_distribuido
       FROM liquidaciones 
       WHERE YEAR(fecha) = YEAR(CURRENT_DATE())`
    );

    // Calcular intereses generados estimados (monto pagado - saldo amortizado)
    const [interesesGenerados] = await pool.query(
      `SELECT 
       IFNULL(SUM(monto_pagado), 0) as total_pagado,
       (SELECT IFNULL(SUM(monto), 0) FROM prestamos WHERE estado = 'pagado') as total_prestado
       FROM pagos_prestamo`
    );
    
    const interesesTotales = parseFloat(interesesGenerados[0].total_pagado) - parseFloat(interesesGenerados[0].total_prestado || 0);

    res.json({
      socios: {
        total: socios[0].total,
        activos: socios[0].activos,
        inactivos: socios[0].inactivos
      },
      prestamos: {
        total: prestamos[0].total,
        activos: prestamos[0].activos,
        mora: prestamos[0].mora,
        pagados: prestamos[0].pagados,
        montoCartera: parseFloat(prestamos[0].monto_cartera),
        saldoPendiente: parseFloat(prestamos[0].saldo_pendiente),
        tasaMorosidad: parseFloat(tasaMorosidad)
      },
      finanzas: {
        totalAportaciones: parseFloat(aportaciones[0].total),
        cuentas: cuentas.map(c => ({
          tipo: c.tipo_cuenta,
          saldo: parseFloat(c.saldo_total)
        })),
        ingresosMesActual: ingresosTotalesMes,
        liquidacionesAnioActual: parseFloat(liquidaciones[0].total_distribuido),
        interesesGeneradosTotales: Math.max(0, interesesTotales)
      }
    });
  } catch (error) {
    console.error("ERROR AL OBTENER KPIs:", error);
    res.status(500).json({ message: "Error obteniendo los KPIs", error: error.message });
  }
});

// ============================================
// ENDPOINT 2: SERIES DE TIEMPO (GRÁFICOS)
// ============================================
router.get("/series-tiempo", async (req, res) => {
  try {
    const { meses = 12 } = req.query;

    // Socios por mes (últimos N meses)
    const [sociosPorMes] = await pool.query(
      `SELECT 
       DATE_FORMAT(fecha_registro, '%Y-%m') as mes,
       COUNT(*) as nuevos_socios
       FROM usuarios 
       WHERE fecha_registro >= DATE_SUB(CURRENT_DATE(), INTERVAL ? MONTH)
       AND rol_id != 1
       GROUP BY DATE_FORMAT(fecha_registro, '%Y-%m')
       ORDER BY mes ASC`,
      [parseInt(meses)]
    );

    // Aportaciones por mes
    const [aportacionesPorMes] = await pool.query(
      `SELECT 
       DATE_FORMAT(fecha, '%Y-%m') as mes,
       COUNT(*) as cantidad,
       IFNULL(SUM(monto), 0) as monto_total
       FROM aportaciones 
       WHERE fecha >= DATE_SUB(CURRENT_DATE(), INTERVAL ? MONTH)
       GROUP BY DATE_FORMAT(fecha, '%Y-%m')
       ORDER BY mes ASC`,
      [parseInt(meses)]
    );

    // Préstamos desembolsados por mes
    const [prestamosPorMes] = await pool.query(
      `SELECT 
       DATE_FORMAT(fecha_otorgado, '%Y-%m') as mes,
       COUNT(*) as cantidad,
       IFNULL(SUM(monto), 0) as monto_total
       FROM prestamos 
       WHERE fecha_otorgado >= DATE_SUB(CURRENT_DATE(), INTERVAL ? MONTH)
       AND estado IN ('activo', 'mora', 'pagado')
       GROUP BY DATE_FORMAT(fecha_otorgado, '%Y-%m')
       ORDER BY mes ASC`,
      [parseInt(meses)]
    );

    // Pagos recibidos por mes
    const [pagosPorMes] = await pool.query(
      `SELECT 
       DATE_FORMAT(fecha_pago, '%Y-%m') as mes,
       COUNT(*) as cantidad,
       IFNULL(SUM(monto_pagado), 0) as monto_total
       FROM pagos_prestamo 
       WHERE fecha_pago >= DATE_SUB(CURRENT_DATE(), INTERVAL ? MONTH)
       GROUP BY DATE_FORMAT(fecha_pago, '%Y-%m')
       ORDER BY mes ASC`,
      [parseInt(meses)]
    );

    // Actividades por mes
    const [actividadesPorMes] = await pool.query(
      `SELECT 
       DATE_FORMAT(fecha, '%Y-%m') as mes,
       COUNT(*) as cantidad,
       IFNULL(SUM(monto), 0) as monto_total
       FROM actividades 
       WHERE fecha >= DATE_SUB(CURRENT_DATE(), INTERVAL ? MONTH)
       GROUP BY DATE_FORMAT(fecha, '%Y-%m')
       ORDER BY mes ASC`,
      [parseInt(meses)]
    );

    res.json({
      socios: sociosPorMes.map(s => ({
        mes: s.mes,
        cantidad: s.nuevos_socios
      })),
      aportaciones: aportacionesPorMes.map(a => ({
        mes: a.mes,
        cantidad: a.cantidad,
        monto: parseFloat(a.monto_total)
      })),
      prestamos: prestamosPorMes.map(p => ({
        mes: p.mes,
        cantidad: p.cantidad,
        monto: parseFloat(p.monto_total)
      })),
      pagos: pagosPorMes.map(p => ({
        mes: p.mes,
        cantidad: p.cantidad,
        monto: parseFloat(p.monto_total)
      })),
      actividades: actividadesPorMes.map(a => ({
        mes: a.mes,
        cantidad: a.cantidad,
        monto: parseFloat(a.monto_total)
      }))
    });
  } catch (error) {
    console.error("ERROR AL OBTENER SERIES DE TIEMPO:", error);
    res.status(500).json({ message: "Error obteniendo series de tiempo", error: error.message });
  }
});

// ============================================
// ENDPOINT 3: ALERTAS Y NOTIFICACIONES
// ============================================
router.get("/alertas", async (req, res) => {
  try {
    // Préstamos en mora
    const [prestamosMora] = await pool.query(
      `SELECT 
       p.id_prestamo,
       p.monto,
       p.saldo_restante as saldo_pendiente,
       p.fecha_otorgado,
       u.nombre_completo,
       u.telefono,
       DATEDIFF(CURRENT_DATE(), 
         (SELECT MAX(fecha_pago) FROM pagos_prestamo WHERE id_prestamo = p.id_prestamo)
       ) as dias_sin_pagar
       FROM prestamos p
       INNER JOIN usuarios u ON p.id_usuario = u.id_usuario
       WHERE p.estado = 'mora'
       ORDER BY dias_sin_pagar DESC
       LIMIT 10`
    );

    // Préstamos próximos a vencer (próximos 7 días)
    const [proximosVencer] = await pool.query(
      `SELECT 
       p.id_prestamo,
       p.monto,
       p.saldo_restante as saldo_pendiente,
       (p.monto * ((p.tasa_interes / 100 / 12) * POW(1 + (p.tasa_interes / 100 / 12), p.plazo_meses))) / 
        (POW(1 + (p.tasa_interes / 100 / 12), p.plazo_meses) - 1) as cuota_mensual,
       u.nombre_completo,
       u.telefono,
       (SELECT MAX(fecha_pago) FROM pagos_prestamo WHERE id_prestamo = p.id_prestamo) as ultimo_pago,
       DATE_ADD(
         (SELECT MAX(fecha_pago) FROM pagos_prestamo WHERE id_prestamo = p.id_prestamo),
         INTERVAL 30 DAY
       ) as proxima_cuota
       FROM prestamos p
       INNER JOIN usuarios u ON p.id_usuario = u.id_usuario
       WHERE p.estado = 'activo'
       AND DATE_ADD(
         (SELECT MAX(fecha_pago) FROM pagos_prestamo WHERE id_prestamo = p.id_prestamo),
         INTERVAL 30 DAY
       ) BETWEEN CURRENT_DATE() AND DATE_ADD(CURRENT_DATE(), INTERVAL 7 DAY)
       ORDER BY proxima_cuota ASC
       LIMIT 10`
    );

    // Socios sin aportaciones en los últimos 3 meses
    const [sociosSinAportaciones] = await pool.query(
      `SELECT 
       u.id_usuario,
       u.nombre_completo,
       u.dni,
       u.telefono,
       MAX(a.fecha) as ultima_aportacion,
       DATEDIFF(CURRENT_DATE(), MAX(a.fecha)) as dias_sin_aportar
       FROM usuarios u
       LEFT JOIN aportaciones a ON u.id_usuario = a.id_usuario
       WHERE u.estado = 'activo' AND u.rol_id != 1
       GROUP BY u.id_usuario
       HAVING ultima_aportacion IS NULL 
          OR DATEDIFF(CURRENT_DATE(), MAX(a.fecha)) > 90
       ORDER BY dias_sin_aportar DESC
       LIMIT 10`
    );

    // Liquidaciones pendientes de desembolso
    const [liquidacionesPendientes] = await pool.query(
      `SELECT 
       ls.id_liquidacion,
       l.fecha,
       a.nombre as actividad,
       ls.id_usuario,
       u.nombre_completo,
       ls.monto_recibido
       FROM liquidacion_socios ls
       INNER JOIN liquidaciones l ON ls.id_liquidacion = l.id_liquidacion
       INNER JOIN actividades a ON l.id_actividad = a.id_actividad
       INNER JOIN usuarios u ON ls.id_usuario = u.id_usuario
       WHERE ls.desembolsado = 0
       ORDER BY l.fecha DESC
       LIMIT 20`
    );

    // Cuentas de socios con saldo bajo en Aportaciones (menos de 1000)
    const [saldosBajos] = await pool.query(
      `SELECT 
       c.id_cuenta,
       c.saldo_actual as saldo,
       u.nombre_completo,
       u.telefono
       FROM cuentas c
       INNER JOIN usuarios u ON c.id_usuario = u.id_usuario
       WHERE c.tipo_cuenta = 'Aportaciones'
       AND c.saldo_actual < 1000
       AND u.estado = 'activo'
       ORDER BY c.saldo_actual ASC
       LIMIT 10`
    );

    res.json({
      mora: {
        total: prestamosMora.length,
        prestamos: prestamosMora.map(p => ({
          id_prestamo: p.id_prestamo,
          socio: p.nombre_completo,
          telefono: p.telefono,
          monto: parseFloat(p.monto),
          saldo_pendiente: parseFloat(p.saldo_pendiente),
          dias_sin_pagar: p.dias_sin_pagar
        }))
      },
      proximosVencer: {
        total: proximosVencer.length,
        prestamos: proximosVencer.map(p => ({
          id_prestamo: p.id_prestamo,
          socio: p.nombre_completo,
          telefono: p.telefono,
          cuota_mensual: parseFloat(p.cuota_mensual),
          proxima_cuota: p.proxima_cuota
        }))
      },
      sociosSinAportaciones: {
        total: sociosSinAportaciones.length,
        socios: sociosSinAportaciones.map(s => ({
          id_usuario: s.id_usuario,
          nombre: s.nombre_completo,
          dni: s.dni,
          telefono: s.telefono,
          ultima_aportacion: s.ultima_aportacion,
          dias_sin_aportar: s.dias_sin_aportar
        }))
      },
      liquidacionesPendientes: {
        total: liquidacionesPendientes.length,
        liquidaciones: liquidacionesPendientes.map(l => ({
          id_liquidacion: l.id_liquidacion,
          actividad: l.actividad,
          socio: l.nombre_completo,
          monto: parseFloat(l.monto_recibido),
          fecha: l.fecha
        }))
      },
      saldosBajos: {
        total: saldosBajos.length,
        cuentas: saldosBajos.map(c => ({
          id_cuenta: c.id_cuenta,
          socio: c.nombre_completo,
          telefono: c.telefono,
          saldo: parseFloat(c.saldo)
        }))
      }
    });
  } catch (error) {
    console.error("ERROR AL OBTENER ALERTAS:", error);
    res.status(500).json({ message: "Error obteniendo alertas", error: error.message });
  }
});

// ============================================
// ENDPOINT 4: DISTRIBUCIONES (GRÁFICOS CIRCULARES)
// ============================================
router.get("/distribuciones", async (req, res) => {
  try {
    // Préstamos por estado
    const [prestamosPorEstado] = await pool.query(
      `SELECT 
       estado,
       COUNT(*) as cantidad,
       IFNULL(SUM(monto), 0) as monto_total
       FROM prestamos
       GROUP BY estado`
    );

    // Actividades por tipo
    const [actividadesPorTipo] = await pool.query(
      `SELECT 
       tipo,
       COUNT(*) as cantidad,
       IFNULL(SUM(monto), 0) as monto_total
       FROM actividades
       GROUP BY tipo`
    );

    // Liquidaciones resumen
    const [liquidacionesResumen] = await pool.query(
      `SELECT 
       'total' as tipo,
       COUNT(*) as cantidad,
       IFNULL(SUM(monto_total), 0) as monto_total
       FROM liquidaciones`
    );

    // Movimientos por tipo de operación
    const [movimientosPorTipo] = await pool.query(
      `SELECT 
       tipo_movimiento,
       COUNT(*) as cantidad,
       IFNULL(SUM(ABS(monto)), 0) as volumen_total
       FROM movimientos_cuenta
       WHERE fecha >= DATE_SUB(CURRENT_DATE(), INTERVAL 6 MONTH)
       GROUP BY tipo_movimiento`
    );

    // Socios por rol
    const [sociosPorRol] = await pool.query(
      `SELECT 
       r.nombre as rol,
       COUNT(*) as cantidad
       FROM usuarios u
       INNER JOIN roles r ON u.rol_id = r.id_rol
       WHERE u.estado = 'activo'
       GROUP BY r.nombre`
    );

    res.json({
      prestamos: prestamosPorEstado.map(p => ({
        estado: p.estado,
        cantidad: p.cantidad,
        monto: parseFloat(p.monto_total)
      })),
      actividades: actividadesPorTipo.map(a => ({
        tipo: a.tipo,
        cantidad: a.cantidad,
        monto: parseFloat(a.monto_total)
      })),
      liquidaciones: liquidacionesResumen.map(l => ({
        tipo: l.tipo,
        cantidad: l.cantidad,
        monto: parseFloat(l.monto_total)
      })),
      movimientos: movimientosPorTipo.map(m => ({
        tipo: m.tipo_movimiento,
        cantidad: m.cantidad,
        volumen: parseFloat(m.volumen_total)
      })),
      socios: sociosPorRol.map(s => ({
        rol: s.rol,
        cantidad: s.cantidad
      }))
    });
  } catch (error) {
    console.error("ERROR AL OBTENER DISTRIBUCIONES:", error);
    res.status(500).json({ message: "Error obteniendo distribuciones", error: error.message });
  }
});

// ============================================
// ENDPOINT 5: RESUMEN EJECUTIVO
// ============================================
router.get("/resumen-ejecutivo", async (req, res) => {
  try {
    // Crecimiento de socios (comparación mes actual vs mes anterior)
    const [sociosMesActual] = await pool.query(
      `SELECT COUNT(*) as total 
       FROM usuarios 
       WHERE MONTH(fecha_registro) = MONTH(CURRENT_DATE())
       AND YEAR(fecha_registro) = YEAR(CURRENT_DATE())
       AND rol_id != 1`
    );

    const [sociosMesAnterior] = await pool.query(
      `SELECT COUNT(*) as total 
       FROM usuarios 
       WHERE MONTH(fecha_registro) = MONTH(DATE_SUB(CURRENT_DATE(), INTERVAL 1 MONTH))
       AND YEAR(fecha_registro) = YEAR(DATE_SUB(CURRENT_DATE(), INTERVAL 1 MONTH))
       AND rol_id != 1`
    );

    const crecimientoSocios = sociosMesAnterior[0].total > 0
      ? (((sociosMesActual[0].total - sociosMesAnterior[0].total) / sociosMesAnterior[0].total) * 100).toFixed(2)
      : 0;

    // Comparación de aportaciones
    const [aportacionesMesActual] = await pool.query(
      `SELECT IFNULL(SUM(monto), 0) as total 
       FROM aportaciones 
       WHERE MONTH(fecha) = MONTH(CURRENT_DATE())
       AND YEAR(fecha) = YEAR(CURRENT_DATE())`
    );

    const [aportacionesMesAnterior] = await pool.query(
      `SELECT IFNULL(SUM(monto), 0) as total 
       FROM aportaciones 
       WHERE MONTH(fecha) = MONTH(DATE_SUB(CURRENT_DATE(), INTERVAL 1 MONTH))
       AND YEAR(fecha) = YEAR(DATE_SUB(CURRENT_DATE(), INTERVAL 1 MONTH))`
    );

    const crecimientoAportaciones = parseFloat(aportacionesMesAnterior[0].total) > 0
      ? (((parseFloat(aportacionesMesActual[0].total) - parseFloat(aportacionesMesAnterior[0].total)) / parseFloat(aportacionesMesAnterior[0].total)) * 100).toFixed(2)
      : 0;

    // Comparación de préstamos
    const [prestamosMesActual] = await pool.query(
      `SELECT COUNT(*) as cantidad, IFNULL(SUM(monto), 0) as monto 
       FROM prestamos 
       WHERE MONTH(fecha_otorgado) = MONTH(CURRENT_DATE())
       AND YEAR(fecha_otorgado) = YEAR(CURRENT_DATE())
       AND estado IN ('activo', 'mora', 'pagado')`
    );

    const [prestamosMesAnterior] = await pool.query(
      `SELECT COUNT(*) as cantidad, IFNULL(SUM(monto), 0) as monto 
       FROM prestamos 
       WHERE MONTH(fecha_otorgado) = MONTH(DATE_SUB(CURRENT_DATE(), INTERVAL 1 MONTH))
       AND YEAR(fecha_otorgado) = YEAR(DATE_SUB(CURRENT_DATE(), INTERVAL 1 MONTH))
       AND estado IN ('activo', 'mora', 'pagado')`
    );

    const crecimientoPrestamos = prestamosMesAnterior[0].cantidad > 0
      ? (((prestamosMesActual[0].cantidad - prestamosMesAnterior[0].cantidad) / prestamosMesAnterior[0].cantidad) * 100).toFixed(2)
      : 0;

    // Tasa de recuperación (pagos vs saldo)
    const [totalPagos] = await pool.query(
      `SELECT IFNULL(SUM(monto_pagado), 0) as total 
       FROM pagos_prestamo 
       WHERE MONTH(fecha_pago) = MONTH(CURRENT_DATE())
       AND YEAR(fecha_pago) = YEAR(CURRENT_DATE())`
    );

    const [totalSaldoPendiente] = await pool.query(
      `SELECT IFNULL(SUM(saldo_restante), 0) as total 
       FROM prestamos 
       WHERE estado IN ('activo', 'mora')`
    );

    const tasaRecuperacion = parseFloat(totalSaldoPendiente[0].total) > 0
      ? ((parseFloat(totalPagos[0].total) / parseFloat(totalSaldoPendiente[0].total)) * 100).toFixed(2)
      : 0;

    res.json({
      crecimiento: {
        socios: {
          mesActual: sociosMesActual[0].total,
          mesAnterior: sociosMesAnterior[0].total,
          porcentaje: parseFloat(crecimientoSocios)
        },
        aportaciones: {
          mesActual: parseFloat(aportacionesMesActual[0].total),
          mesAnterior: parseFloat(aportacionesMesAnterior[0].total),
          porcentaje: parseFloat(crecimientoAportaciones)
        },
        prestamos: {
          mesActual: {
            cantidad: prestamosMesActual[0].cantidad,
            monto: parseFloat(prestamosMesActual[0].monto)
          },
          mesAnterior: {
            cantidad: prestamosMesAnterior[0].cantidad,
            monto: parseFloat(prestamosMesAnterior[0].monto)
          },
          porcentaje: parseFloat(crecimientoPrestamos)
        }
      },
      indicadores: {
        tasaRecuperacionMensual: parseFloat(tasaRecuperacion),
        pagosMesActual: parseFloat(totalPagos[0].total),
        saldoTotalPendiente: parseFloat(totalSaldoPendiente[0].total)
      }
    });
  } catch (error) {
    console.error("ERROR AL OBTENER RESUMEN EJECUTIVO:", error);
    res.status(500).json({ message: "Error obteniendo resumen ejecutivo", error: error.message });
  }
});

// ============================================
// ENDPOINT 6: TOP RANKINGS
// ============================================
router.get("/rankings", async (req, res) => {
  try {
    const { limite = 5 } = req.query;

    // Top socios por aportaciones
    const [topAportadores] = await pool.query(
      `SELECT 
       u.id_usuario,
       u.nombre_completo,
       c.saldo_actual as saldo_aportaciones,
       COUNT(a.id_aportacion) as total_aportaciones
       FROM usuarios u
       INNER JOIN cuentas c ON u.id_usuario = c.id_usuario
       LEFT JOIN aportaciones a ON u.id_usuario = a.id_usuario
       WHERE c.tipo_cuenta = 'Aportaciones'
       AND u.estado = 'activo'
       GROUP BY u.id_usuario, u.nombre_completo, c.saldo_actual
       ORDER BY c.saldo_actual DESC
       LIMIT ?`,
      [parseInt(limite)]
    );

    // Top socios con más préstamos
    const [topPrestatarios] = await pool.query(
      `SELECT 
       u.id_usuario,
       u.nombre_completo,
       COUNT(p.id_prestamo) as total_prestamos,
       IFNULL(SUM(p.monto), 0) as monto_total_prestado
       FROM usuarios u
       INNER JOIN prestamos p ON u.id_usuario = p.id_usuario
       WHERE u.estado = 'activo'
       GROUP BY u.id_usuario, u.nombre_completo
       ORDER BY total_prestamos DESC
       LIMIT ?`,
      [parseInt(limite)]
    );

    // Top deudores (mayor saldo pendiente)
    const [topDeudores] = await pool.query(
      `SELECT 
       u.id_usuario,
       u.nombre_completo,
       p.saldo_restante as saldo_pendiente,
       p.estado,
       (p.monto * ((p.tasa_interes / 100 / 12) * POW(1 + (p.tasa_interes / 100 / 12), p.plazo_meses))) / 
        (POW(1 + (p.tasa_interes / 100 / 12), p.plazo_meses) - 1) as cuota_mensual
       FROM usuarios u
       INNER JOIN prestamos p ON u.id_usuario = p.id_usuario
       WHERE p.estado IN ('activo', 'mora')
       AND u.estado = 'activo'
       ORDER BY p.saldo_restante DESC
       LIMIT ?`,
      [parseInt(limite)]
    );

    // Actividades más rentables
    const [actividadesRentables] = await pool.query(
      `SELECT 
       tipo,
       nombre,
       monto,
       fecha
       FROM actividades
       ORDER BY monto DESC
       LIMIT ?`,
      [parseInt(limite)]
    );

    res.json({
      topAportadores: topAportadores.map(s => ({
        id_usuario: s.id_usuario,
        nombre: s.nombre_completo,
        saldo: parseFloat(s.saldo_aportaciones),
        total_aportaciones: s.total_aportaciones
      })),
      topPrestatarios: topPrestatarios.map(s => ({
        id_usuario: s.id_usuario,
        nombre: s.nombre_completo,
        total_prestamos: s.total_prestamos,
        monto_total: parseFloat(s.monto_total_prestado)
      })),
      topDeudores: topDeudores.map(s => ({
        id_usuario: s.id_usuario,
        nombre: s.nombre_completo,
        saldo_pendiente: parseFloat(s.saldo_pendiente),
        estado: s.estado,
        cuota_mensual: parseFloat(s.cuota_mensual)
      })),
      actividadesRentables: actividadesRentables.map(a => ({
        tipo: a.tipo,
        nombre: a.nombre,
        monto: parseFloat(a.monto),
        fecha: a.fecha
      }))
    });
  } catch (error) {
    console.error("ERROR AL OBTENER RANKINGS:", error);
    res.status(500).json({ message: "Error obteniendo rankings", error: error.message });
  }
});

module.exports = router;
