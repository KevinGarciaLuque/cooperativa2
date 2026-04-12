import { useEffect, useRef, useState } from "react";
import axios from "axios";
import {
  FaUserCircle, FaShieldAlt, FaHistory,
  FaUser, FaEnvelope, FaPhone, FaMapMarkerAlt,
  FaBirthdayCake, FaIdCard, FaCamera, FaEdit,
  FaSave, FaTimes, FaLock, FaEye, FaEyeSlash,
  FaCheckCircle, FaExclamationTriangle, FaIdBadge,
} from "react-icons/fa";
import { useAuth } from "../context/AuthContext";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const BG      = "#f0f4f8";
const ACCENT  = "#a8cd3a";
const DARK    = "#1a2035";
const DARK2   = "#222d45";
const MUTED   = "#6b7280";

function getInitials(name) {
  if (!name) return "U";
  const p = name.trim().split(" ");
  return p.length >= 2 ? (p[0][0] + p[1][0]).toUpperCase() : name[0].toUpperCase();
}

function fmtFecha(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-HN", {
    day: "2-digit", month: "long", year: "numeric",
  });
}

function estadoBadge(estado) {
  const map = {
    activo:    { bg: "#d1fae5", color: "#065f46", label: "Activo" },
    inactivo:  { bg: "#fee2e2", color: "#991b1b", label: "Inactivo" },
    suspendido:{ bg: "#fef3c7", color: "#92400e", label: "Suspendido" },
  };
  const s = map[(estado || "").toLowerCase()] || { bg: "#e5e7eb", color: "#374151", label: estado };
  return (
    <span
      style={{
        background: s.bg, color: s.color, fontWeight: 700,
        fontSize: ".72rem", borderRadius: 20, padding: "3px 10px",
        letterSpacing: ".4px", textTransform: "uppercase",
      }}
    >
      {s.label}
    </span>
  );
}

