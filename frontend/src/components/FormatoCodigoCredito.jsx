// Formato del código de los créditos (configuración avanzada). Se asigna al desembolsar.
import { useEffect, useState } from "react";
import axios from "axios";
import { FaHashtag } from "react-icons/fa";
import { useFunciones } from "../hooks/useFunciones";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export default function FormatoCodigoCredito({ token, mostrarAlerta }) {
  const { configuracion_avanzada: habilitada } = useFunciones();
  const [formato, setFormato] = useState("");
  const [ejemplo, setEjemplo] = useState("");
  useEffect(() => {
    if (!habilitada) return;
    axios
      .get(`${API_URL}/configuracion/codigo-credito`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => {
        setFormato(r.data.formato || "");
        setEjemplo(r.data.ejemplo || "");
      })
      .catch(() => {});
  }, [habilitada, token]);
  if (!habilitada) return null;
  const guardar = async () => {
    try {
      const r = await axios.put(`${API_URL}/configuracion/codigo-credito`, { formato }, { headers: { Authorization: `Bearer ${token}` } });
      setEjemplo(r.data.ejemplo || "");
      mostrarAlerta("Formato guardado. Se usa en los préstamos que se desembolsen desde ahora.", "success");
    } catch (e) {
      mostrarAlerta(e.response?.data?.message || "No se pudo guardar el formato.", "error");
    }
  };
  return (
    <div className="card border-0 shadow-sm mt-4" style={{ borderRadius: 14 }}>
      <div className="card-body">
        <h5 className="fw-bold mb-1" style={{ color: "#1a2035" }}><FaHashtag className="me-2" />Código de los créditos</h5>
        <p className="text-muted small mb-2">
          Vacío = número correlativo (#125). Puedes usar: <code>{"{n}"}</code> número del préstamo (obligatorio), <code>{"{anio}"}</code> o{" "}
          <code>{"{aa}"}</code> año, <code>{"{suc}"}</code> sucursal, <code>{"{prod}"}</code> tres letras del producto, <code>{"{socio}"}</code> número de socio.
        </p>
        <div className="d-flex gap-2 flex-wrap align-items-center">
          <input className="form-control" style={{ maxWidth: 260 }} placeholder="Ej.: {n}-{aa}" maxLength={40} value={formato} onChange={(e) => setFormato(e.target.value)} />
          <button className="btn btn-primary" onClick={guardar}>Guardar</button>
          {ejemplo && <span className="small text-muted">Ejemplo: <strong>{ejemplo}</strong></span>}
        </div>
      </div>
    </div>
  );
}
