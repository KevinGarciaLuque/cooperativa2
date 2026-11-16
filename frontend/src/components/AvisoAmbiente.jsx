// Aviso fijo en todas las pantallas del ambiente de pruebas, para que nadie lo confunda con
// el sistema real (y la pestaña del navegador también lo dice).
import { useEffect } from "react";
import { esAmbientePruebas } from "../utils/arranque";

export default function AvisoAmbiente() {
  const pruebas = esAmbientePruebas();

  useEffect(() => {
    if (!pruebas) return undefined;
    const marcar = () => {
      if (!document.title.startsWith("[PRUEBAS]")) document.title = `[PRUEBAS] ${document.title}`;
    };
    marcar();
    const observador = new MutationObserver(marcar);
    const titulo = document.querySelector("title");
    if (titulo) observador.observe(titulo, { childList: true });
    return () => observador.disconnect();
  }, [pruebas]);

  if (!pruebas) return null;
  return (
    <div
      role="status"
      style={{
        position: "fixed",
        left: 12,
        bottom: 12,
        zIndex: 2000,
        background: "#f59e0b",
        color: "#1f1300",
        fontWeight: 800,
        fontSize: 12,
        letterSpacing: ".5px",
        padding: "6px 12px",
        borderRadius: 999,
        boxShadow: "0 4px 14px rgba(0,0,0,.25)",
        pointerEvents: "none",
      }}
    >
      AMBIENTE DE PRUEBAS · no es el sistema real
    </div>
  );
}
