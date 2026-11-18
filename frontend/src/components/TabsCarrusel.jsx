// Pestañas del portal del socio. En celular se desplazan solas como carrusel (en bucle);
// se detienen al poner el mouse encima o al tocarlas, y se pueden deslizar con el dedo.
// En pantallas grandes se ven todas, como siempre.
import { useEffect, useRef, useState } from "react";

const VELOCIDAD = 0.035; // px por milisegundo (~35 px/s)
const ESPERA_TRAS_TOQUE = 3500; // ms sin tocar antes de seguir moviéndose

const consulta = (q) => (typeof window !== "undefined" && window.matchMedia ? window.matchMedia(q) : null);

export default function TabsCarrusel({ tabs, activo, onCambiar }) {
  const caja = useRef(null);
  const juego1 = useRef(null);
  const juego2 = useRef(null);
  const pausado = useRef(false);
  const temporizador = useRef(null);
  const posicion = useRef(0);
  const [movil, setMovil] = useState(() => !!consulta("(max-width: 575.98px)")?.matches);
  const [desborda, setDesborda] = useState(false);
  const sinMovimiento = !!consulta("(prefers-reduced-motion: reduce)")?.matches;

  useEffect(() => {
    const mq = consulta("(max-width: 575.98px)");
    if (!mq) return;
    const cambio = () => setMovil(mq.matches);
    mq.addEventListener?.("change", cambio);
    return () => mq.removeEventListener?.("change", cambio);
  }, []);

  // ¿Las pestañas caben? Si caben, no hay nada que desplazar
  useEffect(() => {
    const medir = () => {
      if (!caja.current || !juego1.current) return;
      setDesborda(juego1.current.scrollWidth > caja.current.clientWidth + 4);
    };
    medir();
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, [tabs.length, movil]);

  const carrusel = movil && desborda && !sinMovimiento;

  useEffect(() => {
    if (!carrusel) return;
    const el = caja.current;
    let raf;
    let antes = performance.now();
    posicion.current = el.scrollLeft;
    const paso = (t) => {
      const dt = Math.min(64, t - antes);
      antes = t;
      // Ancho de una vuelta: del inicio del primer juego de pestañas al inicio del segundo
      const vuelta = juego2.current && juego1.current ? juego2.current.offsetLeft - juego1.current.offsetLeft : 0;
      if (!pausado.current && vuelta > 0) {
        posicion.current += dt * VELOCIDAD;
        if (posicion.current >= vuelta) posicion.current -= vuelta;
        el.scrollLeft = posicion.current;
      } else {
        // Mientras está detenido, el usuario puede deslizarlo: se sigue desde donde lo dejó
        posicion.current = el.scrollLeft;
        if (vuelta > 0 && posicion.current >= vuelta) {
          posicion.current -= vuelta;
          el.scrollLeft = posicion.current;
        }
      }
      raf = requestAnimationFrame(paso);
    };
    raf = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(raf);
  }, [carrusel]);

  useEffect(() => () => clearTimeout(temporizador.current), []);

  const detener = () => {
    clearTimeout(temporizador.current);
    pausado.current = true;
  };
  const seguirLuego = (ms = ESPERA_TRAS_TOQUE) => {
    clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => (pausado.current = false), ms);
  };

  const botones = (copia) =>
    tabs.map((t) => (
      <button
        key={`${copia ? "c-" : ""}${t.key}`}
        type="button"
        className={`sp-tab-btn ${activo === t.key ? "active" : ""}`}
        onClick={() => {
          onCambiar(t.key);
          if (carrusel) {
            detener();
            seguirLuego(6000);
          }
        }}
        tabIndex={copia ? -1 : undefined}
        aria-hidden={copia ? true : undefined}
      >
        {t.icon} {t.label}
      </button>
    ));

  return (
    <div
      ref={caja}
      className={`sp-tabs mb-4 p-1${carrusel ? " sp-tabs-carrusel" : ""}`}
      role="tablist"
      style={{ background: "#fff", borderRadius: "2rem", boxShadow: "0 2px 8px #0000000d" }}
      // Solo el mouse real: en celular el toque también dispara eventos de mouse
      onPointerEnter={carrusel ? (e) => e.pointerType === "mouse" && detener() : undefined}
      onPointerLeave={carrusel ? (e) => e.pointerType === "mouse" && seguirLuego(800) : undefined}
      onTouchStart={carrusel ? detener : undefined}
      onTouchEnd={carrusel ? () => seguirLuego() : undefined}
      onTouchCancel={carrusel ? () => seguirLuego() : undefined}
      onWheel={carrusel ? () => { detener(); seguirLuego(); } : undefined}
    >
      <div ref={juego1} className="sp-tabs-juego">{botones(false)}</div>
      {carrusel && <div ref={juego2} className="sp-tabs-juego">{botones(true)}</div>}
    </div>
  );
}
