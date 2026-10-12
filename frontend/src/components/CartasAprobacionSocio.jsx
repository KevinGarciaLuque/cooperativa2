// Cartas de aprobación de los préstamos de un socio, con botones para descargarlas,
// enviarlas por WhatsApp o reenviarlas al correo. Se usa en Ventanilla y en Recibos.
import { useEffect, useState } from "react";
import axios from "axios";
import { FaEnvelope, FaFilePdf, FaWhatsapp } from "react-icons/fa";
import { useAlerta } from "../context/AlertaContext";
import { useConfigSitio } from "../hooks/useConfigSitio";
import { compartirCarta, descargarCarta } from "../utils/cartaAprobacion";
import { fmt } from "../utils/solicitud";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

// Estados en los que el préstamo ya fue aprobado u otorgado
const CON_CARTA = ["aprobado", "activo", "mora", "pagado"];
const ESTADOS = { aprobado: "Aprobado", activo: "Activo", mora: "En mora", pagado: "Pagado" };

export default function CartasAprobacionSocio({ idSocio, telefono, headers, titulo = true }) {
  const { mostrarAlerta } = useAlerta();
  const { config: sitio } = useConfigSitio();
  const [prestamos, setPrestamos] = useState(null);
  const [ocupado, setOcupado] = useState(null);
  const token = (headers?.Authorization || "").replace("Bearer ", "");

  useEffect(() => {
    let activo = true;
    axios
      .get(`${API_URL}/prestamos`, { headers, params: { id_usuario: idSocio } })
      .then((r) => {
        if (!activo) return;
        const lista = (r.data.data || []).filter((p) => CON_CARTA.includes((p.estado || "").toLowerCase()));
        lista.sort((a, b) => b.id_prestamo - a.id_prestamo);
        setPrestamos(lista);
      })
      .catch(() => activo && setPrestamos([]));
    return () => {
      activo = false;
    };
  }, [idSocio, headers]);

  const accion = async (clave, fn, error) => {
    setOcupado(clave);
    try {
      await fn();
    } catch (err) {
      mostrarAlerta(err.response?.data?.message || error, "error");
    } finally {
      setOcupado(null);
    }
  };

  const descargar = (p) =>
    accion(`d${p.id_prestamo}`, () => descargarCarta(p.id_prestamo, token), "No se pudo descargar la carta.");

  const whatsapp = (p) =>
    accion(
      `w${p.id_prestamo}`,
      async () => {
        const aviso = await compartirCarta(p.id_prestamo, token, { telefono, cooperativa: sitio?.site_name });
        if (aviso) mostrarAlerta(aviso, "success");
      },
      "No se pudo preparar la carta para compartir."
    );

  const correo = (p) =>
    accion(
      `c${p.id_prestamo}`,
      async () => {
        const r = await axios.post(`${API_URL}/solicitudes/prestamos/${p.id_prestamo}/carta/enviar`, {}, { headers });
        mostrarAlerta(r.data.message, "success");
      },
      "No se pudo enviar la carta."
    );

  return (
    <div>
      {titulo && <div className="fw-bold mb-2">Cartas de préstamo aprobado</div>}
      {!prestamos && (
        <div className="text-center py-3">
          <div className="spinner-border spinner-border-sm text-success" />
        </div>
      )}
      {prestamos && prestamos.length === 0 && (
        <div className="text-muted small py-2">Este socio no tiene préstamos aprobados.</div>
      )}
      {prestamos?.map((p) => (
        <div
          key={p.id_prestamo}
          className="d-flex flex-wrap justify-content-between align-items-center gap-2 py-2 border-bottom"
        >
          <div>
            <div className="fw-semibold">
              Préstamo #{p.id_prestamo} · {fmt(p.monto)}
            </div>
            <div className="small text-muted">
              {parseInt(p.plazo_meses) === 0 ? "Plazo indefinido" : `${p.plazo_meses} meses`} ·{" "}
              {ESTADOS[(p.estado || "").toLowerCase()] || p.estado}
            </div>
          </div>
          <div className="d-flex flex-wrap gap-2">
            <button className="btn btn-sm btn-outline-dark" disabled={!!ocupado} onClick={() => descargar(p)}>
              <FaFilePdf className="me-1" /> Descargar
            </button>
            <button
              className="btn btn-sm fw-semibold"
              style={{ background: "#25D366", color: "#fff" }}
              disabled={!!ocupado}
              onClick={() => whatsapp(p)}
            >
              <FaWhatsapp className="me-1" /> WhatsApp
            </button>
            <button className="btn btn-sm btn-outline-secondary" disabled={!!ocupado} onClick={() => correo(p)}>
              <FaEnvelope className="me-1" /> Correo
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
