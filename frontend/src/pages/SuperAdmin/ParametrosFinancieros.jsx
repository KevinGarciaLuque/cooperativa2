import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import { useAlerta } from "../../context/AlertaContext";
import { FaSlidersH } from "react-icons/fa";

const ACCENT = "#a8cd3a";
const AZUL = "#1a2035";
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export default function ParametrosFinancieros() {
  const { token } = useAuth();
  const { mostrarAlerta } = useAlerta();
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const [tasa, setTasa] = useState("");
  const [gracia, setGracia] = useState("");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    axios
      .get(`${API_URL}/configuracion/financiera`, { headers })
      .then((res) => {
        setTasa(String(res.data.data.mora_tasa_anual));
        setGracia(String(res.data.data.mora_dias_gracia));
      })
      .catch(() => mostrarAlerta("No se pudieron cargar los parámetros.", "error"))
      .finally(() => setCargando(false));
    // eslint-disable-next-line
  }, [headers]);

  const guardar = async (e) => {
    e.preventDefault();
    setGuardando(true);
    try {
      await axios.put(
        `${API_URL}/configuracion/financiera`,
        { mora_tasa_anual: parseFloat(tasa), mora_dias_gracia: parseInt(gracia) },
        { headers }
      );
      mostrarAlerta("Parámetros financieros guardados.", "success");
    } catch (err) {
      mostrarAlerta(err.response?.data?.message || "No se pudieron guardar los parámetros.", "error");
    } finally {
      setGuardando(false);
    }
  };

  const mensual = tasa !== "" && !isNaN(parseFloat(tasa)) ? (parseFloat(tasa) / 12).toFixed(2) : "—";

  return (
    <div className="container-fluid py-3" style={{ maxWidth: 760 }}>
      <h3 className="fw-bold mb-0" style={{ color: AZUL }}>
        <FaSlidersH className="me-2" />
        Parámetros financieros
      </h3>
      <p className="text-muted">Reglas de cobro que usa todo el sistema. Los cambios aplican de inmediato.</p>

      <form onSubmit={guardar} className="p-4" style={{ background: "#fff", borderRadius: "1rem", boxShadow: "0 2px 12px #0000000f" }}>
        <h5 className="fw-bold mb-3" style={{ color: AZUL }}>Mora por atraso</h5>

        <div className="row g-3">
          <div className="col-12 col-md-6">
            <label className="form-label fw-semibold">Tasa de mora anual (%)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              max="120"
              className="form-control"
              value={tasa}
              onChange={(e) => setTasa(e.target.value)}
              disabled={cargando}
              required
            />
            <div className="form-text">Equivale a {mensual}% mensual. Se cobra sobre el saldo, por cada día de atraso.</div>
          </div>
          <div className="col-12 col-md-6">
            <label className="form-label fw-semibold">Días de gracia</label>
            <input
              type="number"
              step="1"
              min="0"
              max="90"
              className="form-control"
              value={gracia}
              onChange={(e) => setGracia(e.target.value)}
              disabled={cargando}
              required
            />
            <div className="form-text">Días desde el último pago antes de que empiece a contar la mora.</div>
          </div>
        </div>

        <div className="mt-4">
          <button type="submit" className="btn fw-semibold" style={{ background: ACCENT, color: "#1a2a00" }} disabled={guardando || cargando}>
            {guardando ? "Guardando..." : "Guardar parámetros"}
          </button>
        </div>
      </form>
    </div>
  );
}
