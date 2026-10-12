import { useEffect, useState } from "react";
import axios from "axios";
import ReciboModal from "./ReciboModal";
import CartasAprobacionSocio from "./CartasAprobacionSocio";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const fmt = (n) =>
  `L. ${parseFloat(n || 0).toLocaleString("es-HN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const TIPOS = {
  pago_prestamo: "Pago de préstamo",
  aportacion: "Aportación",
  desembolso: "Desembolso",
};

// Lista los recibos emitidos a un socio y permite verlos, imprimirlos o compartirlos de nuevo.
// Arriba, las cartas de sus préstamos aprobados.
export default function RecibosSocioModal({ idSocio, nombreSocio, telefono, headers, onClose }) {
  const [recibos, setRecibos] = useState(null);
  const [error, setError] = useState("");
  const [abierto, setAbierto] = useState(null);

  useEffect(() => {
    let activo = true;
    axios
      .get(`${API_URL}/recibos/socio/${idSocio}`, { headers })
      .then((r) => activo && setRecibos(r.data.data || []))
      .catch(() => activo && setError("No se pudieron cargar los recibos."));
    return () => {
      activo = false;
    };
  }, [idSocio, headers]);

  return (
    <div
      className="modal show d-block"
      style={{ background: "rgba(0,0,0,.6)", zIndex: 5500, position: "fixed", inset: 0, overflowY: "auto" }}
    >
      <div className="modal-dialog modal-dialog-centered modal-lg">
        <div className="modal-content border-0 shadow-lg" style={{ borderRadius: 16 }}>
          <div className="modal-header border-0 pb-0">
            <div>
              <h5 className="modal-title fw-bold">Recibos emitidos</h5>
              <div className="small text-muted">{nombreSocio}</div>
            </div>
            <button type="button" className="btn-close" onClick={onClose} />
          </div>
          <div className="modal-body" style={{ maxHeight: "65vh", overflowY: "auto" }}>
            <div className="p-3 mb-3" style={{ background: "#f0f7e6", borderRadius: 12 }}>
              <CartasAprobacionSocio idSocio={idSocio} telefono={telefono} headers={headers} />
            </div>
            <div className="fw-bold mb-2">Recibos</div>
            {error && <div className="alert alert-danger">{error}</div>}
            {!recibos && !error && (
              <div className="text-center py-4">
                <div className="spinner-border spinner-border-sm text-success" />
              </div>
            )}
            {recibos && recibos.length === 0 && (
              <div className="text-muted text-center py-4">Este socio aún no tiene recibos.</div>
            )}
            {recibos && recibos.length > 0 && (
              <table className="table table-sm align-middle mb-0">
                <thead>
                  <tr className="small text-muted">
                    <th>N.º</th>
                    <th>Fecha</th>
                    <th>Tipo</th>
                    <th>Concepto</th>
                    <th className="text-end">Monto</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {recibos.map((r) => (
                    <tr key={r.id_recibo} style={{ opacity: r.anulado ? 0.55 : 1 }}>
                      <td className="fw-semibold">{r.numero}</td>
                      <td>{String(r.fecha).substring(0, 10)}</td>
                      <td>
                        {TIPOS[r.tipo] || r.tipo}
                        {r.anulado && <span className="badge bg-danger ms-1">Anulado</span>}
                      </td>
                      <td className="small text-muted">{r.concepto}</td>
                      <td className="text-end">{fmt(r.monto)}</td>
                      <td className="text-end">
                        <button className="btn btn-sm btn-outline-dark" onClick={() => setAbierto(r.id_recibo)}>
                          Ver
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {abierto && <ReciboModal idRecibo={abierto} onClose={() => setAbierto(null)} />}
    </div>
  );
}
