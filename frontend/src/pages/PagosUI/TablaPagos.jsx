import { useState } from "react";
import { Paginacion } from "../../ui/Componentes";
import { paginar } from "../../ui/paginar";
import ReciboModal from "../../components/ReciboModal";
import { FaMoneyCheckAlt, FaCalendarAlt, FaUser, FaEdit, FaTrash, FaFileInvoiceDollar, FaCheckCircle, FaClock } from "react-icons/fa";
import { CircularProgressbar, buildStyles } from "react-circular-progressbar";

const TAM_PAG = 15;
const fmt = (n) =>
  parseFloat(n || 0).toLocaleString("es-HN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ==================== COMPONENTE TABLA PAGOS (agrupada por socio) ====================
export default function TablaPagos({ pagos, prestamos, usuarios, onEdit, onDelete }) {
  const [usuarioModal, setUsuarioModal] = useState(null);
  const [pagina, setPagina] = useState(1);

  if (!pagos || pagos.length === 0) {
    return (
      <div className="card border-0 shadow-sm" style={{ borderRadius: "15px" }}>
        <div className="card-body text-center py-5">
          <div className="rounded-circle mx-auto d-flex align-items-center justify-content-center mb-3"
            style={{ width: "80px", height: "80px", background: "rgba(52,152,219,0.1)" }}>
            <FaMoneyCheckAlt style={{ fontSize: "36px", color: "#3498db" }} />
          </div>
          <h5 className="text-muted fw-semibold">No hay pagos registrados</h5>
          <p className="text-muted mb-0">Registra un nuevo pago para comenzar</p>
        </div>
      </div>
    );
  }

  const getPrestamo = (id_prestamo) => prestamos.find((pr) => pr.id_prestamo === id_prestamo);

  // Agrupar pagos por id_usuario (vía prestamos)
  const gruposMap = {};
  pagos.forEach((pago) => {
    const prestamo = getPrestamo(pago.id_prestamo);
    const id_usuario = prestamo?.id_usuario ?? `__${pago.nombre_completo}`;
    if (!gruposMap[id_usuario]) {
      gruposMap[id_usuario] = { id_usuario, nombre: pago.nombre_completo || "N/A", pagos: [] };
    }
    gruposMap[id_usuario].pagos.push(pago);
  });
  const grupos = Object.values(gruposMap).sort((a, b) => a.nombre.localeCompare(b.nombre));

  const montoTotalFooter = pagos.reduce((s, p) => s + parseFloat(p.monto_pagado || p.monto || 0), 0);
  const grupoSeleccionado = usuarioModal !== null ? gruposMap[usuarioModal] : null;

  const metodoBadgeMap = {
    efectivo:            { label: "💵 Efectivo",      color: "#27ae60" },
    transferencia:       { label: "🏦 Transferencia", color: "#3498db" },
    cheque:              { label: "📋 Cheque",         color: "#9b59b6" },
    deposito:            { label: "🏧 Depósito",       color: "#e67e22" },
    "tarjeta de débito": { label: "💳 T. Débito",      color: "#e74c3c" },
    "pago móvil":        { label: "📱 Pago Móvil",     color: "#1abc9c" },
  };

  return (
    <>
      <div className="card border-0 shadow-sm" style={{ borderRadius: "15px" }}>
        {/* Header */}
        <div className="text-white p-3"
          style={{ background: "linear-gradient(135deg,#3498db 0%,#2980b9 100%)", borderRadius: "15px 15px 0 0" }}>
          <div className="d-none d-lg-flex align-items-center fw-semibold" style={{ gap: 0 }}>
            <div style={{ width: "44px" }}>#</div>
            <div style={{ flex: "0 0 28%" }}>Socio</div>
            <div style={{ flex: "0 0 16%", textAlign: "center" }}>Progreso</div>
            <div style={{ flex: "0 0 18%", textAlign: "center" }}>Total Pagado</div>
            <div style={{ flex: "0 0 22%", textAlign: "center" }}>Último Pago</div>
            <div style={{ flex: 1, textAlign: "center" }}>Historial</div>
          </div>
          <div className="d-flex d-lg-none align-items-center gap-2 fw-semibold">
            <FaMoneyCheckAlt style={{ fontSize: "18px" }} />
            Socios con Pagos
          </div>
        </div>

        {/* Body */}
        <div className="card-body p-0">
          <div style={{ maxHeight: "680px", overflowY: "auto" }}>
            {paginar(grupos, pagina, TAM_PAG).items.map((grupo, index) => {
              const totalPagado = grupo.pagos.reduce((s, p) => s + parseFloat(p.monto_pagado || p.monto || 0), 0);
              const numPagos = grupo.pagos.length;
              const prestamosIds = [...new Set(grupo.pagos.map(p => p.id_prestamo))];

              const ultimaFechaStr = grupo.pagos
                .map(p => (p.fecha_pago || p.fecha || "").substring(0, 10))
                .filter(Boolean)
                .sort()
                .reverse()[0] || "";

              // Método más frecuente
              const metodoCount = {};
              grupo.pagos.forEach(p => {
                const k = (p.metodo_pago || "").toLowerCase();
                metodoCount[k] = (metodoCount[k] || 0) + 1;
              });
              const metodoTop = Object.entries(metodoCount).sort((a, b) => b[1] - a[1])[0]?.[0] || "";
              const m = metodoBadgeMap[metodoTop] || { label: metodoTop || "—", color: "#7f8c8d" };

              // Progreso promedio de sus préstamos
              const progresosArr = prestamosIds.map(id => {
                const pr = getPrestamo(id);
                if (!pr) return 0;
                const mp = parseFloat(pr.monto || 0);
                const sr = parseFloat(pr.saldo_restante || mp);
                return mp > 0 ? ((mp - sr) / mp) * 100 : 0;
              });
              const progresoPromedio = progresosArr.length
                ? progresosArr.reduce((a, b) => a + b, 0) / progresosArr.length : 0;
              const completados = prestamosIds.filter(id => {
                const pr = getPrestamo(id);
                return pr && parseFloat(pr.saldo_restante || 0) <= 0;
              }).length;
              const todosCompletos = completados === prestamosIds.length;

              const iniciales = grupo.nombre.split(" ").slice(0, 2).map(n => n[0] || "").join("").toUpperCase();

              return (
                <div key={grupo.id_usuario} className="border-bottom"
                  style={{ transition: "background 0.2s", background: "white", cursor: "pointer" }}
                  onClick={() => setUsuarioModal(grupo.id_usuario)}
                  onMouseEnter={e => (e.currentTarget.style.background = "#f0f6ff")}
                  onMouseLeave={e => (e.currentTarget.style.background = "white")}>

                  {/* ── Desktop ── */}
                  <div className="d-none d-lg-flex align-items-center px-3 py-3" style={{ gap: 0 }}>
                    {/* # */}
                    <div style={{ width: "44px" }}>
                      <div className="rounded-circle d-flex align-items-center justify-content-center fw-bold"
                        style={{ width: 32, height: 32, background: "rgba(52,152,219,0.1)", color: "#3498db", fontSize: 13 }}>
                        {index + 1}
                      </div>
                    </div>

                    {/* Socio */}
                    <div style={{ flex: "0 0 28%", minWidth: 0 }}>
                      <div className="d-flex align-items-center gap-2">
                        <div className="rounded-circle d-flex align-items-center justify-content-center fw-bold flex-shrink-0"
                          style={{ width: 44, height: 44, background: "linear-gradient(135deg,#3498db,#2980b9)", color: "white", fontSize: 16 }}>
                          {iniciales}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div className="fw-semibold text-truncate" style={{ color: "#2c3e50", fontSize: 14 }}>
                            {grupo.nombre}
                          </div>
                          <div className="d-flex gap-1 flex-wrap mt-1">
                            <span style={{ fontSize: "0.69rem", background: "rgba(52,152,219,0.1)", color: "#2980b9", border: "1px solid #3498db", borderRadius: 5, padding: "1px 6px", fontWeight: 600 }}>
                              {prestamosIds.length} préstamo{prestamosIds.length !== 1 ? "s" : ""}
                            </span>
                            <span style={{ fontSize: "0.69rem", background: "rgba(39,174,96,0.1)", color: "#1e8449", border: "1px solid #27ae60", borderRadius: 5, padding: "1px 6px", fontWeight: 600 }}>
                              {numPagos} pago{numPagos !== 1 ? "s" : ""}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Progreso */}
                    <div style={{ flex: "0 0 16%", textAlign: "center" }}>
                      <div style={{ width: 50, height: 50, margin: "0 auto" }}>
                        <CircularProgressbar value={progresoPromedio} text={`${Math.round(progresoPromedio)}%`}
                          styles={buildStyles({ textSize: "26px", pathColor: todosCompletos ? "#27ae60" : "#3498db", textColor: todosCompletos ? "#27ae60" : "#3498db", trailColor: "#e9ecef" })} />
                      </div>
                      <div style={{ fontSize: "0.67rem", color: "#7f8c8d", marginTop: 3 }}>
                        {completados}/{prestamosIds.length} completado{completados !== 1 ? "s" : ""}
                      </div>
                    </div>

                    {/* Total pagado */}
                    <div style={{ flex: "0 0 18%", textAlign: "center" }}>
                      <div className="fw-bold" style={{ fontSize: 18, color: "#27ae60" }}>
                        L. {fmt(totalPagado)}
                      </div>
                      <div style={{ fontSize: "0.72rem", color: "#7f8c8d" }}>acumulado</div>
                    </div>

                    {/* Último pago */}
                    <div style={{ flex: "0 0 22%", textAlign: "center" }}>
                      <div className="badge mb-1 d-inline-flex align-items-center"
                        style={{ background: "rgba(155,89,182,0.1)", color: "#9b59b6", border: "2px solid #9b59b6", borderRadius: 10, fontSize: 12, fontWeight: 600, padding: "4px 10px" }}>
                        <FaCalendarAlt className="me-1" />{ultimaFechaStr || "—"}
                      </div>
                      <div className="badge d-block"
                        style={{ background: "rgba(52,152,219,0.07)", color: m.color, border: `1.5px solid ${m.color}`, borderRadius: 8, fontSize: 11, fontWeight: 600 }}>
                        {m.label}
                      </div>
                    </div>

                    {/* Botón historial */}
                    <div style={{ flex: 1, textAlign: "center" }}>
                      <button className="btn btn-sm fw-semibold"
                        style={{ background: "linear-gradient(135deg,#3498db,#2980b9)", color: "white", border: "none", borderRadius: 8, padding: "7px 16px", fontSize: "0.78rem" }}
                        onClick={e => { e.stopPropagation(); setUsuarioModal(grupo.id_usuario); }}>
                        <FaFileInvoiceDollar className="me-1" />
                        Ver {numPagos} pago{numPagos !== 1 ? "s" : ""}
                      </button>
                    </div>
                  </div>

                  {/* ── Móvil ── */}
                  <div className="d-flex d-lg-none flex-column p-3 gap-2">
                    <div className="d-flex align-items-center justify-content-between gap-2">
                      <div className="d-flex align-items-center gap-2" style={{ minWidth: 0 }}>
                        <div className="rounded-circle d-flex align-items-center justify-content-center fw-bold flex-shrink-0"
                          style={{ width: 44, height: 44, background: "linear-gradient(135deg,#3498db,#2980b9)", color: "white", fontSize: 16 }}>
                          {iniciales}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div className="fw-semibold text-truncate" style={{ color: "#2c3e50", fontSize: 14 }}>{grupo.nombre}</div>
                          <div className="d-flex gap-1 flex-wrap mt-1">
                            <span style={{ fontSize: "0.69rem", background: "rgba(52,152,219,0.1)", color: "#2980b9", border: "1px solid #3498db", borderRadius: 5, padding: "1px 6px", fontWeight: 600 }}>
                              {prestamosIds.length} préstamo{prestamosIds.length !== 1 ? "s" : ""}
                            </span>
                            <span style={{ fontSize: "0.69rem", background: "rgba(39,174,96,0.1)", color: "#1e8449", border: "1px solid #27ae60", borderRadius: 5, padding: "1px 6px", fontWeight: 600 }}>
                              {numPagos} pagos
                            </span>
                          </div>
                        </div>
                      </div>
                      <button className="btn btn-sm fw-semibold flex-shrink-0"
                        style={{ background: "linear-gradient(135deg,#3498db,#2980b9)", color: "white", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: "0.75rem" }}
                        onClick={e => { e.stopPropagation(); setUsuarioModal(grupo.id_usuario); }}>
                        <FaFileInvoiceDollar className="me-1" />Ver
                      </button>
                    </div>
                    <div className="d-flex flex-wrap gap-2 align-items-center">
                      <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#27ae60" }}>L. {fmt(totalPagado)}</span>
                      <span className="badge d-inline-flex align-items-center gap-1"
                        style={{ background: "rgba(155,89,182,0.1)", color: "#9b59b6", border: "2px solid #9b59b6", borderRadius: 10, fontSize: 11, fontWeight: 600, padding: "4px 8px" }}>
                        <FaCalendarAlt />{ultimaFechaStr || "—"}
                      </span>
                      <span className="badge" style={{ background: "rgba(52,152,219,0.07)", color: m.color, border: `1.5px solid ${m.color}`, borderRadius: 8, fontSize: 11, fontWeight: 600, padding: "4px 8px" }}>
                        {m.label}
                      </span>
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
              <FaUser className="me-1 text-primary" />
              Socios: <span className="text-primary fw-bold">{grupos.length}</span>
            </span>
            <span className="small fw-semibold text-muted">
              <FaCheckCircle className="me-1 text-success" />
              Total pagos: <span className="text-primary fw-bold">{pagos.length}</span>
            </span>
            <span className="small fw-semibold text-muted">
              Monto total: <span className="text-success fw-bold">L. {fmt(montoTotalFooter)}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Modal historial del socio */}
      {grupoSeleccionado && (
        <ModalHistorialPagos
          grupo={grupoSeleccionado}
          prestamos={prestamos}
          onClose={() => setUsuarioModal(null)}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      )}
    </>
  );
}

// ==================== MODAL HISTORIAL DE PAGOS POR SOCIO ====================
function ModalHistorialPagos({ grupo, prestamos, onClose, onEdit, onDelete }) {
  const [reciboPago, setReciboPago] = useState(null);
  const getPrestamo = (id_prestamo) => prestamos.find((pr) => pr.id_prestamo === id_prestamo);

  // Agrupar pagos del socio por préstamo
  const pagosAgrupados = {};
  grupo.pagos.forEach(pago => {
    const key = pago.id_prestamo;
    if (!pagosAgrupados[key]) pagosAgrupados[key] = [];
    pagosAgrupados[key].push(pago);
  });

  const metodoBadgeMap = {
    efectivo:            { label: "💵 Efectivo",      color: "#27ae60", bg: "rgba(39,174,96,0.1)" },
    transferencia:       { label: "🏦 Transferencia", color: "#3498db", bg: "rgba(52,152,219,0.1)" },
    cheque:              { label: "📋 Cheque",         color: "#9b59b6", bg: "rgba(155,89,182,0.1)" },
    deposito:            { label: "🏧 Depósito",       color: "#e67e22", bg: "rgba(230,126,34,0.1)" },
    "tarjeta de débito": { label: "💳 T. Débito",      color: "#e74c3c", bg: "rgba(231,76,60,0.1)" },
    "pago móvil":        { label: "📱 Pago Móvil",     color: "#1abc9c", bg: "rgba(26,188,156,0.1)" },
  };

  const totalGeneral = grupo.pagos.reduce((s, p) => s + parseFloat(p.monto_pagado || p.monto || 0), 0);
  const iniciales = grupo.nombre.split(" ").slice(0, 2).map(n => n[0] || "").join("").toUpperCase();

  return (
    <div className="modal show d-block" tabIndex="-1"
      style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)", zIndex: 6000, position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", overflowY: "auto" }}
      onClick={onClose}>
      <div className="modal-dialog modal-dialog-centered modal-lg" style={{ maxWidth: 840 }}
        onClick={e => e.stopPropagation()}>
        <div className="modal-content border-0 shadow-lg" style={{ borderRadius: 16, overflow: "hidden" }}>

          {/* Header */}
          <div className="d-flex align-items-center justify-content-between text-white px-4 py-3"
            style={{ background: "linear-gradient(135deg,#3498db 0%,#2980b9 100%)" }}>
            <div className="d-flex align-items-center gap-3">
              <div className="rounded-circle d-flex align-items-center justify-content-center fw-bold"
                style={{ width: 46, height: 46, background: "rgba(255,255,255,0.2)", fontSize: 17 }}>
                {iniciales}
              </div>
              <div>
                <div className="fw-bold" style={{ fontSize: "1.05rem" }}>{grupo.nombre}</div>
                <div style={{ fontSize: "0.78rem", opacity: 0.85 }}>
                  {grupo.pagos.length} pago{grupo.pagos.length !== 1 ? "s" : ""} · Total acumulado: L. {fmt(totalGeneral)}
                </div>
              </div>
            </div>
            <button type="button" className="btn-close btn-close-white btn-sm" onClick={onClose} />
          </div>

          {/* Body */}
          <div className="modal-body p-0" style={{ background: "#f8fafc", maxHeight: "72vh", overflowY: "auto" }}>
            {Object.entries(pagosAgrupados).map(([id_prestamo, pagosList]) => {
              const prestamo = getPrestamo(parseInt(id_prestamo));
              const montoPr  = parseFloat(prestamo?.monto || 0);
              const saldoPr  = parseFloat(prestamo?.saldo_restante || montoPr);
              const pagadoPr = montoPr - saldoPr;
              const progresoPr = montoPr > 0 ? (pagadoPr / montoPr) * 100 : 0;
              const completado = saldoPr <= 0;
              const subtotalPr = pagosList.reduce((s, p) => s + parseFloat(p.monto_pagado || p.monto || 0), 0);

              return (
                <div key={id_prestamo}>
                  {/* Sub-cabecera del préstamo */}
                  <div className="px-4 py-2 d-flex flex-wrap align-items-center gap-2"
                    style={{ background: "#edf2f7", borderBottom: "1px solid #dee2e6" }}>
                    <span className="fw-bold" style={{ color: "#2c3e50", fontSize: "0.88rem" }}>
                      <FaFileInvoiceDollar className="me-1" style={{ color: "#3498db" }} />
                      Préstamo #{id_prestamo}
                    </span>
                    {prestamo && (
                      <>
                        <span style={{ fontSize: "0.75rem", color: "#7f8c8d" }}>
                          Principal: <strong style={{ color: "#2c3e50" }}>L. {fmt(montoPr)}</strong>
                        </span>
                        <span style={{ fontSize: "0.75rem", color: "#7f8c8d" }}>
                          Saldo: <strong style={{ color: "#e74c3c" }}>L. {fmt(saldoPr)}</strong>
                        </span>
                        <span style={{ fontSize: "0.75rem", color: "#7f8c8d" }}>
                          Pagado: <strong style={{ color: "#27ae60" }}>L. {fmt(pagadoPr)}</strong>
                        </span>
                        <span className="ms-auto badge"
                          style={completado
                            ? { background: "rgba(39,174,96,0.12)", color: "#1e8449", border: "1.5px solid #27ae60", fontSize: 11, padding: "3px 10px" }
                            : { background: "rgba(52,152,219,0.1)", color: "#2980b9", border: "1.5px solid #3498db", fontSize: 11, padding: "3px 10px" }}>
                          {completado
                            ? <><FaCheckCircle className="me-1" />Completado</>
                            : <><FaClock className="me-1" />{Math.round(progresoPr)}% pagado</>}
                        </span>
                      </>
                    )}
                  </div>
                  {/* Barra de progreso */}
                  <div style={{ height: 3, background: "#e9ecef" }}>
                    <div style={{ height: "100%", width: `${Math.min(progresoPr, 100)}%`, background: completado ? "#27ae60" : "#3498db", transition: "width .4s" }} />
                  </div>

                  {/* Filas de pagos */}
                  {pagosList
                    .sort((a, b) => new Date(b.fecha_pago || b.fecha) - new Date(a.fecha_pago || a.fecha))
                    .map((pago, idx) => {
                      const fecha = (pago.fecha_pago || pago.fecha || "").substring(0, 10);
                      const monto = parseFloat(pago.monto_pagado || pago.monto || 0);
                      const mp = metodoBadgeMap[(pago.metodo_pago || "").toLowerCase()] || { label: pago.metodo_pago || "—", color: "#7f8c8d", bg: "#f1f1f1" };

                      return (
                        <div key={pago.id_pago}
                          className="d-flex align-items-center flex-wrap gap-2 px-4 py-2 border-bottom"
                          style={{ background: idx % 2 === 0 ? "white" : "#fafbfc", fontSize: "0.84rem" }}>
                          {/* N° */}
                          <div className="rounded-circle d-flex align-items-center justify-content-center fw-bold flex-shrink-0"
                            style={{ width: 26, height: 26, background: "rgba(52,152,219,0.1)", color: "#3498db", fontSize: 11 }}>
                            {idx + 1}
                          </div>

                          {/* Monto */}
                          <div className="fw-bold flex-shrink-0" style={{ color: "#27ae60", minWidth: 95 }}>
                            L. {fmt(monto)}
                          </div>

                          {/* Desglose int/cap */}
                          {(pago.monto_interes != null || pago.monto_capital != null) && (
                            <div className="d-flex gap-1 flex-wrap">
                              <span style={{ fontSize: "0.68rem", fontWeight: 600, background: "rgba(230,126,34,0.12)", color: "#d35400", border: "1px solid #e67e22", borderRadius: 4, padding: "1px 5px" }}>
                                Int. L.{fmt(pago.monto_interes)}
                              </span>
                              <span style={{ fontSize: "0.68rem", fontWeight: 600, background: "rgba(39,174,96,0.12)", color: "#1e8449", border: "1px solid #27ae60", borderRadius: 4, padding: "1px 5px" }}>
                                Cap. L.{fmt(pago.monto_capital)}
                              </span>
                            </div>
                          )}

                          {/* Fecha */}
                          <span className="badge d-inline-flex align-items-center gap-1 flex-shrink-0"
                            style={{ background: "rgba(155,89,182,0.1)", color: "#9b59b6", border: "1.5px solid #9b59b6", borderRadius: 8, fontSize: 11, fontWeight: 600, padding: "3px 8px" }}>
                            <FaCalendarAlt style={{ fontSize: 10 }} />{fecha}
                          </span>

                          {/* Método */}
                          <span className="badge flex-shrink-0"
                            style={{ background: mp.bg, color: mp.color, border: `1.5px solid ${mp.color}`, borderRadius: 8, fontSize: 11, fontWeight: 600, padding: "3px 8px" }}>
                            {mp.label}
                          </span>

                          {/* Descripción */}
                          {pago.descripcion && (
                            <span className="text-muted" style={{ fontSize: "0.72rem", fontStyle: "italic", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              "{pago.descripcion}"
                            </span>
                          )}

                          {/* Acciones */}
                          <div className="ms-auto d-flex gap-1 flex-shrink-0">
                            <button className="btn btn-sm btn-outline-dark" title="Ver / imprimir recibo"
                              onClick={() => setReciboPago(pago.id_pago)}
                              style={{ padding: "3px 8px", fontSize: 12, marginRight: 4 }}>
                              Recibo
                            </button>
                            <button className="btn btn-sm" title="Editar"
                              onClick={() => { onClose(); setTimeout(() => onEdit(pago), 60); }}
                              style={{ background: "rgba(52,152,219,0.1)", color: "#3498db", border: "1px solid #3498db", borderRadius: "6px 0 0 6px", padding: "3px 8px" }}
                              onMouseEnter={e => { e.currentTarget.style.background = "#3498db"; e.currentTarget.style.color = "white"; }}
                              onMouseLeave={e => { e.currentTarget.style.background = "rgba(52,152,219,0.1)"; e.currentTarget.style.color = "#3498db"; }}>
                              <FaEdit style={{ fontSize: 12 }} />
                            </button>
                            <button className="btn btn-sm" title="Eliminar"
                              onClick={() => onDelete(pago.id_pago)}
                              style={{ background: "rgba(231,76,60,0.1)", color: "#e74c3c", border: "1px solid #e74c3c", borderLeft: "none", borderRadius: "0 6px 6px 0", padding: "3px 8px" }}
                              onMouseEnter={e => { e.currentTarget.style.background = "#e74c3c"; e.currentTarget.style.color = "white"; }}
                              onMouseLeave={e => { e.currentTarget.style.background = "rgba(231,76,60,0.1)"; e.currentTarget.style.color = "#e74c3c"; }}>
                              <FaTrash style={{ fontSize: 12 }} />
                            </button>
                          </div>
                        </div>
                      );
                    })}

                  {/* Subtotal por préstamo */}
                  <div className="d-flex justify-content-end align-items-center gap-3 px-4 py-2"
                    style={{ background: "rgba(39,174,96,0.05)", borderBottom: "2px solid #e2e8f0" }}>
                    <span className="small text-muted">Subtotal préstamo #{id_prestamo}:</span>
                    <strong style={{ color: "#27ae60" }}>L. {fmt(subtotalPr)}</strong>
                  </div>
                </div>
              );
            })}
          </div>

          {reciboPago && (
            <ReciboModal referenciaTipo="pago" referenciaId={reciboPago} onClose={() => setReciboPago(null)} />
          )}

          {/* Footer */}
          <div className="modal-footer border-0 bg-white px-4 py-2 d-flex justify-content-between align-items-center">
            <div className="d-flex gap-4">
              <span className="small fw-semibold text-muted">
                <FaCheckCircle className="me-1 text-success" />
                Total pagos: <strong className="text-primary">{grupo.pagos.length}</strong>
              </span>
              <span className="small fw-semibold text-muted">
                Acumulado: <strong style={{ color: "#27ae60" }}>L. {fmt(totalGeneral)}</strong>
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
