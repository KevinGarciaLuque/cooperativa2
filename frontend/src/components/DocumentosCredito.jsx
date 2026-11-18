// Botones para bajar el contrato y el pagaré en Word de un préstamo (función "contratos_word").
import { useState } from "react";
import axios from "axios";
import { FaFileWord } from "react-icons/fa";
import { useFunciones } from "../hooks/useFunciones";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export const bajarArchivo = async (url, token, nombre) => {
  const r = await axios.get(url, { headers: { Authorization: `Bearer ${token}` }, responseType: "blob" });
  const enlace = document.createElement("a");
  enlace.href = URL.createObjectURL(r.data);
  enlace.download = nombre;
  enlace.click();
  URL.revokeObjectURL(enlace.href);
};

// Lee el mensaje de error que viene dentro de una respuesta tipo blob
export const mensajeBlob = async (e, porDefecto) => {
  try {
    return JSON.parse(await e.response.data.text()).message || porDefecto;
  } catch {
    return porDefecto;
  }
};

export default function DocumentosCredito({ idPrestamo, token, onError }) {
  const { contratos_word: habilitada } = useFunciones();
  const [bajando, setBajando] = useState("");
  if (!habilitada || !idPrestamo) return null;
  const bajar = async (tipo) => {
    setBajando(tipo);
    try {
      await bajarArchivo(`${API_URL}/documentos-credito/prestamos/${idPrestamo}/${tipo}`, token, `${tipo}_prestamo_${idPrestamo}.docx`);
    } catch (e) {
      onError?.(await mensajeBlob(e, "No se pudo generar el documento."));
    } finally {
      setBajando("");
    }
  };
  return (
    <div className="d-flex gap-2 flex-wrap">
      {[["contrato", "Contrato"], ["pagare", "Pagaré"]].map(([tipo, texto]) => (
        <button key={tipo} type="button" className="btn btn-sm btn-outline-primary" disabled={!!bajando} onClick={() => bajar(tipo)}>
          <FaFileWord className="me-1" /> {bajando === tipo ? "Generando..." : `${texto} (Word)`}
        </button>
      ))}
    </div>
  );
}
