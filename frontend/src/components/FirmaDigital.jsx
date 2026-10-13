// Firma digital del personal: se dibuja con el dedo, el lápiz de la tablet o el mouse,
// y se guarda en el sistema para colocarla en los documentos que la persona emite o aprueba.
import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { FaEraser, FaSave, FaSignature, FaTrash } from "react-icons/fa";
import { useAlerta } from "../context/AlertaContext";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const ANCHO = 600; // tamaño de la imagen guardada (proporción 3:1)
const ALTO = 200;

// descripcion / mensajeGuardada: textos para el socio, que firma sus propios recibos.
// onCambio(imagen): avisa cuando se guarda o se elimina la firma.
export default function FirmaDigital({
  token,
  descripcion = "Tu firma aparecerá en la carta de aprobación, los recibos y las constancias que emitas o apruebes.",
  mensajeGuardada = "Firma guardada. Aparecerá en los documentos que emitas o apruebes.",
  confirmarEliminar = "¿Eliminar tu firma? Los documentos saldrán sin firma hasta que guardes una nueva.",
  onCambio,
  titulo = true,
}) {
  const { mostrarAlerta } = useAlerta();
  const lienzo = useRef(null);
  const trazando = useRef(false);
  const ultimo = useRef(null);
  const [guardada, setGuardada] = useState(undefined); // undefined: cargando · null: sin firma
  const [dibujando, setDibujando] = useState(false); // el recuadro está abierto
  const [hayTrazo, setHayTrazo] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    axios
      .get(`${API_URL}/firma/mia`, { headers })
      .then((r) => setGuardada(r.data.imagen || null))
      .catch(() => setGuardada(null));
    // eslint-disable-next-line
  }, [token]);

  // En el celular la firma se dibuja a pantalla completa: el recuadro es mucho más grande
  const [completa, setCompleta] = useState(false);
  const abrirLienzo = () => {
    setCompleta(window.matchMedia("(max-width: 767.98px)").matches);
    setDibujando(true);
  };

  // Prepara el lienzo con la resolución de la pantalla para que el trazo se vea nítido.
  // Si cambia el tamaño (por ejemplo, al girar el celular) se prepara de nuevo y se borra.
  useEffect(() => {
    if (!dibujando) return;
    const preparar = () => {
      const c = lienzo.current;
      if (!c) return;
      const escala = window.devicePixelRatio || 1;
      const { width, height } = c.getBoundingClientRect();
      c.width = width * escala;
      c.height = height * escala;
      const ctx = c.getContext("2d");
      ctx.scale(escala, escala);
      ctx.lineWidth = completa ? 3.2 : 2.6;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#0f172a";
      setHayTrazo(false);
    };
    preparar();
    window.addEventListener("resize", preparar);
    // Con el lienzo a pantalla completa, la página de atrás no se desplaza
    const desborde = document.body.style.overflow;
    if (completa) document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("resize", preparar);
      document.body.style.overflow = desborde;
    };
  }, [dibujando, completa]);

  const punto = (e) => {
    const r = lienzo.current.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const empezar = (e) => {
    e.preventDefault();
    lienzo.current.setPointerCapture(e.pointerId);
    trazando.current = true;
    ultimo.current = punto(e);
    const ctx = lienzo.current.getContext("2d");
    ctx.beginPath();
    ctx.arc(ultimo.current.x, ultimo.current.y, 1.2, 0, Math.PI * 2);
    ctx.fillStyle = "#0f172a";
    ctx.fill();
    setHayTrazo(true);
  };

  const mover = (e) => {
    if (!trazando.current) return;
    e.preventDefault();
    const ctx = lienzo.current.getContext("2d");
    const p = punto(e);
    const medio = { x: (ultimo.current.x + p.x) / 2, y: (ultimo.current.y + p.y) / 2 };
    ctx.beginPath();
    ctx.moveTo(ultimo.current.x, ultimo.current.y);
    ctx.quadraticCurveTo(ultimo.current.x, ultimo.current.y, medio.x, medio.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    ultimo.current = p;
  };

  const terminar = () => {
    trazando.current = false;
  };

  const limpiar = () => {
    const c = lienzo.current;
    c.getContext("2d").clearRect(0, 0, c.width, c.height);
    setHayTrazo(false);
  };

  // Recorta el espacio vacío y guarda la firma en un tamaño fijo, con fondo transparente
  const exportar = () =>
    new Promise((ok) => {
      const c = lienzo.current;
      const ctx = c.getContext("2d");
      const { data, width, height } = ctx.getImageData(0, 0, c.width, c.height);
      let x0 = width, y0 = height, x1 = 0, y1 = 0;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          if (data[(y * width + x) * 4 + 3] > 0) {
            if (x < x0) x0 = x;
            if (x > x1) x1 = x;
            if (y < y0) y0 = y;
            if (y > y1) y1 = y;
          }
        }
      }
      const margen = 8;
      x0 = Math.max(0, x0 - margen);
      y0 = Math.max(0, y0 - margen);
      x1 = Math.min(width, x1 + margen);
      y1 = Math.min(height, y1 + margen);
      const w = x1 - x0, h = y1 - y0;
      const salida = document.createElement("canvas");
      salida.width = ANCHO;
      salida.height = ALTO;
      const escala = Math.min(ANCHO / w, ALTO / h);
      salida
        .getContext("2d")
        .drawImage(c, x0, y0, w, h, (ANCHO - w * escala) / 2, (ALTO - h * escala) / 2, w * escala, h * escala);
      salida.toBlob(ok, "image/png");
    });

  const guardar = async () => {
    if (!hayTrazo) return mostrarAlerta("Dibuja tu firma antes de guardarla.", "error");
    setOcupado(true);
    try {
      const datos = new FormData();
      datos.append("firma", await exportar(), "firma.png");
      const r = await axios.put(`${API_URL}/firma/mia`, datos, { headers });
      setGuardada(r.data.imagen);
      onCambio?.(r.data.imagen);
      setDibujando(false);
      mostrarAlerta(mensajeGuardada, "success");
    } catch (err) {
      mostrarAlerta(err.response?.data?.message || "No se pudo guardar la firma.", "error");
    } finally {
      setOcupado(false);
    }
  };

  const eliminar = async () => {
    if (!window.confirm(confirmarEliminar)) return;
    setOcupado(true);
    try {
      await axios.delete(`${API_URL}/firma/mia`, { headers });
      setGuardada(null);
      onCambio?.(null);
      mostrarAlerta("Firma eliminada.", "success");
    } catch (err) {
      mostrarAlerta(err.response?.data?.message || "No se pudo eliminar la firma.", "error");
    } finally {
      setOcupado(false);
    }
  };

  return (
    <div>
      {titulo && (
        <h6 className="fw-bold mb-1">
          <FaSignature className="me-2" />
          Firma digital
        </h6>
      )}
      <p className="text-muted small mb-3">
        {descripcion} Puedes firmar con el dedo, con el lápiz de la tablet o con el mouse.
      </p>

      {!dibujando && (
        <>
          {guardada === undefined ? (
            <div className="spinner-border spinner-border-sm text-success" />
          ) : guardada ? (
            <div className="p-3 mb-3 text-center" style={{ border: "1px solid #e2e8f0", borderRadius: 12, background: "#fff" }}>
              <img src={guardada} alt="Tu firma" style={{ maxWidth: "100%", maxHeight: 110 }} />
            </div>
          ) : (
            <div className="alert alert-warning py-2 small">Aún no has guardado tu firma.</div>
          )}
          <div className="d-flex flex-wrap gap-2">
            <button className="btn fw-semibold" style={{ background: "#a8cd3a", color: "#1a2a00" }} onClick={abrirLienzo}>
              <FaSignature className="me-1" /> {guardada ? "Cambiar firma" : "Dibujar mi firma"}
            </button>
            {guardada && (
              <button className="btn btn-outline-danger" disabled={ocupado} onClick={eliminar}>
                <FaTrash className="me-1" /> Eliminar
              </button>
            )}
          </div>
        </>
      )}

      {dibujando && (
        <div
          style={
            completa
              ? { position: "fixed", inset: 0, zIndex: 8000, background: "#f8fafc", display: "flex", flexDirection: "column", padding: 16 }
              : undefined
          }
        >
          {completa && (
            <div className="mb-2">
              <div className="fw-bold">
                <FaSignature className="me-2" />
                Dibuja tu firma
              </div>
              <div className="small text-muted">Usa todo el recuadro. Si giras el celular tendrás aún más espacio.</div>
            </div>
          )}
          <div style={completa ? { position: "relative", flex: 1, minHeight: 0 } : { position: "relative" }}>
            <canvas
              ref={lienzo}
              style={{
                display: "block",
                width: "100%",
                height: completa ? "100%" : 220,
                border: "2px dashed #94a3b8",
                borderRadius: 12,
                background: "#fff",
                touchAction: "none",
                cursor: "crosshair",
              }}
              onPointerDown={empezar}
              onPointerMove={mover}
              onPointerUp={terminar}
              onPointerCancel={terminar}
              onPointerLeave={terminar}
            />
            <div
              style={{ position: "absolute", left: "8%", right: "8%", bottom: completa ? "30%" : "22%", borderBottom: "1px solid #cbd5e1", pointerEvents: "none" }}
            />
            {!hayTrazo && (
              <div className="text-muted small" style={{ position: "absolute", top: 10, left: 14, pointerEvents: "none" }}>
                Firma aquí
              </div>
            )}
          </div>
          <div className="d-flex flex-wrap gap-2 mt-3">
            <button className="btn fw-semibold" style={{ background: "#a8cd3a", color: "#1a2a00" }} disabled={ocupado} onClick={guardar}>
              <FaSave className="me-1" /> {ocupado ? "Guardando..." : "Guardar firma"}
            </button>
            <button className="btn btn-outline-secondary" disabled={ocupado} onClick={limpiar}>
              <FaEraser className="me-1" /> Borrar y repetir
            </button>
            <button className="btn btn-link text-secondary" disabled={ocupado} onClick={() => setDibujando(false)}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
