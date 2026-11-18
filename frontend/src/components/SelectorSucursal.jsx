// Selector de sucursal en la barra superior (personal). Solo aparece si la cooperativa tiene
// más de una sucursal. Un usuario que solo ve su sucursal la ve fija.
import { useEffect, useState } from "react";
import axios from "axios";
import { FaStore } from "react-icons/fa";
import { guardarSucursal, sucursalGuardada } from "../utils/sucursalVista";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export default function SelectorSucursal({ token }) {
  const [info, setInfo] = useState(null);

  useEffect(() => {
    if (!token) return;
    axios
      .get(`${API_URL}/configuracion/sucursales`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => {
        setInfo(r.data);
        // Una sucursal guardada que ya no existe vuelve a "todas"
        const g = sucursalGuardada();
        if (g && !(r.data.data || []).some((s) => String(s.id_sucursal) === g)) guardarSucursal("");
      })
      .catch(() => setInfo(null));
  }, [token]);

  if (!info || (info.data || []).length < 2) return null;

  const estilo = {
    background: "rgba(255,255,255,0.08)",
    color: "#fff",
    border: "1px solid rgba(168,205,58,0.45)",
    borderRadius: 10,
    fontSize: ".85rem",
    padding: "6px 10px",
    maxWidth: 190,
  };

  if (info.restringida) {
    const mia = info.data.find((s) => s.id_sucursal === info.mi_sucursal);
    return (
      <span className="d-flex align-items-center gap-2 text-nowrap" style={{ ...estilo, cursor: "default" }} title="Tu sucursal">
        <FaStore style={{ color: "#a8cd3a" }} />
        <span className="d-none d-sm-inline">{mia?.nombre || "Mi sucursal"}</span>
      </span>
    );
  }

  return (
    <label className="d-flex align-items-center gap-2 mb-0" title="Sucursal que estás viendo">
      <FaStore className="d-none d-sm-inline" style={{ color: "#a8cd3a" }} />
      <select
        className="form-select form-select-sm"
        style={{ ...estilo, backgroundColor: "#222d45" }}
        value={sucursalGuardada()}
        onChange={(e) => {
          guardarSucursal(e.target.value);
          // Se recarga para que todas las pantallas traigan los datos de la sucursal elegida
          window.location.reload();
        }}
        aria-label="Sucursal"
      >
        <option value="">Todas las sucursales</option>
        {info.data.map((s) => (
          <option key={s.id_sucursal} value={s.id_sucursal}>
            {s.nombre}
          </option>
        ))}
      </select>
    </label>
  );
}
