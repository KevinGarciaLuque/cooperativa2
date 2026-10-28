import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { useAlerta } from "../context/AlertaContext";
import {
  FaBalanceScale,
  FaCalendarCheck,
  FaChevronLeft,
  FaChevronRight,
  FaFileExcel,
  FaLock,
  FaPrint,
  FaUnlock,
  FaExclamationTriangle,
} from "react-icons/fa";

const AZUL = "#1a2035";
const ACCENT = "#a8cd3a";
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const fmt = (n) =>
  `L. ${parseFloat(n || 0).toLocaleString("es-HN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const mesActualISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

const moverMes = (iso, delta) => {
  const [y, m] = iso.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

const nombreMes = (iso) => {
  const [y, m] = iso.split("-").map(Number);
  const t = new Date(y, m - 1, 1).toLocaleDateString("es-HN", { month: "long", year: "numeric" });
  return t.charAt(0).toUpperCase() + t.slice(1);
};

const ETIQUETAS_CARTERA = {
  al_dia: "Al día",
  por_vencer: "Por vencer (7 días)",
  mora_1_30: "Mora 1-30 días",
  mora_31_60: "Mora 31-60 días",
  mora_61_90: "Mora 61-90 días",
  mora_90_mas: "Mora más de 90 días",
};

const TABS = [
  { key: "cierre", label: "Cierre mensual" },
  { key: "resultados", label: "Estado de resultados" },
  { key: "cartera", label: "Antigüedad de cartera" },
  { key: "situacion", label: "Situación financiera" },
];

const Fila = ({ etiqueta, valor, negrita, sangria, color }) => (
  <div
    className="d-flex justify-content-between py-1"
    style={{ paddingLeft: sangria ? 18 : 0, fontWeight: negrita ? 700 : 400, borderTop: negrita ? "1px solid #cbd5e1" : "none", color: color || "inherit" }}
  >
    <span>{etiqueta}</span>
    <span>{valor}</span>
  </div>
);

export default function Contabilidad() {
  const { token, user } = useAuth();
  const { mostrarAlerta } = useAlerta();
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const esSuper = user?.rol === "Super Administrador";

  const [tab, setTab] = useState("cierre");
  const [mes, setMes] = useState(moverMes(mesActualISO(), -1));
  const [cierre, setCierre] = useState(null);
  const [resultados, setResultados] = useState(null);
  const [cartera, setCartera] = useState(null);
  const [situacion, setSituacion] = useState(null);
  const [cargando, setCargando] = useState(false);

  const [anio, mesNum] = mes.split("-").map(Number);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      if (tab === "cierre") {
        const r = await axios.get(`${API_URL}/contabilidad/cierre-mensual`, { headers, params: { anio, mes: mesNum } });
        setCierre(r.data);
      } else if (tab === "resultados") {
        const r = await axios.get(`${API_URL}/contabilidad/estado-resultados`, { headers, params: { anio, mes: mesNum } });
        setResultados(r.data.data);
      } else if (tab === "cartera") {
        const r = await axios.get(`${API_URL}/contabilidad/antiguedad-cartera`, { headers });
        setCartera(r.data);
      } else {
        const r = await axios.get(`${API_URL}/contabilidad/situacion-financiera`, { headers });
        setSituacion(r.data);
      }
    } catch {
      mostrarAlerta("No se pudo cargar la información contable.", "error");
    } finally {
      setCargando(false);
    }
    // eslint-disable-next-line
  }, [tab, anio, mesNum, headers]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const cerrarMes = async () => {
    if (!window.confirm(`¿Cerrar ${nombreMes(mes)}? Las cifras quedarán congeladas.`)) return;
    try {
      await axios.post(`${API_URL}/contabilidad/cierre-mensual`, { anio, mes: mesNum }, { headers });
      mostrarAlerta("Mes cerrado correctamente.", "success");
      cargar();
    } catch (err) {
      mostrarAlerta(err.response?.data?.message || "No se pudo cerrar el mes.", "error");
    }
  };

  const reabrirMes = async () => {
    const motivo = window.prompt(`Motivo para reabrir ${nombreMes(mes)} (mínimo 5 caracteres):`);
    if (motivo === null) return;
    try {
      await axios.delete(`${API_URL}/contabilidad/cierre-mensual/${anio}/${mesNum}`, {
        headers,
        params: { motivo },
      });
      mostrarAlerta("Mes reabierto.", "success");
      cargar();
    } catch (err) {
      mostrarAlerta(err.response?.data?.message || "No se pudo reabrir el mes.", "error");
    }
  };

  const exportar = async (ruta, nombre, params = {}) => {
    try {
      const r = await axios.get(`${API_URL}/contabilidad/exportar/${ruta}`, {
        headers,
        params,
        responseType: "blob",
      });
      const url = URL.createObjectURL(r.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = nombre;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch {
      mostrarAlerta("No se pudo exportar el archivo.", "error");
    }
  };

  const selectorMes = (
    <div className="d-flex align-items-center gap-2 ct-no-print">
      <button className="btn btn-outline-secondary btn-sm" onClick={() => setMes(moverMes(mes, -1))}>
        <FaChevronLeft />
      </button>
      <input
        type="month"
        className="form-control form-control-sm"
        style={{ width: 160 }}
        value={mes}
        max={mesActualISO()}
        onChange={(e) => e.target.value && setMes(e.target.value > mesActualISO() ? mesActualISO() : e.target.value)}
      />
      <button
        className="btn btn-outline-secondary btn-sm"
        disabled={mes >= mesActualISO()}
        onClick={() => setMes(moverMes(mes, 1))}
      >
        <FaChevronRight />
      </button>
    </div>
  );

  const tarjeta = { background: "#fff", borderRadius: "1rem", boxShadow: "0 2px 12px #0000000f" };

  // ── Bloques reutilizables ──
  const bloqueResultados = (r) => (
    <div className="p-4" style={tarjeta}>
      <h6 className="fw-bold mb-2">Ingresos</h6>
      <Fila etiqueta="Intereses de préstamos" valor={fmt(r.ingresos.intereses_prestamos)} sangria />
      <Fila etiqueta="Mora cobrada" valor={fmt(r.ingresos.mora)} sangria />
      {r.ingresos.intereses_capitalizados > 0 && (
        <Fila etiqueta="Intereses capitalizados (consolidaciones)" valor={fmt(r.ingresos.intereses_capitalizados)} sangria />
      )}
      {r.ingresos.otros.map((o) => (
        <Fila key={o.tipo} etiqueta={o.etiqueta} valor={fmt(o.total)} sangria />
      ))}
      <Fila etiqueta="Total ingresos" valor={fmt(r.ingresos.total)} negrita />

      <h6 className="fw-bold mt-4 mb-2">Gastos</h6>
      {r.gastos.detalle.length === 0 && <div className="small text-muted ps-3">Sin gastos registrados en el período.</div>}
      {r.gastos.detalle.map((g) => (
        <Fila key={g.categoria} etiqueta={g.etiqueta} valor={fmt(g.total)} sangria />
      ))}
      <Fila etiqueta="Total gastos" valor={fmt(r.gastos.total)} negrita />

      <div
        className="d-flex justify-content-between mt-4 p-3 fw-bold fs-5"
        style={{ background: r.excedente >= 0 ? "#ecfdf5" : "#fef2f2", borderRadius: 10, color: r.excedente >= 0 ? "#065f46" : "#991b1b" }}
      >
        <span>Excedente del período</span>
        <span>{fmt(r.excedente)}</span>
      </div>
    </div>
  );

  const bloqueCartera = (resumen, totales) => (
    <div className="table-responsive">
      <table className="table align-middle mb-0">
        <thead>
          <tr className="small text-muted">
            <th>Categoría</th>
            <th className="text-end">Préstamos</th>
            <th className="text-end">Saldo</th>
            <th className="text-end">Mora generada</th>
            <th className="text-end">% provisión</th>
            <th className="text-end">Provisión</th>
          </tr>
        </thead>
        <tbody>
          {Object.keys(ETIQUETAS_CARTERA).map((k) => {
            const r = resumen[k];
            if (!r) return null;
            return (
              <tr key={k}>
                <td>{ETIQUETAS_CARTERA[k]}</td>
                <td className="text-end">{r.cantidad}</td>
                <td className="text-end">{fmt(r.saldo)}</td>
                <td className="text-end">{fmt(r.mora)}</td>
                <td className="text-end">{r.porcentaje_provision}%</td>
                <td className="text-end">{fmt(r.provision)}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="fw-bold">
            <td>Total</td>
            <td className="text-end">{totales.cantidad}</td>
            <td className="text-end">{fmt(totales.saldo)}</td>
            <td className="text-end">{fmt(totales.mora)}</td>
            <td></td>
            <td className="text-end">{fmt(totales.provision)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );

  return (
    <div className="container-fluid py-3">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .ct-print, .ct-print * { visibility: visible; }
          .ct-print { position: absolute; left: 0; top: 0; width: 100%; }
          .ct-no-print { display: none !important; }
        }
      `}</style>

      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3 ct-no-print">
        <div>
          <h3 className="fw-bold mb-0" style={{ color: AZUL }}>
            <FaBalanceScale className="me-2" />
            Contabilidad
          </h3>
          <span className="text-muted">Cierres, resultados, cartera y situación financiera.</span>
        </div>
        <button className="btn btn-dark" onClick={() => window.print()}>
          <FaPrint className="me-2" /> Imprimir / PDF
        </button>
      </div>

      <ul className="nav nav-tabs mb-3 ct-no-print">
        {TABS.map((t) => (
          <li className="nav-item" key={t.key}>
            <button
              className={`nav-link ${tab === t.key ? "active fw-semibold" : ""}`}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          </li>
        ))}
      </ul>

      <div className="ct-print" style={{ opacity: cargando ? 0.5 : 1, transition: "opacity .15s" }}>
        {/* Encabezado solo al imprimir */}
        <div className="d-none d-print-flex align-items-center gap-3 mb-3">
          <img src="/smartcoop.png" alt="SmartCoop" style={{ height: 56 }} />
          <div className="fw-bold fs-5">SmartCoop · Contabilidad</div>
        </div>
        {/* ── CIERRE MENSUAL ── */}
        {tab === "cierre" && (
          <>
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
              <div>
                <h5 className="fw-bold mb-0">{nombreMes(mes)}</h5>
                {cierre?.cerrado ? (
                  <span className="badge bg-success">
                    <FaLock className="me-1" />
                    Cerrado el {String(cierre.cierre.cerrado_en).substring(0, 10)}
                    {cierre.cierre.cerrado_por ? ` por ${cierre.cierre.cerrado_por}` : ""}
                  </span>
                ) : (
                  <span className="badge bg-warning text-dark">Abierto — cifras en vivo</span>
                )}
              </div>
              <div className="d-flex flex-wrap gap-2 align-items-center">
                {selectorMes}
                {cierre && !cierre.cerrado && cierre.puede_cerrar && (
                  <button className="btn btn-sm fw-semibold ct-no-print" style={{ background: ACCENT, color: "#1a2a00" }} onClick={cerrarMes}>
                    <FaCalendarCheck className="me-1" /> Cerrar mes
                  </button>
                )}
                {cierre?.cerrado && esSuper && (
                  <button className="btn btn-sm btn-outline-danger ct-no-print" onClick={reabrirMes}>
                    <FaUnlock className="me-1" /> Reabrir
                  </button>
                )}
                <button
                  className="btn btn-sm btn-outline-success ct-no-print"
                  onClick={() => exportar("estado-resultados", `estado_resultados_${mes}.xlsx`, { anio, mes: mesNum })}
                >
                  <FaFileExcel className="me-1" /> Excel
                </button>
              </div>
            </div>

            {cierre && cierre.data && (
              <>
                <div className="row g-3 mb-3">
                  {[
                    ["Ingresos", cierre.data.resultados.ingresos.total, "#27ae60"],
                    ["Gastos", cierre.data.resultados.gastos.total, "#e74c3c"],
                    ["Excedente", cierre.data.resultados.excedente, cierre.data.resultados.excedente >= 0 ? AZUL : "#e74c3c"],
                    ["Aportaciones", cierre.data.aportaciones.total, "#f39c12"],
                    ["Préstamos otorgados", cierre.data.prestamos_otorgados.monto, "#3498db"],
                    ["Saldo de cartera", cierre.data.cartera.totales.saldo, "#9b59b6"],
                  ].map(([t, v, c]) => (
                    <div className="col-6 col-lg-2" key={t}>
                      <div className="p-3 h-100" style={tarjeta}>
                        <div className="small text-muted fw-semibold">{t}</div>
                        <div className="fw-bold" style={{ color: c }}>{fmt(v)}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="row g-3">
                  <div className="col-12 col-xl-6">{bloqueResultados(cierre.data.resultados)}</div>
                  <div className="col-12 col-xl-6">
                    <div className="p-4" style={tarjeta}>
                      <h6 className="fw-bold mb-3">Cartera al cierre</h6>
                      {bloqueCartera(cierre.data.cartera.resumen, cierre.data.cartera.totales)}
                    </div>
                  </div>
                </div>
                {cierre.cerrado && (
                  <div className="small text-muted mt-2">
                    Estas cifras quedaron congeladas al cerrar el mes y no cambian aunque se editen operaciones posteriores.
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* ── ESTADO DE RESULTADOS ── */}
        {tab === "resultados" && (
          <>
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
              <h5 className="fw-bold mb-0">Estado de resultados — {nombreMes(mes)}</h5>
              <div className="d-flex gap-2 align-items-center">
                {selectorMes}
                <button
                  className="btn btn-sm btn-outline-success ct-no-print"
                  onClick={() => exportar("estado-resultados", `estado_resultados_${mes}.xlsx`, { anio, mes: mesNum })}
                >
                  <FaFileExcel className="me-1" /> Excel
                </button>
              </div>
            </div>
            {resultados && bloqueResultados(resultados)}
            <div className="small text-muted mt-2">
              Los gastos se toman de lo registrado en Caja → Registrar gasto.
            </div>
          </>
        )}

        {/* ── ANTIGÜEDAD DE CARTERA ── */}
        {tab === "cartera" && cartera && (
          <>
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
              <h5 className="fw-bold mb-0">Antigüedad de cartera al {cartera.fecha}</h5>
              <button
                className="btn btn-sm btn-outline-success ct-no-print"
                onClick={() => exportar("antiguedad-cartera", `antiguedad_cartera_${cartera.fecha}.xlsx`)}
              >
                <FaFileExcel className="me-1" /> Excel
              </button>
            </div>
            <div className="p-3 mb-3" style={tarjeta}>
              {bloqueCartera(cartera.resumen, cartera.totales)}
              <div className="small text-muted mt-2">
                Los porcentajes de provisión se ajustan en Parámetros financieros.
              </div>
            </div>
            <div className="p-3" style={tarjeta}>
              <h6 className="fw-bold">Detalle por préstamo</h6>
              <div className="table-responsive">
                <table className="table table-sm mb-0">
                  <thead>
                    <tr className="small text-muted">
                      <th>Socio</th>
                      <th>Préstamo</th>
                      <th>Categoría</th>
                      <th className="text-end">Días de mora</th>
                      <th className="text-end">Saldo</th>
                      <th className="text-end">Mora</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cartera.detalle.map((f) => (
                      <tr key={f.id_prestamo}>
                        <td>{f.socio}</td>
                        <td>#{f.id_prestamo}</td>
                        <td>{ETIQUETAS_CARTERA[f.categoria]}</td>
                        <td className="text-end">{f.dias_mora}</td>
                        <td className="text-end">{fmt(f.saldo)}</td>
                        <td className="text-end">{fmt(f.mora_generada)}</td>
                      </tr>
                    ))}
                    {cartera.detalle.length === 0 && (
                      <tr><td colSpan={6} className="text-center text-muted py-3">No hay préstamos vigentes.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* ── SITUACIÓN FINANCIERA ── */}
        {tab === "situacion" && situacion && (
          <>
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
              <h5 className="fw-bold mb-0">Situación financiera al {situacion.fecha}</h5>
              <button
                className="btn btn-sm btn-outline-success ct-no-print"
                onClick={() => exportar("situacion-financiera", `situacion_financiera_${situacion.fecha}.xlsx`)}
              >
                <FaFileExcel className="me-1" /> Excel
              </button>
            </div>

            {situacion.data.advertencias.map((a) => (
              <div key={a} className="alert alert-warning d-flex gap-2 align-items-start">
                <FaExclamationTriangle className="mt-1" />
                <span>{a}</span>
              </div>
            ))}

            <div className="row g-3">
              <div className="col-12 col-lg-6">
                <div className="p-4 h-100" style={tarjeta}>
                  <h6 className="fw-bold mb-2">Activos</h6>
                  <Fila etiqueta="Efectivo (libro de caja)" valor={fmt(situacion.data.activos.efectivo)} sangria />
                  <Fila etiqueta="Bancos y otros medios" valor={fmt(situacion.data.activos.bancos)} sangria />
                  <Fila
                    etiqueta={`Cartera de préstamos (${situacion.data.activos.prestamos_vigentes})`}
                    valor={fmt(situacion.data.activos.cartera_prestamos)}
                    sangria
                  />
                  <Fila etiqueta="(−) Provisión de cartera" valor={fmt(-situacion.data.activos.provision_cartera)} sangria />
                  <Fila etiqueta="Total activos" valor={fmt(situacion.data.activos.total)} negrita />
                </div>
              </div>
              <div className="col-12 col-lg-6">
                <div className="p-4 h-100" style={tarjeta}>
                  <h6 className="fw-bold mb-2">Obligaciones con socios</h6>
                  {situacion.data.obligaciones_socios.por_cuenta.map((c) => (
                    <Fila key={c.tipo} etiqueta={`Cuenta ${c.tipo}`} valor={fmt(c.saldo)} sangria />
                  ))}
                  <Fila etiqueta="Total obligaciones" valor={fmt(situacion.data.obligaciones_socios.total)} negrita />

                  <div
                    className="d-flex justify-content-between mt-4 p-3 fw-bold"
                    style={{ background: "#f1f5f9", borderRadius: 10 }}
                  >
                    <span>Patrimonio neto</span>
                    <span>{fmt(situacion.data.patrimonio_neto)}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="small text-muted mt-2">
              Resumen administrativo con base en el libro de caja, la cartera y las cuentas de socios; no sustituye
              la contabilidad formal.
            </div>
          </>
        )}
      </div>
    </div>
  );
}
