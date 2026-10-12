// Carta de aprobación de préstamo: el PDF lo genera el servidor (el mismo que se envía por correo).
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const nombreArchivo = (idPrestamo) => `Carta-aprobacion-prestamo-${idPrestamo}.pdf`;

const obtener = async (idPrestamo, token) => {
  const r = await axios.get(`${API_URL}/solicitudes/prestamos/${idPrestamo}/carta`, {
    headers: { Authorization: `Bearer ${token}` },
    responseType: "blob",
  });
  return r.data;
};

const guardar = (blob, nombre) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
};

export const descargarCarta = async (idPrestamo, token) => {
  guardar(await obtener(idPrestamo, token), nombreArchivo(idPrestamo));
};

// En el celular abre WhatsApp (u otra app) con el PDF adjunto. En computadora descarga
// el PDF y abre el chat del socio para adjuntarlo. Devuelve un aviso para mostrar, o "".
export const compartirCarta = async (idPrestamo, token, { telefono, cooperativa } = {}) => {
  const blob = await obtener(idPrestamo, token);
  const nombre = nombreArchivo(idPrestamo);
  const archivo = new File([blob], nombre, { type: "application/pdf" });
  const texto = `${cooperativa || "La cooperativa"}: ¡tu préstamo fue aprobado! Te enviamos la carta de aprobación.`;

  if (navigator.canShare && navigator.canShare({ files: [archivo] })) {
    try {
      await navigator.share({ files: [archivo], title: "Carta de aprobación", text: texto });
      return "";
    } catch (e) {
      if (e?.name === "AbortError") return "";
    }
  }

  guardar(blob, nombre);
  const tel = String(telefono || "").replace(/\D/g, "");
  const numero = tel.length === 8 ? `504${tel}` : tel;
  window.open(
    numero ? `https://wa.me/${numero}?text=${encodeURIComponent(texto)}` : `https://wa.me/?text=${encodeURIComponent(texto)}`,
    "_blank",
    "noopener"
  );
  return "La carta se descargó. En WhatsApp, adjúntala al chat que se abrió.";
};
