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
  const [prov, setProv] = useState({ prov_al_dia: "", prov_1_30: "", prov_31_60: "", prov_61_90: "", prov_90_mas: "" });
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    axios
      .get(`${API_URL}/configuracion/financiera`, { headers })
      .then((res) => {
        setTasa(String(res.data.data.mora_tasa_anual));
        setGracia(String(res.data.data.mora_dias_gracia));
        setProv({
          prov_al_dia: String(res.data.data.prov_al_dia),
          prov_1_30: String(res.data.data.prov_1_30),
          prov_31_60: String(res.data.data.prov_31_60),
          prov_61_90: String(res.data.data.prov_61_90),
          prov_90_mas: String(res.data.data.prov_90_mas),
        });
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
        { mora_tasa_anual: parseFloat(tasa), mora_dias_gracia: parseInt(gracia), ...prov },
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

        <h5 className="fw-bold mt-4 mb-1" style={{ color: AZUL }}>Provisión de cartera</h5>
        <p className="text-muted small">
          Porcentaje del saldo que se reserva según la antigüedad del atraso. Se usa en Contabilidad.
        </p>
        <div className="row g-3">
          {[
            ["prov_al_dia", "Al día / por vencer"],
            ["prov_1_30", "Mora 1-30 días"],
            ["prov_31_60", "Mora 31-60 días"],
            ["prov_61_90", "Mora 61-90 días"],
            ["prov_90_mas", "Mora de más de 90 días"],
          ].map(([k, etiqueta]) => (
            <div className="col-6 col-md-4" key={k}>
              <label className="form-label fw-semibold small">{etiqueta} (%)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                className="form-control"
                value={prov[k]}
                onChange={(e) => setProv({ ...prov, [k]: e.target.value })}
                disabled={cargando}
              />
            </div>
          ))}
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
