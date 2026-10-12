import { useState } from "react";
import { Paginacion } from "../../ui/Componentes";
import { paginar } from "../../ui/paginar";
import { FaMoneyBillWave, FaEye, FaEdit, FaTrash, FaCalendarAlt, FaPercentage, FaClock, FaUserTie } from "react-icons/fa";
import { CircularProgressbar, buildStyles } from "react-circular-progressbar";
import { TIPOS_TASA } from "./helpers";

const TAM_PAG = 15;

// ==================== COMPONENTE TABLA PRÉSTAMOS (agrupada por socio) ====================
export default function TablaPrestamos({ prestamos, usuarios, onEdit, onDelete, onVerDetalle, onAprobar, onRechazar, onDesembolsar, getEstadoInfo }) {
  const [socioModal, setSocioModal] = useState(null);
  const [pagina, setPagina] = useState(1);

  if (!prestamos || prestamos.length === 0) {
    return (
      <div className="card border-0 shadow-sm" style={{ borderRadius: "15px" }}>
        <div className="card-body text-center py-5">
          <div className="mb-3" style={{ fontSize: "48px", opacity: 0.3 }}>💰</div>
          <h5 className="text-muted">No se encontraron préstamos</h5>
          <p className="text-muted small">Intenta con otros filtros de búsqueda</p>
        </div>
      </div>
    );
  }

  const calcularProgreso = (p) => {
    const monto = parseFloat(p.monto || 0);
    const saldo = parseFloat(p.saldo_restante || monto);
    return monto > 0 ? ((monto - saldo) / monto) * 100 : 0;
  };

  // Agrupar por socio
  const gruposMap = {};
  prestamos.forEach((p) => {
    const usuario = usuarios.find((u) => u.id_usuario === p.id_usuario);
    const key = p.id_usuario ?? `__${p.nombre_completo}`;
    if (!gruposMap[key]) {
      gruposMap[key] = {
        key,
        nombre: p.nombre_completo || usuario?.nombre_completo || "Desconocido",
        dni: p.dni || usuario?.dni || "N/A",
        prestamos: [],
      };
    }
    gruposMap[key].prestamos.push(p);
  });
  const grupos = Object.values(gruposMap).sort((a, b) => a.nombre.localeCompare(b.nombre));

  const montoTotal = prestamos.reduce((s, p) => s + parseFloat(p.monto || 0), 0);
  const saldoTotal = prestamos.reduce((s, p) => s + parseFloat(p.saldo_restante || p.monto || 0), 0);
  const grupoSeleccionado = socioModal !== null ? gruposMap[socioModal] : null;

  return (
    <>
      <div className="card border-0 shadow-sm" style={{ borderRadius: "15px" }}>
        {/* Header */}
        <div className="text-white p-3"
          style={{ background: "linear-gradient(135deg,#27ae60 0%,#229954 100%)", borderRadius: "15px 15px 0 0" }}>
          <div className="d-none d-lg-flex align-items-center fw-semibold" style={{ gap: 0 }}>
            <div style={{ width: "44px" }}>#</div>
            <div style={{ flex: "0 0 27%" }}>Socio</div>
            <div style={{ flex: "0 0 15%", textAlign: "center" }}>Progreso</div>
            <div style={{ flex: "0 0 20%", textAlign: "center" }}>Monto Total</div>
            <div style={{ flex: "0 0 20%", textAlign: "center" }}>Saldo Pendiente</div>
            <div style={{ flex: 1, textAlign: "center" }}>Préstamos</div>
          </div>
          <div className="d-flex d-lg-none align-items-center gap-2 fw-semibold">
            <FaUserTie style={{ fontSize: "18px" }} />
            Socios con Préstamos
          </div>
        </div>

        {/* Body */}
        <div className="card-body p-0">
          <div style={{ maxHeight: "680px", overflowY: "auto" }}>
            {paginar(grupos, pagina, TAM_PAG).items.map((grupo, index) => {
              const montoGrupo = grupo.prestamos.reduce((s, p) => s + parseFloat(p.monto || 0), 0);
              const saldoGrupo = grupo.prestamos.reduce((s, p) => s + parseFloat(p.saldo_restante || p.monto || 0), 0);
              const progresosArr = grupo.prestamos.map(calcularProgreso);
              const progresoPromedio = progresosArr.reduce((a, b) => a + b, 0) / progresosArr.length;

              const activos   = grupo.prestamos.filter(p => p.estado === "activo").length;
              const enMora    = grupo.prestamos.filter(p => p.estado === "mora").length;
              const pagados   = grupo.prestamos.filter(p => p.estado === "pagado").length;
              const pendientes = grupo.prestamos.filter(p => p.estado === "pendiente").length;

              const todosPagados = pagados === grupo.prestamos.length;
              const hayMora     = enMora > 0;
              const iniciales = grupo.nombre.split(" ").slice(0, 2).map(n => n[0] || "").join("").toUpperCase();

              return (
                <div key={grupo.key} className="border-bottom"
                  style={{ transition: "background 0.2s", background: "white", cursor: "pointer" }}
                  onClick={() => setSocioModal(grupo.key)}
                  onMouseEnter={e => (e.currentTarget.style.background = "#f0fff4")}
                  onMouseLeave={e => (e.currentTarget.style.background = "white")}>

                  {/* ── Desktop ── */}
                  <div className="d-none d-lg-flex align-items-center px-3 py-3" style={{ gap: 0 }}>
                    {/* # */}
                    <div style={{ width: "44px" }}>
                      <div className="rounded-circle d-flex align-items-center justify-content-center fw-bold"
                        style={{ width: 32, height: 32, background: "rgba(39,174,96,0.12)", color: "#27ae60", fontSize: 13 }}>
                        {index + 1}
                      </div>
                    </div>

                    {/* Socio */}
                    <div style={{ flex: "0 0 27%", minWidth: 0 }}>
                      <div className="d-flex align-items-center gap-2">
                        <div className="rounded-circle d-flex align-items-center justify-content-center fw-bold flex-shrink-0"
                          style={{ width: 44, height: 44, background: "linear-gradient(135deg,#27ae60,#229954)", color: "white", fontSize: 16 }}>
                          {iniciales}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div className="fw-semibold text-truncate" style={{ color: "#2c3e50", fontSize: 14 }}>
                            {grupo.nombre}
                          </div>
                          <div className="text-muted" style={{ fontSize: "0.72rem" }}>DNI: {grupo.dni}</div>
                          <div className="d-flex gap-1 flex-wrap mt-1">
                            {activos > 0 && (
                              <span style={{ fontSize: "0.65rem", fontWeight: 700, background: "rgba(39,174,96,0.1)", color: "#27ae60", border: "1px solid #27ae60", borderRadius: 4, padding: "1px 5px" }}>
                                {activos} activo{activos !== 1 ? "s" : ""}
                              </span>
                            )}
                            {enMora > 0 && (
                              <span style={{ fontSize: "0.65rem", fontWeight: 700, background: "rgba(231,76,60,0.1)", color: "#e74c3c", border: "1px solid #e74c3c", borderRadius: 4, padding: "1px 5px" }}>
                                {enMora} mora
                              </span>
                            )}
                            {pendientes > 0 && (
                              <span style={{ fontSize: "0.65rem", fontWeight: 700, background: "rgba(243,156,18,0.1)", color: "#f39c12", border: "1px solid #f39c12", borderRadius: 4, padding: "1px 5px" }}>
                                {pendientes} pend.
                              </span>
                            )}
                            {pagados > 0 && (
                              <span style={{ fontSize: "0.65rem", fontWeight: 700, background: "rgba(149,165,166,0.1)", color: "#7f8c8d", border: "1px solid #95a5a6", borderRadius: 4, padding: "1px 5px" }}>
                                {pagados} pagado{pagados !== 1 ? "s" : ""}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Progreso */}
                    <div style={{ flex: "0 0 15%", textAlign: "center" }}>
                      <div style={{ width: 50, height: 50, margin: "0 auto" }}>
                        <CircularProgressbar value={progresoPromedio} text={`${Math.round(progresoPromedio)}%`}
                          styles={buildStyles({ textSize: "26px", pathColor: todosPagados ? "#27ae60" : hayMora ? "#e74c3c" : "#27ae60", textColor: todosPagados ? "#27ae60" : "#2c3e50", trailColor: "#e9ecef" })} />
                      </div>
                      <div style={{ fontSize: "0.67rem", color: "#7f8c8d", marginTop: 3 }}>
                        {pagados}/{grupo.prestamos.length} pagados
                      </div>
                    </div>

                    {/* Monto total */}
                    <div style={{ flex: "0 0 20%", textAlign: "center" }}>
                      <div className="fw-bold" style={{ fontSize: 17, color: "#27ae60" }}>
                        L. {parseFloat(montoGrupo).toLocaleString("es-HN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      <div style={{ fontSize: "0.72rem", color: "#7f8c8d" }}>otorgado</div>
                    </div>

                    {/* Saldo pendiente */}
                    <div style={{ flex: "0 0 20%", textAlign: "center" }}>
                      <div className="fw-bold" style={{ fontSize: 17, color: saldoGrupo > 0 ? "#e74c3c" : "#27ae60" }}>
                        L. {parseFloat(saldoGrupo).toLocaleString("es-HN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      <div style={{ fontSize: "0.72rem", color: "#7f8c8d" }}>saldo restante</div>
                    </div>

                    {/* Botón */}
                    <div style={{ flex: 1, textAlign: "center" }}>
                      <button className="btn btn-sm fw-semibold"
                        style={{ background: "linear-gradient(135deg,#27ae60,#229954)", color: "white", border: "none", borderRadius: 8, padding: "7px 16px", fontSize: "0.78rem" }}
                        onClick={e => { e.stopPropagation(); setSocioModal(grupo.key); }}>
                        <FaEye className="me-1" />
                        Ver {grupo.prestamos.length} préstamo{grupo.prestamos.length !== 1 ? "s" : ""}
                      </button>
                    </div>
                  </div>

                  {/* ── Móvil ── */}
                  <div className="d-flex d-lg-none flex-column p-3 gap-2">
                    <div className="d-flex align-items-center justify-content-between gap-2">
                      <div className="d-flex align-items-center gap-2" style={{ minWidth: 0 }}>
                        <div className="rounded-circle d-flex align-items-center justify-content-center fw-bold flex-shrink-0"
                          style={{ width: 44, height: 44, background: "linear-gradient(135deg,#27ae60,#229954)", color: "white", fontSize: 16 }}>
                          {iniciales}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div className="fw-semibold text-truncate" style={{ color: "#2c3e50", fontSize: 14 }}>{grupo.nombre}</div>
                          <div className="text-muted" style={{ fontSize: "0.72rem" }}>DNI: {grupo.dni}</div>
                        </div>
                      </div>
                      <button className="btn btn-sm fw-semibold flex-shrink-0"
                        style={{ background: "linear-gradient(135deg,#27ae60,#229954)", color: "white", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: "0.75rem" }}
                        onClick={e => { e.stopPropagation(); setSocioModal(grupo.key); }}>
                        <FaEye className="me-1" />Ver
                      </button>
                    </div>
                    <div className="d-flex flex-wrap gap-2 align-items-center">
                      <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#27ae60" }}>
                        L. {parseFloat(montoGrupo).toLocaleString("es-HN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                      <span style={{ fontSize: "0.8rem", color: "#e74c3c" }}>
                        Saldo: L. {parseFloat(saldoGrupo).toLocaleString("es-HN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                      <span style={{ fontSize: "0.72rem", color: "#7f8c8d" }}>{grupo.prestamos.length} préstamo{grupo.prestamos.length !== 1 ? "s" : ""}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

                {<Paginacion total={grupos.length} pagina={Math.min(pagina, Math.max(1, Math.ceil(grupos.length / TAM_PAG)))} tam={TAM_PAG} onCambiar={setPagina} />}

        {/* Footer */}
        <div className="card-footer bg-light border-top-0 py-3 px-3" style={{ borderRadius: "0 0 15px 15px" }}>
          <div className="d-flex flex-wrap justify-content-center gap-4 text-center">
            <span className="small fw-semibold text-muted">
              <FaUserTie className="me-1 text-success" />
              Socios: <span className="text-success fw-bold">{grupos.length}</span>
            </span>
            <span className="small fw-semibold text-muted">
              Total préstamos: <span className="text-primary fw-bold">{prestamos.length}</span>
            </span>
            <span className="small fw-semibold text-muted">
              Otorgado: <span className="text-success fw-bold">L. {montoTotal.toLocaleString("es-HN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </span>
            <span className="small fw-semibold text-muted">
              Saldo total: <span className="text-danger fw-bold">L. {saldoTotal.toLocaleString("es-HN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Modal historial del socio */}
      {grupoSeleccionado && (
        <ModalHistorialPrestamos
          grupo={grupoSeleccionado}
          onClose={() => setSocioModal(null)}
          onEdit={onEdit}
          onDelete={onDelete}
          onVerDetalle={onVerDetalle}
          onAprobar={onAprobar}
          onRechazar={onRechazar}
          onDesembolsar={onDesembolsar}
          getEstadoInfo={getEstadoInfo}
        />
      )}
    </>
  );
}

// ==================== MODAL HISTORIAL DE PRÉSTAMOS POR SOCIO ====================
function ModalHistorialPrestamos({ grupo, onClose, onEdit, onDelete, onVerDetalle, onAprobar, onRechazar, onDesembolsar, getEstadoInfo }) {
  const montoTotal = grupo.prestamos.reduce((s, p) => s + parseFloat(p.monto || 0), 0);
  const saldoTotal = grupo.prestamos.reduce((s, p) => s + parseFloat(p.saldo_restante || p.monto || 0), 0);
  const iniciales = grupo.nombre.split(" ").slice(0, 2).map(n => n[0] || "").join("").toUpperCase();

  const calcularProgreso = (p) => {
    const monto = parseFloat(p.monto || 0);
    const saldo = parseFloat(p.saldo_restante || monto);
    return monto > 0 ? ((monto - saldo) / monto) * 100 : 0;
  };

  return (
    <div className="modal show d-block" tabIndex="-1"
      style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)", zIndex: 6000, position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", overflowY: "auto" }}
      onClick={onClose}>
      <div className="modal-dialog modal-dialog-centered modal-lg" style={{ maxWidth: 860 }}
        onClick={e => e.stopPropagation()}>
        <div className="modal-content border-0 shadow-lg" style={{ borderRadius: 16, overflow: "hidden" }}>

          {/* Header */}
          <div className="d-flex align-items-center justify-content-between text-white px-4 py-3"
            style={{ background: "linear-gradient(135deg,#27ae60 0%,#229954 100%)" }}>
            <div className="d-flex align-items-center gap-3">
              <div className="rounded-circle d-flex align-items-center justify-content-center fw-bold"
                style={{ width: 46, height: 46, background: "rgba(255,255,255,0.2)", fontSize: 17 }}>
                {iniciales}
              </div>
              <div>
                <div className="fw-bold" style={{ fontSize: "1.05rem" }}>{grupo.nombre}</div>
                <div style={{ fontSize: "0.78rem", opacity: 0.85 }}>
                  DNI: {grupo.dni} · {grupo.prestamos.length} préstamo{grupo.prestamos.length !== 1 ? "s" : ""} · Otorgado: L. {montoTotal.toLocaleString("es-HN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
            </div>
            <button type="button" className="btn-close btn-close-white btn-sm" onClick={onClose} />
          </div>

          {/* Body */}
          <div className="modal-body p-0" style={{ background: "#f8fafc", maxHeight: "72vh", overflowY: "auto" }}>
            {grupo.prestamos
              .sort((a, b) => new Date(b.fecha_otorgado) - new Date(a.fecha_otorgado))
              .map((p, idx) => {
                const estadoInfo = getEstadoInfo(p.estado);
                const IconoEstado = estadoInfo.icon;
                const progreso = calcularProgreso(p);
                const monto = parseFloat(p.monto || 0);
                const saldo = parseFloat(p.saldo_restante || monto);
                const pagado = monto - saldo;
                const completado = saldo <= 0;
                const tasa = parseFloat(p.tasa_original != null ? p.tasa_original : p.tasa_interes);
                const abbr = TIPOS_TASA.find(t => t.value === (p.tipo_tasa || "nominal_anual"))?.abbr || "TNA";

                return (
                  <div key={p.id_prestamo} className={idx > 0 ? "border-top" : ""}
                    style={{ background: idx % 2 === 0 ? "white" : "#fafbfc" }}>

                    {/* Cabecera del préstamo */}
                    <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 px-4 py-3">
                      <div className="d-flex align-items-center gap-3" style={{ minWidth: 0 }}>
                        {/* Progreso circular */}
                        <div style={{ width: 56, height: 56, flexShrink: 0 }}>
                          <CircularProgressbar value={progreso} text={`${Math.round(progreso)}%`}
                            styles={buildStyles({ textSize: "26px", pathColor: completado ? "#27ae60" : p.estado === "mora" ? "#e74c3c" : "#27ae60", textColor: "#2c3e50", trailColor: "#ecf0f1" })} />
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div className="fw-bold d-flex align-items-center gap-2 flex-wrap" style={{ color: "#2c3e50", fontSize: "0.95rem" }}>
                            <span>Préstamo #{p.id_prestamo}</span>
                            <span className="badge d-inline-flex align-items-center gap-1"
                              style={{ background: estadoInfo.bg, color: estadoInfo.color, border: `1.5px solid ${estadoInfo.color}`, borderRadius: 20, fontSize: 12, fontWeight: 600, padding: "3px 10px" }}>
                              <IconoEstado style={{ fontSize: 11 }} />{estadoInfo.label}
                            </span>
                          </div>
                          <div className="d-flex flex-wrap gap-2 mt-1">
                            <span style={{ fontSize: "0.75rem", color: "#27ae60", fontWeight: 600 }}>
                              <FaMoneyBillWave className="me-1" style={{ fontSize: 11 }} />
                              L. {monto.toLocaleString("es-HN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                            <span style={{ fontSize: "0.75rem", color: "#3498db", fontWeight: 600 }}>
                              <FaPercentage className="me-1" style={{ fontSize: 10 }} />
                              {tasa}% {abbr}
                            </span>
                            <span style={{ fontSize: "0.75rem", color: "#f39c12", fontWeight: 600 }}>
                              <FaClock className="me-1" style={{ fontSize: 10 }} />
                              {parseInt(p.plazo_meses) === 0 ? "∞ Indefinido" : `${p.plazo_meses} meses`}
                            </span>
                            <span style={{ fontSize: "0.75rem", color: "#7f8c8d" }}>
                              <FaCalendarAlt className="me-1" style={{ fontSize: 10 }} />
                              {p.fecha_otorgado?.substring(0, 10) || "N/A"}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Acciones */}
                      <div className="d-flex gap-1 flex-shrink-0 flex-wrap justify-content-end">
                        {p.estado === "pendiente" && (
                          <>
                            <button className="btn btn-sm btn-success fw-semibold"
                              onClick={() => { onClose(); setTimeout(() => onAprobar(p), 60); }}>
                              Aprobar
                            </button>
                            <button className="btn btn-sm btn-outline-danger"
                              onClick={() => { onClose(); setTimeout(() => onRechazar(p), 60); }}>
                              Rechazar
                            </button>
                          </>
                        )}
                        {p.estado === "aprobado" && (
                          <>
                            <button className="btn btn-sm fw-semibold"
                              style={{ background: "#a8cd3a", color: "#1a2a00" }}
                              onClick={() => { onClose(); setTimeout(() => onDesembolsar(p), 60); }}>
                              Desembolsar
                            </button>
                            <button className="btn btn-sm btn-outline-danger"
                              onClick={() => { onClose(); setTimeout(() => onRechazar(p), 60); }}>
                              Rechazar
                            </button>
                          </>
                        )}
                      </div>
                      <div className="d-flex gap-1 flex-shrink-0">
                        <button className="btn btn-sm" title="Ver detalle"
                          onClick={() => { onClose(); setTimeout(() => onVerDetalle(p), 60); }}
                          style={{ background: "rgba(52,152,219,0.1)", color: "#3498db", border: "1px solid #3498db", borderRadius: "6px 0 0 6px", padding: "5px 10px" }}
                          onMouseEnter={e => { e.currentTarget.style.background = "#3498db"; e.currentTarget.style.color = "white"; }}
                          onMouseLeave={e => { e.currentTarget.style.background = "rgba(52,152,219,0.1)"; e.currentTarget.style.color = "#3498db"; }}>
                          <FaEye style={{ fontSize: 13 }} />
                        </button>
                        <button className="btn btn-sm" title="Editar"
                          onClick={() => { onClose(); setTimeout(() => onEdit(p), 60); }}
                          style={{ background: "rgba(243,156,18,0.1)", color: "#f39c12", border: "1px solid #f39c12", borderLeft: "none", padding: "5px 10px" }}
                          onMouseEnter={e => { e.currentTarget.style.background = "#f39c12"; e.currentTarget.style.color = "white"; }}
                          onMouseLeave={e => { e.currentTarget.style.background = "rgba(243,156,18,0.1)"; e.currentTarget.style.color = "#f39c12"; }}>
                          <FaEdit style={{ fontSize: 13 }} />
                        </button>
                        <button className="btn btn-sm" title="Eliminar"
                          onClick={() => onDelete(p.id_prestamo)}
                          style={{ background: "rgba(231,76,60,0.1)", color: "#e74c3c", border: "1px solid #e74c3c", borderLeft: "none", borderRadius: "0 6px 6px 0", padding: "5px 10px" }}
                          onMouseEnter={e => { e.currentTarget.style.background = "#e74c3c"; e.currentTarget.style.color = "white"; }}
                          onMouseLeave={e => { e.currentTarget.style.background = "rgba(231,76,60,0.1)"; e.currentTarget.style.color = "#e74c3c"; }}>
                          <FaTrash style={{ fontSize: 13 }} />
                        </button>
                      </div>
                    </div>

                    {/* Barra de progreso + desglose numérico */}
                    <div className="px-4 pb-3">
                      <div className="d-flex justify-content-between align-items-center mb-1" style={{ fontSize: "0.75rem" }}>
                        <span style={{ color: "#27ae60", fontWeight: 600 }}>
                          Pagado: L. {pagado.toLocaleString("es-HN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        <span style={{ color: "#e74c3c", fontWeight: 600 }}>
                          Saldo: L. {saldo.toLocaleString("es-HN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div style={{ height: 6, background: "#e9ecef", borderRadius: 10, overflow: "hidden" }}>
                        <div style={{
                          height: "100%", width: `${Math.min(progreso, 100)}%`,
                          background: completado ? "linear-gradient(90deg,#27ae60,#2ecc71)" : p.estado === "mora" ? "linear-gradient(90deg,#e74c3c,#c0392b)" : "linear-gradient(90deg,#27ae60,#229954)",
                          borderRadius: 10, transition: "width .4s"
                        }} />
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>

          {/* Footer */}
          <div className="modal-footer border-0 bg-white px-4 py-2 d-flex justify-content-between align-items-center">
            <div className="d-flex gap-4 flex-wrap">
              <span className="small fw-semibold text-muted">
                Total préstamos: <strong className="text-primary">{grupo.prestamos.length}</strong>
              </span>
              <span className="small fw-semibold text-muted">
                Otorgado: <strong style={{ color: "#27ae60" }}>L. {montoTotal.toLocaleString("es-HN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
              </span>
              <span className="small fw-semibold text-muted">
                Saldo: <strong style={{ color: "#e74c3c" }}>L. {saldoTotal.toLocaleString("es-HN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
              </span>
            </div>
            <button type="button" className="btn btn-sm btn-light fw-semibold shadow-sm"
              onClick={onClose} style={{ borderRadius: 8, padding: "6px 20px" }}>
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
