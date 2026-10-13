// Fotos del frente y reverso de la identidad (DNI). Se usa en el perfil del socio,
// en la ficha de Ventanilla y en Solicitudes. Las fotos se piden con la sesión
// (no son públicas) y se reducen en el celular antes de subirlas.
import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { FaCamera, FaCheckCircle, FaChevronLeft, FaChevronRight, FaEye, FaEyeSlash, FaIdCard, FaTimes } from "react-icons/fa";
import { comprimirImagen } from "../utils/imagen";
import CamaraIdentidad from "./CamaraIdentidad";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const LADOS = [
  ["frente", "Frente"],
  ["reverso", "Reverso"],
];
// Proporción de una tarjeta de identidad (85.6 x 54 mm)
const PROPORCION = 85.6 / 54;

// Visor a pantalla completa para ver una foto de la identidad en grande
function VisorIdentidad({ vistas, lado, onLado, onCerrar }) {
  const disponibles = LADOS.filter(([l]) => vistas[l]);
  const i = disponibles.findIndex(([l]) => l === lado);

  useEffect(() => {
    const tecla = (e) => {
      if (e.key === "Escape") onCerrar();
      if (e.key === "ArrowRight" && i < disponibles.length - 1) onLado(disponibles[i + 1][0]);
      if (e.key === "ArrowLeft" && i > 0) onLado(disponibles[i - 1][0]);
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  });

  const flecha = { position: "absolute", top: "50%", transform: "translateY(-50%)", width: 44, height: 44, borderRadius: "50%" };

  return (
    <div
      onClick={onCerrar}
      style={{ position: "fixed", inset: 0, zIndex: 7000, background: "rgba(0,0,0,0.88)", display: "flex", flexDirection: "column" }}
    >
      <div className="d-flex align-items-center justify-content-between px-3 py-2 text-white" onClick={(e) => e.stopPropagation()}>
        <div className="btn-group btn-group-sm">
          {disponibles.map(([l, etiqueta]) => (
            <button
              key={l}
              type="button"
              className={`btn ${l === lado ? "btn-light" : "btn-outline-light"}`}
              onClick={() => onLado(l)}
            >
              {etiqueta}
            </button>
          ))}
        </div>
        <button type="button" className="btn btn-link text-white p-1" onClick={onCerrar} aria-label="Cerrar">
          <FaTimes size={22} />
        </button>
      </div>
      <div className="flex-grow-1 position-relative d-flex align-items-center justify-content-center p-3" style={{ minHeight: 0 }}>
        <img
          src={vistas[lado]}
          alt="Identidad"
          onClick={(e) => e.stopPropagation()}
          style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: 12 }}
        />
        {i > 0 && (
          <button type="button" className="btn btn-light" style={{ ...flecha, left: 12 }} aria-label="Anterior"
            onClick={(e) => { e.stopPropagation(); onLado(disponibles[i - 1][0]); }}>
            <FaChevronLeft />
          </button>
        )}
        {i < disponibles.length - 1 && (
          <button type="button" className="btn btn-light" style={{ ...flecha, right: 12 }} aria-label="Siguiente"
            onClick={(e) => { e.stopPropagation(); onLado(disponibles[i + 1][0]); }}>
            <FaChevronRight />
          </button>
        )}
      </div>
    </div>
  );
}

// Selector de una foto con vista previa (para formularios que la envían después)
export function CampoFotoIdentidad({ etiqueta, archivo, onChange }) {
  const [camara, setCamara] = useState(false);
  const [vista, setVista] = useState(null);

  useEffect(() => {
    if (!archivo) return setVista(null);
    const url = URL.createObjectURL(archivo);
    setVista(url);
    return () => URL.revokeObjectURL(url);
  }, [archivo]);

  const elegir = async (f) => {
    setCamara(false);
    onChange(await comprimirImagen(f));
  };

  return (
    <div>
      <div className="small fw-semibold mb-1">
        {etiqueta} <span className="text-danger">*</span>
      </div>
      <button
        type="button"
        className="w-100 d-flex flex-column align-items-center justify-content-center"
        style={{
          height: 130,
          borderRadius: 12,
          border: `2px dashed ${archivo ? "#a8cd3a" : "#cbd5e1"}`,
          background: vista ? `center / cover no-repeat url(${vista})` : "#f8fafc",
          color: "#64748b",
        }}
        onClick={() => setCamara(true)}
      >
        {!vista && (
          <>
            <FaCamera size={22} className="mb-1" />
            <span className="small">Tomar o elegir foto</span>
          </>
        )}
      </button>
      {archivo && (
        <button type="button" className="btn btn-link btn-sm px-0" onClick={() => setCamara(true)}>
          Cambiar foto
        </button>
      )}
      <CamaraIdentidad abierta={camara} titulo={etiqueta} onCaptura={elegir} onCerrar={() => setCamara(false)} />
    </div>
  );
}

