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
  FaChevronLeft,
  FaChevronRight,
  FaUserCircle,
} from "react-icons/fa";

const verde = "#768C42";
const azul = "#434d57";

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

  const sidebarStyle = {
    width: collapsed && isDesktop ? 68 : 220,
    minWidth: collapsed && isDesktop ? 68 : 220,
    top: 0,
    left: 0,
    bottom: 0,
    zIndex: 1040,
    borderRight: "1px solid #e5e7eb",
    minHeight: "100vh",
    background: "#fff",
    boxShadow: "0 2px 12px 0 #434d5733",
    transition:
      "width 0.23s cubic-bezier(.39,1,.32,1), min-width 0.23s cubic-bezier(.39,1,.32,1)",
  };

  return (
    <>
      {/* Botón menú móvil */}
      <button
        className="btn btn-success position-fixed d-lg-none"
        style={{
          top: 18,
          left: 15,
          zIndex: 3000,
          background: verde,
          border: "none",
          boxShadow: "0 2px 7px #0001",
          borderRadius: 10,
        }}
        onClick={() => setOpen(true)}
        aria-label="Abrir menú"
      >
        <FaBars size={22} />
      </button>

      {/* Botón colapsar en escritorio */}
      {isDesktop && menu.length > 0 && (
        <button
          className="btn btn-light position-fixed d-none d-lg-flex align-items-center justify-content-center"
          style={{
            top: 24,
            left: collapsed ? 72 : 218,
            zIndex: 2001,
            width: 32,
            height: 32,
            border: "1px solid #e5e7eb",
            borderRadius: "50%",
            boxShadow: "0 2px 7px #0001",
            transition: "left 0.23s cubic-bezier(.39,1,.32,1)",
            marginTop: "40px",
          }}
          onClick={() => onCollapseChange && onCollapseChange(!collapsed)}
          aria-label={collapsed ? "Expandir menú" : "Colapsar menú"}
        >
          {collapsed ? (
            <FaChevronRight size={18} />
          ) : (
            <FaChevronLeft size={18} />
          )}
        </button>
      )}

      {/* Sidebar escritorio */}
      <aside
        className={`d-none d-lg-block position-fixed sidebar-main${
          collapsed ? " collapsed" : ""
        }`}
        style={sidebarStyle}
      >
        <div
          className="text-center p-3 border-bottom fw-bold"
          style={{
            color: verde,
            fontSize: 26,
            letterSpacing: ".5px",
            height: 58,
          }}
        >
          <img
            src="/logo-cooperativa.jpg"
            alt="Logo"
            style={{
              maxWidth: 40,
              borderRadius: 8,
              marginRight: collapsed ? 0 : 10,
              verticalAlign: "middle",
              boxShadow: `0 2px 8px ${verde}22`,
              border: `2px solid ${verde}`,
              background: "#fff",
              transition: "margin 0.2s",
            }}
          />
        </div>
        <nav>
          <ul className="nav flex-column pt-2">
            {menu.map(({ to, icon, label }) => (
              <li className="nav-item" key={to}>
                <NavLink
                  to={to}
                  className={({ isActive }) =>
                    "nav-link d-flex align-items-center px-3 py-2 sidebar-link" +
                    (isActive ? " active fw-bold" : " text-dark")
                  }
                  style={{
                    fontSize: "1.09rem",
                    color: azul,
                    borderRadius: 10,
                    transition: "background 0.25s, color 0.2s, box-shadow 0.2s",
                    marginBottom: 3,
                    justifyContent: collapsed ? "center" : "flex-start",
                  }}
                >
                  <span
                    className="me-2 sidebar-icon"
                    style={{
                      fontSize: "1.28em",
                      color: verde,
                      transition: "color 0.2s, transform 0.2s",
                      marginRight: collapsed ? 0 : 12,
                    }}
                  >
                    {icon}
                  </span>
                  {!collapsed && label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <style>{`
          .sidebar-link:hover, .sidebar-link:focus {
            background: #C5C8CC;
            color: #222 !important;
            box-shadow: 0 2px 10px #a8cd3a17;
            transform: translateX(2px) scale(1.03);
          }
          .sidebar-link:hover .sidebar-icon,
          .sidebar-link:focus .sidebar-icon {
            color: #81a631 !important;
            transform: scale(1.15) rotate(-7deg);
          }
          .sidebar-link.active, .sidebar-link.active:focus {
            background: #a8cd3a18 !important;
            color: #a8cd3a !important;
            box-shadow: 0 2px 12px #a8cd3a18;
          }
          .sidebar-link.active .sidebar-icon {
            color: #a8cd3a !important;
            transform: scale(1.18) rotate(-3deg);
          }
          .sidebar-main.collapsed .nav-link {
            padding-left: 0.2rem !important;
            padding-right: 0.2rem !important;
            justify-content: center !important;
          }
          .sidebar-main.collapsed .sidebar-icon {
            margin-right: 0 !important;
          }
        `}</style>
      </aside>

      {/* Sidebar móvil/tablet como Offcanvas */}
      <div
        className={`offcanvas offcanvas-start d-lg-none${open ? " show" : ""}`}
        tabIndex="-1"
        style={{
          visibility: open ? "visible" : "hidden",
          width: 220,
          zIndex: 4000,
          background: "#000",
          borderRight: "1px solid #e5e7eb",
          transition: "all 0.21s cubic-bezier(.4,1,.7,1)",
        }}
        aria-modal="true"
        role="dialog"
      >
        <div className="offcanvas-header border-bottom">
          <h5 className="offcanvas-title" style={{ color: verde }}>
            <img
              src="/logo-cooperativa.jpg"
              alt="Logo"
              style={{
                maxWidth: 32,
                borderRadius: 8,
                marginRight: 7,
                border: `2px solid ${verde}`,
                background: "#fff",
              }}
            />
            Cooperativa
          </h5>
          <button
            type="button"
            className="btn"
            style={{
              color: verde,
              border: "none",
              fontSize: 22,
            }}
            onClick={() => setOpen(false)}
            aria-label="Cerrar"
          >
            <FaTimes />
          </button>
        </div>
        <div className="offcanvas-body px-0">
          <ul className="nav flex-column pt-2">
            {menu.map(({ to, icon, label }) => (
              <li className="nav-item" key={to}>
                <NavLink
                  to={to}
                  className={({ isActive }) =>
                    "nav-link d-flex align-items-center px-3 py-2 sidebar-link" +
                    (isActive ? " active fw-bold" : " text-white")
                  }
                  style={{
                    fontSize: "1.07rem",
                    color: azul,
                    borderRadius: 10,
                    transition: "background 0.2s, color 0.2s, box-shadow 0.2s",
                    marginBottom: 3,
                  }}
                  onClick={() => setOpen(false)}
                >
                  <span
                    className="me-2 sidebar-icon"
                    style={{
                      fontSize: "1.19em",
                      color: "white",
                      transition: "color 0.2s, transform 0.2s",
                    }}
                  >
                    {icon}
                  </span>
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      </div>
      {/* Backdrop para móvil */}
      {open && (
        <div
          className="offcanvas-backdrop fade show d-lg-none"
          style={{ zIndex: 3999 }}
          onClick={() => setOpen(false)}
        ></div>
      )}
    </>
  );
}
