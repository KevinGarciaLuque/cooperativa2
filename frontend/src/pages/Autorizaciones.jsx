// Autorizaciones: operaciones que pasan del límite del rol, acciones "con autorización" y
// omitir la mora. Quien autoriza ve todas las pendientes; los demás, las suyas.
// Al autorizar, la operación se aplica sola a nombre de quien la pidió.
import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { FaUserShield, FaCheck, FaTimes, FaUndo, FaClock, FaHistory } from "react-icons/fa";
import { useAuth } from "../context/AuthContext";
import { useAlerta } from "../context/AlertaContext";
import { dinero } from "../utils/pais";
import Pestanas from "../components/Pestanas";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const AZUL = "#1a2035";
const ACCENT = "#a8cd3a";
const ESTADO = {
  pendiente: ["Pendiente", "#b45309", "#fef3c7"],
  aprobada: ["Aplicando", "#1d4ed8", "#dbeafe"],
  ejecutando: ["Aplicando", "#1d4ed8", "#dbeafe"],
  ejecutada: ["Autorizada y aplicada", "#15803d", "#dcfce7"],
  fallida: ["Autorizada, no se aplicó", "#b91c1c", "#fee2e2"],
  rechazada: ["Rechazada", "#b91c1c", "#fee2e2"],
  cancelada: ["Retirada", "#64748b", "#f1f5f9"],
};
const fecha = (v) => (v ? String(v).replace("T", " ").substring(0, 16) : "");

