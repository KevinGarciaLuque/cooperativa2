import { useState } from "react";
import { FaMoneyBillWave, FaCheckCircle, FaTimesCircle, FaCalendarAlt, FaPercentage, FaClock, FaUserTie } from "react-icons/fa";
import { TIPOS_TASA, calcularTasaAnual, calcularCuotaSimulador } from "./helpers";

// ==================== COMPONENTE MODAL PRÉSTAMO ====================
export default function ModalPrestamo({
  show,
  editPrestamo,
  form,
  usuarios,
  onClose,
  onSubmit,
  handleInput,
  submitting = false,
}) {
  // ── Hooks antes del early return (regla de React) ──
  const [busquedaSocio, setBusquedaSocio] = useState("");
  const [dropdownSocioAbierto, setDropdownSocioAbierto] = useState(false);
  const [montoDisplay, setMontoDisplay] = useState(() => {
    if (!form.monto && form.monto !== 0) return "";
    const parts = String(form.monto).split(".");
    return parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (parts[1] !== undefined ? "." + parts[1] : "");
  });

  const handleMontoChange = (e) => {
    const raw = e.target.value.replace(/,/g, "");
    if (raw !== "" && !/^\d*\.?\d*$/.test(raw)) return;
    const parts = raw.split(".");
    const display = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (parts.length > 1 ? "." + parts[1] : "");
    setMontoDisplay(display);
    handleInput({ target: { name: "monto", value: raw } });
  };

  if (!show) return null;

  const tipoTasaInfo = TIPOS_TASA.find((t) => t.value === (form.tipo_tasa || "nominal_anual"));
  const tasaAnualEquiv = calcularTasaAnual(form.tasa_interes, form.tipo_tasa || "nominal_anual");
  const tasaMensualEquiv = tasaAnualEquiv / 12;
  const esIndefinido = parseInt(form.plazo_meses) === 0;
  const cuotaSimulada = calcularCuotaSimulador(
    parseFloat(form.monto) || 0,
    tasaAnualEquiv,
    esIndefinido ? 0 : (parseInt(form.plazo_meses) || 0)
  );
  const totalPagar = esIndefinido ? 0 : cuotaSimulada * (parseInt(form.plazo_meses) || 0);
  const totalIntereses = esIndefinido ? 0 : totalPagar - (parseFloat(form.monto) || 0);
  const haySimulacion = form.monto && form.tasa_interes && (esIndefinido || form.plazo_meses) && cuotaSimulada > 0;

  const fmt = (n) =>
    parseFloat(n || 0).toLocaleString("es-HN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <>
      <div
        className="modal show"
        tabIndex="-1"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "rgba(0,0,0,0.65)",
          backdropFilter: "blur(5px)",
          zIndex: 5000,
          position: "fixed",
          top: 0, left: 0,
          width: "100%", height: "100%",
          overflow: "hidden",
          paddingTop: "max(1rem, env(safe-area-inset-top))",
          paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
          paddingLeft: "env(safe-area-inset-left, 0px)",
          paddingRight: "env(safe-area-inset-right, 0px)",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{ width: "100%", maxWidth: 760, maxHeight: "100%", display: "flex", flexDirection: "column" }}
          onClick={(e) => e.stopPropagation()}
        >
          <form
            className="modal-content border-0 shadow-lg"
            onSubmit={onSubmit}
            style={{ borderRadius: "16px", overflow: "hidden", maxHeight: "100%" }}
          >
            {/* ── Header ── */}
            <div
              className="d-flex align-items-center justify-content-between text-white px-4 py-3"
              style={{ background: "linear-gradient(135deg,#27ae60 0%,#1a7a40 100%)" }}
            >
              <div className="d-flex align-items-center gap-2">
                <FaMoneyBillWave style={{ fontSize: 18 }} />
                <div>
                  <span className="fw-bold" style={{ fontSize: "1rem" }}>
                    {editPrestamo ? "Editar Préstamo" : "Nuevo Préstamo"}
                  </span>
                  <div style={{ fontSize: ".75rem", opacity: .8 }}>Sistema francés · tasa mensual (TNM)</div>
                </div>
              </div>
              <button type="button" className="btn-close btn-close-white btn-sm" onClick={onClose} />
            </div>

            {/* ── Body ── */}
            <div className="modal-body p-0" style={{ background: "#f8fafc", overflowY: "auto" }}>
              <div className="row g-0">

                {/* Columna izquierda – formulario */}
                <div className="col-lg-7 p-3 d-flex flex-column gap-2" style={{ borderRight: "1px solid #e2e8f0" }}>

                  {/* Socio */}
                  <div>
                    <label className="form-label fw-semibold small" style={{ color: "#2c3e50" }}>
                      <FaUserTie className="me-1 text-success" /> Socio
                    </label>

                    {editPrestamo !== null ? (
                      /* En edición: solo mostrar el nombre, no se puede cambiar */
                      <div style={{ border: "2px solid #e2e8f0", borderRadius: 8, padding: "10px 14px", background: "#e9ecef", fontSize: "0.9rem", color: "#2c3e50" }}>
                        {usuarios.find((u) => u.id_usuario === parseInt(form.id_usuario))?.nombre_completo || "—"}
                      </div>
                    ) : (
                      /* En creación: dropdown buscable */
                      <div style={{ position: "relative" }}>
                        <div
                          onClick={() => { setDropdownSocioAbierto((v) => !v); setBusquedaSocio(""); }}
                          style={{
                            border: "2px solid #e2e8f0", borderRadius: 8,
                            padding: "10px 14px", background: "white",
                            cursor: "pointer", display: "flex",
                            justifyContent: "space-between", alignItems: "center",
                            userSelect: "none", fontSize: "0.9rem",
                            color: form.id_usuario ? "#2c3e50" : "#94a3b8",
                          }}
                        >
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {form.id_usuario
                              ? (() => { const u = usuarios.find((u) => u.id_usuario === parseInt(form.id_usuario)); return u ? `${u.nombre_completo} — ${u.dni}` : "Seleccionar socio..."; })()
                              : "Seleccionar socio..."}
                          </span>
                          <span style={{ fontSize: "0.7rem", color: "#94a3b8", flexShrink: 0, marginLeft: 8 }}>{dropdownSocioAbierto ? "▲" : "▼"}</span>
                        </div>
                        <input type="hidden" name="id_usuario" value={form.id_usuario} required />

                        {dropdownSocioAbierto && (
                          <>
                            <div style={{ position: "fixed", inset: 0, zIndex: 5998 }} onClick={() => setDropdownSocioAbierto(false)} />
                            <div style={{
                              position: "absolute", top: "100%", left: 0, right: 0,
                              zIndex: 5999, background: "white",
                              border: "2px solid #e2e8f0", borderRadius: 8,
                              boxShadow: "0 8px 24px rgba(0,0,0,0.13)",
                              marginTop: 2, overflow: "hidden",
                            }}>
                              <div style={{ padding: "8px 8px 4px" }}>
                                <input
                                  autoFocus
                                  type="text"
                                  className="form-control form-control-sm"
                                  placeholder="🔍 Buscar por nombre o DNI..."
                                  value={busquedaSocio}
                                  onChange={(e) => setBusquedaSocio(e.target.value)}
                                  onClick={(e) => e.stopPropagation()}
                                  style={{ borderRadius: 6, fontSize: "0.82rem" }}
                                />
                              </div>
                              <div style={{ maxHeight: 200, overflowY: "auto" }}>
                                <div
                                  onClick={() => { handleInput({ target: { name: "id_usuario", value: "" } }); setDropdownSocioAbierto(false); }}
                                  style={{ padding: "7px 12px", fontSize: "0.82rem", color: "#94a3b8", cursor: "pointer", borderBottom: "1px solid #f1f5f9" }}
                                  onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
                                  onMouseLeave={(e) => (e.currentTarget.style.background = "white")}
                                >
                                  — Seleccionar socio —
                                </div>
                                {usuarios
                                  .filter((u) => {
                                    if (!busquedaSocio) return true;
                                    return `${u.nombre_completo} ${u.dni}`.toLowerCase().includes(busquedaSocio.toLowerCase());
                                  })
                                  .map((u) => {
                                    const sel = parseInt(form.id_usuario) === u.id_usuario;
                                    return (
                                      <div
                                        key={u.id_usuario}
                                        onClick={() => { handleInput({ target: { name: "id_usuario", value: String(u.id_usuario) } }); setDropdownSocioAbierto(false); setBusquedaSocio(""); }}
                                        style={{
                                          padding: "8px 12px", fontSize: "0.82rem", cursor: "pointer",
                                          background: sel ? "rgba(39,174,96,0.09)" : "white",
                                          borderLeft: sel ? "3px solid #27ae60" : "3px solid transparent",
                                          display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8,
                                        }}
                                        onMouseEnter={(e) => { if (!sel) e.currentTarget.style.background = "#f8fafc"; }}
                                        onMouseLeave={(e) => { if (!sel) e.currentTarget.style.background = "white"; }}
                                      >
                                        <span style={{ fontWeight: sel ? 700 : 400, color: sel ? "#27ae60" : "#2c3e50" }}>{u.nombre_completo}</span>
                                        <span style={{ color: "#94a3b8", fontSize: "0.78rem", whiteSpace: "nowrap" }}>{u.dni}</span>
                                      </div>
                                    );
                                  })}
                                {usuarios.filter((u) => {
                                  if (!busquedaSocio) return true;
                                  return `${u.nombre_completo} ${u.dni}`.toLowerCase().includes(busquedaSocio.toLowerCase());
                                }).length === 0 && (
                                  <div style={{ padding: "10px 12px", fontSize: "0.82rem", color: "#94a3b8", textAlign: "center" }}>
                                    Sin resultados para "{busquedaSocio}"
                                  </div>
                                )}
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Aviso pagos existentes al editar */}
                  {editPrestamo && parseInt(editPrestamo.total_pagos) > 0 && (
                    <div style={{ background: "#fffbeb", border: "1.5px solid #f59e0b", borderRadius: 8, padding: "8px 12px", fontSize: "0.8rem", color: "#78350f" }}>
                      ⚠️ Este préstamo tiene <strong>{editPrestamo.total_pagos} pago{parseInt(editPrestamo.total_pagos) !== 1 ? "s" : ""}</strong> registrado{parseInt(editPrestamo.total_pagos) !== 1 ? "s" : ""}. El saldo actual es <strong>L. {parseFloat(editPrestamo.saldo_restante || 0).toLocaleString("es-HN", { minimumFractionDigits: 2 })}</strong>. Cambiar la tasa solo afecta los pagos futuros.
                    </div>
                  )}

                  {/* Monto */}
                  <div>
                    <label className="form-label fw-semibold small" style={{ color: "#2c3e50" }}>
                      <FaMoneyBillWave className="me-1 text-success" /> Monto del Préstamo (L.)
                    </label>
                    <div className="input-group">
                      <span className="input-group-text fw-bold" style={{ background: "#27ae60", color: "#fff", border: "2px solid #27ae60" }}>L.</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        className="form-control rounded-end"
                        name="monto"
                        value={montoDisplay}
                        onChange={handleMontoChange}
                        required
                        placeholder="0.00"
                        style={{ border: "2px solid #e2e8f0", borderLeft: "none", padding: "6px 10px" }}
                      />
                    </div>
                  </div>

                  {/* Tipo de Tasa */}
                  <div>
                    <label className="form-label fw-semibold small d-flex align-items-center gap-1" style={{ color: "#2c3e50" }}>
                      <FaPercentage className="text-success" /> Tipo de Tasa de Interés
                      <span className="badge ms-1 px-2" style={{ background: tipoTasaInfo?.color, fontSize: ".7rem" }}>
                        {tipoTasaInfo?.abbr}
                      </span>
                    </label>
                    <div className="d-flex flex-wrap gap-1 mb-2">
                      {TIPOS_TASA.map((t) => (
                        <button
                          key={t.value}
                          type="button"
                          className={`pmt-tipo-btn ${(form.tipo_tasa || "nominal_anual") === t.value ? "selected" : ""}`}
                          style={{
                            "--tc": t.color,
                            "--tb": t.color + "18",
                            borderColor: (form.tipo_tasa || "nominal_anual") === t.value ? t.color : "#e2e8f0",
                            background: (form.tipo_tasa || "nominal_anual") === t.value ? t.color + "18" : "#f8fafc",
                          }}
                          onClick={() => handleInput({ target: { name: "tipo_tasa", value: t.value } })}
                        >
                          <span className="fw-bold" style={{ fontSize: ".78rem", color: (form.tipo_tasa || "nominal_anual") === t.value ? t.color : "#475569" }}>{t.abbr}</span>
                        </button>
                      ))}
                    </div>
                    {tipoTasaInfo && (
                      <div className="small px-2 py-1 rounded-2" style={{ background: tipoTasaInfo.color + "15", color: tipoTasaInfo.color, border: `1px solid ${tipoTasaInfo.color}30` }}>
                        ℹ {tipoTasaInfo.desc}
                      </div>
                    )}
                  </div>

                  {/* Valor de la Tasa */}
                  <div>
                    <label className="form-label fw-semibold small" style={{ color: "#2c3e50" }}>
                      Valor de la Tasa ({tipoTasaInfo?.abbr})
                    </label>
                    <div className="input-group">
                      <input
                        type="number"
                        className="form-control rounded-start"
                        name="tasa_interes"
                        value={form.tasa_interes !== "" ? parseFloat(form.tasa_interes) || "" : ""}
                        onChange={handleInput}
                        required
                        min="0.01"
                        max="100"
                        step="0.01"
                        placeholder={form.tipo_tasa === "nominal_mensual" || form.tipo_tasa === "efectiva_mensual" ? "2.00" : "24.00"}
                        style={{ border: "2px solid #e2e8f0", padding: "6px 10px" }}
                      />
                      <span className="input-group-text fw-bold" style={{ background: tipoTasaInfo?.color, color: "#fff", border: `2px solid ${tipoTasaInfo?.color}` }}>%</span>
                    </div>
                    {form.tasa_interes > 0 && (
                      <div className="d-flex gap-3 mt-1 small text-muted">
                        <span>≈ <strong>{+tasaMensualEquiv.toFixed(4)}%</strong> mensual</span>
                        <span>≈ <strong>{+tasaAnualEquiv.toFixed(4)}%</strong> anual equiv.</span>
                      </div>
                    )}
                  </div>

                  {/* Plazo y Fecha */}
                  <div className="row g-2">
                    <div className="col-6">
                      <label className="form-label fw-semibold small" style={{ color: "#2c3e50" }}>
                        <FaClock className="me-1 text-success" /> Plazo (meses)
                      </label>

                      {/* Toggle indefinido */}
                      <div className="form-check form-switch mb-2">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          id="plazo-indefinido-toggle"
                          checked={esIndefinido}
                          onChange={(e) =>
                            handleInput({ target: { name: "plazo_meses", value: e.target.checked ? "0" : "" } })
                          }
                          style={{ cursor: "pointer" }}
                        />
                        <label
                          className="form-check-label small fw-semibold"
                          htmlFor="plazo-indefinido-toggle"
                          style={{ color: esIndefinido ? "#e67e22" : "#64748b", cursor: "pointer" }}
                        >
                          ♾ Plazo indefinido (solo interés mensual)
                        </label>
                      </div>

                      <input
                        type="number"
                        className="form-control rounded-3"
                        name="plazo_meses"
                        value={esIndefinido ? "" : form.plazo_meses}
                        onChange={handleInput}
                        required={!esIndefinido}
                        disabled={esIndefinido}
                        min="1"
                        max="360"
                        step="1"
                        placeholder={esIndefinido ? "Sin plazo fijo" : "Ej: 12"}
                        list="plazo-opciones"
                        style={{
                          border: `2px solid ${esIndefinido ? "#fbd38d" : "#e2e8f0"}`,
                          padding: "6px 10px",
                          background: esIndefinido ? "#fffaf0" : "white",
                          color: esIndefinido ? "#c05621" : "#2c3e50",
                        }}
                      />
                      <datalist id="plazo-opciones">
                        {[1,2,3,6,9,12,18,24,36,48,60,72,84,96,120].map(m => (
                          <option key={m} value={m}>{m} {m === 1 ? "mes" : "meses"}{m >= 12 ? ` (${m/12} año${m/12>1?"s":""})` : ""}</option>
                        ))}
                      </datalist>
                      {esIndefinido ? (
                        <div className="small mt-1 fw-semibold" style={{ color: "#e67e22" }}>
                          ♾ Sin fecha de vencimiento — pago mensual de intereses
                        </div>
                      ) : form.plazo_meses > 0 && (
                        <div className="small text-muted mt-1">
                          {form.plazo_meses >= 12
                            ? `${Math.floor(form.plazo_meses / 12)} año${Math.floor(form.plazo_meses/12)>1?"s":""} ${form.plazo_meses % 12 > 0 ? `y ${form.plazo_meses % 12} mes${form.plazo_meses%12>1?"es":""}` : ""}`
                            : `${form.plazo_meses} mes${form.plazo_meses>1?"es":""}`}
                        </div>
                      )}
                    </div>
                    <div className="col-6">
                      <label className="form-label fw-semibold small" style={{ color: "#2c3e50" }}>
                        <FaCalendarAlt className="me-1 text-success" /> Fecha Otorgamiento
                      </label>
                      <input
                        type="date"
                        className="form-control rounded-3"
                        name="fecha_otorgado"
                        value={form.fecha_otorgado}
                        onChange={handleInput}
                        required
                        style={{ border: "2px solid #e2e8f0", padding: "6px 10px" }}
                      />
                    </div>
                  </div>

                  {/* Estado */}
                  <div>
                    <label className="form-label fw-semibold small" style={{ color: "#2c3e50" }}>
                      <FaCheckCircle className="me-1 text-success" /> Estado inicial
                    </label>
                    <select
                      className="form-select rounded-3"
                      name="estado"
                      value={form.estado}
                      onChange={handleInput}
                      required
                      style={{ border: "2px solid #e2e8f0", padding: "6px 10px" }}
                    >
                      <option value="pendiente">⏳ Pendiente de Aprobación</option>
                      <option value="aprobado">✅ Aprobado</option>
                      <option value="activo">✅ Activo</option>
                      <option value="mora">⚠️ En Mora</option>
                      <option value="pagado">✅ Pagado Completamente</option>
                      <option value="cancelado">❌ Cancelado</option>
                    </select>
                  </div>
                </div>

                {/* Columna derecha – simulador */}
                <div className="col-lg-5 p-3 d-flex flex-column gap-2"
                  style={{ background: "#edf2f7" }}>
                  <div className="fw-bold" style={{ color: "#2c3e50", fontSize: ".95rem" }}>
                    📊 Simulador de Cuotas
                  </div>

                  {haySimulacion ? (
                    <>
                      {/* Card principal */}
                      <div className="pmt-sim-card shadow-sm">
                        <div className="small mb-1" style={{ opacity: .85 }}>
                          {esIndefinido ? "Interés mensual (solo intereses)" : "Cuota mensual estimada"}
                        </div>
                        <div className="fw-bold" style={{ fontSize: "1.7rem", letterSpacing: "-.5px" }}>
                          L. {fmt(cuotaSimulada)}
                        </div>
                        <div className="small mt-1" style={{ opacity: .75 }}>
                          {esIndefinido
                            ? "♾ Préstamo indefinido · Capital no se amortiza"
                            : `Sistema francés · ${form.plazo_meses} cuotas fijas`}
                        </div>
                      </div>

                      {/* Desglose */}
                      <div className="d-flex flex-column gap-2">
                        <div className="pmt-sim-item" style={{ background: "#fff", border: "1px solid #e2e8f0" }}>
                          <span className="small text-muted">Monto solicitado</span>
                          <strong style={{ color: "#2c3e50" }}>L. {fmt(form.monto)}</strong>
                        </div>
                        <div className="pmt-sim-item" style={{ background: "#fff", border: "1px solid #e2e8f0" }}>
                          <span className="small text-muted">Tasa anual equivalente</span>
                          <strong style={{ color: "#27ae60" }}>{+tasaAnualEquiv.toFixed(2)}%</strong>
                        </div>
                        <div className="pmt-sim-item" style={{ background: "#fff", border: "1px solid #e2e8f0" }}>
                          <span className="small text-muted">Tasa mensual efectiva</span>
                          <strong style={{ color: "#2980b9" }}>{+tasaMensualEquiv.toFixed(4)}%</strong>
                        </div>
                        {esIndefinido ? (
                          <>
                            <div className="pmt-sim-item" style={{ background: "#eaf6fb", border: "1px solid #2980b9" }}>
                              <span className="small" style={{ color: "#1a5276" }}>Interés mensual</span>
                              <strong style={{ color: "#1a5276" }}>L. {fmt(cuotaSimulada)}</strong>
                            </div>
                            <div className="pmt-sim-item" style={{ background: "#fff3cd", border: "1px solid #ffc107" }}>
                              <span className="small" style={{ color: "#856404" }}>Interés anual estimado</span>
                              <strong style={{ color: "#b7791f" }}>L. {fmt(cuotaSimulada * 12)}</strong>
                            </div>
                            <div className="pmt-sim-item" style={{ background: "#fde8d8", border: "1px solid #e67e22" }}>
                              <span className="small" style={{ color: "#7d4e2e" }}>Capital adeudado (fijo)</span>
                              <strong style={{ color: "#7d4e2e" }}>L. {fmt(form.monto)}</strong>
                            </div>
                            <div className="small px-1 mt-1" style={{ color: "#92400e", background: "#fef3c7", borderRadius: 6, padding: "6px 10px", border: "1px solid #fcd34d" }}>
                              ℹ El socio paga solo el interés cada mes. El capital permanece sin cambio hasta que se cancele el préstamo.
                            </div>
                          </>
                        ) : (() => {
                          const intMes1 = (parseFloat(form.monto) || 0) * (tasaMensualEquiv / 100);
                          const capMes1 = Math.max(0, cuotaSimulada - intMes1);
                          const pctInt = cuotaSimulada > 0 ? (intMes1 / cuotaSimulada) * 100 : 0;
                          const pctCap = 100 - pctInt;
                          return (
                            <>
                              {/* Desglose 1er mes */}
                              <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: ".5rem", padding: ".5rem .75rem" }}>
                                <div className="small fw-semibold mb-2" style={{ color: "#475569" }}>Desglose cuota (1er mes)</div>
                                <div className="d-flex justify-content-between align-items-center mb-1" style={{ fontSize: ".78rem" }}>
                                  <span style={{ color: "#c0392b" }}>🔴 Interés</span>
                                  <strong style={{ color: "#c0392b" }}>L. {fmt(intMes1)}</strong>
                                </div>
                                <div className="d-flex justify-content-between align-items-center mb-2" style={{ fontSize: ".78rem" }}>
                                  <span style={{ color: "#27ae60" }}>🟢 Capital</span>
                                  <strong style={{ color: "#27ae60" }}>L. {fmt(capMes1)}</strong>
                                </div>
                                {/* Barra visual */}
                                <div style={{ height: 10, borderRadius: 5, overflow: "hidden", display: "flex", background: "#e2e8f0" }}>
                                  <div style={{ width: `${pctInt.toFixed(1)}%`, background: "#e74c3c", transition: "width .3s" }} title={`Interés ${pctInt.toFixed(1)}%`} />
                                  <div style={{ width: `${pctCap.toFixed(1)}%`, background: "#27ae60", transition: "width .3s" }} title={`Capital ${pctCap.toFixed(1)}%`} />
                                </div>
                                <div className="d-flex justify-content-between mt-1" style={{ fontSize: ".7rem", color: "#94a3b8" }}>
                                  <span>{pctInt.toFixed(1)}% interés</span>
                                  <span>{pctCap.toFixed(1)}% capital</span>
                                </div>
                              </div>
                              <div className="pmt-sim-item" style={{ background: "#fff3cd", border: "1px solid #ffc107" }}>
                                <span className="small" style={{ color: "#856404" }}>Total intereses</span>
                                <strong style={{ color: "#b7791f" }}>L. {fmt(totalIntereses)}</strong>
                              </div>
                              <div className="pmt-sim-item" style={{ background: "#d4edda", border: "1px solid #28a745" }}>
                                <span className="small" style={{ color: "#155724" }}>Total a pagar</span>
                                <strong style={{ color: "#155724" }}>L. {fmt(totalPagar)}</strong>
                              </div>
                            </>
                          );
                        })()}
                      </div>

                      {/* Barra costo del crédito (solo préstamo con plazo fijo) */}
                      {!esIndefinido && (
                        <div>
                          <div className="d-flex justify-content-between small text-muted mb-1">
                            <span>Capital</span>
                            <span>Intereses</span>
                          </div>
                          <div style={{ height: 10, borderRadius: 6, background: "#e2e8f0", overflow: "hidden" }}>
                            <div style={{
                              height: "100%",
                              width: `${totalPagar > 0 ? (parseFloat(form.monto) / totalPagar * 100) : 0}%`,
                              background: "linear-gradient(90deg,#27ae60,#1e8449)",
                              borderRadius: 6,
                              transition: "width .4s"
                            }} />
                          </div>
                          <div className="d-flex justify-content-between small text-muted mt-1">
                            <span>{totalPagar > 0 ? (parseFloat(form.monto) / totalPagar * 100).toFixed(1) : 0}%</span>
                            <span>{totalPagar > 0 ? (totalIntereses / totalPagar * 100).toFixed(1) : 0}%</span>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-4" style={{ color: "#9ca3af" }}>
                      <FaMoneyBillWave size={36} style={{ opacity: .3, marginBottom: 8 }} />
                      <p className="small mb-0">
                        Ingresa monto, tasa y plazo para ver la simulación de cuotas.
                      </p>
                    </div>
                  )}

                  {/* Tasas de referencia cooperativas */}
                  <div className="mt-auto">
                    <div className="small fw-semibold mb-2" style={{ color: "#64748b" }}>
                      Tasas de referencia usuales en cooperativas:
                    </div>
                    <div className="d-flex flex-wrap gap-1">
                      {[
                        { label: "1% TNM", v: "1",  t: "nominal_mensual" },
                        { label: "2% TNM", v: "2",  t: "nominal_mensual" },
                        { label: "3% TNM", v: "3",  t: "nominal_mensual" },
                        { label: "5% TNM", v: "5",  t: "nominal_mensual" },
                        { label: "12% TNA", v: "12", t: "nominal_anual" },
                      ].map((ref) => (
                        <button
                          key={ref.label}
                          type="button"
                          className="btn btn-sm"
                          style={{ background: "#e2e8f0", color: "#2c3e50", fontSize: ".72rem", borderRadius: ".5rem", padding: "2px 8px" }}
                          onClick={() => {
                            handleInput({ target: { name: "tasa_interes", value: ref.v } });
                            handleInput({ target: { name: "tipo_tasa",    value: ref.t } });
                          }}
                        >
                          {ref.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Footer ── */}
            <div className="modal-footer border-0 bg-white px-3 py-2 gap-2">
              <button
                type="submit"
                className="btn shadow-sm fw-semibold"
                disabled={submitting}
                style={{
                  background: submitting
                    ? "#95a5a6"
                    : "linear-gradient(135deg,#27ae60,#1e8449)",
                  color: "white", border: "none",
                  borderRadius: "8px", padding: "7px 22px", fontSize: ".9rem",
                  opacity: submitting ? 0.75 : 1,
                  cursor: submitting ? "not-allowed" : "pointer",
                }}
              >
                {submitting ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <FaCheckCircle className="me-2" />
                    {editPrestamo ? "Guardar Cambios" : "Registrar Préstamo"}
                  </>
                )}
              </button>
              <button
                type="button"
                className="btn btn-light shadow-sm fw-semibold"
                onClick={onClose}
                style={{ borderRadius: "8px", padding: "7px 18px", fontSize: ".9rem" }}
              >
                <FaTimesCircle className="me-2" />
                Cancelar
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
