import { useState, useEffect } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  FaTachometerAlt,
  FaUsers,
  FaUserShield,
  FaUniversity,
  FaHandHoldingUsd,
  FaPiggyBank,
  FaMoneyCheckAlt,
  FaExchangeAlt,
  FaClipboardList,
  FaFileAlt,
  FaTasks,
  FaChartPie,
  FaTimes,
  FaBars,
  FaUserCircle,
  FaAngleDoubleLeft,
  FaAngleDoubleRight,
} from "react-icons/fa";
import LogoCoop from "./LogoCoop";

const SIDEBAR_BG = "#1a2035";
const SIDEBAR_BG2 = "#222d45";
const ACCENT = "#a8cd3a";
const TEXT_MUTED = "#8892a4";
const SIDEBAR_WIDTH = 240;
const SIDEBAR_COLLAPSED = 70;

// Menú completo para Administrador
const menuAdmin = [
  { to: "/dashboard", icon: <FaTachometerAlt />, label: "Dashboard" },
  { to: "/usuarios", icon: <FaUsers />, label: "Usuarios" },
  { to: "/roles", icon: <FaUserShield />, label: "Roles" },
  { to: "/cuentas", icon: <FaUniversity />, label: "Cuentas" },
  { to: "/prestamos", icon: <FaHandHoldingUsd />, label: "Préstamos" },
  { to: "/aportaciones", icon: <FaPiggyBank />, label: "Aportaciones" },
  { to: "/pagos", icon: <FaMoneyCheckAlt />, label: "Pagos" },
  { to: "/movimientos", icon: <FaExchangeAlt />, label: "Movimientos" },
  { to: "/reportes", icon: <FaFileAlt />, label: "Reportes" },
  { to: "/actividades", icon: <FaTasks />, label: "Actividades" },
  { to: "/liquidaciones", icon: <FaChartPie />, label: "Liquidaciones" },
  { to: "/bitacora", icon: <FaClipboardList />, label: "Bitácora" },
];

// Menú para Socio
const menuSocio = [
  { to: "/perfil", icon: <FaUserCircle />, label: "Mi Perfil" },
  { to: "/mis-cuentas", icon: <FaUniversity />, label: "Mis Cuentas" },
  { to: "/mis-aportaciones", icon: <FaPiggyBank />, label: "Mis Aportaciones" },
  // Agrega más si el socio tiene otros módulos
];

