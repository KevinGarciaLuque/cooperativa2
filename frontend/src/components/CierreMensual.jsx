import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  FaCalendarAlt,
  FaChevronLeft,
  FaChevronRight,
  FaArrowUp,
  FaArrowDown,
  FaMinus,
} from "react-icons/fa";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const TIPOS_ACTIVIDAD = {
  rifas: "Rifas",
  ventas: "Ventas",
  intereses_ganados: "Intereses ganados",
  donaciones: "Donaciones",
  alquileres: "Alquileres",
  otros_ingresos: "Otros ingresos",
};

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
  const txt = new Date(y, m - 1, 1).toLocaleDateString("es-HN", { month: "long", year: "numeric" });
  return txt.charAt(0).toUpperCase() + txt.slice(1);
};

// Variación porcentual contra el mes anterior
function Variacion({ actual, anterior }) {
  if (!anterior) {
    return <span className="small text-muted">Sin datos del mes anterior</span>;
  }
  const pct = ((actual - anterior) / anterior) * 100;
  const sube = pct > 0.05;
  const baja = pct < -0.05;
  const color = sube ? "#27ae60" : baja ? "#e74c3c" : "#7f8c8d";
  const Icono = sube ? FaArrowUp : baja ? FaArrowDown : FaMinus;
  return (
    <span className="small fw-semibold" style={{ color }}>
      <Icono className="me-1" size={10} />
      {Math.abs(pct).toFixed(1)}% vs mes anterior
    </span>
  );
}

