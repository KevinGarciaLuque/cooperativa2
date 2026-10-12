import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useAlerta } from "../context/AlertaContext";
import { FaInbox, FaLink, FaCopy, FaWhatsapp, FaSyncAlt } from "react-icons/fa";
import { EmptyState, PageHeader } from "../ui/Componentes";
import InputMonto from "../ui/InputMonto";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const ACCENT = "#a8cd3a";

const fmt = (n) =>
  `L. ${parseFloat(n || 0).toLocaleString("es-HN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const PROPOSITOS = {
  negocio: "Negocio o capital de trabajo",
  vivienda: "Vivienda o mejoras del hogar",
  educacion: "Educación",
  salud: "Salud o emergencia",
  agricultura: "Agricultura o ganadería",
  consumo: "Consumo personal",
  otro: "Otro",
};

const OCUPACIONES = {
  empleado: "Empleado",
  negocio_propio: "Negocio propio",
  agricultor: "Agricultor / ganadero",
  independiente: "Trabajador independiente",
  jubilado: "Jubilado o pensionado",
  otro: "Otro",
};

export default function Solicitudes() {
  const { token } = useAuth();
  const { mostrarAlerta } = useAlerta();
  const navigate = useNavigate();
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const [tab, setTab] = useState("prestamos");
  const [data, setData] = useState(null);
  const [enlace, setEnlace] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [revisando, setRevisando] = useState(null); // solicitud de préstamo en revisión
  const [condiciones, setCondiciones] = useState({ monto: "", plazo_meses: "", tasa_mensual: "", aprobar_socio: true });
  const [procesando, setProcesando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [s, e] = await Promise.all([
        axios.get(`${API_URL}/solicitudes`, { headers }),
        axios.get(`${API_URL}/solicitudes/enlace`, { headers }),
      ]);
      setData(s.data);
      setEnlace(e.data);
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
    const texto = `Te invitamos a unirte a nuestra cooperativa. Crea tu cuenta de socio aquí: ${urlRegistro}`;
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
      await axios.post(
        `${API_URL}/solicitudes/prestamos/${revisando.id_prestamo}/aprobar`,
        {
          monto: parseFloat(condiciones.monto),
          plazo_meses: parseInt(condiciones.plazo_meses),
          tasa_mensual: parseFloat(condiciones.tasa_mensual),
          aprobar_socio: condiciones.aprobar_socio,
        },
        { headers }
      );
      mostrarAlerta("Solicitud aprobada. Falta registrar el desembolso en Préstamos.", "success");
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
            <div className="alert alert-success d-flex flex-wrap justify-content-between align-items-center">
              <span>
                <strong>{porDesembolsar.length}</strong> solicitud(es) aprobada(s) esperan el desembolso.
              </span>
              <button className="btn btn-sm btn-success" onClick={() => navigate("/prestamos")}>
                Ir a Préstamos
              </button>
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

                      {p.referencias.length > 0 && (
                        <div className="small mb-3">
                          <strong>Referencias:</strong>{" "}
                          {p.referencias.map((r, i) => (
                            <span key={i}>
                              {i > 0 && " · "}
                              {r.nombre} ({r.telefono}
                              {r.parentesco ? `, ${r.parentesco}` : ""})
                            </span>
                          ))}
                        </div>
                      )}

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

      {/* ── Enlace de registro ── */}
      {tab === "enlace" && enlace && (
        <div className="ui-card p-4" style={{ maxWidth: 720 }}>
          <h5 className="fw-bold">
            <FaLink className="me-2" />
            Enlace para nuevos socios
          </h5>
          <p className="text-muted small">
            Comparte este enlace. Quien lo abra podrá crear su cuenta y pedir un préstamo; nada se activa hasta que lo
            apruebes aquí.
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
                  Puedes ajustar las condiciones antes de aprobar. El dinero se entrega después, al registrar el
                  desembolso en Préstamos.
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
