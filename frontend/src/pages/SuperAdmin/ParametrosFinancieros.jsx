import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import { useAlerta } from "../../context/AlertaContext";
import { FaBell, FaSlidersH } from "react-icons/fa";

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
  const [sol, setSol] = useState({ sol_tasa_mensual: "", sol_monto_max: "", sol_plazo_max: "", sol_pct_ingreso_max: "" });
  const [rec, setRec] = useState({ rec_activo: true, rec_dias_antes: "3", rec_mora_cada: "7" });
  const [enviando, setEnviando] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    axios
      .get(`${API_URL}/configuracion/financiera`, { headers })
      .then((res) => {
        setTasa(String(res.data.data.mora_tasa_anual));
        setGracia(String(res.data.data.mora_dias_gracia));
        setSol({
          sol_tasa_mensual: String(res.data.data.sol_tasa_mensual),
          sol_monto_max: String(res.data.data.sol_monto_max),
          sol_plazo_max: String(res.data.data.sol_plazo_max),
          sol_pct_ingreso_max: String(res.data.data.sol_pct_ingreso_max),
        });
        setRec({
          rec_activo: parseInt(res.data.data.rec_activo) === 1,
          rec_dias_antes: String(res.data.data.rec_dias_antes ?? 3),
          rec_mora_cada: String(res.data.data.rec_mora_cada ?? 7),
        });
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
        {
          mora_tasa_anual: parseFloat(tasa),
          mora_dias_gracia: parseInt(gracia),
          ...prov,
          ...sol,
          rec_activo: rec.rec_activo ? 1 : 0,
          rec_dias_antes: rec.rec_dias_antes,
          rec_mora_cada: rec.rec_mora_cada,
        },
        { headers }
      );
      mostrarAlerta("Parámetros financieros guardados.", "success");
    } catch (err) {
      mostrarAlerta(err.response?.data?.message || "No se pudieron guardar los parámetros.", "error");
    } finally {
      setGuardando(false);
    }
  };

  // Envía ya los recordatorios que tocan hoy (no repite los que ya salieron)
  const enviarAhora = async () => {
    if (!window.confirm("¿Enviar ahora los recordatorios de pago que tocan hoy? Los que ya se enviaron no se repiten.")) return;
    setEnviando(true);
    try {
      const r = await axios.post(`${API_URL}/cobranza/recordatorios/ejecutar`, {}, { headers });
      mostrarAlerta(r.data.message, "success");
    } catch (err) {
      mostrarAlerta(err.response?.data?.message || "No se pudieron enviar los recordatorios.", "error");
    } finally {
      setEnviando(false);
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

        <h5 className="fw-bold mt-4 mb-1" style={{ color: AZUL }}>Solicitudes de préstamo de los socios</h5>
        <p className="text-muted small">
          Valores que usa el formulario que ve el socio. La tasa es solo referencial: tú confirmas las condiciones al aprobar.
        </p>
        <div className="row g-3">
          {[
            ["sol_tasa_mensual", "Tasa referencial mensual (%)", "0.01"],
            ["sol_monto_max", "Monto máximo a solicitar (L.)", "1"],
            ["sol_plazo_max", "Plazo máximo (meses)", "1"],
            ["sol_pct_ingreso_max", "Alerta si la cuota supera (% del ingreso)", "1"],
          ].map(([k, etiqueta, paso]) => (
            <div className="col-12 col-md-6" key={k}>
              <label className="form-label fw-semibold small">{etiqueta}</label>
              <input
                type="number"
                step={paso}
                min="0"
                className="form-control"
                value={sol[k]}
                onChange={(e) => setSol({ ...sol, [k]: e.target.value })}
                disabled={cargando}
              />
            </div>
          ))}
        </div>

        <h5 className="fw-bold mt-4 mb-1" style={{ color: AZUL }}>
          <FaBell className="me-2" />
          Recordatorios de pago
        </h5>
        <p className="text-muted small">
          Cada mañana a las 8:00 el sistema envía un correo a los socios cuya cuota está por vencer y a los que están en
          mora. Cada envío queda anotado en Cobranza.
        </p>
        <div className="form-check form-switch mb-3">
          <input
            id="rec-activo"
            type="checkbox"
            className="form-check-input"
            checked={rec.rec_activo}
            onChange={(e) => setRec({ ...rec, rec_activo: e.target.checked })}
            disabled={cargando}
          />
          <label htmlFor="rec-activo" className="form-check-label">
            Envío automático {rec.rec_activo ? "activado" : "desactivado"}
          </label>
        </div>
        <div className="row g-3">
          <div className="col-12 col-md-6">
            <label className="form-label fw-semibold small">Avisar antes del vencimiento (días)</label>
            <input
              type="number" min="0" max="15" step="1" className="form-control"
              value={rec.rec_dias_antes}
              onChange={(e) => setRec({ ...rec, rec_dias_antes: e.target.value })}
              disabled={cargando}
            />
            <div className="form-text">0 = no enviar aviso previo.</div>
          </div>
          <div className="col-12 col-md-6">
            <label className="form-label fw-semibold small">En mora, repetir cada (días)</label>
            <input
              type="number" min="0" max="30" step="1" className="form-control"
              value={rec.rec_mora_cada}
              onChange={(e) => setRec({ ...rec, rec_mora_cada: e.target.value })}
              disabled={cargando}
            />
            <div className="form-text">0 = solo el primer día de atraso.</div>
          </div>
        </div>
        <button type="button" className="btn btn-outline-dark btn-sm mt-3" disabled={enviando || cargando} onClick={enviarAhora}>
          <FaBell className="me-1" /> {enviando ? "Enviando..." : "Enviar los recordatorios de hoy ahora"}
        </button>

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
