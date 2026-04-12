import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import { useAlerta } from "../../context/AlertaContext";
import {
  FaShieldAlt,
  FaSave,
  FaCheckSquare,
  FaSquare,
  FaUserCog,
  FaLock,
  FaUnlock,
} from "react-icons/fa";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

// Iconos por módulo
const ICONO_MODULO = {
  dashboard:     "📊",
  usuarios:      "👥",
  roles:         "🛡️",
  cuentas:       "🏦",
  prestamos:     "💰",
  aportaciones:  "🐷",
  pagos:         "💳",
  movimientos:   "🔄",
  reportes:      "📄",
  actividades:   "📋",
  liquidaciones: "📈",
  bitacora:      "🗒️",
  basedatos:     "🗃️",
};

export default function SuperAdmin() {
  const { token } = useAuth();
  const { mostrarAlerta } = useAlerta();

  const [roles, setRoles] = useState([]);
  const [modulos, setModulos] = useState([]);
  const [rolSeleccionado, setRolSeleccionado] = useState(null);
  const [permisos, setPermisos] = useState({});
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const headers = { Authorization: `Bearer ${token}` };

  // Cargar roles con sus permisos y lista de módulos
  const cargarDatos = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/permisos/todos/roles`, { headers });
      setRoles(res.data.data || []);
      setModulos(res.data.modulos || []);

      // Seleccionar el primer rol automáticamente
      if (res.data.data?.length > 0 && !rolSeleccionado) {
        const primero = res.data.data[0];
        setRolSeleccionado(primero);
        setPermisos(primero.permisos || {});
      }
    } catch (error) {
      mostrarAlerta("Error al cargar los datos de permisos", "error");
    } finally {
      setLoading(false);
    }
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  const seleccionarRol = (rol) => {
    setRolSeleccionado(rol);
    setPermisos(rol.permisos || {});
  };

  const toggleModulo = (key) => {
    setPermisos((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleTodos = () => {
    const todosActivos = modulos.every((m) => permisos[m.key]);
    const nuevo = {};
    modulos.forEach((m) => { nuevo[m.key] = !todosActivos; });
    setPermisos(nuevo);
  };

  const guardarPermisos = async () => {
    if (!rolSeleccionado) return;
    try {
      setGuardando(true);
      await axios.put(
        `${API_URL}/permisos/${rolSeleccionado.id_rol}`,
        { permisos },
        { headers }
      );
      mostrarAlerta(`Permisos del rol "${rolSeleccionado.nombre}" actualizados`, "success");
      // Refrescar los datos
      await cargarDatos();
    } catch (error) {
      mostrarAlerta(error.response?.data?.message || "Error al guardar los permisos", "error");
    } finally {
      setGuardando(false);
    }
  };

  const totalActivos = modulos.filter((m) => permisos[m.key]).length;
  const todosActivos = totalActivos === modulos.length;

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: 300 }}>
        <div className="spinner-border text-success" role="status" />
      </div>
    );
  }

  return (
    <div className="container-fluid px-3 px-md-4 py-4">
      {/* Encabezado */}
      <div className="d-flex align-items-center gap-3 mb-4">
        <div
          style={{
            background: "linear-gradient(135deg, #6c63ff 0%, #a855f7 100%)",
            borderRadius: 14,
            width: 52,
            height: 52,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 4px 18px rgba(108,99,255,0.35)",
            flexShrink: 0,
          }}
        >
          <FaShieldAlt style={{ color: "#fff", fontSize: 24 }} />
        </div>
        <div>
          <h4 className="mb-0 fw-bold" style={{ color: "#1a2035" }}>
            Control de Accesos
          </h4>
          <span className="text-muted" style={{ fontSize: 13 }}>
            Selecciona un rol y configura los módulos que puede ver
          </span>
        </div>
      </div>

      <div className="row g-4">
        {/* Panel izquierdo: lista de roles */}
        <div className="col-12 col-lg-4">
          <div
            className="card border-0 shadow-sm h-100"
            style={{ borderRadius: 16 }}
          >
            <div
              className="card-header border-0 py-3 px-4"
              style={{
                background: "linear-gradient(135deg, #1a2035 0%, #2d3a5a 100%)",
                borderRadius: "16px 16px 0 0",
              }}
            >
              <div className="d-flex align-items-center gap-2">
                <FaUserCog style={{ color: "#a8cd3a", fontSize: 18 }} />
                <span className="fw-semibold text-white" style={{ fontSize: 15 }}>
                  Roles del Sistema
                </span>
              </div>
            </div>
            <div className="card-body p-0">
              {roles.length === 0 ? (
                <div className="text-center text-muted py-4">No hay roles disponibles</div>
              ) : (
                <div className="list-group list-group-flush">
                  {roles.map((rol) => {
                    const activos = Object.values(rol.permisos || {}).filter(Boolean).length;
                    const isSelected = rolSeleccionado?.id_rol === rol.id_rol;
                    return (
                      <button
                        key={rol.id_rol}
                        type="button"
                        onClick={() => seleccionarRol(rol)}
                        className="list-group-item list-group-item-action border-0 py-3 px-4"
                        style={{
                          background: isSelected
                            ? "linear-gradient(90deg, rgba(168,205,58,0.12) 0%, rgba(168,205,58,0.04) 100%)"
                            : "transparent",
                          borderLeft: isSelected
                            ? "3px solid #a8cd3a"
                            : "3px solid transparent",
                          transition: "all 0.2s",
                        }}
                      >
                        <div className="d-flex justify-content-between align-items-start">
                          <div>
                            <div
                              className="fw-semibold"
                              style={{
                                color: isSelected ? "#1a2035" : "#374151",
                                fontSize: 14,
                              }}
                            >
                              {rol.nombre}
                            </div>
                            {rol.descripcion && (
                              <div
                                className="text-muted mt-1"
                                style={{ fontSize: 12, lineHeight: 1.3 }}
                              >
                                {rol.descripcion}
                              </div>
                            )}
                          </div>
                          <span
                            className="badge ms-2 mt-1"
                            style={{
                              background: isSelected ? "#a8cd3a" : "#e5e7eb",
                              color: isSelected ? "#1a2035" : "#6b7280",
                              borderRadius: 20,
                              fontSize: 11,
                              fontWeight: 600,
                              flexShrink: 0,
                            }}
                          >
                            {activos}/{modulos.length}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Panel derecho: módulos con checkboxes */}
        <div className="col-12 col-lg-8">
          {!rolSeleccionado ? (
            <div
              className="card border-0 shadow-sm d-flex align-items-center justify-content-center"
              style={{ borderRadius: 16, minHeight: 300 }}
            >
              <div className="text-center text-muted py-5">
                <FaUserCog style={{ fontSize: 48, opacity: 0.25, marginBottom: 12 }} />
                <div>Selecciona un rol para gestionar sus módulos</div>
              </div>
            </div>
          ) : (
            <div className="card border-0 shadow-sm" style={{ borderRadius: 16 }}>
              {/* Header del panel de módulos */}
              <div
                className="card-header border-0 py-3 px-4"
                style={{
                  background: "linear-gradient(135deg, #1a2035 0%, #2d3a5a 100%)",
                  borderRadius: "16px 16px 0 0",
                }}
              >
                <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                  <div>
                    <span className="fw-semibold text-white" style={{ fontSize: 15 }}>
                      Módulos para:{" "}
                      <span style={{ color: "#a8cd3a" }}>{rolSeleccionado.nombre}</span>
                    </span>
                    <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 12, marginTop: 2 }}>
                      {totalActivos} de {modulos.length} módulos habilitados
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={toggleTodos}
                    className="btn btn-sm"
                    style={{
                      background: todosActivos
                        ? "rgba(239,68,68,0.15)"
                        : "rgba(168,205,58,0.15)",
                      color: todosActivos ? "#ef4444" : "#a8cd3a",
                      border: `1px solid ${todosActivos ? "#ef4444" : "#a8cd3a"}`,
                      borderRadius: 8,
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    {todosActivos ? (
                      <><FaLock style={{ marginRight: 5 }} />Deshabilitar todos</>
                    ) : (
                      <><FaUnlock style={{ marginRight: 5 }} />Habilitar todos</>
                    )}
                  </button>
                </div>
              </div>

              {/* Grid de módulos */}
              <div className="card-body p-4">
                <div className="row g-3 mb-4">
                  {modulos.map((modulo) => {
                    const activo = !!permisos[modulo.key];
                    return (
                      <div key={modulo.key} className="col-12 col-sm-6 col-xl-4">
                        <div
                          onClick={() => toggleModulo(modulo.key)}
                          style={{
                            border: `2px solid ${activo ? "#a8cd3a" : "#e5e7eb"}`,
                            borderRadius: 12,
                            padding: "14px 16px",
                            cursor: "pointer",
                            background: activo
                              ? "linear-gradient(135deg, rgba(168,205,58,0.08) 0%, rgba(168,205,58,0.03) 100%)"
                              : "#fafafa",
                            transition: "all 0.2s",
                            userSelect: "none",
                          }}
                        >
                          <div className="d-flex align-items-center gap-3">
                            <span style={{ fontSize: 22, lineHeight: 1 }}>
                              {ICONO_MODULO[modulo.key] || "📦"}
                            </span>
                            <div className="flex-grow-1">
                              <div
                                className="fw-semibold"
                                style={{
                                  fontSize: 13,
                                  color: activo ? "#1a2035" : "#9ca3af",
                                }}
                              >
                                {modulo.label}
                              </div>
                              <div style={{ fontSize: 11, color: activo ? "#a8cd3a" : "#d1d5db", marginTop: 2 }}>
                                {activo ? "Habilitado" : "Deshabilitado"}
                              </div>
                            </div>
                            <div>
                              {activo ? (
                                <FaCheckSquare style={{ color: "#a8cd3a", fontSize: 20 }} />
                              ) : (
                                <FaSquare style={{ color: "#d1d5db", fontSize: 20 }} />
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Botón guardar */}
                <div className="d-flex justify-content-end">
                  <button
                    type="button"
                    onClick={guardarPermisos}
                    disabled={guardando}
                    className="btn px-5 py-2 fw-semibold"
                    style={{
                      background: "linear-gradient(135deg, #a8cd3a 0%, #7eb32b 100%)",
                      color: "#1a2035",
                      border: "none",
                      borderRadius: 10,
                      fontSize: 14,
                      boxShadow: "0 4px 14px rgba(168,205,58,0.35)",
                    }}
                  >
                    {guardando ? (
                      <span className="spinner-border spinner-border-sm me-2" />
                    ) : (
                      <FaSave style={{ marginRight: 8 }} />
                    )}
                    Guardar Permisos
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
