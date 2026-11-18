import { useState, useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { useConfigSitio } from "../hooks/useConfigSitio";
import { FaLayerGroup } from "react-icons/fa";
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
  FaDatabase,
  FaShieldAlt,
  FaConciergeBell,
  FaCashRegister,
  FaSlidersH,
  FaBook,
  FaPhoneAlt,
  FaBalanceScale,
  FaInbox,
  FaUserSecret,
  FaGavel,
  FaBolt,
  FaChartBar,
} from "react-icons/fa";
import LogoCoop from "./LogoCoop";
import { useFunciones } from "../hooks/useFunciones";

const SIDEBAR_BG = "#1a2035";
const SIDEBAR_BG2 = "#222d45";
const ACCENT = "#a8cd3a";
const TEXT_MUTED = "#8892a4";
const SIDEBAR_WIDTH = 240;
const SIDEBAR_COLLAPSED = 70;

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

// Todos los módulos del sistema (lista maestra)
const TODOS_MODULOS = [
  { key: "dashboard",     to: "/dashboard", grupo: "principal",     icon: <FaTachometerAlt />, label: "Dashboard" },
  { key: "ventanilla",    to: "/ventanilla", grupo: "principal",    icon: <FaConciergeBell />,  label: "Ventanilla" },
  { key: "usuarios",      to: "/usuarios", grupo: "administracion",      icon: <FaUsers />,          label: "Usuarios" },
  { key: "roles",         to: "/roles", grupo: "administracion",         icon: <FaUserShield />,     label: "Roles" },
  { key: "cuentas",       to: "/cuentas", grupo: "ahorro",       icon: <FaUniversity />,     label: "Cuentas" },
  { key: "cuentas",       to: "/ahorro", grupo: "ahorro",        icon: <FaPiggyBank />,      label: "Ahorro y plazo fijo" },
  { key: "prestamos",     to: "/prestamos", grupo: "creditos",     icon: <FaHandHoldingUsd />, label: "Préstamos" },
  { key: "aportaciones",  to: "/aportaciones", grupo: "ahorro",  icon: <FaPiggyBank />,      label: "Aportaciones" },
  { key: "prestamos",     to: "/solicitudes", grupo: "creditos",    icon: <FaInbox />,          label: "Solicitudes" },
  { key: "prestamos",     to: "/creditos-grupales", grupo: "creditos", icon: <FaUsers />,       label: "Créditos grupales", funcion: "creditos_grupales" },
  { key: "prestamos",     to: "/comite-credito", grupo: "creditos", icon: <FaGavel />,         label: "Comité de crédito" },
  { key: "contabilidad",  to: "/contabilidad", grupo: "contabilidad",  icon: <FaBalanceScale />,   label: "Contabilidad" },
  { key: "contabilidad",  to: "/libros-contables", grupo: "contabilidad", icon: <FaBook />,      label: "Libros contables" },
  { key: "cumplimiento",  to: "/cumplimiento", grupo: "administracion",  icon: <FaUserSecret />,     label: "Cumplimiento", reservado: true },
  { key: "cobranza",      to: "/cobranza", grupo: "creditos",      icon: <FaPhoneAlt />,       label: "Cobranza" },
  { key: "caja",          to: "/caja", grupo: "caja",          icon: <FaCashRegister />,   label: "Caja" },
  { key: "pagos",         to: "/pagos-ampliados", grupo: "caja", icon: <FaBolt />,        label: "Pago rápido", funcion: "pagos_ampliados" },
  { key: "pagos",         to: "/pagos", grupo: "caja",         icon: <FaMoneyCheckAlt />,  label: "Pagos" },
  { key: "movimientos",   to: "/movimientos", grupo: "caja",   icon: <FaExchangeAlt />,    label: "Movimientos" },
  { key: "reportes",      to: "/reportes-cartera", grupo: "contabilidad", icon: <FaChartBar />,   label: "Reportes de cartera", funcion: "reportes_ampliados" },
  { key: "reportes",      to: "/reportes", grupo: "contabilidad",      icon: <FaFileAlt />,        label: "Reportes" },
  { key: "actividades",   to: "/actividades", grupo: "contabilidad",   icon: <FaTasks />,          label: "Actividades" },
  { key: "liquidaciones", to: "/liquidaciones", grupo: "caja", icon: <FaChartPie />,       label: "Liquidaciones" },
  { key: "bitacora",      to: "/bitacora", grupo: "administracion",      icon: <FaClipboardList />,  label: "Bitácora" },
  { key: "basedatos",     to: "/basedatos", grupo: "administracion",     icon: <FaDatabase />,       label: "Base de Datos" },
];

