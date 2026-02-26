import { useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import TablaUsuarios from "./TablaUsuarios";
import ModalAcciones from "./ModalAcciones";
import ModalConfirmacion from "../../components/ModalConfirmacion";
import { FaUserPlus, FaUsers, FaUserCheck, FaUserTimes, FaSearch } from "react-icons/fa";
import { useAlerta } from "../../context/AlertaContext";

export default function Usuarios() {
  const { token } = useAuth();
  const { mostrarAlerta } = useAlerta();
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState({
    open: false,
    tipo: "crear",
    usuario: null,
  });
  const [filtro, setFiltro] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState("todos");
  const [confirmModal, setConfirmModal] = useState({
    show: false,
    id: null,
  });
  const [deleting, setDeleting] = useState(false);

  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

  const fetchUsuarios = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/usuarios`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUsuarios(res.data.data || []);
    } catch (err) {
      mostrarAlerta("No se pudieron obtener los usuarios.", "error");
      setUsuarios([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsuarios();
    // eslint-disable-next-line
  }, []);

  const openCrear = () =>
    setModal({ open: true, tipo: "crear", usuario: null });
  const openEditar = (usuario) =>
    setModal({ open: true, tipo: "editar", usuario });
  const closeModal = () => setModal({ open: false, tipo: "", usuario: null });

  const handleEliminar = (id) => {
    setConfirmModal({ show: true, id });
  };

  const confirmarEliminar = async () => {
    setDeleting(true);
    try {
      await axios.delete(`${API_URL}/usuarios/${confirmModal.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      mostrarAlerta("Usuario eliminado correctamente.", "success");
      fetchUsuarios();
    } catch (err) {
      mostrarAlerta("Error al eliminar el usuario.", "error");
    } finally {
      setDeleting(false);
      setConfirmModal({ show: false, id: null });
    }
  };

  // Filtros combinados
  const usuariosFiltrados = usuarios.filter((u) => {
    const coincideBusqueda = [u.nombre_completo, u.dni, u.correo]
      .join(" ")
      .toLowerCase()
      .includes(filtro.toLowerCase());
    
    const coincideEstado = 
      estadoFiltro === "todos" ||
      (estadoFiltro === "activo" && u.estado === "activo") ||
      (estadoFiltro === "inactivo" && u.estado === "inactivo");
    
    return coincideBusqueda && coincideEstado;
  });

  // Estadísticas
  const totalUsuarios = usuarios.length;
  const usuariosActivos = usuarios.filter(u => u.estado === "activo").length;
  const usuariosInactivos = usuarios.filter(u => u.estado === "inactivo").length;
  const sociosCount = usuarios.filter(u => u.rol_id !== 1).length;

  return (
    <div className="container-fluid px-4 py-4" style={{ background: "#f8f9fa", minHeight: "100vh" }}>
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="mb-1 fw-bold" style={{ color: "#2c3e50" }}>
            <FaUsers className="me-2" style={{ color: "#3498db" }} />
            Gestión de Usuarios
          </h2>
          <p className="text-muted mb-0">Administra los socios y usuarios del sistema</p>
        </div>
        <button 
          className="btn btn-primary btn-lg shadow-sm" 
          onClick={openCrear}
          style={{ 
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            border: "none",
            borderRadius: "10px"
          }}
        >
          <FaUserPlus className="me-2" />
          Nuevo Usuario
        </button>
      </div>

      {/* Tarjetas de Estadísticas */}
      <div className="row g-3 mb-4">
        <div className="col-12 col-sm-6 col-lg-3">
          <div className="card border-0 shadow-sm h-100" style={{ borderRadius: "15px", borderLeft: "4px solid #3498db" }}>
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <p className="text-muted mb-1 small">Total Usuarios</p>
                  <h3 className="mb-0 fw-bold" style={{ color: "#2c3e50" }}>{totalUsuarios}</h3>
                </div>
                <div 
                  className="rounded-circle d-flex align-items-center justify-content-center"
                  style={{ width: "50px", height: "50px", background: "rgba(52, 152, 219, 0.1)" }}
                >
                  <FaUsers style={{ fontSize: "24px", color: "#3498db" }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-lg-3">
          <div className="card border-0 shadow-sm h-100" style={{ borderRadius: "15px", borderLeft: "4px solid #27ae60" }}>
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <p className="text-muted mb-1 small">Usuarios Activos</p>
                  <h3 className="mb-0 fw-bold" style={{ color: "#27ae60" }}>{usuariosActivos}</h3>
                </div>
                <div 
                  className="rounded-circle d-flex align-items-center justify-content-center"
                  style={{ width: "50px", height: "50px", background: "rgba(39, 174, 96, 0.1)" }}
                >
                  <FaUserCheck style={{ fontSize: "24px", color: "#27ae60" }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-lg-3">
          <div className="card border-0 shadow-sm h-100" style={{ borderRadius: "15px", borderLeft: "4px solid #e74c3c" }}>
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <p className="text-muted mb-1 small">Usuarios Inactivos</p>
                  <h3 className="mb-0 fw-bold" style={{ color: "#e74c3c" }}>{usuariosInactivos}</h3>
                </div>
                <div 
                  className="rounded-circle d-flex align-items-center justify-content-center"
                  style={{ width: "50px", height: "50px", background: "rgba(231, 76, 60, 0.1)" }}
                >
                  <FaUserTimes style={{ fontSize: "24px", color: "#e74c3c" }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-lg-3">
          <div className="card border-0 shadow-sm h-100" style={{ borderRadius: "15px", borderLeft: "4px solid #f39c12" }}>
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <p className="text-muted mb-1 small">Total Socios</p>
                  <h3 className="mb-0 fw-bold" style={{ color: "#f39c12" }}>{sociosCount}</h3>
                </div>
                <div 
                  className="rounded-circle d-flex align-items-center justify-content-center"
                  style={{ width: "50px", height: "50px", background: "rgba(243, 156, 18, 0.1)" }}
                >
                  <FaUsers style={{ fontSize: "24px", color: "#f39c12" }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Barra de Búsqueda y Filtros */}
      <div className="card border-0 shadow-sm mb-4" style={{ borderRadius: "15px" }}>
        <div className="card-body">
          <div className="row g-3">
            <div className="col-12 col-md-6">
              <div className="input-group">
                <span className="input-group-text bg-white border-end-0" style={{ borderRadius: "10px 0 0 10px" }}>
                  <FaSearch style={{ color: "#95a5a6" }} />
                </span>
                <input
                  type="text"
                  className="form-control border-start-0"
                  placeholder="Buscar por nombre, DNI o correo..."
                  value={filtro}
                  onChange={(e) => setFiltro(e.target.value)}
                  style={{ borderRadius: "0 10px 10px 0", boxShadow: "none" }}
                />
              </div>
            </div>
            <div className="col-12 col-md-6">
              <div className="btn-group w-100" role="group">
                <button
                  type="button"
                  className={`btn ${estadoFiltro === "todos" ? "btn-primary" : "btn-outline-primary"}`}
                  onClick={() => setEstadoFiltro("todos")}
                  style={{ borderRadius: "10px 0 0 10px" }}
                >
                  Todos
                </button>
                <button
                  type="button"
                  className={`btn ${estadoFiltro === "activo" ? "btn-success" : "btn-outline-success"}`}
                  onClick={() => setEstadoFiltro("activo")}
                >
                  Activos
                </button>
                <button
                  type="button"
                  className={`btn ${estadoFiltro === "inactivo" ? "btn-danger" : "btn-outline-danger"}`}
                  onClick={() => setEstadoFiltro("inactivo")}
                  style={{ borderRadius: "0 10px 10px 0" }}
                >
                  Inactivos
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabla de Usuarios */}
      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status" style={{ width: "3rem", height: "3rem" }}>
            <span className="visually-hidden">Cargando...</span>
          </div>
          <p className="mt-3 text-muted">Cargando usuarios...</p>
        </div>
      ) : (
        <TablaUsuarios
          usuarios={usuariosFiltrados}
          onEdit={openEditar}
          onDelete={handleEliminar}
        />
      )}

      {/* Modales */}
      <ModalAcciones
        show={modal.open}
        tipo={modal.tipo}
        usuario={modal.usuario}
        onClose={closeModal}
        onRefresh={fetchUsuarios}
      />

      <ModalConfirmacion
        show={confirmModal.show}
        mensaje="¿Estás seguro de eliminar este usuario?"
        onConfirm={confirmarEliminar}
        onCancel={() => setConfirmModal({ show: false, id: null })}
        loading={deleting}
      />
    </div>
  );
}
