import { useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";

export default function Pagos() {
  const { token } = useAuth();
  const [pagos, setPagos] = useState([]);
  const [prestamos, setPrestamos] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [editPago, setEditPago] = useState(null);
  const [form, setForm] = useState({
    id_prestamo: "",
    monto: "",
    fecha: "",
    descripcion: "",
  });
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

  // Obtener pagos, préstamos y usuarios
  const fetchData = async () => {
    try {
      const [pagosRes, prestamosRes, usuariosRes] = await Promise.all([
        axios.get(`${API_URL}/pagos`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`${API_URL}/prestamos`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`${API_URL}/usuarios`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      setPagos(pagosRes.data);
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

  // Crear o editar pago
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editPago) {
        await axios.put(`${API_URL}/pagos/${editPago.id_pago}`, form, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setMsg("Pago actualizado correctamente.");
      } else {
        await axios.post(`${API_URL}/pagos`, form, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setMsg("Pago registrado correctamente.");
      }
      setForm({ id_prestamo: "", monto: "", fecha: "", descripcion: "" });
      setEditPago(null);
      fetchData();
    } catch {
      setMsg("Error al guardar el pago.");
    }
    setLoading(false);
  };

  const handleEdit = (p) => {
    setEditPago(p);
    setForm({
      id_prestamo: p.id_prestamo,
      monto: p.monto,
      fecha: p.fecha ? p.fecha.substring(0, 10) : "",
      descripcion: p.descripcion || "",
    });
    setMsg("");
  };

  const handleDelete = async (id) => {
    if (!window.confirm("¿Seguro que deseas eliminar este pago?")) return;
    setLoading(true);
    try {
      await axios.delete(`${API_URL}/pagos/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMsg("Pago eliminado correctamente.");
      fetchData();
    } catch {
      setMsg("Error al eliminar el pago.");
    }
    setLoading(false);
  };

  // Obtiene el usuario dueño del préstamo
  const getUsuarioPrestamo = (id_prestamo) => {
    const prestamo = prestamos.find((pr) => pr.id_prestamo === id_prestamo);
    if (!prestamo) return "?";
    const usuario = usuarios.find((u) => u.id_usuario === prestamo.id_usuario);
    return usuario?.nombre_completo || "?";
  };

  return (
    <div className="container mt-4">
      <h2 className="mb-4">Pagos</h2>
      {msg && <div className="alert alert-info">{msg}</div>}

      <form className="row g-2 mb-4" onSubmit={handleSubmit}>
        <div className="col-12 col-md-4">
          <select
            className="form-select"
            name="id_prestamo"
            value={form.id_prestamo}
            onChange={handleInput}
            required
          >
            <option value="">Seleccione préstamo</option>
            {prestamos.map((pr) => {
              const usuario = usuarios.find(
                (u) => u.id_usuario === pr.id_usuario
              );
              return (
                <option key={pr.id_prestamo} value={pr.id_prestamo}>
                  {pr.id_prestamo} -{" "}
                  {usuario?.nombre_completo || "Socio desconocido"}
                </option>
              );
            })}
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
            type="date"
            className="form-control"
            name="fecha"
            value={form.fecha}
            onChange={handleInput}
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
        <div className="col-12 col-md-2 d-grid">
          <button className="btn btn-primary" disabled={loading}>
            {editPago ? "Actualizar" : "Registrar"}
          </button>
        </div>
        {editPago && (
          <div className="col-12 col-md-2 d-grid">
            <button
              className="btn btn-secondary"
              type="button"
              onClick={() => {
                setEditPago(null);
                setForm({
                  id_prestamo: "",
                  monto: "",
                  fecha: "",
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
              <th>Socio</th>
              <th>Préstamo</th>
              <th>Monto</th>
              <th>Fecha</th>
              <th>Descripción</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {pagos.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center">
                  No hay pagos registrados.
                </td>
              </tr>
            ) : (
              pagos.map((p, i) => (
                <tr key={p.id_pago}>
                  <td>{i + 1}</td>
                  <td>{getUsuarioPrestamo(p.id_prestamo)}</td>
                  <td>{p.id_prestamo}</td>
                  <td>L. {parseFloat(p.monto).toFixed(2)}</td>
                  <td>{p.fecha ? p.fecha.substring(0, 10) : "-"}</td>
                  <td>{p.descripcion}</td>
                  <td>
                    <button
                      className="btn btn-sm btn-outline-primary me-1"
                      onClick={() => handleEdit(p)}
                    >
                      Editar
                    </button>
                    <button
                      className="btn btn-sm btn-outline-danger"
                      onClick={() => handleDelete(p.id_pago)}
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
