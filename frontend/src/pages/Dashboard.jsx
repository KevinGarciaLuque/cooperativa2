import { useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
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
} from "recharts";

const COOP_COLORS = [
  "#434d57",
  "#a8cd3a",
  "#ffc107",
  "#17a2b8",
  "#ff6384",
  "#fd7e14",
  "#6f42c1",
];
const BG = "#f9f7ef";
const PRIMARY = "#434d57";
const SUCCESS = "#a8cd3a";

export default function Dashboard() {
  const { token } = useAuth();
  const [stats, setStats] = useState({
    socios: 0,
    cuentas: 0,
    prestamos: 0,
    aportaciones: 0,
  });
  const [movimientos, setMovimientos] = useState([]);
  const [prestamosStats, setPrestamosStats] = useState([]);
  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [socios, cuentas, prestamos, aportaciones, movimientosRes] =
          await Promise.all([
            axios.get(`${API_URL}/usuarios`, {
              headers: { Authorization: `Bearer ${token}` },
            }),
            axios.get(`${API_URL}/cuentas`, {
              headers: { Authorization: `Bearer ${token}` },
            }),
            axios.get(`${API_URL}/prestamos`, {
              headers: { Authorization: `Bearer ${token}` },
            }),
            axios.get(`${API_URL}/aportaciones`, {
              headers: { Authorization: `Bearer ${token}` },
            }),
            axios.get(`${API_URL}/movimientos?limit=10`, {
              headers: { Authorization: `Bearer ${token}` },
            }),
          ]);
        setStats({
          socios: socios.data.length,
          cuentas: cuentas.data.length,
          prestamos: prestamos.data.length,
          aportaciones: aportaciones.data.length,
        });
        setMovimientos(movimientosRes.data.slice(0, 10));

        // Gráfico de préstamos por estado
        const prests = prestamos.data.reduce((acc, p) => {
          acc[p.estado] = (acc[p.estado] || 0) + 1;
          return acc;
        }, {});
        setPrestamosStats(
          Object.entries(prests).map(([k, v]) => ({ name: k, value: v }))
        );
      } catch {
        setStats({
          socios: "-",
          cuentas: "-",
          prestamos: "-",
          aportaciones: "-",
        });
      }
    };
    fetchData();
  }, [token]);

  // Responsive styles para cards
  const cardStyle = (borderColor, fontColor) => ({
    border: `2px solid ${borderColor}`,
    borderRadius: 15,
    minHeight: 110,
    background: "#fff",
    boxShadow: "0 2px 16px 0 rgba(67,77,87,0.06)",
    transition: "transform .13s, box-shadow .13s",
    color: fontColor,
  });

  return (
    <div
      className="container-fluid px-2 px-md-4 py-4"
      style={{ background: BG, minHeight: "100vh" }}
    >
      <h2
        className="mb-4"
        style={{ color: PRIMARY, fontWeight: 700, letterSpacing: 0.5 }}
      >
        Dashboard
      </h2>
      <div className="row g-3 g-md-4 mb-4">
        {/* Card 1 */}
        <div className="col-6 col-md-3">
          <div
            className="text-center py-3 card-dash"
            style={cardStyle(PRIMARY, PRIMARY)}
            tabIndex={0}
          >
            <div className="h1 mb-1 fw-bold">{stats.socios}</div>
            <div className="small text-secondary">Socios</div>
          </div>
        </div>
        {/* Card 2 */}
        <div className="col-6 col-md-3">
          <div
            className="text-center py-3 card-dash"
            style={cardStyle(SUCCESS, SUCCESS)}
            tabIndex={0}
          >
            <div className="h1 mb-1 fw-bold">{stats.cuentas}</div>
            <div className="small text-secondary">Cuentas</div>
          </div>
        </div>
        {/* Card 3 */}
        <div className="col-6 col-md-3">
          <div
            className="text-center py-3 card-dash"
            style={cardStyle("#ffc107", "#ffc107")}
            tabIndex={0}
          >
            <div className="h1 mb-1 fw-bold">{stats.prestamos}</div>
            <div className="small text-secondary">Préstamos</div>
          </div>
        </div>
        {/* Card 4 */}
        <div className="col-6 col-md-3">
          <div
            className="text-center py-3 card-dash"
            style={cardStyle("#17a2b8", "#17a2b8")}
            tabIndex={0}
          >
            <div className="h1 mb-1 fw-bold">{stats.aportaciones}</div>
            <div className="small text-secondary">Aportaciones</div>
          </div>
        </div>
      </div>

      <div className="row gy-4 mb-4">
        {/* Gráfico de Préstamos por estado */}
        <div className="col-12 col-md-6">
          <div className="card shadow-sm h-100">
            <div
              className="card-header bg-white fw-bold"
              style={{ color: PRIMARY, fontSize: "1.07rem" }}
            >
              Préstamos por Estado
            </div>
            <div className="card-body">
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={prestamosStats}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) =>
                      `${name} ${(percent * 100).toFixed(0)}%`
                    }
                    outerRadius={90}
                    dataKey="value"
                  >
                    {prestamosStats.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COOP_COLORS[index % COOP_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Gráfico de movimientos por tipo */}
        <div className="col-12 col-md-6">
          <div className="card shadow-sm h-100">
            <div
              className="card-header bg-white fw-bold"
              style={{ color: PRIMARY, fontSize: "1.07rem" }}
            >
              Movimientos recientes por tipo
            </div>
            <div className="card-body">
              <ResponsiveContainer width="100%" height={250}>
                <BarChart
                  data={Object.values(
                    movimientos.reduce((acc, m) => {
                      acc[m.tipo] = acc[m.tipo] || {
                        tipo: m.tipo,
                        cantidad: 0,
                      };
                      acc[m.tipo].cantidad++;
                      return acc;
                    }, {})
                  )}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="tipo" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="cantidad" fill={PRIMARY} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Tabla de movimientos recientes */}
      <div className="card shadow-sm mb-4">
        <div
          className="card-header bg-white fw-bold"
          style={{ color: PRIMARY, fontSize: "1.07rem" }}
        >
          Últimos Movimientos
        </div>
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-striped mb-0">
              <thead style={{ background: "#f4f5f7" }}>
                <tr>
                  <th>Fecha</th>
                  <th>Socio</th>
                  <th>Cuenta</th>
                  <th>Tipo</th>
                  <th>Monto</th>
                  <th>Descripción</th>
                </tr>
              </thead>
              <tbody>
                {movimientos.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-3">
                      Sin movimientos recientes.
                    </td>
                  </tr>
                ) : (
                  movimientos.map((m) => (
                    <tr key={m.id_movimiento}>
                      <td>{new Date(m.fecha).toLocaleString()}</td>
                      <td>{m.nombre_completo || "-"}</td>
                      <td>{m.tipo_cuenta || "-"}</td>
                      <td>{m.tipo}</td>
                      <td>L. {parseFloat(m.monto).toFixed(2)}</td>
                      <td>{m.descripcion}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Tarjetas hover (efecto solo aquí para no usar CSS global) */}
      <style>
        {`
          .card-dash:hover, .card-dash:focus {
            box-shadow: 0 6px 30px #a8cd3a23, 0 1.5px 5px #434d5720;
            transform: translateY(-2px) scale(1.025);
            background: #f6fef8;
            cursor: pointer;
          }
        `}
      </style>
    </div>
  );
}
