import { useRef, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  FaBars,
  FaCog,
  FaSignOutAlt,
  FaUser,
  FaChevronDown,
} from "react-icons/fa";
import LogoCoop from "./LogoCoop";

const ACCENT = "#a8cd3a";
const NAVBAR_BG = "#1a2035";
const NAVBAR_BG2 = "#222d45";

function getInitials(name) {
  if (!name) return "U";
  const parts = name.trim().split(" ");
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name[0].toUpperCase();
}

export default function Navbar({ user, onLogout, onMenuClick }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const refMenu = useRef();

  const nombreMostrar =
    user?.nombre_completo || user?.nombre || user?.username || "Usuario";
  const rolMostrar = user?.rol || "";
  const initials = getInitials(nombreMostrar);

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
    <>
      <style>{`
        .navbar-main {
          background: linear-gradient(90deg, ${NAVBAR_BG} 0%, ${NAVBAR_BG2} 100%);
          box-shadow: 0 2px 20px rgba(0,0,0,0.35);
          border-bottom: 1px solid rgba(255,255,255,0.06);
        }
        .navbar-brand-custom {
          display: flex;
          align-items: center;
          text-decoration: none;
          gap: 10px;
        }
        .navbar-brand-logo {
          display: block;
        }
        .navbar-brand-text {
          font-size: 1rem;
          font-weight: 700;
          color: #fff;
          letter-spacing: 0.3px;
        }
        .navbar-brand-text span {
          color: ${ACCENT};
        }
        .user-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          background: rgba(255,255,255,0.07);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 40px;
          padding: 5px 14px 5px 6px;
          cursor: pointer;
          transition: background 0.2s, border-color 0.2s, box-shadow 0.2s;
          color: #fff;
          max-width: 210px;
        }
        .user-btn:hover {
          background: rgba(255,255,255,0.12);
          border-color: ${ACCENT}88;
          box-shadow: 0 0 12px ${ACCENT}33;
        }
        .user-btn.open {
          background: rgba(168,205,58,0.12);
          border-color: ${ACCENT};
          box-shadow: 0 0 14px ${ACCENT}44;
        }
        .user-avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: linear-gradient(135deg, ${ACCENT} 0%, #7fa020 100%);
          color: #1a2035;
          font-weight: 800;
          font-size: 0.78rem;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          letter-spacing: 0.5px;
          box-shadow: 0 0 8px ${ACCENT}55;
        }
        .user-info {
          display: flex;
          flex-direction: column;
          overflow: hidden;
          text-align: left;
        }
        .user-name {
          font-size: 0.82rem;
          font-weight: 600;
          color: #fff;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 110px;
          line-height: 1.2;
        }
        .user-role {
          font-size: 0.68rem;
          color: ${ACCENT};
          font-weight: 500;
          white-space: nowrap;
          line-height: 1.2;
        }
        .user-chevron {
          color: rgba(255,255,255,0.5);
          font-size: 11px;
          transition: transform 0.22s;
          flex-shrink: 0;
          margin-left: 2px;
        }
        .user-chevron.open {
          transform: rotate(180deg);
          color: ${ACCENT};
        }
        .user-dropdown {
          position: absolute;
          right: 0;
          top: calc(100% + 10px);
          min-width: 200px;
          background: ${NAVBAR_BG2};
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 14px;
          box-shadow: 0 12px 48px rgba(0,0,0,0.5);
          z-index: 10001;
          overflow: hidden;
          animation: dropIn 0.18s cubic-bezier(.34,1.56,.64,1);
        }
        @keyframes dropIn {
          from { opacity: 0; transform: translateY(-10px) scale(0.97); }
          to   { opacity: 1; transform: none; }
        }
        .dropdown-header {
          padding: 14px 16px 10px;
          border-bottom: 1px solid rgba(255,255,255,0.07);
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .dropdown-header-avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: linear-gradient(135deg, ${ACCENT} 0%, #7fa020 100%);
          color: #1a2035;
          font-weight: 800;
          font-size: 0.9rem;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          box-shadow: 0 0 10px ${ACCENT}55;
        }
        .dropdown-header-name {
          font-size: 0.84rem;
          font-weight: 600;
          color: #fff;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 120px;
        }
        .dropdown-header-role {
          font-size: 0.7rem;
          color: ${ACCENT};
          font-weight: 500;
        }
        .dd-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 9px 16px;
          font-size: 0.84rem;
          font-weight: 500;
          color: rgba(255,255,255,0.75);
          text-decoration: none;
          background: none;
          border: none;
          width: 100%;
          text-align: left;
          cursor: pointer;
          transition: background 0.15s, color 0.15s;
        }
        .dd-item:hover {
          background: rgba(255,255,255,0.07);
          color: #fff;
        }
        .dd-item .dd-icon {
          font-size: 0.85rem;
          opacity: 0.65;
          transition: opacity 0.15s;
        }
        .dd-item:hover .dd-icon { opacity: 1; }
        .dd-separator {
          margin: 4px 0;
          border: none;
          border-top: 1px solid rgba(255,255,255,0.07);
        }
        .dd-item-danger { color: #ff6b6b !important; }
        .dd-item-danger:hover {
          background: rgba(255,107,107,0.1) !important;
          color: #ff8c8c !important;
        }
        .mobile-ham-btn {
          background: rgba(255,255,255,0.07);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 8px;
          color: #fff;
          padding: 7px 10px;
          display: flex;
          align-items: center;
          cursor: pointer;
          transition: background 0.2s;
        }
        .mobile-ham-btn:hover {
          background: rgba(255,255,255,0.13);
          border-color: ${ACCENT}88;
        }
      `}</style>

      <nav
        className="navbar-main fixed-top"
        style={{ minHeight: 62, zIndex: 1100, padding: 0 }}
      >
        <div
          className="container-fluid d-flex align-items-center px-3"
          style={{ height: 62 }}
        >
          {/* Hamburguesa móvil */}
          {user && (
            <button
              className="mobile-ham-btn d-lg-none me-3"
              onClick={onMenuClick}
              aria-label="Abrir menú"
            >
              <FaBars size={18} />
            </button>
          )}

          {/* Logo + Marca */}
          <Link
            to={user ? "/dashboard" : "/"}
            className="navbar-brand-custom me-auto"
          >
            <LogoCoop size={68} />
            <span className="navbar-brand-text d-none d-sm-inline">
              <span>Smart Coop</span>
            </span>
          </Link>

          {/* Acciones derecha */}
          <div className="d-flex align-items-center gap-3">
            {user ? (
              <div ref={refMenu} style={{ position: "relative" }}>
                <button
                  className={`user-btn${menuOpen ? " open" : ""}`}
                  onClick={() => setMenuOpen((v) => !v)}
                  type="button"
                  title={nombreMostrar}
                >
                  <div className="user-avatar">{initials}</div>
                  <div className="user-info d-none d-sm-flex">
                    <span className="user-name">{nombreMostrar}</span>
                    {rolMostrar && (
                      <span className="user-role">{rolMostrar}</span>
                    )}
                  </div>
                  <FaChevronDown
                    className={`user-chevron${menuOpen ? " open" : ""}`}
                  />
                </button>

                {menuOpen && (
                  <div className="user-dropdown">
                    <div className="dropdown-header">
                      <div className="dropdown-header-avatar">{initials}</div>
                      <div style={{ overflow: "hidden" }}>
                        <div className="dropdown-header-name">{nombreMostrar}</div>
                        {rolMostrar && (
                          <div className="dropdown-header-role">{rolMostrar}</div>
                        )}
                      </div>
                    </div>
                    <div style={{ padding: "6px 0" }}>
                      <Link
                        to="/perfil"
                        className="dd-item"
                        onClick={() => setMenuOpen(false)}
                      >
                        <FaUser className="dd-icon" />
                        Mi perfil
                      </Link>
                      <Link
                        to="/configuracion"
                        className="dd-item"
                        onClick={() => setMenuOpen(false)}
                      >
                        <FaCog className="dd-icon" />
                        Configuración
                      </Link>
                    </div>
                    <hr className="dd-separator" />
                    <div style={{ padding: "4px 0 6px" }}>
                      <button className="dd-item dd-item-danger" onClick={onLogout}>
                        <FaSignOutAlt className="dd-icon" />
                        Cerrar sesión
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <Link
                to="/login"
                style={{
                  color: ACCENT,
                  fontWeight: 600,
                  textDecoration: "none",
                  fontSize: "0.9rem",
                }}
              >
                Iniciar sesión
              </Link>
            )}
          </div>
        </div>
      </nav>
    </>
  );
}
