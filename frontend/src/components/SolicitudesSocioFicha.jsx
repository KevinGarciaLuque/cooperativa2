// Solicitudes de préstamo de un socio con su aval y referencia (ficha del socio en Ventanilla)
import { useEffect, useState } from "react";
import axios from "axios";
import AvalReferencias from "./AvalReferencias";
import { OCUPACIONES, PROPOSITOS, fmt } from "../utils/solicitud";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const ESTADOS = {
  pendiente: ["En revisión", "#fef3c7", "#92400e"],
  aprobado: ["Aprobada", "#d1fae5", "#065f46"],
  activo: ["Desembolsada", "#dbeafe", "#1e40af"],
  mora: ["En mora", "#fee2e2", "#991b1b"],
  pagado: ["Pagada", "#e5e7eb", "#374151"],
  rechazado: ["No aprobada", "#fee2e2", "#991b1b"],
};

export default function SolicitudesSocioFicha({ idSocio, headers }) {
  const [lista, setLista] = useState(null);

  useEffect(() => {
    let activo = true;
    axios
      .get(`${API_URL}/solicitudes/socio/${idSocio}`, { headers })
      .then((r) => activo && setLista(r.data.data || []))
      .catch(() => activo && setLista([]));
    return () => {
      activo = false;
    };
  }, [idSocio, headers]);

  if (!lista) {
    return <div className="spinner-border spinner-border-sm text-success" />;
  }
  if (!lista.length) {
    return <div className="small text-muted">El socio no ha enviado solicitudes de préstamo.</div>;
  }

  return (
    <div className="d-flex flex-column gap-3">
      {lista.map((s, i) => {
        const [etiqueta, fondo, color] = ESTADOS[s.estado] || [s.estado, "#e5e7eb", "#374151"];
        return (
          <div key={s.id_prestamo} className={i > 0 ? "pt-3 border-top" : ""}>
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-1">
              <div className="fw-semibold">
                Solicitud #{s.id_prestamo} · {fmt(s.monto)} a {s.plazo_meses} meses
              </div>
              <span className="badge" style={{ background: fondo, color }}>
                {etiqueta}
              </span>
            </div>
            <div className="small text-muted mb-2">
              {String(s.creada_en).substring(0, 10)} · {PROPOSITOS[s.proposito] || s.proposito}
              {s.descripcion ? ` — ${s.descripcion}` : ""} · {OCUPACIONES[s.ocupacion] || s.ocupacion}
              {s.lugar_trabajo ? ` (${s.lugar_trabajo})` : ""} · Ingreso {fmt(s.ingreso_mensual)}
            </div>
            <AvalReferencias referencias={s.referencias} vacio="Sin aval registrado en esta solicitud." />
          </div>
        );
      })}
    </div>
  );
}
