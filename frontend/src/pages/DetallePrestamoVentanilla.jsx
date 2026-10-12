import { hoyLocal } from "../utils/fechas";
import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import ReciboModal from "../components/ReciboModal";
import {
  FaArrowLeft,
  FaPrint,
  FaMoneyCheckAlt,
  FaExclamationTriangle,
  FaCheckCircle,
  FaCalendarAlt,
  FaHistory,
} from "react-icons/fa";

const ACCENT = "#a8cd3a";
const AZUL = "#1a2035";
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const fmt = (n) =>
  parseFloat(n || 0).toLocaleString("es-HN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const soloFecha = (v) => (v ? String(v).substring(0, 10) : null);

// Suma meses a una fecha "YYYY-MM-DD" (en UTC para evitar corrimientos de zona horaria)
const sumarMeses = (fecha, meses) => {
  if (!fecha) return null;
  const [y, m, d] = fecha.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + meses, d));
  return dt.toISOString().substring(0, 10);
};

const ESTADO_BADGE = {
  activo: { bg: "#d1fae5", color: "#065f46", label: "Activo" },
  mora: { bg: "#fee2e2", color: "#991b1b", label: "En mora" },
  pagado: { bg: "#dbeafe", color: "#1e40af", label: "Pagado" },
  pendiente: { bg: "#fef3c7", color: "#92400e", label: "Pendiente" },
};

const FILA_BADGE = {
  pagada: { bg: "#d1fae5", color: "#065f46", label: "Pagada" },
  vencida: { bg: "#fee2e2", color: "#991b1b", label: "Vencida" },
  proxima: { bg: "#fef3c7", color: "#92400e", label: "Próxima" },
  pendiente: { bg: "#eef2f7", color: "#475569", label: "Pendiente" },
};

const Badge = ({ cfg }) => (
  <span className="badge rounded-pill px-2 py-1" style={{ background: cfg.bg, color: cfg.color, fontWeight: 600 }}>
    {cfg.label}
  </span>
);

