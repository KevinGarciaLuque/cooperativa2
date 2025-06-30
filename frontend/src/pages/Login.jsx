import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import { FaIdCard, FaLock } from "react-icons/fa";

export default function Login() {
  const azul = "#434d57"; // Azul grisáceo oscuro
  const verde = "#a8cd3a"; // Verde lima
  const beige = "#f9f7ef"; // Fondo claro

  const { login } = useAuth();
  const navigate = useNavigate();
  const [dni, setDni] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    const ok = await login(dni, password);
    if (ok) {
      navigate("/dashboard");
    } else {
      setError("DNI o contraseña incorrectos");
    }
  };

  return (
    <div
      className="position-relative min-vh-100 d-flex align-items-center justify-content-center"
      style={{
        background: beige,
        overflow: "hidden",
      }}
    >
      {/* Imagen de fondo con opacidad */}
      <img
        src="/bg-login.jpg"
        alt="Fondo"
        className="position-absolute top-0 start-0 w-100 h-100"
        style={{
          objectFit: "cover",
          opacity: 0.18,
          zIndex: 0,
          pointerEvents: "none",
        }}
      />
      {/* Overlay */}
      <div
        className="position-absolute top-0 start-0 w-100 h-100"
        style={{
          background: `linear-gradient(120deg, #434d57 30%, #a8cd3a 100%)`,
          opacity: 0.1,
          zIndex: 1,
        }}
      />

      {/* Card de login */}
      <div
        className="card shadow border-0"
        style={{
          maxWidth: 400,
          width: "100%",
          zIndex: 2,
          background: "rgba(255,255,255,0.96)",
          borderRadius: 18,
        }}
      >
        <div className="card-body px-4 py-4">
          <div className="text-center mb-3">
            <img
              src="/logo-cooperativa.jpg"
              alt="Logo"
              style={{
                maxWidth: 95,
                borderRadius: 10,
                marginBottom: 10,
                boxShadow: `0 4px 16px ${verde}30`,
                border: `2px solid ${verde}`,
                background: "#fff",
              }}
            />
          </div>
          <h4 className="mb-3 text-center fw-bold" style={{ color: azul }}>
            Iniciar sesión
          </h4>
          <form onSubmit={handleSubmit} autoComplete="off">
            <div className="mb-3">
              <label className="form-label fw-semibold" style={{ color: azul }}>
                DNI
              </label>
              <div className="input-group">
                <span className="input-group-text bg-light">
                  <FaIdCard color={verde} />
                </span>
                <input
                  type="text"
                  className="form-control"
                  value={dni}
                  onChange={(e) => setDni(e.target.value)}
                  required
                  autoFocus
                  placeholder="Ingresa tu DNI"
                />
              </div>
            </div>
            <div className="mb-3">
              <label className="form-label fw-semibold" style={{ color: azul }}>
                Contraseña
              </label>
              <div className="input-group">
                <span className="input-group-text bg-light">
                  <FaLock color={verde} />
                </span>
                <input
                  type="password"
                  className="form-control"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="Tu contraseña"
                />
              </div>
            </div>
            {error && <div className="alert alert-danger py-1">{error}</div>}
            <button
              type="submit"
              className="btn w-100 fw-bold"
              style={{
                background: azul,
                color: "#fff",
                border: `2px solid ${verde}`,
                borderRadius: 25,
                fontSize: "1.1rem",
              }}
            >
              Entrar
            </button>
            <div className="text-end mt-3">
              <Link
                to="/recuperar"
                style={{
                  color: verde,
                  textDecoration: "underline",
                  fontWeight: 500,
                  fontSize: "0.99rem",
                }}
              >
                ¿Olvidaste tu contraseña?
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
