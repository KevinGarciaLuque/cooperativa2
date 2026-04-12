import { useState, useEffect } from "react";
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const DEFAULTS = {
  site_name:      "Smart Coop",
  home_badge:     "Plataforma cooperativa digital",
  home_title1:    "Tu cooperativa,",
  home_title2:    "siempre contigo.",
  home_subtitle:  "Gestiona tus aportaciones, préstamos y cuentas desde un solo lugar, de forma segura, rápida y eficiente.",
  home_cta:       "Comenzar ahora",
  home_footer:    `Smart Coop © ${new Date().getFullYear()} — Ahorro y crédito, desde cualquier lugar.`,
  home_features: [
    { icon: "💰", title: "Aportaciones", desc: "Registra y consulta tus aportaciones en tiempo real." },
    { icon: "🏦", title: "Préstamos",    desc: "Solicita y gestiona préstamos de forma rápida y segura." },
    { icon: "📊", title: "Reportes",     desc: "Accede a reportes financieros detallados y actualizados." },
    { icon: "🔐", title: "Seguridad",    desc: "Tu información protegida con acceso seguro las 24 horas." },
  ],
  login_tagline1:  "Tu Cooperativa,",
  login_tagline2:  "siempre contigo.",
  login_subtitle:  "Gestiona tus aportaciones, préstamos y cuentas desde un solo lugar, de forma segura y eficiente.",
  login_features: [
    "Control total de tus finanzas",
    "Acceso seguro 24/7",
    "Reportes en tiempo real",
    "Gestión de socios y roles",
  ],
  logo_url: "",
};

export function useConfigSitio() {
  const [config, setConfig] = useState(DEFAULTS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    axios.get(`${API_URL}/configuracion`)
      .then(({ data }) => {
        if (!cancelled && data?.data) {
          // Reemplazar {year} en footer
          const merged = { ...DEFAULTS, ...data.data };
          if (typeof merged.home_footer === "string") {
            merged.home_footer = merged.home_footer.replace("{year}", new Date().getFullYear());
          }
          setConfig(merged);
        }
      })
      .catch(() => { /* mantener defaults */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return { config, loading };
}
