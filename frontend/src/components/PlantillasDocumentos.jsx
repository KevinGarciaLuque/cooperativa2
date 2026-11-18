// Plantillas del contrato y del pagaré (Super Administrador): bajar la actual para editarla en
// Word, subir una propia o volver a la original. Muestra los marcadores disponibles.
import { useEffect, useState } from "react";
import axios from "axios";
import { FaFileWord, FaUpload, FaUndo, FaDownload } from "react-icons/fa";
import { useFunciones } from "../hooks/useFunciones";
import { bajarArchivo, mensajeBlob } from "./DocumentosCredito";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export default function PlantillasDocumentos({ token, mostrarAlerta }) {
  const { contratos_word: habilitada } = useFunciones();
  const [info, setInfo] = useState(null);
  const headers = { Authorization: `Bearer ${token}` };
  const cargar = () =>
    axios.get(`${API_URL}/documentos-credito/plantillas`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => setInfo(r.data)).catch(() => {});
  useEffect(() => {
    if (habilitada) cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [habilitada, token]);
  if (!habilitada || !info) return null;

  const subir = async (tipo, archivo) => {
    if (!archivo) return;
    const f = new FormData();
    f.append("plantilla", archivo);
    try {
      const r = await axios.put(`${API_URL}/documentos-credito/plantillas/${tipo}`, f, { headers });
      mostrarAlerta(r.data.message, "success");
      cargar();
    } catch (e) {
      mostrarAlerta(e.response?.data?.message || "No se pudo guardar la plantilla.", "error");
    }
  };
  const restaurar = async (tipo) => {
    if (!window.confirm("¿Volver a la plantilla original?")) return;
    await axios.delete(`${API_URL}/documentos-credito/plantillas/${tipo}`, { headers });
    cargar();
  };

  return (
    <div className="card border-0 shadow-sm mt-4" style={{ borderRadius: 14 }}>
      <div className="card-body">
        <h5 className="fw-bold mb-1" style={{ color: "#1a2035" }}><FaFileWord className="me-2" />Plantillas del contrato y del pagaré</h5>
        <p className="text-muted small">
          Baja la plantilla, edítala en Word con el formato de la cooperativa dejando los marcadores entre llaves, y súbela.
          El sistema la prueba antes de guardarla.
        </p>
        {info.data.map((p) => (
          <div key={p.tipo} className="d-flex align-items-center gap-2 flex-wrap py-2 border-bottom">
            <div className="flex-grow-1">
              <strong>{p.nombre}</strong>{" "}
              <span className={`badge ${p.personalizada ? "bg-success" : "bg-secondary"}`}>{p.personalizada ? "Propia" : "Original"}</span>
            </div>
            <button className="btn btn-sm btn-outline-secondary" onClick={() => bajarArchivo(`${API_URL}/documentos-credito/plantillas/${p.tipo}`, token, `plantilla_${p.tipo}.docx`).catch(async (e) => mostrarAlerta(await mensajeBlob(e, "No se pudo bajar."), "error"))}>
              <FaDownload className="me-1" /> Bajar
            </button>
            <label className="btn btn-sm btn-outline-primary mb-0">
              <FaUpload className="me-1" /> Subir .docx
              <input type="file" accept=".docx" hidden onChange={(e) => { subir(p.tipo, e.target.files[0]); e.target.value = ""; }} />
            </label>
            {p.personalizada && (
              <button className="btn btn-sm btn-outline-danger" onClick={() => restaurar(p.tipo)}><FaUndo className="me-1" /> Original</button>
            )}
          </div>
        ))}
        <details className="mt-3">
          <summary className="small fw-semibold" style={{ cursor: "pointer" }}>Marcadores disponibles</summary>
          <div className="row small mt-2">
            {info.campos.map(([k, d]) => (
              <div className="col-12 col-md-6" key={k}><code>{`{${k}}`}</code> — {d}</div>
            ))}
          </div>
        </details>
      </div>
    </div>
  );
}
