// Descuento por planilla: empresas con convenio, préstamos que se cobran descontando la cuota del
// salario, la planilla del mes para la empresa (Excel) y el pago de la empresa aplicado a todos los
// préstamos en un solo paso. Función nueva "descuento_planilla".
import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { FaBuilding, FaFileExcel, FaPlus, FaEdit, FaTimes, FaCheckDouble, FaListAlt, FaArrowLeft, FaBan } from "react-icons/fa";
import { useAuth } from "../context/AuthContext";
import { useAlerta } from "../context/AlertaContext";
import { dinero, simboloMoneda } from "../utils/pais";
import Pestanas from "../components/Pestanas";
import { bajarArchivo, mensajeBlob } from "../components/DocumentosCredito";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const AZUL = "#1a2035";
const ACCENT = "#a8cd3a";
const ESTADO = {
  generada: ["Por aplicar", "#b45309", "#fef3c7"],
  aplicada: ["Aplicada", "#15803d", "#dcfce7"],
  anulada: ["Anulada", "#64748b", "#f1f5f9"],
  pendiente: ["Pendiente", "#b45309", "#fef3c7"],
  aplicado: ["Aplicado", "#15803d", "#dcfce7"],
  no_descontado: ["No descontado", "#b91c1c", "#fee2e2"],
};
const Etiqueta = ({ e }) => {
  const [t, c, f] = ESTADO[e] || [e, "#475569", "#f1f5f9"];
  return <span className="badge rounded-pill" style={{ background: f, color: c }}>{t}</span>;
};
const mesActual = () => new Date().toISOString().substring(0, 7);

export default function PlanillasConvenio() {
  const { token } = useAuth();
  const { mostrarAlerta } = useAlerta();
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const error = (e, m) => mostrarAlerta(e.response?.data?.message || m, "error");
  const [tab, setTab] = useState("planillas");
  const [empresas, setEmpresas] = useState([]);
  const [lotes, setLotes] = useState([]);

  const cargar = useCallback(() => {
    axios.get(`${API_URL}/planillas/empresas`, { headers }).then((r) => setEmpresas(r.data.data || [])).catch((e) => error(e, "No se pudieron cargar las empresas."));
    axios.get(`${API_URL}/planillas/lotes`, { headers }).then((r) => setLotes(r.data.data || [])).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headers]);
  useEffect(() => {
    cargar();
  }, [cargar]);

  return (
    <div className="container-fluid py-3">
      <div className="d-flex align-items-center gap-3 mb-3">
        <div className="d-flex align-items-center justify-content-center" style={{ width: 48, height: 48, borderRadius: 12, background: AZUL, color: ACCENT }}>
          <FaBuilding size={20} />
        </div>
        <div>
          <h4 className="fw-bold mb-0" style={{ color: AZUL }}>Descuento por planilla</h4>
          <div className="text-muted small">Préstamos que la empresa descuenta del salario del socio y paga a la cooperativa</div>
        </div>
      </div>
      <Pestanas
        activa={tab}
        onCambiar={setTab}
        tabs={[
          { clave: "planillas", titulo: "Planillas del mes", icono: <FaListAlt />, cuenta: lotes.filter((l) => l.estado === "generada").length, alerta: true },
          { clave: "empresas", titulo: "Empresas con convenio", icono: <FaBuilding />, cuenta: empresas.filter((e) => e.activa).length },
        ]}
      />
      {tab === "planillas" ? (
        <Planillas headers={headers} token={token} empresas={empresas} lotes={lotes} recargar={cargar} mostrarAlerta={mostrarAlerta} error={error} />
      ) : (
        <Empresas headers={headers} empresas={empresas} recargar={cargar} mostrarAlerta={mostrarAlerta} error={error} />
      )}
    </div>
  );
}

