import { useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { useAlerta } from "../context/AlertaContext";
import { 
  FaUserShield, 
  FaUsers, 
  FaPlus, 
  FaEdit, 
  FaTrash, 
  FaUserTie,
  FaCheckCircle,
  FaCrown,
  FaUserCog,
  FaEye,
  FaInfoCircle,
  FaTimes
} from "react-icons/fa";

export default function Roles() {
  const { token } = useAuth();
  const { mostrarAlerta } = useAlerta();
  
  const [roles, setRoles] = useState([]);
  const [form, setForm] = useState({ nombre: "", descripcion: "" });
  const [editId, setEditId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedRol, setSelectedRol] = useState(null);
  const [showUsuariosModal, setShowUsuariosModal] = useState(false);
  const [usuariosRol, setUsuariosRol] = useState([]);

  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

  const fetchRoles = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/roles`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setRoles(res.data.data || res.data);
    } catch (error) {
      mostrarAlerta("Error al obtener los roles", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoles();
  }, []);

  const handleInput = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const openModal = (rol = null) => {
    if (rol) {
      setForm({ 
        nombre: rol.nombre, 
        descripcion: rol.descripcion || "" 
      });
      setEditId(rol.id_rol);
    } else {
      setForm({ nombre: "", descripcion: "" });
      setEditId(null);
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setForm({ nombre: "", descripcion: "" });
    setEditId(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!form.nombre.trim()) {
      mostrarAlerta("El nombre del rol es requerido", "warning");
      return;
    }

    try {
      if (editId) {
        await axios.put(`${API_URL}/roles/${editId}`, form, {
          headers: { Authorization: `Bearer ${token}` },
        });
        mostrarAlerta("Rol actualizado correctamente", "success");
      } else {
        await axios.post(`${API_URL}/roles`, form, {
          headers: { Authorization: `Bearer ${token}` },
        });
        mostrarAlerta(" Rol creado correctamente", "success");
      }
      closeModal();
      fetchRoles();
    } catch (error) {
      const mensaje = error.response?.data?.message || "Error al guardar el rol";
      mostrarAlerta(mensaje, "error");
    }
  };

  const handleDelete = async (id, nombre) => {
    if (id <= 2) {
      mostrarAlerta("No se puede eliminar un rol del sistema", "warning");
      return;
    }

    if (!window.confirm(`¿Estás seguro de eliminar el rol "${nombre}"?`)) return;
    
    try {
      await axios.delete(`${API_URL}/roles/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      mostrarAlerta("Rol eliminado correctamente", "success");
      fetchRoles();
    } catch (error) {
      const mensaje = error.response?.data?.message || "Error al eliminar el rol";
      mostrarAlerta(mensaje, "error");
    }
  };

  const verUsuarios = async (rol) => {
    try {
      const res = await axios.get(`${API_URL}/roles/${rol.id_rol}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUsuariosRol(res.data.usuarios || []);
      setSelectedRol(rol);
      setShowUsuariosModal(true);
    } catch (error) {
      mostrarAlerta("Error al obtener usuarios del rol", "error");
    }
  };

  const getRolIcon = (nombre) => {
    const nombreLower = nombre.toLowerCase();
    if (nombreLower.includes("admin")) return <FaCrown style={{ fontSize: "24px", color: "#f39c12" }} />;
    if (nombreLower.includes("socio")) return <FaUsers style={{ fontSize: "24px", color: "#667eea" }} />;
    if (nombreLower.includes("contador")) return <FaUserCog style={{ fontSize: "24px", color: "#3498db" }} />;
    if (nombreLower.includes("supervisor")) return <FaUserShield style={{ fontSize: "24px", color: "#27ae60" }} />;
    return <FaUserTie style={{ fontSize: "24px", color: "#95a5a6" }} />;
  };

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: "400px" }}>
        <div className="spinner-border" style={{ width: "3rem", height: "3rem", color: "#667eea" }} role="status">
          <span className="visually-hidden">Cargando...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container-fluid px-4 py-4" style={{ background: "#f8f9fa", minHeight: "100vh" }}>
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="mb-1 fw-bold" style={{ color: "#2c3e50" }}>
            <FaUserShield className="me-2" style={{ color: "#667eea" }} />
            Gestión de Roles
          </h2>
          <p className="text-muted mb-0">Administra los roles y permisos del sistema</p>
        </div>
        <button 
          className="btn btn-primary shadow-sm" 
          onClick={() => openModal()}
          style={{ 
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            border: "none",
            borderRadius: "10px",
            padding: "12px 24px",
            fontWeight: "500"
          }}
        >
          <FaPlus className="me-2" />
          Nuevo Rol
        </button>
      </div>

      {/* Stats Cards */}
      <div className="row g-3 mb-4">
        <div className="col-12 col-sm-6 col-lg-4">
          <div
            className="card border-0 shadow-sm h-100"
            style={{ borderRadius: "15px", borderLeft: "4px solid #667eea" }}
          >
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <p className="text-muted mb-1 small">Total de Roles</p>
                  <h3 className="mb-0 fw-bold" style={{ color: "#2c3e50" }}>
                    {roles.length}
                  </h3>
                  <p className="mb-0 small text-muted">
                    Roles configurados
                  </p>
                </div>
                <div
                  className="rounded-circle d-flex align-items-center justify-content-center"
                  style={{
                    width: "50px",
                    height: "50px",
                    background: "#667eea20",
                  }}
                >
                  <FaUserShield style={{ fontSize: "24px", color: "#667eea" }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-lg-4">
          <div
            className="card border-0 shadow-sm h-100"
            style={{ borderRadius: "15px", borderLeft: "4px solid #27ae60" }}
          >
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <p className="text-muted mb-1 small">Usuarios Totales</p>
                  <h3 className="mb-0 fw-bold" style={{ color: "#2c3e50" }}>
                    {roles.reduce((sum, rol) => sum + (rol.total_usuarios || 0), 0)}
                  </h3>
                  <p className="mb-0 small" style={{ color: "#27ae60" }}>
                    <FaCheckCircle className="me-1" />
                    Asignados a roles
                  </p>
                </div>
                <div
                  className="rounded-circle d-flex align-items-center justify-content-center"
                  style={{
                    width: "50px",
                    height: "50px",
                    background: "#27ae6020",
                  }}
                >
                  <FaUsers style={{ fontSize: "24px", color: "#27ae60" }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-lg-4">
          <div
            className="card border-0 shadow-sm h-100"
            style={{ borderRadius: "15px", borderLeft: "4px solid #3498db" }}
          >
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <p className="text-muted mb-1 small">Usuarios Activos</p>
                  <h3 className="mb-0 fw-bold" style={{ color: "#2c3e50" }}>
                    {roles.reduce((sum, rol) => sum + (rol.usuarios_activos || 0), 0)}
                  </h3>
                  <p className="mb-0 small text-muted">
                    Usuarios en el sistema
                  </p>
                </div>
                <div
                  className="rounded-circle d-flex align-items-center justify-content-center"
                  style={{
                    width: "50px",
                    height: "50px",
                    background: "#3498db20",
                  }}
                >
                  <FaCheckCircle style={{ fontSize: "24px", color: "#3498db" }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Roles Grid */}
      <div className="row g-3">
        {roles.length === 0 ? (
          <div className="col-12">
            <div 
              className="card border-0 shadow-sm" 
              style={{ borderRadius: "15px" }}
            >
              <div className="card-body text-center py-5">
                <div
                  className="rounded-circle d-inline-flex align-items-center justify-content-center mb-3"
                  style={{
                    width: "80px",
                    height: "80px",
                    background: "#667eea20",
                  }}
                >
                  <FaUserShield style={{ fontSize: "40px", color: "#667eea" }} />
                </div>
                <h4 className="text-muted mb-2">No hay roles registrados</h4>
                <p className="text-muted mb-4">Comienza creando tu primer rol</p>
                <button 
                  className="btn btn-primary" 
                  onClick={() => openModal()}
                  style={{ 
                    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                    border: "none",
                    borderRadius: "10px"
                  }}
                >
                  <FaPlus className="me-2" />
                  Crear Primer Rol
                </button>
              </div>
            </div>
          </div>
        ) : (
          roles.map((rol) => (
            <div className="col-12 col-md-6 col-lg-4" key={rol.id_rol}>
              <div 
                className="card border-0 shadow-sm h-100" 
                style={{ 
                  borderRadius: "15px",
                  borderLeft: `4px solid ${rol.id_rol === 1 ? '#f39c12' : rol.id_rol === 2 ? '#667eea' : '#95a5a6'}`,
                  transition: "transform 0.2s, box-shadow 0.2s",
                  cursor: "pointer"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-5px)";
                  e.currentTarget.style.boxShadow = "0 8px 25px rgba(0,0,0,0.15)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "";
                }}
              >
                <div className="card-body p-4">
                  <div className="d-flex justify-content-between align-items-start mb-3">
                    <div
                      className="rounded-circle d-flex align-items-center justify-content-center"
                      style={{
                        width: "50px",
                        height: "50px",
                        background: rol.id_rol === 1 ? '#f39c1220' : rol.id_rol === 2 ? '#667eea20' : '#95a5a620',
                      }}
                    >
                      {getRolIcon(rol.nombre)}
                    </div>
                    <div className="d-flex gap-2">
                      <button
                        className="btn btn-sm btn-outline-info"
                        onClick={() => verUsuarios(rol)}
                        title="Ver usuarios"
                        style={{ borderRadius: "8px" }}
                      >
                        <FaEye />
                      </button>
                      {rol.id_rol > 2 && (
                        <>
                          <button
                            className="btn btn-sm btn-outline-primary"
                            onClick={() => openModal(rol)}
                            title="Editar"
                            style={{ borderRadius: "8px" }}
                          >
                            <FaEdit />
                          </button>
                          <button
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => handleDelete(rol.id_rol, rol.nombre)}
                            title="Eliminar"
                            style={{ borderRadius: "8px" }}
                          >
                            <FaTrash />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <h5 className="card-title mb-2 fw-bold" style={{ color: "#2c3e50" }}>
                    {rol.nombre}
                  </h5>
                  <p className="text-muted small mb-3" style={{ minHeight: "40px" }}>
                    {rol.descripcion || "Sin descripción"}
                  </p>

                  <div className="d-flex justify-content-between align-items-center pt-3 border-top">
                    <div className="d-flex align-items-center">
                      <div
                        className="rounded-circle d-flex align-items-center justify-content-center me-2"
                        style={{
                          width: "30px",
                          height: "30px",
                          background: "#667eea20",
                        }}
                      >
                        <FaUsers style={{ fontSize: "14px", color: "#667eea" }} />
                      </div>
                      <div>
                        <p className="mb-0 fw-bold" style={{ color: "#2c3e50" }}>
                          {rol.total_usuarios || 0}
                        </p>
                        <p className="mb-0 small text-muted">usuarios</p>
                      </div>
                    </div>
                    <div className="d-flex align-items-center">
                      <div
                        className="rounded-circle d-flex align-items-center justify-content-center me-2"
                        style={{
                          width: "30px",
                          height: "30px",
                          background: "#27ae6020",
                        }}
                      >
                        <FaCheckCircle style={{ fontSize: "14px", color: "#27ae60" }} />
                      </div>
                      <div>
                        <p className="mb-0 fw-bold" style={{ color: "#27ae60" }}>
                          {rol.usuarios_activos || 0}
                        </p>
                        <p className="mb-0 small text-muted">activos</p>
                      </div>
                    </div>
                  </div>

                  {rol.id_rol <= 2 && (
                    <div className="mt-3">
                      <span 
                        className="badge" 
                        style={{ 
                          background: "linear-gradient(135deg, #f39c12 0%, #e67e22 100%)",
                          borderRadius: "8px",
                          padding: "6px 12px"
                        }}
                      >
                        <FaCrown className="me-1" />
                        Rol del Sistema
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal Crear/Editar Rol */}
      {showModal && (
        <div className="modal fade show d-block" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg" style={{ borderRadius: "15px" }}>
              <div className="modal-header border-0" style={{ background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", borderRadius: "15px 15px 0 0" }}>
                <h5 className="modal-title text-white fw-bold">
                  {editId ? <><FaEdit className="me-2" />Editar Rol</> : <><FaPlus className="me-2" />Nuevo Rol</>}
                </h5>
                <button type="button" className="btn-close btn-close-white" onClick={closeModal}></button>
              </div>
              <form onSubmit={handleSubmit}>
                <div className="modal-body p-4">
                  <div className="mb-3">
                    <label className="form-label fw-bold" style={{ color: "#2c3e50" }}>
                      <FaUserShield className="me-2" style={{ color: "#667eea" }} />
                      Nombre del Rol <span className="text-danger">*</span>
                    </label>
                    <input
                      type="text"
                      name="nombre"
                      className="form-control shadow-sm"
                      style={{ borderRadius: "10px", border: "1px solid #e0e0e0", padding: "12px" }}
                      placeholder="Ej: Contador, Supervisor, etc."
                      value={form.nombre}
                      onChange={handleInput}
                      required
                      autoFocus
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label fw-bold" style={{ color: "#2c3e50" }}>
                      <FaInfoCircle className="me-2" style={{ color: "#667eea" }} />
                      Descripción
                    </label>
                    <textarea
                      name="descripcion"
                      className="form-control shadow-sm"
                      style={{ borderRadius: "10px", border: "1px solid #e0e0e0", padding: "12px" }}
                      placeholder="Describe las responsabilidades de este rol..."
                      value={form.descripcion}
                      onChange={handleInput}
                      rows="3"
                    />
                  </div>
                </div>
                <div className="modal-footer border-0" style={{ background: "#f8f9fa" }}>
                  <button 
                    type="button" 
                    className="btn btn-light shadow-sm" 
                    onClick={closeModal}
                    style={{ borderRadius: "10px", fontWeight: "500" }}
                  >
                    <FaTimes className="me-2" />
                    Cancelar
                  </button>
                  <button 
                    type="submit" 
                    className="btn btn-primary shadow-sm"
                    style={{ 
                      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                      border: "none",
                      borderRadius: "10px",
                      fontWeight: "500"
                    }}
                  >
                    <FaCheckCircle className="me-2" />
                    {editId ? "Actualizar" : "Crear Rol"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal Ver Usuarios */}
      {showUsuariosModal && (
        <div className="modal fade show d-block" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
            <div className="modal-content border-0 shadow-lg" style={{ borderRadius: "15px" }}>
              <div className="modal-header border-0" style={{ background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", borderRadius: "15px 15px 0 0" }}>
                <h5 className="modal-title text-white fw-bold">
                  <FaUsers className="me-2" />
                  Usuarios con rol: {selectedRol?.nombre}
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setShowUsuariosModal(false)}
                ></button>
              </div>
              <div className="modal-body p-4">
                {usuariosRol.length === 0 ? (
                  <div className="text-center py-5">
                    <div
                      className="rounded-circle d-inline-flex align-items-center justify-content-center mb-3"
                      style={{
                        width: "80px",
                        height: "80px",
                        background: "#667eea20",
                      }}
                    >
                      <FaUsers style={{ fontSize: "40px", color: "#667eea" }} />
                    </div>
                    <h5 style={{ color: "#2c3e50" }}>No hay usuarios asignados a este rol</h5>
                    <p className="text-muted">Agrega usuarios desde el módulo de Usuarios</p>
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="table table-hover">
                      <thead style={{ background: "#f8f9fa" }}>
                        <tr>
                          <th style={{ color: "#2c3e50", fontWeight: "600", borderBottom: "2px solid #667eea" }}>Nombre</th>
                          <th style={{ color: "#2c3e50", fontWeight: "600", borderBottom: "2px solid #667eea" }}>DNI</th>
                          <th style={{ color: "#2c3e50", fontWeight: "600", borderBottom: "2px solid #667eea" }}>Estado</th>
                          <th style={{ color: "#2c3e50", fontWeight: "600", borderBottom: "2px solid #667eea" }}>Fecha Registro</th>
                        </tr>
                      </thead>
                      <tbody>
                        {usuariosRol.map((usuario) => (
                          <tr key={usuario.id_usuario} style={{ borderBottom: "1px solid #f0f0f0" }}>
                            <td className="align-middle" style={{ color: "#2c3e50" }}>
                              <FaUserTie className="me-2" style={{ color: "#667eea" }} />
                              {usuario.nombre_completo}
                            </td>
                            <td className="align-middle">
                              <small className="text-muted">{usuario.dni}</small>
                            </td>
                            <td className="align-middle">
                              <span 
                                className={`badge ${usuario.estado === 'activo' ? '' : 'bg-secondary'}`}
                                style={usuario.estado === 'activo' ? { 
                                  background: "linear-gradient(135deg, #27ae60 0%, #229954 100%)",
                                  borderRadius: "8px",
                                  padding: "6px 12px"
                                } : { borderRadius: "8px", padding: "6px 12px" }}
                              >
                                {usuario.estado === 'activo' ? <FaCheckCircle className="me-1" /> : <FaTimes className="me-1" />}
                                {usuario.estado}
                              </span>
                            </td>
                            <td className="align-middle">
                              <small className="text-muted">{new Date(usuario.fecha_registro).toLocaleDateString()}</small>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              <div className="modal-footer border-0" style={{ background: "#f8f9fa" }}>
                <div className="me-auto">
                  <span className="text-muted small">
                    Total: <strong style={{ color: "#2c3e50" }}>{usuariosRol.length}</strong> usuario(s)
                  </span>
                </div>
                <button
                  type="button"
                  className="btn btn-light shadow-sm"
                  onClick={() => setShowUsuariosModal(false)}
                  style={{ borderRadius: "10px", fontWeight: "500" }}
                >
                  <FaTimes className="me-2" />
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
