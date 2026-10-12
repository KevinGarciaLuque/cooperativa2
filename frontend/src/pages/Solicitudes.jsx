import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useAlerta } from "../context/AlertaContext";
import { FaInbox, FaLink, FaCopy, FaWhatsapp, FaSyncAlt, FaFilePdf, FaEnvelope } from "react-icons/fa";
import { EmptyState, PageHeader } from "../ui/Componentes";
import InputMonto from "../ui/InputMonto";
import DesembolsoModal from "../components/DesembolsoModal";
import ReciboModal from "../components/ReciboModal";
import FotosIdentidad from "../components/FotosIdentidad";
import AvalReferencias from "../components/AvalReferencias";
import { useConfigSitio } from "../hooks/useConfigSitio";
import { OCUPACIONES, PROPOSITOS, fmt } from "../utils/solicitud";
import { compartirCarta, descargarCarta } from "../utils/cartaAprobacion";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const ACCENT = "#a8cd3a";

export default function Solicitudes() {
  const { token } = useAuth();
  const { mostrarAlerta } = useAlerta();
  const navigate = useNavigate();
  const { config: sitio } = useConfigSitio();
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const [tab, setTab] = useState("prestamos");
  const [data, setData] = useState(null);
  const [enlace, setEnlace] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [revisando, setRevisando] = useState(null); // solicitud de préstamo en revisión
  const [condiciones, setCondiciones] = useState({ monto: "", plazo_meses: "", tasa_mensual: "", aprobar_socio: true });
  const [procesando, setProcesando] = useState(false);
  const [aDesembolsar, setADesembolsar] = useState(null);
  const [desembolsando, setDesembolsando] = useState(false);
  const [reciboAbierto, setReciboAbierto] = useState(null);
  const [sinFirma, setSinFirma] = useState([]);
  const [recibidos, setRecibidos] = useState([]);
  const [enviandoCarta, setEnviandoCarta] = useState(null);
  const [verIdentidad, setVerIdentidad] = useState(null); // { id_usuario, nombre_completo }

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [s, e, f, rc] = await Promise.all([
        axios.get(`${API_URL}/solicitudes`, { headers }),
        axios.get(`${API_URL}/solicitudes/enlace`, { headers }),
        axios.get(`${API_URL}/solicitudes/desembolsos-sin-firma`, { headers }).catch(() => ({ data: { data: [] } })),
        axios.get(`${API_URL}/solicitudes/comprobantes-recibidos`, { headers }).catch(() => ({ data: { data: [] } })),
      ]);
      setData(s.data);
      setEnlace(e.data);
      setSinFirma(f.data.data || []);
      setRecibidos(rc.data.data || []);
    } catch {
      mostrarAlerta("No se pudieron cargar las solicitudes.", "error");
    } finally {
      setCargando(false);
    }
    // eslint-disable-next-line
  }, [headers]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const urlRegistro = enlace
    ? `${window.location.origin}/registro${enlace.codigo ? `?c=${enlace.codigo}` : ""}`
    : "";

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(urlRegistro);
      mostrarAlerta("Enlace copiado.", "success");
    } catch {
      window.prompt("Copia el enlace:", urlRegistro);
    }
  };

  const compartirWhatsapp = () => {
    const texto = `Te invitamos a nuestra cooperativa. Calcula tu cuota, hazte socio y solicita tu préstamo aquí: ${urlRegistro}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, "_blank", "noopener");
  };

  const actualizarEnlace = async (cambios, confirmacion) => {
    if (confirmacion && !window.confirm(confirmacion)) return;
    try {
      const r = await axios.put(`${API_URL}/solicitudes/enlace`, cambios, { headers });
      setEnlace(r.data);
      mostrarAlerta("Enlace actualizado.", "success");
    } catch (err) {
      mostrarAlerta(err.response?.data?.message || "No se pudo actualizar el enlace.", "error");
    }
  };

  const aprobarSocio = async (s) => {
    if (!window.confirm(`¿Aprobar a ${s.nombre_completo} como socio? Se le crearán sus cuentas.`)) return;
    try {
      await axios.post(`${API_URL}/solicitudes/socios/${s.id_usuario}/aprobar`, {}, { headers });
      mostrarAlerta("Socio aprobado.", "success");
      cargar();
    } catch (err) {
      mostrarAlerta(err.response?.data?.message || "No se pudo aprobar al socio.", "error");
    }
  };

  const rechazarSocio = async (s) => {
    const motivo = window.prompt(`Motivo para rechazar a ${s.nombre_completo}:`);
    if (motivo === null) return;
    try {
      await axios.post(`${API_URL}/solicitudes/socios/${s.id_usuario}/rechazar`, { motivo }, { headers });
      mostrarAlerta("Solicitud de socio rechazada.", "success");
      cargar();
    } catch (err) {
      mostrarAlerta(err.response?.data?.message || "No se pudo rechazar.", "error");
    }
  };

  const abrirRevision = (p) => {
    setRevisando(p);
    setCondiciones({
      monto: String(p.monto),
      plazo_meses: String(p.plazo_meses),
      tasa_mensual: String(p.tasa_referencial ?? p.tasa_original ?? ""),
      aprobar_socio: p.estado_socio === "pendiente",
    });
  };

  const aprobarPrestamo = async () => {
    setProcesando(true);
    try {
      const r = await axios.post(
        `${API_URL}/solicitudes/prestamos/${revisando.id_prestamo}/aprobar`,
        {
          monto: parseFloat(condiciones.monto),
          plazo_meses: parseInt(condiciones.plazo_meses),
          tasa_mensual: parseFloat(condiciones.tasa_mensual),
          aprobar_socio: condiciones.aprobar_socio,
        },
        { headers }
      );
      mostrarAlerta(r.data.message, "success");
      setRevisando(null);
      cargar();
    } catch (err) {
      mostrarAlerta(err.response?.data?.message || "No se pudo aprobar la solicitud.", "error");
    } finally {
      setProcesando(false);
    }
  };

  const rechazarPrestamo = async (p) => {
    const motivo = window.prompt(`Motivo para rechazar la solicitud de ${p.nombre_completo}:`);
    if (motivo === null) return;
    try {
      await axios.patch(`${API_URL}/prestamos/${p.id_prestamo}/rechazar`, { motivo }, { headers });
      mostrarAlerta("Solicitud rechazada.", "success");
      setRevisando(null);
      cargar();
    } catch (err) {
      mostrarAlerta(err.response?.data?.message || "No se pudo rechazar.", "error");
    }
  };

  // Carta de aprobación: descargar, compartir por WhatsApp o reenviar al correo del socio
  const bajarCarta = async (p) => {
    try {
      await descargarCarta(p.id_prestamo, token);
    } catch {
      mostrarAlerta("No se pudo descargar la carta.", "error");
    }
  };

  const whatsappCarta = async (p) => {
    try {
      const aviso = await compartirCarta(p.id_prestamo, token, { telefono: p.telefono, cooperativa: sitio?.site_name });
      if (aviso) mostrarAlerta(aviso, "success");
    } catch {
      mostrarAlerta("No se pudo preparar la carta para compartir.", "error");
    }
  };

  const correoCarta = async (p) => {
    setEnviandoCarta(p.id_prestamo);
    try {
      const r = await axios.post(`${API_URL}/solicitudes/prestamos/${p.id_prestamo}/carta/enviar`, {}, { headers });
      mostrarAlerta(r.data.message, "success");
    } catch (err) {
      mostrarAlerta(err.response?.data?.message || "No se pudo enviar la carta.", "error");
    } finally {
      setEnviandoCarta(null);
    }
  };

  const confirmarDesembolso = async ({ metodo, referencia }) => {
    setDesembolsando(true);
    try {
      const r = await axios.post(
        `${API_URL}/prestamos/${aDesembolsar.id_prestamo}/desembolsar`,
        { metodo, referencia },
        { headers }
      );
      mostrarAlerta("Préstamo desembolsado correctamente.", "success");
      setADesembolsar(null);
      if (r.data?.id_recibo) setReciboAbierto(r.data.id_recibo);
      cargar();
    } catch (err) {
      mostrarAlerta(err.response?.data?.message || "No se pudo registrar el desembolso.", "error");
    } finally {
      setDesembolsando(false);
    }
  };

  const nSocios = data?.socios.length || 0;
  const nPrestamos = data?.prestamos.filter((p) => p.estado === "pendiente").length || 0;
  const porDesembolsar = data?.prestamos.filter((p) => p.estado === "aprobado") || [];

  return (
    <div className="container-fluid py-3">
      <PageHeader
        icono={<FaInbox />}
        titulo="Solicitudes"
        subtitulo="Nuevos socios y solicitudes de préstamo que esperan tu revisión."
      />

      <ul className="nav nav-tabs mb-3">
        {[
          ["prestamos", `Solicitudes de préstamo${nPrestamos ? ` (${nPrestamos})` : ""}`],
          ["socios", `Nuevos socios${nSocios ? ` (${nSocios})` : ""}`],
          ["firmas", `Comprobantes firmados${recibidos.length ? ` (${recibidos.length} nuevos)` : ""}`],
          ["enlace", "Enlace de registro"],
        ].map(([k, t]) => (
          <li className="nav-item" key={k}>
            <button className={`nav-link ${tab === k ? "active fw-semibold" : ""}`} onClick={() => setTab(k)}>
              {t}
            </button>
          </li>
        ))}
      </ul>

      {cargando && !data && (
        <div className="text-center py-5">
          <div className="spinner-border text-success" />
        </div>
      )}

      {/* ── Solicitudes de préstamo ── */}
      {tab === "prestamos" && data && (
        <>
          {porDesembolsar.length > 0 && (
            <div className="ui-card p-3 mb-3" style={{ border: "1.5px solid #a7f3d0" }}>
              <div className="fw-bold mb-2" style={{ color: "#065f46" }}>
                Aprobadas, listas para desembolsar ({porDesembolsar.length})
              </div>
              {porDesembolsar.map((p) => (
                <div
                  key={p.id_prestamo}
                  className="d-flex flex-wrap justify-content-between align-items-center gap-2 py-2 border-top"
                >
                  <div>
                    <div className="fw-semibold">{p.nombre_completo}</div>
                    <div className="small text-muted">
                      {fmt(p.monto)} a {p.plazo_meses} meses · Préstamo #{p.id_prestamo}
                    </div>
                  </div>
                  <div className="d-flex flex-wrap gap-2">
                    <div className="btn-group">
                      <button className="btn btn-outline-dark" title="Descargar carta de aprobación" onClick={() => bajarCarta(p)}>
                        <FaFilePdf className="me-1" /> Carta
                      </button>
                      <button
                        className="btn btn-outline-dark"
                        title="Enviar la carta por WhatsApp"
                        onClick={() => whatsappCarta(p)}
                      >
                        <FaWhatsapp />
                      </button>
                      <button
                        className="btn btn-outline-dark"
                        title="Reenviar la carta al correo del socio"
                        disabled={enviandoCarta === p.id_prestamo}
                        onClick={() => correoCarta(p)}
                      >
                        <FaEnvelope />
                      </button>
                    </div>
                    <button
                      className="btn fw-semibold"
                      style={{ background: ACCENT, color: "#1a2a00" }}
                      onClick={() => setADesembolsar(p)}
                    >
                      Desembolsar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {data.prestamos.filter((p) => p.estado === "pendiente").length === 0 ? (
            <div className="ui-card">
              <EmptyState titulo="No hay solicitudes de préstamo pendientes" />
            </div>
          ) : (
            <div className="row g-3">
              {data.prestamos
                .filter((p) => p.estado === "pendiente")
                .map((p) => (
                  <div className="col-12 col-xl-6" key={p.id_prestamo}>
                    <div className="ui-card p-4 h-100">
                      <div className="d-flex justify-content-between align-items-start mb-2">
                        <div>
                          <div className="fw-bold fs-5">{p.nombre_completo}</div>
                          <div className="small text-muted">
                            Identidad {p.dni} · {p.telefono || "sin teléfono"} ·{" "}
                            {String(p.creada_en).substring(0, 10)}
                          </div>
                        </div>
                        {p.estado_socio === "pendiente" && (
                          <span className="badge" style={{ background: "#fef3c7", color: "#92400e" }}>
                            Socio sin aprobar
                          </span>
                        )}
                      </div>

                      <div className="row g-2 mb-3">
                        <div className="col-4">
                          <div className="small text-muted">Monto</div>
                          <div className="fw-bold">{fmt(p.monto)}</div>
                        </div>
                        <div className="col-4">
                          <div className="small text-muted">Plazo</div>
                          <div className="fw-bold">{p.plazo_meses} meses</div>
                        </div>
                        <div className="col-4">
                          <div className="small text-muted">Cuota estimada</div>
                          <div className="fw-bold">{fmt(p.cuota_estimada)}</div>
                        </div>
                        <div className="col-4">
                          <div className="small text-muted">Puede pagar</div>
                          <div className="fw-bold">{fmt(p.cuota_posible)}</div>
                        </div>
                        <div className="col-4">
                          <div className="small text-muted">Ingreso mensual</div>
                          <div className="fw-bold">{fmt(p.ingreso_mensual)}</div>
                        </div>
                        <div className="col-4">
                          <div className="small text-muted">Cuota / ingreso</div>
                          <div
                            className="fw-bold"
                            style={{ color: p.relacion_cuota_ingreso > 40 ? "#b91c1c" : "#047857" }}
                          >
                            {p.relacion_cuota_ingreso != null ? `${p.relacion_cuota_ingreso}%` : "—"}
                          </div>
                        </div>
                      </div>

                      <div className="small mb-2">
                        <strong>Destino:</strong> {PROPOSITOS[p.proposito] || p.proposito}
                        {p.descripcion && <> — {p.descripcion}</>}
                        <br />
                        <strong>Ocupación:</strong> {OCUPACIONES[p.ocupacion] || p.ocupacion}
                        {p.lugar_trabajo && <> · {p.lugar_trabajo}</>}
                      </div>

                      <div className="small text-muted mb-2">
                        Aportado: {fmt(p.total_aportado)} · Saldo en préstamos: {fmt(p.saldo_vigente)} · Préstamos
                        pagados: {p.prestamos_pagados}
                      </div>

                      <div className="mb-3">
                        <AvalReferencias referencias={p.referencias} vacio="Sin aval registrado." />
                      </div>

                      <div className="small mb-3">
                        <strong>Identidad:</strong>{" "}
                        {p.fotos_identidad >= 2 ? (
                          <span className="text-success">fotos recibidas</span>
                        ) : (
                          <span className="text-danger">{p.fotos_identidad ? "falta una foto" : "sin fotos"}</span>
                        )}{" "}
                        · <button className="btn btn-link btn-sm p-0 align-baseline" onClick={() => setVerIdentidad(p)}>
                          Ver identidad
                        </button>
                      </div>

                      <div className="d-flex gap-2">
                        <button
                          className="btn fw-semibold flex-fill"
                          style={{ background: ACCENT, color: "#1a2a00" }}
                          onClick={() => abrirRevision(p)}
                        >
                          Revisar y aprobar
                        </button>
                        <button className="btn btn-outline-danger" onClick={() => rechazarPrestamo(p)}>
                          Rechazar
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </>
      )}

      {/* ── Nuevos socios ── */}
      {tab === "socios" && data && (
        <div className="ui-card">
          {data.socios.length === 0 ? (
            <EmptyState titulo="No hay socios esperando aprobación" />
          ) : (
            <div className="table-responsive">
              <table className="table align-middle mb-0">
                <thead>
                  <tr className="small text-muted">
                    <th>Nombre</th>
                    <th>Identidad</th>
                    <th>Teléfono</th>
                    <th>Correo</th>
                    <th>Registro</th>
                    <th>Identidad</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {data.socios.map((s) => (
                    <tr key={s.id_usuario}>
                      <td className="fw-semibold">{s.nombre_completo}</td>
                      <td>{s.dni}</td>
                      <td>{s.telefono || "—"}</td>
                      <td className="small">{s.correo || "—"}</td>
                      <td className="small">{String(s.fecha_registro).substring(0, 10)}</td>
                      <td>
                        <button
                          className={`btn btn-sm ${s.fotos_identidad >= 2 ? "btn-outline-success" : "btn-outline-danger"}`}
                          onClick={() => setVerIdentidad(s)}
                        >
                          {s.fotos_identidad >= 2 ? "Ver fotos" : s.fotos_identidad ? "Falta 1 foto" : "Sin fotos"}
                        </button>
                      </td>
                      <td className="text-nowrap">
                        <button
                          className="btn btn-sm fw-semibold me-1"
                          style={{ background: ACCENT, color: "#1a2a00" }}
                          onClick={() => aprobarSocio(s)}
                        >
                          Aprobar
                        </button>
                        <button className="btn btn-sm btn-outline-danger" onClick={() => rechazarSocio(s)}>
                          Rechazar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Comprobantes de entrega sin firma ── */}
      {tab === "firmas" && recibidos.length > 0 && (
        <div className="ui-card p-3 mb-3" style={{ border: "1.5px solid #a7f3d0" }}>
          <div className="fw-bold mb-2" style={{ color: "#065f46" }}>
            Recibidos de los socios, por revisar ({recibidos.length})
          </div>
          {recibidos.map((d) => (
            <div
              key={d.id_recibo}
              className="d-flex flex-wrap justify-content-between align-items-center gap-2 py-2 border-top"
            >
              <div>
                <div className="fw-semibold">{d.nombre_completo}</div>
                <div className="small text-muted">
                  Préstamo #{d.id_prestamo} · {fmt(d.monto)} · subido el {String(d.subido_en).substring(0, 16).replace("T", " ")}
                </div>
              </div>
              <button className="btn btn-sm btn-success" onClick={() => setReciboAbierto(d.id_recibo)}>
                Ver comprobante firmado
              </button>
            </div>
          ))}
          <div className="small text-muted mt-2">Al abrir el comprobante firmado queda marcado como revisado.</div>
        </div>
      )}

      {tab === "firmas" && (
        <div className="ui-card">
          <div className="fw-bold px-3 pt-3">Pendientes de firma</div>
          {sinFirma.length === 0 ? (
            <EmptyState titulo="Todos los comprobantes de entrega tienen su copia firmada" />
          ) : (
            <div className="table-responsive">
              <table className="table align-middle mb-0">
                <thead>
                  <tr className="small text-muted">
                    <th>Socio</th>
                    <th>Préstamo</th>
                    <th>Entregado</th>
                    <th className="text-end">Monto</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {sinFirma.map((d) => (
                    <tr key={d.id_recibo}>
                      <td className="fw-semibold">{d.nombre_completo}</td>
                      <td>#{d.id_prestamo}</td>
                      <td className="small">{String(d.fecha).substring(0, 10)}</td>
                      <td className="text-end">{fmt(d.monto)}</td>
                      <td className="text-end">
                        <button className="btn btn-sm btn-outline-dark" onClick={() => setReciboAbierto(d.id_recibo)}>
                          Ver / subir firmado
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="small text-muted p-3">
            El comprobante de desembolso se envía al socio para que lo firme. Puede subir una foto desde su panel o la
            subes tú aquí.
          </div>
        </div>
      )}

      {/* ── Enlace de registro ── */}
      {tab === "enlace" && enlace && (
        <div className="ui-card p-4" style={{ maxWidth: 720 }}>
          <h5 className="fw-bold">
            <FaLink className="me-2" />
            Enlace para nuevos socios
          </h5>
          <p className="text-muted small">
            Comparte este enlace. Quien lo abra indica el préstamo que necesita, ve su cuota estimada y luego llena sus
            datos; la cuenta y la solicitud llegan juntas aquí. Nada se activa hasta que lo apruebes.
          </p>

          <div className="input-group mb-3">
            <input className="form-control" readOnly value={urlRegistro} onFocus={(e) => e.target.select()} />
            <button className="btn btn-dark" onClick={copiar}>
              <FaCopy className="me-1" /> Copiar
            </button>
          </div>

          <div className="d-flex flex-wrap gap-2 mb-4">
            <button className="btn fw-semibold" style={{ background: "#25D366", color: "#fff" }} onClick={compartirWhatsapp}>
              <FaWhatsapp className="me-1" /> Compartir por WhatsApp
            </button>
            <button
              className="btn btn-outline-secondary"
              onClick={() =>
                actualizarEnlace(
                  { regenerar: true },
                  "Se generará un enlace nuevo y el anterior dejará de funcionar. ¿Continuar?"
                )
              }
            >
              <FaSyncAlt className="me-1" /> Generar enlace nuevo
            </button>
          </div>

          <div className="form-check form-switch">
            <input
              id="reg-habilitado"
              type="checkbox"
              className="form-check-input"
              checked={enlace.habilitado}
              onChange={(e) => actualizarEnlace({ habilitado: e.target.checked })}
            />
            <label htmlFor="reg-habilitado" className="form-check-label">
              Registro de nuevos socios {enlace.habilitado ? "habilitado" : "deshabilitado"}
            </label>
          </div>
        </div>
      )}

      {aDesembolsar && (
        <DesembolsoModal
          prestamo={aDesembolsar}
          nombreSocio={aDesembolsar.nombre_completo}
          enviando={desembolsando}
          onConfirmar={confirmarDesembolso}
          onCancelar={() => setADesembolsar(null)}
        />
      )}

      {verIdentidad && (
        <div
          className="modal show d-block"
          style={{ background: "rgba(0,0,0,.6)", zIndex: 6000, position: "fixed", inset: 0, overflowY: "auto" }}
        >
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content border-0 shadow-lg" style={{ borderRadius: 16 }}>
              <div className="modal-header border-0 pb-0">
                <div>
                  <h5 className="modal-title fw-bold">Identidad</h5>
                  <div className="small text-muted">{verIdentidad.nombre_completo}</div>
                </div>
                <button type="button" className="btn-close" onClick={() => { setVerIdentidad(null); cargar(); }} />
              </div>
              <div className="modal-body">
                <FotosIdentidad idSocio={verIdentidad.id_usuario} headers={headers} />
              </div>
            </div>
          </div>
        </div>
      )}

      {reciboAbierto && (
        <ReciboModal
          idRecibo={reciboAbierto}
          onClose={() => {
            setReciboAbierto(null);
            cargar();
          }}
        />
      )}

      {/* ── Modal de revisión ── */}
      {revisando && (
        <div
          className="modal show d-block"
          style={{ background: "rgba(0,0,0,.6)", zIndex: 6000, position: "fixed", inset: 0, overflowY: "auto" }}
        >
          <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: 520 }}>
            <div className="modal-content border-0 shadow-lg" style={{ borderRadius: 16 }}>
              <div className="modal-header border-0 pb-0">
                <div>
                  <h5 className="modal-title fw-bold">Aprobar solicitud</h5>
                  <div className="small text-muted">{revisando.nombre_completo}</div>
                </div>
                <button type="button" className="btn-close" onClick={() => setRevisando(null)} />
              </div>
              <div className="modal-body">
                <p className="small text-muted">
                  Puedes ajustar las condiciones antes de aprobar. Al aprobar, el socio recibe por correo la carta de
                  aprobación en PDF. El dinero se entrega después, al registrar el desembolso.
                </p>
                <div className="row g-2">
                  <div className="col-12 col-md-4">
                    <label className="form-label small fw-semibold">Monto (L.)</label>
                    <InputMonto
                      className="form-control"
                      value={condiciones.monto}
                      onChange={(v) => setCondiciones({ ...condiciones, monto: v })}
                    />
                  </div>
                  <div className="col-6 col-md-4">
                    <label className="form-label small fw-semibold">Plazo (meses)</label>
                    <input
                      type="number" min="1" max="360" className="form-control"
                      value={condiciones.plazo_meses}
                      onChange={(e) => setCondiciones({ ...condiciones, plazo_meses: e.target.value })}
                    />
                  </div>
                  <div className="col-6 col-md-4">
                    <label className="form-label small fw-semibold">Tasa mensual (%)</label>
                    <input
                      type="number" min="0" max="30" step="0.01" className="form-control"
                      value={condiciones.tasa_mensual}
                      onChange={(e) => setCondiciones({ ...condiciones, tasa_mensual: e.target.value })}
                    />
                  </div>
                </div>

                {revisando.estado_socio === "pendiente" && (
                  <div className="form-check mt-3">
                    <input
                      id="chk-socio" type="checkbox" className="form-check-input"
                      checked={condiciones.aprobar_socio}
                      onChange={(e) => setCondiciones({ ...condiciones, aprobar_socio: e.target.checked })}
                    />
                    <label htmlFor="chk-socio" className="form-check-label">
                      Aprobar también al socio y crear sus cuentas
                    </label>
                  </div>
                )}
              </div>
              <div className="modal-footer border-0 pt-0">
                <button className="btn btn-outline-secondary" onClick={() => setRevisando(null)}>
                  Cancelar
                </button>
                <button
                  className="btn fw-semibold"
                  style={{ background: ACCENT, color: "#1a2a00" }}
                  disabled={procesando}
                  onClick={aprobarPrestamo}
                >
                  {procesando ? "Aprobando..." : "Aprobar solicitud"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