// Grupos del menú del personal, en el orden en que se muestran
const GRUPOS = [
  { id: "principal", label: "Principal" },
  { id: "creditos", label: "Créditos" },
  { id: "ahorro", label: "Ahorro y aportaciones" },
  { id: "caja", label: "Caja y pagos" },
  { id: "contabilidad", label: "Contabilidad y reportes" },
  { id: "administracion", label: "Administración" },
  { id: "configuracion", label: "Configuración" },
];

// Menú completo para Super Administrador (todos los módulos + control de accesos)
const menuSuperAdmin = [
  ...TODOS_MODULOS,
  { to: "/parametros-financieros", grupo: "configuracion", icon: <FaSlidersH />, label: "Parámetros" },
  { to: "/productos-credito", grupo: "configuracion", icon: <FaLayerGroup />, label: "Productos de crédito" },
  { to: "/politicas", grupo: "configuracion", icon: <FaBook />, label: "Políticas" },
  { to: "/superadmin", grupo: "configuracion", icon: <FaShieldAlt />, label: "Control de Accesos" },
];

// Menú para Socio
const menuSocio = [
  { to: "/perfil", icon: <FaUserCircle />, label: "Mi Perfil" },
  { to: "/mis-cuentas", icon: <FaUniversity />, label: "Mis Cuentas" },
  { to: "/mis-aportaciones", icon: <FaPiggyBank />, label: "Mis Aportaciones" },
];

