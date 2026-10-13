// El socio reporta un pago hecho por transferencia, depósito o pago móvil, con la foto o el PDF
// del comprobante. La cooperativa lo revisa y, al confirmarlo, queda registrado con su recibo.
import { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { FaCamera, FaCheckCircle, FaClock, FaTimesCircle, FaUniversity } from "react-icons/fa";
import InputMonto from "../ui/InputMonto";
import { comprimirImagen } from "../utils/imagen";
import { hoyLocal } from "../utils/fechas";
import { fmt } from "../utils/solicitud";
import { verComprobanteReportado } from "../utils/pagosReportados";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const METODOS = [
  ["Transferencia", "🏦 Transferencia"],
  ["Deposito", "🏧 Depósito"],
  ["Pago móvil", "📱 Pago móvil"],
];
const ESTADOS = {
  pendiente: { label: "En revisión", icono: <FaClock />, bg: "#fef3c7", color: "#92400e" },
  confirmado: { label: "Confirmado", icono: <FaCheckCircle />, bg: "#d1fae5", color: "#065f46" },
  rechazado: { label: "No registrado", icono: <FaTimesCircle />, bg: "#fee2e2", color: "#991b1b" },
};

const VACIO = { id_prestamo: "", monto: "", metodo: "Transferencia", banco: "", referencia: "", fecha_pago: "", nota: "" };

export default function ReportarPagoSocio({ token }) {
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const [prestamos, setPrestamos] = useState(null);
  const [reportes, setReportes] = useState([]);
  const [form, setForm] = useState({ ...VACIO, fecha_pago: hoyLocal() });
  const [archivo, setArchivo] = useState(null);
  const [vista, setVista] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const [exito, setExito] = useState("");
  const entrada = useRef(null);

  const cargar = () => {
    axios
      .get(`${API_URL}/prestamos`, { headers })
      .then((r) => {
        const vigentes = (r.data.data || []).filter((p) => ["activo", "mora"].includes((p.estado || "").toLowerCase()));
        setPrestamos(vigentes);
        if (vigentes.length === 1) {
          setForm((f) => ({
            ...f,
            id_prestamo: f.id_prestamo || String(vigentes[0].id_prestamo),
            monto: f.monto || (vigentes[0].cuota_minima ? String(vigentes[0].cuota_minima) : ""),
          }));
        }
      })
      .catch(() => setPrestamos([]));
    axios
      .get(`${API_URL}/pagos-reportados/mios`, { headers })
      .then((r) => setReportes(r.data.data || []))
      .catch(() => setReportes([]));
  };

  useEffect(() => {
    cargar();
    // eslint-disable-next-line
  }, [headers]);

  useEffect(() => {
    if (!archivo || !archivo.type.startsWith("image/")) return setVista(null);
    const url = URL.createObjectURL(archivo);
    setVista(url);
    return () => URL.revokeObjectURL(url);
  }, [archivo]);

  const cambiar = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const elegirPrestamo = (id) => {
    const p = prestamos.find((x) => String(x.id_prestamo) === id);
    setForm((f) => ({ ...f, id_prestamo: id, monto: p?.cuota_minima ? String(p.cuota_minima) : f.monto }));
  };

  const elegirArchivo = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (f) setArchivo(await comprimirImagen(f));
  };

  const enviar = async (e) => {
    e.preventDefault();
    setError("");
    setExito("");
    if (!archivo) return setError("Adjunta la foto o el PDF del comprobante.");
    setEnviando(true);
    try {
      const datos = new FormData();
      Object.entries(form).forEach(([k, v]) => datos.append(k, v));
      datos.append("comprobante", archivo);
      const r = await axios.post(`${API_URL}/pagos-reportados`, datos, { headers });
      setExito(r.data.message);
      setArchivo(null);
      setForm((f) => ({ ...VACIO, id_prestamo: f.id_prestamo, fecha_pago: hoyLocal() }));
      cargar();
    } catch (err) {
      setError(err.response?.data?.message || "No se pudo reportar el pago.");
    } finally {
      setEnviando(false);
    }
  };

  const enRevision = (id) => reportes.some((r) => r.estado === "pendiente" && String(r.id_prestamo) === String(id));

  return (
    <div className="d-flex flex-column gap-3">
      <div className="card border-0 shadow-sm rounded-4">
        <div className="card-body p-4">
          <h5 className="fw-bold mb-1">
            <FaUniversity className="me-2" />
            Reportar un pago
          </h5>
          <p className="text-muted small mb-4">
            ¿Pagaste por transferencia, depósito o pago móvil? Súbelo aquí con la foto del comprobante. La cooperativa
            lo revisa y, al confirmarlo, recibes tu recibo.
          </p>

          {prestamos === null ? (
            <div className="spinner-border spinner-border-sm text-success" />
          ) : prestamos.length === 0 ? (
            <div className="alert alert-info mb-0">No tienes préstamos vigentes para reportar pagos.</div>
          ) : (
            <form onSubmit={enviar}>
              <div className="row g-3">
                <div className="col-12 col-md-6">
                  <label className="form-label fw-semibold small">Préstamo *</label>
                  <select required className="form-select" value={form.id_prestamo} onChange={(e) => elegirPrestamo(e.target.value)}>
                    <option value="">Selecciona...</option>
                    {prestamos.map((p) => (
                      <option key={p.id_prestamo} value={p.id_prestamo}>
                        Préstamo #{p.id_prestamo} · saldo {fmt(p.saldo_restante)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-12 col-md-6">
                  <label className="form-label fw-semibold small">¿Cuánto pagaste? (L.) *</label>
                  <InputMonto
                    required className="form-control" placeholder="0.00"
                    value={form.monto} onChange={(v) => setForm((f) => ({ ...f, monto: v }))}
                  />
                </div>

                <div className="col-12">
                  <label className="form-label fw-semibold small">¿Cómo pagaste? *</label>
                  <div className="d-flex flex-wrap gap-2">
                    {METODOS.map(([valor, etiqueta]) => (
                      <button
                        key={valor}
                        type="button"
                        className="btn btn-sm"
                        style={{
                          borderRadius: 20,
                          border: `1.5px solid ${form.metodo === valor ? "#16a34a" : "#e2e8f0"}`,
                          background: form.metodo === valor ? "#dcfce7" : "#fff",
                          fontWeight: form.metodo === valor ? 600 : 400,
                        }}
                        onClick={() => setForm((f) => ({ ...f, metodo: valor }))}
                      >
                        {etiqueta}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="col-12 col-md-4">
                  <label className="form-label fw-semibold small">Banco</label>
                  <input className="form-control" name="banco" maxLength={60} value={form.banco} onChange={cambiar} placeholder="Ej: Banco Atlántida" />
                </div>
                <div className="col-12 col-md-4">
                  <label className="form-label fw-semibold small">N.º de referencia</label>
                  <input className="form-control" name="referencia" maxLength={60} value={form.referencia} onChange={cambiar} />
                </div>
                <div className="col-12 col-md-4">
                  <label className="form-label fw-semibold small">Fecha del pago *</label>
                  <input type="date" required className="form-control" name="fecha_pago" max={hoyLocal()} value={form.fecha_pago} onChange={cambiar} />
                </div>

                <div className="col-12">
                  <label className="form-label fw-semibold small">Comprobante (foto o PDF) *</label>
                  <button
                    type="button"
                    className="w-100 d-flex flex-column align-items-center justify-content-center"
                    style={{
                      minHeight: 120,
                      borderRadius: 12,
                      border: `2px dashed ${archivo ? "#a8cd3a" : "#cbd5e1"}`,
                      background: vista ? `center / contain no-repeat url(${vista}) #f8fafc` : "#f8fafc",
                      color: "#64748b",
                    }}
                    onClick={() => entrada.current?.click()}
                  >
                    {!vista && (
                      <>
                        <FaCamera size={22} className="mb-1" />
                        <span className="small">{archivo ? archivo.name : "Tomar foto o elegir archivo"}</span>
                      </>
                    )}
                  </button>
                  <input ref={entrada} type="file" accept="image/*,application/pdf" className="d-none" onChange={elegirArchivo} />
                </div>

                <div className="col-12">
                  <label className="form-label fw-semibold small">Comentario (opcional)</label>
                  <input className="form-control" name="nota" maxLength={300} value={form.nota} onChange={cambiar} />
                </div>

                {error && (
                  <div className="col-12">
                    <div className="alert alert-danger py-2 mb-0">{error}</div>
                  </div>
                )}
                {exito && (
                  <div className="col-12">
                    <div className="alert alert-success py-2 mb-0">{exito}</div>
                  </div>
                )}
                <div className="col-12">
                  <button
                    type="submit"
                    className="btn btn-lg fw-bold"
                    style={{ background: "#a8cd3a", color: "#1a2a00", borderRadius: 12 }}
                    disabled={enviando || enRevision(form.id_prestamo)}
                  >
                    {enviando ? "Enviando..." : "Reportar pago"}
                  </button>
                  {enRevision(form.id_prestamo) && (
                    <div className="small text-muted mt-2">Ya tienes un pago en revisión para este préstamo.</div>
                  )}
                </div>
              </div>
            </form>
          )}
        </div>
      </div>

      {reportes.length > 0 && (
        <div className="card border-0 shadow-sm rounded-4">
          <div className="card-body p-4">
            <h6 className="fw-bold mb-3">Mis pagos reportados</h6>
            {reportes.map((r) => {
              const e = ESTADOS[r.estado] || ESTADOS.pendiente;
              return (
                <div key={r.id_reporte} className="d-flex flex-wrap justify-content-between align-items-center gap-2 py-2 border-bottom">
                  <div>
                    <div className="fw-semibold">
                      {fmt(r.monto)} · {r.metodo} · Préstamo #{r.id_prestamo}
                    </div>
                    <div className="small text-muted">
                      Pagado el {String(r.fecha_pago).substring(0, 10)}
                      {r.referencia ? ` · Ref. ${r.referencia}` : ""} ·{" "}
                      <button
                        type="button"
                        className="btn btn-link btn-sm p-0 align-baseline"
                        onClick={() => verComprobanteReportado(r.id_reporte, token).catch(() => {})}
                      >
                        ver comprobante
                      </button>
                    </div>
                    {r.estado === "rechazado" && r.motivo_rechazo && (
                      <div className="small text-danger">Motivo: {r.motivo_rechazo}</div>
                    )}
                  </div>
                  <span className="badge rounded-pill px-3 py-2" style={{ background: e.bg, color: e.color }}>
                    {e.icono} <span className="ms-1">{e.label}</span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
