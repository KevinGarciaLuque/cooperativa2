import { useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import AlertaModal from "../../components/AlertaModal"; // Ajusta la ruta según tu estructura

export default function ModalAcciones({
  show,
  tipo,
  usuario,
  onClose,
  onRefresh,
  setMsg,
}) {
  const { token } = useAuth();
  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";
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

  // Estado para la alerta modal local
  const [alerta, setAlerta] = useState({
    show: false,
    tipo: "success",
    mensaje: "",
  });

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
    setMsg("");
    try {
      if (tipo === "crear") {
        await axios.post(`${API_URL}/usuarios`, form, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setAlerta({
          show: true,
          tipo: "success",
          mensaje: "¡Usuario registrado con éxito!",
        });
        setMsg("Usuario creado correctamente.");
      } else {
        await axios.put(`${API_URL}/usuarios/${usuario.id_usuario}`, form, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setAlerta({
          show: true,
          tipo: "success",
          mensaje: "¡Usuario actualizado correctamente!",
        });
        setMsg("Usuario actualizado correctamente.");
      }
      onRefresh();
    } catch {
      setAlerta({
        show: true,
        tipo: "error",
        mensaje: "Error al guardar. Revisa los datos.",
      });
      setMsg("Error al guardar. Revisa los datos.");
    }
    setLoading(false);
  };

  // Cierra el modal de alerta y luego el modal de acciones
  const handleCerrarAlerta = () => {
    setAlerta({ show: false, tipo: "success", mensaje: "" });
    onClose();
  };

  if (!show) return null;

  return (
    <>
      <div
        className="modal show d-block"
        tabIndex="-1"
        style={{
          background: "#0008",
          zIndex: 1200,
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          overflowY: "auto",
        }}
      >
        <div className="modal-dialog modal-lg modal-dialog-centered">
          <form
            className="modal-content"
            onSubmit={handleSubmit}
            style={{ fontSize: "1rem" }}
          >
            <div className="modal-header">
              <h5 className="modal-title">
                {tipo === "crear" ? "Registrar usuario" : "Editar usuario"}
              </h5>
              <button
                type="button"
                className="btn-close"
                onClick={onClose}
              ></button>
            </div>
            <div className="modal-body">
              <div className="row g-2">
                <div className="col-md-6">
                  <label className="form-label">Nombre completo</label>
                  <input
                    type="text"
                    name="nombre_completo"
                    className="form-control"
                    value={form.nombre_completo}
                    onChange={handleInput}
                    required
                    autoFocus={tipo === "crear"}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">DNI</label>
                  <input
                    type="text"
                    name="dni"
                    className="form-control"
                    value={form.dni}
                    onChange={handleInput}
                    required
                    disabled={tipo === "editar"}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Teléfono</label>
                  <input
                    type="text"
                    name="telefono"
                    className="form-control"
                    value={form.telefono}
                    onChange={handleInput}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Correo</label>
                  <input
                    type="email"
                    name="correo"
                    className="form-control"
                    value={form.correo}
                    onChange={handleInput}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Dirección</label>
                  <input
                    type="text"
                    name="direccion"
                    className="form-control"
                    value={form.direccion}
                    onChange={handleInput}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Fecha nacimiento</label>
                  <input
                    type="date"
                    name="fecha_nacimiento"
                    className="form-control"
                    value={form.fecha_nacimiento}
                    onChange={handleInput}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Rol ID</label>
                  <input
                    type="number"
                    name="rol_id"
                    className="form-control"
                    value={form.rol_id}
                    onChange={handleInput}
                    min="1"
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Estado</label>
                  <select
                    name="estado"
                    className="form-select"
                    value={form.estado}
                    onChange={handleInput}
                  >
                    <option value="activo">Activo</option>
                    <option value="inactivo">Inactivo</option>
                  </select>
                </div>
                {tipo === "crear" && (
                  <div className="col-12">
                    <label className="form-label">Contraseña</label>
                    <input
                      type="password"
                      name="password"
                      className="form-control"
                      value={form.password}
                      onChange={handleInput}
                      required
                    />
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-success" disabled={loading}>
                {tipo === "crear" ? "Registrar" : "Guardar"}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onClose}
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      </div>
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