export default function Autorizaciones() {
  const { token } = useAuth();
  const { mostrarAlerta } = useAlerta();
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const [vista, setVista] = useState("pendiente");
  const [datos, setDatos] = useState({ data: [], puede_resolver: false });
  const [cargando, setCargando] = useState(true);
  const [rechazando, setRechazando] = useState(null);
  const [nota, setNota] = useState("");
  const [ocupado, setOcupado] = useState(null);

  const cargar = useCallback(() => {
    setCargando(true);
    axios
      .get(`${API_URL}/autorizaciones`, { headers, params: vista === "pendiente" ? { estado: "pendiente" } : {} })
      .then((r) => setDatos(r.data))
      .catch((e) => mostrarAlerta(e.response?.data?.message || "No se pudieron cargar las autorizaciones.", "error"))
      .finally(() => setCargando(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headers, vista]);
  useEffect(() => {
    cargar();
  }, [cargar]);

  const autorizar = async (a) => {
    if (!window.confirm(`¿Autorizar y aplicar ahora?\n\n${a.descripcion}\nPedido por ${a.solicitante}.`)) return;
    setOcupado(a.id_autorizacion);
    try {
      const r = await axios.post(`${API_URL}/autorizaciones/${a.id_autorizacion}/aprobar`, {}, { headers });
      mostrarAlerta(r.data.message, "success");
    } catch (e) {
      mostrarAlerta(e.response?.data?.message || "No se pudo autorizar.", "error");
    }
    setOcupado(null);
    cargar();
  };
  const rechazar = async () => {
    try {
      await axios.post(`${API_URL}/autorizaciones/${rechazando.id_autorizacion}/rechazar`, { nota }, { headers });
      mostrarAlerta("Solicitud rechazada.", "success");
      setRechazando(null);
      setNota("");
      cargar();
    } catch (e) {
      mostrarAlerta(e.response?.data?.message || "No se pudo rechazar.", "error");
    }
  };
  const retirar = async (a) => {
    if (!window.confirm("¿Retirar tu solicitud?")) return;
    try {
      await axios.post(`${API_URL}/autorizaciones/${a.id_autorizacion}/cancelar`, {}, { headers });
      cargar();
    } catch (e) {
      mostrarAlerta(e.response?.data?.message || "No se pudo retirar.", "error");
    }
  };

  const pendientes = datos.data.filter((a) => a.estado === "pendiente").length;

  return (
    <div className="container-fluid py-3">
      <div className="d-flex align-items-center gap-3 mb-3">
        <div className="d-flex align-items-center justify-content-center" style={{ width: 48, height: 48, borderRadius: 12, background: AZUL, color: ACCENT }}>
          <FaUserShield size={20} />
        </div>
        <div>
          <h4 className="fw-bold mb-0" style={{ color: AZUL }}>Autorizaciones</h4>
          <div className="text-muted small">
            {datos.puede_resolver
              ? "Operaciones que esperan tu visto bueno: al autorizar, se aplican a nombre de quien las pidió."
              : "Tus operaciones que esperan la autorización de un superior."}
          </div>
        </div>
      </div>
      <Pestanas
        activa={vista}
        onCambiar={setVista}
        tabs={[
          { clave: "pendiente", titulo: "Pendientes", icono: <FaClock />, cuenta: vista === "pendiente" ? pendientes : 0, alerta: true },
          { clave: "todas", titulo: "Historial", icono: <FaHistory /> },
        ]}
      />
      <div className="card border-0 shadow-sm" style={{ borderRadius: 14 }}>
        <div className="card-body">
          {cargando ? (
            <div className="text-center py-4"><div className="spinner-border spinner-border-sm" /></div>
          ) : datos.data.length === 0 ? (
            <div className="text-center text-muted py-4">{vista === "pendiente" ? "No hay operaciones esperando autorización." : "Todavía no hay solicitudes."}</div>
          ) : (
            <div className="table-responsive">
              <table className="table align-middle mb-0">
                <thead>
                  <tr className="small text-muted"><th>#</th><th>Operación</th><th>Pidió</th><th>Motivo</th><th>Estado</th><th /></tr>
                </thead>
                <tbody>
                  {datos.data.map((a) => {
                    const [t, c, f] = ESTADO[a.estado] || [a.estado, "#475569", "#f1f5f9"];
                    return (
                      <tr key={a.id_autorizacion}>
                        <td className="text-muted">{a.id_autorizacion}</td>
                        <td>
                          <div className="fw-semibold">{a.descripcion}</div>
                          {a.monto !== null && <div className="small text-muted">{dinero(a.monto)}</div>}
                        </td>
                        <td className="small">{a.solicitante}<div className="text-muted">{fecha(a.creada_en)}</div></td>
                        <td className="small" style={{ maxWidth: 280 }}>
                          {a.motivo}
                          {a.justificacion && <div className="text-muted">“{a.justificacion}”</div>}
                        </td>
                        <td className="small">
                          <span className="badge rounded-pill" style={{ background: f, color: c }}>{t}</span>
                          {a.resolvio && <div className="text-muted mt-1">{a.resolvio} · {fecha(a.resuelto_en)}</div>}
                          {a.nota && <div className="text-muted">Nota: {a.nota}</div>}
                          {a.estado === "fallida" && a.resultado && <div className="text-danger">{a.resultado}</div>}
                        </td>
                        <td className="text-end text-nowrap">
                          {a.estado === "pendiente" && datos.puede_resolver && !a.propia && (
                            <>
                              <button className="btn btn-sm fw-semibold me-1" style={{ background: ACCENT, color: "#1a2a00" }} onClick={() => autorizar(a)} disabled={ocupado === a.id_autorizacion}>
                                <FaCheck className="me-1" /> {ocupado === a.id_autorizacion ? "Aplicando…" : "Autorizar"}
                              </button>
                              <button className="btn btn-sm btn-outline-danger" onClick={() => setRechazando(a)}>
                                <FaTimes />
                              </button>
                            </>
                          )}
                          {a.estado === "pendiente" && a.propia && (
                            <button className="btn btn-sm btn-outline-secondary" onClick={() => retirar(a)}>
                              <FaUndo className="me-1" /> Retirar
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {rechazando && (
        <div className="modal d-block" style={{ background: "rgba(0,0,0,.4)" }} onClick={() => setRechazando(null)}>
          <div className="modal-dialog modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content" style={{ borderRadius: 14 }}>
              <div className="modal-header">
                <h5 className="modal-title">Rechazar solicitud #{rechazando.id_autorizacion}</h5>
                <button className="btn-close" onClick={() => setRechazando(null)} />
              </div>
              <div className="modal-body">
                <p className="small mb-2">{rechazando.descripcion} · pidió {rechazando.solicitante}</p>
                <label className="form-label small">Motivo (lo ve quien la pidió)</label>
                <textarea className="form-control" rows={3} maxLength={300} value={nota} onChange={(e) => setNota(e.target.value)} />
              </div>
              <div className="modal-footer">
                <button className="btn btn-light" onClick={() => setRechazando(null)}>Cancelar</button>
                <button className="btn btn-danger" onClick={rechazar} disabled={!nota.trim()}>Rechazar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