// Fotos ya guardadas de un socio, con opción de subirlas o reemplazarlas.
// soloFaltantes: el socio activo solo puede subir las que aún no tiene.
// plegable: las fotos quedan ocultas tras un botón "Ver DNI".
export default function FotosIdentidad({ idSocio, headers, puedeSubir = true, soloFaltantes = false, plegable = false, onCambio }) {
  const [estado, setEstado] = useState(null);
  const [vistas, setVistas] = useState({});
  const [subiendo, setSubiendo] = useState(null);
  const [error, setError] = useState("");
  const [camara, setCamara] = useState(null); // lado que se está fotografiando
  const [visor, setVisor] = useState(null); // lado que se ve en grande
  const [abierto, setAbierto] = useState(!plegable);

  const cargar = useCallback(async () => {
    try {
      const r = await axios.get(`${API_URL}/socios/${idSocio}/identidad`, { headers });
      const est = r.data.data;
      setEstado(est);
      onCambio?.(est);
      const nuevas = {};
      for (const [lado] of LADOS) {
        if (!est[lado]) continue;
        try {
          const img = await axios.get(`${API_URL}/socios/${idSocio}/identidad/${lado}`, {
            headers,
            responseType: "blob",
            params: { t: est[lado].subido_en },
          });
          nuevas[lado] = URL.createObjectURL(img.data);
        } catch {
          // sin vista previa: se sigue mostrando que existe
        }
      }
      setVistas(nuevas);
    } catch {
      setError("No se pudieron cargar las fotos de la identidad.");
    }
    // eslint-disable-next-line
  }, [idSocio, headers]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  useEffect(() => () => Object.values(vistas).forEach((u) => URL.revokeObjectURL(u)), [vistas]);

  const subir = async (lado, f) => {
    setCamara(null);
    setError("");
    setSubiendo(lado);
    try {
      const datos = new FormData();
      datos.append("foto", await comprimirImagen(f));
      await axios.post(`${API_URL}/socios/${idSocio}/identidad/${lado}`, datos, { headers });
      await cargar();
    } catch (err) {
      setError(err.response?.data?.message || "No se pudo subir la foto.");
    } finally {
      setSubiendo(null);
    }
  };

  const resumen = (
    <div className="d-flex flex-wrap align-items-center gap-2">
      {LADOS.map(([lado, etiqueta]) => {
        const tiene = !!estado?.[lado];
        return (
          <span key={lado} className={`badge rounded-pill ${tiene ? "text-bg-success" : "text-bg-light border text-muted"}`}>
            {tiene && <FaCheckCircle className="me-1" />}
            {etiqueta}{!tiene && " · sin foto"}
          </span>
        );
      })}
      <button type="button" className="btn btn-sm btn-outline-dark ms-auto" onClick={() => setAbierto((a) => !a)}>
        {abierto ? <FaEyeSlash className="me-1" /> : <FaEye className="me-1" />}
        {abierto ? "Ocultar DNI" : "Ver DNI"}
      </button>
    </div>
  );

  return (
    <div>
      {plegable && resumen}
      <div className={`row g-3 ${plegable ? "mt-1" : ""} ${abierto ? "" : "d-none"}`}>
        {LADOS.map(([lado, etiqueta]) => {
          const tiene = !!estado?.[lado];
          const permitido = puedeSubir && (!soloFaltantes || !tiene);
          return (
            <div className="col-12 col-sm-6" key={lado} style={{ maxWidth: 380 }}>
              <div className="small fw-semibold mb-1">{etiqueta} de la identidad</div>
              {vistas[lado] ? (
                <button
                  type="button"
                  className="p-0 border-0 bg-transparent w-100"
                  title="Ver en grande"
                  onClick={() => setVisor(lado)}
                >
                  <img
                    src={vistas[lado]}
                    alt={`${etiqueta} de la identidad`}
                    style={{ width: "100%", aspectRatio: PROPORCION, objectFit: "cover", borderRadius: 12, border: "1px solid #e2e8f0", background: "#f8fafc", cursor: "zoom-in" }}
                  />
                </button>
              ) : (
                <div
                  className="d-flex flex-column align-items-center justify-content-center text-muted"
                  style={{ width: "100%", aspectRatio: PROPORCION, borderRadius: 12, border: "2px dashed #cbd5e1", background: "#f8fafc" }}
                >
                  {estado === null ? (
                    <div className="spinner-border spinner-border-sm text-success" />
                  ) : (
                    <>
                      <FaIdCard size={26} className="mb-1" />
                      <span className="small">{tiene ? "Foto guardada" : "Sin foto"}</span>
                    </>
                  )}
                </div>
              )}
              {permitido && (
                <button
                  type="button"
                  className="btn btn-sm btn-outline-dark mt-2"
                  disabled={!!subiendo}
                  onClick={() => setCamara(lado)}
                >
                  <FaCamera className="me-1" />
                  {subiendo === lado ? "Subiendo..." : tiene ? "Cambiar foto" : "Subir foto"}
                </button>
              )}
            </div>
          );
        })}
      </div>
      {error && <div className="alert alert-danger py-2 mt-3 mb-0 small">{error}</div>}
      <CamaraIdentidad
        abierta={!!camara}
        titulo={LADOS.find(([l]) => l === camara)?.[1]}
        onCaptura={(f) => subir(camara, f)}
        onCerrar={() => setCamara(null)}
      />
      {visor && vistas[visor] && (
        <VisorIdentidad vistas={vistas} lado={visor} onLado={setVisor} onCerrar={() => setVisor(null)} />
      )}
    </div>
  );
}
