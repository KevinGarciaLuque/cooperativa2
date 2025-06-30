import { useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";

export default function Roles() {
  const { token } = useAuth();
  const [roles, setRoles] = useState([]);
  const [form, setForm] = useState({ nombre: "" });
  const [editId, setEditId] = useState(null);
  const [msg, setMsg] = useState("");

  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

  const fetchRoles = async () => {
    try {
      const res = await axios.get(`${API_URL}/roles`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setRoles(res.data);
    } catch {
      setMsg("No se pudieron obtener los roles.");
    }
  };

  useEffect(() => {
    fetchRoles();
    // eslint-disable-next-line
  }, []);

  const handleInput = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editId) {
        await axios.put(`${API_URL}/roles/${editId}`, form, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setMsg("Rol actualizado correctamente.");
      } else {
        await axios.post(`${API_URL}/roles`, form, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setMsg("Rol creado correctamente.");
      }
      setForm({ nombre: "" });
      setEditId(null);
      fetchRoles();
    } catch {
      setMsg("Error al guardar el rol.");
    }
  };

  const handleEdit = (rol) => {
    setForm({ nombre: rol.nombre });
    setEditId(rol.id_rol);
    setMsg("");
  };

  const handleDelete = async (id) => {
    if (!window.confirm("¿Seguro que deseas eliminar este rol?")) return;
    try {
      await axios.delete(`${API_URL}/roles/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMsg("Rol eliminado correctamente.");
      fetchRoles();
    } catch {
      setMsg("Error al eliminar el rol.");
    }
  };

  return (
    <div className="container mt-4">
      <h2 className="mb-4">Roles</h2>
      {msg && <div className="alert alert-info">{msg}</div>}
      <form className="row g-2 mb-4" onSubmit={handleSubmit}>
        <div className="col-auto">
          <input
            type="text"
            name="nombre"
            className="form-control"
            placeholder="Nombre del rol"
            value={form.nombre}
            onChange={handleInput}
            required
          />
        </div>
        <div className="col-auto">
          <button className="btn btn-primary">
            {editId ? "Actualizar" : "Crear"}
          </button>
        </div>
        {editId && (
          <div className="col-auto">
            <button
              className="btn btn-secondary"
              onClick={() => {
                setEditId(null);
                setForm({ nombre: "" });
              }}
            >
              Cancelar
            </button>
          </div>
        )}
      </form>
      <div className="table-responsive">
        <table className="table table-bordered align-middle">
          <thead className="table-light">
            <tr>
              <th>ID</th>
              <th>Nombre</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {roles.length === 0 ? (
              <tr>
                <td colSpan={3} className="text-center">
                  No hay roles.
                </td>
              </tr>
            ) : (
              roles.map((rol) => (
                <tr key={rol.id_rol}>
                  <td>{rol.id_rol}</td>
                  <td>{rol.nombre}</td>
                  <td>
                    <button
                      className="btn btn-sm btn-outline-primary me-2"
                      onClick={() => handleEdit(rol)}
                    >
                      Editar
                    </button>
                    <button
                      className="btn btn-sm btn-outline-danger"
                      onClick={() => handleDelete(rol.id_rol)}
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
