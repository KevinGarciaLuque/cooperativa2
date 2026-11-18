// Calificación del socio para un préstamo: puntaje de 0 a 100, letra (A a E), el detalle de cada
// factor y las alertas. Solo con la función "calificacion_credito"; el socio no la ve.
import { useEffect, useState } from "react";
import axios from "axios";
import { FaExclamationTriangle, FaGavel, FaChevronDown, FaChevronUp } from "react-icons/fa";
import { useFunciones } from "../hooks/useFunciones";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const COLOR_LETRA = {
  A: ["#15803d", "#dcfce7"],
  B: ["#4d7c0f", "#ecfccb"],
  C: ["#b45309", "#fef3c7"],
  D: ["#c2410c", "#ffedd5"],
  E: ["#b91c1c", "#fee2e2"],
};

export default function CalificacionSocio({ idPrestamo, token, compacta = false }) {
  const { calificacion_credito: activa } = useFunciones();
  const [d, setD] = useState(null);
  const [error, setError] = useState("");
  const [abierta, setAbierta] = useState(!compacta);

  useEffect(() => {
    if (!activa || !idPrestamo) return;
    let vigente = true;
    setD(null);
    setError("");
    axios
      .get(`${API_URL}/prestamos/${idPrestamo}/calificacion`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => vigente && setD(r.data))
      .catch((e) => vigente && setError(e.response?.data?.message || "No se pudo calcular la calificación."));
    return () => {
      vigente = false;
    };
  }, [activa, idPrestamo, token]);

  if (!activa || !idPrestamo) return null;
  if (error) return <div className="small text-muted">{error}</div>;
  if (!d) return <div className="small text-muted"><span className="spinner-border spinner-border-sm me-2" />Calculando la calificación…</div>;

  const c = d.data;
  const [color, fondo] = COLOR_LETRA[c.letra] || COLOR_LETRA.C;

  return (
    <div className="rounded-3 p-3" style={{ background: "#fff", border: `1px solid ${fondo}`, boxShadow: `inset 4px 0 0 ${color}` }}>
      <button
        type="button"
        className="w-100 border-0 bg-transparent p-0 d-flex align-items-center gap-3 text-start"
        onClick={() => setAbierta((a) => !a)}
        aria-expanded={abierta}
      >
        <div
          className="flex-shrink-0 d-flex flex-column align-items-center justify-content-center"
          style={{ width: 58, height: 58, borderRadius: "50%", background: fondo, color, border: `3px solid ${color}` }}
        >
          <span className="fw-bold" style={{ fontSize: "1.35rem", lineHeight: 1 }}>{c.letra}</span>
          <span style={{ fontSize: ".66rem", fontWeight: 700 }}>{c.puntaje}/100</span>
        </div>
        <div className="flex-grow-1" style={{ minWidth: 0 }}>
          <div className="small text-muted">Calificación del socio</div>
          <div className="fw-bold" style={{ color }}>{c.nivel}</div>
          {c.alertas.length > 0 && (
            <div className="small" style={{ color: "#b45309" }}>
              <FaExclamationTriangle className="me-1" />
              {c.alertas.length} {c.alertas.length === 1 ? "alerta" : "alertas"}
            </div>
          )}
        </div>
        <span className="text-muted">{abierta ? <FaChevronUp /> : <FaChevronDown />}</span>
      </button>

      {abierta && (
        <div className="mt-3">
          {c.factores.map((f) => (
            <div key={f.clave} className="mb-2">
              <div className="d-flex justify-content-between small">
                <span className="fw-semibold">{f.nombre}</span>
                <span className="text-muted">{f.puntos} de {f.max}</span>
              </div>
              <div style={{ height: 6, borderRadius: 3, background: "#eef2f6", overflow: "hidden" }}>
                <div style={{ width: `${(f.puntos / f.max) * 100}%`, height: "100%", background: f.puntos / f.max >= 0.66 ? "#22c55e" : f.puntos / f.max >= 0.33 ? "#f59e0b" : "#ef4444" }} />
              </div>
              <div className="text-muted" style={{ fontSize: ".76rem" }}>{f.detalle}</div>
            </div>
          ))}
          {c.alertas.length > 0 && (
            <div className="rounded-2 p-2 mt-2 small" style={{ background: "#fffbeb", border: "1px solid #fde68a", color: "#92400e" }}>
              {c.alertas.map((a) => (
                <div key={a}><FaExclamationTriangle className="me-1" />{a}</div>
              ))}
            </div>
          )}
          {d.comite_motivo && (
            <div className="rounded-2 p-2 mt-2 small" style={{ background: "#eef2ff", border: "1px solid #c7d2fe", color: "#3730a3" }}>
              <FaGavel className="me-1" />{d.comite_motivo}
            </div>
          )}
          {d.guardada && (
            <div className="text-muted mt-2" style={{ fontSize: ".74rem" }}>
              Al aprobarse tenía {d.guardada.letra} ({d.guardada.puntaje} puntos).
            </div>
          )}
        </div>
      )}
    </div>
  );
}
