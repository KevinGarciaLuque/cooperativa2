// Próximas cuotas de los préstamos vigentes del socio: fecha, monto y cuánto falta
// (o cuántos días lleva atrasada). Sale del plan de pagos que calcula el servidor.
import { FaCalendarCheck, FaExclamationTriangle, FaRegClock } from "react-icons/fa";
import { cifra, simboloMoneda, localeApp } from "../utils/pais";

const hoyISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const aUTC = (iso) => {
  const [a, m, d] = iso.split("-").map(Number);
  return Date.UTC(a, m - 1, d);
};
const diasHasta = (iso) => Math.round((aUTC(iso) - aUTC(hoyISO())) / 86400000);

// "lun. 15 dic. 2026"
const fechaLarga = (iso) => {
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(a, m - 1, d).toLocaleDateString(localeApp(), { weekday: "short", day: "numeric", month: "short", year: "numeric" });
};

export const etiquetaVencimiento = (iso) => {
  const n = diasHasta(iso);
  if (n < 0) return { texto: `Atrasada ${-n} ${-n === 1 ? "día" : "días"}`, color: "#991b1b", fondo: "#fee2e2" };
  if (n === 0) return { texto: "Vence hoy", color: "#9a3412", fondo: "#ffedd5" };
  if (n === 1) return { texto: "Vence mañana", color: "#9a3412", fondo: "#ffedd5" };
  if (n <= 7) return { texto: `En ${n} días`, color: "#92400e", fondo: "#fef3c7" };
  return { texto: `En ${n} días`, color: "#065f46", fondo: "#d1fae5" };
};

// cuotas: { [id_prestamo]: { lista: [{ numero, fecha, monto, estado }], total } }
export default function ProximosPagos({ prestamos, cuotas, loading, onVerPlan }) {
  const filas = prestamos
    .filter((p) => cuotas[p.id_prestamo]?.lista?.length)
    .flatMap((p) => cuotas[p.id_prestamo].lista.map((c) => ({ ...c, prestamo: p, total: cuotas[p.id_prestamo].total })))
    .sort((a, b) => a.fecha.localeCompare(b.fecha));

  if (!loading && !filas.length) return null;

  return (
    <div className="card border-0 shadow-sm rounded-4">
      <div className="card-body p-4">
        <div className="d-flex align-items-center justify-content-between mb-3">
          <div className="d-flex align-items-center gap-2">
            <div style={{ background: "#ede9fe", borderRadius: ".75rem", padding: ".6rem", color: "#5b21b6" }}>
              <FaCalendarCheck size={20} />
            </div>
            <h6 className="mb-0 fw-bold" style={{ fontSize: "1.05rem", color: "#2c3e50" }}>Próximos pagos</h6>
          </div>
          {onVerPlan && filas.length > 0 && (
            <button className="btn btn-link btn-sm p-0 text-decoration-none" style={{ color: "#a8cd3a", fontWeight: 600 }} onClick={onVerPlan}>
              Ver plan completo →
            </button>
          )}
        </div>
        {loading ? (
          <div className="text-center py-3"><div className="spinner-border spinner-border-sm text-secondary" /></div>
        ) : (
          <div className="d-flex flex-column gap-2">
            {filas.map((c, i) => {
              const e = etiquetaVencimiento(c.fecha);
              const atrasada = c.estado === "vencida" || diasHasta(c.fecha) < 0;
              return (
                <div
                  key={`${c.prestamo.id_prestamo}-${c.numero ?? i}`}
                  className="d-flex align-items-center gap-3 rounded-3 px-3 py-2"
                  style={{ background: atrasada ? "#fff5f5" : i === 0 ? "#f7fbea" : "#f8fafc", border: `1px solid ${atrasada ? "#fecaca" : i === 0 ? "#d9ecaa" : "#e2e8f0"}` }}
                >
                  <div className="flex-shrink-0" style={{ color: atrasada ? "#dc2626" : "#64748b" }}>
                    {atrasada ? <FaExclamationTriangle size={18} /> : <FaRegClock size={18} />}
                  </div>
                  <div className="flex-grow-1" style={{ minWidth: 0 }}>
                    <div className="fw-semibold text-capitalize" style={{ color: "#2c3e50" }}>{fechaLarga(c.fecha)}</div>
                    <div className="small text-muted text-truncate">
                      Préstamo #{c.prestamo.id_prestamo}
                      {c.numero ? ` · cuota ${c.numero}${c.total ? ` de ${c.total}` : ""}` : ""}
                      {c.estado === "parcial" ? " · con abono" : ""}
                    </div>
                  </div>
                  <div className="text-end flex-shrink-0">
                    <div className="fw-bold" style={{ color: "#065f46" }}>{simboloMoneda()} {cifra(c.monto)}</div>
                    <span className="badge rounded-pill" style={{ background: e.fondo, color: e.color, fontWeight: 600 }}>{e.texto}</span>
                  </div>
                </div>
              );
            })}
            <div className="small text-muted mt-1">
              Si la cuota ya tiene mora, al pagar se suma el cargo por los días de atraso.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
