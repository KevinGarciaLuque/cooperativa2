import React from "react";

export default function Home() {
  // Paleta del logo:
  const azul = "#434d57"; // Azul grisáceo oscuro (texto, botones)
  const verde = "#a8cd3a"; // Verde lima (acentos)
  const gris = "#818181"; // Gris suave (textos secundarios)
  const beige = "#f9f7ef"; // Fondo principal

  return (
    <div
      className="container-fluid min-vh-100 d-flex flex-column justify-content-center align-items-center"
      style={{ background: beige, minHeight: "100vh" }}
    >
      <div
        className="text-center px-3 py-4"
        style={{
          background: "#fff",
          borderRadius: 24,
          boxShadow: "0 8px 40px rgba(67,77,87,0.11)",
        }}
      >
        <img
          src="/logo-cooperativa.jpg"
          alt="Logo Cooperativa Visión Futuro"
          className="img-fluid mb-3"
          style={{
            maxWidth: 330,
            width: "90vw",
            borderRadius: 14,
            border: `4px solid ${verde}`,
            background: "#fff",
          }}
        />
        <h1
          className="fw-bold mb-3"
          style={{
            color: azul,
            fontSize: "2.1rem",
            letterSpacing: "1px",
            lineHeight: 1.1,
          }}
        >
          ¡Una nueva experiencia de ahorro!
        </h1>
        <p className="lead" style={{ color: gris, fontWeight: 600 }}>
          Bienvenido a{" "}
          <span style={{ color: verde, fontWeight: 700 }}>
            Cooperativa Visión Futuro
          </span>
        </p>
        <p
          className="mb-4"
          style={{
            color: azul,
            fontWeight: 500,
            fontSize: "1.08rem",
            opacity: 0.83,
          }}
        >
          Cooperativa de ahorro y crédito, ahora desde cualquier lugar.
        </p>
        <a
          href="/login"
          className="btn btn-lg px-5 py-2 shadow-sm"
          style={{
            background: azul,
            color: "#fff",
            fontWeight: 700,
            border: `2px solid ${verde}`,
            borderRadius: "25px",
            transition: "all 0.18s",
          }}
        >
          Iniciar sesión
        </a>
      </div>
    </div>
  );
}
