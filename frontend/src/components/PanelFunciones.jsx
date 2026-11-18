// Control de Accesos → Funciones nuevas: el Super Administrador enciende cada función cuando
// quiere que el personal la vea. Apagadas, solo él las ve (para probarlas).
import { useEffect, useState } from "react";
import axios from "axios";
import { FaFlask, FaSave } from "react-icons/fa";
import { olvidarFunciones } from "../hooks/useFunciones";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export default function PanelFunciones({ token, mostrarAlerta }) {
  const [catalogo, setCatalogo] = useState([]);
  const [estado, setEstado] = useState({});
  const [guardando, setGuardando] = useState(false);
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    axios
      .get(`${API_URL}/configuracion/funciones`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => {
        setCatalogo(r.data.catalogo || []);
        setEstado(r.data.estado || {});
      })
      .catch(() => {});
  }, [token]);

  const guardar = async () => {
    setGuardando(true);
    try {
      await axios.put(`${API_URL}/configuracion/funciones`, estado, { headers });
      olvidarFunciones();
      mostrarAlerta("Funciones guardadas.", "success");
    } catch (e) {
      mostrarAlerta(e.response?.data?.message || "No se pudieron guardar las funciones.", "error");
    } finally {
      setGuardando(false);
    }
  };

  if (!catalogo.length) return null;
  return (
    <div className="card border-0 shadow-sm mt-4" style={{ borderRadius: 16 }}>
      <div
        className="card-header border-0 py-3 px-4"
        style={{ background: "linear-gradient(135deg, #1a2035 0%, #2d3a5a 100%)", borderRadius: "16px 16px 0 0" }}
      >
        <div className="d-flex align-items-center gap-2">
          <FaFlask style={{ color: "#a8cd3a", fontSize: 18 }} />
          <span className="fw-semibold text-white" style={{ fontSize: 15 }}>Funciones nuevas</span>
        </div>
      </div>
      <div className="card-body p-4">
        <p className="text-muted small">
          Apagada, una función solo la ves tú (Super Administrador) para probarla. Encendida, la ve todo el personal según
          los permisos de su rol.
        </p>
        {catalogo.map((c) => (
          <div key={c.clave} className="d-flex align-items-start gap-3 py-2 border-bottom">
            <div className="form-check form-switch mt-1">
              <input
                id={`fn-${c.clave}`}
                type="checkbox"
                className="form-check-input"
                role="switch"
                checked={!!estado[c.clave]}
                disabled={c.proximamente}
                onChange={(e) => setEstado({ ...estado, [c.clave]: e.target.checked })}
              />
            </div>
            <label htmlFor={`fn-${c.clave}`} className="flex-grow-1">
              <div className="fw-semibold">
                {c.nombre}{" "}
                {c.proximamente ? (
                  <span className="badge bg-light text-muted border">Próximamente</span>
                ) : estado[c.clave] ? (
                  <span className="badge bg-success">Visible para el personal</span>
                ) : (
                  <span className="badge bg-secondary">Solo tú la ves</span>
                )}
              </div>
              <div className="small text-muted">{c.descripcion}</div>
            </label>
          </div>
        ))}
        <button className="btn btn-primary mt-3" onClick={guardar} disabled={guardando}>
          <FaSave className="me-2" />
          {guardando ? "Guardando..." : "Guardar funciones"}
        </button>
      </div>
    </div>
  );
}
