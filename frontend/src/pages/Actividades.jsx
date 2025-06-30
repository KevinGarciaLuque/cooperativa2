import { useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";

export default function Actividades() {
  const { token } = useAuth();
  const [actividades, setActividades] = useState([]);
  const [editAct, setEditAct] = useState(null);
  const [form, setForm] = useState({
    nombre: "",
    tipo: "",
    fecha: "",
    ingreso: "",
    descripcion: "",
  });
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

  // Cargar actividades
  const fetchData = async () => {
    try {
      const res = await axios.get(`${API_URL}/actividades`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setActividades(res.data);
    } catch {
      setMsg("No se pudieron obtener las actividades.");
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line
  }, []);

  const handleInput = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  // Crear o editar actividad
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editAct) {
        await axios.put(
          `${API_URL}/actividades/${editAct.id_actividad}`,
          form,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        setMsg("Actividad actualizada correctamente.");
      } else {
        await axios.post(`${API_URL}/actividades`, form, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setMsg("Actividad registrada correctamente.");
      }
      setForm({
        nombre: "",
        tipo: "",
        fecha: "",
        ingreso: "",
        descripcion: "",
      });
      setEditAct(null);
      fetchData();
    } catch {
      setMsg("Error al guardar la actividad.");
    }
    setLoading(false);
  };

  const handleEdit = (act) => {
    setEditAct(act);
    setForm({
      nombre: act.nombre,
      tipo: act.tipo,
      fecha: act.fecha ? act.fecha.substring(0, 10) : "",
      ingreso: act.ingreso,
      descripcion: act.descripcion || "",
    });
    setMsg("");
  };

  const handleDelete = async (id) => {
    if (!window.confirm("¿Seguro que deseas eliminar esta actividad?")) return;
    setLoading(true);
    try {
      await axios.delete(`${API_URL}/actividades/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMsg("Actividad eliminada correctamente.");
      fetchData();
    } catch {
      setMsg("Error al eliminar la actividad.");
    }
    setLoading(false);
  };

  return (
    <div className="container mt-4">
      <h2 className="mb-4">Actividades</h2>
      {msg && <div className="alert alert-info">{msg}</div>}

      <form className="row g-2 mb-4" onSubmit={handleSubmit}>
        <div className="col-12 col-md-3">
          <input
            type="text"
            className="form-control"
            name="nombre"
            placeholder="Nombre de la actividad"
            value={form.nombre}
            onChange={handleInput}
            required
          />
        </div>
        <div className="col-6 col-md-2">
          <input
            type="text"
            className="form-control"
            name="tipo"
            placeholder="Tipo (rifa, venta, etc.)"
            value={form.tipo}
            onChange={handleInput}
            required
          />
        </div>
        <div className="col-6 col-md-2">
          <input
            type="date"
            className="form-control"
            name="fecha"
            value={form.fecha}
            onChange={handleInput}
            required
          />
        </div>
        <div className="col-6 col-md-2">
          <input
            type="number"
            className="form-control"
            name="ingreso"
            placeholder="Ingreso (L)"
            value={form.ingreso}
            onChange={handleInput}
            min={0}
            required
          />
        </div>
        <div className="col-12 col-md-2">
          <input
            type="text"
            className="form-control"
            name="descripcion"
            placeholder="Descripción (opcional)"
            value={form.descripcion}
            onChange={handleInput}
          />
        </div>
        <div className="col-12 col-md-1 d-grid">
          <button className="btn btn-primary" disabled={loading}>
            {editAct ? "Actualizar" : "Registrar"}
          </button>
        </div>
        {editAct && (
          <div className="col-12 col-md-1 d-grid">
            <button
              className="btn btn-secondary"
              type="button"
              onClick={() => {
                setEditAct(null);
                setForm({
                  nombre: "",
                  tipo: "",
                  fecha: "",
                  ingreso: "",
                  descripcion: "",
                });
              }}
            >
              Cancelar
            </button>
          </div>
        )}
      </form>

      <div className="table-responsive">
        <table className="table table-bordered table-hover align-middle">
          <thead className="table-light">
            <tr>
              <th>#</th>
              <th>Nombre</th>
              <th>Tipo</th>
              <th>Fecha</th>
              <th>Ingreso</th>
              <th>Descripción</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {actividades.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center">
                  No hay actividades registradas.
                </td>
              </tr>
            ) : (
              actividades.map((a, i) => (
                <tr key={a.id_actividad}>
                  <td>{i + 1}</td>
                  <td>{a.nombre}</td>
                  <td>{a.tipo}</td>
                  <td>{a.fecha ? a.fecha.substring(0, 10) : "-"}</td>
                  <td>L. {parseFloat(a.ingreso).toFixed(2)}</td>
                  <td>{a.descripcion}</td>
                  <td>
                    <button
                      className="btn btn-sm btn-outline-primary me-1"
                      onClick={() => handleEdit(a)}
                    >
                      Editar
                    </button>
                    <button
                      className="btn btn-sm btn-outline-danger"
                      onClick={() => handleDelete(a.id_actividad)}
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
