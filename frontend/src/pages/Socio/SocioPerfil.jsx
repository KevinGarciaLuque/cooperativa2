import { useAuth } from "../../context/AuthContext";
import { useEffect, useState } from "react";
import axios from "axios";
import {
  FaUserCircle,
  FaMoneyBillWave,
  FaPiggyBank,
  FaCalendarAlt,
  FaLock,
  FaCheckCircle,
  FaExclamationTriangle,
  FaSignOutAlt,
  FaUserEdit,
} from "react-icons/fa";

const verde = "#a8cd3a";
const azul = "#434d57";
const bgCard = "#f8faf5";

export default function SocioPerfil() {
  const { user, token, logout } = useAuth();
  const [cuentas, setCuentas] = useState([]);
  const [aportaciones, setAportaciones] = useState([]);
  const [loading, setLoading] = useState(true);

  // Para tabs
  const [tab, setTab] = useState("perfil");

  // Para cambio de contraseña
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [msgTipo, setMsgTipo] = useState("success");

  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [cuentasRes, aportacionesRes] = await Promise.all([
          axios.get(`${API_URL}/cuentas?socio=${user.id_usuario}`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          axios.get(`${API_URL}/aportaciones?socio=${user.id_usuario}`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);
        setCuentas(cuentasRes.data || []);
        setAportaciones(aportacionesRes.data || []);
      } catch (error) {
        setMsg("No se pudieron cargar los datos.");
        setMsgTipo("error");
      }
      setLoading(false);
    };
    if (user?.id_usuario) fetchData();
  }, [user, token, API_URL]);

  // Cambio de contraseña
  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setMsg("");
    try {
      await axios.put(
        `${API_URL}/usuarios/${user.id_usuario}`,
        { password },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMsg("Contraseña actualizada con éxito.");
      setMsgTipo("success");
      setPassword("");
      setShowPasswordModal(false);
    } catch {
      setMsg("Error al actualizar la contraseña.");
      setMsgTipo("error");
    }
  };

  if (!user) return null;

  return (
    <div className="container py-4" style={{ maxWidth: 1000 }}>
      {/* Card principal */}
      <div className="card border-0 shadow-lg rounded-4">
        {/* Cabecera perfil */}
        <div
          className="card-header d-flex flex-wrap align-items-center justify-content-between gap-3"
          style={{
            background: azul,
            color: "#fff",
            borderTopLeftRadius: "1.5rem",
            borderTopRightRadius: "1.5rem",
          }}
        >
          <div className="d-flex align-items-center gap-3">
            <FaUserCircle size={70} color={verde} />
            <div>
              <h2 className="mb-0 fw-bold" style={{ letterSpacing: ".5px" }}>
                {user.nombre_completo}
              </h2>
              <div className="small">
                <span className="badge rounded-pill bg-light text-dark me-1">
                  DNI: {user.dni}
                </span>
                <span className="badge rounded-pill bg-light text-dark me-1">
                  {user.correo}
                </span>
              </div>
              <div className="small text-success fw-bold mt-1">
                <FaUserEdit className="me-1" /> Socio
              </div>
            </div>
          </div>
          <button
            className="btn btn-outline-success px-4 d-flex align-items-center fw-bold"
            style={{ border: `2px solid ${verde}` }}
            onClick={logout}
          >
            <FaSignOutAlt className="me-2" /> Cerrar sesión
          </button>
        </div>

        {/* Tabs Bootstrap */}
        <div className="card-body bg-white">
          <ul className="nav nav-tabs mb-4" role="tablist">
            <li className="nav-item" role="presentation">
              <button
                className={`nav-link ${tab === "perfil" ? "active" : ""}`}
                type="button"
                onClick={() => setTab("perfil")}
                role="tab"
              >
                Mi perfil
              </button>
            </li>
            <li className="nav-item" role="presentation">
              <button
                className={`nav-link ${tab === "movimientos" ? "active" : ""}`}
                type="button"
                onClick={() => setTab("movimientos")}
                role="tab"
              >
                Movimientos
              </button>
            </li>
            <li className="nav-item" role="presentation">
              <button
                className={`nav-link ${tab === "seguridad" ? "active" : ""}`}
                type="button"
                onClick={() => setTab("seguridad")}
                role="tab"
              >
                Seguridad
              </button>
            </li>
          </ul>

          <div className="tab-content">
            {/* TAB 1: PERFIL */}
            <div
              className={`tab-pane fade ${
                tab === "perfil" ? "show active" : ""
              }`}
            >
              <div className="row g-3 mb-3">
                <div className="col-md-6">
                  <div className="card border-0 shadow-sm rounded-4 h-100">
                    <div className="card-body">
                      <div className="d-flex align-items-center mb-2">
                        <FaMoneyBillWave
                          className="me-2 text-success"
                          size={30}
                        />
                        <span className="fw-bold fs-5">Cuentas</span>
                      </div>
                      <ul className="list-group list-group-flush">
                        {loading ? (
                          <li className="list-group-item border-0">
                            <span className="text-muted">Cargando...</span>
                          </li>
                        ) : cuentas.length === 0 ? (
                          <li className="list-group-item border-0 text-secondary">
                            Sin cuentas asociadas.
                          </li>
                        ) : (
                          cuentas.map((c) => (
                            <li
                              className="list-group-item border-0 d-flex justify-content-between align-items-center py-2"
                              key={c.id_cuenta}
                            >
                              <span>
                                <span className="fw-semibold">
                                  {c.tipo_cuenta}
                                </span>
                              </span>
                              <span className="badge bg-light text-dark fs-6">
                                L. {parseFloat(c.saldo).toFixed(2)}
                              </span>
                            </li>
                          ))
                        )}
                      </ul>
                    </div>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="card border-0 shadow-sm rounded-4 h-100">
                    <div className="card-body">
                      <div className="d-flex align-items-center mb-2">
                        <FaPiggyBank className="me-2 text-warning" size={30} />
                        <span className="fw-bold fs-5">Aportaciones</span>
                      </div>
                      <ul className="list-group list-group-flush">
                        {loading ? (
                          <li className="list-group-item border-0">
                            <span className="text-muted">Cargando...</span>
                          </li>
                        ) : aportaciones.length === 0 ? (
                          <li className="list-group-item border-0 text-secondary">
                            No hay aportaciones.
                          </li>
                        ) : (
                          aportaciones.slice(0, 5).map((a) => (
                            <li
                              className="list-group-item border-0 d-flex justify-content-between align-items-center py-2"
                              key={a.id_aportacion}
                            >
                              <span>
                                <span className="fw-semibold text-success">
                                  L. {parseFloat(a.monto).toFixed(2)}
                                </span>
                              </span>
                              <span className="small text-muted">
                                <FaCalendarAlt className="me-1" />
                                {a.fecha ? a.fecha.substring(0, 10) : "-"}
                              </span>
                            </li>
                          ))
                        )}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {/* TAB 2: Movimientos */}
            <div
              className={`tab-pane fade ${
                tab === "movimientos" ? "show active" : ""
              }`}
            >
              <div className="text-muted text-center py-4">
                <em>
                  Puedes agregar aquí el historial detallado o reportes
                  personalizados.
                </em>
              </div>
            </div>
            {/* TAB 3: Seguridad */}
            <div
              className={`tab-pane fade ${
                tab === "seguridad" ? "show active" : ""
              }`}
            >
              <div className="d-flex flex-column align-items-center py-3">
                <button
                  className="btn btn-outline-primary d-flex align-items-center mb-3"
                  onClick={() => setShowPasswordModal(true)}
                  style={{ border: `1.5px solid ${azul}` }}
                >
                  <FaLock className="me-2" />
                  Cambiar contraseña
                </button>
                <div className="text-muted small">
                  Actualiza tu contraseña periódicamente para proteger tu
                  cuenta.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Mensaje global */}
        {msg && (
          <div
            className={`alert mb-0 mx-4 d-flex align-items-center ${
              msgTipo === "success" ? "alert-success" : "alert-danger"
            }`}
            style={{ fontSize: "1.05rem" }}
          >
            {msgTipo === "success" ? (
              <FaCheckCircle className="me-2 text-success" />
            ) : (
              <FaExclamationTriangle className="me-2 text-danger" />
            )}
            {msg}
          </div>
        )}
        <div className="text-center py-3 text-muted small border-top bg-white rounded-bottom-4">
          Sistema Cooperativa • Panel de Socio
        </div>
      </div>

      {/* Modal para cambiar contraseña */}
      {showPasswordModal && (
        <div
          className="modal fade show"
          style={{
            display: "block",
            background: "#0007",
            backdropFilter: "blur(2px)",
            zIndex: 2000,
          }}
          tabIndex="-1"
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content rounded-4 shadow-lg">
              <form onSubmit={handlePasswordChange}>
                <div className="modal-header bg-primary text-white rounded-top-4">
                  <h5 className="modal-title">
                    <FaLock className="me-2" />
                    Cambiar contraseña
                  </h5>
                  <button
                    type="button"
                    className="btn-close btn-close-white"
                    aria-label="Cerrar"
                    onClick={() => setShowPasswordModal(false)}
                  ></button>
                </div>
                <div className="modal-body">
                  <label className="form-label">Nueva contraseña</label>
                  <input
                    type="password"
                    className="form-control"
                    placeholder="Ingresa tu nueva contraseña"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    autoFocus
                  />
                  <div className="text-muted mt-2 small">
                    La contraseña debe tener al menos 6 caracteres.
                  </div>
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => setShowPasswordModal(false)}
                  >
                    Cancelar
                  </button>
                  <button type="submit" className="btn btn-success">
                    Actualizar
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
