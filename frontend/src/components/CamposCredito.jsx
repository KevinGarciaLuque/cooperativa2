// Datos ampliados del crédito (función "datos_ampliados"): línea, destino, promotor, pagaré,
// acta y cheque. Se usa dentro del formulario de préstamo.
import { useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { useFunciones } from "../hooks/useFunciones";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
export const CAMPOS_CREDITO = ["linea_credito", "destino", "id_promotor", "numero_pagare", "numero_acta", "numero_cheque", "fecha_recepcion", "numero_solicitud"];

export default function CamposCredito({ form, handleInput }) {
  const { token } = useAuth();
  const { datos_ampliados: habilitada } = useFunciones();
  const [cat, setCat] = useState({ lineas: [], promotores: [] });

  useEffect(() => {
    if (!habilitada || !token) return;
    axios
      .get(`${API_URL}/prestamos/catalogos`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => setCat({ lineas: r.data.lineas || [], promotores: r.data.promotores || [] }))
      .catch(() => {});
  }, [habilitada, token]);

  if (!habilitada) return null;
  const v = (k) => form[k] ?? "";
  return (
    <div className="p-3 border-top">
      <div className="fw-semibold small mb-2" style={{ color: "#1a2035" }}>Datos del crédito</div>
      <div className="row g-2">
        <div className="col-6 col-md-4">
          <label className="form-label small mb-1">Línea</label>
          <select className="form-select form-select-sm" name="linea_credito" value={v("linea_credito")} onChange={handleInput}>
            <option value="">—</option>
            {cat.lineas.map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
        </div>
        <div className="col-6 col-md-8">
          <label className="form-label small mb-1">Destino</label>
          <input className="form-control form-control-sm" name="destino" maxLength={150} placeholder="Ej.: compra de terreno" value={v("destino")} onChange={handleInput} />
        </div>
        <div className="col-12 col-md-6">
          <label className="form-label small mb-1">Promotor / asesor</label>
          <select className="form-select form-select-sm" name="id_promotor" value={v("id_promotor")} onChange={handleInput}>
            <option value="">—</option>
            {cat.promotores.map((p) => (
              <option key={p.id_usuario} value={p.id_usuario}>{p.nombre_completo}</option>
            ))}
          </select>
        </div>
        <div className="col-4 col-md-2">
          <label className="form-label small mb-1">N.º pagaré</label>
          <input className="form-control form-control-sm" name="numero_pagare" maxLength={30} value={v("numero_pagare")} onChange={handleInput} />
        </div>
        <div className="col-4 col-md-2">
          <label className="form-label small mb-1">N.º acta</label>
          <input className="form-control form-control-sm" name="numero_acta" maxLength={30} value={v("numero_acta")} onChange={handleInput} />
        </div>
        <div className="col-4 col-md-2">
          <label className="form-label small mb-1">N.º cheque</label>
          <input className="form-control form-control-sm" name="numero_cheque" maxLength={30} value={v("numero_cheque")} onChange={handleInput} />
        </div>
        <div className="col-6 col-md-4">
          <label className="form-label small mb-1">Fecha de recepción</label>
          <input type="date" className="form-control form-control-sm" name="fecha_recepcion" value={String(v("fecha_recepcion")).substring(0, 10)} onChange={handleInput} />
        </div>
        <div className="col-6 col-md-4">
          <label className="form-label small mb-1">N.º de solicitud</label>
          <input className="form-control form-control-sm" name="numero_solicitud" maxLength={30} value={v("numero_solicitud")} onChange={handleInput} />
        </div>
      </div>
    </div>
  );
}
