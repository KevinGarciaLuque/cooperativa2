import {
  FaUser,
  FaPiggyBank,
  FaMoneyBillWave,
  FaEdit,
  FaPlus,
  FaTimes,
} from "react-icons/fa";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";

export default function AccionesCuenta({
  form,
  setForm,
  editCuenta,
  setEditCuenta,
  setMsg,
  usuarios,
  loading,
  setLoading,
  fetchData,
}) {
  const { token } = useAuth();
  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

  const handleInput = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editCuenta) {
        await axios.put(`${API_URL}/cuentas/${editCuenta.id_cuenta}`, form, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setMsg("Cuenta actualizada correctamente.");
      } else {
        await axios.post(`${API_URL}/cuentas`, form, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setMsg("Cuenta creada correctamente.");
      }
      setForm({
        id_usuario: "",
        tipo_cuenta: "",
        saldo_inicial: "",
        estado: "activa",
      });
      setEditCuenta(null);
      fetchData();
    } catch {
      setMsg("Error al guardar la cuenta.");
    }
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="row g-3 mb-4">
        <div className="col-12 col-md-3">
          <label className="form-label small text-muted">Socio</label>
          <div className="input-group">
            <span className="input-group-text bg-light">
              <FaUser className="text-muted" />
            </span>
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
        </div>

        <div className="col-12 col-md-3">
          <label className="form-label small text-muted">Tipo de cuenta</label>
          <div className="input-group">
            <span className="input-group-text bg-light">
              <FaPiggyBank className="text-muted" />
            </span>
            <select
              className="form-select"
              name="tipo_cuenta"
              value={form.tipo_cuenta}
              onChange={handleInput}
              required
            >
              <option value="">Seleccione tipo</option>
              <option value="Aportaciones">Aportaciones</option>
              <option value="Vivienda">Vivienda</option>
              <option value="Pensiones">Pensiones</option>
            </select>
          </div>
        </div>

        <div className="col-12 col-md-2">
          <label className="form-label small text-muted">Saldo inicial</label>
          <div className="input-group">
            <span className="input-group-text bg-light">
              <FaMoneyBillWave className="text-muted" />
            </span>
            <input
              type="number"
              className="form-control"
              name="saldo_inicial"
              placeholder="0.00"
              value={form.saldo_inicial}
              onChange={handleInput}
              min={0}
              step="0.01"
              required
            />
          </div>
        </div>

        <div className="col-12 col-md-2">
          <label className="form-label small text-muted">Estado</label>
          <select
            className="form-select"
            name="estado"
            value={form.estado}
            onChange={handleInput}
            required
          >
            <option value="activa">Activa</option>
            <option value="inactiva">Inactiva</option>
          </select>
        </div>

        <div className="col-12 col-md-2 d-flex align-items-end">
          <button
            className={`btn ${
              editCuenta ? "btn-warning" : "btn-primary"
            } w-100`}
            disabled={loading}
          >
            {editCuenta ? (
              <>
                <FaEdit className="me-1" />
                Actualizar
              </>
            ) : (
              <>
                <FaPlus className="me-1" />
                Crear
              </>
            )}
          </button>
        </div>
        {editCuenta && (
          <div className="col-12 col-md-2 d-flex align-items-end">
            <button
              className="btn btn-outline-secondary w-100"
              type="button"
              onClick={() => {
                setEditCuenta(null);
                setForm({
                  id_usuario: "",
                  tipo_cuenta: "",
                  saldo_inicial: "",
                  estado: "activa",
                });
              }}
            >
              <FaTimes className="me-1" />
              Cancelar
            </button>
          </div>
        )}
      </div>
    </form>
  );
}
