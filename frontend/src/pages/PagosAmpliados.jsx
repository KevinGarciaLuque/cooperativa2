// Pagos ampliados: pago rápido de todos los préstamos de un socio en una operación y conciliación
// de boletas de depósito o transferencia. Función nueva: la enciende el Super Administrador.
import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { FaBolt, FaCheckDouble, FaReceipt, FaSearch, FaUndo } from "react-icons/fa";
import { useAuth } from "../context/AuthContext";
import { useAlerta } from "../context/AlertaContext";
import InputMonto from "../ui/InputMonto";
import ReciboModal from "../components/ReciboModal";
import { dinero } from "../utils/pais";
import { hoyLocal } from "../utils/fechas";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const AZUL = "#1a2035";
const ACCENT = "#a8cd3a";

export default function PagosAmpliados() {
  const { token } = useAuth();
  const { mostrarAlerta } = useAlerta();
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const [tab, setTab] = useState("rapido");

  return (
    <div className="container-fluid py-3">
      <div className="d-flex align-items-center gap-3 mb-3">
        <div className="d-flex align-items-center justify-content-center" style={{ width: 48, height: 48, borderRadius: 12, background: AZUL, color: ACCENT }}>
          <FaBolt size={20} />
        </div>
        <div>
          <h4 className="fw-bold mb-0" style={{ color: AZUL }}>Pago rápido y conciliación</h4>
          <div className="text-muted small">Cobrar todos los préstamos de un socio de una vez y conciliar boletas</div>
        </div>
      </div>
      <ul className="nav nav-tabs mb-3">
        {[["rapido", "Pago rápido"], ["conciliacion", "Conciliación de boletas"]].map(([k, t]) => (
          <li className="nav-item" key={k}>
            <button className={`nav-link ${tab === k ? "active fw-semibold" : ""}`} onClick={() => setTab(k)}>{t}</button>
          </li>
        ))}
      </ul>
      {tab === "rapido" ? <PagoRapido headers={headers} mostrarAlerta={mostrarAlerta} /> : <Conciliacion headers={headers} mostrarAlerta={mostrarAlerta} />}
    </div>
  );
}

