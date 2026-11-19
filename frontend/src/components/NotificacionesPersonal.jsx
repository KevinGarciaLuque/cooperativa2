// Campanita del personal: lo que está esperando atención según los módulos de su rol
// (solicitudes, pagos reportados, votos del comité, cuotas por vencer, mora, plazos fijos,
// alertas de cumplimiento, turno de caja sin cerrar). Cada aviso lleva a su pantalla.
// El número rojo cuenta solo lo nuevo desde la última vez que se abrió la campanita.
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import {
  FaBell,
  FaUserPlus,
  FaFileSignature,
  FaMoneyCheckAlt,
  FaFileAlt,
  FaHandHoldingUsd,
  FaGavel,
  FaCalendarDay,
  FaCalendarAlt,
  FaExclamationTriangle,
  FaHandshake,
  FaPiggyBank,
  FaUserSecret,
  FaCashRegister,
  FaCheckCircle,
  FaChevronRight,
  FaBuilding,
  FaUserShield,
} from "react-icons/fa";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const ICONOS = {
  socios_pendientes: FaUserPlus,
  solicitudes_prestamo: FaFileSignature,
  pagos_reportados: FaMoneyCheckAlt,
  comprobantes_firmados: FaFileAlt,
  por_desembolsar: FaHandHoldingUsd,
  comite_voto: FaGavel,
  cuotas_hoy: FaCalendarDay,
  cuotas_pronto: FaCalendarAlt,
  prestamos_mora: FaExclamationTriangle,
  promesas_vencidas: FaHandshake,
  plazos_vencen: FaPiggyBank,
  alertas_cumplimiento: FaUserSecret,
  turno_abierto: FaCashRegister,
  planillas_por_aplicar: FaBuilding,
  autorizaciones: FaUserShield,
};
const COLORES = {
  alta: ["#dc2626", "#fee2e2"],
  media: ["#d97706", "#fef3c7"],
  info: ["#2563eb", "#dbeafe"],
};

const leerVistos = (clave) => {
  try {
    return JSON.parse(localStorage.getItem(clave) || "{}") || {};
  } catch {
    return {};
  }
};
const guardarVistos = (clave, valor) => {
  try {
    localStorage.setItem(clave, JSON.stringify(valor));
  } catch {
    // sin almacenamiento: el contador se reinicia al recargar
  }
};

export default function NotificacionesPersonal({ token, idUsuario }) {
  const navigate = useNavigate();
  const [abierto, setAbierto] = useState(false);
  const [items, setItems] = useState(null);
  const claveVistos = `avisos_vistos_${idUsuario}`;
  const [vistos, setVistos] = useState(() => leerVistos(claveVistos));
  const [antes, setAntes] = useState({}); // lo visto antes de abrir: marca las filas "nuevo"
  const caja = useRef(null);

  const cargar = useCallback(() => {
    axios
      .get(`${API_URL}/notificaciones/personal`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => setItems(r.data.items || []))
      .catch(() => setItems((l) => l || []));
  }, [token]);

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

  useEffect(() => {
    if (!abierto) return;
    const fuera = (e) => caja.current && !caja.current.contains(e.target) && setAbierto(false);
    const esc = (e) => e.key === "Escape" && setAbierto(false);
    document.addEventListener("mousedown", fuera);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fuera);
      document.removeEventListener("keydown", esc);
    };
  }, [abierto]);

  const nuevos = (items || []).reduce((t, i) => t + Math.max(0, i.cantidad - (vistos[i.clave] || 0)), 0);

  const alternar = () => {
    // Al abrir, lo que se ve queda como visto (el número rojo vuelve a cero)
    if (!abierto && items) {
      const v = {};
      items.forEach((i) => (v[i.clave] = i.cantidad));
      guardarVistos(claveVistos, v);
      setAntes(vistos);
      setVistos(v);
    }
    setAbierto((a) => !a);
  };

  const ir = (ruta) => {
    setAbierto(false);
    navigate(ruta);
  };

  return (
    <div ref={caja} style={{ position: "relative" }}>
      <button
        type="button"
        className="campana-btn"
        onClick={alternar}
        aria-label={`Pendientes${nuevos ? ` (${nuevos} nuevos)` : ""}`}
        aria-expanded={abierto}
        title="Pendientes"
      >
        <FaBell size={17} />
        {nuevos > 0 && <span className="campana-num">{nuevos > 9 ? "9+" : nuevos}</span>}
      </button>

      {abierto && (
        <div className="campana-panel" role="dialog" aria-label="Pendientes">
          <div className="campana-cab">
            <strong>Pendientes</strong>
            <span className="small" style={{ color: "#64748b" }}>Se actualiza cada minuto</span>
          </div>
          <div style={{ maxHeight: "min(440px, 70vh)", overflowY: "auto" }}>
            {items === null ? (
              <div className="p-4 text-center">
                <div className="spinner-border spinner-border-sm text-success" />
              </div>
            ) : items.length === 0 ? (
              <div className="p-4 text-center small" style={{ color: "#64748b" }}>
                <FaCheckCircle size={28} className="mb-2" style={{ color: "#a8cd3a" }} />
                <div className="fw-semibold" style={{ color: "#1e293b" }}>Todo al día</div>
                <div>No hay nada esperando tu atención.</div>
              </div>
            ) : (
              items.map((i) => {
                const Icono = ICONOS[i.clave] || FaBell;
                const [color, fondo] = COLORES[i.nivel] || COLORES.info;
                const esNuevo = i.cantidad > (antes[i.clave] || 0);
                return (
                  <button key={i.clave} type="button" className="campana-item" onClick={() => ir(i.ruta)}>
                    <span className="campana-ico" style={{ background: fondo, color }}>
                      <Icono />
                    </span>
                    <span className="flex-grow-1" style={{ minWidth: 0 }}>
                      <span className="d-flex align-items-center gap-2">
                        <span className="fw-semibold" style={{ color: "#1e293b", fontSize: ".88rem" }}>{i.titulo}</span>
                        {esNuevo && <span className="campana-nuevo">nuevo</span>}
                      </span>
                      <span className="d-block" style={{ color: "#64748b", fontSize: ".78rem" }}>{i.detalle}</span>
                    </span>
                    <span className="campana-cant" style={{ background: fondo, color }}>{i.cantidad}</span>
                    <FaChevronRight size={11} style={{ color: "#94a3b8" }} />
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