// ── Empresas ────────────────────────────────────────────────────────────────
function Empresas({ headers, empresas, recargar, mostrarAlerta, error }) {
  const [editando, setEditando] = useState(null); // {} nueva | empresa
  const [abierta, setAbierta] = useState(null);

  const guardar = async () => {
    try {
      const r = editando.id_empresa
        ? await axios.put(`${API_URL}/planillas/empresas/${editando.id_empresa}`, editando, { headers })
        : await axios.post(`${API_URL}/planillas/empresas`, editando, { headers });
      mostrarAlerta(r.data.message, "success");
      setEditando(null);
      recargar();
    } catch (e) {
      error(e, "No se pudo guardar la empresa.");
    }
  };

  if (abierta) return <PrestamosEmpresa empresa={abierta} headers={headers} volver={() => { setAbierta(null); recargar(); }} mostrarAlerta={mostrarAlerta} error={error} />;

  return (
    <div className="card border-0 shadow-sm" style={{ borderRadius: 14 }}>
      <div className="card-body">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <div className="small text-muted">Registra la empresa y luego agrega los préstamos de sus empleados que se cobran por planilla.</div>
          <button className="btn btn-sm fw-semibold" style={{ background: ACCENT, color: "#1a2a00" }} onClick={() => setEditando({ nombre: "", contacto: "", telefono: "", correo: "", dia_corte: "" })}>
            <FaPlus className="me-1" /> Nueva empresa
          </button>
        </div>
        {empresas.length === 0 ? (
          <div className="text-center text-muted py-4">Aún no hay empresas con convenio.</div>
        ) : (
          <div className="table-responsive">
            <table className="table align-middle mb-0">
              <thead>
                <tr className="small text-muted"><th>Empresa</th><th>Contacto</th><th className="text-end">Préstamos</th><th className="text-end">Saldo</th><th /></tr>
              </thead>
              <tbody>
                {empresas.map((e) => (
                  <tr key={e.id_empresa} style={{ opacity: e.activa ? 1 : 0.55 }}>
                    <td>
                      <div className="fw-semibold">{e.nombre}</div>
                      <div className="small text-muted">{e.dia_corte ? `Corte el día ${e.dia_corte}` : "Sin día de corte"}{!e.activa && " · inactiva"}</div>
                    </td>
                    <td className="small">{[e.contacto, e.telefono, e.correo].filter(Boolean).join(" · ") || "—"}</td>
                    <td className="text-end">{e.prestamos}</td>
                    <td className="text-end">{dinero(e.saldo)}</td>
                    <td className="text-end text-nowrap">
                      <button className="btn btn-sm btn-outline-dark me-1" onClick={() => setAbierta(e)}>Préstamos</button>
                      <button className="btn btn-sm btn-outline-secondary" onClick={() => setEditando({ ...e, dia_corte: e.dia_corte ?? "" })} title="Editar">
                        <FaEdit />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editando && (
        <div className="modal d-block" style={{ background: "rgba(0,0,0,.4)" }} onClick={() => setEditando(null)}>
          <div className="modal-dialog modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content" style={{ borderRadius: 14 }}>
              <div className="modal-header">
                <h5 className="modal-title">{editando.id_empresa ? "Editar empresa" : "Nueva empresa con convenio"}</h5>
                <button className="btn-close" onClick={() => setEditando(null)} />
              </div>
              <div className="modal-body">
                {[["nombre", "Nombre de la empresa"], ["contacto", "Persona de contacto (RR. HH.)"], ["telefono", "Teléfono"], ["correo", "Correo"]].map(([k, t]) => (
                  <div className="mb-2" key={k}>
                    <label className="form-label small fw-semibold mb-1">{t}</label>
                    <input className="form-control" value={editando[k] || ""} onChange={(e) => setEditando({ ...editando, [k]: e.target.value })} />
                  </div>
                ))}
                <div className="mb-2">
                  <label className="form-label small fw-semibold mb-1">Día de corte de la planilla (opcional)</label>
                  <input type="number" min="1" max="31" className="form-control" value={editando.dia_corte} onChange={(e) => setEditando({ ...editando, dia_corte: e.target.value })} />
                </div>
                {editando.id_empresa && (
                  <div className="form-check form-switch mt-2">
                    <input id="emp-activa" type="checkbox" className="form-check-input" checked={editando.activa !== false} onChange={(e) => setEditando({ ...editando, activa: e.target.checked })} />
                    <label htmlFor="emp-activa" className="form-check-label">Convenio activo</label>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button className="btn btn-light" onClick={() => setEditando(null)}>Cancelar</button>
                <button className="btn btn-primary" onClick={guardar}>Guardar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PrestamosEmpresa({ empresa, headers, volver, mostrarAlerta, error }) {
  const [lista, setLista] = useState([]);
  const [buscar, setBuscar] = useState("");
  const [encontrados, setEncontrados] = useState([]);

  const cargar = useCallback(() => {
    axios.get(`${API_URL}/planillas/empresas/${empresa.id_empresa}/prestamos`, { headers }).then((r) => setLista(r.data.data || [])).catch((e) => error(e, "No se pudieron cargar los préstamos."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresa.id_empresa, headers]);
  useEffect(() => {
    cargar();
  }, [cargar]);

  useEffect(() => {
    if (buscar.trim().length < 2) return setEncontrados([]);
    const t = setTimeout(() => {
      axios.get(`${API_URL}/planillas/prestamos-disponibles`, { headers, params: { buscar } }).then((r) => setEncontrados(r.data.data || [])).catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [buscar, headers]);

  const agregar = async (p) => {
    try {
      await axios.post(`${API_URL}/planillas/empresas/${empresa.id_empresa}/prestamos`, { id_prestamo: p.id_prestamo }, { headers });
      setBuscar("");
      cargar();
    } catch (e) {
      error(e, "No se pudo agregar el préstamo.");
    }
  };
  const quitar = async (p) => {
    if (!window.confirm(`¿Dejar de cobrar por planilla el préstamo #${p.id_prestamo} de ${p.nombre_completo}?`)) return;
    try {
      await axios.delete(`${API_URL}/planillas/prestamos/${p.id_prestamo}`, { headers });
      mostrarAlerta("El préstamo ya no se cobra por planilla.", "success");
      cargar();
    } catch (e) {
      error(e, "No se pudo quitar el préstamo.");
    }
  };
  const total = lista.reduce((t, p) => t + p.descuento_mensual, 0);

  return (
    <div className="card border-0 shadow-sm" style={{ borderRadius: 14 }}>
      <div className="card-body">
        <button className="btn btn-sm btn-link px-0 mb-2" onClick={volver}><FaArrowLeft className="me-1" /> Empresas</button>
        <h5 className="fw-bold" style={{ color: AZUL }}>{empresa.nombre}</h5>
        <div className="position-relative mb-3" style={{ maxWidth: 520 }}>
          <input className="form-control" placeholder="Agregar préstamo: busca al socio por nombre, identidad o número de préstamo" value={buscar} onChange={(e) => setBuscar(e.target.value)} />
          {encontrados.length > 0 && (
            <div className="list-group position-absolute w-100 shadow" style={{ zIndex: 10 }}>
              {encontrados.map((p) => (
                <button key={p.id_prestamo} className="list-group-item list-group-item-action small" onClick={() => agregar(p)}>
                  <strong>#{p.id_prestamo}</strong> · {p.nombre_completo} ({p.dni}) · saldo {dinero(p.saldo_restante)}
                </button>
              ))}
            </div>
          )}
        </div>
        {lista.length === 0 ? (
          <div className="text-muted small">Todavía no hay préstamos de esta empresa.</div>
        ) : (
          <div className="table-responsive">
            <table className="table table-sm align-middle mb-0">
              <thead><tr className="small text-muted"><th>Socio</th><th>Préstamo</th><th className="text-end">Saldo</th><th className="text-end">Descuento al mes</th><th /></tr></thead>
              <tbody>
                {lista.map((p) => (
                  <tr key={p.id_prestamo}>
                    <td>{p.nombre_completo}<div className="small text-muted">{p.dni}</div></td>
                    <td>#{p.id_prestamo}{p.estado === "mora" && <span className="badge bg-danger ms-1">mora</span>}</td>
                    <td className="text-end">{dinero(p.saldo_restante)}</td>
                    <td className="text-end fw-semibold">{dinero(p.descuento_mensual)}</td>
                    <td className="text-end">
                      <button className="btn btn-sm btn-outline-danger" onClick={() => quitar(p)} title="Quitar de la planilla"><FaTimes /></button>
                    </td>
                  </tr>
                ))}
                <tr className="fw-bold"><td colSpan={3}>Total al mes</td><td className="text-end">{dinero(total)}</td><td /></tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Planillas ───────────────────────────────────────────────────────────────
function Planillas({ headers, token, empresas, lotes, recargar, mostrarAlerta, error }) {
  const [nueva, setNueva] = useState({ id_empresa: "", periodo: mesActual() });
  const [abierto, setAbierto] = useState(null);
  const activas = empresas.filter((e) => e.activa);

  const generar = async () => {
    if (!nueva.id_empresa) return mostrarAlerta("Elige la empresa.", "warning");
    try {
      const r = await axios.post(`${API_URL}/planillas/lotes`, nueva, { headers });
      mostrarAlerta(r.data.message, "success");
      recargar();
      setAbierto(r.data.id_lote);
    } catch (e) {
      error(e, "No se pudo generar la planilla.");
    }
  };

  if (abierto) return <Lote id={abierto} headers={headers} token={token} volver={() => { setAbierto(null); recargar(); }} mostrarAlerta={mostrarAlerta} error={error} />;

  return (
    <>
      <div className="card border-0 shadow-sm mb-3" style={{ borderRadius: 14 }}>
        <div className="card-body">
          <div className="fw-semibold mb-2" style={{ color: AZUL }}>Generar la planilla del mes</div>
          {activas.length === 0 ? (
            <div className="small text-muted">Primero registra una empresa en la pestaña Empresas con convenio.</div>
          ) : (
            <div className="row g-2 align-items-end">
              <div className="col-12 col-md-5">
                <label className="form-label small mb-1">Empresa</label>
                <select className="form-select" value={nueva.id_empresa} onChange={(e) => setNueva({ ...nueva, id_empresa: e.target.value })}>
                  <option value="">Elige la empresa</option>
                  {activas.map((e) => <option key={e.id_empresa} value={e.id_empresa}>{e.nombre} ({e.prestamos} préstamos)</option>)}
                </select>
              </div>
              <div className="col-7 col-md-3">
                <label className="form-label small mb-1">Mes</label>
                <input type="month" className="form-control" value={nueva.periodo} onChange={(e) => setNueva({ ...nueva, periodo: e.target.value })} />
              </div>
              <div className="col-5 col-md-auto">
                <button className="btn w-100 fw-semibold" style={{ background: ACCENT, color: "#1a2a00" }} onClick={generar}>Generar</button>
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="card border-0 shadow-sm" style={{ borderRadius: 14 }}>
        <div className="card-body">
          {lotes.length === 0 ? (
            <div className="text-center text-muted py-3">No hay planillas todavía.</div>
          ) : (
            <div className="table-responsive">
              <table className="table align-middle mb-0">
                <thead><tr className="small text-muted"><th>Mes</th><th>Empresa</th><th className="text-end">Préstamos</th><th className="text-end">A descontar</th><th className="text-end">Recibido</th><th>Estado</th><th /></tr></thead>
                <tbody>
                  {lotes.map((l) => (
                    <tr key={l.id_lote}>
                      <td className="fw-semibold">{l.periodo}</td>
                      <td>{l.empresa}</td>
                      <td className="text-end">{l.prestamos}</td>
                      <td className="text-end">{dinero(l.total_esperado)}</td>
                      <td className="text-end">{l.total_recibido === null ? "—" : dinero(l.total_recibido)}</td>
                      <td><Etiqueta e={l.estado} /></td>
                      <td className="text-end"><button className="btn btn-sm btn-outline-dark" onClick={() => setAbierto(l.id_lote)}>Abrir</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function Lote({ id, headers, token, volver, mostrarAlerta, error }) {
  const [l, setL] = useState(null);
  const [recibido, setRecibido] = useState({}); // id_detalle -> { monto, nota }
  const [pago, setPago] = useState({ metodo: "transferencia", referencia: "" });
  const [ocupado, setOcupado] = useState(false);

  const cargar = useCallback(() => {
    axios.get(`${API_URL}/planillas/lotes/${id}`, { headers }).then((r) => {
      setL(r.data.data);
      setRecibido(Object.fromEntries(r.data.data.detalle.map((d) => [d.id_detalle, { monto: String(d.monto_recibido ?? d.monto_esperado), nota: d.nota || "" }])));
    }).catch((e) => error(e, "No se pudo cargar la planilla."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, headers]);
  useEffect(() => {
    cargar();
  }, [cargar]);

  if (!l) return <div className="text-center py-4"><div className="spinner-border spinner-border-sm" /></div>;
  const porAplicar = l.estado === "generada";
  const total = l.detalle.reduce((t, d) => t + (parseFloat(recibido[d.id_detalle]?.monto) || 0), 0);

  const excel = async () => {
    try {
      await bajarArchivo(`${API_URL}/planillas/lotes/${id}/excel`, token, `planilla_${l.periodo}.xlsx`);
    } catch (e) {
      mostrarAlerta(await mensajeBlob(e, "No se pudo generar el Excel."), "error");
    }
  };
  const aplicar = async () => {
    if (!window.confirm(`¿Aplicar ${dinero(total)} recibidos de ${l.empresa}? Se registra un pago en cada préstamo con monto mayor a 0.`)) return;
    setOcupado(true);
    try {
      const r = await axios.post(
        `${API_URL}/planillas/lotes/${id}/aplicar`,
        { ...pago, detalle: l.detalle.map((d) => ({ id_detalle: d.id_detalle, monto_recibido: recibido[d.id_detalle]?.monto, nota: recibido[d.id_detalle]?.nota })) },
        { headers }
      );
      mostrarAlerta(r.data.message, "success");
      cargar();
    } catch (e) {
      error(e, "No se pudo aplicar la planilla.");
    }
    setOcupado(false);
  };
  const anular = async () => {
    if (!window.confirm("¿Anular esta planilla? Podrás generarla de nuevo.")) return;
    try {
      await axios.delete(`${API_URL}/planillas/lotes/${id}`, { headers });
      volver();
    } catch (e) {
      error(e, "No se pudo anular.");
    }
  };

  return (
    <div className="card border-0 shadow-sm" style={{ borderRadius: 14 }}>
      <div className="card-body">
        <button className="btn btn-sm btn-link px-0 mb-2" onClick={volver}><FaArrowLeft className="me-1" /> Planillas</button>
        <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
          <div>
            <h5 className="fw-bold mb-0" style={{ color: AZUL }}>{l.empresa} · {l.periodo}</h5>
            <div className="small text-muted"><Etiqueta e={l.estado} /> {l.referencia && `· Ref. ${l.referencia}`}</div>
          </div>
          <div className="d-flex gap-2">
            <button className="btn btn-sm btn-outline-success" onClick={excel}><FaFileExcel className="me-1" /> Excel para la empresa</button>
            {porAplicar && <button className="btn btn-sm btn-outline-secondary" onClick={anular}><FaBan className="me-1" /> Anular</button>}
          </div>
        </div>
        {porAplicar && (
          <div className="alert alert-light border small">
            Manda el Excel a la empresa. Cuando pague, revisa cuánto descontó a cada empleado (0 si no se lo descontó) y aplica el pago:
            se registra en cada préstamo con su recibo, como en ventanilla.
          </div>
        )}
        <div className="table-responsive">
          <table className="table table-sm align-middle">
            <thead><tr className="small text-muted"><th>Socio</th><th>Préstamo</th><th className="text-end">A descontar</th><th style={{ width: 150 }}>Recibido</th><th>Nota</th>{!porAplicar && <th>Estado</th>}</tr></thead>
            <tbody>
              {l.detalle.map((d) => (
                <tr key={d.id_detalle}>
                  <td>{d.nombre_completo}<div className="small text-muted">{d.dni}</div></td>
                  <td>#{d.id_prestamo}</td>
                  <td className="text-end">{dinero(d.monto_esperado)}</td>
                  <td>
                    {porAplicar ? (
                      <div className="input-group input-group-sm">
                        <span className="input-group-text">{simboloMoneda()}</span>
                        <input type="number" min="0" step="0.01" className="form-control" value={recibido[d.id_detalle]?.monto ?? ""}
                          onChange={(e) => setRecibido({ ...recibido, [d.id_detalle]: { ...recibido[d.id_detalle], monto: e.target.value } })} />
                      </div>
                    ) : (
                      dinero(d.monto_recibido || 0)
                    )}
                  </td>
                  <td>
                    {porAplicar ? (
                      <input className="form-control form-control-sm" placeholder="Opcional" value={recibido[d.id_detalle]?.nota ?? ""}
                        onChange={(e) => setRecibido({ ...recibido, [d.id_detalle]: { ...recibido[d.id_detalle], nota: e.target.value } })} />
                    ) : (
                      <span className="small">{d.nota || ""}</span>
                    )}
                  </td>
                  {!porAplicar && <td><Etiqueta e={d.estado} /></td>}
                </tr>
              ))}
              <tr className="fw-bold">
                <td colSpan={2}>Total</td>
                <td className="text-end">{dinero(l.total_esperado)}</td>
                <td>{dinero(porAplicar ? total : l.total_recibido || 0)}</td>
                <td colSpan={porAplicar ? 1 : 2} />
              </tr>
            </tbody>
          </table>
        </div>
        {porAplicar && (
          <div className="row g-2 align-items-end">
            <div className="col-6 col-md-3">
              <label className="form-label small mb-1">Cómo pagó la empresa</label>
              <select className="form-select" value={pago.metodo} onChange={(e) => setPago({ ...pago, metodo: e.target.value })}>
                <option value="transferencia">Transferencia</option>
                <option value="deposito">Depósito</option>
                <option value="cheque">Cheque</option>
                <option value="efectivo">Efectivo</option>
              </select>
            </div>
            <div className="col-6 col-md-3">
              <label className="form-label small mb-1">Referencia</label>
              <input className="form-control" placeholder="N.º de transferencia o cheque" value={pago.referencia} onChange={(e) => setPago({ ...pago, referencia: e.target.value })} />
            </div>
            <div className="col-12 col-md-auto">
              <button className="btn fw-semibold w-100" style={{ background: ACCENT, color: "#1a2a00" }} onClick={aplicar} disabled={ocupado}>
                <FaCheckDouble className="me-1" /> {ocupado ? "Aplicando…" : `Aplicar ${dinero(total)}`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
