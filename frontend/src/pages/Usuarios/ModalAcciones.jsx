import { useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import { useAlerta } from "../../context/AlertaContext";
import { 
  FaUser, 
  FaIdCard, 
  FaPhone, 
  FaEnvelope, 
  FaMapMarkerAlt, 
  FaBirthdayCake, 
  FaUserTag, 
  FaToggleOn, 
  FaLock,
  FaSave,
  FaTimes
} from "react-icons/fa";

export default function ModalAcciones({ show, tipo, usuario, onClose, onRefresh }) {
  const { token } = useAuth();
  const { mostrarAlerta } = useAlerta();
  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
  const [form, setForm] = useState({
    nombre_completo: "",
    dni: "",
    telefono: "",
    correo: "",
    direccion: "",
    fecha_nacimiento: "",
    rol_id: 2,
    estado: "activo",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const [roles, setRoles] = useState([]);

  // Cargar roles disponibles
  useEffect(() => {
    const fetchRoles = async () => {
      try {
        const res = await axios.get(`${API_URL}/roles`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setRoles(res.data.data || []);
      } catch (err) {
        console.error("Error al cargar roles:", err);
      }
    };
    if (show) {
      fetchRoles();
    }
  }, [show, token, API_URL]);

  // Precarga datos al abrir
  useEffect(() => {
    if (tipo === "editar" && usuario) {
      setForm({
        nombre_completo: usuario.nombre_completo || "",
        dni: usuario.dni || "",
        telefono: usuario.telefono || "",
        correo: usuario.correo || "",
        direccion: usuario.direccion || "",
        fecha_nacimiento: usuario.fecha_nacimiento?.substring(0, 10) || "",
        rol_id: usuario.rol_id || 2,
        estado: usuario.estado || "activo",
        password: "",
      });
    }
    if (tipo === "crear") {
      setForm({
        nombre_completo: "",
        dni: "",
        telefono: "",
        correo: "",
        direccion: "",
        fecha_nacimiento: "",
        rol_id: 2,
        estado: "activo",
        password: "",
      });
    }
  }, [tipo, usuario, show]);

  const handleInput = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  // Guardar (crear/editar)
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (tipo === "crear") {
        await axios.post(`${API_URL}/usuarios`, form, {
          headers: { Authorization: `Bearer ${token}` },
        });
        mostrarAlerta("¡Usuario registrado con éxito!", "success");
      } else {
        await axios.put(`${API_URL}/usuarios/${usuario.id_usuario}`, form, {
          headers: { Authorization: `Bearer ${token}` },
        });
        mostrarAlerta("¡Usuario actualizado correctamente!", "success");
      }
      onRefresh();
      onClose();
    } catch (err) {
      mostrarAlerta(err.response?.data?.message || "Error al guardar los datos", "error");
    } finally {
      setLoading(false);
    }
  };

  if (!show) return null;

  return (
    <div
      className="modal show d-block"
      tabIndex="-1"
      style={{
        background: "rgba(0, 0, 0, 0.6)",
        backdropFilter: "blur(4px)",
        zIndex: 1200,
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        overflowY: "auto",
      }}
      onClick={onClose}
    >
      <div 
        className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable"
        onClick={(e) => e.stopPropagation()}
      >
        <form
          className="modal-content border-0 shadow-lg"
          onSubmit={handleSubmit}
          style={{ borderRadius: "20px", overflow: "hidden" }}
        >
          {/* Header con gradiente */}
          <div 
            className="modal-header border-0 text-white"
            style={{ 
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              padding: "24px"
            }}
          >
            <h4 className="modal-title mb-0 d-flex align-items-center fw-bold">
              <FaUser className="me-3" style={{ fontSize: "24px" }} />
              {tipo === "crear" ? "Registrar Nuevo Usuario" : "Editar Usuario"}
            </h4>
            <button
              type="button"
              className="btn-close btn-close-white"
              onClick={onClose}
              style={{ filter: "brightness(0) invert(1)" }}
            ></button>
          </div>

          <div className="modal-body" style={{ padding: "32px", background: "#f8f9fa" }}>
            <div className="row g-4">
              {/* Nombre Completo */}
              <div className="col-12">
                <label className="form-label fw-semibold d-flex align-items-center" style={{ color: "#2c3e50" }}>
                  <FaUser className="me-2" style={{ color: "#667eea" }} />
                  Nombre Completo
                </label>
                <input
                  type="text"
                  name="nombre_completo"
                  className="form-control form-control-lg"
                  value={form.nombre_completo}
                  onChange={handleInput}
                  required
                  autoFocus={tipo === "crear"}
                  placeholder="Ej: Juan Carlos Pérez"
                  style={{ 
                    borderRadius: "10px",
                    border: "2px solid #e9ecef",
                    padding: "12px 16px"
                  }}
                />
              </div>

              {/* DNI y Teléfono */}
              <div className="col-md-6">
                <label className="form-label fw-semibold d-flex align-items-center" style={{ color: "#2c3e50" }}>
                  <FaIdCard className="me-2" style={{ color: "#667eea" }} />
                  DNI (13 dígitos)
                </label>
                <input
                  type="text"
                  name="dni"
                  className="form-control form-control-lg"
                  value={form.dni}
                  onChange={handleInput}
                  required
                  disabled={tipo === "editar"}
                  placeholder="0801199012345"
                  maxLength="13"
                  pattern="[0-9]{13}"
                  style={{ 
                    borderRadius: "10px",
                    border: "2px solid #e9ecef",
                    padding: "12px 16px",
                    background: tipo === "editar" ? "#e9ecef" : "white"
                  }}
                />
              </div>

              <div className="col-md-6">
                <label className="form-label fw-semibold d-flex align-items-center" style={{ color: "#2c3e50" }}>
                  <FaPhone className="me-2" style={{ color: "#667eea" }} />
                  Teléfono
                </label>
                <input
                  type="text"
                  name="telefono"
                  className="form-control form-control-lg"
                  value={form.telefono}
                  onChange={handleInput}
                  placeholder="98765432"
                  maxLength="8"
                  pattern="[0-9]{8}"
                  style={{ 
                    borderRadius: "10px",
                    border: "2px solid #e9ecef",
                    padding: "12px 16px"
                  }}
                />
              </div>

              {/* Correo */}
              <div className="col-12">
                <label className="form-label fw-semibold d-flex align-items-center" style={{ color: "#2c3e50" }}>
                  <FaEnvelope className="me-2" style={{ color: "#667eea" }} />
                  Correo Electrónico
                </label>
                <input
                  type="email"
                  name="correo"
                  className="form-control form-control-lg"
                  value={form.correo}
                  onChange={handleInput}
                  placeholder="usuario@ejemplo.com"
                  style={{ 
                    borderRadius: "10px",
                    border: "2px solid #e9ecef",
                    padding: "12px 16px"
                  }}
                />
              </div>

              {/* Dirección */}
              <div className="col-12">
                <label className="form-label fw-semibold d-flex align-items-center" style={{ color: "#2c3e50" }}>
                  <FaMapMarkerAlt className="me-2" style={{ color: "#667eea" }} />
                  Dirección
                </label>
                <input
                  type="text"
                  name="direccion"
                  className="form-control form-control-lg"
                  value={form.direccion}
                  onChange={handleInput}
                  placeholder="Ej: Col. Los Alpes, Bloque B, Casa 123"
                  style={{ 
                    borderRadius: "10px",
                    border: "2px solid #e9ecef",
                    padding: "12px 16px"
                  }}
                />
              </div>

              {/* Fecha de Nacimiento y Rol */}
              <div className="col-md-6">
                <label className="form-label fw-semibold d-flex align-items-center" style={{ color: "#2c3e50" }}>
                  <FaBirthdayCake className="me-2" style={{ color: "#667eea" }} />
                  Fecha de Nacimiento
                </label>
                <input
                  type="date"
                  name="fecha_nacimiento"
                  className="form-control form-control-lg"
                  value={form.fecha_nacimiento}
                  onChange={handleInput}
                  style={{ 
                    borderRadius: "10px",
                    border: "2px solid #e9ecef",
                    padding: "12px 16px"
                  }}
                />
              </div>

              <div className="col-md-6">
                <label className="form-label fw-semibold d-flex align-items-center" style={{ color: "#2c3e50" }}>
                  <FaUserTag className="me-2" style={{ color: "#667eea" }} />
                  Rol
                </label>
                <select
                  name="rol_id"
                  className="form-select form-select-lg"
                  value={form.rol_id}
                  onChange={handleInput}
                  style={{ 
                    borderRadius: "10px",
                    border: "2px solid #e9ecef",
                    padding: "12px 16px"
                  }}
                >
                  {roles.length > 0 ? (
                    roles.map(rol => (
                      <option key={rol.id_rol} value={rol.id_rol}>
                        {rol.nombre || rol.nombre_rol}
                      </option>
                    ))
                  ) : (
                    <>
                      <option value={1}>Administrador</option>
                      <option value={2}>Socio</option>
                    </>
                  )}
                </select>
              </div>

              {/* Estado */}
              <div className="col-md-6">
                <label className="form-label fw-semibold d-flex align-items-center" style={{ color: "#2c3e50" }}>
                  <FaToggleOn className="me-2" style={{ color: "#667eea" }} />
                  Estado
                </label>
                <select
                  name="estado"
                  className="form-select form-select-lg"
                  value={form.estado}
                  onChange={handleInput}
                  style={{ 
                    borderRadius: "10px",
                    border: "2px solid #e9ecef",
                    padding: "12px 16px"
                  }}
                >
                  <option value="activo">✓ Activo</option>
                  <option value="inactivo">✗ Inactivo</option>
                </select>
              </div>

              {/* Contraseña (solo al crear) */}
              {tipo === "crear" && (
                <div className="col-md-6">
                  <label className="form-label fw-semibold d-flex align-items-center" style={{ color: "#2c3e50" }}>
                    <FaLock className="me-2" style={{ color: "#667eea" }} />
                    Contraseña
                  </label>
                  <input
                    type="password"
                    name="password"
                    className="form-control form-control-lg"
                    value={form.password}
                    onChange={handleInput}
                    required
                    placeholder="Mínimo 6 caracteres"
                    minLength="6"
                    style={{ 
                      borderRadius: "10px",
                      border: "2px solid #e9ecef",
                      padding: "12px 16px"
                    }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="modal-footer border-0 bg-white" style={{ padding: "20px 32px" }}>
            <button 
              type="submit"
              className="btn btn-lg shadow-sm"
              disabled={loading}
              style={{
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                color: "white",
                border: "none",
                borderRadius: "10px",
                padding: "12px 32px",
                fontWeight: "600"
              }}
            >
              {loading ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2"></span>
                  Guardando...
                </>
              ) : (
                <>
                  <FaSave className="me-2" />
                  {tipo === "crear" ? "Registrar Usuario" : "Guardar Cambios"}
                </>
              )}
            </button>
            <button
              type="button"
              className="btn btn-lg btn-light shadow-sm"
              onClick={onClose}
              disabled={loading}
              style={{
                borderRadius: "10px",
                padding: "12px 32px",
                fontWeight: "600"
              }}
            >
              <FaTimes className="me-2" />
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
