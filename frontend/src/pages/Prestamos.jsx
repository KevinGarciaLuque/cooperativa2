import { useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";

export default function Prestamos() {
  const { token } = useAuth();
  const [prestamos, setPrestamos] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [editPrestamo, setEditPrestamo] = useState(null);
  const [form, setForm] = useState({
    id_usuario: "",
    monto: "",
    interes: "",
    plazo_meses: "",
    fecha_inicio: "",
    estado: "pendiente",
  });
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

  // Cargar préstamos y usuarios
  const fetchData = async () => {
    try {
      const [prestamosRes, usuariosRes] = await Promise.all([
        axios.get(`${API_URL}/prestamos`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`${API_URL}/usuarios`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      setPrestamos(prestamosRes.data);
      setUsuarios(usuariosRes.data);
    } catch {
      setMsg("No se pudieron obtener los datos.");
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line
  }, []);

  const handleInput = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  // Crear o editar préstamo
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editPrestamo) {
        await axios.put(
          `${API_URL}/prestamos/${editPrestamo.id_prestamo}`,
          form,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        setMsg("Préstamo actualizado correctamente.");
      } else {
        await axios.post(`${API_URL}/prestamos`, form, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setMsg("Préstamo registrado correctamente.");
      }
      setForm({
        id_usuario: "",
        monto: "",
        interes: "",
        plazo_meses: "",
        fecha_inicio: "",
        estado: "pendiente",
      });
      setEditPrestamo(null);
      fetchData();
    } catch {
      setMsg("Error al guardar el préstamo.");
    }
    setLoading(false);
  };

  const handleEdit = (prestamo) => {
    setEditPrestamo(prestamo);
    setForm({
      id_usuario: prestamo.id_usuario,
      monto: prestamo.monto,
      interes: prestamo.interes,
      plazo_meses: prestamo.plazo_meses,
      fecha_inicio: prestamo.fecha_inicio
        ? prestamo.fecha_inicio.substring(0, 10)
        : "",
      estado: prestamo.estado,
    });
    setMsg("");
  };

  const handleDelete = async (id) => {
    if (!window.confirm("¿Seguro que deseas eliminar este préstamo?")) return;
    setLoading(true);
    try {
      await axios.delete(`${API_URL}/prestamos/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMsg("Préstamo eliminado correctamente.");
      fetchData();
    } catch {
      setMsg("Error al eliminar el préstamo.");
    }
    setLoading(false);
  };

  return (
    <div className="container mt-4">
      <h2 className="mb-4">Préstamos</h2>
      {msg && <div className="alert alert-info">{msg}</div>}

      <form className="row g-2 mb-4" onSubmit={handleSubmit}>
        <div className="col-12 col-md-3">
          <select
            className="form-select"
            name="id_usuario"
            value={form.id_usuario}
            onChange={handleInput}
            required
          >
            <option value="">Seleccione socio</option>
            {usuarios.map((u) => (
              <option key={u.id_usuario} value={u.id_usuario}>
                {u.nombre_completo}
              </option>
            ))}
          </select>
        </div>
        <div className="col-6 col-md-2">
          <input
            type="number"
            className="form-control"
            name="monto"
            placeholder="Monto"
            value={form.monto}
            onChange={handleInput}
            min={0}
            required
          />
        </div>
        <div className="col-6 col-md-2">
          <input
            type="number"
            className="form-control"
            name="interes"
            placeholder="% Interés"
            value={form.interes}
            onChange={handleInput}
            min={0}
            required
          />
        </div>
        <div className="col-6 col-md-2">
          <input
            type="number"
            className="form-control"
            name="plazo_meses"
            placeholder="Plazo (meses)"
            value={form.plazo_meses}
            onChange={handleInput}
            min={1}
            required
          />
        </div>
        <div className="col-6 col-md-2">
          <input
            type="date"
            className="form-control"
            name="fecha_inicio"
            placeholder="Fecha inicio"
            value={form.fecha_inicio}
            onChange={handleInput}
            required
          />
        </div>
        <div className="col-6 col-md-2">
          <select
            className="form-select"
            name="estado"
            value={form.estado}
            onChange={handleInput}
            required
          >
            <option value="pendiente">Pendiente</option>
            <option value="aprobado">Aprobado</option>
            <option value="pagado">Pagado</option>
            <option value="rechazado">Rechazado</option>
          </select>
        </div>
        <div className="col-12 col-md-2 d-grid">
          <button className="btn btn-primary" disabled={loading}>
            {editPrestamo ? "Actualizar" : "Registrar"}
          </button>
        </div>
        {editPrestamo && (
          <div className="col-12 col-md-2 d-grid">
            <button
              className="btn btn-secondary"
              type="button"
              onClick={() => {
                setEditPrestamo(null);
                setForm({
                  id_usuario: "",
                  monto: "",
                  interes: "",
                  plazo_meses: "",
                  fecha_inicio: "",
                  estado: "pendiente",
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
              <th>Socio</th>
              <th>Monto</th>
              <th>% Interés</th>
              <th>Plazo (meses)</th>
              <th>Fecha inicio</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {prestamos.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center">
                  No hay préstamos registrados.
                </td>
              </tr>
            ) : (
              prestamos.map((p, i) => (
                <tr key={p.id_prestamo}>
                  <td>{i + 1}</td>
                  <td>
                    {usuarios.find((u) => u.id_usuario === p.id_usuario)
                      ?.nombre_completo || "?"}
                  </td>
                  <td>L. {parseFloat(p.monto).toFixed(2)}</td>
                  <td>{p.interes}%</td>
                  <td>{p.plazo_meses}</td>
                  <td>
                    {p.fecha_inicio ? p.fecha_inicio.substring(0, 10) : "-"}
                  </td>
                  <td>
                    <span
                      className={`badge ${
                        p.estado === "aprobado"
                          ? "bg-success"
                          : p.estado === "pagado"
                          ? "bg-info"
                          : p.estado === "rechazado"
                          ? "bg-danger"
                          : "bg-warning"
                      }`}
                    >
                      {p.estado}
                    </span>
                  </td>
                  <td>
                    <button
                      className="btn btn-sm btn-outline-primary me-1"
                      onClick={() => handleEdit(p)}
                    >
                      Editar
                    </button>
                    <button
                      className="btn btn-sm btn-outline-danger"
                      onClick={() => handleDelete(p.id_prestamo)}
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
