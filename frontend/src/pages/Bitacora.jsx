import { useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import {
  FaClipboardList,
  FaUsers,
  FaCalendarDay,
  FaFilter,
  FaTimes,
  FaUserTie,
  FaClock,
  FaInfoCircle,
  FaCheckCircle,
  FaEdit,
  FaTrash,
  FaPlus,
  FaExclamationTriangle
} from "react-icons/fa";

export default function Bitacora() {
  const { token } = useAuth();
  const [bitacora, setBitacora] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [filtroUsuario, setFiltroUsuario] = useState("");
  const [filtroAccion, setFiltroAccion] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);

  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

  // Obtener bitácora y usuarios
  const fetchData = async () => {
    try {
      setLoading(true);
      const [bitacoraRes, usuariosRes] = await Promise.all([
        axios.get(`${API_URL}/bitacora`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`${API_URL}/usuarios`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      setBitacora(Array.isArray(bitacoraRes.data) ? bitacoraRes.data : bitacoraRes.data.data || []);
      setUsuarios(Array.isArray(usuariosRes.data) ? usuariosRes.data : usuariosRes.data.data || []);
    } catch {
      setMsg("No se pudieron obtener los datos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line
  }, []);

  // Filtros rápidos
  const bitacoraFiltrada = bitacora.filter((b) => {
    let ok = true;
    if (filtroUsuario) ok = ok && b.id_usuario === Number(filtroUsuario);
    if (filtroAccion)
      ok = ok && b.accion.toLowerCase().includes(filtroAccion.toLowerCase());
    return ok;
  });

  // Obtener estadísticas
  const usuariosActivos = [...new Set(bitacora.map(b => b.id_usuario))].length;
  const hoy = new Date().toLocaleDateString();
  const accionesHoy = bitacora.filter(b => {
    const fecha = new Date(b.fecha).toLocaleDateString();
    return fecha === hoy;
  }).length;

  // Obtener icono según el tipo de acción
  const getAccionIcon = (accion) => {
    const accionLower = accion.toLowerCase();
    if (accionLower.includes("crear") || accionLower.includes("registr")) {
      return <FaPlus style={{ fontSize: "12px", color: "#27ae60" }} />;
    }
    if (accionLower.includes("editar") || accionLower.includes("actualiz") || accionLower.includes("modific")) {
      return <FaEdit style={{ fontSize: "12px", color: "#3498db" }} />;
    }
    if (accionLower.includes("eliminar") || accionLower.includes("borrar")) {
      return <FaTrash style={{ fontSize: "12px", color: "#e74c3c" }} />;
    }
    return <FaInfoCircle style={{ fontSize: "12px", color: "#667eea" }} />;
  };

  // Obtener color del badge según acción
  const getAccionBadgeStyle = (accion) => {
    const accionLower = accion.toLowerCase();
    if (accionLower.includes("crear") || accionLower.includes("registr")) {
      return {
        background: "linear-gradient(135deg, #27ae60 0%, #229954 100%)",
        borderRadius: "8px",
        padding: "6px 12px",
        fontSize: "12px"
      };
    }
    if (accionLower.includes("editar") || accionLower.includes("actualiz") || accionLower.includes("modific")) {
      return {
        background: "linear-gradient(135deg, #3498db 0%, #2980b9 100%)",
        borderRadius: "8px",
        padding: "6px 12px",
        fontSize: "12px"
      };
    }
    if (accionLower.includes("eliminar") || accionLower.includes("borrar")) {
      return {
        background: "linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)",
        borderRadius: "8px",
        padding: "6px 12px",
        fontSize: "12px"
      };
    }
    return {
      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      borderRadius: "8px",
      padding: "6px 12px",
      fontSize: "12px"
    };
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
      <div className="mb-4">
        <h2 className="mb-1 fw-bold" style={{ color: "#2c3e50" }}>
          <FaClipboardList className="me-2" style={{ color: "#667eea" }} />
          Bitácora de Actividad
        </h2>
        <p className="text-muted mb-0">Registro de todas las acciones realizadas en el sistema</p>
      </div>

      {msg && (
        <div className="alert alert-info border-0 shadow-sm mb-4" style={{ borderRadius: "10px", borderLeft: "4px solid #3498db" }}>
          <FaInfoCircle className="me-2" />
          {msg}
        </div>
      )}

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
                  <p className="text-muted mb-1 small">Total de Registros</p>
                  <h3 className="mb-0 fw-bold" style={{ color: "#2c3e50" }}>
                    {bitacoraFiltrada.length}
                  </h3>
                  <p className="mb-0 small text-muted">
                    Eventos registrados
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
                  <FaClipboardList style={{ fontSize: "24px", color: "#667eea" }} />
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
                  <p className="text-muted mb-1 small">Usuarios Activos</p>
                  <h3 className="mb-0 fw-bold" style={{ color: "#2c3e50" }}>
                    {usuariosActivos}
                  </h3>
                  <p className="mb-0 small" style={{ color: "#27ae60" }}>
                    <FaCheckCircle className="me-1" />
                    Con actividad reciente
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
                  <p className="text-muted mb-1 small">Acciones Hoy</p>
                  <h3 className="mb-0 fw-bold" style={{ color: "#2c3e50" }}>
                    {accionesHoy}
                  </h3>
                  <p className="mb-0 small text-muted">
                    Registros del día
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
                  <FaCalendarDay style={{ fontSize: "24px", color: "#3498db" }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="card border-0 shadow-sm mb-4" style={{ borderRadius: "15px" }}>
        <div className="card-body p-4">
          <h5 className="mb-3 fw-bold" style={{ color: "#2c3e50" }}>
            <FaFilter className="me-2" style={{ color: "#667eea" }} />
            Filtros
          </h5>
          <div className="row g-3">
            <div className="col-12 col-md-5">
              <label className="form-label fw-bold small" style={{ color: "#2c3e50" }}>
                <FaUsers className="me-2" style={{ color: "#667eea" }} />
                Usuario
              </label>
              <select
                className="form-select shadow-sm"
                style={{ borderRadius: "10px", border: "1px solid #e0e0e0" }}
                value={filtroUsuario}
                onChange={(e) => setFiltroUsuario(e.target.value)}
              >
                <option value="">Todos los usuarios</option>
                {usuarios.map((u) => (
                  <option key={u.id_usuario} value={u.id_usuario}>
                    {u.nombre_completo}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-12 col-md-5">
              <label className="form-label fw-bold small" style={{ color: "#2c3e50" }}>
                <FaClipboardList className="me-2" style={{ color: "#667eea" }} />
                Acción
              </label>
              <input
                type="text"
                className="form-control shadow-sm"
                style={{ borderRadius: "10px", border: "1px solid #e0e0e0" }}
                placeholder="Buscar por acción (ej: crear, eliminar, editar)"
                value={filtroAccion}
                onChange={(e) => setFiltroAccion(e.target.value)}
              />
            </div>
            <div className="col-12 col-md-2 d-flex align-items-end">
              <button
                className="btn btn-light shadow-sm w-100"
                style={{ borderRadius: "10px", fontWeight: "500" }}
                onClick={() => {
                  setFiltroUsuario("");
                  setFiltroAccion("");
                }}
              >
                <FaTimes className="me-2" />
                Limpiar
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabla */}
      <div className="card border-0 shadow-sm" style={{ borderRadius: "15px" }}>
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-hover mb-0">
              <thead style={{ background: "#f8f9fa" }}>
                <tr>
                  <th style={{ color: "#2c3e50", fontWeight: "600", borderBottom: "2px solid #667eea", padding: "16px" }}>#</th>
                  <th style={{ color: "#2c3e50", fontWeight: "600", borderBottom: "2px solid #667eea", padding: "16px" }}>Usuario</th>
                  <th style={{ color: "#2c3e50", fontWeight: "600", borderBottom: "2px solid #667eea", padding: "16px" }}>Acción</th>
                  <th style={{ color: "#2c3e50", fontWeight: "600", borderBottom: "2px solid #667eea", padding: "16px" }}>Detalle</th>
                  <th style={{ color: "#2c3e50", fontWeight: "600", borderBottom: "2px solid #667eea", padding: "16px" }}>Fecha/Hora</th>
                </tr>
              </thead>
              <tbody>
                {bitacoraFiltrada.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-5">
                      <div
                        className="rounded-circle d-inline-flex align-items-center justify-content-center mb-3"
                        style={{
                          width: "80px",
                          height: "80px",
                          background: "#f39c1220",
                        }}
                      >
                        <FaExclamationTriangle style={{ fontSize: "40px", color: "#f39c12" }} />
                      </div>
                      <h5 style={{ color: "#2c3e50" }}>No hay registros de bitácora</h5>
                      <p className="text-muted">Los eventos del sistema aparecerán aquí</p>
                    </td>
                  </tr>
                ) : (
                  bitacoraFiltrada.map((b, i) => (
                    <tr key={b.id_bitacora} style={{ borderBottom: "1px solid #f0f0f0" }}>
                      <td className="align-middle" style={{ padding: "16px" }}>
                        <span className="badge bg-light text-dark" style={{ borderRadius: "8px", padding: "6px 10px" }}>
                          {i + 1}
                        </span>
                      </td>
                      <td className="align-middle" style={{ padding: "16px", color: "#2c3e50" }}>
                        <FaUserTie className="me-2" style={{ color: "#667eea" }} />
                        {usuarios.find((u) => u.id_usuario === b.id_usuario)
                          ?.nombre_completo || "Usuario desconocido"}
                      </td>
                      <td className="align-middle" style={{ padding: "16px" }}>
                        <span className="badge text-white" style={getAccionBadgeStyle(b.accion)}>
                          {getAccionIcon(b.accion)}
                          <span className="ms-1">{b.accion}</span>
                        </span>
                      </td>
                      <td className="align-middle" style={{ padding: "16px" }}>
                        <small className="text-muted">{b.detalle}</small>
                      </td>
                      <td className="align-middle" style={{ padding: "16px" }}>
                        <div className="d-flex align-items-center">
                          <FaClock className="me-2" style={{ color: "#95a5a6", fontSize: "14px" }} />
                          <small className="text-muted">
                            {b.fecha ? new Date(b.fecha).toLocaleString('es-ES', {
                              year: 'numeric',
                              month: '2-digit',
                              day: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit'
                            }) : "-"}
                          </small>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
        {bitacoraFiltrada.length > 0 && (
          <div className="card-footer border-0" style={{ background: "#f8f9fa", borderRadius: "0 0 15px 15px", padding: "16px" }}>
            <div className="text-muted small">
              Mostrando <strong style={{ color: "#2c3e50" }}>{bitacoraFiltrada.length}</strong> de <strong style={{ color: "#2c3e50" }}>{bitacora.length}</strong> registros
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
