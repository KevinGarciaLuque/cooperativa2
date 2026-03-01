import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import { FaIdCard, FaLock, FaEye, FaEyeSlash } from "react-icons/fa";
import LogoCoop from "../components/LogoCoop";

const ACCENT = "#a8cd3a";
const DARK = "#1a2035";
const DARK2 = "#222d45";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [dni, setDni] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const ok = await login(dni, password);
    setLoading(false);
    if (ok) {
      const storedUser = JSON.parse(localStorage.getItem("user"));
      if (storedUser?.rol === "Socio") {
        navigate("/perfil");
      } else {
        navigate("/dashboard");
      }
    } else {
      setError("DNI o contraseña incorrectos");
    }
  };

  return (
    <div
      className="min-vh-100 d-flex"
      style={{ background: DARK, overflow: "hidden", position: "relative" }}
    >
      <style>{`
        /* Fondo animado con partículas de luz */
        .login-bg {
          position: absolute;
          inset: 0;
          overflow: hidden;
          z-index: 0;
        }
        .login-bg::before {
          content: '';
          position: absolute;
          width: 600px;
          height: 600px;
          border-radius: 50%;
          background: radial-gradient(circle, ${ACCENT}18 0%, transparent 70%);
          top: -200px;
          right: -150px;
          animation: pulseGlow 8s ease-in-out infinite alternate;
        }
        .login-bg::after {
          content: '';
          position: absolute;
          width: 500px;
          height: 500px;
          border-radius: 50%;
          background: radial-gradient(circle, #3b82f618 0%, transparent 70%);
          bottom: -180px;
          left: -120px;
          animation: pulseGlow 10s ease-in-out infinite alternate-reverse;
        }
        @keyframes pulseGlow {
          from { transform: scale(1); opacity: 0.6; }
          to   { transform: scale(1.15); opacity: 1; }
        }
        /* Panel izquierdo */
        .login-left {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 60px 48px;
          position: relative;
          z-index: 1;
        }
        .login-left-inner {
          max-width: 420px;
          width: 100%;
        }
        .login-tagline {
          font-size: 2.4rem;
          font-weight: 800;
          color: #fff;
          line-height: 1.2;
          letter-spacing: -0.5px;
        }
        .login-tagline span {
          color: ${ACCENT};
        }
        .login-subtitle {
          color: rgba(255,255,255,0.45);
          font-size: 0.92rem;
          margin-top: 12px;
          line-height: 1.7;
        }
        .login-divider {
          width: 48px;
          height: 3px;
          background: linear-gradient(90deg, ${ACCENT}, transparent);
          border-radius: 2px;
          margin: 20px 0;
        }
        .login-feature {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 0;
          color: rgba(255,255,255,0.6);
          font-size: 0.86rem;
        }
        .login-feature-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: ${ACCENT};
          box-shadow: 0 0 8px ${ACCENT};
          flex-shrink: 0;
        }
        /* Panel derecho (formulario) */
        .login-right {
          width: 420px;
          min-width: 340px;
          background: rgba(255,255,255,0.04);
          backdrop-filter: blur(20px);
          border-left: 1px solid rgba(255,255,255,0.07);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 48px 36px;
          position: relative;
          z-index: 1;
        }
        .login-card {
          width: 100%;
          max-width: 360px;
        }

        .login-title {
          font-size: 1.45rem;
          font-weight: 700;
          color: #fff;
          margin-top: 16px;
          margin-bottom: 4px;
        }
        .login-desc {
          color: rgba(255,255,255,0.4);
          font-size: 0.82rem;
          margin-bottom: 28px;
        }
        /* Inputs */
        .login-field {
          margin-bottom: 18px;
        }
        .login-field label {
          display: block;
          font-size: 0.78rem;
          font-weight: 600;
          letter-spacing: 0.6px;
          text-transform: uppercase;
          color: rgba(255,255,255,0.55);
          margin-bottom: 7px;
        }
        .login-input-wrap {
          position: relative;
          display: flex;
          align-items: center;
        }
        .login-input-icon {
          position: absolute;
          left: 14px;
          color: rgba(255,255,255,0.3);
          font-size: 0.9rem;
          pointer-events: none;
          transition: color 0.2s;
        }
        .login-input {
          width: 100%;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 10px;
          padding: 11px 14px 11px 40px;
          color: #fff;
          font-size: 0.9rem;
          outline: none;
          transition: border-color 0.2s, background 0.2s, box-shadow 0.2s;
        }
        .login-input::placeholder { color: rgba(255,255,255,0.2); }
        .login-input:focus {
          border-color: ${ACCENT}88;
          background: rgba(255,255,255,0.09);
          box-shadow: 0 0 0 3px ${ACCENT}18;
        }
        .login-input:focus + .login-input-icon,
        .login-input-wrap:focus-within .login-input-icon {
          color: ${ACCENT};
        }
        .login-pass-toggle {
          position: absolute;
          right: 12px;
          background: none;
          border: none;
          color: rgba(255,255,255,0.3);
          cursor: pointer;
          padding: 4px;
          display: flex;
          align-items: center;
          transition: color 0.2s;
          font-size: 0.88rem;
        }
        .login-pass-toggle:hover { color: ${ACCENT}; }
        /* Error */
        .login-error {
          background: rgba(255,107,107,0.12);
          border: 1px solid rgba(255,107,107,0.3);
          color: #ff8c8c;
          border-radius: 9px;
          padding: 9px 14px;
          font-size: 0.82rem;
          margin-bottom: 16px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        /* Botón submit */
        .login-btn {
          width: 100%;
          padding: 12px;
          border-radius: 10px;
          border: none;
          background: linear-gradient(135deg, ${ACCENT} 0%, #7fa020 100%);
          color: #1a2035;
          font-weight: 700;
          font-size: 0.93rem;
          letter-spacing: 0.3px;
          cursor: pointer;
          transition: opacity 0.2s, transform 0.15s, box-shadow 0.2s;
          box-shadow: 0 4px 18px ${ACCENT}44;
          margin-top: 4px;
        }
        .login-btn:hover:not(:disabled) {
          opacity: 0.92;
          transform: translateY(-1px);
          box-shadow: 0 8px 26px ${ACCENT}55;
        }
        .login-btn:active:not(:disabled) {
          transform: translateY(0);
        }
        .login-btn:disabled {
          opacity: 0.65;
          cursor: not-allowed;
        }
        .login-link {
          color: ${ACCENT};
          text-decoration: none;
          font-size: 0.82rem;
          font-weight: 500;
          transition: opacity 0.2s;
        }
        .login-link:hover { opacity: 0.75; }
        /* Spinner */
        .login-spinner {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(26,32,53,0.4);
          border-top-color: #1a2035;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
          display: inline-block;
          vertical-align: middle;
          margin-right: 8px;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        /* Logo móvil */
        .login-logo-mobile {
          display: none;
          position: relative;
          align-items: center;
          justify-content: center;
          width: 100%;
          margin-bottom: 24px;
        }
        .login-home-btn {
          position: absolute;
          right: 0;
          top: -28px;
          color: #a8cd3a;
          font-size: 0.82rem;
          font-weight: 500;
          text-decoration: none;
          transition: color 0.2s;
        }
        .login-home-btn:hover { color: #c8f050; }
        .login-home-desktop {
          position: absolute;
          top: 36px;
          right: 24px;
          color: #a8cd3a;
          font-size: 0.82rem;
          font-weight: 500;
          text-decoration: none;
          transition: color 0.2s;
        }
        .login-home-desktop:hover { color: #c8f050; }
        /* Responsive: apila en móvil */
        @media (max-width: 768px) {
          .login-home-desktop { display: none; }
          .login-left { display: none !important; }
          .login-right {
            width: 100%;
            min-width: 0;
            border-left: none;
            background: transparent;
            backdrop-filter: none;
          }
          .login-logo-mobile {
            display: flex;
          }
        }
      `}</style>

      {/* Fondo decorativo */}
      <div className="login-bg" />

      {/* Panel izquierdo — branding */}
      <div className="login-left">
        <div className="login-left-inner">
          <LogoCoop size={260} withText />
          <div className="login-tagline mt-3">
            Tu Cooperativa,<br />
            <span>siempre contigo.</span>
          </div>
          <div className="login-divider" />
          <p className="login-subtitle">
            Gestiona tus aportaciones, préstamos y cuentas desde un solo lugar, de forma segura y eficiente.
          </p>
          <div className="mt-4">
            {[
              "Control total de tus finanzas",
              "Acceso seguro 24/7",
              "Reportes en tiempo real",
              "Gestión de socios y roles",
            ].map((f) => (
              <div className="login-feature" key={f}>
                <div className="login-feature-dot" />
                {f}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Panel derecho — formulario */}
      <div className="login-right">
        <Link to="/" className="login-home-desktop">← Inicio</Link>
        <div className="login-card">
          {/* Logo solo visible en móvil/tablet */}
          <div className="login-logo-mobile">
            <LogoCoop size={120} />
            <Link to="/" className="login-home-btn">← Inicio</Link>
          </div>

          <div className="login-title">Bienvenido</div>
          <div className="login-desc">Ingresa tus credenciales para continuar</div>

          <form onSubmit={handleSubmit} autoComplete="off">
            {/* DNI */}
            <div className="login-field">
              <label>DNI</label>
              <div className="login-input-wrap">
                <FaIdCard className="login-input-icon" />
                <input
                  type="text"
                  className="login-input"
                  value={dni}
                  onChange={(e) => setDni(e.target.value)}
                  required
                  autoFocus
                  placeholder="Ingresa tu DNI"
                />
              </div>
            </div>

            {/* Contraseña */}
            <div className="login-field">
              <label>Contraseña</label>
              <div className="login-input-wrap">
                <FaLock className="login-input-icon" />
                <input
                  type={showPass ? "text" : "password"}
                  className="login-input"
                  style={{ paddingRight: 38 }}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="Tu contraseña"
                />
                <button
                  type="button"
                  className="login-pass-toggle"
                  onClick={() => setShowPass((v) => !v)}
                  tabIndex={-1}
                  aria-label={showPass ? "Ocultar" : "Mostrar"}
                >
                  {showPass ? <FaEyeSlash /> : <FaEye />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="login-error">
                <span style={{ fontSize: "1rem" }}>⚠</span>
                {error}
              </div>
            )}

            {/* Botón */}
            <button type="submit" className="login-btn" disabled={loading}>
              {loading && <span className="login-spinner" />}
              {loading ? "Verificando..." : "Iniciar sesión"}
            </button>

            {/* Link recuperar */}
            <div className="text-center mt-4">
              <Link to="/recuperar" className="login-link">
                ¿Olvidaste tu contraseña?
              </Link>
            </div>
          </form>

          {/* Créditos */}
          <div className="text-center mt-4" style={{ color: "rgba(255,255,255,0.2)", fontSize: "0.75rem" }}>
            © {new Date().getFullYear()} · Desarrollado por{" "}
            <span style={{ color: ACCENT, fontWeight: 600 }}>Kevin Garcia</span>
          </div>
        </div>
      </div>
    </div>
  );
}
