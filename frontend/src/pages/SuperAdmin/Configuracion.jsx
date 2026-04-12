import { useEffect, useState, useCallback, useRef } from "react";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import { useAlerta } from "../../context/AlertaContext";
import { FaCog, FaSave, FaHome, FaSignInAlt, FaPlus, FaTrash, FaUpload, FaImage } from "react-icons/fa";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const ACCENT = "#a8cd3a";
const DARK   = "#1a2035";

// ── Defaults ─────────────────────────────────────────────────────────────────
const DEFAULTS_HOME = {
  home_badge:    "Plataforma cooperativa digital",
  home_title1:   "Tu cooperativa,",
  home_title2:   "siempre contigo.",
  home_subtitle: "Gestiona tus aportaciones, préstamos y cuentas desde un solo lugar, de forma segura, rápida y eficiente.",
  home_cta:      "Comenzar ahora",
  home_footer:   "Smart Coop © {year} — Ahorro y crédito, desde cualquier lugar.",
  home_features: [
    { icon: "💰", title: "Aportaciones", desc: "Registra y consulta tus aportaciones en tiempo real." },
    { icon: "🏦", title: "Préstamos",    desc: "Solicita y gestiona préstamos de forma rápida y segura." },
    { icon: "📊", title: "Reportes",     desc: "Accede a reportes financieros detallados y actualizados." },
    { icon: "🔐", title: "Seguridad",    desc: "Tu información protegida con acceso seguro las 24 horas." },
  ],
};

const DEFAULTS_LOGIN = {
  login_tagline1: "Tu Cooperativa,",
  login_tagline2: "siempre contigo.",
  login_subtitle: "Gestiona tus aportaciones, préstamos y cuentas desde un solo lugar, de forma segura y eficiente.",
  login_features: [
    "Control total de tus finanzas",
    "Acceso seguro 24/7",
    "Reportes en tiempo real",
    "Gestión de socios y roles",
  ],
};

// ── Subcomponente: campo de texto ─────────────────────────────────────────────
function Campo({ label, value, onChange, multiline = false, placeholder = "" }) {
  return (
    <div className="mb-3">
      <label className="form-label" style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>
        {label}
      </label>
      {multiline ? (
        <textarea
          className="form-control"
          rows={3}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          style={{ fontSize: 14, resize: "vertical" }}
        />
      ) : (
        <input
          type="text"
          className="form-control"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          style={{ fontSize: 14 }}
        />
      )}
    </div>
  );
}

