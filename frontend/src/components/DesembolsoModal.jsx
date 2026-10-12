import { useState } from "react";

const fmt = (n) =>
  `L. ${parseFloat(n || 0).toLocaleString("es-HN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const OPCIONES = [
  { value: "efectivo", label: "Efectivo", desc: "Se entrega en ventanilla y sale de caja" },
  { value: "transferencia", label: "Transferencia", desc: "Sale de caja como egreso bancario" },
  { value: "cheque", label: "Cheque", desc: "Sale de caja como egreso" },
  { value: "cuenta", label: "Depósito a cuenta", desc: "Se acredita en la cuenta de Aportaciones del socio" },
];

// Ventana para registrar el desembolso de un préstamo aprobado
export default function DesembolsoModal({ prestamo, nombreSocio, enviando, onConfirmar, onCancelar }) {
  const [metodo, setMetodo] = useState("efectivo");
  const [referencia, setReferencia] = useState("");

  return (
    <div
      className="modal show d-block"
      style={{ background: "rgba(0,0,0,.6)", zIndex: 6000, position: "fixed", inset: 0, overflowY: "auto" }}
    >
      <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: 480 }}>
        <div className="modal-content border-0 shadow-lg" style={{ borderRadius: 16 }}>
          <div className="modal-header border-0 pb-0">
            <h5 className="modal-title fw-bold">Desembolsar préstamo #{prestamo.id_prestamo}</h5>
            <button type="button" className="btn-close" onClick={onCancelar} />
          </div>
          <div className="modal-body">
            <div className="p-3 mb-3" style={{ background: "#f1f5f9", borderRadius: 10 }}>
              <div className="small text-muted">Socio</div>
              <div className="fw-semibold">{nombreSocio}</div>
              <div className="small text-muted mt-2">Monto a entregar</div>
              <div className="fw-bold fs-4">{fmt(prestamo.monto)}</div>
              <div className="small text-muted">
                Plazo: {parseInt(prestamo.plazo_meses) === 0 ? "indefinido" : `${prestamo.plazo_meses} meses`}. El plazo empieza hoy.
              </div>
            </div>

            <label className="form-label fw-semibold small">¿Cómo se entrega?</label>
            <div className="d-flex flex-column gap-2 mb-3">
              {OPCIONES.map((o) => (
                <label
                  key={o.value}
                  className="d-flex align-items-start gap-2 p-2 rounded-3"
                  style={{
                    border: `1.5px solid ${metodo === o.value ? "#a8cd3a" : "#e2e8f0"}`,
                    background: metodo === o.value ? "#f7fbe8" : "#fff",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="radio"
                    name="metodo-desembolso"
                    checked={metodo === o.value}
                    onChange={() => setMetodo(o.value)}
                    className="mt-1"
                  />
                  <span>
                    <span className="fw-semibold">{o.label}</span>
                    <span className="d-block small text-muted">{o.desc}</span>
                  </span>
                </label>
              ))}
            </div>

            {metodo !== "efectivo" && metodo !== "cuenta" && (
              <>
                <label className="form-label fw-semibold small">Número de referencia (opcional)</label>
                <input
                  className="form-control mb-2"
                  value={referencia}
                  onChange={(e) => setReferencia(e.target.value)}
                  maxLength={100}
                  placeholder="N.º de transferencia o cheque"
                />
              </>
            )}
          </div>
          <div className="modal-footer border-0 pt-0">
            <button className="btn btn-outline-secondary" onClick={onCancelar} disabled={enviando}>
              Cancelar
            </button>
            <button
              className="btn fw-semibold"
              style={{ background: "#a8cd3a", color: "#1a2a00" }}
              disabled={enviando}
              onClick={() => onConfirmar({ metodo, referencia })}
            >
              {enviando ? "Registrando..." : "Confirmar desembolso"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