export default function Sidebar({ collapsed, onCollapseChange }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false); // móvil/tablet offcanvas
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 992);

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 992);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (isDesktop) setOpen(false);
  }, [isDesktop]);

  // Escoge menú según el rol
  let menu = [];
  if (user?.rol === "Administrador") menu = menuAdmin;
  else if (user?.rol === "Socio") menu = menuSocio;

  const w = collapsed && isDesktop ? SIDEBAR_COLLAPSED : SIDEBAR_WIDTH;

  return (
    <>
      <style>{`
        /* ── Sidebar global styles ── */
        .sidebar-main {
          background: linear-gradient(175deg, ${SIDEBAR_BG} 0%, ${SIDEBAR_BG2} 100%);
          border-right: none !important;
          box-shadow: 4px 0 24px 0 rgba(0,0,0,0.35);
        }
        .sidebar-logo-area {
          display: flex;
          align-items: center;
          height: 64px;
          padding: 0 16px;
          border-bottom: 1px solid rgba(255,255,255,0.07);
          overflow: hidden;
          white-space: nowrap;
        }
        .sidebar-logo-img {
          flex-shrink: 0;
          display: block;
        }
        .sidebar-brand-text {
          font-size: 0.95rem;
          font-weight: 700;
          color: #fff;
          letter-spacing: 0.4px;
          margin-left: 10px;
          opacity: 1;
          transition: opacity 0.2s;
          white-space: nowrap;
        }
        .sidebar-section-label {
          font-size: 0.65rem;
          font-weight: 700;
          letter-spacing: 1.4px;
          text-transform: uppercase;
          color: ${TEXT_MUTED};
          padding: 18px 20px 6px;
          overflow: hidden;
          white-space: nowrap;
          transition: opacity 0.2s;
        }
        .sidebar-link {
          position: relative;
          display: flex !important;
          align-items: center;
          margin: 2px 10px;
          padding: 9px 12px !important;
          border-radius: 10px !important;
          color: ${TEXT_MUTED} !important;
          font-size: 0.88rem !important;
          font-weight: 500;
          transition: background 0.2s, color 0.2s, box-shadow 0.2s !important;
          text-decoration: none;
          white-space: nowrap;
          overflow: hidden;
        }
        .sidebar-link:hover {
          background: rgba(255,255,255,0.07) !important;
          color: #fff !important;
        }
        .sidebar-link:hover .sidebar-icon {
          color: ${ACCENT} !important;
          transform: scale(1.15);
        }
        .sidebar-link.active {
          background: linear-gradient(90deg, ${ACCENT}22 0%, ${ACCENT}08 100%) !important;
          color: ${ACCENT} !important;
          box-shadow: inset 3px 0 0 ${ACCENT};
        }
        .sidebar-link.active .sidebar-icon {
          color: ${ACCENT} !important;
        }
        .sidebar-link.active::before {
          content: '';
          position: absolute;
          left: 0;
          top: 20%;
          height: 60%;
          width: 3px;
          background: ${ACCENT};
          border-radius: 0 3px 3px 0;
          box-shadow: 0 0 8px ${ACCENT};
        }
        .sidebar-icon {
          font-size: 1.05em;
          color: ${TEXT_MUTED};
          flex-shrink: 0;
          width: 20px;
          text-align: center;
          transition: color 0.2s, transform 0.2s;
        }
        .sidebar-label {
          margin-left: 12px;
          opacity: 1;
          transition: opacity 0.15s, width 0.15s;
          overflow: hidden;
          white-space: nowrap;
        }
        /* Collapsed */
        .sidebar-main.collapsed .sidebar-link {
          justify-content: center;
          padding: 10px 0 !important;
          margin: 2px 8px;
        }
        .sidebar-main.collapsed .sidebar-label {
          opacity: 0;
          width: 0;
          margin-left: 0;
        }
        .sidebar-main.collapsed .sidebar-section-label {
          opacity: 0;
          pointer-events: none;
        }
        .sidebar-main.collapsed .sidebar-brand-text {
          opacity: 0;
          width: 0;
          margin-left: 0;
        }
        /* Tooltip on collapsed */
        .sidebar-main.collapsed .sidebar-link[title]:hover::after {
          content: attr(title);
          position: absolute;
          left: calc(100% + 14px);
          top: 50%;
          transform: translateY(-50%);
          background: ${SIDEBAR_BG};
          color: #fff;
          padding: 5px 11px;
          border-radius: 7px;
          font-size: 0.82rem;
          white-space: nowrap;
          box-shadow: 0 4px 18px rgba(0,0,0,0.35);
          border: 1px solid rgba(255,255,255,0.1);
          z-index: 9999;
          pointer-events: none;
        }
        /* Toggle button */
        .sidebar-toggle-btn {
          position: fixed;
          top: 82px;
          z-index: 1041;
          width: 26px;
          height: 26px;
          background: ${SIDEBAR_BG2};
          border: 1.5px solid rgba(168,205,58,0.45);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: left 0.25s cubic-bezier(.39,1,.32,1), background 0.2s, box-shadow 0.2s;
          box-shadow: 0 2px 10px rgba(0,0,0,0.4);
        }
        .sidebar-toggle-btn:hover {
          background: ${ACCENT};
          border-color: ${ACCENT};
          box-shadow: 0 0 12px ${ACCENT}88;
        }
        .sidebar-toggle-btn:hover svg {
          color: #1a2035 !important;
        }
        /* Mobile offcanvas sidebar */
        .sidebar-offcanvas {
          background: linear-gradient(175deg, ${SIDEBAR_BG} 0%, ${SIDEBAR_BG2} 100%) !important;
          border-right: none !important;
          box-shadow: 6px 0 32px rgba(0,0,0,0.45);
        }
        .sidebar-offcanvas .sidebar-link {
          color: #8892a4 !important;
        }
        .sidebar-offcanvas .sidebar-link:hover {
          color: #fff !important;
        }
        .sidebar-footer {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          padding: 14px 16px;
          border-top: 1px solid rgba(255,255,255,0.07);
          color: ${TEXT_MUTED};
          font-size: 0.72rem;
          text-align: center;
          overflow: hidden;
          white-space: nowrap;
        }
      `}</style>

      {/* ── Botón toggle escritorio ── */}
      {isDesktop && menu.length > 0 && (
        <button
          className="sidebar-toggle-btn d-none d-lg-flex"
          style={{ left: w - 13, zIndex: 1041 }}
          onClick={() => onCollapseChange && onCollapseChange(!collapsed)}
          aria-label={collapsed ? "Expandir menú" : "Colapsar menú"}
          title={collapsed ? "Expandir" : "Colapsar"}
        >
          {collapsed
            ? <FaAngleDoubleRight size={12} style={{ color: ACCENT }} />
            : <FaAngleDoubleLeft size={12} style={{ color: ACCENT }} />}
        </button>
      )}

      {/* ── Sidebar escritorio ── */}
      <aside
        className={`d-none d-lg-flex flex-column position-fixed sidebar-main${collapsed ? " collapsed" : ""}`}
        style={{
          width: w,
          minWidth: w,
          top: 0,
          left: 0,
          bottom: 0,
          zIndex: 1040,
          minHeight: "100vh",
          transition: "width 0.25s cubic-bezier(.39,1,.32,1), min-width 0.25s cubic-bezier(.39,1,.32,1)",
          overflow: "hidden",
        }}
      >
        {/* Logo */}
        <div className="sidebar-logo-area">
          <LogoCoop size={68} />
          {!collapsed && <span className="sidebar-brand-text">Smart Coop</span>}
        </div>

        {/* Navegación */}
        <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", paddingBottom: 60 }}>
          {!collapsed && <div className="sidebar-section-label">Menú principal</div>}
          <nav>
            <ul className="nav flex-column" style={{ padding: "4px 0" }}>
              {menu.map(({ to, icon, label }) => (
                <li className="nav-item" key={to}>
                  <NavLink
                    to={to}
                    title={collapsed ? label : undefined}
                    className={({ isActive }) =>
                      "sidebar-link" + (isActive ? " active" : "")
                    }
                  >
                    <span className="sidebar-icon">{icon}</span>
                    <span className="sidebar-label">{label}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        {/* Footer */}
        {!collapsed && (
          <div className="sidebar-footer">
            v1.0 &mdash; {new Date().getFullYear()}
          </div>
        )}
      </aside>

      {/* ── Sidebar móvil (offcanvas) ── */}
      <div
        className={`offcanvas offcanvas-start d-lg-none sidebar-offcanvas${open ? " show" : ""}`}
        tabIndex="-1"
        style={{
          visibility: open ? "visible" : "hidden",
          width: SIDEBAR_WIDTH,
          zIndex: 4000,
          transition: "transform 0.25s cubic-bezier(.4,1,.7,1), visibility 0.25s",
        }}
        aria-modal="true"
        role="dialog"
      >
        <div
          className="offcanvas-header"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.07)", height: 64 }}
        >
          <div className="d-flex align-items-center">
            <LogoCoop size={68} />
            <span className="sidebar-brand-text">Smart Coop</span>
          </div>
          <button
            type="button"
            className="btn"
            style={{
              color: TEXT_MUTED,
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 8,
              fontSize: 16,
              padding: "4px 8px",
              lineHeight: 1,
            }}
            onClick={() => setOpen(false)}
            aria-label="Cerrar"
          >
            <FaTimes size={14} />
          </button>
        </div>
        <div className="offcanvas-body px-0" style={{ overflowX: "hidden" }}>
          <div className="sidebar-section-label">Menú principal</div>
          <nav>
            <ul className="nav flex-column" style={{ padding: "4px 0" }}>
              {menu.map(({ to, icon, label }) => (
                <li className="nav-item" key={to}>
                  <NavLink
                    to={to}
                    className={({ isActive }) =>
                      "sidebar-link" + (isActive ? " active" : "")
                    }
                    onClick={() => setOpen(false)}
                  >
                    <span className="sidebar-icon">{icon}</span>
                    <span className="sidebar-label">{label}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>

      {/* Backdrop móvil */}
      {open && (
        <div
          className="offcanvas-backdrop fade show d-lg-none"
          style={{ zIndex: 3999 }}
          onClick={() => setOpen(false)}
        />
      )}

      {/* Botón hamburguesa móvil */}
      <button
        className="d-lg-none position-fixed"
        style={{
          top: 16,
          left: 14,
          zIndex: 3000,
          background: "transparent",
          border: "none",
          color: "#fff",
          padding: 6,
          lineHeight: 1,
        }}
        onClick={() => setOpen(true)}
        aria-label="Abrir menú"
      >
        <FaBars size={22} />
      </button>
    </>
  );
}
