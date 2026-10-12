// Aval y referencia personal de una solicitud de préstamo.
// Las solicitudes anteriores no traen "tipo": se muestran como referencias.
import { FaPhoneAlt, FaUserShield, FaUserFriends } from "react-icons/fa";

const ETIQUETA = { aval: "Aval", referencia: "Referencia" };

export default function AvalReferencias({ referencias = [], vacio = "Sin aval ni referencias." }) {
  if (!referencias.length) return <div className="small text-muted">{vacio}</div>;
  return (
    <div className="d-flex flex-column gap-1">
      {referencias.map((r, i) => {
        const esAval = r.tipo === "aval";
        const tel = String(r.telefono || "").replace(/\D/g, "");
        return (
          <div key={i} className="small d-flex flex-wrap align-items-center gap-2">
            <span
              className="badge"
              style={{ background: esAval ? "#dcfce7" : "#e0e7ff", color: esAval ? "#166534" : "#3730a3", minWidth: 78 }}
            >
              {esAval ? <FaUserShield className="me-1" /> : <FaUserFriends className="me-1" />}
              {ETIQUETA[r.tipo] || "Referencia"}
            </span>
            <strong>{r.nombre}</strong>
            {r.parentesco && <span className="text-muted">({r.parentesco})</span>}
            <a href={`tel:${tel}`} className="text-decoration-none">
              <FaPhoneAlt className="me-1" size={11} />
              {r.telefono}
            </a>
          </div>
        );
      })}
    </div>
  );
}
