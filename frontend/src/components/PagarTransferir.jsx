// App del socio: pagar la cuota desde su cuenta de ahorro, pasar dinero entre sus cuentas y
// bajar su estado de cuenta en PDF. Cada operación se confirma antes de aplicarse.
import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { FaHandHoldingUsd, FaExchangeAlt, FaFilePdf, FaCheckCircle, FaReceipt } from "react-icons/fa";
import { cifra, simboloMoneda } from "../utils/pais";
import { hoyLocal } from "../utils/fechas";
import { bajarArchivo, mensajeBlob } from "./DocumentosCredito";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const VERDE = "#a8cd3a";
const AZUL = "#2c3e50";
const m = (v) => `${simboloMoneda()} ${cifra(v)}`;

const Tarjeta = ({ icono, color, fondo, titulo, children }) => (
  <div className="card border-0 shadow-sm rounded-4 h-100">
    <div className="card-body p-4">
      <div className="d-flex align-items-center gap-2 mb-3">
        <div style={{ background: fondo, borderRadius: ".75rem", padding: ".6rem", color }}>{icono}</div>
        <h6 className="mb-0 fw-bold" style={{ fontSize: "1.05rem", color: AZUL }}>{titulo}</h6>
      </div>
      {children}
    </div>
  </div>
);