export default function Sidebar({ collapsed, onCollapseChange }) {
  const { user, token } = useAuth();
  const funciones = useFunciones();
  const { config } = useConfigSitio();
  const siteName = config.site_name || "SmartCoop";
  const [open, setOpen] = useState(false); // móvil/tablet offcanvas
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 992);
  const [permisosRol, setPermisosRol] = useState(null); // null = cargando
  const [solicitudesPendientes, setSolicitudesPendientes] = useState(0);
  const { pathname } = useLocation();

  // Contador de solicitudes por revisar (personal)
  useEffect(() => {
    if (!user || user.rol === "Socio" || !token) return;
    let activo = true;
    const cargar = () =>
      axios
        .get(`${API_URL}/solicitudes/resumen`, { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => activo && setSolicitudesPendientes(r.data.total || 0))
        .catch(() => {});
    cargar();
    const id = setInterval(cargar, 60000);
    return () => {
      activo = false;
      clearInterval(id);
    };
  }, [user, token, pathname]); // también al cambiar de pantalla: se ve al instante lo ya atendido

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 992);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (isDesktop) setOpen(false);
  }, [isDesktop]);

  // Con el menú abierto en el celular, la página de atrás no se desplaza. En iPhone, el
  // desplazamiento de fondo (y la barra del navegador que aparece y desaparece) dejaba parte
  // de la pantalla sin pintar (en negro).
  useEffect(() => {
    if (!open) return;
    const html = document.documentElement;
    const antes = { html: html.style.overflow, body: document.body.style.overflow };
    html.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      html.style.overflow = antes.html;
      document.body.style.overflow = antes.body;
    };
  }, [open]);

  // Cargar permisos del rol actual desde la API
  useEffect(() => {
    if (!user?.rol_id || user?.rol === "Super Administrador" || user?.rol === "Socio") {
      setPermisosRol(null);
      return;
    }
    axios
      .get(`${API_URL}/permisos/${user.rol_id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => setPermisosRol(res.data.data || {}))
      .catch(() => setPermisosRol({}));
  }, [user?.rol_id, user?.rol, token]);

  // Escoge menú según el rol
  let menu = [];
  if (user?.rol === "Super Administrador") {
    menu = menuSuperAdmin;
  } else if (user?.rol === "Socio") {
    menu = menuSocio;
  } else if (user?.rol) {
    // Para cualquier otro rol (Administrador, Contador, etc.) aplicar permisos
    if (permisosRol === null) {
      // Aún cargando: mostrar todos (luego se filtrará)
      menu = TODOS_MODULOS.filter((m) => !m.reservado);
    } else {
      // Los módulos reservados (cumplimiento) se ven solo si el rol los tiene activados
      // expresamente; el Administrador los ve salvo que se le quiten
      const reservadoVisible = (m) =>
        permisosRol[m.key] === true || (user.rol === "Administrador" && permisosRol[m.key] !== false);
      menu = TODOS_MODULOS.filter((m) => (m.reservado ? reservadoVisible(m) : permisosRol[m.key] !== false));
    }
  }
  // Funciones nuevas: solo aparecen si el Super Administrador las encendió (él las ve siempre)
  menu = menu.filter((m) => !m.funcion || funciones[m.funcion]);

  const w = collapsed && isDesktop ? SIDEBAR_COLLAPSED : SIDEBAR_WIDTH;

  // Secciones: el socio ve una sola lista; el personal, sus módulos agrupados
  const secciones =
    user?.rol === "Socio"
      ? [{ id: "socio", label: "Menú principal", items: menu }]
      : GRUPOS.map((g) => ({ ...g, items: menu.filter((m) => m.grupo === g.id) })).filter((g) => g.items.length);

  const listaMenu = (movil = false) => {
    const plegado = collapsed && !movil;
    return secciones.map((sec, i) => (
      <div key={sec.id}>
        {plegado ? (
          i > 0 && <div className="sidebar-divider" />
        ) : (
          <div className="sidebar-section-label">{sec.label}</div>
        )}
        <nav aria-label={sec.label}>
          <ul className="nav flex-column" style={{ padding: "2px 0" }}>
            {sec.items.map(({ to, icon, label }) => (
              <li className="nav-item" key={to}>
                <NavLink
                  to={to}
                  title={plegado ? label : undefined}
                  className={({ isActive }) => "sidebar-link" + (isActive ? " active" : "")}
                  onClick={movil ? () => setOpen(false) : undefined}
                >
                  <span className="sidebar-icon">{icon}</span>
                  <span className="sidebar-label">{label}</span>
                  {to === "/solicitudes" && solicitudesPendientes > 0 && (
                    <span
                      className="badge rounded-pill ms-auto"
                      style={{ background: "#e74c3c", color: "#fff", fontSize: ".7rem" }}
                    >
                      {solicitudesPendientes}
                    </span>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    ));
  };

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
        .sidebar-divider { height: 1px; margin: 10px 16px; background: rgba(255,255,255,0.09); }
        /* Títulos de grupo: verdes, más pequeños y con una línea, para que no se confundan con las opciones */
        .sidebar-section-label {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.66rem;
          font-weight: 800;
          letter-spacing: 1.6px;
          text-transform: uppercase;
          color: ${ACCENT};
          padding: 16px 18px 6px;
          overflow: hidden;
          white-space: nowrap;
          transition: opacity 0.2s;
        }
        .sidebar-section-label::after {
          content: "";
          flex: 1;
          height: 1px;
          background: linear-gradient(90deg, rgba(168,205,58,0.45), rgba(168,205,58,0));
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
          box-shadow: 6px 0 24px rgba(0,0,0,0.35);
          /* Alto de la pantalla visible (en iPhone 100vh no la sigue) y capa propia */
          top: 0 !important;
          bottom: 0 !important;
          height: 100vh;
          height: 100dvh;
          will-change: transform;
          -webkit-backface-visibility: hidden;
          backface-visibility: hidden;
        }
        .sidebar-offcanvas .offcanvas-body {
          overscroll-behavior: contain;
          -webkit-overflow-scrolling: touch;
          padding-bottom: calc(24px + env(safe-area-inset-bottom));
        }
        .sidebar-offcanvas:not(.show) {
          -webkit-transform: translateX(-100%);
          transform: translateX(-100%);
        }
        .sidebar-backdrop-movil {
          position: fixed;
          inset: 0;
          height: 100vh;
          height: 100dvh;
          -webkit-transform: translateZ(0);
        }
        .sidebar-offcanvas .sidebar-link {
          color: #8892a4 !important;
        }
        .sidebar-offcanvas .sidebar-link:hover {
          color: #fff !important;
        }
        /* Pie fijo al final del menú (ya no flota encima de las últimas opciones) */
        .sidebar-footer {
          flex-shrink: 0;
          padding: 10px 16px;
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
          {!collapsed && <span className="sidebar-brand-text">{siteName}</span>}
        </div>

        {/* Navegación */}
        <div className="sidebar-scroll" style={{ flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden", paddingBottom: 12 }}>
          {listaMenu()}
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
            <span className="sidebar-brand-text">{siteName}</span>
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
          {listaMenu(true)}
        </div>
      </div>

      {/* Backdrop móvil */}
      {open && (
        <div
          className="offcanvas-backdrop fade show d-lg-none sidebar-backdrop-movil"
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
