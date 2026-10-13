// Comprobante de un pago reportado por el socio: se pide con la sesión y se abre en otra pestaña.
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export const verComprobanteReportado = async (idReporte, token) => {
  // La pestaña se abre antes de descargar para que el celular no la bloquee
  const ventana = window.open("", "_blank");
  try {
    const r = await axios.get(`${API_URL}/pagos-reportados/${idReporte}/comprobante`, {
      headers: { Authorization: `Bearer ${token}` },
      responseType: "blob",
    });
    const url = URL.createObjectURL(r.data);
    if (ventana) ventana.location.href = url;
    else window.location.href = url;
    setTimeout(() => URL.revokeObjectURL(url), 120000);
  } catch {
    if (ventana) ventana.close();
    throw new Error("No se pudo abrir el comprobante.");
  }
};
