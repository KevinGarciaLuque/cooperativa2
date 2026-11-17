// Detecta cuando se publicó una versión nueva de la app mientras la pestaña seguía abierta
// (por ejemplo, en el celular). Al cambiar de pantalla se recarga sola; mientras tanto
// muestra un aviso con el botón "Actualizar".
import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

/* global __VERSION__ */
const VERSION_ACTUAL = typeof __VERSION__ === "string" ? __VERSION__ : "dev";
const CADA = 5 * 60 * 1000;

const hayVersionNueva = async () => {
  if (!import.meta.env.PROD) return false;
  try {
    const r = await fetch(`/version.json?t=${Date.now()}`, { cache: "no-store" });
    if (!r.ok) return false;
    const { version } = await r.json();
    return !!version && version !== VERSION_ACTUAL;
  } catch {
    return false;
  }
};

export default function AvisoVersion() {
  const location = useLocation();
  const [nueva, setNueva] = useState(false);
  const primera = useRef(true);

  // Al volver a la pestaña, al enfocar la ventana y cada pocos minutos
  useEffect(() => {
    const revisar = async () => {
      if (await hayVersionNueva()) setNueva(true);
    };
    const alVolver = () => document.visibilityState === "visible" && revisar();
    revisar();
    document.addEventListener("visibilitychange", alVolver);
    window.addEventListener("focus", revisar);
    const id = setInterval(revisar, CADA);
    return () => {
      document.removeEventListener("visibilitychange", alVolver);
      window.removeEventListener("focus", revisar);
      clearInterval(id);
    };
  }, []);

  // Al cambiar de pantalla (incluido el inicio de sesión) se carga la versión nueva
  useEffect(() => {
    if (primera.current) {
      primera.current = false;
      return;
    }
    let activo = true;
    hayVersionNueva().then((n) => {
      if (activo && n) window.location.reload();
    });
    return () => {
      activo = false;
    };
  }, [location.pathname]);

  if (!nueva) return null;
  return (
    <div
      role="status"
      className="d-flex align-items-center gap-3"
      style={{
        // Centrado con ancho propio: con left 50% + translate se encogía a la mitad de la pantalla
        position: "fixed",
        left: 0,
        right: 0,
        bottom: "calc(16px + env(safe-area-inset-bottom))",
        margin: "0 auto",
        width: "min(520px, calc(100% - 32px))",
        zIndex: 9000,
        background: "#1a2035",
        color: "#fff",
        border: "2px solid #a8cd3a",
        borderRadius: 14,
        padding: "12px 14px 12px 18px",
        boxShadow: "0 10px 30px rgba(0,0,0,.35), 0 0 0 4px rgba(168,205,58,.15)",
      }}
    >
      <span style={{ flex: 1, fontSize: ".95rem", lineHeight: 1.35 }}>Hay una versión nueva de la aplicación.</span>
      <button
        className="btn fw-semibold text-nowrap"
        style={{ background: "#a8cd3a", color: "#1a2a00", borderRadius: 10, padding: "8px 16px" }}
        onClick={() => window.location.reload()}
      >
        Actualizar
      </button>
    </div>
  );
}
