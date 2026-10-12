import { useEffect, useState } from "react";
import axios from "axios";
import { FaMoneyBillWave, FaCheckCircle, FaHourglassHalf, FaTimesCircle, FaChartLine, FaClock, FaUserTie } from "react-icons/fa";
import { CircularProgressbar, buildStyles } from "react-circular-progressbar";

// ==================== COMPONENTE MODAL DETALLE PRÉSTAMO ====================
export default function ModalDetallePrestamo({ show, prestamo, usuario, onClose, getEstadoInfo, token, apiUrl, onLiquidado }) {
  const [cuotaPersonalizada, setCuotaPersonalizada] = useState("");
  const [pagosPrestamo, setPagosPrestamo] = useState([]);

  // Cargar pagos reales del préstamo desde la API
  useEffect(() => {
    if (show && prestamo?.id_prestamo && token && apiUrl) {
      axios
        .get(`${apiUrl}/pagos/prestamo/${prestamo.id_prestamo}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        .then((res) => {
          const data = (res.data.data || []).sort(
            (a, b) => new Date(a.fecha_pago) - new Date(b.fecha_pago)
          );
          setPagosPrestamo(data);
        })
        .catch(() => setPagosPrestamo([]));
    }
    if (!show) setPagosPrestamo([]);
  }, [show, prestamo?.id_prestamo, token, apiUrl]);

  // Mapeo: número de cuota (1-N) → pago real
  const pagoMap = {};
  pagosPrestamo.forEach((p, i) => {
    pagoMap[i + 1] = p;
  });

  const metodoBadgeConfig = {
    efectivo:            { label: "💵 Efectivo",      color: "#27ae60", bg: "rgba(39,174,96,0.12)" },
    transferencia:       { label: "🏦 Transferencia", color: "#3498db", bg: "rgba(52,152,219,0.12)" },
    cheque:              { label: "📋 Cheque",         color: "#9b59b6", bg: "rgba(155,89,182,0.12)" },
    deposito:            { label: "🏧 Depósito",       color: "#e67e22", bg: "rgba(230,126,34,0.12)" },
    "tarjeta de débito": { label: "💳 T. Débito",      color: "#e74c3c", bg: "rgba(231,76,60,0.12)" },
    "pago móvil":         { label: "📱 Pago Móvil",    color: "#1abc9c", bg: "rgba(26,188,156,0.12)" },
  };

  if (!show) return null;

  const estadoInfo = getEstadoInfo(prestamo.estado);
  const IconoEstado = estadoInfo.icon;

  const montoP = parseFloat(prestamo.monto || 0);
  // La tasa se almacena en BD como % anual; tasa_original guarda el % mensual ingresado por el usuario
  const tasaMensualP =
    prestamo.tasa_original != null
      ? parseFloat(prestamo.tasa_original || 0) / 100
      : parseFloat(prestamo.tasa_interes || 0) / 100 / 12;
  const tasaMensualPct = parseFloat((tasaMensualP * 100).toFixed(4));
  const tasaAnualPct = parseFloat((tasaMensualP * 12 * 100).toFixed(4));
  const plazoP = parseInt(prestamo.plazo_meses || 0);

  // Calcular fecha de vencimiento de cada cuota
  const calcularFechaVencimiento = (cuotaNum) => {
    if (!prestamo.fecha_otorgado) return null;
    const base = new Date(prestamo.fecha_otorgado);
    base.setMonth(base.getMonth() + cuotaNum);
    return base.toISOString().substring(0, 10);
  };

  // Cuota mínima sistema francés (referencia matemática)
  const cuotaFrances =
    montoP === 0 || plazoP === 0
      ? 0
      : tasaMensualP === 0
      ? montoP / plazoP
      : (montoP * tasaMensualP * Math.pow(1 + tasaMensualP, plazoP)) /
        (Math.pow(1 + tasaMensualP, plazoP) - 1);

  // Detectar cuota real acordada desde los pagos registrados
  // (tomar el primer pago no-último como referencia del monto acordado)
  const cuotaDetectada = (() => {
    if (pagosPrestamo.length === 0) return 0;
    // Usar los pagos que no sean el último (el último puede ser parcial)
    const pagosRef = pagosPrestamo.length > 1
      ? pagosPrestamo.slice(0, -1)
      : pagosPrestamo;
    const montos = pagosRef.map((pg) => parseFloat(pg.monto_pagado || 0));
    // Moda: el monto más frecuente
    const cuenta = {};
    montos.forEach((m) => { const k = m.toFixed(2); cuenta[k] = (cuenta[k] || 0) + 1; });
    const moda = parseFloat(Object.entries(cuenta).sort((a, b) => b[1] - a[1])[0][0]);
    return moda;
  })();

  // La tabla base SIEMPRE usa la cuota francesa del plazo pactado (plazoP cuotas).
  // Si los pagos reales son mayores, eso significa que el socio adelanta capital,
  // pero la proyección del plan no cambia — se usa cuotaPersonalizada para simularlo.
  const cuotaEstandar = cuotaFrances;

  const cuotaCustom = parseFloat(cuotaPersonalizada) || 0;
  const usandoCustom = cuotaCustom > cuotaEstandar + 0.005;

  // Función auxiliar: proyección pura desde un saldo dado (sin datos reales)
  const proyectarDesde = (saldoInicio, cuota, cuotaNum0) => {
    const filas = [];
    let saldo = saldoInicio;
    while (saldo > 0.005 && filas.length < 360) {
      const numCuota = cuotaNum0 + filas.length;
      const saldoInicial = saldo;
      const interes = saldo * tasaMensualP;
      let pagoCapital = cuota - interes;
      if (pagoCapital <= 0) break;
      if (pagoCapital > saldo) pagoCapital = saldo;
      const pagoReal = pagoCapital + interes;
      saldo = Math.max(0, saldo - pagoCapital);
      filas.push({
        cuota: numCuota,
        fecha: calcularFechaVencimiento(numCuota),
        saldoInicial,
        capital: pagoCapital,
        interes,
        cuotaMensual: pagoReal,
        abonoExtra: 0,
        saldo,
      });
    }
    return filas;
  };

  // Tabla híbrida: filas pagadas = datos reales, filas futuras = proyección desde saldo real
  const calcularAmortizacion = (cuotaOverride = null) => {
    if (montoP === 0 || plazoP === 0) return [];

    const cuota = cuotaOverride && cuotaOverride > cuotaFrances + 0.005
      ? cuotaOverride
      : cuotaFrances;

    const tabla = [];

    // Part 1 — filas con pago real registrado
    for (let i = 0; i < pagosPrestamo.length; i++) {
      const pago = pagosPrestamo[i];
      const saldoInicial = i === 0
        ? montoP
        : parseFloat(pagosPrestamo[i - 1].saldo_restante ?? montoP);
      tabla.push({
        cuota: i + 1,
        fecha: calcularFechaVencimiento(i + 1),
        saldoInicial,
        capital:      parseFloat(pago.monto_capital  || 0),
        interes:      parseFloat(pago.monto_interes  || 0),
        cuotaMensual: parseFloat(pago.monto_pagado   || 0),
        abonoExtra: 0,
        saldo: parseFloat(pago.saldo_restante ?? 0),
      });
    }

    // Part 2 — proyección desde el saldo real actual
    const numPagados = pagosPrestamo.length;
    const saldoProy = numPagados > 0
      ? parseFloat(pagosPrestamo[numPagados - 1].saldo_restante ?? saldoRestante)
      : montoP;

    if (saldoProy > 0.005) {
      const futuras = proyectarDesde(saldoProy, cuota, numPagados + 1);
      futuras.forEach((f) => {
        if (cuotaOverride && cuotaOverride > cuotaFrances + 0.005) {
          f.abonoExtra = Math.max(0, f.cuotaMensual - cuotaFrances);
        }
        tabla.push(f);
      });
    }

    return tabla;
  };

  // Para préstamos de plazo indefinido (solo interés mensual), armar la tabla
  // directamente desde los pagos reales registrados
  const esIndefinido = plazoP === 0;

  const tablaIndefinido = pagosPrestamo.map((pago, i) => {
    const saldoAnterior =
      i === 0
        ? montoP
        : parseFloat(pagosPrestamo[i - 1].saldo_restante ?? 0);
    return {
      cuota: i + 1,
      fecha: pago.fecha_pago
        ? new Date(pago.fecha_pago).toISOString().substring(0, 10)
        : null,
      saldoInicial: saldoAnterior,
      capital: parseFloat(pago.monto_capital || 0),
      interes: parseFloat(pago.monto_interes || 0),
      cuotaMensual: parseFloat(pago.monto_pagado || 0),
      abonoExtra: 0,
      saldo: parseFloat(pago.saldo_restante ?? 0),
    };
  });

  const tablaAmortizacion = esIndefinido
    ? tablaIndefinido
    : calcularAmortizacion(usandoCustom ? cuotaCustom : null);

  // Tabla estándar para comparación de ahorros (proyección pura desde monto original)
  const tablaEstandar = esIndefinido
    ? tablaIndefinido
    : proyectarDesde(montoP, cuotaFrances, 1);
  const interesesEstandar = tablaEstandar.reduce((a, f) => a + f.interes, 0);
  const interesesCustom = tablaAmortizacion.reduce((a, f) => a + f.interes, 0);
  const cuotasAhorradas = tablaEstandar.length - tablaAmortizacion.length;
  const ahorroIntereses = interesesEstandar - interesesCustom;

  // Usar null-check explícito para no confundir saldo_restante=0 con "no definido"
  const saldoRestante = parseFloat(
    prestamo.saldo_restante != null ? prestamo.saldo_restante : (prestamo.monto || 0)
  );
  const monto = montoP;

  // Total realmente pagado según los registros de pagos
  const totalPagadoReal = pagosPrestamo.reduce(
    (sum, p) => sum + parseFloat(p.monto_pagado || 0), 0
  );

  // El saldo_restante del ÚLTIMO pago es el indicador más fiable
  const ultimoPago = pagosPrestamo.length > 0
    ? pagosPrestamo[pagosPrestamo.length - 1]
    : null;
  const saldoUltimoPago = ultimoPago != null
    ? parseFloat(ultimoPago.saldo_restante ?? 0)
    : null;

  // Capital amortizado real (suma de monto_capital de cada pago)
  const capitalAmortizadoReal = pagosPrestamo.reduce(
    (sum, p) => sum + parseFloat(p.monto_capital || 0), 0
  );

  // Está liquidado si cualquiera de estas condiciones aplica:
  // 1. El estado en BD ya es 'pagado' (cualquier capitalización)
  // 2. El saldo_restante en BD ya es 0 o negativo
  // 3. El saldo_restante del último pago registrado es 0
  // 4. El capital amortizado acumulado cubre el principal
  const estaLiquidado =
    (prestamo.estado || "").toLowerCase() === "pagado" ||
    saldoRestante <= 0.01 ||
    (saldoUltimoPago !== null && saldoUltimoPago <= 0.01) ||
    (pagosPrestamo.length > 0 && capitalAmortizadoReal >= montoP - 0.01);

  // Saldo y progreso corregidos — si está liquidado siempre 100%
  const saldoMostrar = estaLiquidado ? 0 : saldoRestante;
  const progreso = estaLiquidado
    ? 100
    : monto > 0
    ? Math.min(99, ((monto - Math.max(0, saldoMostrar)) / monto) * 100)
    : 0;

  const fmt = (n) =>
    parseFloat(n || 0).toLocaleString("es-HN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  // Timeline states — usa estaLiquidado para el paso final
  const estadoNorm = (prestamo.estado || "").toLowerCase();
  const timeline = {
    solicitud: true,
    aprobacion: ["aprobado", "activo", "mora", "pagado"].includes(estadoNorm),
    desembolso: ["activo", "mora", "pagado"].includes(estadoNorm),
    pago: estaLiquidado,
  };

  return (
    <div
      className="modal show d-block"
      tabIndex="-1"
      style={{
        background: "rgba(0, 0, 0, 0.6)",
        backdropFilter: "blur(4px)",
        zIndex: 5000,
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        overflowY: "auto",
      }}
    >
      <div
        className="modal-dialog modal-dialog-centered modal-dialog-scrollable"
        style={{ maxWidth: "980px" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="modal-content border-0 shadow-lg"
          style={{ borderRadius: "20px", overflow: "hidden" }}
        >
          {/* Header */}
          <div
            className="modal-header border-0 text-white"
            style={{
              background: "linear-gradient(135deg, #27ae60 0%, #229954 100%)",
              padding: "16px 24px",
            }}
          >
            <div>
              <h5 className="modal-title mb-0 d-flex align-items-center fw-bold">
                <FaMoneyBillWave className="me-2" style={{ fontSize: "18px" }} />
                Detalle del Préstamo
                <span className="ms-2 badge" style={{ background: "rgba(255,255,255,0.2)", fontSize: "0.75rem", borderRadius: 8, padding: "3px 8px" }}>
                  #{prestamo.id_prestamo}
                </span>
              </h5>
            </div>
            <button
              type="button"
              className="btn-close btn-close-white"
              onClick={onClose}
              style={{ filter: "brightness(0) invert(1)" }}
            ></button>
          </div>

          {/* Body */}
          <div
            className="modal-body"
            style={{ padding: "18px 24px", background: "#f8f9fa" }}
          >
            {/* Información del Socio y Estado */}
            <div className="row g-3 mb-3">
              <div className="col-md-6">
                <div
                  className="card border-0 shadow-sm h-100"
                  style={{ borderRadius: "12px" }}
                >
                  <div className="card-body py-2 px-3">
                    <h6 className="fw-bold mb-2" style={{ color: "#2c3e50", fontSize: "0.85rem" }}
                    >
                      <FaUserTie className="me-2" style={{ color: "#3498db" }} />
                      Información del Socio
                    </h6>
                    <div className="mb-1 small"><strong>Nombre:</strong> {usuario?.nombre_completo || "N/A"}</div>
                    <div className="mb-1 small"><strong>DNI:</strong> {usuario?.dni || "N/A"}</div>
                    <div className="mb-1 small"><strong>Teléfono:</strong> {usuario?.telefono || "N/A"}</div>
                    <div className="small"><strong>Correo:</strong> {usuario?.correo || "N/A"}</div>
                  </div>
                </div>
              </div>

              <div className="col-md-6">
                <div
                  className="card border-0 shadow-sm h-100"
                  style={{ borderRadius: "12px" }}
                >
                  <div className="card-body py-2 px-3">
                    <h6 className="fw-bold mb-2" style={{ color: "#2c3e50", fontSize: "0.85rem" }}>
                      <FaChartLine className="me-2" style={{ color: "#27ae60" }} />
                      Estado del Préstamo
                    </h6>
                    <div className="d-flex align-items-center justify-content-between mb-2">
                      <div className="d-flex flex-column gap-1">
                        <span
                          className="badge d-inline-flex align-items-center"
                          style={{
                            background: estaLiquidado ? "rgba(39,174,96,0.15)" : estadoInfo.bg,
                            color: estaLiquidado ? "#27ae60" : estadoInfo.color,
                            border: `1.5px solid ${estaLiquidado ? "#27ae60" : estadoInfo.color}`,
                            fontWeight: "600",
                            borderRadius: "20px",
                            fontSize: "12px",
                            padding: "4px 10px",
                          }}
                        >
                          {estaLiquidado ? <FaCheckCircle className="me-1" /> : <IconoEstado className="me-1" />}
                          {estaLiquidado ? "Pagado" : estadoInfo.label}
                        </span>
                      </div>
                      <div style={{ width: "65px", height: "65px" }}>
                        <CircularProgressbar
                          value={progreso}
                          text={`${progreso.toFixed(0)}%`}
                          styles={buildStyles({
                            textSize: "22px",
                            pathColor: progreso === 100 ? "#27ae60" : "#3498db",
                            textColor: "#2c3e50",
                            trailColor: "#ecf0f1",
                          })}
                        />
                      </div>
                    </div>
                    <div className="mb-1 small">
                      <strong>Monto Original:</strong> L.{" "}
                      {monto.toFixed(2)}
                    </div>
                    <div className="mb-1 small">
                      <strong>Total Pagado:</strong>{" "}
                      <span style={{ color: "#3498db", fontWeight: "bold" }}>
                        L. {fmt(totalPagadoReal)}
                      </span>
                    </div>
                    <div className="small">
                      <strong>Saldo Restante:</strong>{" "}
                      <span style={{ color: estaLiquidado ? "#27ae60" : "#e74c3c", fontWeight: "bold" }}>
                        {estaLiquidado ? (
                          <><span style={{ fontSize: "0.85rem" }}>✅</span> L. 0.00 — Liquidado</>
                        ) : (
                          `L. ${saldoMostrar.toFixed(2)}`
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Timeline del Proceso */}
            <div className="card border-0 shadow-sm mb-3" style={{ borderRadius: "12px" }}>
              <div className="card-body">
                <h6 className="fw-bold mb-4" style={{ color: "#2c3e50" }}>
                  <FaClock className="me-2" style={{ color: "#f39c12" }} />
                  Proceso del Préstamo
                </h6>
                <div className="d-flex align-items-center justify-content-between position-relative">
                  {/* Línea de conexión */}
                  <div
                    style={{
                      position: "absolute",
                      top: "20px",
                      left: "10%",
                      right: "10%",
                      height: "4px",
                      background: "#e9ecef",
                      zIndex: 0,
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: timeline.pago
                          ? "100%"
                          : timeline.desembolso
                          ? "66%"
                          : timeline.aprobacion
                          ? "33%"
                          : "0%",
                        background: "linear-gradient(90deg, #27ae60 0%, #229954 100%)",
                        transition: "width 0.3s ease",
                      }}
                    ></div>
                  </div>

                  {/* Paso 1: Solicitud */}
                  <div className="text-center" style={{ zIndex: 1, flex: 1 }}>
                    <div
                      className="rounded-circle d-inline-flex align-items-center justify-content-center mb-2"
                      style={{
                        width: "40px",
                        height: "40px",
                        background: timeline.solicitud
                          ? "linear-gradient(135deg, #27ae60 0%, #229954 100%)"
                          : "#e9ecef",
                        color: timeline.solicitud ? "white" : "#95a5a6",
                        boxShadow: timeline.solicitud
                          ? "0 4px 12px rgba(39, 174, 96, 0.3)"
                          : "none",
                      }}
                    >
                      <FaHourglassHalf size={16} />
                    </div>
                    <div className="small fw-semibold" style={{ color: "#2c3e50" }}>
                      Solicitud
                    </div>
                    <div className="small text-muted">
                      {prestamo.fecha_solicitud?.substring(0, 10) || "N/A"}
                    </div>
                  </div>

                  {/* Paso 2: Aprobación */}
                  <div className="text-center" style={{ zIndex: 1, flex: 1 }}>
                    <div
                      className="rounded-circle d-inline-flex align-items-center justify-content-center mb-2"
                      style={{
                        width: "40px",
                        height: "40px",
                        background: timeline.aprobacion
                          ? "linear-gradient(135deg, #27ae60 0%, #229954 100%)"
                          : "#e9ecef",
                        color: timeline.aprobacion ? "white" : "#95a5a6",
                        boxShadow: timeline.aprobacion
                          ? "0 4px 12px rgba(39, 174, 96, 0.3)"
                          : "none",
                      }}
                    >
                      <FaCheckCircle size={16} />
                    </div>
                    <div className="small fw-semibold" style={{ color: "#2c3e50" }}>
                      Aprobación
                    </div>
                    <div className="small text-muted">
                      {prestamo.fecha_aprobacion?.substring(0, 10) || "-"}
                    </div>
                  </div>

                  {/* Paso 3: Desembolso */}
                  <div className="text-center" style={{ zIndex: 1, flex: 1 }}>
                    <div
                      className="rounded-circle d-inline-flex align-items-center justify-content-center mb-2"
                      style={{
                        width: "40px",
                        height: "40px",
                        background: timeline.desembolso
                          ? "linear-gradient(135deg, #27ae60 0%, #229954 100%)"
                          : "#e9ecef",
                        color: timeline.desembolso ? "white" : "#95a5a6",
                        boxShadow: timeline.desembolso
                          ? "0 4px 12px rgba(39, 174, 96, 0.3)"
                          : "none",
                      }}
                    >
                      <FaMoneyBillWave size={16} />
                    </div>
                    <div className="small fw-semibold" style={{ color: "#2c3e50" }}>
                      Desembolso
                    </div>
                    <div className="small text-muted">
                      {prestamo.fecha_otorgado?.substring(0, 10) || "-"}
                    </div>
                  </div>

                  {/* Paso 4: Pago Completo */}
                  <div className="text-center" style={{ zIndex: 1, flex: 1 }}>
                    <div
                      className="rounded-circle d-inline-flex align-items-center justify-content-center mb-2"
                      style={{
                        width: "40px",
                        height: "40px",
                        background: timeline.pago
                          ? "linear-gradient(135deg, #27ae60 0%, #229954 100%)"
                          : "#e9ecef",
                        color: timeline.pago ? "white" : "#95a5a6",
                        boxShadow: timeline.pago
                          ? "0 4px 12px rgba(39, 174, 96, 0.3)"
                          : "none",
                      }}
                    >
                      <FaCheckCircle size={16} />
                    </div>
                    <div className="small fw-semibold" style={{ color: "#2c3e50" }}>
                      Pagado
                    </div>
                    <div className="small text-muted">
                      {prestamo.fecha_liquidacion?.substring(0, 10) || "-"}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Tabla de Amortización */}
            <div className="card border-0 shadow-sm" style={{ borderRadius: "12px" }}>
              <div className="card-body">
                {/* Encabezado + simulador de cuota */}
                <div className="d-flex flex-wrap align-items-start justify-content-between gap-3 mb-3">
                  <div>
                    <h6 className="fw-bold mb-1" style={{ color: "#2c3e50" }}>
                      <FaChartLine className="me-2" style={{ color: "#27ae60" }} />
                      {esIndefinido ? "Historial de Pagos (Plazo Indefinido)" : "Tabla de Amortización"}
                    </h6>
                    {esIndefinido && (
                      <div
                        className="small mb-2"
                        style={{
                          background: "rgba(52,152,219,0.08)",
                          border: "1px solid #90caf9",
                          borderRadius: "8px",
                          padding: "6px 10px",
                          color: "#1565c0",
                        }}
                      >
                        💡 Préstamo de interés mensual indefinido — se muestran los pagos registrados.
                        {tablaAmortizacion.length === 0 && (
                          <span className="ms-1" style={{ color: "#e67e22" }}>Sin pagos registrados aún.</span>
                        )}
                      </div>
                    )}
                    {!esIndefinido && (
                      <div className="d-flex flex-wrap gap-3" style={{ fontSize: ".8rem", color: "#555" }}>
                        <span>
                          Principal:{" "}
                          <strong style={{ color: "#2c3e50" }}>L. {fmt(montoP)}</strong>
                        </span>
                        <span>
                          Tasa mensual:{" "}
                          <strong style={{ color: "#e67e22" }}>{tasaMensualPct}%</strong>
                        </span>
                        <span>
                          Tasa anual equiv.:{" "}
                          <strong style={{ color: "#e67e22" }}>{tasaAnualPct}%</strong>
                        </span>
                        <span>
                          1er pago:{" "}
                          <strong style={{ color: "#2c3e50" }}>
                            {calcularFechaVencimiento(1) || "—"}
                          </strong>
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Simulador cuota personalizada — solo para plazo fijo */}
                  {!esIndefinido && <div
                    style={{
                      background: "linear-gradient(135deg,#edf7ff,#dbeeff)",
                      border: "1.5px solid #90caf9",
                      borderRadius: "12px",
                      padding: "12px 16px",
                      minWidth: "280px",
                    }}
                  >
                    <div
                      className="small fw-bold mb-2"
                      style={{ color: "#1565c0" }}
                    >
                      💡 Simular cuota personalizada
                    </div>
                    <div className="d-flex align-items-center gap-2">
                      <div className="input-group input-group-sm" style={{ maxWidth: 200 }}>
                        <span
                          className="input-group-text fw-bold"
                          style={{ background: "#1976d2", color: "#fff", border: "none" }}
                        >
                          L.
                        </span>
                        <input
                          type="number"
                          className="form-control"
                          style={{ border: "1.5px solid #90caf9" }}
                          placeholder={`Mín. ${fmt(cuotaFrances)}`}
                          min={cuotaFrances.toFixed(2)}
                          step="0.01"
                          value={cuotaPersonalizada}
                          onChange={(e) => setCuotaPersonalizada(e.target.value)}
                        />
                      </div>
                      {cuotaPersonalizada && (
                        <button
                          type="button"
                          className="btn btn-sm"
                          style={{
                            background: "#e3f2fd",
                            color: "#1565c0",
                            border: "1px solid #90caf9",
                            borderRadius: "8px",
                          }}
                          onClick={() => setCuotaPersonalizada("")}
                          title="Restaurar cuota estándar"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                    <div className="small mt-1" style={{ color: "#555" }}>
                      Cuota francesa ({plazoP} meses):{" "}
                      <strong style={{ color: "#27ae60" }}>L. {fmt(cuotaFrances)}</strong>
                      {cuotaDetectada > 0 && Math.abs(cuotaDetectada - cuotaFrances) > 0.05 && (
                        <span className="ms-1" style={{ color: "#7f8c8d" }}>
                          · pagando: L. {fmt(cuotaDetectada)}
                        </span>
                      )}
                    </div>
                    {cuotaPersonalizada && !usandoCustom && (
                      <div className="small mt-1" style={{ color: "#e53935" }}>
                        ⚠ Ingresa un valor mayor a L. {fmt(cuotaEstandar)}
                      </div>
                    )}
                  </div>}
                </div>

                {/* Aviso cuando el socio paga más que la cuota francesa */}
                {!esIndefinido && cuotaDetectada > cuotaFrances + 0.5 && !usandoCustom && (
                  <div className="rounded-3 mb-3 px-3 py-2 d-flex flex-wrap align-items-center gap-2"
                    style={{ background: "rgba(243,156,18,0.08)", border: "1.5px solid #f39c12" }}>
                    <span style={{ fontSize: "0.82rem", color: "#7d5a00" }}>
                      💡 Este socio está pagando{" "}
                      <strong>L. {fmt(cuotaDetectada)}/mes</strong>{" "}
                      (<strong style={{ color: "#27ae60" }}>+L. {fmt(cuotaDetectada - cuotaFrances)}</strong> sobre la cuota del contrato).
                      {" "}Si mantiene ese ritmo, terminará antes del plazo pactado.
                    </span>
                    <button type="button" className="btn btn-sm ms-auto"
                      style={{ background: "#f39c12", color: "white", border: "none", borderRadius: 6, fontSize: "0.75rem", padding: "3px 10px", whiteSpace: "nowrap" }}
                      onClick={() => setCuotaPersonalizada(String(cuotaDetectada.toFixed(2)))}>
                      Ver proyección →
                    </button>
                  </div>
                )}

                {/* Banner de ahorro — solo para plazo fijo */}
                {!esIndefinido && usandoCustom && (
                  <div
                    className="rounded-3 mb-3 p-3"
                    style={{
                      background: "linear-gradient(135deg,#e8f5e9,#f1f8e9)",
                      border: "1.5px solid #a5d6a7",
                    }}
                  >
                    <div className="row g-2 text-center">
                      <div className="col-6 col-md-3">
                        <div className="small text-muted">Cuota personalizada</div>
                        <div className="fw-bold" style={{ color: "#1565c0", fontSize: "1rem" }}>
                          L. {fmt(cuotaCustom)}
                        </div>
                        <div className="small" style={{ color: "#e53935" }}>
                          +L. {fmt(cuotaCustom - cuotaEstandar)} extra/mes
                        </div>
                      </div>
                      <div className="col-6 col-md-3">
                        <div className="small text-muted">Cuotas necesarias</div>
                        <div className="fw-bold" style={{ color: "#2c3e50", fontSize: "1rem" }}>
                          {tablaAmortizacion.length}{" "}
                          <span className="small text-muted fw-normal">de {tablaEstandar.length}</span>
                        </div>
                        <div className="small" style={{ color: "#27ae60" }}>
                          {cuotasAhorradas > 0
                            ? `✂ ${cuotasAhorradas} cuota${cuotasAhorradas !== 1 ? "s" : ""} menos`
                            : "Sin ahorro de tiempo"}
                        </div>
                      </div>
                      <div className="col-6 col-md-3">
                        <div className="small text-muted">Intereses totales</div>
                        <div className="fw-bold" style={{ color: "#b7791f", fontSize: "1rem" }}>
                          L. {fmt(interesesCustom)}
                        </div>
                        <div className="small text-muted">
                          vs L. {fmt(interesesEstandar)} estándar
                        </div>
                      </div>
                      <div className="col-6 col-md-3">
                        <div className="small text-muted">Ahorro en intereses</div>
                        <div
                          className="fw-bold"
                          style={{
                            color: ahorroIntereses > 0 ? "#27ae60" : "#e53935",
                            fontSize: "1rem",
                          }}
                        >
                          {ahorroIntereses > 0 ? "🎉 " : ""}L. {fmt(ahorroIntereses)}
                        </div>
                        <div className="small" style={{ color: "#27ae60" }}>
                          {ahorroIntereses > 0
                            ? `${((ahorroIntereses / interesesEstandar) * 100).toFixed(1)}% menos interés`
                            : ""}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div style={{ overflowX: "auto" }}>
                <div style={{ maxHeight: "420px", overflowY: "auto" }}>
                  <table className="table table-sm table-hover align-middle mb-0" style={{ marginBottom: 0 }}>
                    <thead
                      style={{
                        background: usandoCustom
                          ? "linear-gradient(135deg, #1565c0 0%, #1976d2 100%)"
                          : "linear-gradient(135deg, #3498db 0%, #2980b9 100%)",
                        color: "white",
                        position: "sticky",
                        top: 0,
                        zIndex: 1,
                      }}
                    >
                      <tr>
                        <th
                          className="text-center"
                          style={{ padding: "10px 12px", borderBottom: "none", whiteSpace: "nowrap" }}
                        >
                          #
                        </th>
                        <th style={{ padding: "10px 12px", borderBottom: "none", whiteSpace: "nowrap" }}>
                          Fecha Venc.
                        </th>
                        <th style={{ padding: "10px 12px", borderBottom: "none", whiteSpace: "nowrap" }}>
                          Saldo Inicial
                        </th>
                        <th style={{ padding: "10px 12px", borderBottom: "none", whiteSpace: "nowrap" }}>
                          Interés ({tasaMensualPct}%)
                        </th>
                        <th style={{ padding: "10px 12px", borderBottom: "none", whiteSpace: "nowrap" }}>
                          Pago
                        </th>
                        <th style={{ padding: "10px 12px", borderBottom: "none", whiteSpace: "nowrap" }}>
                          Abono Capital
                        </th>
                        {usandoCustom && (
                          <th
                            style={{
                              padding: "10px 12px",
                              borderBottom: "none",
                              background: "rgba(255,255,255,0.15)",
                              whiteSpace: "nowrap",
                            }}
                          >
                            Abono Extra
                          </th>
                        )}
                        <th style={{ padding: "10px 12px", borderBottom: "none", whiteSpace: "nowrap" }}>
                          Saldo Final
                        </th>
                        <th style={{ padding: "10px 12px", borderBottom: "none", whiteSpace: "nowrap" }}>
                          Estado
                        </th>
                        <th style={{ padding: "10px 12px", borderBottom: "none", whiteSpace: "nowrap" }}>
                          Método
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {tablaAmortizacion
                        .filter((fila) => !estaLiquidado || !!pagoMap[fila.cuota])
                        .map((fila) => {
                        const esUltima = fila.cuota === tablaAmortizacion.length;
                        const tieneExtra = fila.abonoExtra > 0.005;
                        const pagoReal = pagoMap[fila.cuota];
                        const estaPagado = !!pagoReal;
                        const metodoPago = pagoReal?.metodo_pago || null;
                        const metodoInfo = metodoPago
                          ? metodoBadgeConfig[metodoPago.toLowerCase()] || { label: metodoPago, color: "#7f8c8d", bg: "#f1f1f1" }
                          : null;
                        return (
                          <tr
                            key={fila.cuota}
                            style={{
                              background: estaPagado
                                ? "rgba(39,174,96,0.08)"
                                : esUltima
                                ? "#e8f5e9"
                                : fila.cuota % 2 === 0
                                ? "#ffffff"
                                : "#f8f9fa",
                              transition: "background 0.15s",
                              opacity: estaPagado ? 0.92 : 1,
                            }}
                          >
                            <td
                              className="text-center fw-bold"
                              style={{ padding: "10px 12px", color: estaPagado ? "#27ae60" : esUltima ? "#27ae60" : "#2c3e50", whiteSpace: "nowrap" }}
                            >
                              {fila.cuota}
                              {estaPagado && (
                                <span className="ms-1" style={{ fontSize: ".65rem", color: "#27ae60" }}>✓</span>
                              )}
                            </td>
                            <td style={{ padding: "10px 12px", whiteSpace: "nowrap", color: "#546e7a" }}>
                              {fila.fecha || "—"}
                            </td>
                            <td style={{ padding: "10px 12px", whiteSpace: "nowrap", color: "#2c3e50" }}>
                              L. {fmt(fila.saldoInicial)}
                            </td>
                            <td style={{ padding: "10px 12px", whiteSpace: "nowrap", color: "#b7791f" }}>
                              L. {fmt(fila.interes)}
                            </td>
                            <td
                              className="fw-bold"
                              style={{ padding: "10px 12px", whiteSpace: "nowrap", color: "#27ae60" }}
                            >
                              L. {fmt(fila.cuotaMensual)}
                            </td>
                            <td style={{ padding: "10px 12px", whiteSpace: "nowrap", color: "#1565c0" }}>
                              L. {fmt(fila.capital)}
                            </td>
                            {usandoCustom && (
                              <td
                                style={{
                                  padding: "10px 12px",
                                  whiteSpace: "nowrap",
                                  color: tieneExtra ? "#1565c0" : "#aaa",
                                  fontWeight: tieneExtra ? "600" : "400",
                                  background: tieneExtra ? "rgba(21,101,192,0.05)" : "transparent",
                                }}
                              >
                                {tieneExtra ? `+L. ${fmt(fila.abonoExtra)}` : "—"}
                              </td>
                            )}
                            <td style={{ padding: "10px 12px", whiteSpace: "nowrap", color: fila.saldo < 0.01 ? "#27ae60" : "#e74c3c", fontWeight: fila.saldo < 0.01 ? "700" : "400" }}>
                              L. {fmt(fila.saldo)}
                            </td>
                            {/* Estado */}
                            <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>
                              {estaPagado ? (
                                <span
                                  className="badge"
                                  style={{
                                    background: "rgba(39,174,96,0.15)",
                                    color: "#27ae60",
                                    border: "1.5px solid #27ae60",
                                    borderRadius: "8px",
                                    fontSize: "11px",
                                    padding: "3px 8px",
                                    fontWeight: "700",
                                  }}
                                >
                                  ✓ Pagado
                                </span>
                              ) : (
                                <span
                                  className="badge"
                                  style={{
                                    background: "rgba(149,165,166,0.12)",
                                    color: "#95a5a6",
                                    border: "1.5px solid #bdc3c7",
                                    borderRadius: "8px",
                                    fontSize: "11px",
                                    padding: "3px 8px",
                                  }}
                                >
                                  Pendiente
                                </span>
                              )}
                            </td>
                            {/* Método */}
                            <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>
                              {metodoInfo ? (
                                <span
                                  className="badge"
                                  style={{
                                    background: metodoInfo.bg,
                                    color: metodoInfo.color,
                                    border: `1.5px solid ${metodoInfo.color}`,
                                    borderRadius: "8px",
                                    fontSize: "11px",
                                    padding: "3px 8px",
                                    fontWeight: "600",
                                  }}
                                >
                                  {metodoInfo.label}
                                </span>
                              ) : (
                                <span style={{ color: "#ccc" }}>—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {/* Totales fijos fuera del scroll — siempre visibles sin importar cuántas cuotas haya */}
                <div style={{
                  background: "#2c3e50", color: "white", fontWeight: "600",
                  padding: "10px 14px", display: "flex", flexWrap: "wrap", gap: "10px",
                  alignItems: "center", fontSize: "0.82rem", borderRadius: "0 0 6px 6px",
                }}>
                  <span style={{ fontWeight: 800 }}>TOTAL</span>
                  <span style={{ color: "#94a3b8" }}>·</span>
                  <span>Int.: <strong style={{ color: "#fbbf24" }}>L. {fmt(tablaAmortizacion.reduce((acc, f) => acc + f.interes, 0))}</strong></span>
                  <span>Pago: <strong style={{ color: "#4ade80" }}>L. {fmt(tablaAmortizacion.reduce((acc, f) => acc + f.cuotaMensual, 0))}</strong></span>
                  <span>Capital: <strong>L. {fmt(tablaAmortizacion.reduce((acc, f) => acc + f.capital, 0))}</strong></span>
                  {usandoCustom && (
                    <span>Extra: <strong>+L. {fmt(tablaAmortizacion.reduce((acc, f) => acc + f.abonoExtra, 0))}</strong></span>
                  )}
                  <span>Saldo: <strong style={{ color: "#4ade80" }}>L. 0.00</strong></span>
                  <span style={{ marginLeft: "auto" }}>
                    {estaLiquidado ? (
                      <span style={{ color: "#4ade80" }}>✅ {pagosPrestamo.length} pagadas — Liquidado</span>
                    ) : (
                      <>
                        <span style={{ color: "#4ade80" }}>{pagosPrestamo.length} pagadas</span>
                        {" / "}
                        <span style={{ color: "#94a3b8" }}>{tablaAmortizacion.length - pagosPrestamo.length} pend.</span>
                      </>
                    )}
                  </span>
                </div>
                </div>
              </div>
            </div>

          </div>

          {/* Footer */}
          <div
            className="modal-footer border-0 bg-white"
            style={{ padding: "12px 24px" }}
          >
            {estaLiquidado ? (
              <span className="badge me-auto" style={{ background: "rgba(39,174,96,0.15)", color: "#27ae60", border: "1.5px solid #27ae60", borderRadius: 10, fontSize: 13, padding: "6px 14px", fontWeight: 700 }}>
                ✅ Préstamo liquidado en su totalidad
              </span>
            ) : (
              <button
                type="button"
                className="btn btn-sm me-auto fw-semibold"
                style={{
                  background: "rgba(39,174,96,0.12)",
                  color: "#27ae60",
                  border: "1.5px solid #27ae60",
                  borderRadius: "8px",
                  padding: "6px 16px",
                }}
                onClick={async () => {
                  if (!window.confirm(`¿Marcar el préstamo #${prestamo.id_prestamo} como PAGADO/LIQUIDADO? Esto pondrá el saldo en L. 0.00.`)) return;
                  try {
                    await axios.patch(
                      `${apiUrl}/prestamos/${prestamo.id_prestamo}/estado`,
                      { estado: "pagado" },
                      { headers: { Authorization: `Bearer ${token}` } }
                    );
                    if (onLiquidado) onLiquidado();
                    onClose();
                  } catch (e) {
                    alert("Error al actualizar el préstamo: " + (e?.response?.data?.message || e.message));
                  }
                }}
              >
                <FaCheckCircle className="me-1" /> Marcar como Liquidado
              </button>
            )}
            <button
              type="button"
              className="btn btn-sm btn-light shadow-sm"
              onClick={onClose}
              style={{
                borderRadius: "8px",
                padding: "8px 24px",
                fontWeight: "600",
              }}
            >
              <FaTimesCircle className="me-2" />
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
