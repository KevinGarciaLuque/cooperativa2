// App del socio: instalarla en el celular y activar las notificaciones en el teléfono
// (pagos aplicados, cuotas por vencer, préstamos aprobados). Se muestra en el Resumen.
import { useEffect, useState } from "react";
import axios from "axios";
import { FaMobileAlt, FaBell, FaBellSlash, FaDownload, FaTimes } from "react-icons/fa";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const OCULTO = "app_tarjeta_oculta";

// La clave del servidor viene en base64 url; el navegador la quiere en bytes
const aBytes = (b64) => {
  const relleno = "=".repeat((4 - (b64.length % 4)) % 4);
  const s = atob((b64 + relleno).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...s].map((c) => c.charCodeAt(0)));
};

const esIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const instalada = () => window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true;
const soportaPush = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

export default function AppTelefono({ headers, clavePush, onAviso }) {
  const [suscrito, setSuscrito] = useState(null); // null = revisando
  const [ocupado, setOcupado] = useState(false);
  const [puedeInstalar, setPuedeInstalar] = useState(!!window.__instalarApp);
  const [oculta, setOculta] = useState(() => {
    try {
      return localStorage.getItem(OCULTO) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const listo = () => setPuedeInstalar(true);
    window.addEventListener("app-instalable", listo);
    return () => window.removeEventListener("app-instalable", listo);
  }, []);

  useEffect(() => {
    if (!soportaPush()) return setSuscrito(false);
    navigator.serviceWorker.getRegistration().then(async (reg) => {
      const s = reg ? await reg.pushManager.getSubscription() : null;
      setSuscrito(!!s && Notification.permission === "granted");
    });
  }, []);

  const activar = async () => {
    setOcupado(true);
    try {
      const permiso = await Notification.requestPermission();
      if (permiso !== "granted") {
        onAviso?.("Las notificaciones quedaron bloqueadas. Puedes permitirlas en la configuración del navegador.", "warning");
        return;
      }
      const reg = (await navigator.serviceWorker.getRegistration()) || (await navigator.serviceWorker.register("/sw.js"));
      await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ||
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: aBytes(clavePush) }));
      await axios.post(`${API_URL}/app-socio/push/suscribir`, { subscription: sub.toJSON() }, { headers });
      await axios.post(`${API_URL}/app-socio/push/probar`, {}, { headers }).catch(() => {});
      setSuscrito(true);
      onAviso?.("¡Listo! Te avisaremos en este teléfono.", "success");
    } catch {
      onAviso?.("No se pudieron activar las notificaciones en este teléfono.", "error");
    } finally {
      setOcupado(false);
    }
  };

  const desactivar = async () => {
    setOcupado(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = reg && (await reg.pushManager.getSubscription());
      if (sub) {
        await axios.post(`${API_URL}/app-socio/push/cancelar`, { endpoint: sub.endpoint }, { headers }).catch(() => {});
        await sub.unsubscribe();
      }
      setSuscrito(false);
    } finally {
      setOcupado(false);
    }
  };

  const instalar = async () => {
    const e = window.__instalarApp;
    if (!e) return;
    e.prompt();
    await e.userChoice.catch(() => null);
    window.__instalarApp = null;
    setPuedeInstalar(false);
  };

  const ocultar = () => {
    setOculta(true);
    try {
      localStorage.setItem(OCULTO, "1");
    } catch {
      // sin almacenamiento: vuelve a aparecer al recargar
    }
  };

  // Ya instalada y con notificaciones: no hace falta mostrar nada
  if (suscrito === null || (suscrito && instalada()) || (oculta && suscrito)) return null;

  return (
    <div className="rounded-4 p-3 d-flex gap-3 align-items-start position-relative" style={{ background: "linear-gradient(135deg,#eef6dc,#f8fbf0)", border: "1px solid #d9ecaa" }}>
      <div className="flex-shrink-0 d-flex align-items-center justify-content-center" style={{ width: 44, height: 44, borderRadius: 12, background: "#a8cd3a", color: "#1a2a00" }}>
        <FaMobileAlt size={20} />
      </div>
      <div className="flex-grow-1" style={{ minWidth: 0 }}>
        <div className="fw-bold" style={{ color: "#2c3e50" }}>Tu cooperativa en el teléfono</div>
        <div className="small text-muted mb-2">
          {!instalada() && (esIOS()
            ? "Instálala: toca Compartir y luego «Agregar a pantalla de inicio». "
            : "Instálala como app para abrirla con un toque. ")}
          Activa las notificaciones y te avisamos cuando se aplique un pago o se acerque tu cuota.
        </div>
        <div className="d-flex flex-wrap gap-2">
          {puedeInstalar && !instalada() && (
            <button className="btn btn-sm btn-dark" onClick={instalar}>
              <FaDownload className="me-1" /> Instalar app
            </button>
          )}
          {soportaPush() && clavePush && !suscrito && (
            <button className="btn btn-sm fw-semibold" style={{ background: "#a8cd3a", color: "#1a2a00" }} onClick={activar} disabled={ocupado}>
              <FaBell className="me-1" /> {ocupado ? "Activando…" : "Activar notificaciones"}
            </button>
          )}
          {suscrito && (
            <button className="btn btn-sm btn-outline-secondary" onClick={desactivar} disabled={ocupado}>
              <FaBellSlash className="me-1" /> Desactivar notificaciones
            </button>
          )}
          {!soportaPush() && (
            <span className="small text-muted">
              {esIOS() ? "En iPhone, las notificaciones funcionan con la app instalada (iOS 16.4 o más reciente)." : "Este navegador no permite notificaciones."}
            </span>
          )}
        </div>
      </div>
      <button className="btn btn-sm p-1 position-absolute" style={{ top: 6, right: 6, color: "#64748b" }} onClick={ocultar} aria-label="Ocultar">
        <FaTimes />
      </button>
    </div>
  );
}