export default function CierreMensual({ token }) {
  const [mes, setMes] = useState(mesActualISO());
  const [data, setData] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const actualISO = mesActualISO();
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  useEffect(() => {
    let activo = true;
    const [anio, m] = mes.split("-");
    setCargando(true);
    setError("");
    axios
      .get(`${API_URL}/dashboard/cierre-mensual`, { headers, params: { anio, mes: parseInt(m) } })
      .then((res) => activo && setData(res.data))
      .catch(() => activo && setError("No se pudo cargar el cierre de este mes."))
      .finally(() => activo && setCargando(false));
    return () => {
      activo = false;
    };
  }, [mes, headers]);

  const cambiarMes = (valor) => {
    if (!/^\d{4}-\d{2}$/.test(valor)) return;
    setMes(valor > actualISO ? actualISO : valor);
  };

  const esMesActual = mes === actualISO;

  const dias = useMemo(() => {
    if (!data) return [];
    const [y, m] = mes.split("-").map(Number);
    const ultimo = new Date(y, m, 0).getDate();
    const porDia = Object.fromEntries(data.por_dia.map((d) => [d.dia, d.interes]));
    return Array.from({ length: ultimo }, (_, i) => ({ dia: i + 1, interes: porDia[i + 1] || 0 }));
  }, [data, mes]);

  const tarjeta = (titulo, valor, color, extra) => (
    <div className="col-6 col-lg-3">
      <div className="h-100 p-3" style={{ background: "#f6f8fb", borderRadius: "12px" }}>
        <div className="small text-muted fw-semibold">{titulo}</div>
        <div className="fw-bold fs-5" style={{ color }}>{valor}</div>
        {extra}
      </div>
    </div>
  );

  return (
    <div className="card border-0 shadow-sm mb-4" style={{ borderRadius: "15px" }}>
      <div className="card-body p-4">
        {/* Encabezado + selector de mes */}
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-3">
          <div>
            <h5 className="mb-0 fw-bold d-flex align-items-center" style={{ color: "#2c3e50" }}>
              <FaCalendarAlt className="me-2" style={{ color: "#667eea" }} />
              Cierre mensual
            </h5>
            <div className="text-muted small">
              {nombreMes(mes)} {esMesActual && "· mes en curso"}
            </div>
          </div>
          <div className="d-flex align-items-center gap-2">
            <button
              className="btn btn-outline-secondary btn-sm"
              onClick={() => setMes(moverMes(mes, -1))}
              title="Mes anterior"
            >
              <FaChevronLeft />
            </button>
            <input
              type="month"
              className="form-control form-control-sm"
              style={{ width: 160 }}
              value={mes}
              max={actualISO}
              onChange={(e) => cambiarMes(e.target.value)}
            />
            <button
              className="btn btn-outline-secondary btn-sm"
              onClick={() => setMes(moverMes(mes, 1))}
              disabled={esMesActual}
              title="Mes siguiente"
            >
              <FaChevronRight />
            </button>
            {!esMesActual && (
              <button className="btn btn-sm btn-primary" onClick={() => setMes(actualISO)}>
                Mes actual
              </button>
            )}
          </div>
        </div>

        {error && <div className="alert alert-danger py-2">{error}</div>}

        {cargando && !data ? (
          <div className="text-center py-4">
            <div className="spinner-border spinner-border-sm text-primary" />
          </div>
        ) : (
          data && (
            <div style={{ opacity: cargando ? 0.5 : 1, transition: "opacity .15s" }}>
              <div className="row g-3 mb-4">
                {tarjeta(
                  "Intereses recaudados",
                  fmt(data.intereses.recaudados),
                  "#9b59b6",
                  <Variacion actual={data.intereses.recaudados} anterior={data.intereses.mes_anterior} />
                )}
                {tarjeta(
                  "Ingresos totales",
                  fmt(data.ingresos_totales),
                  "#3498db",
                  <Variacion actual={data.ingresos_totales} anterior={data.ingresos_mes_anterior} />
                )}
                {tarjeta(
                  "Pagos de préstamos",
                  fmt(data.pagos.total),
                  "#27ae60",
                  <span className="small text-muted">
                    {data.pagos.cantidad} pago(s) · capital {fmt(data.pagos.capital)}
                  </span>
                )}
                {tarjeta(
                  "Mora cobrada",
                  fmt(data.pagos.mora),
                  "#e74c3c",
                  <span className="small text-muted">Recargos por atraso del mes</span>
                )}
                {tarjeta(
                  "Aportaciones",
                  fmt(data.aportaciones.total),
                  "#f39c12",
                  <span className="small text-muted">{data.aportaciones.cantidad} aportación(es)</span>
                )}
                {tarjeta(
                  "Préstamos otorgados",
                  data.prestamos_otorgados.cantidad,
                  "#2c3e50",
                  <span className="small text-muted">{fmt(data.prestamos_otorgados.monto)}</span>
                )}
                {tarjeta(
                  "Actividades / otros ingresos",
                  fmt(data.actividades.total),
                  "#16a085",
                  <span className="small text-muted">{data.actividades.cantidad} registro(s)</span>
                )}
                {tarjeta("Nuevos socios", data.nuevos_socios, "#667eea")}
                {tarjeta("Liquidaciones repartidas", fmt(data.liquidaciones), "#e67e22")}
              </div>

              <div className="row g-4">
                {/* Intereses por día */}
                <div className="col-12 col-lg-6">
                  <div className="fw-bold mb-2" style={{ color: "#2c3e50" }}>Intereses recaudados por día</div>
                  {data.por_dia.length === 0 ? (
                    <div className="text-muted small py-4 text-center">Sin pagos en este mes.</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={dias}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="dia" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip
                          formatter={(v) => [fmt(v), "Intereses"]}
                          labelFormatter={(d) => `Día ${d}`}
                        />
                        <Bar dataKey="interes" fill="#9b59b6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>

                {/* Intereses por socio */}
                <div className="col-12 col-lg-6">
                  <div className="fw-bold mb-2" style={{ color: "#2c3e50" }}>Intereses por socio</div>
                  {data.por_socio.length === 0 ? (
                    <div className="text-muted small py-4 text-center">Sin pagos en este mes.</div>
                  ) : (
                    <div className="table-responsive" style={{ maxHeight: 260, overflowY: "auto" }}>
                      <table className="table table-sm mb-0">
                        <thead>
                          <tr className="small text-muted">
                            <th>Socio</th>
                            <th className="text-end">Pagos</th>
                            <th className="text-end">Total pagado</th>
                            <th className="text-end">Interés</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.por_socio.map((s) => (
                            <tr key={s.id_usuario}>
                              <td>{s.nombre_completo}</td>
                              <td className="text-end">{s.pagos}</td>
                              <td className="text-end">{fmt(s.total_pagado)}</td>
                              <td className="text-end fw-semibold" style={{ color: "#9b59b6" }}>
                                {fmt(s.interes)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="fw-bold">
                            <td>Total</td>
                            <td className="text-end">{data.pagos.cantidad}</td>
                            <td className="text-end">{fmt(data.pagos.total)}</td>
                            <td className="text-end" style={{ color: "#9b59b6" }}>{fmt(data.pagos.interes)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              {data.actividades.por_tipo.length > 0 && (
                <div className="mt-4">
                  <div className="fw-bold mb-2" style={{ color: "#2c3e50" }}>Ingresos por actividades</div>
                  <div className="d-flex flex-wrap gap-2">
                    {data.actividades.por_tipo.map((a) => (
                      <span key={a.tipo} className="badge bg-light text-dark border px-3 py-2">
                        {TIPOS_ACTIVIDAD[a.tipo] || a.tipo}: <strong>{fmt(a.total)}</strong>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        )}
      </div>
    </div>
  );
}
