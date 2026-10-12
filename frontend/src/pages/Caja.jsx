import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { useAlerta } from "../context/AlertaContext";
import {
  FaCashRegister,
  FaChevronLeft,
  FaChevronRight,
  FaArrowDown,
  FaArrowUp,
  FaLock,
  FaCheckCircle,
} from "react-icons/fa";

const ACCENT = "#a8cd3a";
const AZUL = "#1a2035";
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const CATEGORIAS = {
  pago_prestamo: "Pago de préstamo",
  aportacion: "Aportación",
  desembolso_prestamo: "Desembolso de préstamo",
  anulacion_pago: "Anulación de pago",
  anulacion_aportacion: "Eliminación de aportación",
  anulacion_desembolso: "Reversión de desembolso",
  ajuste_pago: "Ajuste de pago",
  ajuste_aportacion: "Ajuste de aportación",
};

const METODOS = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  cheque: "Cheque",
  deposito: "Depósito",
};

const fmt = (n) =>
  `L. ${parseFloat(n || 0).toLocaleString("es-HN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const hoyISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const moverDia = (iso, delta) => {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d + delta);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
};

const hora = (f) => {
  const d = new Date(f);
  return isNaN(d) ? "" : d.toLocaleTimeString("es-HN", { hour: "2-digit", minute: "2-digit" });
};

export default function Caja() {
  const { token } = useAuth();
  const { mostrarAlerta } = useAlerta();
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const [fecha, setFecha] = useState(hoyISO());
  const [data, setData] = useState(null);
  const [cierres, setCierres] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [contado, setContado] = useState("");
  const [observacion, setObservacion] = useState("");
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [res, cie] = await Promise.all([
        axios.get(`${API_URL}/caja/resumen`, { headers, params: { fecha } }),
        axios.get(`${API_URL}/caja/cierres`, { headers, params: { limit: 10 } }),
      ]);
      setData(res.data);
      setCierres(cie.data.data || []);
    } catch {
      mostrarAlerta("No se pudo cargar la información de caja.", "error");
    } finally {
      setCargando(false);
    }
    // eslint-disable-next-line
  }, [fecha, headers]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const diferencia = useMemo(() => {
    if (!data || contado === "") return null;
    return parseFloat((parseFloat(contado) - data.efectivo.efectivo_esperado).toFixed(2));
  }, [data, contado]);

  const cerrarCaja = async (e) => {
    e.preventDefault();
    if (!window.confirm(`¿Cerrar la caja del ${fecha}? Esta acción queda registrada.`)) return;
    setGuardando(true);
    try {
      await axios.post(
        `${API_URL}/caja/cierre`,
        { fecha, efectivo_contado: parseFloat(contado), observacion },
        { headers }
      );
      mostrarAlerta("Caja cerrada correctamente.", "success");
      setContado("");
      setObservacion("");
      cargar();
    } catch (err) {
      mostrarAlerta(err.response?.data?.message || "No se pudo cerrar la caja.", "error");
    } finally {
      setGuardando(false);
    }
  };

  const kpi = (titulo, valor, color, icono) => (
    <div className="col-6 col-lg-3">
      <div className="h-100 p-3" style={{ background: "#fff", borderRadius: "1rem", boxShadow: "0 2px 12px #0000000f" }}>
        <div className="small text-muted fw-semibold">{icono} {titulo}</div>
        <div className="fw-bold fs-4" style={{ color }}>{valor}</div>
      </div>
    </div>
  );

  const esHoy = fecha === hoyISO();

  return (
    <div className="container-fluid py-3">
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-3">
        <div>
          <h3 className="fw-bold mb-0" style={{ color: AZUL }}>
            <FaCashRegister className="me-2" />
            Caja
          </h3>
          <span className="text-muted">Ingresos, egresos y cierre diario del efectivo.</span>
        </div>
        <div className="d-flex align-items-center gap-2">
          <button className="btn btn-outline-secondary btn-sm" onClick={() => setFecha(moverDia(fecha, -1))}>
            <FaChevronLeft />
          </button>
          <input
            type="date"
            className="form-control form-control-sm"
            style={{ width: 160 }}
            value={fecha}
            max={hoyISO()}
            onChange={(e) => e.target.value && setFecha(e.target.value > hoyISO() ? hoyISO() : e.target.value)}
          />
          <button
            className="btn btn-outline-secondary btn-sm"
            disabled={esHoy}
            onClick={() => setFecha(moverDia(fecha, 1))}
          >
            <FaChevronRight />
          </button>
          {!esHoy && (
            <button className="btn btn-primary btn-sm" onClick={() => setFecha(hoyISO())}>
              Hoy
            </button>
          )}
        </div>
      </div>

      {cargando && !data ? (
        <div className="text-center py-5">
          <div className="spinner-border text-success" />
        </div>
      ) : (
        data && (
          <div style={{ opacity: cargando ? 0.5 : 1, transition: "opacity .15s" }}>
            {/* Totales */}
            <div className="row g-3 mb-4">
              {kpi("Ingresos", fmt(data.totales.ingresos), "#27ae60", <FaArrowDown className="me-1" />)}
              {kpi("Egresos", fmt(data.totales.egresos), "#e74c3c", <FaArrowUp className="me-1" />)}
              {kpi("Neto del día", fmt(data.totales.neto), data.totales.neto >= 0 ? AZUL : "#e74c3c", null)}
              {kpi("Efectivo esperado en caja", fmt(data.efectivo.efectivo_esperado), "#9b59b6", null)}
            </div>

            <div className="row g-4">
              {/* Cierre */}
              <div className="col-12 col-lg-5">
                <div className="p-4 h-100" style={{ background: "#fff", borderRadius: "1rem", boxShadow: "0 2px 12px #0000000f" }}>
                  <h5 className="fw-bold mb-3" style={{ color: AZUL }}>
                    <FaLock className="me-2" />
                    Cierre de caja
                  </h5>

                  <div className="small mb-3">
                    <div className="d-flex justify-content-between">
                      <span className="text-muted">Saldo inicial (cierre anterior)</span>
                      <strong>{fmt(data.efectivo.saldo_inicial)}</strong>
                    </div>
                    <div className="d-flex justify-content-between">
                      <span className="text-muted">+ Ingresos en efectivo</span>
                      <strong style={{ color: "#27ae60" }}>{fmt(data.efectivo.ingresos_efectivo)}</strong>
                    </div>
                    <div className="d-flex justify-content-between">
                      <span className="text-muted">− Egresos en efectivo</span>
                      <strong style={{ color: "#e74c3c" }}>{fmt(data.efectivo.egresos_efectivo)}</strong>
                    </div>
                    <hr className="my-2" />
                    <div className="d-flex justify-content-between">
                      <span className="fw-semibold">Efectivo esperado</span>
                      <strong>{fmt(data.efectivo.efectivo_esperado)}</strong>
                    </div>
                  </div>

                  {data.cierre ? (
                    <div className="p-3" style={{ background: "#ecfdf5", borderRadius: ".8rem", border: "1px solid #a7f3d0" }}>
                      <div className="fw-bold mb-1" style={{ color: "#065f46" }}>
                        <FaCheckCircle className="me-1" /> Caja cerrada
                      </div>
                      <div className="small">Efectivo contado: <strong>{fmt(data.cierre.efectivo_contado)}</strong></div>
                      <div className="small">
                        Diferencia:{" "}
                        <strong style={{ color: Math.abs(data.cierre.diferencia) < 0.005 ? "#065f46" : "#b45309" }}>
                          {fmt(data.cierre.diferencia)}
                        </strong>
                      </div>
                      {data.cierre.observacion && (
                        <div className="small text-muted mt-1">Observación: {data.cierre.observacion}</div>
                      )}
                    </div>
                  ) : (
                    <form onSubmit={cerrarCaja}>
                      <label className="form-label small fw-semibold">Efectivo contado</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="form-control mb-2"
                        value={contado}
                        onChange={(e) => setContado(e.target.value)}
                        placeholder="0.00"
                        required
                      />
                      {diferencia !== null && (
                        <div
                          className="small mb-2 fw-semibold"
                          style={{ color: Math.abs(diferencia) < 0.005 ? "#065f46" : "#b45309" }}
                        >
                          {Math.abs(diferencia) < 0.005
                            ? "✔ La caja cuadra."
                            : `${diferencia > 0 ? "Sobrante" : "Faltante"} de ${fmt(Math.abs(diferencia))}`}
                        </div>
                      )}
                      <label className="form-label small fw-semibold">
                        Observación {diferencia !== null && Math.abs(diferencia) >= 0.005 && <span className="text-danger">(obligatoria)</span>}
                      </label>
                      <textarea
                        className="form-control mb-3"
                        rows={2}
                        value={observacion}
                        onChange={(e) => setObservacion(e.target.value)}
                        maxLength={255}
                      />
                      <button
                        type="submit"
                        className="btn fw-semibold w-100"
                        style={{ background: ACCENT, color: "#1a2a00" }}
                        disabled={guardando || contado === ""}
                      >
                        {guardando ? "Cerrando..." : "Cerrar caja del día"}
                      </button>
                    </form>
                  )}
                </div>
              </div>

              {/* Métodos y categorías */}
              <div className="col-12 col-lg-7">
                <div className="p-4 h-100" style={{ background: "#fff", borderRadius: "1rem", boxShadow: "0 2px 12px #0000000f" }}>
                  <h5 className="fw-bold mb-3" style={{ color: AZUL }}>Por método de pago</h5>
                  {data.por_metodo.length === 0 ? (
                    <div className="text-muted small">Sin movimientos en esta fecha.</div>
                  ) : (
                    <table className="table table-sm mb-4">
                      <thead>
                        <tr className="small text-muted">
                          <th>Método</th>
                          <th className="text-end">Ingresos</th>
                          <th className="text-end">Egresos</th>
                          <th className="text-end">Neto</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.por_metodo.map((m) => (
                          <tr key={m.metodo}>
                            <td>{METODOS[m.metodo] || m.metodo}</td>
                            <td className="text-end">{fmt(m.ingresos)}</td>
                            <td className="text-end">{fmt(m.egresos)}</td>
                            <td className="text-end fw-semibold">{fmt(m.ingresos - m.egresos)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  <h6 className="fw-bold mb-2" style={{ color: AZUL }}>Por concepto</h6>
                  <div className="d-flex flex-wrap gap-2">
                    {data.por_categoria.map((c) => (
                      <span
                        key={`${c.categoria}-${c.tipo}`}
                        className="badge border px-3 py-2"
                        style={{
                          background: c.tipo === "ingreso" ? "#ecfdf5" : "#fef2f2",
                          color: c.tipo === "ingreso" ? "#065f46" : "#991b1b",
                          borderColor: c.tipo === "ingreso" ? "#a7f3d0" : "#fecaca",
                        }}
                      >
                        {CATEGORIAS[c.categoria] || c.categoria} ({c.cantidad}): <strong>{fmt(c.total)}</strong>
                      </span>
                    ))}
                    {data.por_categoria.length === 0 && <span className="text-muted small">—</span>}
                  </div>
                </div>
              </div>
            </div>

            {/* Movimientos */}
            <div className="p-4 mt-4" style={{ background: "#fff", borderRadius: "1rem", boxShadow: "0 2px 12px #0000000f" }}>
              <h5 className="fw-bold mb-3" style={{ color: AZUL }}>Movimientos del día</h5>
              {data.movimientos.length === 0 ? (
                <div className="text-muted">No hay movimientos registrados en esta fecha.</div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-sm align-middle mb-0">
                    <thead>
                      <tr className="small text-muted">
                        <th>Hora</th>
                        <th>Concepto</th>
                        <th>Socio</th>
                        <th>Detalle</th>
                        <th>Método</th>
                        <th>Registró</th>
                        <th className="text-end">Monto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.movimientos.map((m) => (
                        <tr key={m.id_movimiento}>
                          <td className="text-nowrap">{hora(m.fecha)}</td>
                          <td>{CATEGORIAS[m.categoria] || m.categoria}</td>
                          <td>{m.socio || "—"}</td>
                          <td className="small text-muted">{m.descripcion}</td>
                          <td>{METODOS[m.metodo] || m.metodo}</td>
                          <td className="small">{m.registrado_por || (m.origen === "migracion" ? "Histórico" : "—")}</td>
                          <td
                            className="text-end fw-semibold text-nowrap"
                            style={{ color: m.tipo === "ingreso" ? "#27ae60" : "#e74c3c" }}
                          >
                            {m.tipo === "ingreso" ? "+" : "−"} {fmt(m.monto)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Historial de cierres */}
            {cierres.length > 0 && (
              <div className="p-4 mt-4" style={{ background: "#fff", borderRadius: "1rem", boxShadow: "0 2px 12px #0000000f" }}>
                <h5 className="fw-bold mb-3" style={{ color: AZUL }}>Últimos cierres</h5>
                <div className="table-responsive">
                  <table className="table table-sm mb-0">
                    <thead>
                      <tr className="small text-muted">
                        <th>Fecha</th>
                        <th className="text-end">Esperado</th>
                        <th className="text-end">Contado</th>
                        <th className="text-end">Diferencia</th>
                        <th>Cerrado por</th>
                        <th>Observación</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cierres.map((c) => (
                        <tr key={c.id_cierre}>
                          <td>{String(c.fecha).substring(0, 10)}</td>
                          <td className="text-end">{fmt(c.efectivo_esperado)}</td>
                          <td className="text-end">{fmt(c.efectivo_contado)}</td>
                          <td
                            className="text-end fw-semibold"
                            style={{ color: Math.abs(c.diferencia) < 0.005 ? "#065f46" : "#b45309" }}
                          >
                            {fmt(c.diferencia)}
                          </td>
                          <td>{c.cerrado_por || "—"}</td>
                          <td className="small text-muted">{c.observacion || ""}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )
      )}
    </div>
  );
}
