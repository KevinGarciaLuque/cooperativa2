import { useAuth } from "../../context/AuthContext";
import { useConfigSitio } from "../../hooks/useConfigSitio";
import SolicitudPrestamoSocio from "../../components/SolicitudPrestamoSocio";
import ReciboModal from "../../components/ReciboModal";
import { descargarCarta } from "../../utils/cartaAprobacion";
import FotosIdentidad from "../../components/FotosIdentidad";
import ReportarPagoSocio from "../../components/ReportarPagoSocio";
import NotificacionesSocio from "../../components/NotificacionesSocio";
import RecibosSocio from "../../components/RecibosSocio";
import FirmaDigital from "../../components/FirmaDigital";
import PoliticasSocio, { AceptarPoliticas } from "../../components/PoliticasSocio";
import { comprimirImagen } from "../../utils/imagen";
import { useEffect, useMemo, useState } from "react";
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
  FaHandHoldingUsd,
  FaClipboardList,
  FaShieldAlt,
  FaIdCard,
  FaEnvelope,
  FaPercent,
  FaChartLine,
  FaRegClock,
  FaChevronDown,
  FaChevronUp,
  FaHistory,
  FaCreditCard,
  FaCamera,
  FaUpload,
  FaReceipt,
  FaBook,
} from "react-icons/fa";

const VERDE = "#a8cd3a";
const AZUL = "#2c3e50";
const AZUL_CLARO = "#3d5166";
const GRIS_FONDO = "#f0f4f8";

/* ——— Utilidades ——— */
const fmtTasa = (t) => {
  const n = parseFloat(t);
  return isNaN(n) ? "—" : `${parseFloat(n.toFixed(2))}% mensual`;
};

const fecha = (v) => (v ? String(v).substring(0, 10) : "-");

const fmt = (n) => parseFloat(n || 0).toLocaleString("es-HN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const estadoBadge = (estado) => {
  const map = {
    aprobado:  { bg: "#d1fae5", color: "#065f46", label: "Aprobado" },
    pendiente: { bg: "#fef3c7", color: "#92400e", label: "Pendiente" },
    pagado:    { bg: "#dbeafe", color: "#1e40af", label: "Pagado" },
    rechazado: { bg: "#fee2e2", color: "#991b1b", label: "Rechazado" },
    activo:    { bg: "#d1fae5", color: "#065f46", label: "Activo" },
  };
  const s = map[(estado || "").toLowerCase()] || { bg: "#e5e7eb", color: "#374151", label: estado };
  return (
    <span
      className="badge rounded-pill px-3 py-1"
      style={{ background: s.bg, color: s.color, fontWeight: 600, fontSize: "0.78rem", letterSpacing: ".3px" }}
    >
      {s.label}
    </span>
  );
};

