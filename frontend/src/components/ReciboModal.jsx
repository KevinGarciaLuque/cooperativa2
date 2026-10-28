import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { FaPrint, FaTimes, FaWhatsapp, FaFilePdf, FaCamera, FaCheckCircle, FaSignature } from "react-icons/fa";
import FirmaDigital from "./FirmaDigital";
import { generarReciboPdf, nombreArchivoRecibo } from "../utils/reciboPdf";
import { comprimirImagen } from "../utils/imagen";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const fmt = (n) =>
  `L. ${parseFloat(n || 0).toLocaleString("es-HN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const TIPOS = {
  pago_prestamo: "Recibo de pago de préstamo",
  aportacion: "Recibo de aportación",
  desembolso: "Comprobante de desembolso",
  consolidacion: "Convenio de consolidación de préstamos",
  finiquito: "Constancia de cancelación de préstamo",
};

const METODOS = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  cheque: "Cheque",
  deposito: "Depósito",
  cuenta: "Depósito a cuenta del socio",
};

const formatearFecha = (f) => {
  const d = new Date(f);
  return isNaN(d)
    ? ""
    : d.toLocaleString("es-HN", { dateStyle: "long", timeStyle: "short" });
};

// Muestra un recibo por su id, o lo busca por la operación que lo originó
// (referenciaTipo + referenciaId). Incluye impresión.
export default function ReciboModal({ idRecibo, referenciaTipo, referenciaId, finiquitoDe, onClose }) {
  const { token, user } = useAuth();
  const [recibo, setRecibo] = useState(null);
  const [error, setError] = useState("");
  const [generando, setGenerando] = useState(false);
  const [verFiniquito, setVerFiniquito] = useState(false);
  const [aviso, setAviso] = useState("");
  const [version, setVersion] = useState(0);
  const [subiendo, setSubiendo] = useState(false);
  const inputArchivo = useRef(null);
  const [firmando, setFirmando] = useState(false); // panel para firmar digitalmente abierto
  const [miFirma, setMiFirma] = useState(undefined); // firma del perfil del socio
  const [cambiandoFirma, setCambiandoFirma] = useState(false);
  const [firmandoAhora, setFirmandoAhora] = useState(false);
  const esSocio = user?.rol === "Socio";

  useEffect(() => {
    let activo = true;
    const headers = { Authorization: `Bearer ${token}` };
    let url;
    if (finiquitoDe) url = `${API_URL}/recibos/finiquito/${finiquitoDe}`;
    else if (idRecibo) url = `${API_URL}/recibos/${idRecibo}`;
    else url = `${API_URL}/recibos/buscar?referencia_tipo=${referenciaTipo}&referencia_id=${referenciaId}`;
    axios
      .get(url, { headers })
      .then((res) => activo && setRecibo(res.data.data))
      .catch((err) =>
        activo && setError(err.response?.data?.message || "No se pudo cargar el recibo.")
      );
    return () => {
      activo = false;
    };
  }, [idRecibo, referenciaTipo, referenciaId, finiquitoDe, token, version]);

  const d = recibo?.detalle || {};
  const firmado = !!(recibo?.firma_digital || recibo?.comprobante_firmado);
  // El comprobante de entrega y el convenio de consolidación deben firmarse
  const esEntrega = recibo?.tipo === "desembolso" || recibo?.tipo === "consolidacion";
  const pideFirma = esEntrega && !firmado;

  // Firma del perfil del socio, para mostrarla antes de firmar
  useEffect(() => {
    if (!firmando || miFirma !== undefined) return;
    axios
      .get(`${API_URL}/firma/mia`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => setMiFirma(r.data.imagen || null))
      .catch(() => setMiFirma(null));
  }, [firmando, miFirma, token]);

  const firmar = async () => {
    setFirmandoAhora(true);
    setAviso("");
    try {
      const r = await axios.post(`${API_URL}/recibos/${recibo.id_recibo}/firmar`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setRecibo(r.data.data);
      setFirmando(false);
      setAviso("¡Listo! Firmaste este documento.");
    } catch (err) {
      if (err.response?.data?.sin_firma) setMiFirma(null);
      setAviso(err.response?.data?.message || "No se pudo firmar el documento.");
    } finally {
      setFirmandoAhora(false);
    }
  };

  const subirFirmado = async (e) => {
    const original = e.target.files?.[0];
    e.target.value = "";
    if (!original) return;
    setSubiendo(true);
    setAviso("");
    try {
      const archivo = await comprimirImagen(original);
      const datos = new FormData();
      datos.append("archivo", archivo);
      await axios.post(`${API_URL}/recibos/${recibo.id_recibo}/comprobante-firmado`, datos, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setAviso("Comprobante firmado recibido. ¡Gracias!");
      setVersion((v) => v + 1);
    } catch (err) {
      setAviso(err.response?.data?.message || "No se pudo subir el archivo.");
    } finally {
      setSubiendo(false);
    }
  };

  const verFirmado = async () => {
    try {
      const r = await axios.get(`${API_URL}/recibos/${recibo.id_recibo}/comprobante-firmado`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: "blob",
      });
      const url = URL.createObjectURL(r.data);
      window.open(url, "_blank", "noopener");
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch {
      setAviso("No se pudo abrir el comprobante firmado.");
    }
  };

  const descargarArchivo = (blob, nombre) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  const descargarPdf = async () => {
    setGenerando(true);
    setAviso("");
    try {
      const blob = await generarReciboPdf(recibo);
      descargarArchivo(blob, nombreArchivoRecibo(recibo));
    } catch {
      setAviso("No se pudo generar el PDF.");
    } finally {
      setGenerando(false);
    }
  };

  // Comparte el PDF: en el celular abre WhatsApp (u otra app) con el archivo adjunto.
  // En computadora descarga el PDF y abre el chat del socio para adjuntarlo.
  const compartir = async () => {
    setGenerando(true);
    setAviso("");
    try {
      const blob = await generarReciboPdf(recibo);
      const nombre = nombreArchivoRecibo(recibo);
      const archivo = new File([blob], nombre, { type: "application/pdf" });
      const montoTxt = parseFloat(recibo.monto).toLocaleString("es-HN", { minimumFractionDigits: 2 });
      const texto =
        recibo.tipo === "finiquito"
          ? `${recibo.cooperativa}: constancia de cancelación ${recibo.numero}. Tu préstamo de L. ${montoTxt} está totalmente pagado. ¡Felicidades!`
          : `${recibo.cooperativa}: recibo ${recibo.numero} por L. ${montoTxt}. ¡Gracias!`;

      if (navigator.canShare && navigator.canShare({ files: [archivo] })) {
        try {
          await navigator.share({ files: [archivo], title: `Recibo ${recibo.numero}`, text: texto });
          return;
        } catch (e) {
          if (e?.name === "AbortError") return; // el usuario cerró el menú de compartir
        }
      }

      descargarArchivo(blob, nombre);
      const tel = String(recibo.socio?.telefono || "").replace(/\D/g, "");
      const numero = tel.length === 8 ? `504${tel}` : tel;
      const enlace = numero
        ? `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`
        : `https://wa.me/?text=${encodeURIComponent(texto)}`;
      window.open(enlace, "_blank", "noopener");
      setAviso("El PDF se descargó. En WhatsApp, adjúntalo al chat que se abrió.");
    } catch {
      setAviso("No se pudo preparar el recibo para compartir.");
    } finally {
      setGenerando(false);
    }
  };

  return createPortal(
    <div
      className="recibo-portal modal show d-block"
      style={{ background: "rgba(0,0,0,.6)", zIndex: 6000, position: "fixed", inset: 0, overflowY: "auto" }}
    >
      <style>{`
        @media print {
          @page { size: A5 portrait; margin: 0; }
          html, body { background: #fff !important; height: auto !important; }
          body > #root { display: none !important; }
          .recibo-portal { position: static !important; background: none !important; overflow: visible !important; }
          .recibo-portal .modal-dialog { margin: 0 !important; max-width: 100% !important; min-height: 0 !important; display: block !important; }
          .recibo-portal .modal-content { border: 0 !important; box-shadow: none !important; border-radius: 0 !important; }
          .recibo-print { padding: 16mm !important; }
          .recibo-no-print { display: none !important; }
        }
      `}</style>
      <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: 520 }}>
        <div className="modal-content border-0 shadow-lg" style={{ borderRadius: 16 }}>
          <div className="recibo-no-print d-flex justify-content-between align-items-center px-3 py-2 border-bottom">
            <span className="fw-semibold small text-muted">Recibo</span>
            <div className="d-flex gap-2">
              <button
                className="btn btn-sm fw-semibold"
                style={{ background: "#25D366", color: "#fff" }}
                onClick={compartir}
                disabled={!recibo || generando}
                title="Enviar el recibo en PDF por WhatsApp"
              >
                <FaWhatsapp className="me-1" /> Compartir
              </button>
              <button className="btn btn-sm btn-outline-dark" onClick={descargarPdf} disabled={!recibo || generando}>
                <FaFilePdf className="me-1" /> PDF
              </button>
              {recibo?.tipo === "pago_prestamo" && d.liquidado && d.id_prestamo && !recibo.anulado && (
                <button className="btn btn-sm btn-outline-success" onClick={() => setVerFiniquito(true)}>
                  Constancia de finiquito
                </button>
              )}
              <button className="btn btn-sm btn-dark" onClick={() => window.print()} disabled={!recibo}>
                <FaPrint className="me-1" /> Imprimir
              </button>
              <button className="btn btn-sm btn-outline-secondary" onClick={onClose}>
                <FaTimes />
              </button>
            </div>
          </div>

          {/* Firma del socio: digital desde la app o copia firmada a mano (foto o PDF) */}
          {recibo && !recibo.anulado && recibo.tipo !== "finiquito" && (esSocio || esEntrega || firmado) && (
            <div
              className="recibo-no-print mx-3 mt-2 p-2 px-3 rounded-3"
              style={{
                background: firmado ? "#ecfdf5" : pideFirma ? "#fffbeb" : "#f8fafc",
                border: `1px solid ${firmado ? "#a7f3d0" : pideFirma ? "#fde68a" : "#e2e8f0"}`,
              }}
            >
              <div className="d-flex flex-wrap align-items-center justify-content-between gap-2">
                <div className="small">
                  {recibo.firma_digital ? (
                    <span style={{ color: "#065f46" }}>
                      <FaCheckCircle className="me-1" />
                      Firmado digitalmente por el socio el {formatearFecha(recibo.firma_digital.firmado_en)}
                    </span>
                  ) : recibo.comprobante_firmado ? (
                    <span style={{ color: "#065f46" }}>
                      <FaCheckCircle className="me-1" />
                      Copia firmada recibida el {String(recibo.comprobante_firmado.subido_en).substring(0, 10)}
                      {recibo.comprobante_firmado.revisado && " · revisada por la cooperativa"}
                    </span>
                  ) : esSocio ? (
                    <span style={{ color: pideFirma ? "#92400e" : "#475569" }}>
                      {pideFirma ? "Falta tu firma en este comprobante." : "Puedes firmar este recibo."} Fírmalo desde la app o
                      imprímelo, fírmalo a mano y sube una foto.
                    </span>
                  ) : (
                    <span style={{ color: "#92400e" }}>
                      Falta la firma del socio. Puede firmarlo desde su app, o sube aquí la foto del comprobante firmado.
                    </span>
                  )}
                </div>
                <div className="d-flex flex-wrap gap-2">
                  {recibo.comprobante_firmado && (
                    <button className="btn btn-sm btn-outline-success" onClick={verFirmado}>
                      Ver copia firmada
                    </button>
                  )}
                  {esSocio && !recibo.firma_digital && !recibo.comprobante_firmado && (
                    <button
                      className="btn btn-sm fw-semibold"
                      style={{ background: "#a8cd3a", color: "#1a2a00" }}
                      onClick={() => setFirmando((f) => !f)}
                    >
                      <FaSignature className="me-1" /> Firmar digitalmente
                    </button>
                  )}
                  {!recibo.firma_digital && !(esSocio && recibo.comprobante_firmado?.revisado) && (
                    <button
                      className="btn btn-sm btn-dark"
                      onClick={() => inputArchivo.current?.click()}
                      disabled={subiendo}
                    >
                      <FaCamera className="me-1" />
                      {subiendo ? "Subiendo..." : recibo.comprobante_firmado ? "Reemplazar copia" : "Subir copia firmada"}
                    </button>
                  )}
                  <input
                    ref={inputArchivo}
                    type="file"
                    accept="image/*,application/pdf"
                    className="d-none"
                    onChange={subirFirmado}
                  />
                </div>
              </div>

              {firmando && (
                <div className="mt-3 pt-3 border-top">
                  {miFirma === undefined ? (
                    <div className="spinner-border spinner-border-sm text-success" />
                  ) : cambiandoFirma || !miFirma ? (
                    <FirmaDigital
                      token={token}
                      titulo={false}
                      descripcion={miFirma ? "Dibuja tu nueva firma." : "Primero dibuja tu firma. Se guarda en tu perfil para firmar tus próximos documentos."}
                      mensajeGuardada="Firma guardada."
                      confirmarEliminar="¿Eliminar tu firma? Los documentos que ya firmaste la conservan."
                      onCambio={(img) => {
                        setMiFirma(img);
                        if (img) setCambiandoFirma(false);
                      }}
                    />
                  ) : (
                    <>
                      <div className="small text-muted mb-2">Tu firma:</div>
                      <div className="p-2 mb-2 text-center bg-white" style={{ border: "1px solid #e2e8f0", borderRadius: 10 }}>
                        <img src={miFirma} alt="Tu firma" style={{ maxWidth: "100%", maxHeight: 80 }} />
                      </div>
                      <div className="small mb-2">
                        Al firmar confirmas que {recibo.tipo === "desembolso" ? "recibiste" : recibo.tipo === "consolidacion" ? "aceptas el préstamo consolidado de" : "entregaste"}{" "}
                        <strong>{fmt(recibo.monto)}</strong> según este documento ({recibo.numero}). La firma queda
                        guardada en el documento y no se puede quitar.
                      </div>
                      <div className="d-flex flex-wrap gap-2">
                        <button
                          className="btn btn-sm fw-bold"
                          style={{ background: "#16a34a", color: "#fff" }}
                          disabled={firmandoAhora}
                          onClick={firmar}
                        >
                          <FaSignature className="me-1" /> {firmandoAhora ? "Firmando..." : "Firmar con mi firma"}
                        </button>
                        <button className="btn btn-sm btn-link" onClick={() => setCambiandoFirma(true)}>
                          Cambiar mi firma
                        </button>
                        <button className="btn btn-sm btn-outline-secondary" onClick={() => setFirmando(false)}>
                          Cancelar
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {aviso && (
            <div className="recibo-no-print alert alert-info py-2 mx-3 mt-2 mb-0 small">{aviso}</div>
          )}

          {verFiniquito && (
            <ReciboModal finiquitoDe={d.id_prestamo} onClose={() => setVerFiniquito(false)} />
          )}

          <div className="recibo-print p-4">
            {error && <div className="alert alert-warning mb-0">{error}</div>}
            {!recibo && !error && (
              <div className="text-center py-4">
                <div className="spinner-border spinner-border-sm text-success" />
              </div>
            )}
            {recibo && (
              <>
                <div className="text-center mb-3">
                  <img src="/smartcoop.png" alt="SmartCoop" style={{ height: 64, marginBottom: 6 }} />
                  <div className="fw-bold fs-5">{recibo.cooperativa}</div>
                  <div className="text-muted small">{TIPOS[recibo.tipo] || "Recibo"}</div>
                  <div className="fw-bold mt-1" style={{ letterSpacing: 1 }}>N.º {recibo.numero}</div>
                  {recibo.anulado && (
                    <div className="mt-2 fw-bold" style={{ color: "#c0392b", border: "2px solid #c0392b", display: "inline-block", padding: "2px 12px", borderRadius: 6 }}>
                      ANULADO
                    </div>
                  )}
                </div>

                <div className="small mb-3">
                  <div className="d-flex justify-content-between py-1 border-bottom">
                    <span className="text-muted">Fecha</span>
                    <span>{formatearFecha(recibo.fecha)}</span>
                  </div>
                  {recibo.socio && (
                    <>
                      <div className="d-flex justify-content-between py-1 border-bottom">
                        <span className="text-muted">Socio</span>
                        <span className="fw-semibold">{recibo.socio.nombre}</span>
                      </div>
                      <div className="d-flex justify-content-between py-1 border-bottom">
                        <span className="text-muted">Identidad</span>
                        <span>{recibo.socio.dni}</span>
                      </div>
                    </>
                  )}
                  <div className="d-flex justify-content-between py-1 border-bottom">
                    <span className="text-muted">Concepto</span>
                    <span className="text-end">{recibo.concepto}</span>
                  </div>
                  <div className="d-flex justify-content-between py-1 border-bottom">
                    <span className="text-muted">Forma de pago</span>
                    <span>{METODOS[recibo.metodo] || recibo.metodo || "—"}</span>
                  </div>
                  {recibo.tipo === "pago_prestamo" && (
                    <>
                      <div className="d-flex justify-content-between py-1 border-bottom">
                        <span className="text-muted">Abono a capital</span>
                        <span>{fmt(d.capital)}</span>
                      </div>
                      <div className="d-flex justify-content-between py-1 border-bottom">
                        <span className="text-muted">Intereses</span>
                        <span>{fmt(d.interes)}</span>
                      </div>
                      {parseFloat(d.mora) > 0 && (
                        <div className="d-flex justify-content-between py-1 border-bottom">
                          <span className="text-muted">Mora</span>
                          <span>{fmt(d.mora)}</span>
                        </div>
                      )}
                      <div className="d-flex justify-content-between py-1 border-bottom">
                        <span className="text-muted">Saldo del préstamo</span>
                        <span className="fw-semibold">{d.liquidado ? "Liquidado" : fmt(d.saldo_nuevo)}</span>
                      </div>
                    </>
                  )}
                  {recibo.tipo === "aportacion" && d.saldo_nuevo != null && (
                    <div className="d-flex justify-content-between py-1 border-bottom">
                      <span className="text-muted">Saldo de la cuenta {d.cuenta}</span>
                      <span className="fw-semibold">{fmt(d.saldo_nuevo)}</span>
                    </div>
                  )}
                  {recibo.tipo === "finiquito" && (
                    <>
                      <div className="d-flex justify-content-between py-1 border-bottom">
                        <span className="text-muted">Préstamo</span>
                        <span>N.º {d.id_prestamo}</span>
                      </div>
                      <div className="d-flex justify-content-between py-1 border-bottom">
                        <span className="text-muted">Otorgado el</span>
                        <span>{formatearFecha(d.fecha_otorgado).split(",")[0]}</span>
                      </div>
                      <div className="d-flex justify-content-between py-1 border-bottom">
                        <span className="text-muted">Total pagado</span>
                        <span>{fmt(d.total_pagado)}</span>
                      </div>
                      <div className="py-2 fw-semibold text-success">
                        Préstamo cancelado en su totalidad: el socio está a paz y salvo.
                      </div>
                    </>
                  )}
                  {recibo.tipo === "consolidacion" && (
                    <>
                      <div className="d-flex justify-content-between py-1 border-bottom">
                        <span className="text-muted">Préstamos consolidados</span>
                        <span className="text-end">{(d.prestamos || []).map((p) => `#${p.id_prestamo}`).join(", ")}</span>
                      </div>
                      <div className="d-flex justify-content-between py-1 border-bottom">
                        <span className="text-muted">Capital que se debía</span>
                        <span>{fmt(d.capital)}</span>
                      </div>
                      <div className="d-flex justify-content-between py-1 border-bottom">
                        <span className="text-muted">Interés acumulado sumado</span>
                        <span>{fmt(d.interes_capitalizado)}</span>
                      </div>
                      {parseFloat(d.mora_capitalizada) > 0 && (
                        <div className="d-flex justify-content-between py-1 border-bottom">
                          <span className="text-muted">Mora sumada</span>
                          <span>{fmt(d.mora_capitalizada)}</span>
                        </div>
                      )}
                      {parseFloat(d.adicional) > 0 && (
                        <div className="d-flex justify-content-between py-1 border-bottom">
                          <span className="text-muted">Dinero adicional entregado</span>
                          <span>{fmt(d.adicional)}</span>
                        </div>
                      )}
                      <div className="d-flex justify-content-between py-1 border-bottom">
                        <span className="text-muted">Plazo</span>
                        <span>{d.plazo_meses} meses</span>
                      </div>
                      <div className="d-flex justify-content-between py-1 border-bottom">
                        <span className="text-muted">Tasa mensual</span>
                        <span>{parseFloat(d.tasa_mensual)}%</span>
                      </div>
                      <div className="d-flex justify-content-between py-1 border-bottom">
                        <span className="text-muted">Cuota mensual</span>
                        <span className="fw-semibold">{fmt(d.cuota)}</span>
                      </div>
                      <div className="d-flex justify-content-between py-1 border-bottom">
                        <span className="text-muted">Primer vencimiento</span>
                        <span>{d.primer_vencimiento}</span>
                      </div>
                    </>
                  )}
                  {recibo.tipo === "desembolso" && (
                    <>
                      {d.plazo_meses != null && (
                        <div className="d-flex justify-content-between py-1 border-bottom">
                          <span className="text-muted">Plazo</span>
                          <span>{parseInt(d.plazo_meses) === 0 ? "Indefinido" : `${d.plazo_meses} meses`}</span>
                        </div>
                      )}
                      {d.referencia && (
                        <div className="d-flex justify-content-between py-1 border-bottom">
                          <span className="text-muted">Referencia</span>
                          <span>{d.referencia}</span>
                        </div>
                      )}
                    </>
                  )}
                </div>

                <div
                  className="d-flex justify-content-between align-items-center p-3 mb-4"
                  style={{ background: "#f1f5f9", borderRadius: 10 }}
                >
                  <span className="fw-semibold">
                    {recibo.tipo === "desembolso" ? "Monto entregado" : recibo.tipo === "consolidacion" ? "Préstamo consolidado" : recibo.tipo === "finiquito" ? "Monto del préstamo" : "Monto recibido"}
                  </span>
                  <span className="fw-bold fs-4">{fmt(recibo.monto)}</span>
                </div>

                <div className="row text-center small text-muted align-items-end" style={{ marginTop: 36 }}>
                  <div className="col-6">
                    {recibo.firma_emisor && (
                      <img src={recibo.firma_emisor} alt="Firma" style={{ height: 52, maxWidth: "100%", objectFit: "contain", marginBottom: -6 }} />
                    )}
                    <div style={{ borderTop: "1px solid #94a3b8", paddingTop: 4 }}>
                      {recibo.emitido_por || "Cajero"}
                      <div>{recibo.tipo === "consolidacion" ? "Por la cooperativa" : "Recibido por"}</div>
                    </div>
                  </div>
                  <div className="col-6">
                    {recibo.firma_socio && (
                      <img src={recibo.firma_socio} alt="Firma del socio" style={{ height: 52, maxWidth: "100%", objectFit: "contain", marginBottom: -6 }} />
                    )}
                    <div style={{ borderTop: "1px solid #94a3b8", paddingTop: 4 }}>
                      {recibo.socio?.nombre || "Socio"}
                      <div>{recibo.tipo === "desembolso" ? "Recibí conforme" : recibo.tipo === "consolidacion" ? "Acepto las condiciones" : "Entregado por"}</div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
