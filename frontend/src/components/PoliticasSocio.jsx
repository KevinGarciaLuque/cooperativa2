// Políticas de la cooperativa para el socio: la pestaña para consultarlas y el aviso que
// pide aceptarlas cuando hay una nueva o un cambio importante.
import { useEffect, useState } from "react";
import axios from "axios";
import { FaBook, FaCheckCircle, FaChevronDown, FaChevronUp, FaSignOutAlt } from "react-icons/fa";
import TextoPolitica from "./TextoPolitica";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const fecha = (v) => {
  const d = new Date(v);
  return isNaN(d) ? "" : d.toLocaleDateString("es-HN", { day: "numeric", month: "long", year: "numeric" });
};

// Lista de políticas que se abren para leerlas
function ListaPoliticas({ lista, abiertaInicial = null, mostrarEstado = true }) {
  const [abierta, setAbierta] = useState(abiertaInicial);
  return (
    <div className="d-flex flex-column gap-2">
      {lista.map((p) => {
        const open = abierta === p.id_politica;
        return (
          <div key={p.id_politica} className="rounded-3" style={{ border: "1px solid #e2e8f0", background: "#fff" }}>
            <button
              type="button"
              className="w-100 border-0 bg-transparent text-start d-flex align-items-center gap-2 p-3"
              onClick={() => setAbierta(open ? null : p.id_politica)}
            >
              <FaBook className="flex-shrink-0" style={{ color: "#64748b" }} />
              <span className="flex-grow-1">
                <span className="fw-semibold d-block">{p.titulo}</span>
                <span className="small text-muted">
                  Versión {p.version} · {fecha(p.publicada_en)}
                  {mostrarEstado && p.aceptada && (
                    <span className="text-success ms-2">
                      <FaCheckCircle className="me-1" />
                      Aceptada el {fecha(p.aceptada_en)}
                    </span>
                  )}
                  {mostrarEstado && p.pendiente && <span className="text-warning fw-semibold ms-2">Pendiente de aceptar</span>}
                </span>
              </span>
              {open ? <FaChevronUp /> : <FaChevronDown />}
            </button>
            {open && (
              <div className="px-3 pb-3 small" style={{ borderTop: "1px solid #f1f5f9" }}>
                <TextoPolitica texto={p.contenido} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Pestaña "Políticas" del perfil del socio
export default function PoliticasSocio({ headers, version }) {
  const [lista, setLista] = useState(null);

  useEffect(() => {
    axios
      .get(`${API_URL}/politicas/mias`, { headers })
      .then((r) => setLista(r.data.data || []))
      .catch(() => setLista([]));
  }, [headers, version]);

  return (
    <div className="card border-0 shadow-sm rounded-4">
      <div className="card-body p-4">
        <h5 className="fw-bold mb-1">Políticas de la cooperativa</h5>
        <p className="text-muted small mb-3">
          Las reglas de préstamos, pagos, privacidad y uso de la app que aceptaste como socio.
        </p>
        {lista === null ? (
          <div className="spinner-border spinner-border-sm text-success" />
        ) : lista.length === 0 ? (
          <div className="text-muted small">La cooperativa aún no ha publicado sus políticas.</div>
        ) : (
          <ListaPoliticas lista={lista} />
        )}
      </div>
    </div>
  );
}

// Aviso que no deja seguir hasta aceptar las políticas pendientes
export function AceptarPoliticas({ headers, onLogout, onAceptadas }) {
  const [pendientes, setPendientes] = useState([]);
  const [acepto, setAcepto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    axios
      .get(`${API_URL}/politicas/mias`, { headers })
      .then((r) => setPendientes((r.data.data || []).filter((p) => p.pendiente)))
      .catch(() => setPendientes([]));
  }, [headers]);

  if (!pendientes.length) return null;
  const actualizacion = pendientes.every((p) => p.version_aceptada);

  const aceptar = async () => {
    setEnviando(true);
    setError("");
    try {
      await axios.post(`${API_URL}/politicas/aceptar`, { ids: pendientes.map((p) => p.id_politica) }, { headers });
      setPendientes([]);
      onAceptadas?.();
    } catch (err) {
      setError(err.response?.data?.message || "No se pudo registrar. Intenta de nuevo.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div
      className="d-flex align-items-center justify-content-center p-3"
      style={{ position: "fixed", inset: 0, zIndex: 7500, background: "rgba(15,23,42,.7)" }}
    >
      <div className="bg-white shadow-lg d-flex flex-column" style={{ borderRadius: 18, width: "min(640px, 100%)", maxHeight: "92vh" }}>
        <div className="p-4 pb-2">
          <h5 className="fw-bold mb-1">
            {actualizacion ? "Actualizamos nuestras políticas" : "Políticas de la cooperativa"}
          </h5>
          <p className="text-muted small mb-0">
            Antes de continuar, lee {pendientes.length > 1 ? "las siguientes políticas" : "la siguiente política"} y
            confirma que estás de acuerdo. Tócala para leerla.
          </p>
        </div>
        <div className="px-4 py-2" style={{ overflowY: "auto", background: "#f8fafc" }}>
          <ListaPoliticas lista={pendientes} abiertaInicial={pendientes.length === 1 ? pendientes[0].id_politica : null} mostrarEstado={false} />
        </div>
        <div className="p-4 pt-3">
          <div className="form-check mb-3">
            <input id="acepto-politicas" type="checkbox" className="form-check-input" checked={acepto} onChange={(e) => setAcepto(e.target.checked)} />
            <label htmlFor="acepto-politicas" className="form-check-label small">
              He leído y acepto {pendientes.length > 1 ? "estas políticas" : "esta política"}.
            </label>
          </div>
          {error && <div className="alert alert-danger py-2 small">{error}</div>}
          <div className="d-flex flex-wrap gap-2 justify-content-between">
            <button type="button" className="btn btn-link text-secondary px-0" onClick={onLogout}>
              <FaSignOutAlt className="me-1" /> Cerrar sesión
            </button>
            <button
              type="button"
              className="btn fw-bold px-4"
              style={{ background: "#a8cd3a", color: "#1a2a00" }}
              disabled={!acepto || enviando}
              onClick={aceptar}
            >
              {enviando ? "Guardando..." : "Aceptar y continuar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Para el formulario de registro: las políticas publicadas, para leerlas antes de aceptar
export function VerPoliticasPublicas({ onCerrar }) {
  const [lista, setLista] = useState(null);
  useEffect(() => {
    axios
      .get(`${API_URL}/politicas/publicas`)
      .then((r) => setLista(r.data.data || []))
      .catch(() => setLista([]));
  }, []);
  return (
    <div
      className="d-flex align-items-center justify-content-center p-3"
      style={{ position: "fixed", inset: 0, zIndex: 7500, background: "rgba(15,23,42,.7)" }}
      onClick={onCerrar}
    >
      <div
        className="bg-white shadow-lg d-flex flex-column"
        style={{ borderRadius: 18, width: "min(640px, 100%)", maxHeight: "92vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 pb-2 d-flex justify-content-between align-items-start">
          <h5 className="fw-bold mb-0">Políticas de la cooperativa</h5>
          <button type="button" className="btn-close" onClick={onCerrar} />
        </div>
        <div className="px-4 pb-4" style={{ overflowY: "auto" }}>
          {lista === null ? (
            <div className="spinner-border spinner-border-sm text-success" />
          ) : (
            <ListaPoliticas lista={lista} mostrarEstado={false} abiertaInicial={lista[0]?.id_politica} />
          )}
        </div>
      </div>
    </div>
  );
}
