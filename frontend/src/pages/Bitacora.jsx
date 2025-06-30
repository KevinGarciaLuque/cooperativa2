import { useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";

export default function Bitacora() {
  const { token } = useAuth();
  const [bitacora, setBitacora] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [filtroUsuario, setFiltroUsuario] = useState("");
  const [filtroAccion, setFiltroAccion] = useState("");
  const [msg, setMsg] = useState("");

  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

  // Obtener bitácora y usuarios
  const fetchData = async () => {
    try {
      const [bitacoraRes, usuariosRes] = await Promise.all([
        axios.get(`${API_URL}/bitacora`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`${API_URL}/usuarios`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      setBitacora(bitacoraRes.data);
      setUsuarios(usuariosRes.data);
    } catch {
      setMsg("No se pudieron obtener los datos.");
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line
  }, []);

  // Filtros rápidos
  const bitacoraFiltrada = bitacora.filter((b) => {
    let ok = true;
    if (filtroUsuario) ok = ok && b.id_usuario === Number(filtroUsuario);
    if (filtroAccion)
      ok = ok && b.accion.toLowerCase().includes(filtroAccion.toLowerCase());
    return ok;
  });

  return (
    <div className="container mt-4">
      <h2 className="mb-4">Bitácora de Actividad</h2>
      {msg && <div className="alert alert-info">{msg}</div>}

      <div className="row g-2 mb-3">
        <div className="col-12 col-md-4">
          <select
            className="form-select"
            value={filtroUsuario}
            onChange={(e) => setFiltroUsuario(e.target.value)}
          >
            <option value="">Todos los usuarios</option>
            {usuarios.map((u) => (
              <option key={u.id_usuario} value={u.id_usuario}>
                {u.nombre_completo}
              </option>
            ))}
          </select>
        </div>
        <div className="col-12 col-md-4">
          <input
            type="text"
            className="form-control"
            placeholder="Buscar por acción (ej: crear, eliminar, editar)"
            value={filtroAccion}
            onChange={(e) => setFiltroAccion(e.target.value)}
          />
        </div>
        <div className="col-12 col-md-4">
          <button
            className="btn btn-secondary w-100"
            onClick={() => {
              setFiltroUsuario("");
              setFiltroAccion("");
            }}
          >
            Limpiar filtros
          </button>
        </div>
      </div>

      <div className="table-responsive">
        <table className="table table-bordered table-hover align-middle">
          <thead className="table-light">
            <tr>
              <th>#</th>
              <th>Usuario</th>
              <th>Acción</th>
              <th>Detalle</th>
              <th>Fecha/Hora</th>
            </tr>
          </thead>
          <tbody>
            {bitacoraFiltrada.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center">
                  No hay registros de bitácora.
                </td>
              </tr>
            ) : (
              bitacoraFiltrada.map((b, i) => (
                <tr key={b.id_bitacora}>
                  <td>{i + 1}</td>
                  <td>
                    {usuarios.find((u) => u.id_usuario === b.id_usuario)
                      ?.nombre_completo || "?"}
                  </td>
                  <td>
                    <span className="badge bg-info text-dark">{b.accion}</span>
                  </td>
                  <td>{b.detalle}</td>
                  <td>{b.fecha ? new Date(b.fecha).toLocaleString() : "-"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