export default function SocioPerfil() {
  const { user, token, logout, updateUser } = useAuth();
  const { config: configSitio } = useConfigSitio();
  const [cuentas, setCuentas]           = useState([]);
  const [aportaciones, setAportaciones] = useState([]);
  const [prestamos, setPrestamos]       = useState([]);
  const [ultimoPagoFecha, setUltimoPagoFecha] = useState(null); // último pago a préstamos
  const [moras, setMoras] = useState({}); // id_prestamo -> { dias, mora, porDia }
  const [entregas, setEntregas] = useState({}); // id_prestamo -> { id_recibo, firmado }
  const [reciboEntrega, setReciboEntrega] = useState(null);
  const [reciboVer, setReciboVer] = useState(null);
  const [politicasVersion, setPoliticasVersion] = useState(0); // recarga la pestaña al aceptar // recibo abierto desde la campanita o "Mis recibos"
  const [loading, setLoading]           = useState(true);
  const pendiente = user?.estado === "pendiente";
  const [tab, setTab]                   = useState(pendiente ? "solicitar" : "resumen");
  const [identidad, setIdentidad]       = useState(null); // { frente, reverso } de las fotos del DNI
  const headersAuth = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const faltaIdentidad = identidad && (!identidad.frente || !identidad.reverso);
  const [finiquitoDe, setFiniquitoDe]   = useState(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [password, setPassword]         = useState("");
  const [msg, setMsg]                   = useState("");
  const [msgTipo, setMsgTipo]           = useState("success");
  const [pagosExpandidos, setPagosExpandidos] = useState({});
  const [pagosData, setPagosData]       = useState({});
  const [pagosLoading, setPagosLoading] = useState({});
  const [showFotoModal, setShowFotoModal] = useState(false);
  const [fotoSubiendo, setFotoSubiendo]   = useState(false);
  const [fotoError, setFotoError]         = useState("");

  // La tarjeta de la última operación del socio va arriba: un pago a préstamo
  // sube "Mis Préstamos"; una aportación sube "Mis Cuentas".
  const ultimaAportacionFecha = aportaciones
    .map((a) => (a.fecha || "").substring(0, 10))
    .filter(Boolean)
    .sort()
    .pop() || null;
  const prestamosPrimero =
    !!ultimoPagoFecha && (!ultimaAportacionFecha || ultimoPagoFecha > ultimaAportacionFecha);

  const totalMora = Object.values(moras).reduce((s, m) => s + m.mora, 0);

  const AvisoMora = ({ mora }) =>
    mora ? (
      <div
        className="rounded-3 p-2 px-3 mt-2 d-flex align-items-start gap-2"
        style={{ background: "#fee2e2", border: "1px solid #fecaca", color: "#991b1b" }}
      >
        <FaExclamationTriangle className="mt-1" />
        <div className="small">
          <strong>{mora.dias} día{mora.dias !== 1 ? "s" : ""} de mora</strong> · Mora generada:{" "}
          <strong>L. {fmt(mora.mora)}</strong>
          {mora.porDia > 0 && <> (aprox. L. {fmt(mora.porDia)} por día)</>}
          <div style={{ color: "#b45309" }}>Se cobra junto con tu próximo pago.</div>
        </div>
      </div>
    ) : null;

  const handleFotoChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setFotoSubiendo(true);
    setFotoError("");
    try {
      const formData = new FormData();
      formData.append("foto", await comprimirImagen(file, 900));
      const res = await axios.put(
        `${API_URL}/usuarios/${user.id_usuario}/foto`,
        formData,
        { headers: { "Content-Type": "multipart/form-data", Authorization: `Bearer ${token}` } }
      );
      updateUser({ foto: res.data.foto });
    } catch (err) {
      setFotoError(err.response?.data?.message || "Error al subir la foto.");
    } finally {
      setFotoSubiendo(false);
      e.target.value = "";
    }
  };

  const togglePagos = async (idPrestamo) => {
    const yaAbierto = pagosExpandidos[idPrestamo];
    setPagosExpandidos(prev => ({ ...prev, [idPrestamo]: !yaAbierto }));
    if (!yaAbierto && !pagosData[idPrestamo]) {
      setPagosLoading(prev => ({ ...prev, [idPrestamo]: true }));
      try {
        const res = await axios.get(`${API_URL}/pagos?id_prestamo=${idPrestamo}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setPagosData(prev => ({ ...prev, [idPrestamo]: res.data.data || res.data || [] }));
      } catch {
        setPagosData(prev => ({ ...prev, [idPrestamo]: [] }));
      } finally {
        setPagosLoading(prev => ({ ...prev, [idPrestamo]: false }));
      }
    }
  };

  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (pendiente) {
          // Aún no tiene cuentas: solo se verifica si ya fue aprobado
          const u = await axios.get(`${API_URL}/usuarios/${user.id_usuario}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const datos = u.data.usuario || u.data;
          if (datos?.estado && datos.estado !== "pendiente") {
            updateUser({ estado: datos.estado });
            window.location.reload();
          }
          return;
        }
        const [cuentasRes, aportacionesRes, prestamosRes, usuarioRes, pagosRes] = await Promise.all([
          axios.get(`${API_URL}/cuentas?id_usuario=${user.id_usuario}`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          axios.get(`${API_URL}/aportaciones?id_usuario=${user.id_usuario}`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          axios.get(`${API_URL}/prestamos?id_usuario=${user.id_usuario}`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          axios.get(`${API_URL}/usuarios/${user.id_usuario}`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          // El historial de pagos define qué tarjeta del resumen va primero
          axios
            .get(`${API_URL}/pagos?id_usuario=${user.id_usuario}`, {
              headers: { Authorization: `Bearer ${token}` },
            })
            .catch(() => ({ data: [] })),
        ]);
        setCuentas(cuentasRes.data.data || []);
        setAportaciones(aportacionesRes.data.data || aportacionesRes.data || []);
        const listaPrestamos = prestamosRes.data.data || prestamosRes.data || [];
        setPrestamos(listaPrestamos);

        // Días de mora y mora generada de cada préstamo vigente
        const vigentes = listaPrestamos.filter((p) =>
          ["activo", "mora"].includes((p.estado || "").toLowerCase())
        );
        const moraMap = {};
        await Promise.all(
          vigentes.map(async (p) => {
            try {
              const r = await axios.get(`${API_URL}/pagos/prestamo/${p.id_prestamo}/proximo-pago`, {
                headers: { Authorization: `Bearer ${token}` },
              });
              const pp = r.data.proximo_pago;
              if (pp && pp.dias_mora > 0) {
                moraMap[p.id_prestamo] = {
                  dias: pp.dias_mora,
                  mora: parseFloat(pp.interes_moratorio || 0),
                  porDia: parseFloat(pp.mora_por_dia || 0),
                };
              }
            } catch {
              // sin datos de mora para este préstamo
            }
          })
        );
        setMoras(moraMap);

        // Comprobantes de entrega (desembolso) y si ya están firmados
        try {
          const rec = await axios.get(`${API_URL}/recibos/socio/${user.id_usuario}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const mapa = {};
          (rec.data.data || [])
            .filter((r) => r.tipo === "desembolso" && !r.anulado)
            .forEach((r) => {
              mapa[r.referencia_id] = { id_recibo: r.id_recibo, firmado: !!(r.comprobante_firmado || r.firma_digital) };
            });
          setEntregas(mapa);
        } catch {
          setEntregas({});
        }

        const listaPagos = pagosRes.data.data || pagosRes.data || [];
        const fechas = listaPagos
          .map((pg) => (pg.fecha_pago || "").substring(0, 10))
          .filter(Boolean)
          .sort();
        setUltimoPagoFecha(fechas.length ? fechas[fechas.length - 1] : null);
        // Sincronizar foto y datos del usuario desde la base de datos
        const userActualizado = usuarioRes.data.usuario || usuarioRes.data;
        if (userActualizado?.foto !== user.foto) {
          updateUser({ foto: userActualizado.foto });
        }
      } catch {
        setMsg("No se pudieron cargar los datos.");
        setMsgTipo("error");
      }
      setLoading(false);
    };
    if (user?.id_usuario) fetchData();
  }, [user.id_usuario, token, API_URL]);

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

  /* ——— Resumen calculos ——— */
  const totalAportaciones = aportaciones.reduce((s, a) => s + parseFloat(a.monto || 0), 0);
  const totalSaldo        = cuentas.reduce((s, c) => s + parseFloat(c.saldo_actual || 0), 0);
  const prestamosActivos  = prestamos.filter((p) => ["activo", "mora"].includes((p.estado || "").toLowerCase())).length;
  const prestamosAprobados = prestamos.filter((p) => (p.estado || "").toLowerCase() === "aprobado");

  /* ——— Tabs config ——— */
  const tabs = pendiente
    ? [
        { key: "solicitar", label: "Solicitar préstamo", icon: <FaHandHoldingUsd /> },
        { key: "identidad", label: "Mi identidad",       icon: <FaIdCard /> },
        { key: "politicas", label: "Políticas",          icon: <FaBook /> },
        { key: "seguridad", label: "Seguridad",          icon: <FaShieldAlt /> },
      ]
    : [
        { key: "resumen",      label: "Resumen",            icon: <FaChartLine /> },
        { key: "prestamos",    label: "Préstamos",           icon: <FaHandHoldingUsd /> },
        { key: "pagar",        label: "Reportar pago",       icon: <FaCreditCard /> },
        { key: "recibos",      label: "Mis recibos",         icon: <FaReceipt /> },
        { key: "solicitar",    label: "Solicitar préstamo",  icon: <FaClipboardList /> },
        { key: "aportaciones", label: "Aportaciones",        icon: <FaPiggyBank /> },
        { key: "identidad",    label: "Mi identidad",        icon: <FaIdCard /> },
        { key: "politicas",    label: "Políticas",           icon: <FaBook /> },
        { key: "seguridad",    label: "Seguridad",           icon: <FaShieldAlt /> },
      ];

  return (
    <>
      {/* CSS personalizado */}
      <style>{`
        .sp-hero { background: linear-gradient(135deg, ${AZUL} 0%, ${AZUL_CLARO} 60%, #4a6580 100%); }
        .sp-tab-btn { background: none; border: none; padding: .55rem 1.2rem; border-radius: 2rem; font-weight: 500;
          color: #6b7280; transition: all .2s; display:flex; align-items:center; gap:.45rem; font-size:.92rem; }
        .sp-tab-btn:hover { background: #e5f0d6; color: ${AZUL}; }
        .sp-tab-btn.active { background: ${VERDE}; color: #1a2a00; font-weight: 700; box-shadow: 0 2px 8px #a8cd3a55; }
        /* Móvil: pestañas con desplazamiento horizontal y tarjetas más compactas */
        @media (max-width: 575.98px) {
          .sp-tabs { flex-wrap: nowrap !important; overflow-x: auto; width: 100%; -webkit-overflow-scrolling: touch; }
          .sp-tab-btn { padding: .5rem .9rem; font-size: .88rem; white-space: nowrap; flex: 0 0 auto; }
          .sp-table thead th, .sp-table tbody td { padding: .55rem .6rem; font-size: .8rem; }
        }
        .sp-stat { border-radius: 1.2rem; padding: 1.25rem 1.5rem; border: none; transition: transform .18s, box-shadow .18s; }
        .sp-stat:hover { transform: translateY(-3px); box-shadow: 0 8px 24px #00000018; }
        .sp-table thead { background: linear-gradient(90deg, ${AZUL} 0%, ${AZUL_CLARO} 100%); color:#fff; }
        .sp-table thead th { font-weight: 600; border: none; padding: .75rem 1rem; font-size: .87rem; letter-spacing: .3px; }
        .sp-table tbody tr { transition: background .15s; }
        .sp-table tbody tr:hover { background: #f0f7e6; }
        .sp-table tbody td { vertical-align: middle; padding: .7rem 1rem; font-size: .9rem; border-color: #e8edf3; }
        .sp-empty { text-align:center; padding: 2.5rem 1rem; color:#9ca3af; }
        .sp-empty svg { font-size:2.8rem; margin-bottom:.6rem; opacity:.4; }
        .sp-progress-bar { height: 7px; border-radius: 4px; background: #e5e7eb; overflow: hidden; }
        .sp-progress-fill { height: 100%; border-radius: 4px; background: linear-gradient(90deg, ${VERDE}, #7db200); transition: width .6s; }
        .sp-collapsible { overflow: hidden; max-height: 0; opacity: 0; transform: translateY(-6px); transition: max-height .35s ease, opacity .3s ease, transform .3s ease; }
        .sp-collapsible.open { max-height: 3000px; opacity: 1; transform: translateY(0); }
        .sp-foto-btn { cursor: pointer; transition: transform .2s, box-shadow .2s; }
        .sp-foto-btn:hover { transform: scale(1.07); box-shadow: 0 6px 24px #a8cd3a88 !important; }
        .sp-foto-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.75); z-index:9999;
          display:flex; align-items:center; justify-content:center;
          animation: fadeInOverlay .2s ease; }
        @keyframes fadeInOverlay { from { opacity:0; } to { opacity:1; } }
        .sp-foto-modal-content { position:relative; animation: scaleIn .22s ease; }
        @keyframes scaleIn { from { transform:scale(.85); opacity:0; } to { transform:scale(1); opacity:1; } }
        .sp-foto-close { position:absolute; top:-14px; right:-14px; background:#fff;
          border:none; border-radius:50%; width:32px; height:32px; font-size:1.1rem;
          display:flex; align-items:center; justify-content:center;
          cursor:pointer; box-shadow:0 2px 8px #0005; color:#333; }
        .sp-foto-actions { display:flex; gap:.6rem; justify-content:center; flex-wrap:wrap; margin-top:.9rem; }
        .sp-foto-action-btn { display:inline-flex; align-items:center; gap:.4rem;
          padding:.45rem 1.1rem; border-radius:2rem; border:none; font-size:.85rem;
          font-weight:600; cursor:pointer; transition:opacity .15s, transform .15s; }
        .sp-foto-action-btn:hover:not(:disabled) { opacity:.88; transform:scale(1.04); }
        .sp-foto-action-btn:disabled { opacity:.55; cursor:not-allowed; }
      `}</style>

      <div style={{ background: GRIS_FONDO, minHeight: "100vh", fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>
        <div className="container py-4" style={{ maxWidth: 1080 }}>

          {/* ===== HERO ===== */}
          <div className="sp-hero rounded-4 shadow-lg mb-4 p-4 p-md-5 text-white">
            <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
              <div className="d-flex align-items-center gap-4">
                <div
                  className="sp-foto-btn"
                  onClick={() => setShowFotoModal(true)}
                  title="Ver foto"
                  style={{
                    width: 80, height: 80, borderRadius: "50%",
                    background: user.foto ? "transparent" : "linear-gradient(135deg,#a8cd3a,#7db200)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "2.2rem", fontWeight: 700, color: "#1a2a00", flexShrink: 0,
                    boxShadow: "0 4px 16px #a8cd3a55",
                    overflow: "hidden",
                    border: user.foto ? "3px solid #a8cd3a" : "none",
                  }}>
                  {user.foto ? (
                    <img
                      src={`${API_URL.replace("/api", "")}${user.foto}`}
                      alt={user.nombre_completo}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      onError={(e) => { e.currentTarget.style.display = "none"; }}
                    />
                  ) : (
                    (user.nombre_completo || "S").charAt(0).toUpperCase()
                  )}
                </div>
                <div>
                  <h2 className="mb-1 fw-bold" style={{ fontSize: "1.6rem", letterSpacing: ".4px" }}>
                    {user.nombre_completo}
                  </h2>
                  <div className="d-flex flex-wrap gap-2 align-items-center">
                    <span className="d-flex align-items-center gap-1" style={{ fontSize: ".88rem", opacity: .85 }}>
                      <FaIdCard size={13} /> DNI: {user.dni}
                    </span>
                    <span style={{ opacity: .4 }}>•</span>
                    <span className="d-flex align-items-center gap-1" style={{ fontSize: ".88rem", opacity: .85 }}>
                      <FaEnvelope size={13} /> {user.correo}
                    </span>
                  </div>
                  <span className="badge mt-2 px-3 py-1 rounded-pill"
                    style={{ background: VERDE, color: "#1a2a00", fontWeight: 700, fontSize: ".8rem" }}>
                    <FaUserEdit className="me-1" /> Socio Activo
                  </span>
                </div>
              </div>
              <div className="d-flex align-items-center gap-2">
                <NotificacionesSocio headers={headersAuth} onVerRecibo={setReciboVer} />
                <button
                  className="btn d-flex align-items-center gap-2 fw-semibold"
                  style={{ background: "rgba(255,255,255,0.1)", border: "1.5px solid rgba(255,255,255,0.35)",
                    color: "#fff", borderRadius: "2rem", padding: ".5rem 1.4rem", backdropFilter: "blur(4px)" }}
                  onClick={logout}
                >
                  <FaSignOutAlt /> Cerrar sesión
                </button>
              </div>
            </div>

            {/* Estadísticas rápidas */}
            <div className="row g-3 mt-3">
              {[
                { label: "Saldo Total",          value: `L. ${fmt(totalSaldo)}`,          icon: <FaMoneyBillWave />, color: "#a8cd3a" },
                { label: "Total Aportaciones",   value: `L. ${fmt(totalAportaciones)}`,   icon: <FaPiggyBank />,     color: "#60a5fa" },
                { label: "Préstamos Activos",    value: prestamosActivos,                  icon: <FaHandHoldingUsd />,color: "#f59e0b" },
                { label: "Total Préstamos",      value: prestamos.filter((p) => p.estado !== "rechazado").length,                  icon: <FaClipboardList />, color: "#c084fc" },
              ].map((s) => (
                <div className="col-6 col-md-3" key={s.label}>
                  <div style={{
                    background: "rgba(255,255,255,0.1)", borderRadius: "1rem",
                    padding: "1rem 1.2rem", backdropFilter: "blur(6px)",
                    border: "1px solid rgba(255,255,255,0.15)"
                  }}>
                    <div className="d-flex align-items-center gap-2 mb-1" style={{ color: s.color, fontSize: "1.1rem" }}>
                      {s.icon}
                      <span style={{ fontSize: ".77rem", color: "rgba(255,255,255,.7)", fontWeight: 500 }}>{s.label}</span>
                    </div>
                    <div className="fw-bold" style={{ fontSize: "1.25rem" }}>{s.value}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ===== TABS ===== */}
          <div className="sp-tabs d-flex gap-2 flex-wrap mb-4 p-1"
            style={{ background: "#fff", borderRadius: "2rem", display: "inline-flex", boxShadow: "0 2px 8px #0000000d" }}>
            {tabs.map((t) => (
              <button
                key={t.key}
                className={`sp-tab-btn ${tab === t.key ? "active" : ""}`}
                onClick={() => setTab(t.key)}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>

          {/* ===== MENSAJES ===== */}
          {msg && (
            <div className={`alert d-flex align-items-center gap-2 rounded-3 mb-3 border-0 shadow-sm
              ${msgTipo === "success" ? "alert-success" : "alert-danger"}`}>
              {msgTipo === "success"
                ? <FaCheckCircle className="text-success" />
                : <FaExclamationTriangle className="text-danger" />}
              {msg}
            </div>
          )}

          {/* ===== CONTENIDO TABS ===== */}

          {pendiente && (
            <div className="alert alert-warning d-flex gap-2 align-items-start rounded-4 border-0 shadow-sm">
              <FaExclamationTriangle className="mt-1" />
              <div>
                <strong>Tu cuenta está pendiente de aprobación.</strong>
                <div className="small">
                  La cooperativa revisará tus datos y tu solicitud de préstamo, y te avisará por correo.
                </div>
              </div>
            </div>
          )}

          {/* Felicitación: préstamo aprobado, pendiente de entrega */}
          {!pendiente && prestamosAprobados.map((p) => (
            <div
              key={p.id_prestamo}
              className="d-flex gap-3 align-items-center rounded-4 shadow-sm p-3 mb-3"
              style={{ background: "linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)", border: "1px solid #a7f3d0" }}
            >
              <div style={{ fontSize: 36, lineHeight: 1 }}>🎉</div>
              <div className="flex-grow-1">
                <div className="fw-bold" style={{ color: "#065f46", fontSize: "1.1rem" }}>
                  ¡Felicidades! Tu préstamo ha sido aprobado
                </div>
                <div className="small" style={{ color: "#047857" }}>
                  Tu solicitud de <strong>L. {fmt(p.monto)}</strong> a {p.plazo_meses} meses fue aprobada. La
                  cooperativa se comunicará contigo para entregarte el desembolso.
                </div>
                <button
                  className="btn btn-sm btn-success mt-2"
                  onClick={() =>
                    descargarCarta(p.id_prestamo, token).catch(() => {
                      setMsg("No se pudo descargar la carta de aprobación.");
                      setMsgTipo("error");
                    })
                  }
                >
                  Descargar carta de aprobación (PDF)
                </button>
              </div>
            </div>
          ))}

          {/* Aviso: faltan las fotos de la identidad */}
          {faltaIdentidad && tab !== "identidad" && (
            <div className="alert alert-warning d-flex flex-wrap gap-2 align-items-center justify-content-between rounded-4 border-0 shadow-sm">
              <div>
                <strong>Falta la foto de tu identidad.</strong>
                <div className="small">Sube el frente y el reverso de tu tarjeta de identidad para completar tu expediente.</div>
              </div>
              <button className="btn btn-sm btn-dark" onClick={() => setTab("identidad")}>
                Subir mi identidad
              </button>
            </div>
          )}

          {/* TAB: MI IDENTIDAD (siempre montado para saber si faltan fotos) */}
          <div className={tab === "identidad" ? "card border-0 shadow-sm rounded-4" : "d-none"}>
            <div className="card-body p-4">
              <h5 className="fw-bold mb-1">Mi identidad</h5>
              <p className="text-muted small mb-4">
                Fotos del frente y del reverso de tu tarjeta de identidad. Solo las ve la cooperativa.
                {!pendiente && " Una vez revisadas, para cambiarlas comunícate con la cooperativa."}
              </p>
              {user?.id_usuario && (
                <FotosIdentidad
                  idSocio={user.id_usuario}
                  headers={headersAuth}
                  soloFaltantes={!pendiente}
                  onCambio={setIdentidad}
                />
              )}
            </div>
          </div>

          {/* TAB: REPORTAR PAGO */}
          {tab === "pagar" && <ReportarPagoSocio token={token} />}

          {tab === "politicas" && <PoliticasSocio headers={headersAuth} version={politicasVersion} />}

          {tab === "recibos" && user?.id_usuario && (
            <RecibosSocio idSocio={user.id_usuario} headers={headersAuth} onVer={setReciboVer} recargar={reciboVer} />
          )}

          {/* TAB: SOLICITAR PRÉSTAMO */}
          {tab === "solicitar" && (
            <SolicitudPrestamoSocio token={token} />
          )}

          {/* TAB: RESUMEN */}
          {tab === "resumen" && (
            <div className="row g-4">
              {totalMora > 0 && (
                <div className="col-12" style={{ order: -1 }}>
                  <div
                    className="rounded-4 p-3 d-flex align-items-center gap-3"
                    style={{ background: "#fee2e2", border: "1px solid #fecaca", color: "#991b1b" }}
                  >
                    <FaExclamationTriangle size={22} />
                    <div>
                      <div className="fw-bold">Tienes cuotas atrasadas</div>
                      <div className="small">
                        Mora generada hasta hoy: <strong>L. {fmt(totalMora)}</strong>. Mientras más días pasen, mayor será el cargo.
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {/* Cuentas */}
              <div className="col-md-6" style={{ order: 1 }}>
                <div className="card border-0 shadow-sm rounded-4 h-100">
                  <div className="card-body p-4">
                    <div className="d-flex align-items-center gap-2 mb-3">
                      <div style={{ background: "#d1fae5", borderRadius: ".75rem", padding: ".6rem", color: "#065f46" }}>
                        <FaMoneyBillWave size={20} />
                      </div>
                      <h6 className="mb-0 fw-bold" style={{ fontSize: "1.05rem", color: AZUL }}>Mis Cuentas</h6>
                    </div>
                    {loading ? (
                      <div className="text-center py-3"><div className="spinner-border spinner-border-sm text-success" /></div>
                    ) : cuentas.length === 0 ? (
                      <div className="sp-empty"><FaMoneyBillWave /><p className="mb-0 mt-1">Sin cuentas asociadas</p></div>
                    ) : (
                      cuentas.map((c) => (
                        <div key={c.id_cuenta}
                          className="d-flex justify-content-between align-items-center py-3 px-3 rounded-3 mb-2"
                          style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                          <div>
                            <div className="fw-semibold" style={{ color: AZUL }}>{c.tipo_cuenta}</div>
                            <div className="small text-muted">Cuenta #{c.id_cuenta}</div>
                          </div>
                          <div className="text-end">
                            <div className="fw-bold" style={{ color: "#065f46", fontSize: "1.1rem" }}>
                              L. {fmt(c.saldo_actual)}
                            </div>
                            <div className="small text-muted">Saldo disponible</div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Últimas Aportaciones */}
              <div className="col-md-6" style={{ order: 1 }}>
                <div className="card border-0 shadow-sm rounded-4 h-100">
                  <div className="card-body p-4">
                    <div className="d-flex align-items-center justify-content-between mb-3">
                      <div className="d-flex align-items-center gap-2">
                        <div style={{ background: "#fef3c7", borderRadius: ".75rem", padding: ".6rem", color: "#92400e" }}>
                          <FaPiggyBank size={20} />
                        </div>
                        <h6 className="mb-0 fw-bold" style={{ fontSize: "1.05rem", color: AZUL }}>Últimas Aportaciones</h6>
                      </div>
                      {aportaciones.length > 5 && (
                        <button className="btn btn-link btn-sm p-0 text-decoration-none"
                          style={{ color: VERDE, fontWeight: 600 }}
                          onClick={() => setTab("aportaciones")}>
                          Ver todas →
                        </button>
                      )}
                    </div>
                    {loading ? (
                      <div className="text-center py-3"><div className="spinner-border spinner-border-sm text-warning" /></div>
                    ) : aportaciones.length === 0 ? (
                      <div className="sp-empty"><FaPiggyBank /><p className="mb-0 mt-1">Sin aportaciones registradas</p></div>
                    ) : (
                      aportaciones.slice(0, 5).map((a) => (
                        <div key={a.id_aportacion}
                          className="d-flex justify-content-between align-items-center py-2 px-3 rounded-3 mb-2"
                          style={{ background: "#fffbeb", border: "1px solid #fde68a" }}>
                          <div className="d-flex align-items-center gap-2">
                            <FaCalendarAlt size={13} style={{ color: "#d97706" }} />
                            <span className="small text-muted">{a.fecha ? a.fecha.substring(0, 10) : "-"}</span>
                          </div>
                          <span className="fw-bold" style={{ color: "#065f46" }}>L. {fmt(a.monto)}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Mis Préstamos (sube al inicio si el último movimiento fue un pago) */}
              <div className="col-12" style={{ order: prestamosPrimero ? 0 : 2 }}>
                <div className="card border-0 shadow-sm rounded-4">
                  <div className="card-body p-4">
                    <div className="d-flex align-items-center justify-content-between mb-3">
                      <div className="d-flex align-items-center gap-2">
                        <div style={{ background: "#dbeafe", borderRadius: ".75rem", padding: ".6rem", color: "#1e40af" }}>
                          <FaHandHoldingUsd size={20} />
                        </div>
                        <h6 className="mb-0 fw-bold" style={{ fontSize: "1.05rem", color: AZUL }}>Mis Préstamos</h6>
                      </div>
                      {prestamos.length > 0 && (
                        <button className="btn btn-link btn-sm p-0 text-decoration-none"
                          style={{ color: VERDE, fontWeight: 600 }}
                          onClick={() => setTab("prestamos")}>
                          Ver detalle e historial →
                        </button>
                      )}
                    </div>
                    {loading ? (
                      <div className="text-center py-3"><div className="spinner-border spinner-border-sm text-primary" /></div>
                    ) : prestamos.length === 0 ? (
                      <div className="sp-empty"><FaHandHoldingUsd /><p className="mb-0 mt-1">Sin préstamos registrados</p></div>
                    ) : (
                      <div className="row g-3">
                        {prestamos.map((p) => {
                          const monto = parseFloat(p.monto || 0);
                          const saldo = parseFloat(p.saldo_restante || 0);
                          const liquidado = (p.estado || "").toLowerCase() === "pagado" || saldo <= 0.01;
                          const progreso = liquidado ? 100 : monto > 0 ? Math.min(100, Math.max(0, ((monto - saldo) / monto) * 100)) : 0;
                          const cuota = parseFloat(p.cuota_minima ?? p.cuota_mensual ?? 0);
                          return (
                            <div className="col-md-6" key={p.id_prestamo}>
                              <div className="rounded-3 p-3 h-100" style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                                <div className="d-flex justify-content-between align-items-start mb-2">
                                  <div>
                                    <div className="fw-bold" style={{ color: AZUL, fontSize: "1.1rem" }}>L. {fmt(monto)}</div>
                                    <div className="small text-muted">
                                      {p.estado === "aprobado"
                                        ? `Aprobado: ${fecha(p.fecha_aprobacion)}`
                                        : `Otorgado: ${fecha(p.fecha_otorgado)}`}
                                    </div>
                                  </div>
                                  {estadoBadge(p.estado)}
                                </div>
                                <div className="row g-2 mb-2 text-center">
                                  <div className="col-4">
                                    <div className="small text-muted">Tasa</div>
                                    <div className="fw-bold" style={{ color: "#2980b9" }}>{fmtTasa(p.tasa_mensual)}</div>
                                  </div>
                                  <div className="col-4">
                                    <div className="small text-muted">Cuota mensual</div>
                                    <div className="fw-bold" style={{ color: "#065f46" }}>L. {fmt(cuota)}</div>
                                  </div>
                                  <div className="col-4">
                                    <div className="small text-muted">Saldo restante</div>
                                    <div className="fw-bold" style={{ color: liquidado ? "#065f46" : "#92400e" }}>
                                      {liquidado ? "Liquidado" : `L. ${fmt(saldo)}`}
                                    </div>
                                  </div>
                                </div>
                                <div className="sp-progress-bar" style={{ height: 8 }}>
                                  <div className="sp-progress-fill" style={{ width: `${progreso}%` }} />
                                </div>
                                <div className="small text-muted mt-1 text-end">{progreso.toFixed(0)}% pagado</div>
                                <AvisoMora mora={moras[p.id_prestamo]} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: PRÉSTAMOS */}
          {tab === "prestamos" && (
            <div className="d-flex flex-column gap-3">
              <div className="d-flex align-items-center gap-2 mb-1">
                <div style={{ background: "#fef3c7", borderRadius: ".75rem", padding: ".6rem", color: "#92400e" }}>
                  <FaHandHoldingUsd size={20} />
                </div>
                <div>
                  <h5 className="mb-0 fw-bold" style={{ color: AZUL }}>Mis Préstamos</h5>
                  <span className="text-muted small">{prestamos.length} registro(s) encontrado(s)</span>
                </div>
              </div>

              {loading ? (
                <div className="text-center py-5"><div className="spinner-border text-warning" /></div>
              ) : prestamos.length === 0 ? (
                <div className="sp-empty py-5 card border-0 shadow-sm rounded-4">
                  <FaHandHoldingUsd size={40} style={{ opacity: .3 }} />
                  <p className="mt-2 mb-0 text-muted">No tienes préstamos registrados.</p>
                </div>
              ) : prestamos.map((p, i) => {
                const totalPagado  = parseFloat(p.total_pagado || 0);
                const monto        = parseFloat(p.monto || 0);
                const saldo        = parseFloat(p.saldo_restante || 0);
                // Progreso correcto: capital amortizado, no total pagado (que incluye intereses)
                const capitalAmortizado = Math.max(0, monto - saldo);
                const progreso     = monto > 0 ? Math.min(100, (capitalAmortizado / monto) * 100) : 0;
                // La cuota viene calculada del servidor; el socio no recibe tasas ni intereses
                const cuotaCalcSocio = parseFloat(p.cuota_minima ?? p.cuota_mensual ?? 0);
                const abierto      = pagosExpandidos[p.id_prestamo];
                const pagos        = pagosData[p.id_prestamo] || [];
                const loadingPagos = pagosLoading[p.id_prestamo];

                const estaPagado = (p.estado || "").toLowerCase() === "pagado" || saldo <= 0.01;
                // Forzar progreso al 100% si el préstamo está pagado,
                // independientemente del saldo_restante que haya en BD
                const progresoFinal = estaPagado ? 100 : progreso;

                return (
                  <div key={p.id_prestamo} className="card border-0 shadow-sm rounded-4" style={{ overflow: "hidden" }}>
                    {/* Banner liquidado */}
                    {estaPagado && (
                      <div style={{
                        background: "linear-gradient(90deg, #065f46, #059669)",
                        color: "#fff", padding: "8px 20px",
                        display: "flex", alignItems: "center", gap: 8,
                        fontSize: ".88rem", fontWeight: 700, letterSpacing: ".3px",
                      }}>
                        <FaCheckCircle size={14} /> ¡Préstamo completamente liquidado!
                      </div>
                    )}
                    {/* Cabecera del préstamo */}
                    <div className="card-body p-4">
                      {/* Fila superior: número + estado */}
                      <div className="d-flex justify-content-between align-items-start mb-3">
                        <div className="d-flex align-items-center gap-2">
                          <div style={{
                            background: estaPagado
                              ? "linear-gradient(135deg, #065f46, #059669)"
                              : "linear-gradient(135deg, #2c3e50, #3d5166)",
                            color: "#fff", borderRadius: ".7rem",
                            width: 38, height: 38,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontWeight: 700, fontSize: ".9rem",
                          }}>#{i + 1}</div>
                          <div>
                            <div className="fw-bold" style={{ color: AZUL, fontSize: "1.15rem" }}>
                              L. {fmt(p.monto)}
                            </div>
                            <div className="small text-muted">
                              {p.estado === "aprobado"
                                ? `Aprobado: ${fecha(p.fecha_aprobacion)}`
                                : `Otorgado: ${fecha(p.fecha_otorgado)}`}
                            </div>
                          </div>
                        </div>
                        {estadoBadge(p.estado)}
                      </div>

                      {/* Grid de detalles */}
                      <div className="row g-2 mb-3">
                        <div className="col-6 col-md">
                          <div className="rounded-3 p-2 text-center" style={{ background: "#f0f4f8" }}>
                            <div className="small text-muted mb-1">Monto otorgado</div>
                            <div className="fw-bold" style={{ color: "#2980b9", fontSize: ".95rem" }}>L. {fmt(monto)}</div>
                          </div>
                        </div>
                        <div className="col-6 col-md">
                          <div className="rounded-3 p-2 text-center" style={{ background: "#f0f4f8" }}>
                            <div className="small text-muted mb-1">Tasa</div>
                            <div className="fw-bold" style={{ color: "#2980b9", fontSize: ".95rem" }}>{fmtTasa(p.tasa_mensual)}</div>
                          </div>
                        </div>
                        <div className="col-6 col-md">
                          <div className="rounded-3 p-2 text-center" style={{ background: "#f0f4f8" }}>
                            <div className="small text-muted mb-1">Plazo</div>
                            <div className="fw-bold" style={{ color: AZUL, fontSize: ".95rem" }}>{p.plazo_meses} meses</div>
                          </div>
                        </div>
                        <div className="col-6 col-md">
                          <div className="rounded-3 p-2 text-center" style={{ background: "#f0f4f8" }}>
                            <div className="small text-muted mb-1">Cuota mensual</div>
                            <div className="fw-bold" style={{ color: "#065f46", fontSize: ".95rem" }}>L. {fmt(cuotaCalcSocio)}</div>
                          </div>
                        </div>
                        <div className="col-6 col-md">
                          <div className="rounded-3 p-2 text-center" style={{ background: estaPagado ? "#d1fae5" : "#f0f4f8" }}>
                            <div className="small text-muted mb-1">Saldo restante</div>
                            {estaPagado ? (
                              <div className="fw-bold d-flex align-items-center justify-content-center gap-1"
                                style={{ color: "#065f46", fontSize: ".95rem" }}>
                                <FaCheckCircle size={13} /> Liquidado
                              </div>
                            ) : (
                              <div className="fw-bold" style={{ color: "#92400e", fontSize: ".95rem" }}>L. {fmt(saldo)}</div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Barra de progreso */}
                      <div className="mb-3">
                        <div className="d-flex justify-content-between small text-muted mb-1">
                          <span>Amortizado: <strong style={{ color: "#065f46" }}>L. {fmt(capitalAmortizado)}</strong></span>
                          <span><strong style={{ color: estaPagado ? "#065f46" : "inherit" }}>{progresoFinal.toFixed(1)}%</strong></span>
                        </div>
                        <div className="sp-progress-bar" style={{ height: 10 }}>
                          <div className="sp-progress-fill" style={{ width: `${progresoFinal}%`, background: estaPagado ? "linear-gradient(90deg, #059669, #065f46)" : undefined }} />
                        </div>
                        <div className="d-flex justify-content-between small text-muted mt-1">
                          <span>Total pagado: <strong>L. {fmt(totalPagado)}</strong></span>
                          {estaPagado
                            ? <span className="fw-semibold" style={{ color: "#065f46" }}><FaCheckCircle className="me-1" size={11} />Pagado en su totalidad</span>
                            : <span>Principal: L. {fmt(monto)}</span>
                          }
                        </div>
                      </div>

                      <AvisoMora mora={moras[p.id_prestamo]} />
                      <div className="mb-2" />

                      {/* Botón historial */}
                      <button
                        className="btn btn-sm fw-semibold d-flex align-items-center gap-2"
                        style={{
                          background: abierto ? AZUL : "#f0f4f8",
                          color: abierto ? "#fff" : AZUL,
                          border: `1.5px solid ${abierto ? AZUL : "#e2e8f0"}`,
                          borderRadius: ".6rem", padding: "6px 16px",
                          transition: "all .2s",
                        }}
                        onClick={() => togglePagos(p.id_prestamo)}
                      >
                        <FaHistory size={13} />
                        Historial de Pagos
                        {abierto ? <FaChevronUp size={11} /> : <FaChevronDown size={11} />}
                        {p.total_pagos > 0 && (
                          <span className="badge rounded-pill" style={{ background: VERDE, color: "#1a2a00", fontSize: ".7rem" }}>
                            {p.total_pagos}
                          </span>
                        )}
                      </button>
                      {entregas[p.id_prestamo] && (
                        <button
                          className="btn btn-sm fw-semibold ms-2"
                          style={{
                            background: entregas[p.id_prestamo].firmado ? "#ecfdf5" : "#fef3c7",
                            color: entregas[p.id_prestamo].firmado ? "#065f46" : "#92400e",
                            border: `1.5px solid ${entregas[p.id_prestamo].firmado ? "#a7f3d0" : "#fde68a"}`,
                            borderRadius: ".6rem",
                            padding: "6px 16px",
                          }}
                          onClick={() => setReciboEntrega(entregas[p.id_prestamo].id_recibo)}
                        >
                          {entregas[p.id_prestamo].firmado
                            ? "Comprobante de entrega firmado ✓"
                            : "Comprobante de entrega: firmar"}
                        </button>
                      )}
                      {estaPagado && (
                        <button
                          className="btn btn-sm fw-semibold ms-2"
                          style={{ background: "#059669", color: "#fff", borderRadius: ".6rem", padding: "6px 16px" }}
                          onClick={() => setFiniquitoDe(p.id_prestamo)}
                        >
                          <FaCheckCircle className="me-1" size={12} />
                          Constancia de finiquito
                        </button>
                      )}
                    </div>

                    {/* Panel de pagos expandible */}
                    <div className={`sp-collapsible${abierto ? " open" : ""}`} style={{ background: "#f8fafc", borderTop: abierto ? "1px solid #e2e8f0" : "none" }}>
                        {loadingPagos ? (
                          <div className="text-center py-4">
                            <div className="spinner-border spinner-border-sm text-success" />
                          </div>
                        ) : pagos.length === 0 ? (
                          <div className="text-center py-4" style={{ color: "#9ca3af" }}>
                            <FaCreditCard size={28} style={{ opacity: .3 }} />
                            <p className="small mt-2 mb-0">Aún no se han registrado pagos para este préstamo.</p>
                          </div>
                        ) : (
                          <div className="p-3">
                            <div className="small fw-semibold mb-2" style={{ color: "#64748b" }}>
                              <FaHistory className="me-1" /> {pagos.length} pago{pagos.length !== 1 ? "s" : ""} registrado{pagos.length !== 1 ? "s" : ""}
                            </div>
                            {/* Timeline de pagos */}
                            <div style={{ position: "relative" }}>
                              {/* Línea vertical */}
                              <div style={{
                                position: "absolute", left: 15, top: 8, bottom: 8,
                                width: 2, background: "#e2e8f0", zIndex: 0,
                              }} />
                              {pagos.map((pago, idx) => (
                                <div key={pago.id_pago} className="d-flex gap-3 mb-2" style={{ position: "relative", zIndex: 1 }}>
                                  {/* Punto del timeline */}
                                  <div style={{
                                    width: 32, height: 32, borderRadius: "50%",
                                    background: "linear-gradient(135deg, #27ae60, #1e8449)",
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    color: "#fff", fontWeight: 700, fontSize: ".75rem",
                                    flexShrink: 0, boxShadow: "0 2px 6px #27ae6040",
                                  }}>{idx + 1}</div>
                                  {/* Info del pago */}
                                  <div className="flex-grow-1 rounded-3 p-2 px-3" style={{ background: "#fff", border: "1px solid #e8edf3" }}>
                                    <div className="d-flex flex-wrap justify-content-between align-items-center gap-1">
                                      <div>
                                        <div className="fw-semibold" style={{ color: AZUL, fontSize: ".9rem" }}>
                                          L. {fmt(pago.monto_pagado)}
                                        </div>
                                        <div className="small text-muted">
                                          {pago.fecha_pago ? pago.fecha_pago.substring(0, 10) : "-"}
                                          {pago.metodo_pago && <span className="ms-2 badge bg-light text-dark">{pago.metodo_pago}</span>}
                                        </div>
                                      </div>
                                      <div className="text-end">
                                        <div className="small" style={{ color: "#6b7280" }}>
                                          Saldo: <strong>L. {fmt(pago.saldo_restante)}</strong>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                            {/* Resumen total */}
                            <div className="rounded-3 p-2 px-3 mt-2 d-flex justify-content-between align-items-center"
                              style={{ background: "linear-gradient(90deg,#e8f5e9,#f0faf4)", border: "1px solid #a5d6a7" }}>
                              <span className="small fw-semibold" style={{ color: "#2e7d32" }}>Total pagado</span>
                              <span className="fw-bold" style={{ color: "#2e7d32" }}>L. {fmt(totalPagado)}</span>
                            </div>
                          </div>
                        )}
                      </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* TAB: APORTACIONES */}
          {tab === "aportaciones" && (
            <div className="card border-0 shadow-sm rounded-4">
              <div className="card-body p-0 p-md-2">
                <div className="d-flex align-items-center justify-content-between p-4 pb-2">
                  <div className="d-flex align-items-center gap-2">
                    <div style={{ background: "#fef3c7", borderRadius: ".75rem", padding: ".6rem", color: "#92400e" }}>
                      <FaPiggyBank size={20} />
                    </div>
                    <div>
                      <h5 className="mb-0 fw-bold" style={{ color: AZUL }}>Mis Aportaciones</h5>
                      <span className="text-muted small">{aportaciones.length} aportación(es) •
                        <span className="fw-semibold" style={{ color: "#065f46" }}> Total: L. {fmt(totalAportaciones)}</span>
                      </span>
                    </div>
                  </div>
                </div>
                {loading ? (
                  <div className="text-center py-5"><div className="spinner-border text-warning" /></div>
                ) : aportaciones.length === 0 ? (
                  <div className="sp-empty py-5">
                    <FaPiggyBank size={40} style={{ opacity: .3 }} />
                    <p className="mt-2 mb-0 text-muted">No tienes aportaciones registradas.</p>
                  </div>
                ) : (
                  <div className="table-responsive px-2 pb-3">
                    <table className="table sp-table mb-0 rounded-3 overflow-hidden">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th><FaMoneyBillWave className="me-1" />Monto</th>
                          <th><FaCalendarAlt className="me-1" />Fecha</th>
                          <th>Descripción / Tipo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {aportaciones.map((a, i) => (
                          <tr key={a.id_aportacion}>
                            <td className="text-muted fw-semibold">#{i + 1}</td>
                            <td className="fw-bold" style={{ color: "#065f46", fontSize: "1rem" }}>
                              L. {fmt(a.monto)}
                            </td>
                            <td className="text-muted small">
                              <FaCalendarAlt className="me-1" style={{ color: "#d97706" }} />
                              {a.fecha ? a.fecha.substring(0, 10) : "-"}
                            </td>
                            <td>
                              {a.descripcion || a.tipo_aportacion
                                ? <span className="badge bg-light text-dark px-3 py-1">{a.descripcion || a.tipo_aportacion}</span>
                                : <span className="text-muted small">—</span>
                              }
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr style={{ background: "#f8fafc" }}>
                          <td colSpan={2} className="fw-bold text-end" style={{ color: AZUL }}>
                            Total General:
                          </td>
                          <td colSpan={2} className="fw-bold" style={{ color: "#065f46", fontSize: "1.05rem" }}>
                            L. {fmt(totalAportaciones)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB: SEGURIDAD */}
          {tab === "seguridad" && (
            <div className="card border-0 shadow-sm rounded-4">
              <div className="card-body p-4 p-md-5">
                <div className="d-flex align-items-center gap-2 mb-4">
                  <div style={{ background: "#ede9fe", borderRadius: ".75rem", padding: ".6rem", color: "#6d28d9" }}>
                    <FaShieldAlt size={20} />
                  </div>
                  <h5 className="mb-0 fw-bold" style={{ color: AZUL }}>Seguridad de la Cuenta</h5>
                </div>
                <div className="row justify-content-center">
                  <div className="col-md-6">
                    <div className="card border-0 rounded-4 p-4 text-center"
                      style={{ background: "linear-gradient(135deg,#f0f4ff,#e8f0fe)", border: "1px solid #c7d2fe !important" }}>
                      <div className="mb-3" style={{ color: "#6d28d9", fontSize: "2.5rem" }}>
                        <FaLock />
                      </div>
                      <h6 className="fw-bold mb-1" style={{ color: AZUL }}>Cambiar Contraseña</h6>
                      <p className="text-muted small mb-3">
                        Actualiza tu contraseña periódicamente para mantener tu cuenta protegida.
                      </p>
                      <button
                        className="btn fw-semibold px-4 py-2 rounded-3"
                        style={{ background: AZUL, color: "#fff", border: "none" }}
                        onClick={() => setShowPasswordModal(true)}
                      >
                        <FaLock className="me-2" />
                        Actualizar contraseña
                      </button>
                    </div>
                  </div>
                </div>

                <div className="mt-4 p-4 rounded-4" style={{ border: "1px solid #e2e8f0" }}>
                  <FirmaDigital
                    token={token}
                    descripcion="Con tu firma puedes firmar desde la app tus recibos y el comprobante de entrega de tus préstamos, sin imprimirlos."
                    mensajeGuardada="Firma guardada. Ya puedes firmar tus recibos desde la app."
                    confirmarEliminar="¿Eliminar tu firma? Los documentos que ya firmaste la conservan; para firmar otros tendrás que dibujarla de nuevo."
                  />
                </div>
              </div>
            </div>
          )}

          {finiquitoDe && (
            <ReciboModal finiquitoDe={finiquitoDe} onClose={() => setFiniquitoDe(null)} />
          )}
          <AceptarPoliticas
            headers={headersAuth}
            onLogout={logout}
            onAceptadas={() => setPoliticasVersion((v) => v + 1)}
          />
          {reciboVer && <ReciboModal idRecibo={reciboVer} onClose={() => setReciboVer(null)} />}
          {reciboEntrega && (
            <ReciboModal
              idRecibo={reciboEntrega}
              onClose={() => {
                setReciboEntrega(null);
                window.location.reload();
              }}
            />
          )}

          {/* Footer */}
          <div className="text-center mt-4 text-muted small" style={{ opacity: .6 }}>
            {configSitio.site_name} © {new Date().getFullYear()} • Panel de Socio
          </div>

        </div>
      </div>

      {/* ===== MODAL CONTRASEÑA ===== */}
      {showPasswordModal && (
        <div
          className="modal fade show"
          style={{ display: "block", background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)", zIndex: 2000 }}
          tabIndex="-1"
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content rounded-4 shadow-lg border-0">
              <form onSubmit={handlePasswordChange}>
                <div className="modal-header border-0 pb-0 px-4 pt-4">
                  <div className="d-flex align-items-center gap-2">
                    <div style={{ background: "#ede9fe", borderRadius: ".7rem", padding: ".5rem", color: "#6d28d9" }}>
                      <FaLock size={18} />
                    </div>
                    <h5 className="modal-title fw-bold mb-0" style={{ color: AZUL }}>Cambiar contraseña</h5>
                  </div>
                  <button type="button" className="btn-close" onClick={() => setShowPasswordModal(false)} />
                </div>
                <div className="modal-body px-4 pt-3">
                  <label className="form-label fw-semibold small" style={{ color: AZUL }}>Nueva contraseña</label>
                  <input
                    type="password"
                    className="form-control form-control-lg rounded-3"
                    placeholder="Mínimo 6 caracteres"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    autoFocus
                    style={{ border: "1.5px solid #e2e8f0" }}
                  />
                  <div className="text-muted mt-2 small">
                    <FaCheckCircle className="me-1 text-success" />
                    Usa al menos 6 caracteres para mayor seguridad.
                  </div>
                </div>
                <div className="modal-footer border-0 px-4 pb-4 gap-2">
                  <button type="button" className="btn btn-light rounded-3 px-4 fw-semibold"
                    onClick={() => setShowPasswordModal(false)}>
                    Cancelar
                  </button>
                  <button type="submit" className="btn rounded-3 px-4 fw-bold"
                    style={{ background: AZUL, color: "#fff" }}>
                    <FaCheckCircle className="me-2" />
                    Guardar cambios
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ===== MODAL FOTO PERFIL ===== */}
      {showFotoModal && user.foto && (
        <div
          className="sp-foto-overlay"
          onClick={() => { if (!fotoSubiendo) { setShowFotoModal(false); setFotoError(""); } }}
        >
          <div className="sp-foto-modal-content" onClick={(e) => e.stopPropagation()}
            style={{ textAlign: "center" }}>

            {/* Imagen grande */}
            <div style={{ position: "relative", display: "inline-block" }}>
              <img
                src={`${API_URL.replace("/api", "")}${user.foto}`}
                alt={user.nombre_completo}
                style={{
                  maxWidth: "88vw",
                  maxHeight: "72vh",
                  borderRadius: "1rem",
                  boxShadow: "0 20px 60px rgba(0,0,0,0.55)",
                  objectFit: "contain",
                  display: "block",
                }}
              />
              {fotoSubiendo && (
                <div style={{
                  position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  borderRadius: "1rem",
                }}>
                  <div className="spinner-border text-light" />
                </div>
              )}
              <button
                className="sp-foto-close"
                onClick={() => { setShowFotoModal(false); setFotoError(""); }}
                title="Cerrar"
                disabled={fotoSubiendo}
              >
                ✕
              </button>
            </div>

            {/* Controles de cambio de foto */}
            <div className="sp-foto-actions">
              {/* Inputs ocultos */}
              <input
                id="sp-input-galeria"
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={handleFotoChange}
              />
              <input
                id="sp-input-camara"
                type="file"
                accept="image/*"
                capture="user"
                style={{ display: "none" }}
                onChange={handleFotoChange}
              />

              <button
                className="sp-foto-action-btn"
                style={{ background: VERDE, color: "#1a2a00" }}
                disabled={fotoSubiendo}
                onClick={() => document.getElementById("sp-input-galeria").click()}
              >
                <FaUpload size={13} />
                Elegir foto
              </button>

              <button
                className="sp-foto-action-btn"
                style={{ background: AZUL_CLARO, color: "#fff" }}
                disabled={fotoSubiendo}
                onClick={() => document.getElementById("sp-input-camara").click()}
              >
                <FaCamera size={13} />
                Tomar foto
              </button>
            </div>

            {fotoError && (
              <div className="mt-2 small px-3 py-2 rounded-3"
                style={{ background: "#fee2e2", color: "#991b1b", display: "inline-block" }}>
                {fotoError}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
