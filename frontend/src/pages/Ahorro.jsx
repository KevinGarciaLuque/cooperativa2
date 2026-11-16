// Ahorro: productos de ahorro (tasa, saldo mínimo, retiros), intereses del mes sobre el saldo
// promedio diario y depósitos a plazo fijo.
import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { FaPiggyBank, FaPlus, FaEdit } from "react-icons/fa";
import { useAuth } from "../context/AuthContext";
import { useAlerta } from "../context/AlertaContext";
import InputMonto from "../ui/InputMonto";
import ReciboModal from "../components/ReciboModal";
import { cifra, dinero, simboloMoneda } from "../utils/pais";
import { hoyLocal } from "../utils/fechas";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const AZUL = "#1a2035";
const ACCENT = "#a8cd3a";
const CLASES = { aportacion: "Aportaciones (capital social)", ahorro: "Ahorro a la vista", plazo_fijo: "Plazo fijo" };
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const fecha = (v) => (v ? String(v).substring(0, 10) : "");

const Tarjeta = ({ children, className = "" }) => (
  <div className={`card border-0 shadow-sm ${className}`} style={{ borderRadius: 14 }}>
    <div className="card-body">{children}</div>
  </div>
);

export default function Ahorro() {
  const { token, user } = useAuth();
  const { mostrarAlerta } = useAlerta();
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const esSuper = user?.rol === "Super Administrador";
  const [tab, setTab] = useState("productos");
  const [productos, setProductos] = useState([]);
  const error = (e, msg) => mostrarAlerta(e.response?.data?.message || msg, "error");

  const cargarProductos = useCallback(() => {
    axios.get(`${API_URL}/ahorro/productos`, { headers }).then((r) => setProductos(r.data.data || [])).catch((e) => error(e, "No se pudieron cargar los productos."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headers]);
  useEffect(() => {
    cargarProductos();
  }, [cargarProductos]);

  return (
    <div className="container-fluid py-3">
      <div className="d-flex align-items-center gap-3 mb-3">
        <div className="d-flex align-items-center justify-content-center" style={{ width: 48, height: 48, borderRadius: 12, background: AZUL, color: ACCENT }}>
          <FaPiggyBank size={20} />
        </div>
        <div>
          <h4 className="fw-bold mb-0" style={{ color: AZUL }}>Ahorro</h4>
          <div className="text-muted small">Productos de ahorro, intereses del mes y depósitos a plazo fijo</div>
        </div>
      </div>
      <ul className="nav nav-tabs mb-3">
        {[["productos", "Productos"], ["intereses", "Intereses del mes"], ["plazos", "Plazo fijo"]].map(([k, t]) => (
          <li className="nav-item" key={k}>
            <button className={`nav-link ${tab === k ? "active fw-semibold" : ""}`} onClick={() => setTab(k)}>{t}</button>
          </li>
        ))}
      </ul>
      {tab === "productos" && <Productos productos={productos} esSuper={esSuper} headers={headers} recargar={cargarProductos} error={error} mostrarAlerta={mostrarAlerta} />}
      {tab === "intereses" && <Intereses esSuper={esSuper} headers={headers} error={error} mostrarAlerta={mostrarAlerta} />}
      {tab === "plazos" && <Plazos productos={productos.filter((p) => p.clase === "plazo_fijo" && p.activo)} headers={headers} error={error} mostrarAlerta={mostrarAlerta} />}
    </div>
  );
}

// ── Productos ──────────────────────────────────────────────────────────────
const VACIO = { nombre: "", descripcion: "", clase: "ahorro", tasa_anual: "0", saldo_minimo: "0", permite_retiros: true, apertura_automatica: false, monto_min: "0", plazo_min_dias: "30", plazo_max_dias: "365", penalizacion_pct: "50", activo: true };

function Productos({ productos, esSuper, headers, recargar, error, mostrarAlerta }) {
  const [form, setForm] = useState(null);
  const poner = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? (e.target.type === "checkbox" ? e.target.checked : e.target.value) : e }));
  const guardar = async (ev) => {
    ev.preventDefault();
    try {
      if (form.id_producto_ahorro) await axios.put(`${API_URL}/ahorro/productos/${form.id_producto_ahorro}`, form, { headers });
      else await axios.post(`${API_URL}/ahorro/productos`, form, { headers });
      mostrarAlerta("Producto guardado. La tasa nueva aplica desde el mes en curso.", "success");
      setForm(null);
      recargar();
    } catch (e) {
      error(e, "No se pudo guardar el producto.");
    }
  };
  const abrir = (p) =>
    setForm(p ? { ...VACIO, ...p, permite_retiros: Boolean(p.permite_retiros), apertura_automatica: Boolean(p.apertura_automatica), activo: Boolean(p.activo) } : VACIO);

  return (
    <Tarjeta>
      <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
        <p className="small text-muted mb-0">
          Cada cuenta de socio pertenece a un producto. La tasa anual se paga cada mes sobre el saldo promedio diario
          (0% = sin intereses). Las cuentas «automáticas» se abren solas a cada socio nuevo.
        </p>
        {esSuper && <button className="btn btn-sm fw-semibold" style={{ background: ACCENT, color: AZUL }} onClick={() => abrir(null)}><FaPlus className="me-1" />Nuevo producto</button>}
      </div>
      <div className="table-responsive">
        <table className="table table-sm align-middle small">
          <thead className="text-muted"><tr><th>Producto</th><th>Clase</th><th className="text-end">Tasa anual</th><th>Reglas</th><th className="text-end">Cuentas</th><th className="text-end">Saldo</th><th></th></tr></thead>
          <tbody>
            {productos.map((p) => (
              <tr key={p.id_producto_ahorro} style={{ opacity: p.activo ? 1 : 0.5 }}>
                <td className="fw-semibold">{p.nombre}{p.apertura_automatica ? <span className="badge bg-light text-muted ms-1">automática</span> : null}</td>
                <td>{CLASES[p.clase]}</td>
                <td className="text-end">{parseFloat(p.tasa_anual)}%</td>
                <td className="text-muted">
                  {p.clase === "plazo_fijo"
                    ? `${p.plazo_min_dias}–${p.plazo_max_dias} días · mínimo ${dinero(p.monto_min, 0)} · penalización ${parseFloat(p.penalizacion_pct)}%`
                    : `${p.permite_retiros ? "Permite retiros" : "Sin retiros"}${parseFloat(p.saldo_minimo) > 0 ? ` · saldo mínimo ${dinero(p.saldo_minimo)}` : ""}`}
                </td>
                <td className="text-end">{p.clase === "plazo_fijo" ? `${p.plazos_vigentes} vigentes` : p.cuentas}</td>
                <td className="text-end">{p.clase === "plazo_fijo" ? "" : cifra(p.saldo)}</td>
                <td className="text-end">{esSuper && <button className="btn btn-sm btn-outline-dark" onClick={() => abrir(p)}><FaEdit /></button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {form && (
        <form className="border rounded-3 p-3 mt-2" style={{ background: "#f8fafc" }} onSubmit={guardar}>
          <h6 className="fw-bold">{form.id_producto_ahorro ? `Editar ${form.nombre}` : "Nuevo producto de ahorro"}</h6>
          <div className="row g-2">
            <div className="col-12 col-md-4"><label className="form-label small mb-1">Nombre</label><input className="form-control form-control-sm" required value={form.nombre} onChange={poner("nombre")} disabled={Boolean(form.id_producto_ahorro)} /></div>
            <div className="col-12 col-md-4"><label className="form-label small mb-1">Clase</label>
              <select className="form-select form-select-sm" value={form.clase} onChange={poner("clase")} disabled={Boolean(form.id_producto_ahorro)}>
                {form.clase === "aportacion" && <option value="aportacion">{CLASES.aportacion}</option>}
                <option value="ahorro">{CLASES.ahorro}</option><option value="plazo_fijo">{CLASES.plazo_fijo}</option>
              </select></div>
            <div className="col-6 col-md-2"><label className="form-label small mb-1">Tasa anual (%)</label><input type="number" step="0.001" min="0" max="50" className="form-control form-control-sm" value={form.tasa_anual} onChange={poner("tasa_anual")} /></div>
            <div className="col-6 col-md-2 d-flex align-items-end"><div className="form-check form-switch"><input className="form-check-input" type="checkbox" id="pa-act" checked={form.activo} onChange={poner("activo")} /><label className="form-check-label small" htmlFor="pa-act">Activo</label></div></div>
            {form.clase === "plazo_fijo" ? (
              <>
                <div className="col-6 col-md-3"><label className="form-label small mb-1">Monto mínimo ({simboloMoneda()})</label><InputMonto className="form-control form-control-sm" value={form.monto_min} onChange={poner("monto_min")} /></div>
                <div className="col-6 col-md-3"><label className="form-label small mb-1">Plazo mínimo (días)</label><input type="number" min="1" className="form-control form-control-sm" value={form.plazo_min_dias} onChange={poner("plazo_min_dias")} /></div>
                <div className="col-6 col-md-3"><label className="form-label small mb-1">Plazo máximo (días)</label><input type="number" min="1" className="form-control form-control-sm" value={form.plazo_max_dias} onChange={poner("plazo_max_dias")} /></div>
                <div className="col-6 col-md-3"><label className="form-label small mb-1">Penalización por retiro anticipado (% del interés)</label><input type="number" min="0" max="100" className="form-control form-control-sm" value={form.penalizacion_pct} onChange={poner("penalizacion_pct")} /></div>
              </>
            ) : (
              <>
                <div className="col-6 col-md-3"><label className="form-label small mb-1">Saldo mínimo ({simboloMoneda()})</label><InputMonto className="form-control form-control-sm" value={form.saldo_minimo} onChange={poner("saldo_minimo")} /></div>
                <div className="col-6 col-md-3 d-flex align-items-end"><div className="form-check form-switch"><input className="form-check-input" type="checkbox" id="pa-ret" checked={form.permite_retiros} onChange={poner("permite_retiros")} /><label className="form-check-label small" htmlFor="pa-ret">Permite retiros</label></div></div>
                <div className="col-12 col-md-6 d-flex align-items-end"><div className="form-check form-switch"><input className="form-check-input" type="checkbox" id="pa-aut" checked={form.apertura_automatica} onChange={poner("apertura_automatica")} /><label className="form-check-label small" htmlFor="pa-aut">Se abre sola a cada socio nuevo</label></div></div>
              </>
            )}
            <div className="col-12"><label className="form-label small mb-1">Descripción</label><input className="form-control form-control-sm" value={form.descripcion || ""} onChange={poner("descripcion")} /></div>
          </div>
          <div className="d-flex justify-content-end gap-2 mt-2">
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setForm(null)}>Cancelar</button>
            <button className="btn btn-sm btn-dark">Guardar</button>
          </div>
        </form>
      )}
    </Tarjeta>
  );
}

// ── Intereses del mes ──────────────────────────────────────────────────────
function Intereses({ esSuper, headers, error, mostrarAlerta }) {
  const hoy = hoyLocal();
  const [y, m] = hoy.split("-").map(Number);
  const [periodo, setPeriodo] = useState({ anio: m === 1 ? y - 1 : y, mes: m === 1 ? 12 : m - 1 });
  const [previa, setPrevia] = useState(null);
  const [historial, setHistorial] = useState([]);
  const [liquidando, setLiquidando] = useState(false);

  const cargar = useCallback(() => {
    setPrevia(null);
    axios.get(`${API_URL}/ahorro/intereses/previa`, { headers, params: periodo }).then((r) => setPrevia(r.data)).catch((e) => error(e, "No se pudo calcular."));
    axios.get(`${API_URL}/ahorro/intereses/historial`, { headers }).then((r) => setHistorial(r.data.data || []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodo, headers]);
  useEffect(() => { cargar(); }, [cargar]);

  const mesEnCurso = periodo.anio === y && periodo.mes === m;
  const liquidar = async () => {
    if (!window.confirm(`¿Acreditar los intereses de ${MESES[periodo.mes - 1]} ${periodo.anio}?`)) return;
    setLiquidando(true);
    try {
      const r = await axios.post(`${API_URL}/ahorro/intereses/liquidar`, periodo, { headers });
      mostrarAlerta(r.data.message, "success");
      cargar();
    } catch (e) {
      error(e, "No se pudieron acreditar.");
    } finally {
      setLiquidando(false);
    }
  };

  return (
    <>
      <Tarjeta className="mb-3">
        <p className="small text-muted">
          Cada noche se guarda el saldo de cada cuenta. El interés del mes es: saldo promedio diario × tasa anual × días del
          mes ÷ 365, menos la retención configurada en Parámetros. Se acredita solo el día 1 de cada mes; aquí se puede
          revisar y acreditar a mano. Cada cuenta recibe el interés de un mes una sola vez.
        </p>
        <div className="d-flex flex-wrap align-items-end gap-2 mb-3">
          <div><label className="form-label small mb-1">Mes</label>
            <select className="form-select form-select-sm" value={periodo.mes} onChange={(e) => setPeriodo({ ...periodo, mes: parseInt(e.target.value) })}>{MESES.map((n, i) => <option key={n} value={i + 1}>{n}</option>)}</select></div>
          <div><label className="form-label small mb-1">Año</label><input type="number" className="form-control form-control-sm" style={{ width: 100 }} value={periodo.anio} onChange={(e) => setPeriodo({ ...periodo, anio: parseInt(e.target.value) })} /></div>
          {esSuper && <button className="btn btn-sm fw-semibold" style={{ background: ACCENT, color: AZUL }} disabled={liquidando || mesEnCurso || !previa?.total_neto} onClick={liquidar}>{liquidando && <span className="spinner-border spinner-border-sm me-1" />}Acreditar intereses</button>}
          {mesEnCurso && <span className="small text-muted">El mes en curso se acredita cuando termine.</span>}
        </div>
        {!previa ? <div className="spinner-border spinner-border-sm text-success" /> : previa.data.length === 0 ? (
          <div className="small text-muted">Ninguna cuenta gana intereses: configura la tasa anual en los productos de ahorro.</div>
        ) : (
          <div className="table-responsive">
            <table className="table table-sm small align-middle">
              <thead className="text-muted"><tr><th>Socio</th><th>Cuenta</th><th className="text-end">Saldo promedio</th><th className="text-end">Tasa</th><th className="text-end">Interés</th><th className="text-end">Retención</th><th className="text-end">Neto</th><th></th></tr></thead>
              <tbody>
                {previa.data.map((f) => (
                  <tr key={f.id_cuenta} style={{ opacity: f.ya_acreditado ? 0.55 : 1 }}>
                    <td>{f.socio}</td><td>{f.tipo_cuenta}</td><td className="text-end">{cifra(f.saldo_promedio)}</td><td className="text-end">{f.tasa_anual}%</td>
                    <td className="text-end">{cifra(f.interes_bruto)}</td><td className="text-end">{cifra(f.retencion)}</td><td className="text-end fw-semibold">{cifra(f.interes_neto)}</td>
                    <td>{f.ya_acreditado ? <span className="badge bg-success">acreditado</span> : f.dias_con_foto < f.dias ? <span className="badge bg-light text-muted" title="Días sin foto toman el último saldo conocido">{f.dias_con_foto}/{f.dias} días</span> : null}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr className="fw-bold"><td colSpan={6}>Pendiente de acreditar</td><td className="text-end">{dinero(previa.total_neto)}</td><td></td></tr></tfoot>
            </table>
          </div>
        )}
      </Tarjeta>
      {historial.length > 0 && (
        <Tarjeta>
          <h6 className="fw-bold">Meses acreditados</h6>
          <table className="table table-sm small mb-0">
            <thead className="text-muted"><tr><th>Mes</th><th className="text-end">Cuentas</th><th className="text-end">Interés</th><th className="text-end">Retención</th><th className="text-end">Neto</th><th>Acreditado</th></tr></thead>
            <tbody>{historial.map((h) => <tr key={`${h.anio}-${h.mes}`}><td>{MESES[h.mes - 1]} {h.anio}</td><td className="text-end">{h.cuentas}</td><td className="text-end">{cifra(h.bruto)}</td><td className="text-end">{cifra(h.retencion)}</td><td className="text-end">{cifra(h.neto)}</td><td>{fecha(h.acreditado_en)}</td></tr>)}</tbody>
          </table>
        </Tarjeta>
      )}
    </>
  );
}

// ── Plazo fijo ─────────────────────────────────────────────────────────────
function Plazos({ productos, headers, error, mostrarAlerta }) {
  const [lista, setLista] = useState(null);
  const [socios, setSocios] = useState([]);
  const [cuentasSocio, setCuentasSocio] = useState([]);
  const [form, setForm] = useState(null);
  const [pago, setPago] = useState(null); // { deposito, destino, id_cuenta }
  const [recibo, setRecibo] = useState(null);

  const cargar = useCallback(() => {
    axios.get(`${API_URL}/ahorro/plazos`, { headers }).then((r) => setLista(r.data.data || [])).catch((e) => error(e, "No se pudieron cargar."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headers]);
  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => {
    axios.get(`${API_URL}/usuarios`, { headers, params: { rol: "Socio", estado: "activo", limit: 2000, orden: "nombre" } }).then((r) => setSocios(r.data.data || [])).catch(() => {});
  }, [headers]);
  const idSocio = form?.id_usuario || pago?.deposito?.id_usuario;
  useEffect(() => {
    if (!idSocio) return;
    axios.get(`${API_URL}/cuentas/usuario/${idSocio}`, { headers }).then((r) => setCuentasSocio((r.data.data || r.data || []).filter((c) => c.estado === "activa"))).catch(() => setCuentasSocio([]));
  }, [idSocio, headers]);

  const prod = productos.find((p) => String(p.id_producto_ahorro) === String(form?.id_producto_ahorro));
  const abrir = async (e) => {
    e.preventDefault();
    try {
      const r = await axios.post(`${API_URL}/ahorro/plazos`, form, { headers });
      mostrarAlerta(`Depósito registrado. Vence el ${r.data.fecha_vencimiento}.`, "success");
      setForm(null);
      setRecibo(r.data.id_recibo);
      cargar();
    } catch (x) {
      error(x, "No se pudo registrar el depósito.");
    }
  };
  const pagar = async () => {
    const d = pago.deposito;
    const l = d.liquidacion_hoy;
    if (l.anticipado && !window.confirm(`El depósito vence el ${fecha(d.fecha_vencimiento)}. Si se cancela hoy se pagan ${dinero(l.interes)} de interés (penalización de ${dinero(l.penalizacion)}). ¿Continuar?`)) return;
    try {
      const r = await axios.post(`${API_URL}/ahorro/plazos/${d.id_deposito}/pagar`, { destino: pago.destino, id_cuenta: pago.id_cuenta, confirmar_anticipado: l.anticipado }, { headers });
      mostrarAlerta(`Pagado: ${dinero(r.data.total)}.`, "success");
      setPago(null);
      setRecibo(r.data.id_recibo);
      cargar();
    } catch (x) {
      error(x, "No se pudo pagar.");
    }
  };

  return (
    <Tarjeta>
      {recibo && <ReciboModal idRecibo={recibo} onClose={() => setRecibo(null)} />}
      <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
        <p className="small text-muted mb-0">Interés simple, base 365, que se paga con el capital al vencer. Si se retira antes, se paga el interés de los días transcurridos menos la penalización del producto.</p>
        {!form && <button className="btn btn-sm fw-semibold" style={{ background: ACCENT, color: AZUL }} disabled={!productos.length} title={productos.length ? "" : "Primero crea un producto de clase plazo fijo"} onClick={() => setForm({ id_usuario: "", id_producto_ahorro: productos[0]?.id_producto_ahorro || "", monto: "", plazo_dias: productos[0]?.plazo_min_dias || "", origen: "efectivo" })}><FaPlus className="me-1" />Nuevo depósito</button>}
      </div>

      {form && (
        <form className="border rounded-3 p-3 mb-3" style={{ background: "#f8fafc" }} onSubmit={abrir}>
          <div className="row g-2">
            <div className="col-12 col-md-4"><label className="form-label small mb-1">Socio</label>
              <select className="form-select form-select-sm" required value={form.id_usuario} onChange={(e) => setForm({ ...form, id_usuario: e.target.value, id_cuenta: "" })}><option value="">Elige...</option>{socios.map((s) => <option key={s.id_usuario} value={s.id_usuario}>{s.nombre_completo}</option>)}</select></div>
            <div className="col-12 col-md-4"><label className="form-label small mb-1">Producto</label>
              <select className="form-select form-select-sm" value={form.id_producto_ahorro} onChange={(e) => setForm({ ...form, id_producto_ahorro: e.target.value })}>{productos.map((p) => <option key={p.id_producto_ahorro} value={p.id_producto_ahorro}>{p.nombre} ({parseFloat(p.tasa_anual)}%)</option>)}</select></div>
            <div className="col-6 col-md-2"><label className="form-label small mb-1">Monto ({simboloMoneda()})</label><InputMonto className="form-control form-control-sm" required value={form.monto} onChange={(v) => setForm({ ...form, monto: v })} /></div>
            <div className="col-6 col-md-2"><label className="form-label small mb-1">Plazo (días)</label><input type="number" required className="form-control form-control-sm" min={prod?.plazo_min_dias} max={prod?.plazo_max_dias} value={form.plazo_dias} onChange={(e) => setForm({ ...form, plazo_dias: e.target.value })} /></div>
            <div className="col-12 col-md-4"><label className="form-label small mb-1">¿De dónde sale el dinero?</label>
              <select className="form-select form-select-sm" value={form.origen} onChange={(e) => setForm({ ...form, origen: e.target.value })}><option value="efectivo">Efectivo</option><option value="transferencia">Transferencia</option><option value="deposito">Depósito bancario</option><option value="cheque">Cheque</option><option value="cuenta">De una cuenta del socio</option></select></div>
            {form.origen === "cuenta" && (
              <div className="col-12 col-md-4"><label className="form-label small mb-1">Cuenta</label>
                <select className="form-select form-select-sm" required value={form.id_cuenta || ""} onChange={(e) => setForm({ ...form, id_cuenta: e.target.value })}><option value="">Elige...</option>{cuentasSocio.map((c) => <option key={c.id_cuenta} value={c.id_cuenta}>{c.tipo_cuenta} · {dinero(c.saldo_actual)}</option>)}</select></div>
            )}
            {prod && parseFloat(form.monto) > 0 && parseInt(form.plazo_dias) > 0 && (
              <div className="col-12 small text-muted">Al vencer recibirá aproximadamente {dinero(parseFloat(form.monto) * (1 + (parseFloat(prod.tasa_anual) / 100) * parseInt(form.plazo_dias) / 365))} (antes de retenciones).</div>
            )}
          </div>
          <div className="d-flex justify-content-end gap-2 mt-2"><button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setForm(null)}>Cancelar</button><button className="btn btn-sm btn-dark">Registrar depósito</button></div>
        </form>
      )}

      {pago && (
        <div className="border rounded-3 p-3 mb-3" style={{ background: "#f8fafc" }}>
          <h6 className="fw-bold">Pagar el depósito #{pago.deposito.id_deposito} de {pago.deposito.socio}</h6>
          <div className="small mb-2">
            Capital {dinero(pago.deposito.liquidacion_hoy.capital)} + interés {dinero(pago.deposito.liquidacion_hoy.interes)}
            {pago.deposito.liquidacion_hoy.retencion > 0 && <> − retención {dinero(pago.deposito.liquidacion_hoy.retencion)}</>} = <strong>{dinero(pago.deposito.liquidacion_hoy.total)}</strong>
            {pago.deposito.liquidacion_hoy.anticipado && <span className="text-danger"> · cancelación anticipada (penalización {dinero(pago.deposito.liquidacion_hoy.penalizacion)})</span>}
          </div>
          <div className="d-flex flex-wrap gap-2 align-items-end">
            <div><label className="form-label small mb-1">¿Cómo se entrega?</label>
              <select className="form-select form-select-sm" value={pago.destino} onChange={(e) => setPago({ ...pago, destino: e.target.value })}><option value="efectivo">Efectivo</option><option value="transferencia">Transferencia</option><option value="cheque">Cheque</option><option value="cuenta">A una cuenta del socio</option></select></div>
            {pago.destino === "cuenta" && <div><label className="form-label small mb-1">Cuenta</label><select className="form-select form-select-sm" value={pago.id_cuenta || ""} onChange={(e) => setPago({ ...pago, id_cuenta: e.target.value })}><option value="">Elige...</option>{cuentasSocio.map((c) => <option key={c.id_cuenta} value={c.id_cuenta}>{c.tipo_cuenta}</option>)}</select></div>}
            <button className="btn btn-sm btn-outline-secondary" onClick={() => setPago(null)}>Cancelar</button>
            <button className="btn btn-sm btn-dark" disabled={pago.destino === "cuenta" && !pago.id_cuenta} onClick={pagar}>Pagar</button>
          </div>
        </div>
      )}

      {!lista ? <div className="spinner-border spinner-border-sm text-success" /> : lista.length === 0 ? <div className="small text-muted">Aún no hay depósitos a plazo.</div> : (
        <div className="table-responsive">
          <table className="table table-sm small align-middle">
            <thead className="text-muted"><tr><th>#</th><th>Socio</th><th>Producto</th><th className="text-end">Monto</th><th className="text-end">Tasa</th><th>Vence</th><th className="text-end">Interés</th><th>Estado</th><th></th></tr></thead>
            <tbody>
              {lista.map((d) => (
                <tr key={d.id_deposito}>
                  <td>{d.id_deposito}</td><td>{d.socio}</td><td>{d.producto}</td><td className="text-end">{cifra(d.monto)}</td><td className="text-end">{parseFloat(d.tasa_anual)}%</td><td>{fecha(d.fecha_vencimiento)}</td>
                  <td className="text-end">{d.estado === "vigente" ? <span className="text-muted">{cifra(d.liquidacion_hoy.interes)} hoy</span> : cifra(d.interes_pagado)}</td>
                  <td>{d.estado === "vigente" ? (fecha(d.fecha_vencimiento) <= hoyLocal() ? <span className="badge bg-warning text-dark">vencido</span> : <span className="badge bg-success">vigente</span>) : <span className="badge bg-secondary">{d.estado}</span>}</td>
                  <td className="text-end">{d.estado === "vigente" && <button className="btn btn-sm btn-outline-dark" onClick={() => setPago({ deposito: d, destino: "efectivo" })}>Pagar</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Tarjeta>
  );
}