function PagoRapido({ headers, mostrarAlerta }) {
  const [buscar, setBuscar] = useState("");
  const [socios, setSocios] = useState([]);
  const [socio, setSocio] = useState(null);
  const [filas, setFilas] = useState([]);
  const [cuentas, setCuentas] = useState([]);
  const [datos, setDatos] = useState({ metodo_pago: "efectivo", fecha_pago: hoyLocal(), numero_boleta: "", lugar_pago: "" });
  const [resultado, setResultado] = useState(null);
  const [trabajando, setTrabajando] = useState(false);
  const [recibo, setRecibo] = useState(null);

  const buscarSocios = async (e) => {
    e?.preventDefault();
    if (buscar.trim().length < 2) return;
    try {
      const r = await axios.get(`${API_URL}/usuarios`, { headers, params: { rol: "Socio", search: buscar.trim(), limit: 10 } });
      setSocios(r.data.data || []);
    } catch {
      setSocios([]);
    }
  };

  const elegir = async (s) => {
    setSocio(s);
    setSocios([]);
    setResultado(null);
    try {
      const r = await axios.get(`${API_URL}/prestamos`, { headers, params: { id_usuario: s.id_usuario } });
      const vigentes = (r.data.data || []).filter((p) => ["activo", "mora"].includes(p.estado));
      const conCuota = await Promise.all(
        vigentes.map(async (p) => {
          try {
            const x = await axios.get(`${API_URL}/pagos/prestamo/${p.id_prestamo}/proximo-pago`, { headers });
            const pp = x.data.proximo_pago || {};
            return { ...p, sugerido: pp.total_a_pagar || 0, para_saldar: pp.total_para_saldar || p.saldo_restante, monto: String(pp.total_a_pagar || ""), otros_cargos: "", otros_cargos_detalle: "" };
          } catch {
            return { ...p, sugerido: 0, para_saldar: p.saldo_restante, monto: "", otros_cargos: "", otros_cargos_detalle: "" };
          }
        })
      );
      setFilas(conCuota);
      // Sus cuentas de ahorro (para ver saldos y depositar en la misma operación)
      const c = await axios.get(`${API_URL}/cuentas`, { headers, params: { id_usuario: s.id_usuario } }).catch(() => ({ data: { data: [] } }));
      setCuentas((c.data.data || []).filter((x) => (x.estado || "activa") === "activa").map((x) => ({ ...x, monto: "" })));
    } catch (e) {
      mostrarAlerta(e.response?.data?.message || "No se pudieron cargar los préstamos.", "error");
    }
  };

  const total =
    filas.reduce((t, f) => t + (parseFloat(f.monto) || 0) + (parseFloat(f.otros_cargos) || 0), 0) +
    cuentas.reduce((t, c) => t + (parseFloat(c.monto) || 0), 0);
  const registrar = async () => {
    setTrabajando(true);
    try {
      const r = await axios.post(
        `${API_URL}/pagos-ampliados/rapido`,
        {
          ...datos,
          detalles: filas.map((f) => ({ id_prestamo: f.id_prestamo, monto_pagado: f.monto, otros_cargos: f.otros_cargos, otros_cargos_detalle: f.otros_cargos_detalle })),
          depositos: cuentas.map((c) => ({ id_cuenta: c.id_cuenta, monto: c.monto })),
        },
        { headers }
      );
      mostrarAlerta(r.data.message, "success");
      setResultado(r.data);
    } catch (e) {
      mostrarAlerta(e.response?.data?.message || "No se pudo registrar el pago.", "error");
    } finally {
      setTrabajando(false);
    }
  };
  const cambiar = (k, campo, v) => setFilas(filas.map((x, j) => (j === k ? { ...x, [campo]: v } : x)));

  return (
    <div className="card border-0 shadow-sm" style={{ borderRadius: 14 }}>
      <div className="card-body">
        <form className="d-flex gap-2 mb-3" onSubmit={buscarSocios}>
          <input className="form-control" placeholder="Número de socio, identidad o nombre" value={buscar} onChange={(e) => setBuscar(e.target.value)} autoFocus />
          <button className="btn btn-primary"><FaSearch /></button>
        </form>
        {socios.length > 0 && (
          <div className="list-group mb-3">
            {socios.map((s) => (
              <button key={s.id_usuario} className="list-group-item list-group-item-action" onClick={() => elegir(s)}>
                <strong>{s.nombre_completo}</strong> <span className="text-muted small">· {s.dni}{s.numero_socio ? ` · N.º ${s.numero_socio}` : ""}</span>
              </button>
            ))}
          </div>
        )}

        {socio && !resultado && (
          <>
            <h6 className="fw-bold" style={{ color: AZUL }}>{socio.nombre_completo}</h6>
            {!filas.length && !cuentas.length ? (
              <div className="text-muted small">No tiene préstamos vigentes ni cuentas activas.</div>
            ) : (
              <>
                <div className="row g-2 mb-3">
                  <div className="col-6 col-md-3">
                    <label className="form-label small mb-1">Forma de pago</label>
                    <select className="form-select form-select-sm" value={datos.metodo_pago} onChange={(e) => setDatos({ ...datos, metodo_pago: e.target.value })}>
                      <option value="efectivo">Efectivo</option>
                      <option value="deposito">Depósito</option>
                      <option value="transferencia">Transferencia</option>
                      <option value="cheque">Cheque</option>
                    </select>
                  </div>
                  <div className="col-6 col-md-3">
                    <label className="form-label small mb-1">Fecha</label>
                    <input type="date" className="form-control form-control-sm" max={hoyLocal()} value={datos.fecha_pago} onChange={(e) => setDatos({ ...datos, fecha_pago: e.target.value })} />
                  </div>
                  <div className="col-6 col-md-3">
                    <label className="form-label small mb-1">N.º de boleta</label>
                    <input className="form-control form-control-sm" maxLength={40} value={datos.numero_boleta} onChange={(e) => setDatos({ ...datos, numero_boleta: e.target.value })} />
                  </div>
                  <div className="col-6 col-md-3">
                    <label className="form-label small mb-1">Lugar de pago</label>
                    <input className="form-control form-control-sm" maxLength={80} value={datos.lugar_pago} onChange={(e) => setDatos({ ...datos, lugar_pago: e.target.value })} />
                  </div>
                </div>
                <div className="table-responsive">
                  <table className="table table-sm align-middle">
                    <thead className="table-light">
                      <tr><th>Préstamo</th><th className="text-end">Cuota del mes</th><th className="text-end">Para saldar</th><th style={{ width: 140 }}>Paga</th><th style={{ width: 120 }}>Otros cargos</th><th>Concepto</th></tr>
                    </thead>
                    <tbody>
                      {filas.map((f, k) => (
                        <tr key={f.id_prestamo}>
                          <td>
                            #{f.id_prestamo} {f.estado === "mora" && <span className="badge bg-danger">mora</span>}
                            {f.grupo_nombre && <div className="small text-muted">Grupo: {f.grupo_nombre}</div>}
                          </td>
                          <td className="text-end small">{dinero(f.sugerido)}</td>
                          <td className="text-end small">{dinero(f.para_saldar)}</td>
                          <td><InputMonto className="form-control form-control-sm" value={f.monto} onChange={(v) => cambiar(k, "monto", v)} /></td>
                          <td><InputMonto className="form-control form-control-sm" value={f.otros_cargos} onChange={(v) => cambiar(k, "otros_cargos", v)} /></td>
                          <td><input className="form-control form-control-sm" maxLength={150} placeholder="Ej.: seguro" value={f.otros_cargos_detalle} onChange={(e) => cambiar(k, "otros_cargos_detalle", e.target.value)} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {cuentas.length > 0 && (
                  <div className="table-responsive">
                    <div className="small fw-semibold mb-1">Ahorro (depósito con el mismo pago)</div>
                    <table className="table table-sm align-middle">
                      <thead className="table-light"><tr><th>Cuenta</th><th className="text-end">Saldo actual</th><th style={{ width: 140 }}>Deposita</th></tr></thead>
                      <tbody>
                        {cuentas.map((c, k) => (
                          <tr key={c.id_cuenta}>
                            <td>{c.tipo_cuenta} <span className="text-muted small">#{c.id_cuenta}</span></td>
                            <td className="text-end">{dinero(c.saldo_actual)}</td>
                            <td><InputMonto className="form-control form-control-sm" value={c.monto} onChange={(v) => setCuentas(cuentas.map((x, j) => (j === k ? { ...x, monto: v } : x)))} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
                  <div className="small text-muted">Se registra todo junto: si un pago no es válido, no se registra ninguno.</div>
                  <button className="btn btn-success" disabled={trabajando || total <= 0} onClick={registrar}>
                    {trabajando ? "Registrando..." : `Registrar ${dinero(total)}`}
                  </button>
                </div>
              </>
            )}
          </>
        )}

        {resultado && (
          <>
            <div className="alert alert-success py-2">{resultado.message}</div>
            <table className="table table-sm align-middle">
              <thead className="table-light"><tr><th>Préstamo</th><th className="text-end">Pagó</th><th className="text-end">Otros cargos</th><th className="text-end">Nuevo saldo</th><th></th></tr></thead>
              <tbody>
                {resultado.detalles.map((d) => (
                  <tr key={d.id_prestamo}>
                    <td>#{d.id_prestamo} {d.liquidado && <span className="badge bg-success">cancelado</span>}</td>
                    <td className="text-end">{dinero(d.monto_pagado)}</td>
                    <td className="text-end small">{d.otros_cargos ? dinero(d.otros_cargos) : "—"}</td>
                    <td className="text-end fw-semibold">{dinero(d.saldo_nuevo)}</td>
                    <td>{d.id_recibo && <button className="btn btn-sm btn-outline-secondary" onClick={() => setRecibo(d.id_recibo)}><FaReceipt /></button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(resultado.depositos || []).length > 0 && (
              <table className="table table-sm align-middle">
                <thead className="table-light"><tr><th>Cuenta</th><th className="text-end">Depositó</th><th className="text-end">Nuevo saldo</th></tr></thead>
                <tbody>
                  {resultado.depositos.map((d) => (
                    <tr key={d.id_cuenta}>
                      <td>{d.tipo_cuenta}</td>
                      <td className="text-end">{dinero(d.monto)}</td>
                      <td className="text-end fw-semibold">{dinero(d.saldo_nuevo)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <button className="btn btn-outline-primary btn-sm" onClick={() => { setSocio(null); setFilas([]); setCuentas([]); setResultado(null); setBuscar(""); }}>
              Atender a otro socio
            </button>
          </>
        )}
      </div>
      {recibo && <ReciboModal idRecibo={recibo} onClose={() => setRecibo(null)} />}
    </div>
  );
}

function Conciliacion({ headers, mostrarAlerta }) {
  const [filtro, setFiltro] = useState({ estado: "pendiente", desde: "", hasta: "", search: "" });
  const [datos, setDatos] = useState({ data: [], total: 0 });
  const [marcados, setMarcados] = useState(new Set());

  const cargar = useCallback(() => {
    const params = Object.fromEntries(Object.entries(filtro).filter(([, v]) => v));
    axios
      .get(`${API_URL}/pagos-ampliados/conciliacion`, { headers, params })
      .then((r) => {
        setDatos({ data: r.data.data || [], total: r.data.total || 0 });
        setMarcados(new Set());
      })
      .catch((e) => mostrarAlerta(e.response?.data?.message || "No se pudieron cargar los pagos.", "error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headers, filtro]);
  useEffect(() => {
    cargar();
  }, [cargar]);

  const marcar = async (conciliado) => {
    try {
      const r = await axios.put(`${API_URL}/pagos-ampliados/conciliacion`, { ids: [...marcados], conciliado }, { headers });
      mostrarAlerta(r.data.message, "success");
      cargar();
    } catch (e) {
      mostrarAlerta(e.response?.data?.message || "No se pudo conciliar.", "error");
    }
  };
  const alternar = (id) => {
    const n = new Set(marcados);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    setMarcados(n);
  };
  const totalMarcado = datos.data.filter((f) => marcados.has(f.id_pago)).reduce((t, f) => t + f.monto_pagado + f.otros_cargos, 0);

  return (
    <div className="card border-0 shadow-sm" style={{ borderRadius: 14 }}>
      <div className="card-body">
        <div className="row g-2 mb-3">
          <div className="col-6 col-md-3">
            <select className="form-select form-select-sm" value={filtro.estado} onChange={(e) => setFiltro({ ...filtro, estado: e.target.value })}>
              <option value="pendiente">Por conciliar</option>
              <option value="conciliado">Conciliados</option>
              <option value="todos">Todos</option>
            </select>
          </div>
          <div className="col-6 col-md-3"><input type="date" className="form-control form-control-sm" value={filtro.desde} onChange={(e) => setFiltro({ ...filtro, desde: e.target.value })} /></div>
          <div className="col-6 col-md-3"><input type="date" className="form-control form-control-sm" value={filtro.hasta} onChange={(e) => setFiltro({ ...filtro, hasta: e.target.value })} /></div>
          <div className="col-6 col-md-3"><input className="form-control form-control-sm" placeholder="Boleta o socio" value={filtro.search} onChange={(e) => setFiltro({ ...filtro, search: e.target.value })} /></div>
        </div>
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2">
          <div className="small text-muted">
            {datos.data.length} pago(s) · {dinero(datos.total)}
            {marcados.size > 0 && <> · <strong>{marcados.size} marcados: {dinero(totalMarcado)}</strong></>}
          </div>
          <div className="d-flex gap-2">
            {filtro.estado !== "conciliado" && (
              <button className="btn btn-success btn-sm" disabled={!marcados.size} onClick={() => marcar(true)}>
                <FaCheckDouble className="me-1" /> Marcar conciliados
              </button>
            )}
            {filtro.estado !== "pendiente" && (
              <button className="btn btn-outline-secondary btn-sm" disabled={!marcados.size} onClick={() => marcar(false)}>
                <FaUndo className="me-1" /> Volver a pendiente
              </button>
            )}
          </div>
        </div>
        <div className="table-responsive">
          <table className="table table-sm align-middle">
            <thead className="table-light">
              <tr>
                <th style={{ width: 32 }}>
                  <input type="checkbox" className="form-check-input" checked={datos.data.length > 0 && marcados.size === datos.data.length}
                    onChange={(e) => setMarcados(e.target.checked ? new Set(datos.data.map((f) => f.id_pago)) : new Set())} />
                </th>
                <th>Fecha</th><th>Boleta</th><th>Socio</th><th>Préstamo</th><th>Forma</th><th>Lugar</th><th className="text-end">Monto</th><th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {datos.data.map((f) => (
                <tr key={f.id_pago}>
                  <td><input type="checkbox" className="form-check-input" checked={marcados.has(f.id_pago)} onChange={() => alternar(f.id_pago)} /></td>
                  <td className="small text-nowrap">{String(f.fecha_pago).substring(0, 10)}</td>
                  <td className="fw-semibold">{f.numero_boleta || <span className="text-muted fw-normal">—</span>}</td>
                  <td className="small">{f.nombre_completo}</td>
                  <td className="small">#{f.id_prestamo}</td>
                  <td className="small">{f.metodo_pago}</td>
                  <td className="small">{f.lugar_pago || "—"}</td>
                  <td className="text-end">{dinero(f.monto_pagado + f.otros_cargos)}</td>
                  <td>
                    {f.conciliado ? (
                      <span className="badge bg-success" title={`${f.conciliado_por_nombre || ""} ${String(f.conciliado_en || "").substring(0, 10)}`}>Conciliado</span>
                    ) : (
                      <span className="badge bg-warning text-dark">Por conciliar</span>
                    )}
                  </td>
                </tr>
              ))}
              {!datos.data.length && (
                <tr><td colSpan={9} className="text-center text-muted py-3">No hay pagos con estos filtros.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
