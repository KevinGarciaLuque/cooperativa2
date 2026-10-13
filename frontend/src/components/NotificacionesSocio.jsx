// Campanita de notificaciones del socio: pagos confirmados o rechazados, aportaciones,
// préstamos aprobados y recordatorios. Si el aviso trae un recibo, se abre al tocarlo.
import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import {
  FaBell,
  FaCheckCircle,
  FaTimesCircle,
  FaPiggyBank,
  FaHandHoldingUsd,
  FaInfoCircle,
  FaReceipt,
} from "react-icons/fa";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const ICONOS = {
  pago: [<FaCheckCircle key="i" />, "#16a34a", "#dcfce7"],
  pago_rechazado: [<FaTimesCircle key="i" />, "#dc2626", "#fee2e2"],
  aportacion: [<FaPiggyBank key="i" />, "#2563eb", "#dbeafe"],
  prestamo: [<FaHandHoldingUsd key="i" />, "#d97706", "#fef3c7"],
  aviso: [<FaInfoCircle key="i" />, "#475569", "#e2e8f0"],
};

// "hace 5 min", "ayer", "12 oct"
const cuando = (v) => {
  const d = new Date(String(v).replace(" ", "T"));
  if (isNaN(d)) return "";
  const min = Math.round((Date.now() - d.getTime()) / 60000);
  if (min < 1) return "ahora";
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  if (h < 48) return "ayer";
  return d.toLocaleDateString("es-HN", { day: "numeric", month: "short" });
};

export default function NotificacionesSocio({ headers, onVerRecibo }) {
  const [abierto, setAbierto] = useState(false);
  const [lista, setLista] = useState(null);
  const [sinLeer, setSinLeer] = useState(0);
  const [izquierda, setIzquierda] = useState(0); // posición del panel para que no se salga de la pantalla
  const caja = useRef(null);

  const cargar = useCallback(() => {
    axios
      .get(`${API_URL}/notificaciones`, { headers })
      .then((r) => {
        setLista(r.data.data || []);
        setSinLeer(r.data.sin_leer || 0);
      })
      .catch(() => setLista((l) => l || []));
  }, [headers]);

  // Se revisa al entrar, cada minuto y al volver a la pestaña
  useEffect(() => {
    cargar();
    const t = setInterval(cargar, 60000);
    const alVolver = () => document.visibilityState === "visible" && cargar();
    document.addEventListener("visibilitychange", alVolver);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, [cargar]);

  // Cerrar al tocar fuera
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e) => caja.current && !caja.current.contains(e.target) && setAbierto(false);
    document.addEventListener("mousedown", fuera);
    return () => document.removeEventListener("mousedown", fuera);
  }, [abierto]);

  const marcar = (id) => {
    setLista((l) => l.map((n) => (id == null || n.id_notificacion === id ? { ...n, leida: true } : n)));
    setSinLeer((c) => (id == null ? 0 : Math.max(0, c - 1)));
    axios.post(`${API_URL}/notificaciones/leer`, id == null ? {} : { id }, { headers }).catch(() => {});
  };

  const abrir = (n) => {
    if (!n.leida) marcar(n.id_notificacion);
    if (n.id_recibo) {
      setAbierto(false);
      onVerRecibo?.(n.id_recibo);
    }
  };

  return (
    <div ref={caja} className="position-relative">
      <button
        type="button"
        aria-label={`Notificaciones${sinLeer ? ` (${sinLeer} sin leer)` : ""}`}
        onClick={() => {
          if (!abierto && caja.current) {
            const r = caja.current.getBoundingClientRect();
            const ancho = Math.min(360, window.innerWidth - 32);
            const x = Math.min(Math.max(16, r.right - ancho), window.innerWidth - ancho - 16);
            setIzquierda(x - r.left);
          }
          setAbierto((a) => !a);
        }}
        className="btn d-flex align-items-center justify-content-center position-relative"
        style={{
          width: 44,
          height: 44,
          borderRadius: "50%",
          background: "rgba(255,255,255,0.1)",
          border: "1.5px solid rgba(255,255,255,0.35)",
          color: "#fff",
        }}
      >
        <FaBell size={18} />
        {sinLeer > 0 && (
          <span
            className="position-absolute badge rounded-pill"
            style={{ top: -4, right: -4, background: "#ef4444", fontSize: ".7rem", minWidth: 20 }}
          >
            {sinLeer > 9 ? "9+" : sinLeer}
          </span>
        )}
      </button>

      {abierto && (
        <div
          className="bg-white text-dark shadow-lg"
          style={{
            position: "absolute",
            left: izquierda,
            top: 52,
            width: "min(360px, calc(100vw - 32px))",
            borderRadius: 16,
            zIndex: 1050,
            overflow: "hidden",
          }}
        >
          <div className="d-flex align-items-center justify-content-between px-3 py-2 border-bottom">
            <strong>Notificaciones</strong>
            {sinLeer > 0 && (
              <button type="button" className="btn btn-link btn-sm p-0 text-decoration-none" onClick={() => marcar(null)}>
                Marcar todas como leídas
              </button>
            )}
          </div>
          <div style={{ maxHeight: 420, overflowY: "auto" }}>
            {lista === null ? (
              <div className="p-4 text-center">
                <div className="spinner-border spinner-border-sm text-success" />
              </div>
            ) : lista.length === 0 ? (
              <div className="p-4 text-center text-muted small">
                <FaBell size={26} className="mb-2" style={{ opacity: 0.3 }} />
                <div>No tienes notificaciones.</div>
              </div>
            ) : (
              lista.map((n) => {
                const [icono, color, fondo] = ICONOS[n.tipo] || ICONOS.aviso;
                return (
                  <button
                    key={n.id_notificacion}
                    type="button"
                    onClick={() => abrir(n)}
                    className="w-100 text-start border-0 border-bottom d-flex gap-2 px-3 py-2"
                    style={{ background: n.leida ? "#fff" : "#f4f9e8" }}
                  >
                    <span
                      className="d-flex align-items-center justify-content-center flex-shrink-0 mt-1"
                      style={{ width: 32, height: 32, borderRadius: "50%", background: fondo, color }}
                    >
                      {icono}
                    </span>
                    <span className="flex-grow-1" style={{ minWidth: 0 }}>
                      <span className="d-flex justify-content-between gap-2">
                        <span className={n.leida ? "fw-semibold small" : "fw-bold small"}>{n.titulo}</span>
                        <span className="text-muted flex-shrink-0" style={{ fontSize: ".72rem" }}>
                          {cuando(n.creada_en)}
                        </span>
                      </span>
                      {n.mensaje && (
                        <span className="d-block text-muted" style={{ fontSize: ".8rem" }}>
                          {n.mensaje}
                        </span>
                      )}
                      {n.id_recibo && (
                        <span className="d-inline-flex align-items-center gap-1 mt-1 fw-semibold" style={{ fontSize: ".78rem", color: "#4d7c0f" }}>
                          <FaReceipt /> Ver recibo
                        </span>
                      )}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
