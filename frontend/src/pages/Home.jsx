import React from "react";
import LogoCoop from "../components/LogoCoop";

const ACCENT = "#a8cd3a";
const DARK  = "#1a2035";
const DARK2 = "#222d45";
const MUTED = "rgba(255,255,255,0.45)";

const features = [
  {
    icon: "💰",
    title: "Aportaciones",
    desc: "Registra y consulta tus aportaciones en tiempo real.",
  },
  {
    icon: "🏦",
    title: "Préstamos",
    desc: "Solicita y gestiona préstamos de forma rápida y segura.",
  },
  {
    icon: "📊",
    title: "Reportes",
    desc: "Accede a reportes financieros detallados y actualizados.",
  },
  {
    icon: "🔐",
    title: "Seguridad",
    desc: "Tu información protegida con acceso seguro las 24 horas.",
  },
];

export default function Home() {
  return (
    <div style={{ background: DARK, minHeight: "100vh", position: "relative", overflow: "hidden" }}>
      <style>{`
        /* Orbes de fondo */
        .home-orb1 {
          position: fixed;
          width: 700px; height: 700px;
          border-radius: 50%;
          background: radial-gradient(circle, ${ACCENT}14 0%, transparent 65%);
          top: -260px; right: -200px;
          pointer-events: none;
          animation: homeOrb 10s ease-in-out infinite alternate;
        }
        .home-orb2 {
          position: fixed;
          width: 500px; height: 500px;
          border-radius: 50%;
          background: radial-gradient(circle, #3b82f614 0%, transparent 65%);
          bottom: -180px; left: -150px;
          pointer-events: none;
          animation: homeOrb 13s ease-in-out infinite alternate-reverse;
        }
        @keyframes homeOrb {
          from { transform: scale(1); opacity: .7; }
          to   { transform: scale(1.15); opacity: 1; }
        }

        /* Navbar home */
        .home-nav {
          position: fixed; top: 0; left: 0; right: 0;
          height: 64px;
          display: flex; align-items: center; justify-content: space-between;
          padding: 0 40px;
          background: rgba(26,32,53,0.82);
          backdrop-filter: blur(14px);
          border-bottom: 1px solid rgba(255,255,255,0.06);
          z-index: 100;
        }
        .home-nav-btn {
          background: ${ACCENT};
          color: ${DARK};
          font-weight: 700;
          font-size: 0.88rem;
          border: none;
          border-radius: 10px;
          padding: 9px 24px;
          cursor: pointer;
          text-decoration: none;
          transition: opacity .2s, transform .15s, box-shadow .2s;
          box-shadow: 0 4px 16px ${ACCENT}44;
        }
        .home-nav-btn:hover {
          opacity: .88;
          transform: translateY(-1px);
          box-shadow: 0 8px 24px ${ACCENT}55;
        }

        /* Hero */
        .home-hero {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 80px 24px 60px;
          position: relative; z-index: 1;
        }
        .home-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: ${ACCENT}18;
          border: 1px solid ${ACCENT}44;
          border-radius: 50px;
          padding: 6px 18px;
          font-size: 0.78rem;
          font-weight: 600;
          color: ${ACCENT};
          letter-spacing: .5px;
          margin-bottom: 28px;
        }
        .home-badge-dot {
          width: 7px; height: 7px;
          border-radius: 50%;
          background: ${ACCENT};
          box-shadow: 0 0 6px ${ACCENT};
        }
        .home-title {
          font-size: clamp(2.2rem, 5vw, 3.8rem);
          font-weight: 900;
          color: #fff;
          line-height: 1.12;
          letter-spacing: -1px;
          margin-bottom: 20px;
        }
        .home-title span { color: ${ACCENT}; }
        .home-subtitle {
          font-size: clamp(0.92rem, 2vw, 1.08rem);
          color: ${MUTED};
          max-width: 520px;
          line-height: 1.75;
          margin-bottom: 40px;
        }
        .home-cta {
          display: inline-flex; align-items: center; gap: 10px;
          background: linear-gradient(135deg, ${ACCENT} 0%, #7fa020 100%);
          color: ${DARK};
          font-weight: 800;
          font-size: 1rem;
          border: none;
          border-radius: 14px;
          padding: 14px 40px;
          cursor: pointer;
          text-decoration: none;
          transition: opacity .2s, transform .15s, box-shadow .2s;
          box-shadow: 0 6px 24px ${ACCENT}44;
          letter-spacing: .2px;
        }
        .home-cta:hover {
          opacity: .9;
          transform: translateY(-2px);
          box-shadow: 0 12px 32px ${ACCENT}55;
          color: ${DARK};
        }
        .home-cta-arrow {
          font-size: 1.1rem;
          transition: transform .2s;
        }
        .home-cta:hover .home-cta-arrow { transform: translateX(4px); }

        /* Divisor decorativo */
        .home-divider {
          display: flex; align-items: center; gap: 16px;
          margin: 60px auto 0;
          max-width: 380px;
          color: rgba(255,255,255,0.18);
          font-size: 0.78rem;
          letter-spacing: 1px;
          text-transform: uppercase;
        }
        .home-divider::before, .home-divider::after {
          content: '';
          flex: 1;
          height: 1px;
          background: rgba(255,255,255,0.1);
        }

        /* Features */
        .home-features {
          position: relative; z-index: 1;
          padding: 0 24px 80px;
          max-width: 960px;
          margin: 0 auto;
        }
        .home-features-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 20px;
        }
        .home-feature-card {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 18px;
          padding: 28px 22px;
          text-align: center;
          transition: background .2s, transform .2s, border-color .2s;
        }
        .home-feature-card:hover {
          background: rgba(255,255,255,0.07);
          border-color: ${ACCENT}44;
          transform: translateY(-4px);
        }
        .home-feature-icon {
          font-size: 2rem;
          margin-bottom: 14px;
          display: block;
        }
        .home-feature-title {
          font-size: 0.98rem;
          font-weight: 700;
          color: #fff;
          margin-bottom: 8px;
        }
        .home-feature-desc {
          font-size: 0.81rem;
          color: ${MUTED};
          line-height: 1.65;
        }

        /* Footer */
        .home-footer {
          position: relative; z-index: 1;
          text-align: center;
          padding: 24px;
          border-top: 1px solid rgba(255,255,255,0.06);
          color: rgba(255,255,255,0.2);
          font-size: 0.78rem;
        }

        @media (max-width: 576px) {
          .home-nav { padding: 0 20px; }
          .home-features-grid { grid-template-columns: 1fr 1fr; gap: 14px; }
        }
      `}</style>

      {/* Orbes */}
      <div className="home-orb1" />
      <div className="home-orb2" />

      {/* Navbar fija */}
      <nav className="home-nav">
        <LogoCoop size={44} />
        <a href="/login" className="home-nav-btn">Iniciar sesión</a>
      </nav>

      {/* Hero */}
      <section className="home-hero">
        <div className="home-badge">
          <div className="home-badge-dot" />
          Plataforma cooperativa digital
        </div>

        <div style={{ marginBottom: 0 }}>
          <LogoCoop size={210} />
        </div>

        <h1 className="home-title ">
          Tu cooperativa,<br />
          <span>siempre contigo.</span>
        </h1>
        <p className="home-subtitle">
          Gestiona tus aportaciones, préstamos y cuentas desde un solo lugar, de forma segura, rápida y eficiente.
        </p>

        <a href="/login" className="home-cta">
          Comenzar ahora
          <span className="home-cta-arrow">→</span>
        </a>

        <div className="home-divider">Características</div>
      </section>

      {/* Feature cards */}
      <section className="home-features">
        <div className="home-features-grid">
          {features.map(({ icon, title, desc }) => (
            <div className="home-feature-card" key={title}>
              <span className="home-feature-icon">{icon}</span>
              <div className="home-feature-title">{title}</div>
              <div className="home-feature-desc">{desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="home-footer">
        Smart Coop &copy; {new Date().getFullYear()} &mdash; Ahorro y crédito, desde cualquier lugar.
      </footer>
    </div>
  );
}