export default function MiPerfil() {
  const { user, token, updateUser } = useAuth();
  const [tab, setTab]               = useState("info");
  const [perfil, setPerfil]         = useState(null);
  const [bitacora, setBitacora]     = useState([]);
  const [loading, setLoading]       = useState(true);

  /* ── Edición info personal ── */
  const [editando, setEditando]     = useState(false);
  const [form, setForm]             = useState({});
  const [guardando, setGuardando]   = useState(false);

  /* ── Cambio de contraseña ── */
  const [passForm, setPassForm]     = useState({ actual: "", nueva: "", confirmar: "" });
  const [showPass, setShowPass]     = useState({ actual: false, nueva: false, confirmar: false });
  const [cambiandoPass, setCambiandoPass] = useState(false);

  /* ── Foto ── */
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const fotoRef = useRef();

  /* ── Mensajes ── */
  const [alerta, setAlerta]         = useState(null); // { tipo: "ok"|"err", msg }

  const mostrarAlerta = (tipo, msg) => {
    setAlerta({ tipo, msg });
    setTimeout(() => setAlerta(null), 3500);
  };

  /* ─── Carga inicial ─── */
  useEffect(() => {
    if (!user?.id_usuario) return;
    const fetchTodo = async () => {
      setLoading(true);
      try {
        const [perfilRes, bitacoraRes] = await Promise.all([
          axios.get(`${API_URL}/usuarios/${user.id_usuario}`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          axios.get(`${API_URL}/bitacora/usuario/${user.id_usuario}?limit=15`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);
        const p = perfilRes.data.usuario || perfilRes.data;
        setPerfil(p);
        setForm({
          nombre_completo: p.nombre_completo || "",
          telefono:        p.telefono || "",
          correo:          p.correo || "",
          direccion:       p.direccion || "",
          fecha_nacimiento: p.fecha_nacimiento ? p.fecha_nacimiento.slice(0, 10) : "",
        });
        const logs = bitacoraRes.data.data || bitacoraRes.data || [];
        setBitacora(Array.isArray(logs) ? logs.slice(0, 15) : []);
      } catch {
        mostrarAlerta("err", "No se pudieron cargar los datos del perfil.");
      }
      setLoading(false);
    };
    fetchTodo();
  }, [user?.id_usuario, token]);

  /* ─── Guardar datos personales ─── */
  const handleGuardar = async (e) => {
    e.preventDefault();
    setGuardando(true);
    try {
      await axios.put(
        `${API_URL}/usuarios/${user.id_usuario}`,
        {
          nombre_completo: form.nombre_completo,
          telefono:        form.telefono || null,
          correo:          form.correo   || null,
          direccion:       form.direccion || null,
          fecha_nacimiento: form.fecha_nacimiento || null,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      updateUser({ nombre_completo: form.nombre_completo, correo: form.correo });
      setPerfil((prev) => ({ ...prev, ...form }));
      setEditando(false);
      mostrarAlerta("ok", "Información actualizada correctamente.");
    } catch (err) {
      mostrarAlerta("err", err.response?.data?.message || "Error al guardar los cambios.");
    }
    setGuardando(false);
  };

  /* ─── Cambiar contraseña ─── */
  const handleCambiarPass = async (e) => {
    e.preventDefault();
    if (passForm.nueva !== passForm.confirmar) {
      mostrarAlerta("err", "Las contraseñas nuevas no coinciden.");
      return;
    }
    if (passForm.nueva.length < 6) {
      mostrarAlerta("err", "La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    setCambiandoPass(true);
    try {
      await axios.put(
        `${API_URL}/usuarios/${user.id_usuario}`,
        { password: passForm.nueva },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setPassForm({ actual: "", nueva: "", confirmar: "" });
      mostrarAlerta("ok", "Contraseña cambiada exitosamente.");
    } catch (err) {
      mostrarAlerta("err", err.response?.data?.message || "Error al cambiar la contraseña.");
    }
    setCambiandoPass(false);
  };

  /* ─── Subir foto ─── */
  const handleFoto = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setSubiendoFoto(true);
    try {
      const fd = new FormData();
      fd.append("foto", file);
      const res = await axios.put(
        `${API_URL}/usuarios/${user.id_usuario}/foto`,
        fd,
        { headers: { "Content-Type": "multipart/form-data", Authorization: `Bearer ${token}` } }
      );
      updateUser({ foto: res.data.foto });
      setPerfil((prev) => ({ ...prev, foto: res.data.foto }));
      mostrarAlerta("ok", "Foto de perfil actualizada.");
    } catch {
      mostrarAlerta("err", "Error al subir la foto. Intente de nuevo.");
    }
    setSubiendoFoto(false);
    e.target.value = "";
  };

  const fotoUrl = perfil?.foto
    ? `${API_URL.replace("/api", "")}${perfil.foto}`
    : null;

  const tabs = [
    { key: "info",       label: "Información personal", icon: <FaUser /> },
    { key: "seguridad",  label: "Seguridad",             icon: <FaShieldAlt /> },
    { key: "actividad",  label: "Actividad reciente",    icon: <FaHistory /> },
  ];

  return (
    <>
      <style>{`
        .mp-hero {
          background: linear-gradient(135deg, ${DARK} 0%, ${DARK2} 60%, #2e3d5a 100%);
          border-radius: 1.4rem;
          overflow: hidden;
        }
        .mp-avatar-wrap {
          position: relative;
          width: 96px; height: 96px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .mp-avatar-wrap img,
        .mp-avatar-fallback {
          width: 96px; height: 96px;
          border-radius: 50%;
          object-fit: cover;
          border: 3px solid ${ACCENT};
          box-shadow: 0 0 20px ${ACCENT}55;
          background: linear-gradient(135deg, ${ACCENT} 0%, #7fa020 100%);
          display: flex; align-items: center; justify-content: center;
          font-size: 2.2rem; font-weight: 800; color: ${DARK}; letter-spacing: 1px;
        }
        .mp-camera-btn {
          position: absolute; bottom: 2px; right: 2px;
          width: 28px; height: 28px;
          border-radius: 50%;
          background: ${ACCENT};
          border: 2px solid ${DARK};
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; transition: background .2s, transform .2s;
          color: ${DARK};
          font-size: .75rem;
        }
        .mp-camera-btn:hover { background: #c0e040; transform: scale(1.12); }
        .mp-tab-btn {
          background: none; border: none;
          padding: .5rem 1.2rem; border-radius: 2rem;
          font-weight: 500; color: ${MUTED};
          transition: all .2s; display:flex; align-items:center; gap:.45rem;
          font-size: .9rem; cursor: pointer; white-space: nowrap;
        }
        .mp-tab-btn:hover { background: rgba(168,205,58,.1); color: #3a5a00; }
        .mp-tab-btn.active { background: ${ACCENT}; color: ${DARK}; font-weight: 700;
          box-shadow: 0 2px 10px ${ACCENT}55; }
        .mp-card {
          background: #fff;
          border-radius: 1.2rem;
          box-shadow: 0 2px 16px rgba(0,0,0,.07);
          padding: 1.6rem;
        }
        .mp-field-label {
          font-size: .73rem; font-weight: 700; text-transform: uppercase;
          letter-spacing: .8px; color: ${MUTED}; margin-bottom: .25rem;
        }
        .mp-field-value {
          font-size: .93rem; color: #1a1a2e; font-weight: 500;
          padding: .45rem .6rem;
          background: ${BG};
          border-radius: .6rem;
          min-height: 38px; display: flex; align-items: center;
        }
        .mp-input {
          width: 100%; border: 1.5px solid #d1d5db;
          border-radius: .7rem; padding: .45rem .75rem;
          font-size: .9rem; outline: none; background: #fff;
          transition: border-color .2s, box-shadow .2s;
        }
        .mp-input:focus { border-color: ${ACCENT}; box-shadow: 0 0 0 3px ${ACCENT}22; }
        .mp-btn-primary {
          background: ${ACCENT}; color: ${DARK};
          border: none; border-radius: .8rem; padding: .55rem 1.4rem;
          font-weight: 700; font-size: .88rem; cursor: pointer;
          transition: background .2s, box-shadow .2s;
          display: flex; align-items: center; gap: .4rem;
        }
        .mp-btn-primary:hover { background: #c0e040; box-shadow: 0 4px 14px ${ACCENT}44; }
        .mp-btn-primary:disabled { opacity: .6; cursor: not-allowed; }
        .mp-btn-outline {
          background: none; color: ${MUTED};
          border: 1.5px solid #d1d5db; border-radius: .8rem; padding: .55rem 1.2rem;
          font-weight: 600; font-size: .88rem; cursor: pointer;
          transition: border-color .2s, color .2s;
          display: flex; align-items: center; gap: .4rem;
        }
        .mp-btn-outline:hover { border-color: ${MUTED}; color: #374151; }
        .mp-btn-danger {
          background: #fee2e2; color: #991b1b;
          border: none; border-radius: .8rem; padding: .55rem 1.4rem;
          font-weight: 700; font-size: .88rem; cursor: pointer;
          transition: background .2s;
          display: flex; align-items: center; gap: .4rem;
        }
        .mp-btn-danger:hover { background: #fecaca; }
        .mp-btn-danger:disabled { opacity: .6; cursor: not-allowed; }
        .mp-pass-wrap { position: relative; }
        .mp-pass-eye {
          position: absolute; right: 11px; top: 50%; transform: translateY(-50%);
          background: none; border: none; color: ${MUTED}; cursor: pointer;
          font-size: .85rem; padding: 0;
        }
        .mp-log-row {
          padding: .65rem .8rem;
          border-radius: .8rem;
          transition: background .15s;
          display: flex; align-items: flex-start; gap: .8rem;
        }
        .mp-log-row:hover { background: ${BG}; }
        .mp-log-dot {
          width: 8px; height: 8px; border-radius: 50%;
          background: ${ACCENT}; margin-top: 6px; flex-shrink: 0;
        }
        .mp-alerta {
          position: fixed; top: 76px; right: 24px; z-index: 9999;
          padding: .75rem 1.25rem; border-radius: .9rem;
          font-size: .88rem; font-weight: 600;
          display: flex; align-items: center; gap: .5rem;
          box-shadow: 0 8px 32px rgba(0,0,0,.18);
          animation: slideIn .25s ease;
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(-12px); }
          to   { opacity: 1; transform: none; }
        }
        .mp-sep { border: none; border-top: 1px solid #e5e7eb; margin: 1.2rem 0; }
      `}</style>

      {/* Toast de alerta */}
      {alerta && (
        <div
          className="mp-alerta"
          style={{
            background: alerta.tipo === "ok" ? "#d1fae5" : "#fee2e2",
            color:      alerta.tipo === "ok" ? "#065f46" : "#991b1b",
          }}
        >
          {alerta.tipo === "ok"
            ? <FaCheckCircle />
            : <FaExclamationTriangle />}
          {alerta.msg}
        </div>
      )}

      <div style={{ background: BG, minHeight: "100vh", padding: "2rem 1.5rem" }}>
        <div style={{ maxWidth: 820, margin: "0 auto" }}>

          {/* ── Hero ── */}
          <div className="mp-hero p-4 mb-4 d-flex align-items-center gap-4 flex-wrap">
            {/* Avatar */}
            <div className="mp-avatar-wrap">
              {fotoUrl
                ? <img src={fotoUrl} alt="Foto de perfil" />
                : <div className="mp-avatar-fallback">{getInitials(perfil?.nombre_completo || user?.nombre_completo)}</div>
              }
              <button
                className="mp-camera-btn"
                title="Cambiar foto"
                onClick={() => fotoRef.current?.click()}
                disabled={subiendoFoto}
              >
                {subiendoFoto ? "…" : <FaCamera />}
              </button>
              <input ref={fotoRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFoto} />
            </div>

            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <h4 style={{ color: "#fff", fontWeight: 800, marginBottom: ".15rem", fontSize: "1.35rem" }}>
                {perfil?.nombre_completo || user?.nombre_completo || "—"}
              </h4>
              <div style={{ color: ACCENT, fontWeight: 600, fontSize: ".9rem", marginBottom: ".5rem" }}>
                {user?.rol || "—"}
              </div>
              <div className="d-flex gap-2 align-items-center flex-wrap">
                {estadoBadge(perfil?.estado || "activo")}
                <span style={{ color: "rgba(255,255,255,.45)", fontSize: ".75rem" }}>
                  Miembro desde {fmtFecha(perfil?.fecha_registro)}
                </span>
              </div>
            </div>
          </div>

          {/* ── Tabs ── */}
          <div className="d-flex gap-2 mb-4 flex-wrap">
            {tabs.map((t) => (
              <button
                key={t.key}
                className={`mp-tab-btn${tab === t.key ? " active" : ""}`}
                onClick={() => setTab(t.key)}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>

          {loading && (
            <div className="text-center py-5" style={{ color: MUTED }}>
              Cargando información…
            </div>
          )}

          {!loading && (
            <>
              {/* ────────────────────────────── TAB: INFO ── */}
              {tab === "info" && (
                <div className="mp-card">
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <h6 style={{ fontWeight: 700, color: DARK, marginBottom: 0 }}>
                      Datos personales
                    </h6>
                    {!editando
                      ? (
                        <button className="mp-btn-outline" onClick={() => setEditando(true)}>
                          <FaEdit /> Editar
                        </button>
                      ) : (
                        <button className="mp-btn-outline" onClick={() => setEditando(false)}>
                          <FaTimes /> Cancelar
                        </button>
                      )
                    }
                  </div>

                  <form onSubmit={handleGuardar}>
                    <div className="row g-3">

                      {/* Nombre completo */}
                      <div className="col-12 col-md-6">
                        <div className="mp-field-label"><FaUser style={{ marginRight: 5 }} />Nombre completo</div>
                        {editando
                          ? <input className="mp-input" value={form.nombre_completo}
                              onChange={(e) => setForm({ ...form, nombre_completo: e.target.value })}
                              required />
                          : <div className="mp-field-value">{perfil?.nombre_completo || "—"}</div>
                        }
                      </div>

                      {/* DNI (solo lectura) */}
                      <div className="col-12 col-md-6">
                        <div className="mp-field-label"><FaIdCard style={{ marginRight: 5 }} />DNI / Identidad</div>
                        <div className="mp-field-value" style={{ color: MUTED }}>
                          {perfil?.dni || "—"}
                          <span style={{ marginLeft: 8, fontSize: ".72rem", color: MUTED }}>(no editable)</span>
                        </div>
                      </div>

                      {/* Teléfono */}
                      <div className="col-12 col-md-6">
                        <div className="mp-field-label"><FaPhone style={{ marginRight: 5 }} />Teléfono</div>
                        {editando
                          ? <input className="mp-input" value={form.telefono}
                              onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                              placeholder="Ej: 99887766" />
                          : <div className="mp-field-value">{perfil?.telefono || "—"}</div>
                        }
                      </div>

                      {/* Correo */}
                      <div className="col-12 col-md-6">
                        <div className="mp-field-label"><FaEnvelope style={{ marginRight: 5 }} />Correo electrónico</div>
                        {editando
                          ? <input className="mp-input" type="email" value={form.correo}
                              onChange={(e) => setForm({ ...form, correo: e.target.value })}
                              placeholder="correo@ejemplo.com" />
                          : <div className="mp-field-value">{perfil?.correo || "—"}</div>
                        }
                      </div>

                      {/* Dirección */}
                      <div className="col-12">
                        <div className="mp-field-label"><FaMapMarkerAlt style={{ marginRight: 5 }} />Dirección</div>
                        {editando
                          ? <input className="mp-input" value={form.direccion}
                              onChange={(e) => setForm({ ...form, direccion: e.target.value })}
                              placeholder="Ciudad, Barrio, Calle..." />
                          : <div className="mp-field-value">{perfil?.direccion || "—"}</div>
                        }
                      </div>

                      {/* Fecha nacimiento */}
                      <div className="col-12 col-md-6">
                        <div className="mp-field-label"><FaBirthdayCake style={{ marginRight: 5 }} />Fecha de nacimiento</div>
                        {editando
                          ? <input className="mp-input" type="date" value={form.fecha_nacimiento}
                              onChange={(e) => setForm({ ...form, fecha_nacimiento: e.target.value })} />
                          : <div className="mp-field-value">{fmtFecha(perfil?.fecha_nacimiento)}</div>
                        }
                      </div>

                      {/* Rol */}
                      <div className="col-12 col-md-6">
                        <div className="mp-field-label"><FaIdBadge style={{ marginRight: 5 }} />Rol / Cargo</div>
                        <div className="mp-field-value" style={{ color: MUTED }}>
                          {perfil?.rol || user?.rol || "—"}
                          <span style={{ marginLeft: 8, fontSize: ".72rem", color: MUTED }}>(asignado por admin)</span>
                        </div>
                      </div>

                    </div>

                    {editando && (
                      <div className="d-flex gap-2 justify-content-end mt-4">
                        <button type="button" className="mp-btn-outline" onClick={() => setEditando(false)}>
                          <FaTimes /> Cancelar
                        </button>
                        <button type="submit" className="mp-btn-primary" disabled={guardando}>
                          <FaSave /> {guardando ? "Guardando…" : "Guardar cambios"}
                        </button>
                      </div>
                    )}
                  </form>
                </div>
              )}

              {/* ─────────────────────────── TAB: SEGURIDAD ── */}
              {tab === "seguridad" && (
                <div className="mp-card" style={{ maxWidth: 480 }}>
                  <h6 style={{ fontWeight: 700, color: DARK, marginBottom: "1.2rem" }}>
                    <FaLock style={{ marginRight: 8, color: ACCENT }} />
                    Cambiar contraseña
                  </h6>

                  <form onSubmit={handleCambiarPass}>
                    {/* Contraseña nueva */}
                    <div className="mb-3">
                      <div className="mp-field-label">Nueva contraseña</div>
                      <div className="mp-pass-wrap">
                        <input
                          className="mp-input"
                          type={showPass.nueva ? "text" : "password"}
                          value={passForm.nueva}
                          onChange={(e) => setPassForm({ ...passForm, nueva: e.target.value })}
                          placeholder="Mínimo 6 caracteres"
                          required
                          autoComplete="new-password"
                          style={{ paddingRight: 36 }}
                        />
                        <button type="button" className="mp-pass-eye"
                          onClick={() => setShowPass({ ...showPass, nueva: !showPass.nueva })}>
                          {showPass.nueva ? <FaEyeSlash /> : <FaEye />}
                        </button>
                      </div>
                    </div>

                    {/* Confirmar contraseña */}
                    <div className="mb-4">
                      <div className="mp-field-label">Confirmar nueva contraseña</div>
                      <div className="mp-pass-wrap">
                        <input
                          className="mp-input"
                          type={showPass.confirmar ? "text" : "password"}
                          value={passForm.confirmar}
                          onChange={(e) => setPassForm({ ...passForm, confirmar: e.target.value })}
                          placeholder="Repite la contraseña"
                          required
                          autoComplete="new-password"
                          style={{ paddingRight: 36 }}
                        />
                        <button type="button" className="mp-pass-eye"
                          onClick={() => setShowPass({ ...showPass, confirmar: !showPass.confirmar })}>
                          {showPass.confirmar ? <FaEyeSlash /> : <FaEye />}
                        </button>
                      </div>
                      {passForm.nueva && passForm.confirmar && passForm.nueva !== passForm.confirmar && (
                        <p style={{ color: "#dc2626", fontSize: ".78rem", marginTop: ".3rem" }}>
                          Las contraseñas no coinciden
                        </p>
                      )}
                    </div>

                    <button type="submit" className="mp-btn-danger" disabled={cambiandoPass}>
                      <FaLock /> {cambiandoPass ? "Cambiando…" : "Cambiar contraseña"}
                    </button>
                  </form>

                  <hr className="mp-sep" />

                  {/* Info de sesión */}
                  <div>
                    <div className="mp-field-label mb-2">Información de cuenta</div>
                    <div className="d-flex flex-column gap-2">
                      <div style={{ fontSize: ".85rem", color: DARK }}>
                        <span style={{ color: MUTED, marginRight: 6 }}>Estado:</span>
                        {estadoBadge(perfil?.estado || "activo")}
                      </div>
                      <div style={{ fontSize: ".85rem", color: DARK }}>
                        <span style={{ color: MUTED, marginRight: 6 }}>Fecha de registro:</span>
                        {fmtFecha(perfil?.fecha_registro)}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ────────────────────────── TAB: ACTIVIDAD ── */}
              {tab === "actividad" && (
                <div className="mp-card">
                  <h6 style={{ fontWeight: 700, color: DARK, marginBottom: "1.2rem" }}>
                    <FaHistory style={{ marginRight: 8, color: ACCENT }} />
                    Actividad reciente
                  </h6>

                  {bitacora.length === 0 ? (
                    <div className="text-center py-4" style={{ color: MUTED, fontSize: ".9rem" }}>
                      No hay actividad registrada aún.
                    </div>
                  ) : (
                    <div className="d-flex flex-column gap-1">
                      {bitacora.map((log, i) => (
                        <div key={i} className="mp-log-row">
                          <div className="mp-log-dot" />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: ".88rem", fontWeight: 600, color: DARK }}>
                              {log.accion || log.tipo || "Acción"}
                            </div>
                            {log.detalle && (
                              <div style={{ fontSize: ".78rem", color: MUTED, marginTop: ".1rem",
                                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {log.detalle}
                              </div>
                            )}
                          </div>
                          <div style={{ fontSize: ".75rem", color: MUTED, whiteSpace: "nowrap", flexShrink: 0 }}>
                            {log.fecha
                              ? new Date(log.fecha).toLocaleString("es-HN", {
                                  day: "2-digit", month: "short",
                                  hour: "2-digit", minute: "2-digit",
                                })
                              : "—"}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

        </div>
      </div>
    </>
  );
}