export default function DetallePrestamoVentanilla({
  idPrestamo,
  nombreSocio,
  headers,
  prox,
  onBack,
  onCobrar,
  onLiquidar,
}) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [verFiniquito, setVerFiniquito] = useState(false);

  useEffect(() => {
    let activo = true;
    axios
      .get(`${API_URL}/prestamos/${idPrestamo}`, { headers })
      .then((res) => activo && setData(res.data))
      .catch(() => activo && setError("No se pudo cargar el detalle del préstamo."));
    return () => {
      activo = false;
    };
  }, [idPrestamo, headers]);

  const calc = useMemo(() => {
    if (!data) return null;
    const p = data.prestamo;
    const monto = parseFloat(p.monto || 0);
    const plazo = parseInt(p.plazo_meses || 0);
    const tasaMensual = parseFloat(p.tasa_interes || 0) / 100 / 12;
    const cuota = parseFloat(p.cuota_mensual || 0);
    const otorgado = soloFecha(p.fecha_otorgado);
    const hoy = hoyLocal();

    // Pagos en orden cronológico
    const pagos = [...(data.historial_pagos || [])].sort(
      (a, b) =>
        new Date(a.fecha_pago) - new Date(b.fecha_pago) || a.id_pago - b.id_pago
    );

    const filas = [];
    let saldoCursor = monto;
    pagos.forEach((pg, i) => {
      const saldoNuevo = parseFloat(pg.saldo_restante ?? 0);
      filas.push({
        n: i + 1,
        fecha: soloFecha(pg.fecha_pago),
        saldoInicial: saldoCursor,
        capital: parseFloat(pg.monto_capital || 0),
        interes: parseFloat(pg.monto_interes || 0),
        total: parseFloat(pg.monto_pagado || 0),
        saldo: saldoNuevo,
        estado: "pagada",
      });
      saldoCursor = saldoNuevo;
    });

    // Proyección desde el saldo real con la cuota pactada (la última cuota se ajusta)
    const liquidado = (p.estado || "").toLowerCase() === "pagado" || saldoCursor <= 0.01;
    let primeraProyectada = true;
    if (!liquidado && plazo > 0 && cuota > 0) {
      let saldo = saldoCursor;
      let n = pagos.length + 1;
      while (saldo > 0.005 && n <= pagos.length + 360) {
        const interes = parseFloat((saldo * tasaMensual).toFixed(2));
        let capital = cuota - interes;
        if (capital <= 0) break;
        if (capital > saldo) capital = saldo;
        const saldoNuevo = Math.max(0, parseFloat((saldo - capital).toFixed(2)));
        const fecha = sumarMeses(otorgado, n);
        let estado = "pendiente";
        if (fecha && fecha < hoy) estado = "vencida";
        else if (primeraProyectada) estado = "proxima";
        primeraProyectada = false;
        filas.push({
          n,
          fecha,
          saldoInicial: saldo,
          capital,
          interes,
          total: parseFloat((capital + interes).toFixed(2)),
          saldo: saldoNuevo,
          estado,
        });
        saldo = saldoNuevo;
        n += 1;
      }
    }

    const sum = (arr, k) => arr.reduce((s, f) => s + f[k], 0);
    const pagadas = filas.filter((f) => f.estado === "pagada");
    const futuras = filas.filter((f) => f.estado !== "pagada");
    const capitalPagado = sum(pagadas, "capital");

    return {
      p,
      monto,
      plazo,
      cuota,
      tasaMensual,
      liquidado,
      filas,
      pagos,
      totalPagado: sum(pagadas, "total"),
      interesPagado: sum(pagadas, "interes"),
      capitalPagado,
      interesProyectado: sum(futuras, "interes"),
      cuotasRestantes: futuras.length,
      saldo: liquidado ? 0 : saldoCursor,
      progreso: liquidado ? 100 : monto > 0 ? Math.min(100, (capitalPagado / monto) * 100) : 0,
      vencidas: futuras.filter((f) => f.estado === "vencida").length,
    };
  }, [data]);

  if (error) {
    return (
      <div className="container-fluid py-3">
        <button className="btn btn-outline-secondary mb-3" onClick={onBack}>
          <FaArrowLeft className="me-2" /> Volver a la ficha de {nombreSocio}
        </button>
        <div className="alert alert-danger">{error}</div>
      </div>
    );
  }

  if (!calc) {
    return (
      <div className="container-fluid py-5 text-center">
        <div className="spinner-border text-success" />
      </div>
    );
  }

  const { p } = calc;
  const estadoCfg = ESTADO_BADGE[(p.estado || "").toLowerCase()] || {
    bg: "#e5e7eb",
    color: "#374151",
    label: p.estado,
  };

  return (
    <div className="container-fluid py-3">
      {verFiniquito && <ReciboModal finiquitoDe={idPrestamo} onClose={() => setVerFiniquito(false)} />}
      <style>{`
        .dp-card { border: 0; border-radius: 1rem; box-shadow: 0 2px 12px #0000000f; background: #fff; }
        .dp-kpi { border-radius: .9rem; padding: .85rem 1rem; background: #f6f8fb; height: 100%; }
        .dp-table th { font-size: .78rem; text-transform: uppercase; letter-spacing: .4px; color: #64748b; white-space: nowrap; }
        .dp-table td { vertical-align: middle; white-space: nowrap; }
        .dp-row-pagada { background: #f4fbf7; }
        .dp-row-vencida { background: #fff5f5; }
        .dp-row-proxima { background: #fffbeb; }
        @media print {
          body * { visibility: hidden; }
          .dp-print, .dp-print * { visibility: visible; }
          .dp-print { position: absolute; left: 0; top: 0; width: 100%; }
          .dp-no-print { display: none !important; }
        }
      `}</style>

      <div className="dp-print">
        {/* Barra superior */}
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3 dp-no-print">
          <button className="btn btn-outline-secondary" onClick={onBack}>
            <FaArrowLeft className="me-2" /> Volver a la ficha de {nombreSocio}
          </button>
          <div className="d-flex gap-2">
            <button className="btn btn-outline-dark" onClick={() => window.print()}>
              <FaPrint className="me-2" /> Imprimir
            </button>
            {calc.liquidado && (
              <button className="btn btn-success fw-semibold" onClick={() => setVerFiniquito(true)}>
                Constancia de finiquito
              </button>
            )}
            {!calc.liquidado && (
              <>
                <button className="btn fw-semibold" style={{ background: ACCENT, color: "#1a2a00" }} onClick={onCobrar}>
                  <FaMoneyCheckAlt className="me-2" /> Cobrar cuota
                </button>
                <button className="btn btn-dark fw-semibold" onClick={onLiquidar}>
                  Liquidar total
                </button>
              </>
            )}
          </div>
        </div>

        {/* Encabezado */}
        <div className="dp-card p-4 mb-3">
          <div className="d-flex flex-wrap justify-content-between align-items-start gap-2">
            <img src="/smartcoop.png" alt="SmartCoop" className="d-none d-print-block" style={{ height: 56 }} />
            <div>
              <h4 className="fw-bold mb-1" style={{ color: AZUL }}>
                Préstamo #{p.id_prestamo} · L. {fmt(calc.monto)}
              </h4>
              <div className="text-muted">
                Socio: <strong>{p.nombre_completo || nombreSocio}</strong> · Identidad: {p.dni || "—"}
              </div>
              <div className="text-muted small">
                <FaCalendarAlt className="me-1" />
                Otorgado: {soloFecha(p.fecha_otorgado) || "—"} · Plazo:{" "}
                {calc.plazo === 0 ? "Indefinido (solo intereses)" : `${calc.plazo} mes${calc.plazo > 1 ? "es" : ""}`} · Tasa mensual:{" "}
                {(calc.tasaMensual * 100).toFixed(2)}%
              </div>
            </div>
            <div className="d-flex gap-2 align-items-center">
              {prox?.en_mora && (
                <span className="badge rounded-pill px-3 py-2" style={{ background: "#fee2e2", color: "#991b1b" }}>
                  <FaExclamationTriangle className="me-1" />
                  {prox.dias_mora} día(s) de mora
                </span>
              )}
              <Badge cfg={estadoCfg} />
            </div>
          </div>

          {/* Progreso */}
          <div className="mt-3">
            <div className="d-flex justify-content-between small text-muted mb-1">
              <span>
                Capital pagado: <strong>L. {fmt(calc.capitalPagado)}</strong> de L. {fmt(calc.monto)}
              </span>
              <strong>{calc.progreso.toFixed(1)}%</strong>
            </div>
            <div className="progress" style={{ height: 10 }}>
              <div
                className="progress-bar"
                style={{ width: `${calc.progreso}%`, background: calc.liquidado ? "#059669" : ACCENT }}
              />
            </div>
          </div>
        </div>

        {/* Indicadores */}
        <div className="row g-2 mb-3">
          {[
            { t: "Saldo actual", v: calc.liquidado ? "Liquidado" : `L. ${fmt(calc.saldo)}`, c: calc.liquidado ? "#065f46" : "#92400e" },
            { t: "Cuota mensual", v: calc.plazo === 0 ? `L. ${fmt(calc.monto * calc.tasaMensual)} (interés)` : `L. ${fmt(calc.cuota)}` },
            { t: "Total pagado", v: `L. ${fmt(calc.totalPagado)}` },
            { t: "Intereses pagados", v: `L. ${fmt(calc.interesPagado)}` },
            { t: "Cuotas restantes", v: calc.plazo === 0 ? "—" : calc.cuotasRestantes },
            { t: "Intereses proyectados", v: calc.plazo === 0 ? "—" : `L. ${fmt(calc.interesProyectado)}` },
          ].map((k) => (
            <div className="col-6 col-lg-2" key={k.t}>
              <div className="dp-kpi">
                <div className="small text-muted">{k.t}</div>
                <div className="fw-bold" style={{ color: k.c || AZUL, fontSize: "1.02rem" }}>{k.v}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Próximo pago / liquidación */}
        {!calc.liquidado && prox && (
          <div className="dp-card p-3 mb-3 d-flex flex-wrap gap-4">
            <div>
              <div className="small text-muted">Próximo vencimiento</div>
              <div className="fw-bold">{prox.fecha_vencimiento || "—"}</div>
            </div>
            <div>
              <div className="small text-muted">Cuota a pagar</div>
              <div className="fw-bold">L. {fmt(prox.cuota_mensual)}</div>
            </div>
            {prox.en_mora && (
              <div>
                <div className="small text-muted">Mora estimada ({prox.dias_mora} días)</div>
                <div className="fw-bold" style={{ color: "#991b1b" }}>L. {fmt(prox.interes_moratorio)}</div>
              </div>
            )}
            <div>
              <div className="small text-muted">Para saldar hoy</div>
              <div className="fw-bold">L. {fmt(prox.total_para_saldar)}</div>
            </div>
            {calc.vencidas > 0 && (
              <div>
                <div className="small text-muted">Cuotas vencidas</div>
                <div className="fw-bold" style={{ color: "#991b1b" }}>{calc.vencidas}</div>
              </div>
            )}
          </div>
        )}

        {/* Tabla de amortización */}
        <div className="dp-card p-3 mb-3">
          <h5 className="fw-bold mb-1" style={{ color: AZUL }}>Tabla de amortización</h5>
          <div className="small text-muted mb-3">
            Las cuotas pagadas muestran lo realmente cobrado; las demás son una proyección desde el saldo actual.
          </div>
          {calc.plazo === 0 && calc.filas.length === 0 ? (
            <div className="text-muted">Préstamo de plazo indefinido: aún no hay pagos registrados.</div>
          ) : calc.filas.length === 0 ? (
            <div className="text-muted">No hay cuotas para mostrar.</div>
          ) : (
            <div className="table-responsive">
              <table className="table table-sm dp-table mb-0">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Fecha</th>
                    <th className="text-end">Saldo inicial</th>
                    <th className="text-end">Capital</th>
                    <th className="text-end">Interés</th>
                    <th className="text-end">Cuota</th>
                    <th className="text-end">Saldo final</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {calc.filas.map((f) => (
                    <tr key={f.n} className={`dp-row-${f.estado}`}>
                      <td className="fw-semibold">{f.n}</td>
                      <td>{f.fecha || "—"}</td>
                      <td className="text-end">{fmt(f.saldoInicial)}</td>
                      <td className="text-end">{fmt(f.capital)}</td>
                      <td className="text-end">{fmt(f.interes)}</td>
                      <td className="text-end fw-semibold">{fmt(f.total)}</td>
                      <td className="text-end">{fmt(f.saldo)}</td>
                      <td><Badge cfg={FILA_BADGE[f.estado]} /></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="fw-bold">
                    <td colSpan={3}>Totales</td>
                    <td className="text-end">{fmt(calc.filas.reduce((s, f) => s + f.capital, 0))}</td>
                    <td className="text-end">{fmt(calc.filas.reduce((s, f) => s + f.interes, 0))}</td>
                    <td className="text-end">{fmt(calc.filas.reduce((s, f) => s + f.total, 0))}</td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* Historial de pagos */}
        <div className="dp-card p-3 mb-4">
          <h5 className="fw-bold mb-3" style={{ color: AZUL }}>
            <FaHistory className="me-2" />
            Historial de pagos
          </h5>
          {calc.pagos.length === 0 ? (
            <div className="text-muted">Aún no se han registrado pagos.</div>
          ) : (
            <div className="table-responsive">
              <table className="table table-sm dp-table mb-0">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Método</th>
                    <th className="text-end">Monto</th>
                    <th className="text-end">Capital</th>
                    <th className="text-end">Interés</th>
                    <th className="text-end">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {[...calc.pagos].reverse().map((pg) => (
                    <tr key={pg.id_pago}>
                      <td>{soloFecha(pg.fecha_pago)}</td>
                      <td>{pg.metodo_pago || "—"}</td>
                      <td className="text-end fw-semibold">L. {fmt(pg.monto_pagado)}</td>
                      <td className="text-end">{fmt(pg.monto_capital)}</td>
                      <td className="text-end">{fmt(pg.monto_interes)}</td>
                      <td className="text-end">{fmt(pg.saldo_restante)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {calc.liquidado && (
            <div className="mt-3 text-success fw-semibold">
              <FaCheckCircle className="me-1" /> Préstamo liquidado completamente.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
