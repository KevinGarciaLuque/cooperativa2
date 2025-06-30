import { useRef, useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  FaBars,
  FaUserCircle,
  FaCog,
  FaSignOutAlt,
  FaUser,
} from "react-icons/fa";

const verde = "#a8cd3a";
const azul = "#434d57";

export default function Navbar({ user, onLogout, onMenuClick }) {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const refMenu = useRef();

  // Asegura que se muestre algún nombre del usuario
  const nombreMostrar =
    user?.nombre_completo || user?.nombre || user?.username || "Usuario";

  // Cierra el menú si haces click fuera de él
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (refMenu.current && !refMenu.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  return (
    <nav
      className="navbar navbar-expand-lg shadow-sm fixed-top"
      style={{
        background: azul,
        color: "#fff",
        minHeight: 62,
        zIndex: 1100,
        padding: 0,
      }}
    >
      <div className="container-fluid d-flex align-items-center">
        {/* Menú hamburguesa solo móvil */}
        {user && (
          <button
            className="btn d-lg-none me-2"
            style={{
              color: verde,
              background: "#fff",
              border: `2px solid ${verde}`,
              borderRadius: 8,
              fontSize: 26,
            }}
            onClick={onMenuClick}
          >
            <FaBars />
          </button>
        )}

        {/* Logo y nombre */}
        <Link
          className="navbar-brand d-flex align-items-center fw-bold"
          to={user ? "/dashboard" : "/"}
          style={{ color: verde, fontSize: 26, letterSpacing: ".5px" }}
        >
          <img
            src="/logo-cooperativa.jpg"
            alt="Logo"
            style={{
              maxWidth: 36,
              borderRadius: 8,
              marginRight: 10,
              boxShadow: `0 2px 8px ${verde}22`,
              border: `2px solid ${verde}`,
              background: "#fff",
            }}
          />
          <span className="d-none d-sm-inline" style={{ color: verde }}>
            Cooperativa
          </span>
        </Link>

        {/* Usuario logueado y logout */}
        <ul className="navbar-nav ms-auto align-items-center flex-row gap-2">
          {user ? (
            <>
              <li
                className="nav-item"
                ref={refMenu}
                style={{ position: "relative" }}
              >
                {/* Botón de usuario (abre/cierra menú) */}
                <button
                  className="d-flex align-items-center border-0 px-3 py-2"
                  style={{
                    background: verde,
                    color: azul,
                    fontSize: 15.5,
                    minWidth: 120,
                    maxWidth: 180,
                    borderRadius: 20,
                    boxShadow: "0 2px 8px #434d5722",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    cursor: "pointer",
                    outline: menuOpen ? `2px solid #81a631` : "none",
                    transition: "outline 0.15s",
                  }}
                  onClick={() => setMenuOpen((v) => !v)}
                  title={nombreMostrar}
                  type="button"
                >
                  <FaUserCircle className="me-2" style={{ fontSize: 21 }} />
                  <span className="fw-semibold text-truncate">
                    {nombreMostrar}
                  </span>
                  <span
                    style={{
                      marginLeft: 6,
                      fontSize: 13,
                      transform: menuOpen ? "rotate(180deg)" : "none",
                      transition: "transform 0.2s",
                    }}
                  >
                    ▼
                  </span>
                </button>

                {/* Menú desplegable */}
                {menuOpen && (
                  <div
                    style={{
                      position: "absolute",
                      right: 0,
                      top: "110%",
                      minWidth: 170,
                      background: "#fff",
                      border: `1.5px solid ${verde}`,
                      borderRadius: 14,
                      boxShadow: "0 6px 32px 0 #a8cd3a22",
                      zIndex: 10001,
                      animation: "fadein 0.16s",
                    }}
                  >
                    <ul
                      className="list-unstyled mb-1 py-2 px-1"
                      style={{ marginBottom: 0 }}
                    >
                      <li>
                        <Link
                          to="/perfil"
                          className="dropdown-item py-2 px-3 d-flex align-items-center"
                          style={{
                            color: azul,
                            borderRadius: 10,
                            fontWeight: 500,
                          }}
                          onClick={() => setMenuOpen(false)}
                        >
                          <FaUser className="me-2" /> Mi perfil
                        </Link>
                      </li>
                      <li>
                        <Link
                          to="/configuracion"
                          className="dropdown-item py-2 px-3 d-flex align-items-center"
                          style={{
                            color: azul,
                            borderRadius: 10,
                            fontWeight: 500,
                          }}
                          onClick={() => setMenuOpen(false)}
                        >
                          <FaCog className="me-2" /> Configuración
                        </Link>
                      </li>
                      <li>
                        <hr
                          className="my-1"
                          style={{ borderColor: "#e9f5ce" }}
                        />
                      </li>
                      <li>
                        <button
                          className="dropdown-item py-2 px-3 d-flex align-items-center"
                          style={{
                            color: "#f50057",
                            borderRadius: 10,
                            fontWeight: 500,
                            background: "none",
                            border: "none",
                            width: "100%",
                            textAlign: "left",
                          }}
                          onClick={onLogout}
                        >
                          <FaSignOutAlt className="me-2" /> Cerrar sesión
                        </button>
                      </li>
                    </ul>
                  </div>
                )}
              </li>
            </>
          ) : (
            <li className="nav-item">
              <Link className="nav-link text-light" to="/login">
                Iniciar sesión
              </Link>
            </li>
          )}
        </ul>
      </div>
      {/* Animación fade-in para el menú */}
      <style>
        {`
        @keyframes fadein {
          from { opacity: 0; transform: translateY(-10px);}
          to { opacity: 1; transform: none;}
        }
        .dropdown-item:hover, .dropdown-item:focus {
          background: #f5fbe9;
          color: #81a631 !important;
          outline: none;
        }
        `}
      </style>
    </nav>
  );
}
