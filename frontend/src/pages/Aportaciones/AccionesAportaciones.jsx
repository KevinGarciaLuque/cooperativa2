import {
  FaUser,
  FaMoneyBillWave,
  FaCalendarDay,
  FaEdit,
  FaPlus,
  FaTimes,
  FaInfoCircle,
} from "react-icons/fa";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import { useState } from "react";
import AlertaModal from "../../components/AlertaModal"; // <- ruta correcta

export default function AccionesAportaciones({
  form,
  setForm,
  editAportacion,
  setEditAportacion,
  setMsg,
  usuarios,
  loading,
  setLoading,
  fetchData,
}) {
  const { token } = useAuth();
  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

  // Alerta modal local
  const [alerta, setAlerta] = useState({
    show: false,
    tipo: "success",
    mensaje: "",
  });

  const handleInput = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editAportacion) {
        await axios.put(
          `${API_URL}/aportaciones/${editAportacion.id_aportacion}`,
          form,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setAlerta({
          show: true,
          tipo: "success",
          mensaje: "Aportación actualizada correctamente.",
        });
        setMsg("Aportación actualizada correctamente.");
      } else {
        await axios.post(`${API_URL}/aportaciones`, form, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setAlerta({
          show: true,
          tipo: "success",
          mensaje: "Aportación registrada correctamente.",
        });
        setMsg("Aportación registrada correctamente.");
      }
      setForm({ id_usuario: "", monto: "", fecha: "", descripcion: "" });
      setEditAportacion(null);
      fetchData();
    } catch {
      setAlerta({
        show: true,
        tipo: "error",
        mensaje: "Error al guardar la aportación.",
      });
      setMsg("Error al guardar la aportación.");
    }
    setLoading(false);
  };

  // Cierra el modal de alerta
  const handleCerrarAlerta = () => {
    setAlerta({ show: false, tipo: "success", mensaje: "" });
  };

  return (
    <>
      <form className="row g-3 mb-4" onSubmit={handleSubmit}>
        {/* ...inputs igual que ya tienes... */}
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
        <div className="col-6 col-md-2">
          <label className="form-label small text-muted">Monto</label>
          <div className="input-group">
            <span className="input-group-text bg-light">
              <FaMoneyBillWave className="text-muted" />
            </span>
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
        </div>
        <div className="col-6 col-md-2">
          <label className="form-label small text-muted">Fecha</label>
          <div className="input-group">
            <span className="input-group-text bg-light">
              <FaCalendarDay className="text-muted" />
            </span>
            <input
              type="date"
              className="form-control"
              name="fecha"
              value={form.fecha}
              onChange={handleInput}
              required
            />
          </div>
        </div>
        <div className="col-12 col-md-3">
          <label className="form-label small text-muted">Descripción</label>
          <div className="input-group">
            <span className="input-group-text bg-light">
              <FaInfoCircle className="text-muted" />
            </span>
            <input
              type="text"
              className="form-control"
              name="descripcion"
              placeholder="Descripción (opcional)"
              value={form.descripcion}
              onChange={handleInput}
              maxLength={60}
            />
          </div>
        </div>
        <div className="col-12 col-md-2 d-flex align-items-end gap-2">
          <button
            className={`btn ${
              editAportacion ? "btn-warning" : "btn-primary"
            } w-100`}
            disabled={loading}
          >
            {editAportacion ? (
              <>
                <FaEdit className="me-1" />
                Actualizar
              </>
            ) : (
              <>
                <FaPlus className="me-1" />
                Registrar
              </>
            )}
          </button>
          {editAportacion && (
            <button
              className="btn btn-outline-secondary w-100"
              type="button"
              onClick={() => {
                setEditAportacion(null);
                setForm({
                  id_usuario: "",
                  monto: "",
                  fecha: "",
                  descripcion: "",
                });
              }}
            >
              <FaTimes className="me-1" />
              Cancelar
            </button>
          )}
        </div>
      </form>
      {/* MODAL DE ALERTA */}
      <AlertaModal
        show={alerta.show}
        tipo={alerta.tipo}
        mensaje={alerta.mensaje}
        onClose={handleCerrarAlerta}
      />
    </>
  );
}
