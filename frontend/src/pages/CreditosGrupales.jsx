// Créditos grupales: grupos de socios con cargos, el crédito del grupo (un préstamo por
// integrante, con su propio plan de pagos y mora) y el pago grupal en una sola operación.
// Función nueva: la enciende el Super Administrador en Control de Accesos.
import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { FaUsers, FaPlus, FaEdit, FaTrash, FaArrowLeft, FaMoneyBillWave, FaCheck, FaHandHoldingUsd, FaReceipt } from "react-icons/fa";
import { useAuth } from "../context/AuthContext";
import { useAlerta } from "../context/AlertaContext";
import InputMonto from "../ui/InputMonto";
import ReciboModal from "../components/ReciboModal";
import { dinero } from "../utils/pais";
import { hoyLocal } from "../utils/fechas";
import { useFunciones } from "../hooks/useFunciones";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const AZUL = "#1a2035";
const ACCENT = "#a8cd3a";
const CARGOS = ["presidente", "vicepresidente", "secretario", "tesorero", "vocal", "integrante"];
const ESTADOS = {
  pendiente: ["warning", "Pendiente"],
  aprobado: ["info", "Aprobado"],
  activo: ["success", "Activo"],
  mora: ["danger", "En mora"],
  pagado: ["secondary", "Pagado"],
  rechazado: ["dark", "Rechazado"],
};
const Estado = ({ e }) => {
  const [color, texto] = ESTADOS[e] || ["light", e];
  return <span className={`badge bg-${color}`}>{texto}</span>;
};
const cap = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : "");
const cuotaFrancesa = (monto, tasaMensual, n) => {
  const r = tasaMensual / 100;
  if (!(monto > 0) || !(n > 0)) return 0;
  return r > 0 ? (monto * r) / (1 - Math.pow(1 + r, -n)) : monto / n;
};

const Tarjeta = ({ children }) => (
  <div className="card border-0 shadow-sm mb-3" style={{ borderRadius: 14 }}>
    <div className="card-body">{children}</div>
  </div>
);

