import { useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import { FaMoneyCheckAlt, FaCalendarAlt, FaMoneyBillWave, FaFileInvoiceDollar, FaClock } from "react-icons/fa";

const fmt = (n) =>
  parseFloat(n || 0).toLocaleString("es-HN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const API_URL_MODAL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

// ==================== COMPONENTE MODAL PAGO ====================
export default function ModalPago({
  show,
  editPago,
  form,
  prestamos,
  usuarios,
  pagos = [],
  onClose,
  onSubmit,
  handleInput,
  tipoInicial = "",
  reporte = null, // pago reportado por el socio: el monto queda fijo
  onVerComprobante,
}) {
  // ── Hooks SIEMPRE antes del early return (regla de React) ────────────
  const [fechaReferencia, setFechaReferencia] = useState("");
  const [busquedaPrestamo, setBusquedaPrestamo] = useState("");
  const [dropdownAbierto, setDropdownAbierto] = useState(false);
  const [tipoPago, setTipoPago] = useState("cuota_fija"); // "cuota_fija" | "desglose" | "indefinido"

  // Estado local para mostrar el monto con comas mientras se escribe
  const [montoDisplay, setMontoDisplay] = useState(() => {
    if (!form.monto && form.monto !== 0) return "";
    const raw = String(form.monto);
    const parts = raw.split(".");
    const intFmt = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return parts.length > 1 ? intFmt + "." + parts[1] : intFmt;
  });

  const handleMontoChange = (e) => {
    const raw = e.target.value.replace(/,/g, ""); // quitar comas
    if (raw !== "" && !/^\d*\.?\d*$/.test(raw)) return; // solo números
    // Formatear parte entera con comas
    const parts = raw.split(".");
    const intFmt = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    const display = parts.length > 1 ? intFmt + "." + parts[1] : intFmt;
    setMontoDisplay(display);
    handleInput({ target: { name: "monto", value: raw } });
  };

  // Préstamo seleccionado (necesario para useEffect)
  const prestamoSeleccionado = prestamos.find(
    (p) => p.id_prestamo === parseInt(form.id_prestamo)
  );

  // ── Mora del préstamo seleccionado ─────────────────────────────────────
  const { user: usuarioActual, token: tokenModal } = useAuth();
  const esSuperAdmin = usuarioActual?.rol === "Super Administrador";
  const [moraInfo, setMoraInfo] = useState(null); // { dias, mora, porDia }
  const condonarMora = !!form.condonar_mora;

  useEffect(() => {
    setMoraInfo(null);
    handleInput({ target: { name: "condonar_mora", value: false } });
    if (editPago || !prestamoSeleccionado) return;
    let activo = true;
    axios
      .get(`${API_URL_MODAL}/pagos/prestamo/${prestamoSeleccionado.id_prestamo}/proximo-pago`, {
        headers: { Authorization: `Bearer ${tokenModal}` },
      })
      .then((r) => {
        const pp = r.data.proximo_pago;
        if (activo && pp && pp.dias_mora > 0) {
          setMoraInfo({
            dias: pp.dias_mora,
            mora: parseFloat(pp.interes_moratorio || 0),
            porDia: parseFloat(pp.mora_por_dia || 0),
          });
        }
      })
      .catch(() => {});
    return () => {
      activo = false;
    };
  // eslint-disable-next-line
  }, [prestamoSeleccionado?.id_prestamo, editPago]);

  // Mora que realmente se cobra con este pago
  const moraAplicable = !editPago && moraInfo && !condonarMora ? moraInfo.mora : 0;

  // Cuando cambia el préstamo: inicio del período + auto-selección de tipo
  useEffect(() => {
    if (prestamoSeleccionado) {
      // Para desglose: usar fecha del último pago realizado como inicio de período
      const pagosDelPrestamo = pagos
        .filter(p => p.id_prestamo === prestamoSeleccionado.id_prestamo)
        .sort((a, b) => new Date(b.fecha_pago) - new Date(a.fecha_pago));
      const ultimaFecha = pagosDelPrestamo[0]?.fecha_pago?.substring(0, 10);
      setFechaReferencia(ultimaFecha || prestamoSeleccionado.fecha_otorgado?.substring(0, 10) || "");
    } else {
      setFechaReferencia("");
    }
    if (prestamoSeleccionado && !editPago) {
      setTipoPago(
        tipoInicial === "desglose"
          ? "desglose"
          : parseInt(prestamoSeleccionado.plazo_meses) === 0 ? "indefinido" : "cuota_fija"
      );
    }
  // eslint-disable-next-line
  }, [prestamoSeleccionado?.id_prestamo]);

  // Auto-relleno de monto: Cuota Fija (se dispara al cambiar tipo o préstamo)
  useEffect(() => {
    if (editPago || reporte || !prestamoSeleccionado || tipoPago !== "cuota_fija") return;
    const valor = parseFloat(((prestamoSeleccionado.cuota_mensual || 0) + moraAplicable).toFixed(2));
    const raw = String(valor);
    const parts = raw.split(".");
    const intFmt = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    setMontoDisplay(parts.length > 1 ? intFmt + "." + parts[1] : intFmt);
    handleInput({ target: { name: "monto", value: raw } });
  // eslint-disable-next-line
  }, [tipoPago, prestamoSeleccionado?.id_prestamo, moraAplicable]);

  // Auto-relleno y recálculo: Desglose Total (se actualiza al cambiar período o fecha)
  useEffect(() => {
    if (editPago || reporte || !prestamoSeleccionado || tipoPago !== "desglose") return;
    const ref = fechaReferencia ? new Date(fechaReferencia + "T00:00:00") : null;
    const fechaPagoDate = form.fecha ? new Date(form.fecha + "T00:00:00") : null;
    const dias = (ref && fechaPagoDate)
      ? Math.max(30, Math.round((fechaPagoDate - ref) / (1000 * 60 * 60 * 24)))
      : 30;
    const tasaMens = parseFloat(prestamoSeleccionado.tasa_interes) / 100 / 12;
    const tasaDia = tasaMens / 30;
    const saldo = parseFloat(prestamoSeleccionado.saldo_restante || 0);
    const interes = parseFloat((saldo * tasaDia * dias).toFixed(2));
    const valor = parseFloat((saldo + interes + moraAplicable).toFixed(2));
    const raw = String(valor);
    const parts = raw.split(".");
    const intFmt = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    setMontoDisplay(parts.length > 1 ? intFmt + "." + parts[1] : intFmt);
    handleInput({ target: { name: "monto", value: raw } });
  // eslint-disable-next-line
  }, [tipoPago, prestamoSeleccionado?.id_prestamo, fechaReferencia, form.fecha, moraAplicable]);

  // El backend calcula el interés con la misma regla: enviarle el tipo y el período elegidos
  useEffect(() => {
    if (editPago) return;
    handleInput({ target: { name: "tipo_pago", value: tipoPago } });
    handleInput({ target: { name: "fecha_referencia", value: fechaReferencia } });
  // eslint-disable-next-line
  }, [tipoPago, fechaReferencia]);

  // Cuando cambia la fecha del pago: recalcular días (sin tocar fechaReferencia)
  // Se fuerza re-render natural — diasTranscurridos se recalcula automáticamente

  if (!show) return null;

  const usuarioSeleccionado = prestamoSeleccionado
    ? usuarios.find((u) => u.id_usuario === prestamoSeleccionado.id_usuario)
    : null;

  // ── Cálculo de interés proporcional por días ─────────────────────────
  const esIndefinido = parseInt(prestamoSeleccionado?.plazo_meses) === 0;
  const saldoActualPrestamo = parseFloat(prestamoSeleccionado?.saldo_restante || 0);

  // Tasa mensual (la BD guarda tasa anual / 12)
  const tasaMensual = prestamoSeleccionado
    ? parseFloat(prestamoSeleccionado.tasa_interes) / 100 / 12
    : 0;

  // Días transcurridos entre la fecha de referencia y la fecha del pago
  const calcularDias = () => {
    if (!fechaReferencia || !form.fecha) return 30;
    const ref  = new Date(fechaReferencia + "T00:00:00");
    const pago = new Date(form.fecha      + "T00:00:00");
    const diff = Math.round((pago - ref) / (1000 * 60 * 60 * 24));
    return diff >= 30 ? diff : 30; // mes completo siempre: mínimo 30 días
  };
  const diasTranscurridos = prestamoSeleccionado ? calcularDias() : 30;
  const tasaDiaria = tasaMensual / 30;                       // tasa diaria = mensual / 30
  // Cuota fija: siempre usa tasa mensual completa (30 días), nunca días del calendario
  const diasParaCalculo = tipoPago === "cuota_fija" ? 30 : diasTranscurridos;
  const interesEsperado = parseFloat(
    (saldoActualPrestamo * tasaDiaria * diasParaCalculo).toFixed(2)
  );
  const interesBase30 = parseFloat((saldoActualPrestamo * tasaMensual).toFixed(2)); // referencia mes completo

  const montoPagoIngresado = parseFloat(form.monto) || 0;
  const montoNetoPago = Math.max(0, montoPagoIngresado - moraAplicable);
  const interesDelPago = parseFloat(Math.min(montoNetoPago, interesEsperado).toFixed(2));
  const capitalDelPago = parseFloat(Math.max(0, montoNetoPago - interesEsperado).toFixed(2));
  const hayDesglose = prestamoSeleccionado && montoPagoIngresado > 0;

  return (
    <div
      className="modal show d-block"
      tabIndex="-1"
      style={{
        background: "rgba(0,0,0,0.65)",
        backdropFilter: "blur(4px)",
        zIndex: 5000,
        position: "fixed",
        top: 0, left: 0,
        width: "100vw", height: "100vh",
        overflowY: "auto",
      }}
    >
      <div
        className="modal-dialog modal-dialog-centered"
        style={{ maxWidth: 760 }}
        onClick={(e) => e.stopPropagation()}
      >
        <form
          className="modal-content border-0 shadow-lg"
          onSubmit={onSubmit}
          style={{ borderRadius: "16px", overflow: "hidden" }}
        >
          {/* ── Header ── */}
          <div
            className="d-flex align-items-center justify-content-between text-white px-4 py-3"
            style={{ background: "linear-gradient(135deg,#3498db 0%,#2980b9 100%)" }}
          >
            <div className="d-flex align-items-center gap-2">
              <FaMoneyBillWave style={{ fontSize: 18 }} />
              <span className="fw-bold" style={{ fontSize: "1rem" }}>
                {editPago ? "Editar Pago" : "Registrar Pago"}
              </span>
            </div>
            <button type="button" className="btn-close btn-close-white btn-sm" onClick={onClose} />
          </div>

          {/* ── Body: 2 columnas ── */}
          <div className="modal-body p-0" style={{ background: "#f8fafc" }}>
            {reporte && (
              <div className="m-3 mb-0 p-3 small" style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: 12 }}>
                <div className="fw-bold mb-1" style={{ color: "#065f46" }}>Pago reportado por el socio</div>
                L. {fmt(reporte.monto)} por {String(reporte.metodo).toLowerCase()}
                {reporte.banco ? ` · ${reporte.banco}` : ""}
                {reporte.referencia ? ` · Ref. ${reporte.referencia}` : ""} · {String(reporte.fecha_pago).substring(0, 10)}
                {onVerComprobante && (
                  <button type="button" className="btn btn-link btn-sm p-0 ms-2 align-baseline" onClick={onVerComprobante}>
                    Ver comprobante
                  </button>
                )}
                <div className="text-muted mt-1">
                  Revisa que el depósito esté en la cuenta. Al registrar el pago, el reporte queda confirmado y el socio
                  recibe su recibo.
                </div>
              </div>
            )}
            <div className="row g-0">

              {/* Columna izquierda — formulario */}
              <div className="col-lg-7 p-3 d-flex flex-column gap-3" style={{ borderRight: "1px solid #e2e8f0" }}>

                {/* ── Tipo de Pago ── */}
                <div>
                  <label className="form-label fw-semibold small mb-1" style={{ color: "#2c3e50" }}>
                    🏷️ Tipo de Pago
                  </label>
                  <div className="d-flex gap-2 flex-wrap">
                    {[
                      { value: "cuota_fija", icon: "💰", label: "Cuota Fija",     color: "#3498db", desc: "Cuota mensual acordada" },
                      { value: "desglose",   icon: "📊", label: "Desglose Total", color: "#27ae60", desc: "Liquida saldo + interés exacto por días" },
                      { value: "indefinido", icon: "♾️", label: "Pago Libre",     color: "#e67e22", desc: "Monto personalizado" },
                    ].map(({ value, icon, label, color, desc }) => {
                      const sel = tipoPago === value;
                      const esIndef = parseInt(prestamoSeleccionado?.plazo_meses) === 0;
                      const disabled = value === "indefinido" && !!prestamoSeleccionado && !esIndef;
                      return (
                        <button
                          key={value}
                          type="button"
                          disabled={disabled}
                          title={desc}
                          onClick={() => !disabled && setTipoPago(value)}
                          style={{
                            flex: "1 1 100px",
                            padding: "6px 8px",
                            borderRadius: 10,
                            border: `2px solid ${sel ? color : disabled ? "#e9ecef" : "#dee2e6"}`,
                            background: sel ? color + "18" : disabled ? "#f8f9fa" : "white",
                            color: sel ? color : disabled ? "#adb5bd" : "#495057",
                            fontWeight: sel ? 700 : 500,
                            fontSize: "0.75rem",
                            cursor: disabled ? "not-allowed" : "pointer",
                            transition: "all .15s",
                            textAlign: "center",
                            lineHeight: 1.3,
                          }}
                        >
                          <div>{icon} {label}</div>
                          {sel && <div style={{ fontSize: "0.65rem", opacity: 0.75, marginTop: 1 }}>{desc}</div>}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Préstamo — dropdown con búsqueda */}
                <div style={{ position: "relative" }}>
                  <label className="form-label fw-semibold small mb-1" style={{ color: "#2c3e50" }}>
                    <FaFileInvoiceDollar className="me-1" style={{ color: "#3498db" }} /> Préstamo
                  </label>

                  {/* Campo que muestra el préstamo elegido y abre el dropdown */}
                  <div
                    onClick={() => { setDropdownAbierto((v) => !v); setBusquedaPrestamo(""); }}
                    style={{
                      borderRadius: 8,
                      border: "1.5px solid #e2e8f0",
                      fontSize: "0.85rem",
                      padding: "6px 10px",
                      background: "white",
                      cursor: "pointer",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      userSelect: "none",
                      color: prestamoSeleccionado ? "#2c3e50" : "#94a3b8",
                    }}
                  >
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {prestamoSeleccionado
                        ? `#${prestamoSeleccionado.id_prestamo} · ${
                            usuarios.find((u) => u.id_usuario === prestamoSeleccionado.id_usuario)?.nombre_completo || "N/A"
                          } · L.${fmt(prestamoSeleccionado.saldo_restante)}`
                        : "Seleccionar préstamo..."}
                    </span>
                    <span style={{ fontSize: "0.7rem", color: "#94a3b8", flexShrink: 0, marginLeft: 6 }}>{dropdownAbierto ? "▲" : "▼"}</span>
                  </div>

                  {/* input hidden para required */}
                  <input type="hidden" name="id_prestamo" value={form.id_prestamo} required />

                  {/* Panel desplegable */}
                  {dropdownAbierto && (
                    <>
                    {/* Backdrop para cerrar al hacer clic afuera */}
                    <div
                      style={{ position: "fixed", inset: 0, zIndex: 9998 }}
                      onClick={() => setDropdownAbierto(false)}
                    />
                    <div
                      style={{
                        position: "absolute",
                        top: "100%",
                        left: 0,
                        right: 0,
                        zIndex: 9999,
                        background: "white",
                        border: "1.5px solid #e2e8f0",
                        borderRadius: 8,
                        boxShadow: "0 8px 24px rgba(0,0,0,0.13)",
                        marginTop: 2,
                        overflow: "hidden",
                      }}
                    >
                      {/* Input de búsqueda */}
                      <div style={{ padding: "8px 8px 4px" }}>
                        <input
                          autoFocus
                          type="text"
                          className="form-control form-control-sm"
                          placeholder="🔍 Buscar por nombre o #..."
                          value={busquedaPrestamo}
                          onChange={(e) => setBusquedaPrestamo(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          style={{ borderRadius: 6, fontSize: "0.82rem" }}
                        />
                      </div>

                      {/* Lista filtrada */}
                      <div style={{ maxHeight: 200, overflowY: "auto" }}>
                        {/* Opción vacía */}
                        <div
                          onClick={() => {
                            handleInput({ target: { name: "id_prestamo", value: "" } });
                            setDropdownAbierto(false);
                          }}
                          style={{
                            padding: "7px 12px",
                            fontSize: "0.82rem",
                            color: "#94a3b8",
                            cursor: "pointer",
                            borderBottom: "1px solid #f1f5f9",
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "white")}
                        >
                          — Seleccionar préstamo —
                        </div>

                        {prestamos
                          .filter((pr) => {
                            if (!busquedaPrestamo) return true;
                            const u = usuarios.find((u) => u.id_usuario === pr.id_usuario);
                            const texto = `${pr.id_prestamo} ${u?.nombre_completo || ""}`.toLowerCase();
                            return texto.includes(busquedaPrestamo.toLowerCase());
                          })
                          .map((pr) => {
                            const u = usuarios.find((u) => u.id_usuario === pr.id_usuario);
                            const seleccionado = parseInt(form.id_prestamo) === pr.id_prestamo;
                            return (
                              <div
                                key={pr.id_prestamo}
                                onClick={() => {
                                  handleInput({ target: { name: "id_prestamo", value: String(pr.id_prestamo) } });
                                  setDropdownAbierto(false);
                                  setBusquedaPrestamo("");
                                }}
                                style={{
                                  padding: "8px 12px",
                                  fontSize: "0.82rem",
                                  cursor: "pointer",
                                  background: seleccionado ? "rgba(52,152,219,0.09)" : "white",
                                  borderLeft: seleccionado ? "3px solid #3498db" : "3px solid transparent",
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                  gap: 8,
                                }}
                                onMouseEnter={(e) => { if (!seleccionado) e.currentTarget.style.background = "#f8fafc"; }}
                                onMouseLeave={(e) => { if (!seleccionado) e.currentTarget.style.background = "white"; }}
                              >
                                <span>
                                  <span style={{ fontWeight: 600, color: "#3498db" }}>#{pr.id_prestamo}</span>
                                  {" · "}
                                  <span style={{ color: "#2c3e50" }}>{u?.nombre_completo || "N/A"}</span>
                                </span>
                                <span style={{ color: "#e74c3c", fontWeight: 600, whiteSpace: "nowrap", fontSize: "0.78rem" }}>
                                  L.{fmt(pr.saldo_restante)}
                                </span>
                              </div>
                            );
                          })}

                        {prestamos.filter((pr) => {
                          if (!busquedaPrestamo) return true;
                          const u = usuarios.find((u) => u.id_usuario === pr.id_usuario);
                          const texto = `${pr.id_prestamo} ${u?.nombre_completo || ""}`.toLowerCase();
                          return texto.includes(busquedaPrestamo.toLowerCase());
                        }).length === 0 && (
                          <div style={{ padding: "10px 12px", fontSize: "0.82rem", color: "#94a3b8", textAlign: "center" }}>
                            Sin resultados para "{busquedaPrestamo}"
                          </div>
                        )}
                      </div>
                    </div>
                    </>
                  )}
                </div>

                {/* Info compacta del préstamo */}
                {prestamoSeleccionado && (
                    <div className="mt-2 px-2 py-1 d-flex flex-wrap gap-2 small"
                      style={{ background: "rgba(52,152,219,0.07)", borderRadius: 8, border: "1px solid rgba(52,152,219,0.2)" }}>
                      <span><strong>{usuarioSeleccionado?.nombre_completo}</strong></span>
                      <span className="text-muted">·</span>
                      <span>Préstamo: <strong>L. {fmt(prestamoSeleccionado.monto)}</strong></span>
                      <span className="text-muted">·</span>
                      <span>Saldo: <strong style={{ color: "#e74c3c" }}>L. {fmt(prestamoSeleccionado.saldo_restante)}</strong></span>
                      <span className="text-muted">·</span>
                      <span className="badge" style={{
                        background: prestamoSeleccionado.estado === "activo" ? "rgba(39,174,96,0.15)" : "rgba(149,165,166,0.15)",
                        color: prestamoSeleccionado.estado === "activo" ? "#27ae60" : "#95a5a6",
                        fontSize: "0.72rem",
                      }}>{prestamoSeleccionado.estado}</span>
                      {esIndefinido && (
                        <span style={{ color: "#e67e22", fontSize: "0.72rem" }}>♾ Indefinido · base 30d: L.{fmt(interesBase30)}</span>
                      )}
                    </div>
                  )}

                {/* Monto + Fecha en fila */}
                <div className="row g-2">
                  <div className="col-7">
                    <label className="form-label fw-semibold small mb-1" style={{ color: "#2c3e50" }}>
                      <FaMoneyBillWave className="me-1" style={{ color: "#27ae60" }} /> Monto (L.)
                    </label>
                    <div className="input-group input-group-sm">
                      <span className="input-group-text fw-bold"
                        style={{ background: "#27ae60", color: "#fff", border: "1.5px solid #27ae60", borderRight: "none" }}>L.</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        className="form-control"
                        name="monto"
                        value={montoDisplay}
                        onChange={handleMontoChange}
                        required
                        placeholder="0.00"
                        style={{ borderRadius: "0 6px 6px 0", border: "1.5px solid #e2e8f0", borderLeft: "none" }}
                      />
                    </div>
                  </div>
                  <div className="col-5">
                    <label className="form-label fw-semibold small mb-1" style={{ color: "#2c3e50" }}>
                      <FaCalendarAlt className="me-1" style={{ color: "#3498db" }} /> Fecha
                    </label>
                    <input
                      type="date"
                      className="form-control form-control-sm"
                      name="fecha"
                      value={form.fecha}
                      onChange={handleInput}
                      required
                      style={{ borderRadius: 8, border: "1.5px solid #e2e8f0" }}
                    />
                  </div>
                </div>

                {/* Método de pago — píldoras compactas */}
                <div>
                  <label className="form-label fw-semibold small mb-1" style={{ color: "#2c3e50" }}>
                    <FaMoneyCheckAlt className="me-1" style={{ color: "#27ae60" }} /> Método de Pago
                  </label>
                  <div className="d-flex flex-wrap gap-1">
                    {[
                      { value: "Efectivo",          icon: "💵", color: "#27ae60" },
                      { value: "Transferencia",     icon: "🏦", color: "#3498db" },
                      { value: "Cheque",            icon: "📋", color: "#9b59b6" },
                      { value: "Deposito",          icon: "🏧", color: "#e67e22" },
                      { value: "Tarjeta de débito", icon: "💳", color: "#e74c3c" },
                      { value: "Pago móvil",        icon: "📱", color: "#1abc9c" },
                    ].map(({ value, icon, color }) => {
                      const sel = form.metodo_pago === value;
                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => handleInput({ target: { name: "metodo_pago", value } })}
                          style={{
                            padding: "4px 10px",
                            borderRadius: 20,
                            border: `1.5px solid ${sel ? color : "#e2e8f0"}`,
                            background: sel ? color + "18" : "white",
                            color: sel ? color : "#64748b",
                            fontWeight: sel ? 700 : 500,
                            fontSize: "0.75rem",
                            cursor: "pointer",
                            transition: "all .15s",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {icon} {value} {sel && "✓"}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Descripción */}
                <div>
                  <label className="form-label fw-semibold small mb-1" style={{ color: "#2c3e50" }}>
                    Descripción <span style={{ color: "#94a3b8", fontWeight: 400 }}>(opcional)</span>
                  </label>
                  <textarea
                    className="form-control form-control-sm"
                    name="descripcion"
                    value={form.descripcion}
                    onChange={handleInput}
                    rows="2"
                    maxLength="200"
                    placeholder="Ej: Pago cuota mensual, abono adelantado…"
                    style={{ borderRadius: 8, border: "1.5px solid #e2e8f0", resize: "none" }}
                  />
                </div>
              </div>

              {/* Columna derecha — desglose */}
              <div className="col-lg-5 p-3 d-flex flex-column gap-2" style={{ background: "#edf2f7" }}>
                <div className="d-flex align-items-center justify-content-between mb-1">
                  <div className="fw-bold small" style={{ color: "#2c3e50" }}>📊 Desglose del pago</div>
                  {prestamoSeleccionado && (
                    <span style={{
                      fontSize: "0.68rem", fontWeight: 700, padding: "2px 8px", borderRadius: 8,
                      background: tipoPago === "cuota_fija" ? "rgba(52,152,219,0.12)" : tipoPago === "desglose" ? "rgba(39,174,96,0.12)" : "rgba(230,126,34,0.12)",
                      color: tipoPago === "cuota_fija" ? "#2980b9" : tipoPago === "desglose" ? "#1e8449" : "#d35400",
                      border: `1.5px solid ${tipoPago === "cuota_fija" ? "#3498db" : tipoPago === "desglose" ? "#27ae60" : "#e67e22"}`,
                    }}>
                      {tipoPago === "cuota_fija" ? "💰 Cuota Fija" : tipoPago === "desglose" ? "📊 Desglose" : "♾️ Pago Libre"}
                    </span>
                  )}
                </div>

                {prestamoSeleccionado ? (
                  <>
                    {/* ── Nota visual del tipo seleccionado ── */}
                    {tipoPago === "cuota_fija" && (
                      <div className="d-flex justify-content-between align-items-center small px-2 py-1"
                        style={{ background: "rgba(52,152,219,0.08)", borderRadius: 7, border: "1.5px solid #3498db" }}>
                        <span style={{ color: "#2980b9", fontWeight: 600 }}>💰 Cuota mensual:</span>
                        <strong style={{ color: "#2980b9" }}>L. {fmt(prestamoSeleccionado.cuota_mensual)}</strong>
                      </div>
                    )}
                    {tipoPago === "desglose" && (
                      <div className="small px-2 py-1"
                        style={{ background: "rgba(39,174,96,0.08)", borderRadius: 7, border: "1.5px solid #27ae60", color: "#1e8449", fontWeight: 600 }}>
                        📊 Liquidación total: saldo + interés por días exactos
                      </div>
                    )}
                    {tipoPago === "indefinido" && (
                      <div className="small px-2 py-1"
                        style={{ background: "rgba(230,126,34,0.08)", borderRadius: 7, border: "1.5px solid #e67e22", color: "#d35400", fontWeight: 600 }}>
                        ♾️ Pago libre — ingresa el monto a abonar
                      </div>
                    )}
                    {/* ── Mora ── */}
                    {moraInfo && (
                      <div className="small px-2 py-2"
                        style={{ background: "rgba(231,76,60,0.08)", borderRadius: 8, border: "1.5px solid #e74c3c", color: "#c0392b" }}>
                        <div className="fw-bold">
                          ⚠ {moraInfo.dias} día(s) de mora — Mora generada: L. {fmt(moraInfo.mora)}
                          {moraInfo.porDia > 0 && <span className="fw-normal"> (≈ L. {fmt(moraInfo.porDia)} por día)</span>}
                        </div>
                        {esSuperAdmin ? (
                          <div className="form-check mt-1">
                            <input
                              id="chk-condonar-mora"
                              type="checkbox"
                              className="form-check-input"
                              checked={condonarMora}
                              onChange={(e) =>
                                handleInput({ target: { name: "condonar_mora", value: e.target.checked } })
                              }
                            />
                            <label className="form-check-label fw-semibold" htmlFor="chk-condonar-mora">
                              Omitir mora (cobrar normal, como si no hubiera mora)
                            </label>
                          </div>
                        ) : (
                          <div style={{ color: "#7f8c8d" }}>La mora se suma al pago. Solo el Super Administrador puede omitirla.</div>
                        )}
                        {condonarMora && (
                          <div className="fw-semibold mt-1" style={{ color: "#27ae60" }}>
                            ✔ La mora no se cobrará en este pago.
                          </div>
                        )}
                      </div>
                    )}
                    {/* ── Período del préstamo: distinto según tipo de pago ── */}
                    {tipoPago === "cuota_fija" ? (
                      /* Cuota fija: período estándar 30 días, sin selector de fecha */
                      <div style={{ background: "rgba(52,152,219,0.07)", border: "1px solid #d6eaf8", borderRadius: 10, padding: "10px 12px" }}>
                        <div className="fw-semibold mb-2" style={{ fontSize: "0.72rem", color: "#2980b9" }}>
                          <FaCalendarAlt className="me-1" /> Período estándar
                        </div>
                        <div className="d-flex justify-content-between align-items-center mb-1">
                          <span style={{ fontSize: "0.75rem", color: "#64748b" }}>Ciclo mensual fijo:</span>
                          <span className="badge" style={{ background: "rgba(52,152,219,0.13)", color: "#2980b9", border: "1.5px solid #3498db", borderRadius: 8, fontSize: 12, fontWeight: 700, padding: "4px 12px" }}>
                            <FaClock className="me-1" style={{ fontSize: 10 }} />30 días
                          </span>
                        </div>
                        <div className="d-flex justify-content-between align-items-center">
                          <span style={{ fontSize: "0.75rem", color: "#64748b" }}>Tasa mensual:</span>
                          <strong style={{ fontSize: "0.82rem", color: "#2980b9" }}>{(tasaMensual * 100).toFixed(4)}%</strong>
                        </div>
                      </div>
                    ) : (
                      /* Desglose / Libre: período con fechas editables */
                      <div style={{ background: "rgba(52,152,219,0.07)", border: "1px solid #d6eaf8", borderRadius: 10, padding: "10px 12px" }}>
                        <div className="fw-semibold mb-2" style={{ fontSize: "0.72rem", color: "#2980b9" }}>
                          <FaCalendarAlt className="me-1" /> Período del préstamo
                        </div>
                        <label style={{ fontSize: "0.7rem", color: "#64748b", display: "block", marginBottom: 3 }}>
                          Inicio del período
                        </label>
                        <input
                          type="date"
                          className="form-control form-control-sm mb-2"
                          value={fechaReferencia}
                          onChange={(e) => setFechaReferencia(e.target.value)}
                          style={{ borderRadius: 6, border: "1.5px solid #cbd5e1", fontSize: "0.8rem" }}
                        />
                        <div className="d-flex align-items-center justify-content-between gap-1 flex-wrap">
                          <span className="badge" style={{ background: "rgba(155,89,182,0.12)", color: "#8e44ad", border: "1.5px solid #9b59b6", borderRadius: 7, fontSize: 11, fontWeight: 700, padding: "4px 8px" }}>
                            📅 {fechaReferencia || "—"}
                          </span>
                          <span style={{ color: "#94a3b8", fontSize: 13, fontWeight: 700 }}>→</span>
                          <span className="badge" style={{ background: "rgba(155,89,182,0.12)", color: "#8e44ad", border: "1.5px solid #9b59b6", borderRadius: 7, fontSize: 11, fontWeight: 700, padding: "4px 8px" }}>
                            📅 {form.fecha || "—"}
                          </span>
                        </div>
                        <div className="d-flex justify-content-center mt-2">
                          <span className="badge" style={{ background: "rgba(52,152,219,0.13)", color: "#2980b9", border: "1.5px solid #3498db", borderRadius: 8, fontSize: 12, fontWeight: 700, padding: "5px 14px" }}>
                            <FaClock className="me-1" style={{ fontSize: 11 }} />
                            {diasTranscurridos} día{diasTranscurridos !== 1 ? "s" : ""}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* ── Saldo actual ── */}
                    <div className="d-flex justify-content-between align-items-center small px-2 py-1"
                      style={{ background: "white", borderRadius: 7, border: "1px solid #e2e8f0" }}>
                      <span style={{ color: "#7f8c8d" }}>Saldo actual:</span>
                      <strong style={{ color: "#e74c3c" }}>L. {fmt(saldoActualPrestamo)}</strong>
                    </div>

                    {/* ── Interés generado ── */}
                    <div className="d-flex justify-content-between align-items-center small px-2 py-1"
                      style={{ background: "rgba(230,126,34,0.08)", borderRadius: 7, border: "1.5px solid #e67e22" }}>
                      <span style={{ color: "#d35400", fontWeight: 600 }}>
                        Interés {tipoPago === "cuota_fija" ? "(mensual)" : `(${diasTranscurridos}d)`}:
                      </span>
                      <strong style={{ color: "#d35400", fontSize: "0.9rem" }}>
                        + L. {fmt(interesEsperado)}
                      </strong>
                    </div>

                    {/* Referencia 30 días — solo para desglose con días ≠ 30 */}
                    {tipoPago !== "cuota_fija" && diasTranscurridos !== 30 && (
                      <div className="d-flex justify-content-between small" style={{ color: "#94a3b8", paddingLeft: 4 }}>
                        <span>(30 días serían):</span>
                        <span>L. {fmt(interesBase30)}</span>
                      </div>
                    )}

                    {/* ── Total a pagar ── */}
                    {tipoPago === "cuota_fija" ? (
                      /* Cuota fija: el total ES la cuota acordada */
                      <div className="d-flex justify-content-between align-items-center px-2 py-2 fw-bold"
                        style={{ background: "rgba(52,152,219,0.1)", borderRadius: 8, border: "2px solid #3498db" }}>
                        <span style={{ color: "#2980b9", fontSize: "0.82rem" }}>
                          💰 Cuota acordada:
                        </span>
                        <strong style={{ color: "#2980b9", fontSize: "1rem" }}>
                          L. {fmt((prestamoSeleccionado.cuota_mensual || 0) + moraAplicable)}
                        </strong>
                      </div>
                    ) : (
                      /* Desglose / libre: total = saldo + interés */
                      <div className="d-flex justify-content-between align-items-center px-2 py-2 fw-bold"
                        style={{ background: "rgba(39,174,96,0.1)", borderRadius: 8, border: "2px solid #27ae60" }}>
                        <span style={{ color: "#1e8449", fontSize: "0.82rem" }}>
                          💰 Total a pagar ({diasTranscurridos}d):
                        </span>
                        <strong style={{ color: "#1e8449", fontSize: "1rem" }}>
                          L. {fmt(saldoActualPrestamo + interesEsperado + moraAplicable)}
                        </strong>
                      </div>
                    )}

                    <hr className="my-0" style={{ borderColor: "#cbd5e1" }} />

                    {/* ── Desglose del monto ingresado ── */}
                    {montoPagoIngresado > 0 && (
                      <>
                        <div className="d-flex justify-content-between small">
                          <span style={{ color: "#7f8c8d" }}>De ese monto — Interés:</span>
                          <strong style={{ color: "#e67e22" }}>L. {fmt(interesDelPago)}</strong>
                        </div>
                        <div className="d-flex justify-content-between small">
                          <span style={{ color: "#7f8c8d" }}>Abono a capital:</span>
                          <strong style={{ color: capitalDelPago > 0 ? "#27ae60" : "#94a3b8" }}>
                            L. {fmt(capitalDelPago)}
                          </strong>
                        </div>

                        {/* Barra interés / capital */}
                        <div>
                          <div style={{ height: 7, borderRadius: 4, background: "#e2e8f0", overflow: "hidden" }}>
                            <div style={{
                              height: "100%", borderRadius: 4,
                              width: `${Math.min(100, (interesDelPago / montoPagoIngresado) * 100).toFixed(1)}%`,
                              background: "linear-gradient(90deg,#e67e22,#f39c12)",
                              transition: "width .35s",
                            }} />
                          </div>
                          <div className="d-flex justify-content-between" style={{ fontSize: "0.68rem", color: "#aaa", marginTop: 2 }}>
                            <span>🟠 Interés</span>
                            <span>🟢 Capital</span>
                          </div>
                        </div>

                        {/* Nuevo saldo */}
                        {capitalDelPago > 0 && (
                          <div className="small px-2 py-1 fw-semibold"
                            style={{ background: "rgba(39,174,96,0.1)", borderRadius: 6, color: "#27ae60", border: "1px solid #27ae60" }}>
                            ✔ Nuevo saldo estimado: <strong>L. {fmt(Math.max(0, saldoActualPrestamo - capitalDelPago))}</strong>
                          </div>
                        )}

                        {/* Aviso si monto < interés */}
                        {montoPagoIngresado < interesEsperado && (
                          <div className="small px-2 py-1"
                            style={{ background: "rgba(231,76,60,0.08)", borderRadius: 6, color: "#e74c3c", border: "1px solid #e74c3c" }}>
                            ⚠ Monto menor al interés generado (L. {fmt(interesEsperado)})
                          </div>
                        )}
                      </>
                    )}

                    {!montoPagoIngresado && (
                      <div className="small text-center text-muted mt-1" style={{ opacity: 0.6 }}>
                        Ingresa un monto para ver el desglose
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-4 text-muted small" style={{ opacity: 0.5 }}>
                    <FaMoneyCheckAlt size={28} className="mb-2 d-block mx-auto" />
                    Selecciona un préstamo
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Footer ── */}
          <div className="modal-footer border-0 bg-white px-3 py-2 gap-2">
            <button
              type="submit"
              className="btn btn-sm shadow-sm fw-semibold"
              style={{
                background: "linear-gradient(135deg,#3498db,#2980b9)",
                color: "white", border: "none",
                borderRadius: 8, padding: "7px 22px",
              }}
            >
              <FaMoneyCheckAlt className="me-1" />
              {editPago ? "Guardar Cambios" : "Registrar Pago"}
            </button>
            <button
              type="button"
              className="btn btn-sm btn-light shadow-sm fw-semibold"
              onClick={onClose}
              style={{ borderRadius: 8, padding: "7px 18px" }}
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
