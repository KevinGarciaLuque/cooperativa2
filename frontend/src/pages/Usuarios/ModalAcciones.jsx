import { useEffect, useState } from "react";
import axios from "axios";
import { comprimirImagen } from "../../utils/imagen";
import { formatearNombre } from "../../utils/nombres";
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
  FaTimes,
  FaCamera,
  FaKey
} from "react-icons/fa";
import { docIdentidad, pais } from "../../utils/pais";

export default function ModalAcciones({ show, tipo, usuario, onClose, onRefresh }) {
  const { token, user: usuarioLogueado, updateUser } = useAuth();
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
  const [fotoFile, setFotoFile] = useState(null);
  const [fotoPreview, setFotoPreview] = useState(null);

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
      setFotoFile(null);
      const base = import.meta.env.VITE_API_URL?.replace("/api", "") || "http://localhost:5000";
      setFotoPreview(usuario.foto ? `${base}${usuario.foto}` : null);
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
      setFotoFile(null);
      setFotoPreview(null);
    }
  }, [tipo, usuario, show]);

  const handleFoto = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setFotoFile(file);
    setFotoPreview(URL.createObjectURL(file));
  };

  const handleInput = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  // Restablecer la contraseña de otro usuario (solo Super Administrador)
  const esSuperAdmin = usuarioLogueado?.rol === "Super Administrador";
  const [nuevaClave, setNuevaClave] = useState({ abierta: false, password: "", confirmar: "", guardando: false });
  useEffect(() => {
    setNuevaClave({ abierta: false, password: "", confirmar: "", guardando: false });
  }, [usuario, show]);
  const restablecerPassword = async () => {
    if (nuevaClave.password !== nuevaClave.confirmar) {
      mostrarAlerta("Las contraseñas no coinciden.", "error");
      return;
    }
    setNuevaClave((c) => ({ ...c, guardando: true }));
    try {
      const r = await axios.post(
        `${API_URL}/usuarios/${usuario.id_usuario}/restablecer-password`,
        { password_nuevo: nuevaClave.password },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      mostrarAlerta(r.data.message || "Contraseña restablecida.", "success");
      setNuevaClave({ abierta: false, password: "", confirmar: "", guardando: false });
    } catch (err) {
      mostrarAlerta(err.response?.data?.message || "No se pudo restablecer la contraseña.", "error");
      setNuevaClave((c) => ({ ...c, guardando: false }));
    }
  };

  // Guardar (crear/editar)
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      let nuevoId = usuario?.id_usuario;
      if (tipo === "crear") {
        const res = await axios.post(`${API_URL}/usuarios`, form, {
          headers: { Authorization: `Bearer ${token}` },
        });
        nuevoId = res.data.id_usuario;
        mostrarAlerta("¡Usuario registrado con éxito!", "success");
      } else {
        await axios.put(`${API_URL}/usuarios/${usuario.id_usuario}`, form, {
          headers: { Authorization: `Bearer ${token}` },
        });
        mostrarAlerta("¡Usuario actualizado correctamente!", "success");
      }
      // Subir foto si se seleccionó una
      if (fotoFile && nuevoId) {
        const fd = new FormData();
        fd.append("foto", await comprimirImagen(fotoFile, 900));
        const fotoRes = await axios.put(`${API_URL}/usuarios/${nuevoId}/foto`, fd, {
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "multipart/form-data" },
        });
        // Si el usuario editado es el usuario logueado, actualizar el contexto
        if (fotoRes.data?.foto && nuevoId === usuarioLogueado?.id_usuario) {
          updateUser({ foto: fotoRes.data.foto });
        }
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
    >
      <div 
        className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable"
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
              {/* Foto de perfil */}
              <div className="col-12">
                <div className="d-flex align-items-center gap-4">
                  <div style={{ position: "relative", flexShrink: 0 }}>
                    <div
                      className="rounded-circle d-flex align-items-center justify-content-center overflow-hidden"
                      style={{
                        width: "90px",
                        height: "90px",
                        background: fotoPreview ? "transparent" : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                        border: "3px solid #667eea",
                      }}
                    >
                      {fotoPreview ? (
                        <img
                          src={fotoPreview}
                          alt="Preview"
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                      ) : (
                        <FaUser style={{ fontSize: "36px", color: "white" }} />
                      )}
                    </div>
                    <label
                      htmlFor="input-foto"
                      className="rounded-circle d-flex align-items-center justify-content-center"
                      style={{
                        position: "absolute",
                        bottom: 0,
                        right: 0,
                        width: "28px",
                        height: "28px",
                        background: "#667eea",
                        color: "white",
                        cursor: "pointer",
                        border: "2px solid white",
                      }}
                      title="Cambiar foto"
                    >
                      <FaCamera size={12} />
                    </label>
                    <input
                      id="input-foto"
                      type="file"
                      accept="image/*"
                      style={{ display: "none" }}
                      onChange={handleFoto}
                    />
                  </div>
                  <div>
                    <p className="fw-semibold mb-1" style={{ color: "#2c3e50" }}>Foto de Perfil</p>
                    <p className="text-muted small mb-0">Cámara o galería · máx. 10 MB</p>
                    {fotoPreview && (
                      <button
                        type="button"
                        className="btn btn-sm btn-link text-danger p-0 mt-1"
                        onClick={() => { setFotoFile(null); setFotoPreview(null); }}
                      >
                        Quitar foto
                      </button>
                    )}
                  </div>
                </div>
              </div>

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
                  autoCapitalize="words"
                  onBlur={() => setForm((f) => ({ ...f, nombre_completo: formatearNombre(f.nombre_completo) }))}
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
                  {docIdentidad().nombre}
                </label>
                <input
                  type="text"
                  name="dni"
                  className="form-control form-control-lg"
                  value={form.dni}
                  onChange={handleInput}
                  required
                  disabled={tipo === "editar"}
                  placeholder={docIdentidad().ejemplo}
                  maxLength={docIdentidad().largo_max + 3}
                  title={docIdentidad().ayuda}
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
                  placeholder={"9876543210".slice(0, pais().telefono.digitos)}
                  maxLength={pais().telefono.digitos}
                  pattern={`[0-9]{${pais().telefono.digitos}}`}
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
                  Correo Electrónico {(!form.rol_id || String(form.rol_id) === "2") && <span className="text-danger ms-1">*</span>}
                </label>
                <input
                  type="email"
                  required={!form.rol_id || String(form.rol_id) === "2"}
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
                    roles
                      .filter(rol => 
                        usuarioLogueado?.rol === "Super Administrador" || 
                        (rol.nombre || rol.nombre_rol) !== "Super Administrador"
                      )
                      .map(rol => (
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

              {/* Restablecer contraseña (al editar, solo Super Administrador) */}
              {tipo === "editar" && esSuperAdmin && usuario?.id_usuario !== usuarioLogueado?.id_usuario && (
                <div className="col-12">
                  <div className="border rounded-3 p-3" style={{ background: "#f8f9fb" }}>
                    {!nuevaClave.abierta ? (
                      <button
                        type="button"
                        className="btn btn-outline-secondary btn-sm"
                        onClick={() => setNuevaClave((c) => ({ ...c, abierta: true }))}
                      >
                        <FaKey className="me-2" />
                        Restablecer contraseña
                      </button>
                    ) : (
                      <div className="row g-2 align-items-end">
                        <div className="col-12 small text-muted">
                          Escribe la contraseña nueva para {usuario?.nombre_completo}: al menos 8 caracteres, con letras y números.
                        </div>
                        <div className="col-md-4">
                          <label className="form-label small fw-semibold mb-1">Contraseña nueva</label>
                          <input
                            type="password"
                            className="form-control"
                            autoComplete="new-password"
                            value={nuevaClave.password}
                            onChange={(e) => setNuevaClave({ ...nuevaClave, password: e.target.value })}
                          />
                        </div>
                        <div className="col-md-4">
                          <label className="form-label small fw-semibold mb-1">Repetir contraseña</label>
                          <input
                            type="password"
                            className="form-control"
                            autoComplete="new-password"
                            value={nuevaClave.confirmar}
                            onChange={(e) => setNuevaClave({ ...nuevaClave, confirmar: e.target.value })}
                          />
                        </div>
                        <div className="col-md-4 d-flex gap-2">
                          <button
                            type="button"
                            className="btn btn-primary"
                            disabled={nuevaClave.guardando || nuevaClave.password.length < 8 || !nuevaClave.confirmar}
                            onClick={restablecerPassword}
                          >
                            {nuevaClave.guardando ? "Guardando..." : "Guardar contraseña"}
                          </button>
                          <button
                            type="button"
                            className="btn btn-light"
                            onClick={() => setNuevaClave({ abierta: false, password: "", confirmar: "", guardando: false })}
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

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
