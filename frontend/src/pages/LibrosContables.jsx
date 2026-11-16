// Contabilidad de partida doble: apertura, libro diario, mayor, balanza, estados financieros,
// partidas manuales y catálogo de cuentas. Las partidas de las operaciones se registran solas.
import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { FaBook, FaFileExcel, FaPlus, FaTrash, FaCheckCircle, FaExclamationTriangle } from "react-icons/fa";
import { useAuth } from "../context/AuthContext";
import { useAlerta } from "../context/AlertaContext";
import { cifra, dinero } from "../utils/pais";
import { hoyLocal } from "../utils/fechas";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const AZUL = "#1a2035";
const ACCENT = "#a8cd3a";
const TABS = [
  ["inicio", "Inicio"],
  ["diario", "Libro diario"],
  ["mayor", "Libro mayor"],
  ["balanza", "Balanza"],
  ["estados", "Estados financieros"],
  ["partida", "Nueva partida"],
  ["catalogo", "Catálogo"],
];
const fecha = (v) => (v ? String(v).substring(0, 10) : "");
const primerDiaDelAnio = () => `${hoyLocal().substring(0, 4)}-01-01`;

export default function LibrosContables() {
  const { token, user } = useAuth();
  const { mostrarAlerta } = useAlerta();
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const esSuper = user?.rol === "Super Administrador";
  const [tab, setTab] = useState("inicio");
  const [estado, setEstado] = useState(null);
  const [catalogo, setCatalogo] = useState([]);

  const cargarEstado = useCallback(() => {
    axios.get(`${API_URL}/libros/estado`, { headers }).then((r) => setEstado(r.data)).catch(() => setEstado({ error: true }));
    axios.get(`${API_URL}/libros/catalogo`, { headers }).then((r) => setCatalogo(r.data.data || [])).catch(() => {});
  }, [headers]);
  useEffect(() => {
    cargarEstado();
  }, [cargarEstado]);

  const error = (e, msg) => mostrarAlerta(e.response?.data?.message || msg, "error");

  const exportar = async (libro, params) => {
    try {
      const r = await axios.get(`${API_URL}/libros/exportar/${libro}`, { headers, params, responseType: "blob" });
      const url = URL.createObjectURL(r.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${libro}_${params.hasta || hoyLocal()}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      error(e, "No se pudo exportar.");
    }
  };

  return (
    <div className="container-fluid py-3">
      <div className="d-flex align-items-center gap-3 mb-3">
        <div className="d-flex align-items-center justify-content-center" style={{ width: 48, height: 48, borderRadius: 12, background: AZUL, color: ACCENT }}>
          <FaBook size={20} />
        </div>
        <div>
          <h4 className="fw-bold mb-0" style={{ color: AZUL }}>Libros contables</h4>
          <div className="text-muted small">Contabilidad de partida doble: cada operación registra su partida sola</div>
        </div>
      </div>

      <ul className="nav nav-tabs mb-3 flex-nowrap overflow-auto">
        {TABS.map(([k, t]) => (
          <li className="nav-item" key={k}>
            <button className={`nav-link ${tab === k ? "active fw-semibold" : ""}`} onClick={() => setTab(k)} disabled={k !== "inicio" && k !== "catalogo" && !estado?.iniciada}>
              {t}
            </button>
          </li>
        ))}
      </ul>

      {tab === "inicio" && <Inicio estado={estado} headers={headers} esSuper={esSuper} recargar={cargarEstado} error={error} mostrarAlerta={mostrarAlerta} />}
      {tab === "diario" && <Diario headers={headers} error={error} exportar={exportar} mostrarAlerta={mostrarAlerta} />}
      {tab === "mayor" && <Mayor headers={headers} error={error} catalogo={catalogo} />}
      {tab === "balanza" && <Balanza headers={headers} error={error} exportar={exportar} />}
      {tab === "estados" && <Estados headers={headers} error={error} exportar={exportar} />}
      {tab === "partida" && <NuevaPartida headers={headers} error={error} catalogo={catalogo} mostrarAlerta={mostrarAlerta} />}
      {tab === "catalogo" && <Catalogo headers={headers} error={error} catalogo={catalogo} setCatalogo={setCatalogo} esSuper={esSuper} />}
    </div>
  );
}

const Tarjeta = ({ children, className = "" }) => (
  <div className={`card border-0 shadow-sm ${className}`} style={{ borderRadius: 14 }}>
    <div className="card-body">{children}</div>
  </div>
);

const Rango = ({ desde, hasta, setDesde, setHasta, children }) => (
  <div className="d-flex flex-wrap align-items-end gap-2 mb-3">
    {setDesde && (
      <div>
        <label className="form-label small mb-1">Desde</label>
        <input type="date" className="form-control form-control-sm" value={desde} onChange={(e) => setDesde(e.target.value)} />
      </div>
    )}
    <div>
      <label className="form-label small mb-1">Hasta</label>
      <input type="date" className="form-control form-control-sm" value={hasta} onChange={(e) => setHasta(e.target.value)} />
    </div>
    {children}
  </div>
);

// ── Inicio y apertura ──────────────────────────────────────────────────────
function Inicio({ estado, headers, esSuper, recargar, error, mostrarAlerta }) {
  const [lineas, setLineas] = useState(null);
  const [errores, setErrores] = useState([]);
  const [abriendo, setAbriendo] = useState(false);

  useEffect(() => {
    if (!estado || estado.error) return;
    if (!estado.iniciada) {
      axios.get(`${API_URL}/libros/apertura/propuesta`, { headers }).then((r) => setLineas(r.data.lineas)).catch((e) => error(e, "No se pudo calcular la apertura."));
    } else if (estado.errores_pendientes > 0) {
      axios.get(`${API_URL}/libros/errores`, { headers }).then((r) => setErrores(r.data.data || []));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado]);

  if (!estado) return <div className="spinner-border text-success" />;

  if (estado.iniciada) {
    return (
      <>
        <Tarjeta className="mb-3">
          <div className="d-flex flex-wrap gap-4">
            <div><div className="small text-muted">Contabilidad abierta el</div><div className="fw-bold">{estado.fecha_inicio}</div></div>
            <div><div className="small text-muted">Partidas registradas</div><div className="fw-bold">{estado.partidas}</div></div>
            <div><div className="small text-muted">Última partida</div><div className="fw-bold">{fecha(estado.ultima_partida) || "—"}</div></div>
            <div>
              <div className="small text-muted">Partidas pendientes de revisar</div>
              <div className="fw-bold" style={{ color: estado.errores_pendientes ? "#b91c1c" : "#065f46" }}>
                {estado.errores_pendientes ? <><FaExclamationTriangle className="me-1" />{estado.errores_pendientes}</> : <><FaCheckCircle className="me-1" />Ninguna</>}
              </div>
            </div>
          </div>
        </Tarjeta>
        {errores.length > 0 && (
          <Tarjeta>
            <h6 className="fw-bold">Operaciones cuya partida no se pudo registrar</h6>
            <p className="small text-muted">La operación sí se guardó. Registra la partida a mano (Nueva partida) y marca el caso como resuelto.</p>
            {errores.map((e) => (
              <div key={e.id_error} className="d-flex justify-content-between align-items-start border-top py-2 small">
                <div><strong>{e.concepto}</strong> · {fecha(e.fecha)}<div className="text-danger">{e.error}</div></div>
                <button className="btn btn-sm btn-outline-success" onClick={() => axios.post(`${API_URL}/libros/errores/${e.id_error}/resolver`, {}, { headers }).then(() => { setErrores((l) => l.filter((x) => x.id_error !== e.id_error)); recargar(); })}>
                  Resuelto
                </button>
              </div>
            ))}
          </Tarjeta>
        )}
      </>
    );
  }

  const debe = (lineas || []).reduce((t, l) => t + (parseFloat(l.debe) || 0), 0);
  const haber = (lineas || []).reduce((t, l) => t + (parseFloat(l.haber) || 0), 0);
  const cuadra = Math.abs(debe - haber) < 0.005;
  const cambiar = (i, campo, v) => setLineas((ls) => ls.map((l, j) => (j === i ? { ...l, [campo]: v } : l)));

  const abrir = async () => {
    if (!window.confirm("¿Abrir la contabilidad con estos saldos? Desde ahora cada operación registrará su partida. Solo se hace una vez.")) return;
    setAbriendo(true);
    try {
      await axios.post(`${API_URL}/libros/apertura`, { lineas }, { headers });
      mostrarAlerta("Contabilidad abierta.", "success");
      recargar();
    } catch (e) {
      error(e, "No se pudo abrir la contabilidad.");
    } finally {
      setAbriendo(false);
    }
  };

  return (
    <Tarjeta>
      <h5 className="fw-bold">Abrir la contabilidad</h5>
      <p className="small text-muted mb-2">
        La partida de apertura registra los saldos con los que empieza la contabilidad. El sistema los propone a partir
        de la caja, la cartera y las cuentas de los socios; revísalos con el contador (sobre todo caja y bancos, que deben
        coincidir con el efectivo contado y los estados de cuenta del banco). La diferencia queda en resultados acumulados.
        Lo ideal es hacerlo el primer día del mes. Desde ese momento cada operación registra su partida.
      </p>
      {!lineas ? (
        <div className="spinner-border spinner-border-sm text-success" />
      ) : (
        <>
          <div className="table-responsive">
            <table className="table table-sm align-middle">
              <thead className="small text-muted"><tr><th>Código</th><th>Cuenta</th><th className="text-end">Debe</th><th className="text-end">Haber</th></tr></thead>
              <tbody>
                {lineas.map((l, i) => (
                  <tr key={l.id_cuenta_contable}>
                    <td>{l.codigo}</td>
                    <td>{l.nombre}</td>
                    <td style={{ width: 160 }}><input type="number" step="0.01" min="0" className="form-control form-control-sm text-end" value={l.debe} onChange={(e) => cambiar(i, "debe", e.target.value)} disabled={!esSuper} /></td>
                    <td style={{ width: 160 }}><input type="number" step="0.01" min="0" className="form-control form-control-sm text-end" value={l.haber} onChange={(e) => cambiar(i, "haber", e.target.value)} disabled={!esSuper} /></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="fw-bold">
                  <td colSpan={2}>Totales {cuadra ? <span className="text-success small ms-2">cuadra</span> : <span className="text-danger small ms-2">no cuadra (diferencia {cifra(debe - haber)})</span>}</td>
                  <td className="text-end">{cifra(debe)}</td>
                  <td className="text-end">{cifra(haber)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          {esSuper ? (
            <button className="btn fw-semibold" style={{ background: ACCENT, color: AZUL }} disabled={!cuadra || abriendo} onClick={abrir}>
              {abriendo && <span className="spinner-border spinner-border-sm me-2" />}Abrir la contabilidad
            </button>
          ) : (
            <div className="small text-muted">Solo el Super Administrador puede abrir la contabilidad.</div>
          )}
        </>
      )}
    </Tarjeta>
  );
}

// ── Libro diario ───────────────────────────────────────────────────────────
function Diario({ headers, error, exportar, mostrarAlerta }) {
  const [desde, setDesde] = useState(`${hoyLocal().substring(0, 7)}-01`);
  const [hasta, setHasta] = useState(hoyLocal());
  const [partidas, setPartidas] = useState(null);
  const cargar = useCallback(() => {
    axios.get(`${API_URL}/libros/diario`, { headers, params: { desde, hasta } }).then((r) => setPartidas(r.data.data)).catch((e) => error(e, "No se pudo cargar el libro diario."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [desde, hasta, headers]);
  useEffect(() => { cargar(); }, [cargar]);

  const anular = async (p) => {
    const motivo = window.prompt(`Motivo para anular la partida #${p.numero}:`);
    if (motivo === null) return;
    try {
      await axios.post(`${API_URL}/libros/partidas/${p.id_partida}/anular`, { motivo }, { headers });
      mostrarAlerta("Partida anulada con su partida inversa.", "success");
      cargar();
    } catch (e) {
      error(e, "No se pudo anular.");
    }
  };

  return (
    <Tarjeta>
      <Rango desde={desde} hasta={hasta} setDesde={setDesde} setHasta={setHasta}>
        <button className="btn btn-sm btn-outline-success" onClick={() => exportar("diario", { desde, hasta })}><FaFileExcel className="me-1" />Excel</button>
      </Rango>
      {!partidas ? <div className="spinner-border spinner-border-sm text-success" /> : partidas.length === 0 ? <div className="text-muted small">Sin partidas en esas fechas.</div> : (
        partidas.map((p) => (
          <div key={p.id_partida} className="border rounded-3 p-2 mb-2">
            <div className="d-flex flex-wrap justify-content-between gap-2 small mb-1">
              <div><strong>#{p.numero}</strong> · {fecha(p.fecha)} · {p.concepto}{p.anulada_en && <span className="badge bg-secondary ms-2">Anulada (#{p.anulada_en})</span>}</div>
              <div className="text-muted">{p.origen}{p.creada_por_nombre ? ` · ${p.creada_por_nombre}` : ""}{p.origen === "manual" && !p.anulada_en && <button className="btn btn-link btn-sm p-0 ms-2 text-danger" onClick={() => anular(p)}>Anular</button>}</div>
            </div>
            <table className="table table-sm mb-0 small">
              <tbody>
                {p.lineas.map((l, i) => (
                  <tr key={i}>
                    <td style={{ width: 90 }}>{l.codigo}</td>
                    <td style={{ paddingLeft: l.haber > 0 ? 32 : 8 }}>{l.nombre}</td>
                    <td className="text-end" style={{ width: 130 }}>{l.debe ? cifra(l.debe) : ""}</td>
                    <td className="text-end" style={{ width: 130 }}>{l.haber ? cifra(l.haber) : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      )}
    </Tarjeta>
  );
}

// ── Libro mayor ────────────────────────────────────────────────────────────
function Mayor({ headers, error, catalogo }) {
  const detalle = catalogo.filter((c) => c.acepta_movimientos);
  const [cuenta, setCuenta] = useState("");
  const [desde, setDesde] = useState(primerDiaDelAnio());
  const [hasta, setHasta] = useState(hoyLocal());
  const [datos, setDatos] = useState(null);
  useEffect(() => {
    if (!cuenta) return;
    axios.get(`${API_URL}/libros/mayor/${cuenta}`, { headers, params: { desde, hasta } }).then((r) => setDatos(r.data)).catch((e) => error(e, "No se pudo cargar el mayor."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cuenta, desde, hasta, headers]);
  return (
    <Tarjeta>
      <Rango desde={desde} hasta={hasta} setDesde={setDesde} setHasta={setHasta}>
        <div style={{ minWidth: 280 }}>
          <label className="form-label small mb-1">Cuenta</label>
          <select className="form-select form-select-sm" value={cuenta} onChange={(e) => setCuenta(e.target.value)}>
            <option value="">Elige una cuenta...</option>
            {detalle.map((c) => <option key={c.id_cuenta_contable} value={c.id_cuenta_contable}>{c.codigo} {c.nombre}</option>)}
          </select>
        </div>
      </Rango>
      {datos && (
        <table className="table table-sm small">
          <thead className="text-muted"><tr><th>Fecha</th><th>Partida</th><th>Concepto</th><th className="text-end">Debe</th><th className="text-end">Haber</th><th className="text-end">Saldo</th></tr></thead>
          <tbody>
            <tr className="fw-semibold"><td colSpan={5}>Saldo inicial</td><td className="text-end">{cifra(datos.saldo_inicial)}</td></tr>
            {datos.movimientos.map((m, i) => (
              <tr key={i}><td>{fecha(m.fecha)}</td><td>#{m.numero}</td><td>{m.concepto}</td><td className="text-end">{m.debe ? cifra(m.debe) : ""}</td><td className="text-end">{m.haber ? cifra(m.haber) : ""}</td><td className="text-end">{cifra(m.saldo)}</td></tr>
            ))}
            <tr className="fw-bold"><td colSpan={5}>Saldo final</td><td className="text-end">{dinero(datos.saldo_final)}</td></tr>
          </tbody>
        </table>
      )}
    </Tarjeta>
  );
}

// ── Balanza de comprobación ────────────────────────────────────────────────
function Balanza({ headers, error, exportar }) {
  const [desde, setDesde] = useState(primerDiaDelAnio());
  const [hasta, setHasta] = useState(hoyLocal());
  const [b, setB] = useState(null);
  useEffect(() => {
    axios.get(`${API_URL}/libros/balanza`, { headers, params: { desde, hasta } }).then((r) => setB(r.data)).catch((e) => error(e, "No se pudo cargar la balanza."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [desde, hasta, headers]);
  return (
    <Tarjeta>
      <Rango desde={desde} hasta={hasta} setDesde={setDesde} setHasta={setHasta}>
        <button className="btn btn-sm btn-outline-success" onClick={() => exportar("balanza", { desde, hasta })}><FaFileExcel className="me-1" />Excel</button>
      </Rango>
      {b && (
        <div className="table-responsive">
          <table className="table table-sm small">
            <thead className="text-muted"><tr><th>Código</th><th>Cuenta</th><th className="text-end">Saldo inicial</th><th className="text-end">Debe</th><th className="text-end">Haber</th><th className="text-end">Saldo final</th></tr></thead>
            <tbody>
              {b.filas.map((f) => <tr key={f.id_cuenta_contable}><td>{f.codigo}</td><td>{f.nombre}</td><td className="text-end">{cifra(f.saldo_inicial)}</td><td className="text-end">{cifra(f.debe)}</td><td className="text-end">{cifra(f.haber)}</td><td className="text-end fw-semibold">{cifra(f.saldo_final)}</td></tr>)}
            </tbody>
            <tfoot><tr className="fw-bold"><td colSpan={3}>Totales {b.cuadra ? <span className="text-success">· cuadra</span> : <span className="text-danger">· no cuadra</span>}</td><td className="text-end">{cifra(b.totales.debe)}</td><td className="text-end">{cifra(b.totales.haber)}</td><td></td></tr></tfoot>
          </table>
        </div>
      )}
    </Tarjeta>
  );
}

// ── Estados financieros ────────────────────────────────────────────────────
function Estados({ headers, error, exportar }) {
  const [desde, setDesde] = useState(primerDiaDelAnio());
  const [hasta, setHasta] = useState(hoyLocal());
  const [e, setE] = useState(null);
  useEffect(() => {
    axios.get(`${API_URL}/libros/estados`, { headers, params: { desde, hasta } }).then((r) => setE(r.data)).catch((x) => error(x, "No se pudieron calcular los estados."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [desde, hasta, headers]);
  const Seccion = ({ titulo, filas, total, extra }) => (
    <>
      <tr className="table-light fw-semibold"><td colSpan={2}>{titulo}</td></tr>
      {filas.map((f) => <tr key={f.codigo}><td className="ps-3">{f.codigo} {f.nombre}</td><td className="text-end">{cifra(f.monto)}</td></tr>)}
      {extra}
      <tr className="fw-bold"><td>Total {titulo.toLowerCase()}</td><td className="text-end">{dinero(total)}</td></tr>
    </>
  );
  return (
    <>
      <Tarjeta className="mb-3">
        <Rango desde={desde} hasta={hasta} setDesde={setDesde} setHasta={setHasta}>
          <button className="btn btn-sm btn-outline-success" onClick={() => exportar("estados", { desde, hasta })}><FaFileExcel className="me-1" />Excel</button>
          <span className="small text-muted">Balance general al «hasta»; estado de resultados entre las dos fechas.</span>
        </Rango>
      </Tarjeta>
      {e && (
        <div className="row g-3">
          <div className="col-12 col-xl-6">
            <Tarjeta>
              <h6 className="fw-bold">Balance general al {e.hasta} {e.balance.cuadra ? <span className="badge bg-success ms-1">cuadra</span> : <span className="badge bg-danger ms-1">no cuadra</span>}</h6>
              <table className="table table-sm small mb-0"><tbody>
                <Seccion titulo="Activo" filas={e.balance.activo} total={e.balance.total_activo} />
                <Seccion titulo="Pasivo" filas={e.balance.pasivo} total={e.balance.total_pasivo} />
                <Seccion titulo="Patrimonio" filas={e.balance.patrimonio} total={e.balance.total_patrimonio} extra={<tr><td className="ps-3">Excedente no distribuido</td><td className="text-end">{cifra(e.balance.excedente_no_distribuido)}</td></tr>} />
              </tbody></table>
            </Tarjeta>
          </div>
          <div className="col-12 col-xl-6">
            <Tarjeta>
              <h6 className="fw-bold">Estado de resultados del {e.desde} al {e.hasta}</h6>
              <table className="table table-sm small mb-0"><tbody>
                <Seccion titulo="Ingresos" filas={e.resultados.ingresos} total={e.resultados.total_ingresos} />
                <Seccion titulo="Gastos" filas={e.resultados.gastos} total={e.resultados.total_gastos} />
                <tr className="fw-bold" style={{ fontSize: "1rem" }}><td>Excedente del período</td><td className="text-end" style={{ color: e.resultados.excedente >= 0 ? "#065f46" : "#b91c1c" }}>{dinero(e.resultados.excedente)}</td></tr>
              </tbody></table>
            </Tarjeta>
          </div>
        </div>
      )}
    </>
  );
}

// ── Nueva partida manual ───────────────────────────────────────────────────
function NuevaPartida({ headers, error, catalogo, mostrarAlerta }) {
  const detalle = catalogo.filter((c) => c.acepta_movimientos && c.activa);
  const vacia = { id_cuenta_contable: "", debe: "", haber: "" };
  const [form, setForm] = useState({ fecha: hoyLocal(), concepto: "", lineas: [vacia, vacia] });
  const [guardando, setGuardando] = useState(false);
  const debe = form.lineas.reduce((t, l) => t + (parseFloat(l.debe) || 0), 0);
  const haber = form.lineas.reduce((t, l) => t + (parseFloat(l.haber) || 0), 0);
  const cuadra = debe > 0 && Math.abs(debe - haber) < 0.005;
  const cambiar = (i, campo, v) => setForm((f) => ({ ...f, lineas: f.lineas.map((l, j) => (j === i ? { ...l, [campo]: v } : l)) }));

  const guardar = async (e) => {
    e.preventDefault();
    setGuardando(true);
    try {
      const r = await axios.post(`${API_URL}/libros/partidas`, form, { headers });
      mostrarAlerta(`Partida registrada (#${r.data.id_partida}).`, "success");
      setForm({ fecha: hoyLocal(), concepto: "", lineas: [vacia, vacia] });
    } catch (x) {
      error(x, "No se pudo registrar la partida.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Tarjeta>
      <p className="small text-muted">Para ajustes del contador: depósitos de caja al banco, estimación de incobrables, reclasificaciones, correcciones. Las operaciones de los socios ya registran su partida solas.</p>
      <form onSubmit={guardar}>
        <div className="row g-2 mb-2">
          <div className="col-12 col-md-3"><label className="form-label small mb-1">Fecha</label><input type="date" className="form-control form-control-sm" value={form.fecha} max={hoyLocal()} onChange={(e) => setForm({ ...form, fecha: e.target.value })} /></div>
          <div className="col-12 col-md-9"><label className="form-label small mb-1">Concepto *</label><input className="form-control form-control-sm" required value={form.concepto} onChange={(e) => setForm({ ...form, concepto: e.target.value })} /></div>
        </div>
        <table className="table table-sm align-middle">
          <thead className="small text-muted"><tr><th>Cuenta</th><th className="text-end" style={{ width: 150 }}>Debe</th><th className="text-end" style={{ width: 150 }}>Haber</th><th style={{ width: 40 }}></th></tr></thead>
          <tbody>
            {form.lineas.map((l, i) => (
              <tr key={i}>
                <td><select className="form-select form-select-sm" value={l.id_cuenta_contable} onChange={(e) => cambiar(i, "id_cuenta_contable", e.target.value)}><option value="">Cuenta...</option>{detalle.map((c) => <option key={c.id_cuenta_contable} value={c.id_cuenta_contable}>{c.codigo} {c.nombre}</option>)}</select></td>
                <td><input type="number" step="0.01" min="0" className="form-control form-control-sm text-end" value={l.debe} onChange={(e) => cambiar(i, "debe", e.target.value)} /></td>
                <td><input type="number" step="0.01" min="0" className="form-control form-control-sm text-end" value={l.haber} onChange={(e) => cambiar(i, "haber", e.target.value)} /></td>
                <td>{form.lineas.length > 2 && <button type="button" className="btn btn-sm btn-link text-danger p-0" onClick={() => setForm((f) => ({ ...f, lineas: f.lineas.filter((_, j) => j !== i) }))}><FaTrash /></button>}</td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr className="fw-bold"><td><button type="button" className="btn btn-sm btn-outline-dark" onClick={() => setForm((f) => ({ ...f, lineas: [...f.lineas, vacia] }))}><FaPlus className="me-1" />Línea</button>{" "}{cuadra ? <span className="text-success small">cuadra</span> : <span className="text-danger small">debe y haber deben ser iguales</span>}</td><td className="text-end">{cifra(debe)}</td><td className="text-end">{cifra(haber)}</td><td></td></tr></tfoot>
        </table>
        <button type="submit" className="btn fw-semibold" style={{ background: ACCENT, color: AZUL }} disabled={!cuadra || guardando}>{guardando && <span className="spinner-border spinner-border-sm me-2" />}Registrar partida</button>
      </form>
    </Tarjeta>
  );
}

// ── Catálogo de cuentas ────────────────────────────────────────────────────
function Catalogo({ headers, error, catalogo, setCatalogo, esSuper }) {
  const [nueva, setNueva] = useState({ codigo: "", nombre: "" });
  const crear = async (e) => {
    e.preventDefault();
    try {
      const r = await axios.post(`${API_URL}/libros/catalogo`, nueva, { headers });
      setCatalogo(r.data.data);
      setNueva({ codigo: "", nombre: "" });
    } catch (x) {
      error(x, "No se pudo crear la cuenta.");
    }
  };
  const renombrar = async (c) => {
    const nombre = window.prompt("Nuevo nombre de la cuenta:", c.nombre);
    if (!nombre) return;
    try {
      const r = await axios.put(`${API_URL}/libros/catalogo/${c.id_cuenta_contable}`, { nombre }, { headers });
      setCatalogo(r.data.data);
    } catch (x) {
      error(x, "No se pudo renombrar.");
    }
  };
  const alternar = async (c) => {
    try {
      const r = await axios.put(`${API_URL}/libros/catalogo/${c.id_cuenta_contable}`, { activa: !c.activa }, { headers });
      setCatalogo(r.data.data);
    } catch (x) {
      error(x, "No se pudo cambiar la cuenta.");
    }
  };
  return (
    <Tarjeta>
      <p className="small text-muted">Catálogo base para cooperativas de ahorro y crédito. Las cuentas marcadas «sistema» las usan las partidas automáticas: se pueden renombrar pero no desactivar. Para agregar una cuenta, usa un código que empiece con el de su grupo (por ejemplo 1103 dentro de 11).</p>
      {esSuper && (
        <form className="d-flex flex-wrap gap-2 mb-3" onSubmit={crear}>
          <input className="form-control form-control-sm" style={{ width: 120 }} placeholder="Código" value={nueva.codigo} onChange={(e) => setNueva({ ...nueva, codigo: e.target.value })} required />
          <input className="form-control form-control-sm" style={{ width: 320 }} placeholder="Nombre" value={nueva.nombre} onChange={(e) => setNueva({ ...nueva, nombre: e.target.value })} required />
          <button className="btn btn-sm btn-dark"><FaPlus className="me-1" />Agregar cuenta</button>
        </form>
      )}
      <table className="table table-sm small">
        <thead className="text-muted"><tr><th>Código</th><th>Nombre</th><th>Tipo</th><th></th></tr></thead>
        <tbody>
          {catalogo.map((c) => (
            <tr key={c.id_cuenta_contable} style={{ opacity: c.activa ? 1 : 0.5, fontWeight: c.acepta_movimientos ? 400 : 700 }}>
              <td>{c.codigo}</td>
              <td style={{ paddingLeft: 8 + (c.codigo.length - 1) * 8 }}>{c.nombre}{c.del_sistema && <span className="badge bg-light text-muted ms-2">sistema</span>}</td>
              <td className="text-capitalize">{c.tipo}</td>
              <td className="text-end">
                {esSuper && <button className="btn btn-link btn-sm p-0 me-2" onClick={() => renombrar(c)}>Renombrar</button>}
                {esSuper && !c.del_sistema && c.acepta_movimientos && <button className="btn btn-link btn-sm p-0 text-muted" onClick={() => alternar(c)}>{c.activa ? "Desactivar" : "Activar"}</button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Tarjeta>
  );
}
