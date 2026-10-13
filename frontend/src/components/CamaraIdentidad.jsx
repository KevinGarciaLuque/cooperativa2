// Cámara para fotografiar la identidad (DNI) con un recuadro guía del tamaño de
// la tarjeta. Al capturar se recorta solo lo que queda dentro del recuadro, así
// la foto no trae el espacio sobrante de arriba y abajo.
// Si el navegador no permite usar la cámara, se abre el selector de archivos.
import { useEffect, useRef, useState } from "react";
import { FaCamera, FaImages, FaTimes } from "react-icons/fa";

// Proporción de una tarjeta de identidad (85.6 x 54 mm)
const PROPORCION = 85.6 / 54;

export default function CamaraIdentidad({ abierta, titulo = "Identidad", onCaptura, onCerrar }) {
  const video = useRef(null);
  const contenedor = useRef(null);
  const recuadro = useRef(null);
  const galeria = useRef(null);
  const flujo = useRef(null);
  const [lista, setLista] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!abierta) return;
    let cancelado = false;
    setLista(false);
    setError("");

    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Este navegador no permite usar la cámara aquí. Elige la foto desde tu galería.");
      return;
    }

    navigator.mediaDevices
      .getUserMedia({
        audio: false,
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      })
      .then((s) => {
        if (cancelado) return s.getTracks().forEach((t) => t.stop());
        flujo.current = s;
        if (video.current) {
          video.current.srcObject = s;
          video.current.play().catch(() => {});
        }
      })
      .catch(() => {
        if (!cancelado) setError("No se pudo abrir la cámara. Revisa los permisos o elige la foto desde tu galería.");
      });

    return () => {
      cancelado = true;
      flujo.current?.getTracks().forEach((t) => t.stop());
      flujo.current = null;
    };
  }, [abierta]);

  if (!abierta) return null;

  // Recorta del video la zona que se ve dentro del recuadro (el video usa object-fit: cover)
  const capturar = () => {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    const caja = contenedor.current.getBoundingClientRect();
    const marco = recuadro.current.getBoundingClientRect();
    const escala = Math.max(caja.width / v.videoWidth, caja.height / v.videoHeight);
    const desfaseX = (caja.width - v.videoWidth * escala) / 2;
    const desfaseY = (caja.height - v.videoHeight * escala) / 2;

    const sx = Math.max(0, (marco.left - caja.left - desfaseX) / escala);
    const sy = Math.max(0, (marco.top - caja.top - desfaseY) / escala);
    const sw = Math.min(v.videoWidth - sx, marco.width / escala);
    const sh = Math.min(v.videoHeight - sy, marco.height / escala);

    const lienzo = document.createElement("canvas");
    lienzo.width = Math.round(sw);
    lienzo.height = Math.round(sh);
    lienzo.getContext("2d").drawImage(v, sx, sy, sw, sh, 0, 0, lienzo.width, lienzo.height);
    lienzo.toBlob(
      (blob) => {
        if (!blob) return;
        onCaptura(new File([blob], `identidad-${Date.now()}.jpg`, { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.9
    );
  };

  const elegirGaleria = (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (f) onCaptura(f);
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 2000, background: "#000", display: "flex", flexDirection: "column" }}
    >
      <div className="d-flex align-items-center justify-content-between px-3 py-2 text-white">
        <span className="fw-semibold">{titulo} de la identidad</span>
        <button type="button" className="btn btn-link text-white p-1" onClick={onCerrar} aria-label="Cerrar">
          <FaTimes size={20} />
        </button>
      </div>

      <div ref={contenedor} style={{ position: "relative", flex: 1, overflow: "hidden" }}>
        <video
          ref={video}
          playsInline
          muted
          autoPlay
          onLoadedMetadata={() => setLista(true)}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
        />

        {/* Recuadro guía: lo de afuera se oscurece y no sale en la foto */}
        <div
          style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}
        >
          <div
            ref={recuadro}
            style={{
              width: `min(90%, calc((100dvh - 210px) * ${PROPORCION}))`,
              aspectRatio: `${PROPORCION}`,
              border: "3px solid #a8cd3a",
              borderRadius: 14,
              boxShadow: "0 0 0 9999px rgba(0,0,0,0.6)",
            }}
          />
        </div>

        <div
          className="text-white text-center small px-3"
          style={{ position: "absolute", left: 0, right: 0, bottom: 16, textShadow: "0 1px 3px #000" }}
        >
          {error || (lista ? "Coloca la identidad dentro del recuadro" : "Abriendo la cámara...")}
        </div>
      </div>

      <div className="d-flex align-items-center justify-content-around py-3">
        <button type="button" className="btn btn-outline-light btn-sm" onClick={() => galeria.current?.click()}>
          <FaImages className="me-1" /> Galería
        </button>
        <button
          type="button"
          onClick={capturar}
          disabled={!lista}
          aria-label="Tomar foto"
          className="d-flex align-items-center justify-content-center"
          style={{ width: 68, height: 68, borderRadius: "50%", border: "4px solid #fff", background: lista ? "#a8cd3a" : "#555", color: "#1a2035" }}
        >
          <FaCamera size={24} />
        </button>
        <button type="button" className="btn btn-outline-light btn-sm" onClick={onCerrar}>
          Cancelar
        </button>
      </div>

      <input ref={galeria} type="file" accept="image/*" className="d-none" onChange={elegirGaleria} />
    </div>
  );
}
