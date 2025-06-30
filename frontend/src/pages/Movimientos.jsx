import { useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";

export default function Movimientos() {
  const { token } = useAuth();
  const [movimientos, setMovimientos] = useState([]);
  const [cuentas, setCuentas] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [editMovimiento, setEditMovimiento] = useState(null);
  const [form, setForm] = useState({
    id_cuenta: "",
    tipo: "",
    monto: "",
    fecha: "",
    descripcion: "",
  });
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

  // Cargar movimientos, cuentas y usuarios
  const fetchData = async () => {
    try {
      const [movRes, cuentasRes, usuariosRes] = await Promise.all([
        axios.get(`${API_URL}/movimientos`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`${API_URL}/cuentas`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`${API_URL}/usuarios`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      setMovimientos(movRes.data);
      setCuentas(cuentasRes.data);
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

  // Crear o editar movimiento
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editMovimiento) {
        await axios.put(
          `${API_URL}/movimientos/${editMovimiento.id_movimiento}`,
          form,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        setMsg("Movimiento actualizado correctamente.");
      } else {
        await axios.post(`${API_URL}/movimientos`, form, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setMsg("Movimiento registrado correctamente.");
      }
      setForm({
        id_cuenta: "",
        tipo: "",
        monto: "",
        fecha: "",
        descripcion: "",
      });
      setEditMovimiento(null);
      fetchData();
    } catch {
      setMsg("Error al guardar el movimiento.");
    }
    setLoading(false);
  };

  const handleEdit = (mov) => {
    setEditMovimiento(mov);
    setForm({
      id_cuenta: mov.id_cuenta,
      tipo: mov.tipo,
      monto: mov.monto,
      fecha: mov.fecha ? mov.fecha.substring(0, 10) : "",
      descripcion: mov.descripcion || "",
    });
    setMsg("");
  };

  const handleDelete = async (id) => {
    if (!window.confirm("¿Seguro que deseas eliminar este movimiento?")) return;
    setLoading(true);
    try {
      await axios.delete(`${API_URL}/movimientos/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMsg("Movimiento eliminado correctamente.");
      fetchData();
    } catch {
      setMsg("Error al eliminar el movimiento.");
    }
    setLoading(false);
  };

  // Busca el nombre del socio dueño de la cuenta
  const getUsuarioCuenta = (id_cuenta) => {
    const cuenta = cuentas.find((c) => c.id_cuenta === id_cuenta);
    if (!cuenta) return "?";
    const usuario = usuarios.find((u) => u.id_usuario === cuenta.id_usuario);
    return usuario?.nombre_completo || "?";
  };

  return (
    <div className="container mt-4">
      <h2 className="mb-4">Movimientos</h2>
      {msg && <div className="alert alert-info">{msg}</div>}

      <form className="row g-2 mb-4" onSubmit={handleSubmit}>
        <div className="col-12 col-md-3">
          <select
            className="form-select"
            name="id_cuenta"
            value={form.id_cuenta}
            onChange={handleInput}
            required
          >
            <option value="">Seleccione cuenta</option>
            {cuentas.map((c) => {
              const usuario = usuarios.find(
                (u) => u.id_usuario === c.id_usuario
              );
              return (
                <option key={c.id_cuenta} value={c.id_cuenta}>
                  {c.tipo_cuenta} -{" "}
                  {usuario?.nombre_completo || "Socio desconocido"}
                </option>
              );
            })}
          </select>
        </div>
        <div className="col-6 col-md-2">
          <select
            className="form-select"
            name="tipo"
            value={form.tipo}
            onChange={handleInput}
            required
          >
            <option value="">Tipo</option>
            <option value="abono">Abono</option>
            <option value="retiro">Retiro</option>
            <option value="transferencia">Transferencia</option>
            {/* Agrega otros tipos si los usas */}
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
            {editMovimiento ? "Actualizar" : "Registrar"}
          </button>
        </div>
        {editMovimiento && (
          <div className="col-12 col-md-2 d-grid">
            <button
              className="btn btn-secondary"
              type="button"
              onClick={() => {
                setEditMovimiento(null);
                setForm({
                  id_cuenta: "",
                  tipo: "",
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
              <th>Cuenta</th>
              <th>Tipo</th>
              <th>Monto</th>
              <th>Fecha</th>
              <th>Descripción</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {movimientos.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center">
                  No hay movimientos registrados.
                </td>
              </tr>
            ) : (
              movimientos.map((m, i) => (
                <tr key={m.id_movimiento}>
                  <td>{i + 1}</td>
                  <td>{getUsuarioCuenta(m.id_cuenta)}</td>
                  <td>
                    {cuentas.find((c) => c.id_cuenta === m.id_cuenta)
                      ?.tipo_cuenta || "?"}
                  </td>
                  <td>{m.tipo}</td>
                  <td>L. {parseFloat(m.monto).toFixed(2)}</td>
                  <td>{m.fecha ? m.fecha.substring(0, 10) : "-"}</td>
                  <td>{m.descripcion}</td>
                  <td>
                    <button
                      className="btn btn-sm btn-outline-primary me-1"
                      onClick={() => handleEdit(m)}
                    >
                      Editar
                    </button>
                    <button
                      className="btn btn-sm btn-outline-danger"
                      onClick={() => handleDelete(m.id_movimiento)}
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