export default function CreditosGrupales() {
  const { token } = useAuth();
  const funciones = useFunciones();
  const { mostrarAlerta } = useAlerta();
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const error = (e, msg) => mostrarAlerta(e.response?.data?.message || msg, "error");

  const [grupos, setGrupos] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [grupo, setGrupo] = useState(null); // detalle del grupo abierto
  const [credito, setCredito] = useState(null); // detalle del crédito abierto
  const [editando, setEditando] = useState(null); // formulario de grupo
  const [nuevoCredito, setNuevoCredito] = useState(null); // formulario de crédito
  const [pago, setPago] = useState(null); // formulario de pago grupal
  const [catalogos, setCatalogos] = useState({ lineas: [], promotores: [] });
  const [recibo, setRecibo] = useState(null);
  const [trabajando, setTrabajando] = useState(false);

  const cargarGrupos = useCallback(() => {
    axios
      .get(`${API_URL}/grupos`, { headers, params: busqueda ? { search: busqueda } : {} })
      .then((r) => setGrupos(r.data.data || []))
      .catch((e) => error(e, "No se pudieron cargar los grupos."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headers, busqueda]);
  useEffect(() => {
    cargarGrupos();
  }, [cargarGrupos]);
  useEffect(() => {
    axios
      .get(`${API_URL}/prestamos/catalogos`, { headers })
      .then((r) => setCatalogos({ lineas: r.data.lineas || [], promotores: r.data.promotores || [] }))
      .catch(() => {});
  }, [headers]);

  const abrirGrupo = async (id) => {
    try {
      const r = await axios.get(`${API_URL}/grupos/${id}`, { headers });
      setGrupo(r.data.data);
      setCredito(null);
    } catch (e) {
      error(e, "No se pudo abrir el grupo.");
    }
  };
  const abrirCredito = async (id) => {
    try {
      const r = await axios.get(`${API_URL}/grupos/creditos/${id}`, { headers });
      setCredito(r.data.data);
    } catch (e) {
      error(e, "No se pudo abrir el crédito.");
    }
  };

  // ── Guardar grupo ──
  const guardarGrupo = async () => {
    setTrabajando(true);
    try {
      const cuerpo = {
        nombre: editando.nombre,
        comunidad: editando.comunidad,
        id_promotor: editando.id_promotor || null,
        estado: editando.estado,
        integrantes: editando.integrantes.map((i) => ({ id_usuario: i.id_usuario, cargo: i.cargo })),
      };
      const r = editando.id_grupo
        ? await axios.put(`${API_URL}/grupos/${editando.id_grupo}`, cuerpo, { headers })
        : await axios.post(`${API_URL}/grupos`, cuerpo, { headers });
      mostrarAlerta(r.data.message, "success");
      setEditando(null);
      cargarGrupos();
      abrirGrupo(r.data.id_grupo);
    } catch (e) {
      error(e, "No se pudo guardar el grupo.");
    } finally {
      setTrabajando(false);
    }
  };

  // ── Crear crédito grupal ──
  const guardarCredito = async () => {
    setTrabajando(true);
    try {
      const r = await axios.post(
        `${API_URL}/grupos/${grupo.id_grupo}/creditos`,
        {
          ...nuevoCredito,
          montos: Object.entries(nuevoCredito.montos).map(([id_usuario, monto]) => ({ id_usuario, monto })),
        },
        { headers }
      );
      mostrarAlerta(r.data.message, "success");
      setNuevoCredito(null);
      await abrirGrupo(grupo.id_grupo);
      abrirCredito(r.data.id_credito_grupal);
    } catch (e) {
      error(e, "No se pudo registrar el crédito.");
    } finally {
      setTrabajando(false);
    }
  };

  // ── Aprobar / desembolsar a todos (cada integrante con la lógica de siempre) ──
  const enLote = async (estado, accion, titulo) => {
    const lista = credito.prestamos.filter((p) => p.estado === estado);
    if (!lista.length) return;
    if (!window.confirm(`¿${titulo} ${lista.length} préstamo(s) del grupo?`)) return;
    setTrabajando(true);
    const fallos = [];
    for (const p of lista) {
      try {
        await accion(p);
      } catch (e) {
        fallos.push(`${p.nombre_completo}: ${e.response?.data?.message || "error"}`);
      }
    }
    setTrabajando(false);
    if (fallos.length) mostrarAlerta(`Algunos no se pudieron procesar:\n${fallos.join("\n")}`, "warning");
    else mostrarAlerta(`${titulo}: listo para ${lista.length} integrante(s).`, "success");
    abrirCredito(credito.id_credito_grupal);
  };
  const aprobarTodos = () =>
    enLote("pendiente", (p) => axios.patch(`${API_URL}/prestamos/${p.id_prestamo}/aprobar`, {}, { headers }), "Aprobar");
  const desembolsarTodos = () => {
    const metodo = window.prompt("¿Cómo se entrega el dinero? (efectivo, transferencia, cheque o cuenta)", "efectivo");
    if (!metodo) return;
    enLote("aprobado", (p) => axios.post(`${API_URL}/prestamos/${p.id_prestamo}/desembolsar`, { metodo }, { headers }), "Desembolsar");
  };

  // ── Pago grupal ──
  const abrirPago = async () => {
    const vigentes = credito.prestamos.filter((p) => ["activo", "mora"].includes(p.estado));
    const filas = await Promise.all(
      vigentes.map(async (p) => {
        try {
          const r = await axios.get(`${API_URL}/pagos/prestamo/${p.id_prestamo}/proximo-pago`, { headers });
          const pp = r.data.proximo_pago || {};
          return { ...p, sugerido: pp.total_a_pagar || 0, para_saldar: pp.total_para_saldar || p.saldo_restante, monto: String(pp.total_a_pagar || "") };
        } catch {
          return { ...p, sugerido: 0, para_saldar: p.saldo_restante, monto: "" };
        }
      })
    );
    setPago({ filas, metodo_pago: "efectivo", fecha_pago: hoyLocal(), numero_boleta: "", lugar_pago: "", resultado: null });
  };
  const registrarPago = async () => {
    setTrabajando(true);
    try {
      const r = await axios.post(
        `${API_URL}/grupos/creditos/${credito.id_credito_grupal}/pagar`,
        {
          metodo_pago: pago.metodo_pago,
          fecha_pago: pago.fecha_pago,
          numero_boleta: pago.numero_boleta || undefined,
          lugar_pago: pago.lugar_pago || undefined,
          detalles: pago.filas.map((f) => ({ id_prestamo: f.id_prestamo, monto_pagado: f.monto })),
        },
        { headers }
      );
      mostrarAlerta(r.data.message, "success");
      setPago({ ...pago, resultado: r.data });
      abrirCredito(credito.id_credito_grupal);
    } catch (e) {
      error(e, "No se pudo registrar el pago.");
    } finally {
      setTrabajando(false);
    }
  };

  // ───────────────────────────────── Vistas ─────────────────────────────────
  const encabezado = (
    <div className="d-flex align-items-center gap-3 mb-3 flex-wrap">
      <div className="d-flex align-items-center justify-content-center" style={{ width: 48, height: 48, borderRadius: 12, background: AZUL, color: ACCENT }}>
        <FaUsers size={20} />
      </div>
      <div className="flex-grow-1">
        <h4 className="fw-bold mb-0" style={{ color: AZUL }}>Créditos grupales</h4>
        <div className="text-muted small">Grupos de socios, crédito por integrante y pago grupal</div>
      </div>
      {!grupo && (
        <button className="btn btn-success" onClick={() => setEditando({ nombre: "", comunidad: "", id_promotor: "", estado: "activo", integrantes: [] })}>
          <FaPlus className="me-1" /> Nuevo grupo
        </button>
      )}
    </div>
  );

  return (
    <div className="container-fluid py-3">
      {encabezado}

      {!grupo && (
        <Tarjeta>
          <input className="form-control mb-3" placeholder="Buscar grupo o integrante..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
          {!grupos.length ? (
            <div className="text-center text-muted py-4">Aún no hay grupos. Crea el primero con "Nuevo grupo".</div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr><th>Grupo</th><th>Presidente</th><th className="text-center">Integrantes</th><th>Promotor</th><th className="text-end">Saldo vigente</th><th></th></tr>
                </thead>
                <tbody>
                  {grupos.map((g) => (
                    <tr key={g.id_grupo} style={{ cursor: "pointer" }} onClick={() => abrirGrupo(g.id_grupo)}>
                      <td>
                        <div className="fw-semibold">{g.nombre}</div>
                        <div className="small text-muted">{[g.comunidad, g.sucursal].filter(Boolean).join(" · ")}</div>
                      </td>
                      <td>{g.presidente || "—"}</td>
                      <td className="text-center">{g.integrantes}</td>
                      <td className="small">{g.promotor_nombre || "—"}</td>
                      <td className="text-end">{g.saldo_vigente ? dinero(g.saldo_vigente) : "—"}</td>
                      <td>{g.estado === "inactivo" ? <span className="badge bg-secondary">Inactivo</span> : g.creditos_vigentes > 0 ? <span className="badge bg-success">Con crédito</span> : null}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Tarjeta>
      )}

      {grupo && !credito && (
        <>
          <button className="btn btn-link px-0 mb-2" onClick={() => { setGrupo(null); cargarGrupos(); }}>
            <FaArrowLeft className="me-1" /> Todos los grupos
          </button>
          <Tarjeta>
            <div className="d-flex justify-content-between align-items-start flex-wrap gap-2">
              <div>
                <h5 className="fw-bold mb-0" style={{ color: AZUL }}>{grupo.nombre}</h5>
                <div className="small text-muted">
                  {[grupo.comunidad, grupo.sucursal, grupo.promotor_nombre && `Promotor: ${grupo.promotor_nombre}`].filter(Boolean).join(" · ")}
                </div>
              </div>
              <div className="d-flex gap-2">
                <button className="btn btn-outline-primary btn-sm" onClick={() => setEditando({ ...grupo, id_promotor: grupo.id_promotor || "" })}>
                  <FaEdit className="me-1" /> Editar
                </button>
                {grupo.estado === "activo" && (
                  <button
                    className="btn btn-success btn-sm"
                    onClick={() =>
                      setNuevoCredito({
                        tasa_mensual: "2", plazo_meses: "12", linea_credito: "", destino: "", numero_pagare: "", numero_acta: "", fecha_otorgado: "",
                        montos: Object.fromEntries(grupo.integrantes.map((i) => [i.id_usuario, ""])),
                      })
                    }
                  >
                    <FaPlus className="me-1" /> Nuevo crédito grupal
                  </button>
                )}
              </div>
            </div>
            <div className="table-responsive mt-3">
              <table className="table table-sm align-middle mb-0">
                <thead className="table-light"><tr><th>Integrante</th><th>Cargo</th><th>Identidad</th><th>Teléfono</th></tr></thead>
                <tbody>
                  {grupo.integrantes.map((i) => (
                    <tr key={i.id_usuario}>
                      <td>{i.nombre_completo}</td>
                      <td><span className={`badge ${i.cargo === "presidente" ? "bg-primary" : "bg-light text-dark border"}`}>{cap(i.cargo)}</span></td>
                      <td className="small">{i.dni}</td>
                      <td className="small">{i.telefono || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Tarjeta>
          <Tarjeta>
            <h6 className="fw-bold mb-3" style={{ color: AZUL }}>Créditos del grupo</h6>
            {!grupo.creditos.length ? (
              <div className="text-muted small">Sin créditos todavía.</div>
            ) : (
              <table className="table table-sm table-hover align-middle mb-0">
                <thead className="table-light"><tr><th>#</th><th>Fecha</th><th className="text-end">Monto</th><th>Plazo</th><th className="text-end">Saldo</th><th>Estado</th></tr></thead>
                <tbody>
                  {grupo.creditos.map((c) => (
                    <tr key={c.id_credito_grupal} style={{ cursor: "pointer" }} onClick={() => abrirCredito(c.id_credito_grupal)}>
                      <td>{c.id_credito_grupal}</td>
                      <td className="small">{String(c.creado_en).substring(0, 10)}</td>
                      <td className="text-end">{dinero(c.monto_total)}</td>
                      <td className="small">{c.plazo_meses} meses · {parseFloat(c.tasa_mensual)}% mensual</td>
                      <td className="text-end">{c.saldo ? dinero(c.saldo) : "—"}</td>
                      <td><Estado e={c.estado} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Tarjeta>
        </>
      )}

      {grupo && credito && (
        <>
          <button className="btn btn-link px-0 mb-2" onClick={() => { setCredito(null); abrirGrupo(grupo.id_grupo); }}>
            <FaArrowLeft className="me-1" /> {grupo.nombre}
          </button>
          <Tarjeta>
            <div className="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-3">
              <div>
                <h5 className="fw-bold mb-0" style={{ color: AZUL }}>
                  Crédito grupal #{credito.id_credito_grupal} <Estado e={credito.estado} />
                </h5>
                <div className="small text-muted">
                  {dinero(credito.monto_total)} · {credito.plazo_meses} meses · {parseFloat(credito.tasa_mensual)}% mensual
                  {credito.saldo > 0 && <> · Saldo {dinero(credito.saldo)}</>}
                </div>
              </div>
              <div className="d-flex gap-2 flex-wrap">
                {credito.prestamos.some((p) => p.estado === "pendiente") && (
                  <button className="btn btn-outline-primary btn-sm" disabled={trabajando} onClick={aprobarTodos}>
                    <FaCheck className="me-1" /> Aprobar a todos
                  </button>
                )}
                {credito.prestamos.some((p) => p.estado === "aprobado") && (
                  <button className="btn btn-outline-success btn-sm" disabled={trabajando} onClick={desembolsarTodos}>
                    <FaHandHoldingUsd className="me-1" /> Desembolsar a todos
                  </button>
                )}
                {credito.prestamos.some((p) => ["activo", "mora"].includes(p.estado)) && (
                  <button className="btn btn-success btn-sm" disabled={trabajando} onClick={abrirPago}>
                    <FaMoneyBillWave className="me-1" /> Pago grupal
                  </button>
                )}
              </div>
            </div>
            <div className="table-responsive">
              <table className="table table-sm align-middle mb-0">
                <thead className="table-light">
                  <tr><th>Integrante</th><th>Cargo</th><th>Préstamo</th><th className="text-end">Monto</th><th className="text-end">Pagado</th><th className="text-end">Saldo</th><th>Estado</th></tr>
                </thead>
                <tbody>
                  {credito.prestamos.map((p) => (
                    <tr key={p.id_prestamo}>
                      <td>{p.nombre_completo}</td>
                      <td className="small">{cap(p.cargo)}</td>
                      <td className="small">#{p.id_prestamo}</td>
                      <td className="text-end">{dinero(p.monto)}</td>
                      <td className="text-end">{dinero(p.total_pagado)}</td>
                      <td className="text-end fw-semibold">{dinero(p.saldo_restante)}</td>
                      <td><Estado e={p.estado} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="small text-muted mt-2">
              Cada integrante tiene su propio préstamo, plan de pagos y mora. Su detalle completo está en Préstamos.
            </div>
          </Tarjeta>
        </>
      )}

      {editando && (
        <ModalGrupo
          grupo={editando}
          setGrupo={setEditando}
          promotores={catalogos.promotores}
          headers={headers}
          onGuardar={guardarGrupo}
          onCerrar={() => setEditando(null)}
          trabajando={trabajando}
        />
      )}

      {nuevoCredito && (
        <Modal titulo={`Nuevo crédito grupal · ${grupo.nombre}`} onCerrar={() => setNuevoCredito(null)} ancho="modal-lg"
          pie={<button className="btn btn-success" disabled={trabajando} onClick={guardarCredito}>{trabajando ? "Guardando..." : "Registrar crédito"}</button>}>
          <div className="row g-2 mb-3">
            <div className="col-6 col-md-3">
              <label className="form-label small mb-1">Tasa mensual (%)</label>
              <input type="number" step="0.01" min="0" className="form-control form-control-sm" value={nuevoCredito.tasa_mensual} onChange={(e) => setNuevoCredito({ ...nuevoCredito, tasa_mensual: e.target.value })} />
            </div>
            <div className="col-6 col-md-3">
              <label className="form-label small mb-1">Plazo (meses)</label>
              <input type="number" min="1" className="form-control form-control-sm" value={nuevoCredito.plazo_meses} onChange={(e) => setNuevoCredito({ ...nuevoCredito, plazo_meses: e.target.value })} />
            </div>
            <div className="col-6 col-md-3">
              <label className="form-label small mb-1">Línea</label>
              <select className="form-select form-select-sm" value={nuevoCredito.linea_credito} onChange={(e) => setNuevoCredito({ ...nuevoCredito, linea_credito: e.target.value })}>
                <option value="">—</option>
                {catalogos.lineas.map((l) => <option key={l}>{l}</option>)}
              </select>
            </div>
            <div className="col-6 col-md-3">
              <label className="form-label small mb-1">N.º pagaré / acta</label>
              <div className="d-flex gap-1">
                <input className="form-control form-control-sm" placeholder="Pagaré" value={nuevoCredito.numero_pagare} onChange={(e) => setNuevoCredito({ ...nuevoCredito, numero_pagare: e.target.value })} />
                <input className="form-control form-control-sm" placeholder="Acta" value={nuevoCredito.numero_acta} onChange={(e) => setNuevoCredito({ ...nuevoCredito, numero_acta: e.target.value })} />
              </div>
            </div>
            <div className="col-12">
              <label className="form-label small mb-1">Destino</label>
              <input className="form-control form-control-sm" maxLength={150} value={nuevoCredito.destino} onChange={(e) => setNuevoCredito({ ...nuevoCredito, destino: e.target.value })} />
            </div>
          </div>
          <table className="table table-sm align-middle">
            <thead className="table-light"><tr><th>Integrante</th><th>Cargo</th><th style={{ width: 170 }}>Monto</th><th className="text-end">Cuota aprox.</th></tr></thead>
            <tbody>
              {grupo.integrantes.map((i) => {
                const m = parseFloat(nuevoCredito.montos[i.id_usuario]) || 0;
                return (
                  <tr key={i.id_usuario}>
                    <td>{i.nombre_completo}</td>
                    <td className="small">{cap(i.cargo)}</td>
                    <td>
                      <InputMonto className="form-control form-control-sm" value={nuevoCredito.montos[i.id_usuario]}
                        onChange={(v) => setNuevoCredito({ ...nuevoCredito, montos: { ...nuevoCredito.montos, [i.id_usuario]: v } })} />
                    </td>
                    <td className="text-end small">{m > 0 ? dinero(cuotaFrancesa(m, parseFloat(nuevoCredito.tasa_mensual) || 0, parseInt(nuevoCredito.plazo_meses) || 0)) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="fw-bold">
                <td colSpan={2}>Total del grupo</td>
                <td>{dinero(Object.values(nuevoCredito.montos).reduce((t, v) => t + (parseFloat(v) || 0), 0))}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
          <div className="small text-muted">
            Se crea un préstamo pendiente para cada integrante con monto. Después se aprueban (con el comité si el monto lo exige) y se desembolsan desde el crédito.
          </div>
        </Modal>
      )}

      {pago && (
        <Modal titulo={`Pago grupal · crédito #${credito?.id_credito_grupal}`} onCerrar={() => setPago(null)} ancho="modal-lg"
          pie={!pago.resultado && <button className="btn btn-success" disabled={trabajando} onClick={registrarPago}>{trabajando ? "Registrando..." : `Registrar ${dinero(pago.filas.reduce((t, f) => t + (parseFloat(f.monto) || 0), 0))}`}</button>}>
          {!pago.resultado ? (
            <>
              <div className="row g-2 mb-3">
                <div className="col-6">
                  <label className="form-label small mb-1">Forma de pago</label>
                  <select className="form-select form-select-sm" value={pago.metodo_pago} onChange={(e) => setPago({ ...pago, metodo_pago: e.target.value })}>
                    <option value="efectivo">Efectivo</option>
                    <option value="transferencia">Transferencia</option>
                    <option value="deposito">Depósito</option>
                    <option value="cheque">Cheque</option>
                  </select>
                </div>
                <div className="col-6">
                  <label className="form-label small mb-1">Fecha</label>
                  <input type="date" className="form-control form-control-sm" max={hoyLocal()} value={pago.fecha_pago} onChange={(e) => setPago({ ...pago, fecha_pago: e.target.value })} />
                </div>
                {funciones.pagos_ampliados && (
                  <>
                    <div className="col-6">
                      <label className="form-label small mb-1">N.º de boleta</label>
                      <input className="form-control form-control-sm" maxLength={40} value={pago.numero_boleta} onChange={(e) => setPago({ ...pago, numero_boleta: e.target.value })} />
                    </div>
                    <div className="col-6">
                      <label className="form-label small mb-1">Lugar de pago</label>
                      <input className="form-control form-control-sm" maxLength={80} value={pago.lugar_pago} onChange={(e) => setPago({ ...pago, lugar_pago: e.target.value })} />
                    </div>
                  </>
                )}
              </div>
              <table className="table table-sm align-middle">
                <thead className="table-light"><tr><th>Integrante</th><th className="text-end">Cuota del mes</th><th className="text-end">Para saldar</th><th style={{ width: 170 }}>Paga</th></tr></thead>
                <tbody>
                  {pago.filas.map((f, k) => (
                    <tr key={f.id_prestamo}>
                      <td>{f.nombre_completo} {f.estado === "mora" && <span className="badge bg-danger">mora</span>}</td>
                      <td className="text-end small">{dinero(f.sugerido)}</td>
                      <td className="text-end small">{dinero(f.para_saldar)}</td>
                      <td>
                        <InputMonto className="form-control form-control-sm" value={f.monto}
                          onChange={(v) => setPago({ ...pago, filas: pago.filas.map((x, j) => (j === k ? { ...x, monto: v } : x)) })} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="small text-muted">
                Se registra todo junto: si el pago de un integrante no es válido, no se registra ninguno. Deja en blanco a quien no paga hoy.
              </div>
            </>
          ) : (
            <>
              <div className="alert alert-success py-2">{pago.resultado.message}</div>
              <table className="table table-sm align-middle mb-0">
                <thead className="table-light"><tr><th>Integrante</th><th className="text-end">Pagó</th><th className="text-end">Capital</th><th className="text-end">Interés</th><th className="text-end">Nuevo saldo</th><th></th></tr></thead>
                <tbody>
                  {pago.resultado.detalles.map((d) => (
                    <tr key={d.id_prestamo}>
                      <td>{d.nombre} {d.liquidado && <span className="badge bg-success">cancelado</span>}</td>
                      <td className="text-end">{dinero(d.monto_pagado)}</td>
                      <td className="text-end small">{dinero(d.capital)}</td>
                      <td className="text-end small">{dinero(d.interes)}</td>
                      <td className="text-end fw-semibold">{dinero(d.saldo_nuevo)}</td>
                      <td>{d.id_recibo && <button className="btn btn-sm btn-outline-secondary" onClick={() => setRecibo(d.id_recibo)}><FaReceipt /></button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </Modal>
      )}

      {recibo && <ReciboModal idRecibo={recibo} onClose={() => setRecibo(null)} />}
    </div>
  );
}

function Modal({ titulo, children, pie, onCerrar, ancho = "" }) {
  return (
    <div className="modal d-block" style={{ background: "rgba(0,0,0,.45)" }} onClick={onCerrar}>
      <div className={`modal-dialog modal-dialog-centered modal-dialog-scrollable ${ancho}`} onClick={(e) => e.stopPropagation()}>
        <div className="modal-content" style={{ borderRadius: 14 }}>
          <div className="modal-header">
            <h5 className="modal-title">{titulo}</h5>
            <button className="btn-close" onClick={onCerrar} />
          </div>
          <div className="modal-body">{children}</div>
          <div className="modal-footer">
            <button className="btn btn-light" onClick={onCerrar}>Cerrar</button>
            {pie}
          </div>
        </div>
      </div>
    </div>
  );
}

function ModalGrupo({ grupo, setGrupo, promotores, headers, onGuardar, onCerrar, trabajando }) {
  const [buscar, setBuscar] = useState("");
  const [encontrados, setEncontrados] = useState([]);

  useEffect(() => {
    if (buscar.trim().length < 2) {
      setEncontrados([]);
      return;
    }
    const t = setTimeout(() => {
      axios
        .get(`${API_URL}/usuarios`, { headers, params: { rol: "Socio", estado: "activo", search: buscar.trim(), limit: 8 } })
        .then((r) => setEncontrados(r.data.data || []))
        .catch(() => setEncontrados([]));
    }, 300);
    return () => clearTimeout(t);
  }, [buscar, headers]);

  const agregar = (u) => {
    if (grupo.integrantes.some((i) => i.id_usuario === u.id_usuario)) return;
    const cargo = grupo.integrantes.some((i) => i.cargo === "presidente") ? "integrante" : "presidente";
    setGrupo({ ...grupo, integrantes: [...grupo.integrantes, { id_usuario: u.id_usuario, nombre_completo: u.nombre_completo, dni: u.dni, cargo }] });
    setBuscar("");
  };

  return (
    <Modal titulo={grupo.id_grupo ? "Editar grupo" : "Nuevo grupo"} onCerrar={onCerrar} ancho="modal-lg"
      pie={<button className="btn btn-success" disabled={trabajando || !grupo.nombre?.trim() || grupo.integrantes.length < 2} onClick={onGuardar}>{trabajando ? "Guardando..." : "Guardar grupo"}</button>}>
      <div className="row g-2 mb-3">
        <div className="col-12 col-md-6">
          <label className="form-label small mb-1">Nombre del grupo *</label>
          <input className="form-control" maxLength={100} value={grupo.nombre} onChange={(e) => setGrupo({ ...grupo, nombre: e.target.value })} />
        </div>
        <div className="col-12 col-md-6">
          <label className="form-label small mb-1">Comunidad</label>
          <input className="form-control" maxLength={120} value={grupo.comunidad || ""} onChange={(e) => setGrupo({ ...grupo, comunidad: e.target.value })} />
        </div>
        <div className="col-12 col-md-6">
          <label className="form-label small mb-1">Promotor / asesor</label>
          <select className="form-select" value={grupo.id_promotor || ""} onChange={(e) => setGrupo({ ...grupo, id_promotor: e.target.value })}>
            <option value="">—</option>
            {promotores.map((p) => <option key={p.id_usuario} value={p.id_usuario}>{p.nombre_completo}</option>)}
          </select>
        </div>
        {grupo.id_grupo && (
          <div className="col-12 col-md-6">
            <label className="form-label small mb-1">Estado</label>
            <select className="form-select" value={grupo.estado} onChange={(e) => setGrupo({ ...grupo, estado: e.target.value })}>
              <option value="activo">Activo</option>
              <option value="inactivo">Inactivo</option>
            </select>
          </div>
        )}
      </div>
      <label className="form-label small mb-1 fw-semibold">Integrantes (mínimo 2)</label>
      <div className="position-relative mb-2">
        <input className="form-control" placeholder="Buscar socio por nombre, identidad o número..." value={buscar} onChange={(e) => setBuscar(e.target.value)} />
        {encontrados.length > 0 && (
          <div className="list-group position-absolute w-100 shadow" style={{ zIndex: 10 }}>
            {encontrados.map((u) => (
              <button key={u.id_usuario} type="button" className="list-group-item list-group-item-action small" onClick={() => agregar(u)}>
                {u.nombre_completo} <span className="text-muted">· {u.dni}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <table className="table table-sm align-middle">
        <tbody>
          {grupo.integrantes.map((i, k) => (
            <tr key={i.id_usuario}>
              <td>{i.nombre_completo} <span className="text-muted small">· {i.dni}</span></td>
              <td style={{ width: 180 }}>
                <select className="form-select form-select-sm" value={i.cargo}
                  onChange={(e) => setGrupo({ ...grupo, integrantes: grupo.integrantes.map((x, j) => (j === k ? { ...x, cargo: e.target.value } : x)) })}>
                  {CARGOS.map((c) => <option key={c} value={c}>{cap(c)}</option>)}
                </select>
              </td>
              <td style={{ width: 50 }}>
                <button className="btn btn-sm btn-outline-danger" onClick={() => setGrupo({ ...grupo, integrantes: grupo.integrantes.filter((_, j) => j !== k) })}>
                  <FaTrash />
                </button>
              </td>
            </tr>
          ))}
          {!grupo.integrantes.length && (
            <tr><td className="text-muted small">Busca y agrega a los socios del grupo.</td></tr>
          )}
        </tbody>
      </table>
    </Modal>
  );
}
