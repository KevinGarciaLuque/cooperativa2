import { useState } from "react";
import { Link } from "react-router-dom";
import { FaEnvelope, FaArrowLeft, FaCheckCircle } from "react-icons/fa";
import axios from "axios";

const ACCENT = "#a8cd3a";
const DARK = "#1a2035";
const DARK2 = "#222d45";

export default function Recuperar() {
  const [correo, setCorreo] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg("");
    setError("");
    setLoading(true);
    try {
      const res = await axios.post(`${API_URL}/recuperar`, { correo });
      setMsg(res.data.message);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Error al enviar el correo. Intenta de nuevo."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-vh-100 d-flex align-items-center justify-content-center"
      style={{ background: DARK, position: "relative", overflow: "hidden" }}
    >
      <style>{`
        .rec-bg::before {
          content: '';
          position: absolute;
          width: 500px;
          height: 500px;
          border-radius: 50%;
          background: radial-gradient(circle, ${ACCENT}14 0%, transparent 70%);
          top: -180px;
          right: -120px;
          animation: recPulse 9s ease-in-out infinite alternate;
        }
        .rec-bg::after {
          content: '';
          position: absolute;
          width: 400px;
          height: 400px;
          border-radius: 50%;
          background: radial-gradient(circle, #3b82f614 0%, transparent 70%);
          bottom: -150px;
          left: -100px;
          animation: recPulse 11s ease-in-out infinite alternate-reverse;
        }
        @keyframes recPulse {
          from { transform: scale(1); opacity: 0.5; }
          to   { transform: scale(1.2); opacity: 1; }
        }
        .rec-card {
          width: 100%;
          max-width: 400px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 20px;
          backdrop-filter: blur(20px);
          padding: 42px 40px;
          position: relative;
          z-index: 1;
          box-shadow: 0 24px 64px rgba(0,0,0,0.4);
        }
        .rec-icon-wrap {
          width: 58px;
          height: 58px;
          border-radius: 14px;
          background: linear-gradient(135deg, ${ACCENT}22 0%, ${ACCENT}10 100%);
          border: 1px solid ${ACCENT}44;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 20px;
        }
        .rec-title {
          font-size: 1.4rem;
          font-weight: 700;
          color: #fff;
          margin-bottom: 6px;
        }
        .rec-desc {
          color: rgba(255,255,255,0.4);
          font-size: 0.84rem;
          line-height: 1.6;
          margin-bottom: 28px;
        }
        .rec-field label {
          display: block;
          font-size: 0.74rem;
          font-weight: 600;
          letter-spacing: 0.7px;
          text-transform: uppercase;
          color: rgba(255,255,255,0.5);
          margin-bottom: 7px;
        }
        .rec-input-wrap {
          position: relative;
          display: flex;
          align-items: center;
        }
        .rec-input-icon {
          position: absolute;
          left: 14px;
          color: rgba(255,255,255,0.25);
          font-size: 0.88rem;
          pointer-events: none;
          transition: color 0.2s;
        }
        .rec-input {
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
        .rec-input::placeholder { color: rgba(255,255,255,0.18); }
        .rec-input:focus {
          border-color: ${ACCENT}88;
          background: rgba(255,255,255,0.09);
          box-shadow: 0 0 0 3px ${ACCENT}18;
        }
        .rec-input-wrap:focus-within .rec-input-icon { color: ${ACCENT}; }
        .rec-btn {
          width: 100%;
          padding: 12px;
          border-radius: 10px;
          border: none;
          background: linear-gradient(135deg, ${ACCENT} 0%, #7fa020 100%);
          color: #1a2035;
          font-weight: 700;
          font-size: 0.92rem;
          cursor: pointer;
          transition: opacity 0.2s, transform 0.15s, box-shadow 0.2s;
          box-shadow: 0 4px 18px ${ACCENT}44;
          margin-top: 20px;
        }
        .rec-btn:hover:not(:disabled) {
          opacity: 0.9;
          transform: translateY(-1px);
          box-shadow: 0 8px 26px ${ACCENT}55;
        }
        .rec-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .rec-spinner {
          width: 15px;
          height: 15px;
          border: 2px solid rgba(26,32,53,0.35);
          border-top-color: #1a2035;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
          display: inline-block;
          vertical-align: middle;
          margin-right: 8px;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .rec-success {
          background: rgba(168,205,58,0.1);
          border: 1px solid ${ACCENT}44;
          color: ${ACCENT};
          border-radius: 10px;
          padding: 14px 16px;
          font-size: 0.85rem;
          display: flex;
          align-items: flex-start;
          gap: 10px;
          margin-top: 18px;
          line-height: 1.5;
        }
        .rec-error {
          background: rgba(255,107,107,0.1);
          border: 1px solid rgba(255,107,107,0.3);
          color: #ff8c8c;
          border-radius: 10px;
          padding: 10px 14px;
          font-size: 0.83rem;
          margin-top: 14px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .rec-back {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          color: rgba(255,255,255,0.35);
          font-size: 0.82rem;
          text-decoration: none;
          transition: color 0.2s;
          margin-top: 22px;
        }
        .rec-back:hover { color: ${ACCENT}; }
        .rec-divider {
          width: 36px;
          height: 2px;
          background: linear-gradient(90deg, ${ACCENT}, transparent);
          border-radius: 2px;
          margin: 14px 0 20px;
        }
      `}</style>

      {/* Fondo decorativo */}
      <div className="rec-bg" style={{ position: "absolute", inset: 0 }} />

      <div className="rec-card">
        {/* Ícono */}
        <div className="rec-icon-wrap">
          <FaEnvelope style={{ fontSize: "1.4rem", color: ACCENT }} />
        </div>

        <div className="rec-title">¿Olvidaste tu contraseña?</div>
        <div className="rec-divider" />
        <div className="rec-desc">
          Ingresa tu correo electrónico y te enviaremos un enlace para restablecer tu contraseña.
        </div>

        {!msg ? (
          <form onSubmit={handleSubmit} autoComplete="off">
            <div className="rec-field">
              <label>Correo electrónico</label>
              <div className="rec-input-wrap">
                <FaEnvelope className="rec-input-icon" />
                <input
                  type="email"
                  className="rec-input"
                  value={correo}
                  onChange={(e) => setCorreo(e.target.value)}
                  placeholder="tucorreo@ejemplo.com"
                  required
                  autoFocus
                />
              </div>
            </div>

            {error && (
              <div className="rec-error">
                <span>⚠</span> {error}
              </div>
            )}

            <button type="submit" className="rec-btn" disabled={loading}>
              {loading && <span className="rec-spinner" />}
              {loading ? "Enviando..." : "Enviar enlace"}
            </button>
          </form>
        ) : (
          <div className="rec-success">
            <FaCheckCircle style={{ fontSize: "1.1rem", flexShrink: 0, marginTop: 2 }} />
            <span>{msg}</span>
          </div>
        )}

        <div className="text-center">
          <Link to="/login" className="rec-back">
            <FaArrowLeft size={11} /> Volver al inicio de sesión
          </Link>
        </div>
      </div>
    </div>
  );
}
