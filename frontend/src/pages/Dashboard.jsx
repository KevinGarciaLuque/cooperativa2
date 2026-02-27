import { useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import {
  FaUsers,
  FaHandHoldingUsd,
  FaChartLine,
  FaExclamationTriangle,
  FaMoneyBillWave,
  FaCalendarAlt,
  FaFileInvoiceDollar,
  FaTrophy,
  FaArrowUp,
  FaArrowDown,
  FaSync,
  FaPiggyBank,
  FaWallet,
  FaChartPie,
  FaCheckCircle,
  FaClock,
  FaUserTie,
  FaMedal,
} from "react-icons/fa";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  LineChart,
  Line,
  Area,
  AreaChart,
} from "recharts";

const COLORS = {
  primary: "#667eea",
  success: "#27ae60",
  warning: "#f39c12",
  danger: "#e74c3c",
  info: "#3498db",
  activo: "#27ae60",
  mora: "#e74c3c",
  pagado: "#95a5a6",
  pendiente: "#f39c12",
  purple: "#9b59b6",
  orange: "#e67e22",
  teal: "#16a085",
};

const CHART_COLORS = ["#667eea", "#27ae60", "#f39c12", "#3498db", "#e74c3c", "#e67e22", "#9b59b6", "#16a085"];

export default function Dashboard() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState(null);
  const [seriesTiempo, setSeriesTiempo] = useState(null);
  const [alertas, setAlertas] = useState(null);
  const [distribuciones, setDistribuciones] = useState(null);
  const [rankings, setRankings] = useState(null);
  const [resumenEjecutivo, setResumenEjecutivo] = useState(null);

  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

  useEffect(() => {
    fetchDashboardData();
  }, [token]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const headers = { Authorization: `Bearer ${token}` };

      const [kpisRes, seriesRes, alertasRes, distribRes, rankingsRes, resumenRes] = await Promise.all([
        axios.get(`${API_URL}/dashboard/kpis`, { headers }),
        axios.get(`${API_URL}/dashboard/series-tiempo?meses=6`, { headers }),
        axios.get(`${API_URL}/dashboard/alertas`, { headers }),
        axios.get(`${API_URL}/dashboard/distribuciones`, { headers }),
        axios.get(`${API_URL}/dashboard/rankings?limite=5`, { headers }),
        axios.get(`${API_URL}/dashboard/resumen-ejecutivo`, { headers }),
      ]);

      setKpis(kpisRes.data);
      setSeriesTiempo(seriesRes.data);
      setAlertas(alertasRes.data);
      setDistribuciones(distribRes.data);
      setRankings(rankingsRes.data);
      setResumenEjecutivo(resumenRes.data);
    } catch (error) {
      console.error("Error cargando dashboard:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value) => {
    return `L. ${parseFloat(value).toLocaleString("es-HN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: "80vh" }}>
        <div>
          <div
            className="spinner-border text-primary"
            role="status"
            style={{ width: "3rem", height: "3rem" }}
          >
            <span className="visually-hidden">Cargando...</span>
          </div>
          <p className="mt-3 text-muted fw-semibold">Cargando Dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container-fluid px-4 py-4" style={{ background: "#f8f9fa", minHeight: "100vh" }}>
      {/* ENCABEZADO */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="mb-1 fw-bold" style={{ color: "#2c3e50" }}>
            <FaChartLine className="me-2" style={{ color: "#667eea" }} />
            Dashboard de Smart Coop
          </h2>
          <p className="text-muted mb-0">
            Vista general del estado operativo y financiero
          </p>
        </div>
        <button
          className="btn btn-lg shadow-sm"
          onClick={fetchDashboardData}
          style={{
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            color: "white",
            border: "none",
            borderRadius: "10px",
            fontWeight: "600",
          }}
        >
          <FaSync className="me-2" />
          Actualizar
        </button>
      </div>

      {/* ==================== SECCIÓN 1: KPIs PRINCIPALES ==================== */}
      {kpis && (
        <>
          <h5 className="mb-3 fw-bold d-flex align-items-center" style={{ color: "#2c3e50" }}>
            <FaChartPie className="me-2" style={{ color: "#667eea" }} />
            Indicadores Clave
          </h5>
          <div className="row g-3 mb-4">
            {/* Socios */}
            <div className="col-12 col-sm-6 col-lg-3">
              <div
                className="card border-0 shadow-sm h-100"
                style={{ borderRadius: "15px", borderLeft: `4px solid ${COLORS.primary}` }}
              >
                <div className="card-body">
                  <div className="d-flex justify-content-between align-items-center">
                    <div>
                      <p className="text-muted mb-1 small">Total Socios</p>
                      <h3 className="mb-0 fw-bold" style={{ color: "#2c3e50" }}>
                        {kpis.socios.total}
                      </h3>
                      <p className="mb-0 small" style={{ color: COLORS.success }}>
                        <FaCheckCircle className="me-1" />
                        {kpis.socios.activos} activos
                      </p>
                    </div>
                    <div
                      className="rounded-circle d-flex align-items-center justify-content-center"
                      style={{
                        width: "50px",
                        height: "50px",
                        background: `${COLORS.primary}20`,
                      }}
                    >
                      <FaUsers style={{ fontSize: "24px", color: COLORS.primary }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Préstamos */}
            <div className="col-12 col-sm-6 col-lg-3">
              <div
                className="card border-0 shadow-sm h-100"
                style={{ borderRadius: "15px", borderLeft: `4px solid ${COLORS.warning}` }}
              >
                <div className="card-body">
                  <div className="d-flex justify-content-between align-items-center">
                    <div>
                      <p className="text-muted mb-1 small">Préstamos Activos</p>
                      <h3 className="mb-0 fw-bold" style={{ color: "#2c3e50" }}>
                        {kpis.prestamos.activos}
                      </h3>
                      <p className="mb-0 small" style={{ color: COLORS.danger }}>
                        <FaExclamationTriangle className="me-1" />
                        {kpis.prestamos.mora} en mora
                      </p>
                    </div>
                    <div
                      className="rounded-circle d-flex align-items-center justify-content-center"
                      style={{
                        width: "50px",
                        height: "50px",
                        background: `${COLORS.warning}20`,
                      }}
                    >
                      <FaFileInvoiceDollar style={{ fontSize: "24px", color: COLORS.warning }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Cartera */}
            <div className="col-12 col-sm-6 col-lg-3">
              <div
                className="card border-0 shadow-sm h-100"
                style={{ borderRadius: "15px", borderLeft: `4px solid ${COLORS.success}` }}
              >
                <div className="card-body">
                  <div className="d-flex justify-content-between align-items-center">
                    <div>
                      <p className="text-muted mb-1 small">Cartera Total</p>
                      <h3 className="mb-0 fw-bold" style={{ fontSize: "1.3rem", color: COLORS.success }}>
                        {formatCurrency(kpis.prestamos.montoCartera)}
                      </h3>
                      <p className="mb-0 small text-muted">
                        Pendiente: {formatCurrency(kpis.prestamos.saldoPendiente)}
                      </p>
                    </div>
                    <div
                      className="rounded-circle d-flex align-items-center justify-content-center"
                      style={{
                        width: "50px",
                        height: "50px",
                        background: `${COLORS.success}20`,
                      }}
                    >
                      <FaWallet style={{ fontSize: "24px", color: COLORS.success }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Tasa de Morosidad */}
            <div className="col-12 col-sm-6 col-lg-3">
              <div
                className="card border-0 shadow-sm h-100"
                style={{ borderRadius: "15px", borderLeft: `4px solid ${COLORS.danger}` }}
              >
                <div className="card-body">
                  <div className="d-flex justify-content-between align-items-center">
                    <div>
                      <p className="text-muted mb-1 small">Tasa de Morosidad</p>
                      <h3 className="mb-0 fw-bold" style={{ color: COLORS.danger }}>
                        {kpis.prestamos.tasaMorosidad}%
                      </h3>
                      <p className="mb-0 small text-muted">
                        {kpis.prestamos.mora} préstamos
                      </p>
                    </div>
                    <div
                      className="rounded-circle d-flex align-items-center justify-content-center"
                      style={{
                        width: "50px",
                        height: "50px",
                        background: `${COLORS.danger}20`,
                      }}
                    >
                      <FaExclamationTriangle style={{ fontSize: "24px", color: COLORS.danger }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* KPIs Financieros */}
          <div className="row g-3 mb-4">
            <div className="col-12 col-md-4">
              <div className="card border-0 shadow-sm" style={{ borderRadius: "15px" }}>
                <div className="card-body text-center py-4">
                  <div
                    className="rounded-circle d-flex align-items-center justify-content-center mx-auto mb-3"
                    style={{
                      width: "50px",
                      height: "50px",
                      background: `${COLORS.success}20`,
                    }}
                  >
                    <FaPiggyBank style={{ fontSize: "24px", color: COLORS.success }} />
                  </div>
                  <p className="text-muted mb-2 small fw-semibold">Aportaciones Totales</p>
                  <h4 className="mb-0 fw-bold" style={{ color: COLORS.success }}>
                    {formatCurrency(kpis.finanzas.totalAportaciones)}
                  </h4>
                </div>
              </div>
            </div>
            <div className="col-12 col-md-4">
              <div className="card border-0 shadow-sm" style={{ borderRadius: "15px" }}>
                <div className="card-body text-center py-4">
                  <div
                    className="rounded-circle d-flex align-items-center justify-content-center mx-auto mb-3"
                    style={{
                      width: "50px",
                      height: "50px",
                      background: `${COLORS.info}20`,
                    }}
                  >
                    <FaCalendarAlt style={{ fontSize: "24px", color: COLORS.info }} />
                  </div>
                  <p className="text-muted mb-2 small fw-semibold">Ingresos del Mes</p>
                  <h4 className="mb-0 fw-bold" style={{ color: COLORS.info }}>
                    {formatCurrency(kpis.finanzas.ingresosMesActual)}
                  </h4>
                </div>
              </div>
            </div>
            <div className="col-12 col-md-4">
              <div className="card border-0 shadow-sm" style={{ borderRadius: "15px" }}>
                <div className="card-body text-center py-4">
                  <div
                    className="rounded-circle d-flex align-items-center justify-content-center mx-auto mb-3"
                    style={{
                      width: "50px",
                      height: "50px",
                      background: `${COLORS.purple}20`,
                    }}
                  >
                    <FaMoneyBillWave style={{ fontSize: "24px", color: COLORS.purple }} />
                  </div>
                  <p className="text-muted mb-2 small fw-semibold">Intereses Generados</p>
                  <h4 className="mb-0 fw-bold" style={{ color: COLORS.purple }}>
                    {formatCurrency(kpis.finanzas.interesesGeneradosTotales)}
                  </h4>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ==================== SECCIÓN 2: RESUMEN EJECUTIVO ==================== */}
      {resumenEjecutivo && (
        <>
          <h5 className="mb-3 fw-bold d-flex align-items-center" style={{ color: "#2c3e50" }}>
            <FaChartLine className="me-2" style={{ color: "#667eea" }} />
            Crecimiento y Tendencias
          </h5>
          <div className="row g-3 mb-4">
            <div className="col-12 col-md-4">
              <div className="card border-0 shadow-sm" style={{ borderRadius: "15px" }}>
                <div className="card-body">
                  <div className="d-flex align-items-center mb-3">
                    <div
                      className="rounded-circle d-flex align-items-center justify-content-center me-3"
                      style={{
                        width: "40px",
                        height: "40px",
                        background: `${COLORS.primary}20`,
                      }}
                    >
                      <FaUsers style={{ fontSize: "18px", color: COLORS.primary }} />
                    </div>
                    <h6 className="fw-bold mb-0">Socios</h6>
                  </div>
                  <div className="d-flex justify-content-between align-items-center">
                    <div>
                      <p className="mb-0 small text-muted">Mes Actual</p>
                      <h4 className="mb-0 fw-bold">{resumenEjecutivo.crecimiento.socios.mesActual}</h4>
                    </div>
                    <div
                      className={`badge fs-6 px-3 py-2 ${
                        resumenEjecutivo.crecimiento.socios.porcentaje >= 0 ? 'bg-success' : 'bg-danger'
                      }`}
                      style={{ borderRadius: "10px" }}
                    >
                      {resumenEjecutivo.crecimiento.socios.porcentaje >= 0 ? (
                        <FaArrowUp className="me-1" />
                      ) : (
                        <FaArrowDown className="me-1" />
                      )}
                      {Math.abs(resumenEjecutivo.crecimiento.socios.porcentaje)}%
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="col-12 col-md-4">
              <div className="card border-0 shadow-sm" style={{ borderRadius: "15px" }}>
                <div className="card-body">
                  <div className="d-flex align-items-center mb-3">
                    <div
                      className="rounded-circle d-flex align-items-center justify-content-center me-3"
                      style={{
                        width: "40px",
                        height: "40px",
                        background: `${COLORS.success}20`,
                      }}
                    >
                      <FaPiggyBank style={{ fontSize: "18px", color: COLORS.success }} />
                    </div>
                    <h6 className="fw-bold mb-0">Aportaciones</h6>
                  </div>
                  <div className="d-flex justify-content-between align-items-center">
                    <div>
                      <p className="mb-0 small text-muted">Mes Actual</p>
                      <h5 className="mb-0 fw-bold" style={{ fontSize: "1.1rem" }}>
                        {formatCurrency(resumenEjecutivo.crecimiento.aportaciones.mesActual)}
                      </h5>
                    </div>
                    <div
                      className={`badge fs-6 px-3 py-2 ${
                        resumenEjecutivo.crecimiento.aportaciones.porcentaje >= 0
                          ? 'bg-success'
                          : 'bg-danger'
                      }`}
                      style={{ borderRadius: "10px" }}
                    >
                      {resumenEjecutivo.crecimiento.aportaciones.porcentaje >= 0 ? (
                        <FaArrowUp className="me-1" />
                      ) : (
                        <FaArrowDown className="me-1" />
                      )}
                      {Math.abs(resumenEjecutivo.crecimiento.aportaciones.porcentaje)}%
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="col-12 col-md-4">
              <div className="card border-0 shadow-sm" style={{ borderRadius: "15px" }}>
                <div className="card-body">
                  <div className="d-flex align-items-center mb-3">
                    <div
                      className="rounded-circle d-flex align-items-center justify-content-center me-3"
                      style={{
                        width: "40px",
                        height: "40px",
                        background: `${COLORS.warning}20`,
                      }}
                    >
                      <FaFileInvoiceDollar style={{ fontSize: "18px", color: COLORS.warning }} />
                    </div>
                    <h6 className="fw-bold mb-0">Préstamos</h6>
                  </div>
                  <div className="d-flex justify-content-between align-items-center">
                    <div>
                      <p className="mb-0 small text-muted">Mes Actual</p>
                      <h4 className="mb-0 fw-bold">
                        {resumenEjecutivo.crecimiento.prestamos.mesActual.cantidad}
                      </h4>
                    </div>
                    <div
                      className={`badge fs-6 px-3 py-2 ${
                        resumenEjecutivo.crecimiento.prestamos.porcentaje >= 0
                          ? 'bg-success'
                          : 'bg-danger'
                      }`}
                      style={{ borderRadius: "10px" }}
                    >
                      {resumenEjecutivo.crecimiento.prestamos.porcentaje >= 0 ? (
                        <FaArrowUp className="me-1" />
                      ) : (
                        <FaArrowDown className="me-1" />
                      )}
                      {Math.abs(resumenEjecutivo.crecimiento.prestamos.porcentaje)}%
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ==================== SECCIÓN 3: GRÁFICOS DE SERIES DE TIEMPO ==================== */}
      {seriesTiempo && (
        <>
          <h5 className="mb-3 fw-bold d-flex align-items-center" style={{ color: "#2c3e50" }}>
            <FaCalendarAlt className="me-2" style={{ color: "#667eea" }} />
            Tendencias por Mes
          </h5>
          <div className="row g-3 mb-4">
            {/* Aportaciones por mes */}
            <div className="col-12 col-lg-6">
              <div className="card border-0 shadow-sm" style={{ borderRadius: "15px" }}>
                <div
                  className="card-header text-white fw-bold"
                  style={{
                    background: "linear-gradient(135deg, #27ae60 0%, #229954 100%)",
                    borderRadius: "15px 15px 0 0",
                    padding: "16px 20px",
                  }}
                >
                  <FaPiggyBank className="me-2" />
                  Aportaciones Mensuales
                </div>
                <div className="card-body">
                  <ResponsiveContainer width="100%" height={250}>
                    <AreaChart data={seriesTiempo.aportaciones}>
                      <defs>
                        <linearGradient id="colorAportaciones" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={COLORS.success} stopOpacity={0.8} />
                          <stop offset="95%" stopColor={COLORS.success} stopOpacity={0.1} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                      <XAxis dataKey="mes" style={{ fontSize: "12px" }} stroke="#7f8c8d" />
                      <YAxis stroke="#7f8c8d" />
                      <Tooltip
                        formatter={(value) => formatCurrency(value)}
                        contentStyle={{
                          borderRadius: "10px",
                          border: "none",
                          boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="monto"
                        stroke={COLORS.success}
                        strokeWidth={3}
                        fillOpacity={1}
                        fill="url(#colorAportaciones)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Préstamos por mes */}
            <div className="col-12 col-lg-6">
              <div className="card border-0 shadow-sm" style={{ borderRadius: "15px" }}>
                <div
                  className="card-header text-white fw-bold"
                  style={{
                    background: "linear-gradient(135deg, #f39c12 0%, #e67e22 100%)",
                    borderRadius: "15px 15px 0 0",
                    padding: "16px 20px",
                  }}
                >
                  <FaFileInvoiceDollar className="me-2" />
                  Préstamos Desembolsados
                </div>
                <div className="card-body">
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={seriesTiempo.prestamos}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                      <XAxis dataKey="mes" style={{ fontSize: "12px" }} stroke="#7f8c8d" />
                      <YAxis stroke="#7f8c8d" />
                      <Tooltip
                        formatter={(value) => formatCurrency(value)}
                        contentStyle={{
                          borderRadius: "10px",
                          border: "none",
                          boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                        }}
                      />
                      <Bar dataKey="monto" fill={COLORS.warning} radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Pagos recibidos */}
            <div className="col-12 col-lg-6">
              <div className="card border-0 shadow-sm" style={{ borderRadius: "15px" }}>
                <div
                  className="card-header text-white fw-bold"
                  style={{
                    background: "linear-gradient(135deg, #3498db 0%, #2980b9 100%)",
                    borderRadius: "15px 15px 0 0",
                    padding: "16px 20px",
                  }}
                >
                  <FaMoneyBillWave className="me-2" />
                  Pagos Recibidos Mensuales
                </div>
                <div className="card-body">
                  <ResponsiveContainer width="100%" height={250}>
                    <AreaChart data={seriesTiempo.pagos}>
                      <defs>
                        <linearGradient id="colorPagos" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={COLORS.info} stopOpacity={0.8} />
                          <stop offset="95%" stopColor={COLORS.info} stopOpacity={0.1} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                      <XAxis dataKey="mes" style={{ fontSize: "12px" }} stroke="#7f8c8d" />
                      <YAxis stroke="#7f8c8d" />
                      <Tooltip
                        formatter={(value) => formatCurrency(value)}
                        contentStyle={{
                          borderRadius: "10px",
                          border: "none",
                          boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="monto"
                        stroke={COLORS.info}
                        strokeWidth={3}
                        fillOpacity={1}
                        fill="url(#colorPagos)"
                        name="Total Pagado"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Nuevos socios */}
            <div className="col-12 col-lg-6">
              <div className="card border-0 shadow-sm" style={{ borderRadius: "15px" }}>
                <div
                  className="card-header text-white fw-bold"
                  style={{
                    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                    borderRadius: "15px 15px 0 0",
                    padding: "16px 20px",
                  }}
                >
                  <FaUsers className="me-2" />
                  Nuevos Socios por Mes
                </div>
                <div className="card-body">
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={seriesTiempo.socios}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                      <XAxis dataKey="mes" style={{ fontSize: "12px" }} stroke="#7f8c8d" />
                      <YAxis allowDecimals={false} stroke="#7f8c8d" />
                      <Tooltip
                        contentStyle={{
                          borderRadius: "10px",
                          border: "none",
                          boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                        }}
                      />
                      <Bar dataKey="cantidad" fill={COLORS.primary} radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ==================== SECCIÓN 4: DISTRIBUCIONES ==================== */}
      {distribuciones && (
        <>
          <h5 className="mb-3 fw-bold d-flex align-items-center" style={{ color: "#2c3e50" }}>
            <FaChartPie className="me-2" style={{ color: "#667eea" }} />
            Distribuciones
          </h5>
          <div className="row g-3 mb-4">
            {/* Préstamos por estado */}
            <div className="col-12 col-md-6">
              <div className="card border-0 shadow-sm" style={{ borderRadius: "15px" }}>
                <div
                  className="card-header text-white fw-bold"
                  style={{
                    background: "linear-gradient(135deg, #9b59b6 0%, #8e44ad 100%)",
                    borderRadius: "15px 15px 0 0",
                    padding: "16px 20px",
                  }}
                >
                  <FaHandHoldingUsd className="me-2" />
                  Préstamos por Estado
                </div>
                <div className="card-body">
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={distribuciones.prestamos}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ estado, cantidad }) => `${estado}: ${cantidad}`}
                        outerRadius={80}
                        dataKey="cantidad"
                        nameKey="estado"
                      >
                        {distribuciones.prestamos.map((entry, index) => {
                          let color = COLORS.primary;
                          if (entry.estado === 'activo') color = COLORS.activo;
                          if (entry.estado === 'mora') color = COLORS.mora;
                          if (entry.estado === 'pagado') color = COLORS.pagado;
                          if (entry.estado === 'pendiente') color = COLORS.pendiente;
                          return <Cell key={`cell-${index}`} fill={color} />;
                        })}
                      </Pie>
                      <Tooltip formatter={(value) => `${value} préstamos`} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Actividades por tipo */}
            <div className="col-12 col-md-6">
              <div className="card border-0 shadow-sm" style={{ borderRadius: "15px" }}>
                <div
                  className="card-header text-white fw-bold"
                  style={{
                    background: "linear-gradient(135deg, #e67e22 0%, #d35400 100%)",
                    borderRadius: "15px 15px 0 0",
                    padding: "16px 20px",
                  }}
                >
                  <FaCalendarAlt className="me-2" />
                  Actividades por Tipo
                </div>
                <div className="card-body">
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={distribuciones.actividades}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ tipo, cantidad }) => `${tipo}: ${cantidad}`}
                        outerRadius={80}
                        dataKey="cantidad"
                        nameKey="tipo"
                      >
                        {distribuciones.actividades.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={CHART_COLORS[index % CHART_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Movimientos por tipo */}
            <div className="col-12 col-md-6">
              <div className="card border-0 shadow-sm" style={{ borderRadius: "15px" }}>
                <div
                  className="card-header text-white fw-bold"
                  style={{
                    background: "linear-gradient(135deg, #16a085 0%, #138d75 100%)",
                    borderRadius: "15px 15px 0 0",
                    padding: "16px 20px",
                  }}
                >
                  <FaMoneyBillWave className="me-2" />
                  Movimientos por Tipo (Últimos 6 meses)
                </div>
                <div className="card-body">
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={distribuciones.movimientos}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                      <XAxis dataKey="tipo" style={{ fontSize: "11px" }} stroke="#7f8c8d" />
                      <YAxis stroke="#7f8c8d" />
                      <Tooltip
                        contentStyle={{
                          borderRadius: "10px",
                          border: "none",
                          boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                        }}
                      />
                      <Bar dataKey="cantidad" fill={COLORS.teal} radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ==================== SECCIÓN 5: ALERTAS ==================== */}
      {alertas && (
        <>
          <h5 className="mb-3 fw-bold d-flex align-items-center" style={{ color: "#2c3e50" }}>
            <FaExclamationTriangle className="me-2" style={{ color: "#e74c3c" }} />
            Alertas y Notificaciones
          </h5>
          <div className="row g-3 mb-4">
            {/* Préstamos en Mora */}
            <div className="col-12 col-lg-6">
              <div
                className="card border-0 shadow-sm"
                style={{
                  borderRadius: "15px",
                  borderLeft: `6px solid ${COLORS.danger}`,
                }}
              >
                <div
                  className="card-header fw-bold d-flex align-items-center justify-content-between"
                  style={{
                    background: `${COLORS.danger}10`,
                    color: COLORS.danger,
                    borderBottom: "none",
                    padding: "16px 20px",
                  }}
                >
                  <span>
                    <FaExclamationTriangle className="me-2" />
                    Préstamos en Mora
                  </span>
                  <span
                    className="badge"
                    style={{
                      background: COLORS.danger,
                      color: "white",
                      padding: "6px 12px",
                      borderRadius: "20px",
                    }}
                  >
                    {alertas.mora.total}
                  </span>
                </div>
                <div className="card-body" style={{ maxHeight: "300px", overflowY: "auto" }}>
                  {alertas.mora.prestamos.length === 0 ? (
                    <div className="text-center py-4">
                      <div
                        className="rounded-circle mx-auto d-flex align-items-center justify-content-center mb-3"
                        style={{
                          width: "60px",
                          height: "60px",
                          background: `${COLORS.success}20`,
                        }}
                      >
                        <FaCheckCircle style={{ fontSize: "28px", color: COLORS.success }} />
                      </div>
                      <p className="text-muted mb-0">No hay préstamos en mora</p>
                    </div>
                  ) : (
                    <div className="list-group list-group-flush">
                      {alertas.mora.prestamos.slice(0, 5).map((p, idx) => (
                        <div
                          key={idx}
                          className="list-group-item border-0 px-0 py-3"
                          style={{
                            borderBottom: idx < 4 ? "1px solid #e9ecef" : "none",
                          }}
                        >
                          <div className="d-flex justify-content-between align-items-center">
                            <div className="d-flex align-items-center">
                              <div
                                className="rounded-circle d-flex align-items-center justify-content-center me-3 text-white fw-bold"
                                style={{
                                  width: "40px",
                                  height: "40px",
                                  background: "linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)",
                                  fontSize: "16px",
                                }}
                              >
                                {p.socio?.charAt(0).toUpperCase() || "?"}
                              </div>
                              <div>
                                <div className="fw-semibold" style={{ color: "#2c3e50" }}>
                                  {p.socio}
                                </div>
                                <small className="text-muted">
                                  Saldo: {formatCurrency(p.saldo_pendiente)}
                                </small>
                              </div>
                            </div>
                            <span
                              className="badge"
                              style={{
                                background: COLORS.danger,
                                color: "white",
                                padding: "8px 12px",
                                borderRadius: "10px",
                                fontWeight: "600",
                              }}
                            >
                              <FaClock className="me-1" />
                              {p.dias_sin_pagar} días
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Liquidaciones Pendientes */}
            <div className="col-12 col-lg-6">
              <div
                className="card border-0 shadow-sm"
                style={{
                  borderRadius: "15px",
                  borderLeft: `6px solid ${COLORS.warning}`,
                }}
              >
                <div
                  className="card-header fw-bold d-flex align-items-center justify-content-between"
                  style={{
                    background: `${COLORS.warning}10`,
                    color: COLORS.warning,
                    borderBottom: "none",
                    padding: "16px 20px",
                  }}
                >
                  <span>
                    <FaHandHoldingUsd className="me-2" />
                    Liquidaciones Pendientes
                  </span>
                  <span
                    className="badge"
                    style={{
                      background: COLORS.warning,
                      color: "white",
                      padding: "6px 12px",
                      borderRadius: "20px",
                    }}
                  >
                    {alertas.liquidacionesPendientes.total}
                  </span>
                </div>
                <div className="card-body" style={{ maxHeight: "300px", overflowY: "auto" }}>
                  {alertas.liquidacionesPendientes.liquidaciones.length === 0 ? (
                    <div className="text-center py-4">
                      <div
                        className="rounded-circle mx-auto d-flex align-items-center justify-content-center mb-3"
                        style={{
                          width: "60px",
                          height: "60px",
                          background: `${COLORS.success}20`,
                        }}
                      >
                        <FaCheckCircle style={{ fontSize: "28px", color: COLORS.success }} />
                      </div>
                      <p className="text-muted mb-0">No hay liquidaciones pendientes</p>
                    </div>
                  ) : (
                    <div className="list-group list-group-flush">
                      {alertas.liquidacionesPendientes.liquidaciones.slice(0, 5).map((l, idx) => (
                        <div
                          key={idx}
                          className="list-group-item border-0 px-0 py-3"
                          style={{
                            borderBottom: idx < 4 ? "1px solid #e9ecef" : "none",
                          }}
                        >
                          <div className="d-flex justify-content-between align-items-center">
                            <div className="d-flex align-items-center">
                              <div
                                className="rounded-circle d-flex align-items-center justify-content-center me-3 text-white fw-bold"
                                style={{
                                  width: "40px",
                                  height: "40px",
                                  background: "linear-gradient(135deg, #f39c12 0%, #e67e22 100%)",
                                  fontSize: "16px",
                                }}
                              >
                                {l.socio?.charAt(0).toUpperCase() || "?"}
                              </div>
                              <div>
                                <div className="fw-semibold" style={{ color: "#2c3e50" }}>
                                  {l.socio}
                                </div>
                                <small className="text-muted">{l.actividad}</small>
                              </div>
                            </div>
                            <span
                              className="badge"
                              style={{
                                background: COLORS.warning,
                                color: "white",
                                padding: "8px 12px",
                                borderRadius: "10px",
                                fontWeight: "600",
                              }}
                            >
                              {formatCurrency(l.monto)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ==================== SECCIÓN 6: RANKINGS ==================== */}
      {rankings && (
        <>
          <h5 className="mb-3 fw-bold d-flex align-items-center" style={{ color: "#2c3e50" }}>
            <FaTrophy className="me-2" style={{ color: "#f39c12" }} />
            Rankings
          </h5>
          <div className="row g-3 mb-4">
            {/* Top Aportadores */}
            <div className="col-12 col-md-6">
              <div className="card border-0 shadow-sm" style={{ borderRadius: "15px" }}>
                <div
                  className="card-header text-white fw-bold"
                  style={{
                    background: "linear-gradient(135deg, #27ae60 0%, #229954 100%)",
                    borderRadius: "15px 15px 0 0",
                    padding: "16px 20px",
                  }}
                >
                  <FaMedal className="me-2" />
                  Top 5 Aportadores
                </div>
                <div className="card-body p-0">
                  <div className="table-responsive">
                    <table className="table table-hover mb-0">
                      <thead style={{ background: "#f8f9fa" }}>
                        <tr>
                          <th className="py-3 ps-4" style={{ width: "60px" }}>
                            #
                          </th>
                          <th className="py-3">Socio</th>
                          <th className="py-3 text-end pe-4">Saldo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rankings.topAportadores.map((s, idx) => (
                          <tr key={idx}>
                            <td className="ps-4">
                              <div
                                className="rounded-circle d-flex align-items-center justify-content-center fw-bold"
                                style={{
                                  width: "32px",
                                  height: "32px",
                                  background:
                                    idx === 0
                                      ? "linear-gradient(135deg, #f39c12 0%, #e67e22 100%)"
                                      : idx === 1
                                      ? "linear-gradient(135deg, #95a5a6 0%, #7f8c8d 100%)"
                                      : idx === 2
                                      ? "linear-gradient(135deg, #e67e22 0%, #d35400 100%)"
                                      : `${COLORS.success}20`,
                                  color: idx < 3 ? "white" : COLORS.success,
                                  fontSize: "14px",
                                }}
                              >
                                {idx + 1}
                              </div>
                            </td>
                            <td>
                              <div className="d-flex align-items-center">
                                <div
                                  className="rounded-circle d-flex align-items-center justify-content-center me-3 text-white fw-bold"
                                  style={{
                                    width: "36px",
                                    height: "36px",
                                    background: "linear-gradient(135deg, #27ae60 0%, #229954 100%)",
                                    fontSize: "14px",
                                  }}
                                >
                                  {s.nombre?.charAt(0).toUpperCase() || "?"}
                                </div>
                                <span className="fw-semibold">{s.nombre}</span>
                              </div>
                            </td>
                            <td className="text-end pe-4 fw-bold" style={{ color: COLORS.success }}>
                              {formatCurrency(s.saldo)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>

            {/* Top Deudores */}
            <div className="col-12 col-md-6">
              <div className="card border-0 shadow-sm" style={{ borderRadius: "15px" }}>
                <div
                  className="card-header text-white fw-bold"
                  style={{
                    background: "linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)",
                    borderRadius: "15px 15px 0 0",
                    padding: "16px 20px",
                  }}
                >
                  <FaExclamationTriangle className="me-2" />
                  Top 5 Mayores Deudores
                </div>
                <div className="card-body p-0">
                  <div className="table-responsive">
                    <table className="table table-hover mb-0">
                      <thead style={{ background: "#f8f9fa" }}>
                        <tr>
                          <th className="py-3 ps-4" style={{ width: "60px" }}>
                            #
                          </th>
                          <th className="py-3">Socio</th>
                          <th className="py-3 text-end pe-4">Saldo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rankings.topDeudores.map((s, idx) => (
                          <tr key={idx}>
                            <td className="ps-4">
                              <div
                                className="rounded-circle d-flex align-items-center justify-content-center fw-bold"
                                style={{
                                  width: "32px",
                                  height: "32px",
                                  background: `${COLORS.danger}20`,
                                  color: COLORS.danger,
                                  fontSize: "14px",
                                }}
                              >
                                {idx + 1}
                              </div>
                            </td>
                            <td>
                              <div className="d-flex align-items-center">
                                <div
                                  className="rounded-circle d-flex align-items-center justify-content-center me-3 text-white fw-bold"
                                  style={{
                                    width: "36px",
                                    height: "36px",
                                    background: "linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)",
                                    fontSize: "14px",
                                  }}
                                >
                                  {s.nombre?.charAt(0).toUpperCase() || "?"}
                                </div>
                                <div>
                                  <span className="fw-semibold">{s.nombre}</span>
                                  {s.estado === 'mora' && (
                                    <span
                                      className="badge ms-2"
                                      style={{
                                        background: COLORS.danger,
                                        color: "white",
                                        fontSize: "10px",
                                        padding: "4px 8px",
                                      }}
                                    >
                                      MORA
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="text-end pe-4 fw-bold" style={{ color: COLORS.danger }}>
                              {formatCurrency(s.saldo_pendiente)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
