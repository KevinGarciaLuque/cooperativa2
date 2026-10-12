import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { FaFilePdf } from "react-icons/fa";
import { CamposMonto, CamposIngresos } from "./CamposSolicitud";
import { SOLICITUD_VACIA, fmt, solicitudDesde } from "../utils/solicitud";
import { descargarCarta } from "../utils/cartaAprobacion";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const ESTADOS = {
  pendiente: { label: "En revisión", bg: "#fef3c7", color: "#92400e" },
  aprobado: { label: "Aprobada", bg: "#d1fae5", color: "#065f46" },
  activo: { label: "Desembolsada", bg: "#dbeafe", color: "#1e40af" },
  rechazado: { label: "No aprobada", bg: "#fee2e2", color: "#991b1b" },
  pagado: { label: "Pagada", bg: "#e5e7eb", color: "#374151" },
  mora: { label: "En mora", bg: "#fee2e2", color: "#991b1b" },
};

// Estados en los que ya existe la carta de aprobación
const CON_CARTA = ["aprobado", "activo", "mora", "pagado"];

// Formulario con el que el socio pide un préstamo: la cooperativa lo recibe para su revisión
export default function SolicitudPrestamoSocio({ token, onEnviada }) {
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const [param, setParam] = useState(null);
  const [mias, setMias] = useState([]);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const [exito, setExito] = useState("");
  const [form, setForm] = useState(SOLICITUD_VACIA);
  const [acepta, setAcepta] = useState(false);

  const cargarMias = () =>
    axios
      .get(`${API_URL}/solicitudes/mias`, { headers })
      .then((r) => setMias(r.data.data || []))
      .catch(() => setMias([]));

  useEffect(() => {
    axios
      .get(`${API_URL}/solicitudes/parametros`, { headers })
      .then((r) => setParam(r.data.data))
      .catch(() => setError("No se pudieron cargar los datos del formulario."));
    cargarMias();
    // eslint-disable-next-line
  }, [headers]);

  const enviar = async (e) => {
    e.preventDefault();
    setError("");
    setExito("");
    setEnviando(true);
    try {
      const r = await axios.post(`${API_URL}/solicitudes/prestamo`, solicitudDesde(form, acepta), { headers });
      setExito(r.data.message);
      setForm((f) => ({ ...f, monto: "", plazo_meses: "", cuota_posible: "", descripcion: "" }));
      setAcepta(false);
      cargarMias();
      if (onEnviada) onEnviada();
    } catch (err) {
      setError(err.response?.data?.message || "No se pudo enviar la solicitud.");
    } finally {
      setEnviando(false);
    }
  };

  const bajarCarta = async (id) => {
    try {
      await descargarCarta(id, token);
    } catch {
      setError("No se pudo descargar la carta de aprobación.");
    }
  };

  // Solo una solicitud en revisión bloquea el formulario: una ya aprobada deja pedir otra
  const enTramite = mias.some((m) => m.estado === "pendiente");

  return (
    <div className="d-flex flex-column gap-3">
      {mias.length > 0 && (
        <div className="card border-0 shadow-sm rounded-4">
          <div className="card-body p-4">
            <h6 className="fw-bold mb-3">Mis solicitudes</h6>
            {mias.map((m) => {
              const e = ESTADOS[m.estado] || { label: m.estado, bg: "#e5e7eb", color: "#374151" };
              return (
                <div key={m.id_prestamo} className="d-flex flex-wrap justify-content-between align-items-center gap-2 py-2 border-bottom">
                  <div>
                    <div className="fw-semibold">{fmt(m.monto)} a {m.plazo_meses} meses</div>
                    <div className="small text-muted">
                      Cuota estimada {fmt(m.cuota_estimada)} · {String(m.creada_en).substring(0, 10)}
                    </div>
                    {m.estado === "rechazado" && m.motivo_rechazo && (
                      <div className="small text-danger">Motivo: {m.motivo_rechazo}</div>
                    )}
                  </div>
                  <div className="d-flex align-items-center gap-2">
                    {CON_CARTA.includes(m.estado) && (
                      <button className="btn btn-sm btn-outline-success" onClick={() => bajarCarta(m.id_prestamo)}>
                        <FaFilePdf className="me-1" /> Carta de aprobación
                      </button>
                    )}
                    <span className="badge rounded-pill px-3 py-2" style={{ background: e.bg, color: e.color }}>
                      {e.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="card border-0 shadow-sm rounded-4">
        <div className="card-body p-4">
          <h5 className="fw-bold mb-1">Solicitar un préstamo</h5>
          <p className="text-muted small mb-4">
            Completa el formulario y la cooperativa revisará tu solicitud. La tasa y las condiciones finales las confirma la
            cooperativa al aprobarla.
          </p>

          {enTramite ? (
            <div className="alert alert-info mb-0">
              Tu solicitud está en revisión. Podrás enviar otra cuando la cooperativa responda la actual.
            </div>
          ) : (
            <form onSubmit={enviar}>
              <CamposMonto param={param} form={form} setForm={setForm} />
              <div className="mt-3">
                <CamposIngresos form={form} setForm={setForm} />
              </div>

              <div className="row g-3 mt-0">
                <div className="col-12">
                  <div className="form-check">
                    <input
                      id="acepta-sol" type="checkbox" className="form-check-input"
                      checked={acepta} onChange={(e) => setAcepta(e.target.checked)}
                    />
                    <label htmlFor="acepta-sol" className="form-check-label small">
                      Declaro que la información es verdadera y autorizo a la cooperativa a verificarla.
                    </label>
                  </div>
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
                    type="submit" className="btn btn-lg fw-bold"
                    style={{ background: "#a8cd3a", color: "#1a2a00", borderRadius: 12 }}
                    disabled={enviando || !acepta}
                  >
                    {enviando ? "Enviando..." : "Enviar solicitud"}
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