export default function PagarTransferir({ token, prestamos, proximas, onListo, onVerRecibo, onAviso }) {
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const [cuentas, setCuentas] = useState([]);
  const vigentes = prestamos.filter((p) => ["activo", "mora"].includes((p.estado || "").toLowerCase()));
  const [pago, setPago] = useState({ id_prestamo: "", id_cuenta: "", monto: "" });
  const [tr, setTr] = useState({ id_cuenta_origen: "", id_cuenta_destino: "", monto: "" });
  const [confirmar, setConfirmar] = useState(null); // { tipo, texto }
  const [ocupado, setOcupado] = useState(false);
  const [hecho, setHecho] = useState(null); // { texto, id_recibo }
  const [periodo, setPeriodo] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 3);
    return { desde: hoyLocal(d), hasta: hoyLocal() };
  });

  const cargar = useCallback(() => {
    axios
      .get(`${API_URL}/app-socio/cuentas`, { headers })
      .then((r) => setCuentas(r.data.data || []))
      .catch(() => setCuentas([]));
  }, [headers]);
  useEffect(() => {
    cargar();
  }, [cargar]);

  const debitables = cuentas.filter((c) => c.puede_debitar);
  const nombre = (c) => `${c.tipo_cuenta} · ${m(c.saldo_actual)}`;

  // Valores iniciales: el primer préstamo con su próxima cuota y la cuenta con más saldo
  useEffect(() => {
    if (!pago.id_prestamo && vigentes.length) {
      const p = vigentes[0];
      const cuota = proximas[p.id_prestamo]?.lista?.[0]?.monto;
      setPago((x) => ({ ...x, id_prestamo: String(p.id_prestamo), monto: cuota ? String(cuota) : "" }));
    }
    if (!pago.id_cuenta && debitables.length) {
      const mayor = [...debitables].sort((a, b) => b.saldo_actual - a.saldo_actual)[0];
      setPago((x) => ({ ...x, id_cuenta: String(mayor.id_cuenta) }));
      setTr((x) => ({ ...x, id_cuenta_origen: x.id_cuenta_origen || String(mayor.id_cuenta) }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vigentes.length, debitables.length, proximas]);

  const elegirPrestamo = (id) => {
    const cuota = proximas[id]?.lista?.[0]?.monto;
    setPago({ ...pago, id_prestamo: id, monto: cuota ? String(cuota) : pago.monto });
  };

  const pedirPago = () => {
    const c = cuentas.find((x) => String(x.id_cuenta) === pago.id_cuenta);
    const monto = parseFloat(pago.monto);
    if (!pago.id_prestamo || !c || !(monto > 0)) return onAviso?.("Elige el préstamo, la cuenta y el monto.", "warning");
    if (monto > c.saldo_actual) return onAviso?.(`No te alcanza: en ${c.tipo_cuenta} tienes ${m(c.saldo_actual)}.`, "warning");
    setConfirmar({ tipo: "pago", texto: `Pagar ${m(monto)} al préstamo #${pago.id_prestamo} desde tu cuenta ${c.tipo_cuenta}.` });
  };

  const pedirTransferencia = () => {
    const o = cuentas.find((x) => String(x.id_cuenta) === tr.id_cuenta_origen);
    const d = cuentas.find((x) => String(x.id_cuenta) === tr.id_cuenta_destino);
    const monto = parseFloat(tr.monto);
    if (!o || !d || !(monto > 0)) return onAviso?.("Elige las dos cuentas y el monto.", "warning");
    if (o.id_cuenta === d.id_cuenta) return onAviso?.("Elige dos cuentas distintas.", "warning");
    if (monto > o.saldo_actual) return onAviso?.(`No te alcanza: en ${o.tipo_cuenta} tienes ${m(o.saldo_actual)}.`, "warning");
    setConfirmar({ tipo: "transferencia", texto: `Pasar ${m(monto)} de ${o.tipo_cuenta} a ${d.tipo_cuenta}.` });
  };

  const aplicar = async () => {
    setOcupado(true);
    try {
      if (confirmar.tipo === "pago") {
        const r = await axios.post(`${API_URL}/app-socio/pagar-cuota`, { ...pago, monto: parseFloat(pago.monto) }, { headers });
        setHecho({ texto: `${r.data.message} Saldo del préstamo: ${m(r.data.saldo_prestamo)}.`, id_recibo: r.data.id_recibo });
      } else {
        const r = await axios.post(`${API_URL}/app-socio/transferir`, { ...tr, monto: parseFloat(tr.monto) }, { headers });
        setHecho({ texto: r.data.message });
        setTr((x) => ({ ...x, monto: "" }));
      }
      setConfirmar(null);
      cargar();
      onListo?.();
    } catch (e) {
      setConfirmar(null);
      onAviso?.(e.response?.data?.message || "No se pudo completar la operación.", "error");
    } finally {
      setOcupado(false);
    }
  };

  const bajarPdf = async () => {
    try {
      await bajarArchivo(`${API_URL}/app-socio/estado-cuenta.pdf?desde=${periodo.desde}&hasta=${periodo.hasta}`, token, `estado_de_cuenta_${periodo.hasta}.pdf`);
    } catch (e) {
      onAviso?.(await mensajeBlob(e, "No se pudo generar el estado de cuenta."), "error");
    }
  };

  return (
    <div className="row g-4">
      {hecho && (
        <div className="col-12">
          <div className="rounded-4 p-3 d-flex align-items-center gap-3 flex-wrap" style={{ background: "#dcfce7", border: "1px solid #86efac", color: "#14532d" }}>
            <FaCheckCircle size={22} />
            <div className="flex-grow-1">{hecho.texto}</div>
            {hecho.id_recibo && (
              <button className="btn btn-sm btn-success" onClick={() => onVerRecibo?.(hecho.id_recibo)}>
                <FaReceipt className="me-1" /> Ver recibo
              </button>
            )}
            <button className="btn btn-sm btn-link text-success" onClick={() => setHecho(null)}>Cerrar</button>
          </div>
        </div>
      )}

      <div className="col-lg-6">
        <Tarjeta icono={<FaHandHoldingUsd size={20} />} color="#1e40af" fondo="#dbeafe" titulo="Pagar mi cuota con mi ahorro">
          {vigentes.length === 0 ? (
            <div className="text-muted small">No tienes préstamos por pagar.</div>
          ) : debitables.length === 0 ? (
            <div className="text-muted small">No tienes una cuenta de ahorro con la que puedas pagar. Tus aportaciones no se usan para pagar.</div>
          ) : (
            <>
              <label className="form-label small fw-semibold mb-1">Préstamo</label>
              <select className="form-select mb-2" value={pago.id_prestamo} onChange={(e) => elegirPrestamo(e.target.value)}>
                {vigentes.map((p) => (
                  <option key={p.id_prestamo} value={p.id_prestamo}>
                    #{p.id_prestamo} · saldo {m(p.saldo_restante)}
                  </option>
                ))}
              </select>
              <label className="form-label small fw-semibold mb-1">Pagar desde</label>
              <select className="form-select mb-2" value={pago.id_cuenta} onChange={(e) => setPago({ ...pago, id_cuenta: e.target.value })}>
                {debitables.map((c) => (
                  <option key={c.id_cuenta} value={c.id_cuenta}>{nombre(c)}</option>
                ))}
              </select>
              <label className="form-label small fw-semibold mb-1">Monto</label>
              <div className="input-group mb-1">
                <span className="input-group-text">{simboloMoneda()}</span>
                <input type="number" min="0" step="0.01" inputMode="decimal" className="form-control" value={pago.monto} onChange={(e) => setPago({ ...pago, monto: e.target.value })} />
              </div>
              <div className="small text-muted mb-3">
                Sugerimos tu próxima cuota. Si tienes mora, se cobra junto con el pago, como en ventanilla.
              </div>
              <button className="btn w-100 fw-semibold" style={{ background: VERDE, color: "#1a2a00" }} onClick={pedirPago}>
                Pagar
              </button>
            </>
          )}
        </Tarjeta>
      </div>

      <div className="col-lg-6">
        <Tarjeta icono={<FaExchangeAlt size={20} />} color="#065f46" fondo="#d1fae5" titulo="Pasar dinero entre mis cuentas">
          {cuentas.length < 2 || debitables.length === 0 ? (
            <div className="text-muted small">Necesitas al menos dos cuentas activas, una de ellas de ahorro.</div>
          ) : (
            <>
              <label className="form-label small fw-semibold mb-1">De</label>
              <select className="form-select mb-2" value={tr.id_cuenta_origen} onChange={(e) => setTr({ ...tr, id_cuenta_origen: e.target.value })}>
                <option value="">Elige la cuenta</option>
                {debitables.map((c) => (
                  <option key={c.id_cuenta} value={c.id_cuenta}>{nombre(c)}</option>
                ))}
              </select>
              <label className="form-label small fw-semibold mb-1">A</label>
              <select className="form-select mb-2" value={tr.id_cuenta_destino} onChange={(e) => setTr({ ...tr, id_cuenta_destino: e.target.value })}>
                <option value="">Elige la cuenta</option>
                {cuentas
                  .filter((c) => c.puede_recibir && String(c.id_cuenta) !== tr.id_cuenta_origen)
                  .map((c) => (
                    <option key={c.id_cuenta} value={c.id_cuenta}>{nombre(c)}</option>
                  ))}
              </select>
              <label className="form-label small fw-semibold mb-1">Monto</label>
              <div className="input-group mb-3">
                <span className="input-group-text">{simboloMoneda()}</span>
                <input type="number" min="0" step="0.01" inputMode="decimal" className="form-control" value={tr.monto} onChange={(e) => setTr({ ...tr, monto: e.target.value })} />
              </div>
              <button className="btn btn-outline-dark w-100 fw-semibold" onClick={pedirTransferencia}>
                Transferir
              </button>
            </>
          )}
        </Tarjeta>
      </div>

      <div className="col-12">
        <Tarjeta icono={<FaFilePdf size={20} />} color="#991b1b" fondo="#fee2e2" titulo="Mi estado de cuenta">
          <div className="row g-2 align-items-end">
            <div className="col-6 col-md-3">
              <label className="form-label small fw-semibold mb-1">Desde</label>
              <input type="date" className="form-control" value={periodo.desde} onChange={(e) => setPeriodo({ ...periodo, desde: e.target.value })} />
            </div>
            <div className="col-6 col-md-3">
              <label className="form-label small fw-semibold mb-1">Hasta</label>
              <input type="date" className="form-control" value={periodo.hasta} max={hoyLocal()} onChange={(e) => setPeriodo({ ...periodo, hasta: e.target.value })} />
            </div>
            <div className="col-12 col-md-auto">
              <button className="btn btn-dark w-100" onClick={bajarPdf}>
                <FaFilePdf className="me-1" /> Descargar PDF
              </button>
            </div>
          </div>
          <div className="small text-muted mt-2">Tus cuentas, préstamos, movimientos y pagos del período.</div>
        </Tarjeta>
      </div>

      {confirmar && (
        <div className="modal d-block" style={{ background: "rgba(0,0,0,.45)" }} onClick={() => !ocupado && setConfirmar(null)}>
          <div className="modal-dialog modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content" style={{ borderRadius: 16, border: `2px solid ${VERDE}` }}>
              <div className="modal-body p-4 text-center">
                <h5 className="fw-bold mb-2" style={{ color: AZUL }}>¿Confirmas la operación?</h5>
                <p className="mb-4">{confirmar.texto}</p>
                <div className="d-flex gap-2 justify-content-center">
                  <button className="btn btn-light" onClick={() => setConfirmar(null)} disabled={ocupado}>Cancelar</button>
                  <button className="btn fw-semibold" style={{ background: VERDE, color: "#1a2a00" }} onClick={aplicar} disabled={ocupado}>
                    {ocupado ? "Aplicando…" : "Sí, confirmar"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
