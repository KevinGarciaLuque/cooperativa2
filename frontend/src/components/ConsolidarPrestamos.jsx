import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import InputMonto from "../ui/InputMonto";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const ACCENT = "#a8cd3a";

const fmt = (n) =>
  `L. ${parseFloat(n || 0).toLocaleString("es-HN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Asistente para juntar varios préstamos vigentes de un socio en uno solo.
// El interés acumulado (y la mora, salvo que se omita) se suma al capital del préstamo nuevo.
export default function ConsolidarPrestamos({ socio, prestamos, headers, onClose, onListo }) {
  const [elegidos, setElegidos] = useState(() => prestamos.map((p) => p.id_prestamo));
  const [tasa, setTasa] = useState(() => {
    const t = parseFloat(prestamos[0]?.tasa_original ?? prestamos[0]?.tasa_interes / 12);
    return Number.isFinite(t) ? String(parseFloat(t.toFixed(2))) : "";
  });
  const [plazo, setPlazo] = useState("");
  const [adicional, setAdicional] = useState("");
  const [metodo, setMetodo] = useState("efectivo");
  const [omitirMora, setOmitirMora] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [sim, setSim] = useState(null);
  const [errorSim, setErrorSim] = useState("");
  const [calculando, setCalculando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const listo = elegidos.length >= 2 && parseFloat(tasa) >= 0 && tasa !== "" && parseInt(plazo) > 0;

  // Vista previa: se recalcula al cambiar cualquier condición
  useEffect(() => {
    if (!listo) {
      setSim(null);
      setErrorSim(elegidos.length < 2 ? "Elige al menos 2 préstamos." : "");
      return;
    }
    let activo = true;
    setCalculando(true);
    const t = setTimeout(async () => {
      try {
        const r = await axios.get(`${API_URL}/consolidaciones/simular`, {
          headers,
          params: {
            id_usuario: socio.id_usuario,
            ids: elegidos.join(","),
            tasa_mensual: tasa,
            plazo_meses: plazo,
            adicional: adicional || 0,
            omitir_mora: omitirMora ? 1 : 0,
          },
        });
        if (!activo) return;
        setSim(r.data.data);
        setErrorSim("");
      } catch (e) {
        if (!activo) return;
        setSim(null);
        setErrorSim(e.response?.data?.message || "No se pudo calcular.");
      } finally {
        if (activo) setCalculando(false);
      }
    }, 350);
    return () => {
      activo = false;
      clearTimeout(t);
    };
  }, [elegidos, tasa, plazo, adicional, omitirMora, listo, headers, socio.id_usuario]);

  const alternar = (id) =>
    setElegidos((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]));

  const confirmar = async () => {
    setError("");
    if (motivo.trim().length < 5) {
      setError("Escribe el motivo de la consolidación (mínimo 5 caracteres).");
      return;
    }
    if (
      !window.confirm(
        `¿Consolidar ${elegidos.length} préstamos de ${socio.nombre_completo} en uno nuevo de ${fmt(sim.monto_nuevo)}? Los anteriores quedarán cerrados como "consolidados".`
      )
    )
      return;
    setGuardando(true);
    try {
      const r = await axios.post(
        `${API_URL}/consolidaciones`,
        {
          id_usuario: socio.id_usuario,
          ids: elegidos,
          tasa_mensual: parseFloat(tasa),
          plazo_meses: parseInt(plazo),
          adicional: adicional || 0,
          metodo_adicional: metodo,
          omitir_mora: omitirMora,
          motivo: motivo.trim(),
        },
        { headers }
      );
      onListo(r.data);
    } catch (e) {
      setError(e.response?.data?.message || "No se pudo consolidar.");
    } finally {
      setGuardando(false);
    }
  };

  const mejora = useMemo(() => (sim ? sim.cuotas_actuales - sim.cuota_nueva : 0), [sim]);

  return (
    <div
      className="modal show d-block"
      style={{ background: "rgba(0,0,0,.6)", zIndex: 5500, position: "fixed", inset: 0, overflowY: "auto" }}
    >
      <div className="modal-dialog modal-dialog-centered modal-lg">
        <div className="modal-content border-0 shadow-lg" style={{ borderRadius: 16 }}>
          <div className="modal-header border-0 pb-0">
            <div>
              <h5 className="modal-title fw-bold">Consolidar préstamos</h5>
              <div className="small text-muted">{socio.nombre_completo}</div>
            </div>
            <button type="button" className="btn-close" onClick={onClose} />
          </div>

          <div className="modal-body" style={{ maxHeight: "72vh", overflowY: "auto" }}>
            {/* 1. Qué se consolida */}
            <div className="fw-bold mb-2">1. Préstamos a juntar</div>
            <div className="table-responsive mb-3">
              <table className="table table-sm align-middle mb-0">
                <thead>
                  <tr className="small text-muted">
                    <th></th>
                    <th>Préstamo</th>
                    <th className="text-end">Capital</th>
                    <th className="text-end">Interés acumulado</th>
                    <th className="text-end">Mora</th>
                    <th className="text-end">Cuota actual</th>
                  </tr>
                </thead>
                <tbody>
                  {prestamos.map((p) => {
                    const fila = sim?.prestamos.find((x) => x.id_prestamo === p.id_prestamo);
                    return (
                      <tr key={p.id_prestamo}>
                        <td>
                          <input
                            type="checkbox"
                            className="form-check-input"
                            checked={elegidos.includes(p.id_prestamo)}
                            onChange={() => alternar(p.id_prestamo)}
                          />
                        </td>
                        <td>
                          #{p.id_prestamo}
                          <div className="small text-muted">
                            {fmt(p.monto)} · {parseInt(p.plazo_meses) === 0 ? "indefinido" : `${p.plazo_meses} m`}
                          </div>
                        </td>
                        <td className="text-end">{fmt(p.saldo_restante)}</td>
                        <td className="text-end">{fila ? fmt(fila.interes) : "—"}</td>
                        <td className="text-end" style={{ color: fila?.mora > 0 ? "#b91c1c" : "inherit" }}>
                          {fila ? fmt(fila.mora) : "—"}
                        </td>
                        <td className="text-end">{fila ? fmt(fila.cuota_actual) : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* 2. Condiciones nuevas */}
            <div className="fw-bold mb-2">2. Condiciones del préstamo nuevo</div>
            <div className="row g-2 mb-2">
              <div className="col-6 col-md-3">
                <label className="form-label small fw-semibold">Tasa mensual (%)</label>
                <input
                  type="number" min="0" max="30" step="0.01" className="form-control"
                  value={tasa} onChange={(e) => setTasa(e.target.value)}
                />
              </div>
              <div className="col-6 col-md-3">
                <label className="form-label small fw-semibold">Plazo (meses)</label>
                <input
                  type="number" min="1" max="360" className="form-control"
                  value={plazo} onChange={(e) => setPlazo(e.target.value)} placeholder="Ej: 12"
                />
              </div>
              <div className="col-6 col-md-3">
                <label className="form-label small fw-semibold">Dinero adicional (L.)</label>
                <InputMonto className="form-control" placeholder="0.00" value={adicional} onChange={setAdicional} />
              </div>
              <div className="col-6 col-md-3">
                <label className="form-label small fw-semibold">Se entrega en</label>
                <select
                  className="form-select" value={metodo} onChange={(e) => setMetodo(e.target.value)}
                  disabled={!(parseFloat(adicional) > 0)}
                >
                  <option value="efectivo">Efectivo</option>
                  <option value="transferencia">Transferencia</option>
                  <option value="cheque">Cheque</option>
                </select>
              </div>
            </div>
            <div className="form-check mb-3">
              <input
                id="omitir-mora" type="checkbox" className="form-check-input"
                checked={omitirMora} onChange={(e) => setOmitirMora(e.target.checked)}
              />
              <label htmlFor="omitir-mora" className="form-check-label small">
                Omitir la mora acumulada (no se suma al préstamo nuevo)
              </label>
            </div>

            {/* 3. Resultado */}
            <div className="fw-bold mb-2">3. Resultado</div>
            {errorSim && !sim && <div className="alert alert-warning py-2 small">{errorSim}</div>}
            {sim && (
              <div
                className="p-3 mb-3"
                style={{ background: "#f0f7e6", border: "1px solid #cfe5a0", borderRadius: 12, opacity: calculando ? 0.6 : 1 }}
              >
                <div className="row g-2 text-center mb-2">
                  <div className="col-6 col-md-3">
                    <div className="small text-muted">Capital</div>
                    <div className="fw-bold">{fmt(sim.capital)}</div>
                  </div>
                  <div className="col-6 col-md-3">
                    <div className="small text-muted">+ Interés capitalizado</div>
                    <div className="fw-bold">{fmt(sim.interes_capitalizado)}</div>
                  </div>
                  <div className="col-6 col-md-3">
                    <div className="small text-muted">+ Mora{sim.mora_condonada > 0 ? " (omitida)" : ""}</div>
                    <div className="fw-bold">{sim.mora_condonada > 0 ? <s>{fmt(sim.mora_condonada)}</s> : fmt(sim.mora_capitalizada)}</div>
                  </div>
                  <div className="col-6 col-md-3">
                    <div className="small text-muted">+ Dinero adicional</div>
                    <div className="fw-bold">{fmt(sim.adicional)}</div>
                  </div>
                </div>
                <hr className="my-2" />
                <div className="row g-2 text-center">
                  <div className="col-6 col-md-4">
                    <div className="small text-muted">Monto del préstamo nuevo</div>
                    <div className="fw-bold fs-5">{fmt(sim.monto_nuevo)}</div>
                  </div>
                  <div className="col-6 col-md-4">
                    <div className="small text-muted">Cuota mensual nueva</div>
                    <div className="fw-bold fs-5">{fmt(sim.cuota_nueva)}</div>
                  </div>
                  <div className="col-12 col-md-4">
                    <div className="small text-muted">Hoy paga (suma de cuotas)</div>
                    <div className="fw-bold fs-5">{fmt(sim.cuotas_actuales)}</div>
                    <div className="small" style={{ color: mejora >= 0 ? "#047857" : "#b45309" }}>
                      {mejora >= 0 ? `Ahorra ${fmt(mejora)} al mes` : `Paga ${fmt(-mejora)} más al mes`}
                    </div>
                  </div>
                </div>
                <div className="small text-muted text-center mt-2">
                  Total a pagar en {sim.plazo_meses} meses: {fmt(sim.total_a_pagar)} · primer vencimiento {sim.primer_vencimiento}
                </div>
              </div>
            )}

            {/* 4. Motivo */}
            <label className="form-label small fw-semibold">Motivo de la consolidación *</label>
            <input
              className="form-control" maxLength={255} value={motivo} onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ej: el socio pidió una sola cuota más baja"
            />
            {error && <div className="alert alert-danger py-2 mt-2 mb-0">{error}</div>}
            <div className="small text-muted mt-2">
              Los préstamos anteriores quedan como "consolidados" con su historial intacto. El préstamo nuevo nace activo y se
              genera un convenio para firmar.
            </div>
          </div>

          <div className="modal-footer border-0 pt-0">
            <button className="btn btn-outline-secondary" onClick={onClose} disabled={guardando}>
              Cancelar
            </button>
            <button
              className="btn fw-semibold"
              style={{ background: ACCENT, color: "#1a2a00" }}
              onClick={confirmar}
              disabled={!sim || guardando || calculando}
            >
              {guardando ? "Consolidando..." : "Consolidar préstamos"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