// ── Tab Inicio ────────────────────────────────────────────────────────────────
function TabInicio({ datos, setDatos }) {
  const setField = (key) => (val) => setDatos((p) => ({ ...p, [key]: val }));

  const updateFeature = (i, field, val) => {
    const arr = [...datos.home_features];
    arr[i] = { ...arr[i], [field]: val };
    setDatos((p) => ({ ...p, home_features: arr }));
  };

  const addFeature = () =>
    setDatos((p) => ({
      ...p,
      home_features: [...p.home_features, { icon: "✨", title: "Nueva característica", desc: "Descripción aquí." }],
    }));

  const removeFeature = (i) =>
    setDatos((p) => ({ ...p, home_features: p.home_features.filter((_, idx) => idx !== i) }));

  return (
    <div>
      {/* Hero */}
      <div className="card border-0 shadow-sm mb-4" style={{ borderRadius: 14 }}>
        <div
          className="card-header border-0 py-3 px-4"
          style={{
            background: `linear-gradient(135deg, ${DARK} 0%, #2d3a5a 100%)`,
            borderRadius: "14px 14px 0 0",
          }}
        >
          <span className="fw-semibold text-white" style={{ fontSize: 14 }}>
            🏠 Sección Hero (principal)
          </span>
        </div>
        <div className="card-body px-4 pt-3 pb-2">
          <Campo label="Texto del badge (etiqueta pequeña)"   value={datos.home_badge}    onChange={setField("home_badge")}    placeholder="Plataforma cooperativa digital" />
          <div className="row g-3">
            <div className="col-md-6">
              <Campo label='Título línea 1 (texto blanco)'   value={datos.home_title1}   onChange={setField("home_title1")}   placeholder="Tu cooperativa," />
            </div>
            <div className="col-md-6">
              <Campo label='Título línea 2 (color verde)'    value={datos.home_title2}   onChange={setField("home_title2")}   placeholder="siempre contigo." />
            </div>
          </div>
          <Campo label="Subtítulo / descripción"             value={datos.home_subtitle} onChange={setField("home_subtitle")} placeholder="Gestiona tus..." multiline />
          <Campo label='Texto del botón "Comenzar ahora"'    value={datos.home_cta}      onChange={setField("home_cta")}      placeholder="Comenzar ahora" />
          <Campo
            label='Pie de página (usa {year} para el año actual)'
            value={datos.home_footer}
            onChange={setField("home_footer")}
            placeholder="Smart Coop © {year} — ..."
          />
        </div>
      </div>

      {/* Features */}
      <div className="card border-0 shadow-sm" style={{ borderRadius: 14 }}>
        <div
          className="card-header border-0 py-3 px-4 d-flex align-items-center justify-content-between"
          style={{
            background: `linear-gradient(135deg, ${DARK} 0%, #2d3a5a 100%)`,
            borderRadius: "14px 14px 0 0",
          }}
        >
          <span className="fw-semibold text-white" style={{ fontSize: 14 }}>
            ✨ Tarjetas de características
          </span>
          <button
            type="button"
            className="btn btn-sm"
            style={{ background: ACCENT, color: DARK, fontWeight: 700, borderRadius: 8, fontSize: 12 }}
            onClick={addFeature}
          >
            <FaPlus className="me-1" /> Agregar
          </button>
        </div>
        <div className="card-body px-4 pt-3 pb-2">
          {datos.home_features.map((f, i) => (
            <div
              key={i}
              className="mb-3 p-3"
              style={{ background: "rgba(168,205,58,0.05)", borderRadius: 10, border: "1px solid rgba(168,205,58,0.15)" }}
            >
              <div className="d-flex justify-content-between align-items-center mb-2">
                <span className="fw-semibold" style={{ fontSize: 13, color: "#374151" }}>
                  Tarjeta #{i + 1}
                </span>
                {datos.home_features.length > 1 && (
                  <button
                    type="button"
                    className="btn btn-sm btn-danger"
                    style={{ borderRadius: 7, fontSize: 11, padding: "2px 8px" }}
                    onClick={() => removeFeature(i)}
                  >
                    <FaTrash />
                  </button>
                )}
              </div>
              <div className="row g-2">
                <div className="col-2">
                  <label className="form-label" style={{ fontSize: 12, fontWeight: 600, color: "#6b7280" }}>Icono</label>
                  <input
                    type="text"
                    className="form-control"
                    value={f.icon}
                    onChange={(e) => updateFeature(i, "icon", e.target.value)}
                    style={{ fontSize: 18, textAlign: "center", padding: "6px" }}
                    maxLength={4}
                  />
                </div>
                <div className="col-4">
                  <label className="form-label" style={{ fontSize: 12, fontWeight: 600, color: "#6b7280" }}>Título</label>
                  <input
                    type="text"
                    className="form-control"
                    value={f.title}
                    onChange={(e) => updateFeature(i, "title", e.target.value)}
                    style={{ fontSize: 13 }}
                  />
                </div>
                <div className="col-6">
                  <label className="form-label" style={{ fontSize: 12, fontWeight: 600, color: "#6b7280" }}>Descripción</label>
                  <input
                    type="text"
                    className="form-control"
                    value={f.desc}
                    onChange={(e) => updateFeature(i, "desc", e.target.value)}
                    style={{ fontSize: 13 }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Tab Login ─────────────────────────────────────────────────────────────────
function TabLogin({ datos, setDatos }) {
  const setField = (key) => (val) => setDatos((p) => ({ ...p, [key]: val }));

  const updateLoginFeature = (i, val) => {
    const arr = [...datos.login_features];
    arr[i] = val;
    setDatos((p) => ({ ...p, login_features: arr }));
  };

  const addLoginFeature = () =>
    setDatos((p) => ({ ...p, login_features: [...p.login_features, "Nueva característica"] }));

  const removeLoginFeature = (i) =>
    setDatos((p) => ({ ...p, login_features: p.login_features.filter((_, idx) => idx !== i) }));

  return (
    <div>
      {/* Branding panel izquierdo login */}
      <div className="card border-0 shadow-sm mb-4" style={{ borderRadius: 14 }}>
        <div
          className="card-header border-0 py-3 px-4"
          style={{
            background: `linear-gradient(135deg, ${DARK} 0%, #2d3a5a 100%)`,
            borderRadius: "14px 14px 0 0",
          }}
        >
          <span className="fw-semibold text-white" style={{ fontSize: 14 }}>
            🔑 Panel izquierdo del Login (branding)
          </span>
        </div>
        <div className="card-body px-4 pt-3 pb-2">
          <div className="row g-3">
            <div className="col-md-6">
              <Campo label='Tagline línea 1 (texto blanco)'  value={datos.login_tagline1} onChange={setField("login_tagline1")} placeholder="Tu Cooperativa," />
            </div>
            <div className="col-md-6">
              <Campo label='Tagline línea 2 (color verde)'   value={datos.login_tagline2} onChange={setField("login_tagline2")} placeholder="siempre contigo." />
            </div>
          </div>
          <Campo label="Descripción / subtítulo" value={datos.login_subtitle} onChange={setField("login_subtitle")} placeholder="Gestiona tus..." multiline />
        </div>
      </div>

      {/* Lista de características */}
      <div className="card border-0 shadow-sm" style={{ borderRadius: 14 }}>
        <div
          className="card-header border-0 py-3 px-4 d-flex align-items-center justify-content-between"
          style={{
            background: `linear-gradient(135deg, ${DARK} 0%, #2d3a5a 100%)`,
            borderRadius: "14px 14px 0 0",
          }}
        >
          <span className="fw-semibold text-white" style={{ fontSize: 14 }}>
            ● Lista de características (puntos verdes)
          </span>
          <button
            type="button"
            className="btn btn-sm"
            style={{ background: ACCENT, color: DARK, fontWeight: 700, borderRadius: 8, fontSize: 12 }}
            onClick={addLoginFeature}
          >
            <FaPlus className="me-1" /> Agregar
          </button>
        </div>
        <div className="card-body px-4 pt-3 pb-2">
          {datos.login_features.map((f, i) => (
            <div key={i} className="d-flex align-items-center gap-2 mb-2">
              <div
                style={{
                  width: 9, height: 9, borderRadius: "50%",
                  background: ACCENT, boxShadow: `0 0 6px ${ACCENT}`,
                  flexShrink: 0,
                }}
              />
              <input
                type="text"
                className="form-control"
                value={f}
                onChange={(e) => updateLoginFeature(i, e.target.value)}
                style={{ fontSize: 13 }}
              />
              {datos.login_features.length > 1 && (
                <button
                  type="button"
                  className="btn btn-sm btn-danger"
                  style={{ borderRadius: 7, fontSize: 11, padding: "4px 8px", flexShrink: 0 }}
                  onClick={() => removeLoginFeature(i)}
                >
                  <FaTrash />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Vista previa mini ─────────────────────────────────────────────────────────
function Preview({ tabActivo, home, login }) {
  if (tabActivo === "inicio") {
    return (
      <div
        style={{
          background: DARK,
          borderRadius: 14,
          padding: "20px 24px",
          color: "#fff",
          fontSize: 12,
          minHeight: 200,
        }}
      >
        <div style={{ color: ACCENT, fontSize: 10, fontWeight: 600, marginBottom: 6 }}>
          ● {home.home_badge}
        </div>
        <div style={{ fontWeight: 900, fontSize: 15, lineHeight: 1.2 }}>
          {home.home_title1}<br />
          <span style={{ color: ACCENT }}>{home.home_title2}</span>
        </div>
        <div style={{ color: "rgba(255,255,255,0.5)", marginTop: 6, marginBottom: 10, lineHeight: 1.5, fontSize: 11 }}>
          {home.home_subtitle}
        </div>
        <div
          style={{
            display: "inline-block",
            background: ACCENT,
            color: DARK,
            fontWeight: 800,
            borderRadius: 8,
            padding: "5px 14px",
            fontSize: 11,
            marginBottom: 12,
          }}
        >
          {home.home_cta} →
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {home.home_features.slice(0, 4).map((f, i) => (
            <div
              key={i}
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 8,
                padding: "6px 10px",
                textAlign: "center",
                flex: "1 1 60px",
                minWidth: 60,
              }}
            >
              <div style={{ fontSize: 14 }}>{f.icon}</div>
              <div style={{ fontWeight: 700, fontSize: 10 }}>{f.title}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        background: DARK,
        borderRadius: 14,
        padding: "20px 24px",
        color: "#fff",
        fontSize: 12,
        minHeight: 200,
      }}
    >
      <div style={{ fontWeight: 900, fontSize: 15, lineHeight: 1.2 }}>
        {login.login_tagline1}<br />
        <span style={{ color: ACCENT }}>{login.login_tagline2}</span>
      </div>
      <div style={{ width: 32, height: 2, background: `linear-gradient(90deg, ${ACCENT}, transparent)`, borderRadius: 2, margin: "8px 0" }} />
      <div style={{ color: "rgba(255,255,255,0.45)", lineHeight: 1.5, fontSize: 11, marginBottom: 10 }}>
        {login.login_subtitle}
      </div>
      {login.login_features.map((f, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5, color: "rgba(255,255,255,0.6)", fontSize: 11 }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: ACCENT, boxShadow: `0 0 5px ${ACCENT}`, flexShrink: 0 }} />
          {f}
        </div>
      ))}
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function Configuracion() {
  const { token } = useAuth();
  const { mostrarAlerta } = useAlerta();

  const [tabActivo, setTabActivo] = useState("inicio");
  const [loading,   setLoading]   = useState(true);
  const [guardando, setGuardando] = useState(false);

  const [datosHome,  setDatosHome]  = useState(DEFAULTS_HOME);
  const [datosLogin, setDatosLogin] = useState(DEFAULTS_LOGIN);
  const [siteName,   setSiteName]   = useState("Smart Coop");

  // Logo
  const [logoActual,    setLogoActual]    = useState("");
  const [logoPreview,   setLogoPreview]   = useState(null);
  const [logoFile,      setLogoFile]      = useState(null);
  const [subiendoLogo,  setSubiendoLogo]  = useState(false);
  const inputLogoRef = useRef();

  const headers = { Authorization: `Bearer ${token}` };

  const cargarConfig = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await axios.get(`${API_URL}/configuracion`);
      if (data?.data) {
        const c = data.data;
        setDatosHome({
          home_badge:    c.home_badge    ?? DEFAULTS_HOME.home_badge,
          home_title1:   c.home_title1   ?? DEFAULTS_HOME.home_title1,
          home_title2:   c.home_title2   ?? DEFAULTS_HOME.home_title2,
          home_subtitle: c.home_subtitle ?? DEFAULTS_HOME.home_subtitle,
          home_cta:      c.home_cta      ?? DEFAULTS_HOME.home_cta,
          home_footer:   c.home_footer   ?? DEFAULTS_HOME.home_footer,
          home_features: Array.isArray(c.home_features) ? c.home_features : DEFAULTS_HOME.home_features,
        });
        setDatosLogin({
          login_tagline1: c.login_tagline1 ?? DEFAULTS_LOGIN.login_tagline1,
          login_tagline2: c.login_tagline2 ?? DEFAULTS_LOGIN.login_tagline2,
          login_subtitle: c.login_subtitle ?? DEFAULTS_LOGIN.login_subtitle,
          login_features: Array.isArray(c.login_features) ? c.login_features : DEFAULTS_LOGIN.login_features,
        });
        if (c.logo_url) setLogoActual(c.logo_url);
        if (c.site_name) setSiteName(c.site_name);
      }
    } catch {
      mostrarAlerta("Error al cargar la configuración del sitio", "error");
    } finally {
      setLoading(false);
    }
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { cargarConfig(); }, [cargarConfig]);

  const guardar = async () => {
    try {
      setGuardando(true);
      const payload = { site_name: siteName, ...datosHome, ...datosLogin };
      await axios.put(`${API_URL}/configuracion`, payload, { headers });
      mostrarAlerta("Configuración del sitio guardada correctamente", "success");
    } catch (err) {
      mostrarAlerta(err.response?.data?.message || "Error al guardar la configuración", "error");
    } finally {
      setGuardando(false);
    }
  };

  const onSeleccionarLogo = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const subirLogo = async () => {
    if (!logoFile) return;
    try {
      setSubiendoLogo(true);
      const formData = new FormData();
      formData.append("logo", logoFile);
      const { data } = await axios.post(`${API_URL}/configuracion/logo`, formData, {
        headers: { ...headers, "Content-Type": "multipart/form-data" },
      });
      setLogoActual(data.logo_url);
      setLogoPreview(null);
      setLogoFile(null);
      if (inputLogoRef.current) inputLogoRef.current.value = "";
      mostrarAlerta("Logo actualizado correctamente", "success");
    } catch (err) {
      mostrarAlerta(err.response?.data?.message || "Error al subir el logo", "error");
    } finally {
      setSubiendoLogo(false);
    }
  };

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
      <div className="d-flex align-items-center gap-3 mb-4 flex-wrap">
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
          <FaCog style={{ color: "#fff", fontSize: 24 }} />
        </div>
        <div className="me-auto">
          <h4 className="mb-0 fw-bold" style={{ color: DARK }}>Configuración del Sitio</h4>
          <span className="text-muted" style={{ fontSize: 13 }}>
            Personaliza los textos de la página de inicio y la pantalla de login
          </span>
        </div>
        <button
          className="btn d-flex align-items-center gap-2"
          style={{
            background: `linear-gradient(135deg, ${ACCENT} 0%, #7fa020 100%)`,
            color: DARK,
            fontWeight: 700,
            borderRadius: 10,
            padding: "9px 22px",
            fontSize: 14,
            boxShadow: `0 4px 14px ${ACCENT}44`,
          }}
          onClick={guardar}
          disabled={guardando}
        >
          {guardando ? (
            <span className="spinner-border spinner-border-sm me-1" role="status" />
          ) : (
            <FaSave />
          )}
          {guardando ? "Guardando..." : "Guardar cambios"}
        </button>
      </div>

      <div className="row g-4">
        {/* ── Panel Logo ─────────────────────────────────────────── */}
        <div className="col-12">
          <div className="card border-0 shadow-sm" style={{ borderRadius: 14 }}>
            <div
              className="card-header border-0 py-3 px-4"
              style={{
                background: `linear-gradient(135deg, ${DARK} 0%, #2d3a5a 100%)`,
                borderRadius: "14px 14px 0 0",
              }}
            >
              <div className="d-flex align-items-center gap-2">
                <FaImage style={{ color: ACCENT, fontSize: 16 }} />
                <span className="fw-semibold text-white" style={{ fontSize: 14 }}>
                  Logo del sitio (Inicio, Login y Navbar)
                </span>
              </div>
            </div>
            <div className="card-body px-4 py-3">
              <div className="d-flex align-items-center gap-4 flex-wrap">
                {/* Logo actual */}
                <div style={{ textAlign: "center" }}>
                  <p className="mb-1" style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: ".5px" }}>
                    Logo actual
                  </p>
                  <div
                    style={{
                      width: 120, height: 80,
                      border: "2px dashed #d1d5db",
                      borderRadius: 10,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: "#f9fafb", overflow: "hidden",
                    }}
                  >
                    <img
                      src={logoActual ? `http://localhost:5000${logoActual}` : "/smartcoop.png"}
                      alt="Logo actual"
                      style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
                    />
                  </div>
                </div>

                {/* Flecha */}
                {logoPreview && (
                  <>
                    <div style={{ color: "#9ca3af", fontSize: 20 }}>→</div>
                    {/* Vista previa del nuevo logo */}
                    <div style={{ textAlign: "center" }}>
                      <p className="mb-1" style={{ fontSize: 11, fontWeight: 600, color: ACCENT, textTransform: "uppercase", letterSpacing: ".5px" }}>
                        Nuevo logo
                      </p>
                      <div
                        style={{
                          width: 120, height: 80,
                          border: `2px solid ${ACCENT}`,
                          borderRadius: 10,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          background: "#f9fafb", overflow: "hidden",
                        }}
                      >
                        <img
                          src={logoPreview}
                          alt="Nuevo logo"
                          style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
                        />
                      </div>
                    </div>
                  </>
                )}

                {/* Controles */}
                <div className="d-flex flex-column gap-2">
                  <input
                    ref={inputLogoRef}
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp,.gif,.svg"
                    style={{ display: "none" }}
                    onChange={onSeleccionarLogo}
                  />
                  <button
                    type="button"
                    className="btn d-flex align-items-center gap-2"
                    style={{
                      background: "rgba(26,32,53,0.08)",
                      border: "1px solid #d1d5db",
                      borderRadius: 9,
                      fontWeight: 600,
                      fontSize: 13,
                      color: DARK,
                    }}
                    onClick={() => inputLogoRef.current?.click()}
                  >
                    <FaImage /> Seleccionar imagen
                  </button>
                  {logoFile && (
                    <button
                      type="button"
                      className="btn d-flex align-items-center gap-2"
                      style={{
                        background: `linear-gradient(135deg, ${ACCENT} 0%, #7fa020 100%)`,
                        border: "none",
                        borderRadius: 9,
                        fontWeight: 700,
                        fontSize: 13,
                        color: DARK,
                        boxShadow: `0 3px 10px ${ACCENT}44`,
                      }}
                      onClick={subirLogo}
                      disabled={subiendoLogo}
                    >
                      {subiendoLogo ? (
                        <span className="spinner-border spinner-border-sm" role="status" />
                      ) : (
                        <FaUpload />
                      )}
                      {subiendoLogo ? "Subiendo..." : "Aplicar logo"}
                    </button>
                  )}
                  <p className="mb-0" style={{ fontSize: 11, color: "#9ca3af" }}>
                    JPG, PNG, WEBP, SVG, GIF · Máx 5 MB
                  </p>
                </div>
              </div>

              {/* Nombre del sitio */}
              <div className="mt-3 pt-3" style={{ borderTop: "1px solid #e5e7eb" }}>
                <label className="form-label" style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>
                  Nombre del sitio (Navbar, Login, etc.)
                </label>
                <input
                  type="text"
                  className="form-control"
                  value={siteName}
                  onChange={(e) => setSiteName(e.target.value)}
                  placeholder="Smart Coop"
                  style={{ fontSize: 14, maxWidth: 320 }}
                />
                <p className="mb-0 mt-1" style={{ fontSize: 11, color: "#9ca3af" }}>
                  Aparece en la barra superior, la pantalla de login y el inicio.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Panel editor */}
        <div className="col-12 col-xl-8">
          {/* Pestañas */}
          <ul className="nav nav-tabs mb-4" style={{ borderBottom: "2px solid #e5e7eb" }}>
            {[
              { key: "inicio", label: "Inicio", Icon: FaHome },
              { key: "login",  label: "Login",  Icon: FaSignInAlt },
            ].map(({ key, label, Icon }) => (
              <li key={key} className="nav-item">
                <button
                  type="button"
                  className="nav-link d-flex align-items-center gap-2"
                  style={{
                    border: "none",
                    borderBottom: tabActivo === key ? `2px solid ${ACCENT}` : "2px solid transparent",
                    color: tabActivo === key ? DARK : "#6b7280",
                    fontWeight: tabActivo === key ? 700 : 500,
                    background: "none",
                    paddingBottom: 10,
                    fontSize: 14,
                    marginBottom: -2,
                    transition: "color 0.2s",
                  }}
                  onClick={() => setTabActivo(key)}
                >
                  <Icon style={{ fontSize: 13 }} />
                  {label}
                </button>
              </li>
            ))}
          </ul>

          {tabActivo === "inicio" ? (
            <TabInicio datos={datosHome} setDatos={setDatosHome} />
          ) : (
            <TabLogin datos={datosLogin} setDatos={setDatosLogin} />
          )}
        </div>

        {/* Panel vista previa */}
        <div className="col-12 col-xl-4">
          <div className="card border-0 shadow-sm" style={{ borderRadius: 14, position: "sticky", top: 80 }}>
            <div
              className="card-header border-0 py-3 px-4"
              style={{
                background: `linear-gradient(135deg, ${DARK} 0%, #2d3a5a 100%)`,
                borderRadius: "14px 14px 0 0",
              }}
            >
              <span className="fw-semibold text-white" style={{ fontSize: 14 }}>
                👁️ Vista previa
              </span>
            </div>
            <div className="card-body p-3">
              <Preview tabActivo={tabActivo} home={datosHome} login={datosLogin} />
              <p className="text-muted mt-2 mb-0" style={{ fontSize: 11, textAlign: "center" }}>
                Vista aproximada — el resultado real puede variar levemente
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
