// Cumplimiento: alertas de prevención de lavado de dinero que genera la caja (efectivo sobre el
// umbral, posible fraccionamiento, personas expuestas políticamente). El oficial las revisa,
// anota qué hizo y exporta el reporte. Información reservada: no se le muestra al socio.
import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { FaUserSecret, FaFileExcel, FaCheck, FaFlag, FaUndo } from "react-icons/fa";
import { useAuth } from "../context/AuthContext";
import { useAlerta } from "../context/AlertaContext";
import { dinero } from "../utils/pais";
import { hoyLocal } from "../utils/fechas";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const AZUL = "#1a2035";
const ACCENT = "#a8cd3a";
const COLOR_ESTADO = { pendiente: "warning", revisada: "success", reportada: "danger" };
const fechaHora = (v) => (v ? String(v).replace("T", " ").substring(0, 16) : "");

const Indicador = ({ titulo, valor, color = AZUL, ayuda }) => (
  <div className="col-6 col-lg-3">
    <div className="card border-0 shadow-sm h-100" style={{ borderRadius: 14 }}>
      <div className="card-body">
        <div className="text-muted small">{titulo}</div>
        <div className="fs-4 fw-bold" style={{ color }}>{valor}</div>
        {ayuda && <div className="text-muted" style={{ fontSize: 12 }}>{ayuda}</div>}
      </div>
    </div>
  </div>
);

