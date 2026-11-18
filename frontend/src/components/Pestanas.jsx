// Pestañas estándar del sistema: ícono, título, contador opcional y barra verde en la activa.
// Si no caben (celular), se deslizan de lado y la activa se acomoda a la vista.
//
// tabs: [{ clave, titulo, icono?, cuenta?, alerta?, deshabilitada?, ayuda? }]
// variante: "suelta" (barra blanca sobre el contenido) o "tarjeta" (dentro de una tarjeta)
import { useEffect, useRef, useState } from "react";
import "./Pestanas.css";

export default function Pestanas({ tabs, activa, onCambiar, variante = "suelta", className = "", id }) {
  const barra = useRef(null);
  const [sombras, setSombras] = useState({ izq: false, der: false });

  const medir = () => {
    const el = barra.current;
    if (!el) return;
    setSombras({ izq: el.scrollLeft > 4, der: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
  };

  useEffect(() => {
    medir();
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, [tabs.length]);

  // La pestaña activa siempre a la vista
  useEffect(() => {
    const el = barra.current?.querySelector(".pst-tab.activa");
    el?.scrollIntoView?.({ block: "nearest", inline: "nearest", behavior: "smooth" });
  }, [activa]);

  // Flechas del teclado para moverse entre pestañas
  const teclado = (e) => {
    if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(e.key)) return;
    const disponibles = tabs.filter((t) => !t.deshabilitada);
    const i = disponibles.findIndex((t) => t.clave === activa);
    let j = i;
    if (e.key === "ArrowRight") j = (i + 1) % disponibles.length;
    if (e.key === "ArrowLeft") j = (i - 1 + disponibles.length) % disponibles.length;
    if (e.key === "Home") j = 0;
    if (e.key === "End") j = disponibles.length - 1;
    e.preventDefault();
    onCambiar(disponibles[j].clave);
    requestAnimationFrame(() => barra.current?.querySelector(".pst-tab.activa")?.focus());
  };

  return (
    <div
      ref={barra}
      id={id}
      role="tablist"
      onScroll={medir}
      onKeyDown={teclado}
      className={`pst pst-${variante}${sombras.izq ? " pst-con-sombra-izq" : ""}${sombras.der ? " pst-con-sombra-der" : ""} ${className}`}
    >
      {tabs.map((t) => {
        const sel = t.clave === activa;
        return (
          <button
            key={t.clave}
            type="button"
            role="tab"
            aria-selected={sel}
            tabIndex={sel ? 0 : -1}
            className={`pst-tab${sel ? " activa" : ""}`}
            onClick={() => onCambiar(t.clave)}
            disabled={t.deshabilitada}
            title={t.ayuda}
          >
            {t.icono}
            <span>{t.titulo}</span>
            {t.cuenta > 0 && <span className={`pst-cuenta${t.alerta ? " alerta" : ""}`}>{t.cuenta}</span>}
          </button>
        );
      })}
    </div>
  );
}
