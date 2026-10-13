// "Mis recibos" del socio: pagos de préstamo, aportaciones, desembolsos y constancias.
import { useEffect, useState } from "react";
import axios from "axios";
import { FaReceipt } from "react-icons/fa";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const TIPOS = {
  pago_prestamo: ["Pago de préstamo", "#16a34a", "#dcfce7"],
  aportacion: ["Aportación", "#2563eb", "#dbeafe"],
  desembolso: ["Entrega de préstamo", "#d97706", "#fef3c7"],
  finiquito: ["Constancia de cancelación", "#7c3aed", "#ede9fe"],
};

const fmt = (n) => parseFloat(n || 0).toLocaleString("es-HN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fecha = (v) => {
  const d = new Date(v);
  return isNaN(d) ? "" : d.toLocaleDateString("es-HN", { day: "numeric", month: "short", year: "numeric" });
};

export default function RecibosSocio({ idSocio, headers, onVer }) {
  const [lista, setLista] = useState(null);

  useEffect(() => {
    let activo = true;
    axios
      .get(`${API_URL}/recibos/socio/${idSocio}`, { headers })
      .then((r) => activo && setLista(r.data.data || []))
      .catch(() => activo && setLista([]));
    return () => {
      activo = false;
    };
  }, [idSocio, headers]);

  return (
    <div className="card border-0 shadow-sm rounded-4">
      <div className="card-body p-4">
        <h5 className="fw-bold mb-1">Mis recibos</h5>
        <p className="text-muted small mb-3">
          Todos los recibos que te ha emitido la cooperativa. Tócalos para verlos, descargarlos o compartirlos.
        </p>
        {lista === null ? (
          <div className="spinner-border spinner-border-sm text-success" />
        ) : lista.length === 0 ? (
          <div className="sp-empty">
            <FaReceipt />
            <div>Aún no tienes recibos.</div>
          </div>
        ) : (
          <div className="d-flex flex-column">
            {lista.map((r) => {
              const [etiqueta, color, fondo] = TIPOS[r.tipo] || [r.concepto, "#475569", "#e2e8f0"];
              return (
                <button
                  key={r.id_recibo}
                  type="button"
                  onClick={() => onVer(r.id_recibo)}
                  className="w-100 text-start bg-white border-0 border-bottom d-flex align-items-center gap-3 py-3 px-1"
                  style={{ opacity: r.anulado ? 0.55 : 1 }}
                >
                  <span
                    className="d-flex align-items-center justify-content-center flex-shrink-0"
                    style={{ width: 40, height: 40, borderRadius: 12, background: fondo, color }}
                  >
                    <FaReceipt />
                  </span>
                  <span className="flex-grow-1" style={{ minWidth: 0 }}>
                    <span className="d-block fw-semibold">
                      {etiqueta}
                      {r.anulado && <span className="badge bg-secondary ms-2">Anulado</span>}
                    </span>
                    <span className="d-block small text-muted text-truncate">
                      N.º {r.numero} · {fecha(r.fecha)}
                      {r.concepto && r.concepto !== etiqueta ? ` · ${r.concepto}` : ""}
                    </span>
                  </span>
                  {r.tipo !== "finiquito" && (
                    <span className="fw-bold text-nowrap" style={{ textDecoration: r.anulado ? "line-through" : "none" }}>
                      L. {fmt(r.monto)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