export default function Cumplimiento() {
  const { token } = useAuth();
  const { mostrarAlerta } = useAlerta();
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const [resumen, setResumen] = useState(null);
  const [alertas, setAlertas] = useState([]);
  const [filtro, setFiltro] = useState({ estado: "pendiente", tipo: "", desde: "", hasta: "" });
  const [revisando, setRevisando] = useState(null); // { alerta, estado }
  const [nota, setNota] = useState("");
  const error = (e, msg) => mostrarAlerta(e.response?.data?.message || msg, "error");

  const params = useMemo(() => Object.fromEntries(Object.entries(filtro).filter(([, v]) => v)), [filtro]);

  const cargar = useCallback(() => {
    axios.get(`${API_URL}/cumplimiento/resumen`, { headers }).then((r) => setResumen(r.data.data)).catch((e) => error(e, "No se pudo leer el resumen."));
    axios.get(`${API_URL}/cumplimiento/alertas`, { headers, params }).then((r) => setAlertas(r.data.data || [])).catch((e) => error(e, "No se pudieron leer las alertas."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headers, params]);
  useEffect(() => {
    cargar();
  }, [cargar]);

  const exportar = async () => {
    try {
      const r = await axios.get(`${API_URL}/cumplimiento/exportar`, { headers, params, responseType: "blob" });
      const url = URL.createObjectURL(r.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `alertas_cumplimiento_${hoyLocal()}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      error(e, "No se pudo exportar.");
    }
  };

  const guardar = async () => {
    try {
      await axios.put(`${API_URL}/cumplimiento/alertas/${revisando.alerta.id_alerta}`, { estado: revisando.estado, nota }, { headers });
      mostrarAlerta("Alerta actualizada.", "success");
      setRevisando(null);
      setNota("");
      cargar();
    } catch (e) {
      error(e, "No se pudo actualizar la alerta.");
    }
  };

  const abrir = (alerta, estado) => {
    setNota(alerta.nota || "");
    setRevisando({ alerta, estado });
  };

  return (
    <div className="container-fluid py-3">
      <div className="d-flex align-items-center gap-3 mb-3 flex-wrap">
        <div className="d-flex align-items-center justify-content-center" style={{ width: 48, height: 48, borderRadius: 12, background: AZUL, color: ACCENT }}>
          <FaUserSecret size={20} />
        </div>
        <div className="flex-grow-1">
          <h4 className="fw-bold mb-0" style={{ color: AZUL }}>Cumplimiento</h4>
          <div className="text-muted small">Prevención de lavado de dinero · información reservada</div>
        </div>
        <button className="btn btn-outline-success btn-sm" onClick={exportar}>
          <FaFileExcel className="me-1" /> Exportar a Excel
        </button>
      </div>

      {resumen && (
        <div className="row g-3 mb-3">
          <Indicador titulo="Alertas pendientes" valor={resumen.alertas.pendiente} color={resumen.alertas.pendiente ? "#d97706" : AZUL} />
          <Indicador titulo="Reportadas al regulador" valor={resumen.alertas.reportada} />
          <Indicador titulo="Socios PEP" valor={resumen.socios_pep} ayuda="Personas expuestas políticamente" />
          <Indicador
            titulo="Expedientes incompletos"
            valor={resumen.expedientes_incompletos}
            color={resumen.expedientes_incompletos ? "#d97706" : AZUL}
            ayuda="Socios activos sin actividad, ingresos, origen de fondos o beneficiarios"
          />
        </div>
      )}
      {resumen && (
        <div className="alert alert-light border small">
          Se genera una alerta cuando un socio mueve en efectivo <strong>{dinero(resumen.umbral)}</strong> o más en una sola
          operación, cuando varios depósitos en efectivo más pequeños suman ese monto en 30 días, o cuando opera una persona
          expuesta políticamente. El umbral se cambia en <em>Parámetros</em> (0 = el del país). Las alertas nunca detienen la operación.
        </div>
      )}

      <div className="card border-0 shadow-sm" style={{ borderRadius: 14 }}>
        <div className="card-body">
          <div className="row g-2 mb-3">
            <div className="col-6 col-md-3">
              <select className="form-select form-select-sm" value={filtro.estado} onChange={(e) => setFiltro({ ...filtro, estado: e.target.value })}>
                <option value="">Todos los estados</option>
                <option value="pendiente">Pendientes</option>
                <option value="revisada">Revisadas</option>
                <option value="reportada">Reportadas</option>
              </select>
            </div>
            <div className="col-6 col-md-3">
              <select className="form-select form-select-sm" value={filtro.tipo} onChange={(e) => setFiltro({ ...filtro, tipo: e.target.value })}>
                <option value="">Todos los tipos</option>
                {Object.entries(resumen?.tipos || {}).map(([k, t]) => (
                  <option key={k} value={k}>{t}</option>
                ))}
              </select>
            </div>
            <div className="col-6 col-md-3">
              <input type="date" className="form-control form-control-sm" value={filtro.desde} onChange={(e) => setFiltro({ ...filtro, desde: e.target.value })} title="Desde" />
            </div>
            <div className="col-6 col-md-3">
              <input type="date" className="form-control form-control-sm" value={filtro.hasta} onChange={(e) => setFiltro({ ...filtro, hasta: e.target.value })} title="Hasta" />
            </div>
          </div>

          {!alertas.length ? (
            <div className="text-center text-muted py-4">No hay alertas con estos filtros.</div>
          ) : (
            <div className="table-responsive">
              <table className="table table-sm align-middle">
                <thead className="table-light">
                  <tr>
                    <th>Fecha</th>
                    <th>Socio</th>
                    <th>Tipo</th>
                    <th className="text-end">Monto</th>
                    <th>Detalle</th>
                    <th>Estado</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {alertas.map((a) => (
                    <tr key={a.id_alerta}>
                      <td className="text-nowrap small">{fechaHora(a.fecha)}</td>
                      <td>
                        <div className="fw-semibold">{a.nombre_completo}</div>
                        <div className="text-muted small">
                          {a.numero_socio ? `N.º ${a.numero_socio} · ` : ""}
                          {a.dni}
                          {a.es_pep ? <span className="badge bg-dark ms-1">PEP</span> : null}
                        </div>
                      </td>
                      <td className="small">{a.tipo_texto}</td>
                      <td className="text-end text-nowrap">{dinero(a.monto)}</td>
                      <td className="small" style={{ maxWidth: 320 }}>
                        {a.detalle}
                        {a.nota && (
                          <div className="text-muted mt-1">
                            <em>Nota:</em> {a.nota} {a.revisor && `— ${a.revisor}`}
                          </div>
                        )}
                      </td>
                      <td>
                        <span className={`badge bg-${COLOR_ESTADO[a.estado]}`}>{a.estado}</span>
                      </td>
                      <td className="text-nowrap text-end">
                        {a.estado === "pendiente" ? (
                          <>
                            <button className="btn btn-sm btn-outline-success me-1" title="Revisada: sin novedad" onClick={() => abrir(a, "revisada")}>
                              <FaCheck />
                            </button>
                            <button className="btn btn-sm btn-outline-danger" title="Reportada al regulador" onClick={() => abrir(a, "reportada")}>
                              <FaFlag />
                            </button>
                          </>
                        ) : (
                          <button className="btn btn-sm btn-outline-secondary" title="Volver a pendiente" onClick={() => abrir(a, "pendiente")}>
                            <FaUndo />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {revisando && (
        <div className="modal d-block" style={{ background: "rgba(0,0,0,.4)" }} onClick={() => setRevisando(null)}>
          <div className="modal-dialog modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content" style={{ borderRadius: 14 }}>
              <div className="modal-header">
                <h5 className="modal-title">
                  {{ revisada: "Marcar como revisada", reportada: "Marcar como reportada", pendiente: "Volver a pendiente" }[revisando.estado]}
                </h5>
                <button className="btn-close" onClick={() => setRevisando(null)} />
              </div>
              <div className="modal-body">
                <p className="small mb-2">
                  <strong>{revisando.alerta.nombre_completo}</strong> · {revisando.alerta.tipo_texto} · {dinero(revisando.alerta.monto)}
                </p>
                <label className="form-label small">
                  {revisando.estado === "reportada" ? "¿A quién y cuándo se reportó? (número de reporte, si lo hay)" : "Nota de la revisión"}
                </label>
                <textarea className="form-control" rows={3} maxLength={500} value={nota} onChange={(e) => setNota(e.target.value)} />
              </div>
              <div className="modal-footer">
                <button className="btn btn-light" onClick={() => setRevisando(null)}>Cancelar</button>
                <button className="btn btn-primary" onClick={guardar} disabled={revisando.estado !== "pendiente" && !nota.trim()}>
                  Guardar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
