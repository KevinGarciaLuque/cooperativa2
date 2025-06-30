import { useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";

export default function Reportes() {
  const { token } = useAuth();
  const [usuarios, setUsuarios] = useState([]);
  const [idUsuario, setIdUsuario] = useState("");
  const [msg, setMsg] = useState("");
  const [downloading, setDownloading] = useState(false);

  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

  // Obtener usuarios
  useEffect(() => {
    axios
      .get(`${API_URL}/usuarios`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => setUsuarios(res.data))
      .catch(() => setMsg("No se pudieron obtener los usuarios."));
    // eslint-disable-next-line
  }, []);

  // Descargar reporte Excel
  const descargarReporte = async () => {
    if (!idUsuario) {
      setMsg("Debes seleccionar un usuario.");
      return;
    }
    setMsg("");
    setDownloading(true);
    try {
      const res = await axios.get(
        `${API_URL}/reportes/estado-cuenta/${idUsuario}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: "blob",
        }
      );
      // Descargar archivo
      const usuario = usuarios.find((u) => u.id_usuario === Number(idUsuario));
      const nombre =
        usuario?.nombre_completo?.replace(/\s+/g, "_") || "usuario";
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `estado_cuenta_${nombre}.xlsx`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setMsg("Reporte descargado correctamente.");
    } catch {
      setMsg("Error al descargar el reporte.");
    }
    setDownloading(false);
  };

  return (
    <div className="container mt-4">
      <h2 className="mb-4">Reportes</h2>
      {msg && <div className="alert alert-info">{msg}</div>}

      <div className="row g-2 mb-4">
        <div className="col-12 col-md-6">
          <select
            className="form-select"
            value={idUsuario}
            onChange={(e) => setIdUsuario(e.target.value)}
            required
          >
            <option value="">Selecciona un socio</option>
            {usuarios.map((u) => (
              <option key={u.id_usuario} value={u.id_usuario}>
                {u.nombre_completo}
              </option>
            ))}
          </select>
        </div>
        <div className="col-12 col-md-4 d-grid">
          <button
            className="btn btn-success"
            disabled={downloading}
            onClick={descargarReporte}
          >
            {downloading
              ? "Descargando..."
              : "Descargar estado de cuenta (Excel)"}
          </button>
        </div>
      </div>

      <div className="alert alert-info">
        Selecciona un socio para descargar su estado de cuenta en formato Excel.
      </div>
    </div>
  );
}
