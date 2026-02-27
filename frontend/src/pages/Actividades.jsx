import { useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { useAlerta } from "../context/AlertaContext";
import {
  FaCalendarCheck,
  FaPlus,
  FaSearch,
  FaCalendarAlt,
  FaMoneyBillWave,
  FaEdit,
  FaTrash,
  FaChartLine,
  FaTrophy,
  FaTicketAlt,
  FaShoppingCart,
  FaGift,
  FaUsers,
  FaCheckCircle,
  FaFileAlt,
  FaSpinner,
} from "react-icons/fa";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

export default function Actividades() {
  const { token } = useAuth();
  const { mostrarAlerta } = useAlerta();
  const [actividades, setActividades] = useState([]);
  const [editAct, setEditAct] = useState(null);
  const [form, setForm] = useState({
    nombre: "",
    tipo: "",
    fecha: new Date().toISOString().split("T")[0],
    monto: "",
    descripcion: "",
  });
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState("");
  const [tipoFiltro, setTipoFiltro] = useState("todos");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [showModal, setShowModal] = useState(false);

  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

  // Cargar actividades
  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/actividades`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setActividades(res.data.data || res.data || []);
    } catch (err) {
      mostrarAlerta("No se pudieron obtener las actividades.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line
  }, []);

  const handleInput = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  // Crear o editar actividad
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editAct) {
        await axios.put(
          `${API_URL}/actividades/${editAct.id_actividad}`,
          form,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        mostrarAlerta("Actividad actualizada correctamente.", "success");
      } else {
        await axios.post(`${API_URL}/actividades`, form, {
          headers: { Authorization: `Bearer ${token}` },
        });
        mostrarAlerta("Actividad registrada correctamente.", "success");
      }
      setForm({
        nombre: "",
        tipo: "",
        fecha: new Date().toISOString().split("T")[0],
        monto: "",
        descripcion: "",
      });
      setEditAct(null);
      setShowModal(false);
      fetchData();
    } catch (err) {
      mostrarAlerta(
        err.response?.data?.message || "Error al guardar la actividad.",
        "error"
      );
    }
  };

  const handleEdit = (act) => {
    setEditAct(act);
    setForm({
      nombre: act.nombre,
      tipo: act.tipo,
      fecha: act.fecha ? act.fecha.substring(0, 10) : new Date().toISOString().split("T")[0],
      monto: act.monto,
      descripcion: act.descripcion || "",
    });
    setShowModal(true);
  };

  const openCrearModal = () => {
    setEditAct(null);
    setForm({
      nombre: "",
      tipo: "",
      fecha: new Date().toISOString().split("T")[0],
      monto: "",
      descripcion: "",
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("¿Seguro que deseas eliminar esta actividad?")) return;
    try {
      await axios.delete(`${API_URL}/actividades/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      mostrarAlerta("Actividad eliminada correctamente.", "success");
      fetchData();
    } catch (err) {
      mostrarAlerta("Error al eliminar la actividad.", "error");
    }
  };

  // Filtrar actividades
  const actividadesFiltradas = actividades.filter((a) => {
    const coincideNombre = a.nombre?.toLowerCase().includes(filtro.toLowerCase());
    const coincideTipo = tipoFiltro === "todos" || a.tipo?.toLowerCase() === tipoFiltro.toLowerCase();
    const fechaAct = a.fecha ? a.fecha.substring(0, 10) : "";
    const coincideFechaInicio = fechaInicio ? fechaAct >= fechaInicio : true;
    const coincideFechaFin = fechaFin ? fechaAct <= fechaFin : true;

    return coincideNombre && coincideTipo && coincideFechaInicio && coincideFechaFin;
  });

  // Estadísticas
  const totalActividades = actividades.length;
  const ingresoTotal = actividades.reduce(
    (sum, a) => sum + parseFloat(a.monto || 0),
    0
  );
  const ingresoPromedio = totalActividades > 0 ? ingresoTotal / totalActividades : 0;

  // Actividades este mes
  const hoy = new Date();
  const mesActual = hoy.getMonth();
  const añoActual = hoy.getFullYear();
  const actividadesEsteMes = actividades.filter((a) => {
    if (!a.fecha) return false;
    const fecha = new Date(a.fecha);
    return fecha.getMonth() === mesActual && fecha.getFullYear() === añoActual;
  });
  const ingresoEsteMes = actividadesEsteMes.reduce(
    (sum, a) => sum + parseFloat(a.monto || 0),
    0
  );

  // Tipos únicos de actividades
  const tiposUnicos = [...new Set(actividades.map((a) => a.tipo))].filter(Boolean);

  // Datos para gráfico de barras (últimos 6 meses)
  const obtenerDatosMensuales = () => {
    const datos = [];
    for (let i = 5; i >= 0; i--) {
      const fecha = new Date();
      fecha.setMonth(fecha.getMonth() - i);
      const mes = fecha.toLocaleString("es", { month: "short" });
      const mesNum = fecha.getMonth();
      const año = fecha.getFullYear();

      const actsMes = actividades.filter((a) => {
        if (!a.fecha) return false;
        const f = new Date(a.fecha);
        return f.getMonth() === mesNum && f.getFullYear() === año;
      });

      const ingreso = actsMes.reduce(
        (sum, a) => sum + parseFloat(a.monto || 0),
        0
      );

      datos.push({
        mes: mes.charAt(0).toUpperCase() + mes.slice(1),
        ingreso: parseFloat(ingreso.toFixed(2)),
        cantidad: actsMes.length,
      });
    }
    return datos;
  };

  // Datos para gráfico de torta (por tipo)
  const obtenerDatosPorTipo = () => {
    const tipos = {};
    actividades.forEach((a) => {
      const tipo = a.tipo || "Sin especificar";
      if (!tipos[tipo]) {
        tipos[tipo] = { nombre: tipo, ingreso: 0, cantidad: 0 };
      }
      tipos[tipo].ingreso += parseFloat(a.monto || 0);
      tipos[tipo].cantidad += 1;
    });
    return Object.values(tipos);
  };

  const datosMensuales = obtenerDatosMensuales();
  const datosPorTipo = obtenerDatosPorTipo();

  const COLORS_TIPO = {
    rifas: "#e67e22",
    ventas: "#3498db",
    intereses_ganados: "#9b59b6",
    donaciones: "#27ae60",
    alquileres: "#e74c3c",
    otros_ingresos: "#95a5a6",
  };

  const getColorForTipo = (tipo) => {
    const tipoLower = tipo?.toLowerCase() || "otros_ingresos";
    return COLORS_TIPO[tipoLower] || COLORS_TIPO.otros_ingresos;
  };

  return (
    <div
      className="container-fluid px-4 py-4"
      style={{ background: "#f8f9fa", minHeight: "100vh" }}
    >
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="mb-1 fw-bold" style={{ color: "#2c3e50" }}>
            <FaCalendarCheck className="me-2" style={{ color: "#e67e22" }} />
            Gestión de Actividades
          </h2>
          <p className="text-muted mb-0">
            Registro de eventos, rifas y actividades generadoras de ingresos
          </p>
        </div>
        <button
          className="btn btn-lg shadow-sm"
          onClick={openCrearModal}
          style={{
            background: "linear-gradient(135deg, #e67e22 0%, #d35400 100%)",
            color: "white",
            border: "none",
            borderRadius: "10px",
            fontWeight: "600",
          }}
        >
          <FaPlus className="me-2" />
          Nueva Actividad
        </button>
      </div>

      {/* Cards de Estadísticas */}
      <div className="row g-3 mb-4">
        {/* Total Actividades */}
        <div className="col-12 col-sm-6 col-lg-3">
          <div
            className="card border-0 shadow-sm h-100"
            style={{
              borderRadius: "15px",
              borderLeft: "4px solid #e67e22",
            }}
          >
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <p className="text-muted mb-1 small">Total Actividades</p>
                  <h3 className="mb-0 fw-bold" style={{ color: "#2c3e50" }}>
                    {totalActividades}
                  </h3>
                  <p className="mb-0 small text-muted mt-1">
                    Eventos registrados
                  </p>
                </div>
                <div
                  className="rounded-circle d-flex align-items-center justify-content-center"
                  style={{
                    width: "50px",
                    height: "50px",
                    background: "rgba(230, 126, 34, 0.1)",
                  }}
                >
                  <FaCalendarCheck style={{ fontSize: "24px", color: "#e67e22" }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Ingreso Total */}
        <div className="col-12 col-sm-6 col-lg-3">
          <div
            className="card border-0 shadow-sm h-100"
            style={{
              borderRadius: "15px",
              borderLeft: "4px solid #27ae60",
            }}
          >
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <p className="text-muted mb-1 small">Ingreso Total</p>
                  <h3 className="mb-0 fw-bold" style={{ color: "#27ae60" }}>
                    L. {ingresoTotal.toFixed(2)}
                  </h3>
                  <p className="mb-0 small text-muted mt-1">
                    Todas las actividades
                  </p>
                </div>
                <div
                  className="rounded-circle d-flex align-items-center justify-content-center"
                  style={{
                    width: "50px",
                    height: "50px",
                    background: "rgba(39, 174, 96, 0.1)",
                  }}
                >
                  <FaMoneyBillWave style={{ fontSize: "24px", color: "#27ae60" }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Este Mes */}
        <div className="col-12 col-sm-6 col-lg-3">
          <div
            className="card border-0 shadow-sm h-100"
            style={{
              borderRadius: "15px",
              borderLeft: "4px solid #9b59b6",
            }}
          >
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <p className="text-muted mb-1 small">Este Mes</p>
                  <h3 className="mb-0 fw-bold" style={{ color: "#9b59b6" }}>
                    L. {ingresoEsteMes.toFixed(2)}
                  </h3>
                  <p className="mb-0 small text-muted mt-1">
                    {actividadesEsteMes.length} actividades
                  </p>
                </div>
                <div
                  className="rounded-circle d-flex align-items-center justify-content-center"
                  style={{
                    width: "50px",
                    height: "50px",
                    background: "rgba(155, 89, 182, 0.1)",
                  }}
                >
                  <FaCalendarAlt style={{ fontSize: "24px", color: "#9b59b6" }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Promedio por Actividad */}
        <div className="col-12 col-sm-6 col-lg-3">
          <div
            className="card border-0 shadow-sm h-100"
            style={{
              borderRadius: "15px",
              borderLeft: "4px solid #3498db",
            }}
          >
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <p className="text-muted mb-1 small">Promedio</p>
                  <h3 className="mb-0 fw-bold" style={{ color: "#3498db" }}>
                    L. {ingresoPromedio.toFixed(2)}
                  </h3>
                  <p className="mb-0 small text-muted mt-1">
                    Por actividad
                  </p>
                </div>
                <div
                  className="rounded-circle d-flex align-items-center justify-content-center"
                  style={{
                    width: "50px",
                    height: "50px",
                    background: "rgba(52, 152, 219, 0.1)",
                  }}
                >
                  <FaChartLine style={{ fontSize: "24px", color: "#3498db" }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Gráficos */}
      <div className="row g-4 mb-4">
        {/* Gráfico de Barras - Ingresos Mensuales */}
        <div className="col-lg-8">
          <div
            className="card border-0 shadow-sm"
            style={{ borderRadius: "15px" }}
          >
            <div className="card-body">
              <h6 className="fw-bold mb-3" style={{ color: "#2c3e50" }}>
                <FaChartLine className="me-2" style={{ color: "#e67e22" }} />
                Ingresos por Mes (Últimos 6 Meses)
              </h6>
              {datosMensuales.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={datosMensuales}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                    <XAxis dataKey="mes" stroke="#7f8c8d" />
                    <YAxis stroke="#7f8c8d" />
                    <Tooltip
                      contentStyle={{
                        borderRadius: "10px",
                        border: "none",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                      }}
                    />
                    <Legend />
                    <Bar
                      dataKey="ingreso"
                      fill="#e67e22"
                      name="Ingreso (L.)"
                      radius={[8, 8, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center py-5 text-muted">
                  No hay datos para mostrar
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Gráfico de Torta - Por Tipo */}
        <div className="col-lg-4">
          <div
            className="card border-0 shadow-sm h-100"
            style={{ borderRadius: "15px" }}
          >
            <div className="card-body">
              <h6 className="fw-bold mb-3" style={{ color: "#2c3e50" }}>
                <FaTrophy className="me-2" style={{ color: "#e67e22" }} />
                Distribución por Tipo
              </h6>
              {datosPorTipo.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={datosPorTipo}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ nombre, percent }) =>
                          `${nombre}: ${(percent * 100).toFixed(0)}%`
                        }
                        outerRadius={70}
                        fill="#8884d8"
                        dataKey="ingreso"
                      >
                        {datosPorTipo.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={getColorForTipo(entry.nombre)}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value) => `L.${value.toFixed(2)}`}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="mt-3">
                    {datosPorTipo.map((tipo, idx) => (
                      <div
                        key={idx}
                        className="d-flex justify-content-between align-items-center mb-2 p-2"
                        style={{
                          background: "rgba(0,0,0,0.02)",
                          borderRadius: "8px",
                        }}
                      >
                        <div className="d-flex align-items-center">
                          <div
                            style={{
                              width: "12px",
                              height: "12px",
                              borderRadius: "50%",
                              background: getColorForTipo(tipo.nombre),
                              marginRight: "8px",
                            }}
                          />
                          <span className="small fw-semibold">{tipo.nombre}</span>
                        </div>
                        <span className="small text-muted">
                          {tipo.cantidad} ({((tipo.ingreso / ingresoTotal) * 100).toFixed(0)}%)
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-center py-5 text-muted">
                  No hay datos para mostrar
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div
        className="card border-0 shadow-sm mb-4"
        style={{ borderRadius: "15px" }}
      >
        <div className="card-body">
          <div className="row g-3">
            {/* Búsqueda */}
            <div className="col-md-4">
              <label className="form-label fw-semibold small text-muted">
                Buscar por Nombre
              </label>
              <div className="input-group">
                <span
                  className="input-group-text bg-white border-end-0"
                  style={{ borderRadius: "10px 0 0 10px" }}
                >
                  <FaSearch style={{ color: "#95a5a6" }} />
                </span>
                <input
                  type="text"
                  className="form-control border-start-0"
                  placeholder="Buscar actividad..."
                  value={filtro}
                  onChange={(e) => setFiltro(e.target.value)}
                  style={{
                    borderRadius: "0 10px 10px 0",
                    boxShadow: "none",
                  }}
                />
              </div>
            </div>

            {/* Filtro por Tipo */}
            <div className="col-md-3">
              <label className="form-label fw-semibold small text-muted">
                Tipo de Actividad
              </label>
              <select
                className="form-select"
                value={tipoFiltro}
                onChange={(e) => setTipoFiltro(e.target.value)}
                style={{ borderRadius: "10px" }}
              >
                <option value="todos">Todos los tipos</option>
                {tiposUnicos.map((tipo, idx) => (
                  <option key={idx} value={tipo}>
                    {tipo}
                  </option>
                ))}
              </select>
            </div>

            {/* Rango de Fechas */}
            <div className="col-md-5">
              <label className="form-label fw-semibold small text-muted">
                <FaCalendarAlt className="me-2" />
                Rango de Fechas
              </label>
              <div className="row g-2">
                <div className="col-6">
                  <input
                    type="date"
                    className="form-control"
                    value={fechaInicio}
                    onChange={(e) => setFechaInicio(e.target.value)}
                    style={{ borderRadius: "10px" }}
                  />
                </div>
                <div className="col-6">
                  <input
                    type="date"
                    className="form-control"
                    value={fechaFin}
                    onChange={(e) => setFechaFin(e.target.value)}
                    style={{ borderRadius: "10px" }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabla de Actividades */}
      {loading ? (
        <div className="text-center py-5">
          <div
            className="spinner-border text-primary"
            role="status"
            style={{ width: "3rem", height: "3rem" }}
          >
            <span className="visually-hidden">Cargando...</span>
          </div>
          <p className="mt-3 text-muted">Cargando actividades...</p>
        </div>
      ) : (
        <TablaActividades
          actividades={actividadesFiltradas}
          onEdit={handleEdit}
          onDelete={handleDelete}
          getColorForTipo={getColorForTipo}
        />
      )}

      {/* Modal */}
      {showModal && (
        <ModalActividad
          show={showModal}
          editAct={editAct}
          form={form}
          onClose={() => setShowModal(false)}
          onSubmit={handleSubmit}
          handleInput={handleInput}
        />
      )}
    </div>
  );
}

// ==================== COMPONENTE TABLA ACTIVIDADES ====================
function TablaActividades({ actividades, onEdit, onDelete, getColorForTipo }) {
  if (!actividades || actividades.length === 0) {
    return (
      <div
        className="card border-0 shadow-sm"
        style={{ borderRadius: "15px" }}
      >
        <div className="card-body text-center py-5">
          <div
            className="rounded-circle mx-auto d-flex align-items-center justify-content-center mb-3"
            style={{
              width: "80px",
              height: "80px",
              background: "rgba(230, 126, 34, 0.1)",
            }}
          >
            <FaCalendarCheck style={{ fontSize: "36px", color: "#e67e22" }} />
          </div>
          <h5 className="text-muted fw-semibold">
            No hay actividades registradas
          </h5>
          <p className="text-muted mb-0">
            Registra una nueva actividad para comenzar
          </p>
        </div>
      </div>
    );
  }

  const getTipoIcon = (tipo) => {
    const tipoLower = tipo?.toLowerCase() || "";
    if (tipoLower === "rifas") return FaTicketAlt;
    if (tipoLower === "ventas") return FaShoppingCart;
    if (tipoLower === "donaciones") return FaGift;
    if (tipoLower === "intereses_ganados") return FaChartLine;
    if (tipoLower === "alquileres") return FaUsers;
    return FaCalendarCheck;
  };

  return (
    <div className="card border-0 shadow-sm" style={{ borderRadius: "15px" }}>
      {/* Header */}
      <div
        className="text-white p-3"
        style={{
          background: "linear-gradient(135deg, #e67e22 0%, #d35400 100%)",
          borderRadius: "15px 15px 0 0",
        }}
      >
        <div className="row g-2 align-items-center fw-semibold">
          <div className="col-auto" style={{ width: "50px" }}>
            #
          </div>
          <div className="col-3">Nombre / Tipo</div>
          <div className="col-2 text-center">Fecha</div>
          <div className="col-2 text-center">Ingreso</div>
          <div className="col-2">Descripción</div>
          <div className="col text-center">Acciones</div>
        </div>
      </div>

      {/* Body */}
      <div className="card-body p-0">
        <div style={{ maxHeight: "600px", overflowY: "auto" }}>
          {actividades.map((actividad, index) => {
            const TipoIcon = getTipoIcon(actividad.tipo);
            const fecha = actividad.fecha
              ? actividad.fecha.substring(0, 10)
              : "-";
            const color = getColorForTipo(actividad.tipo);

            return (
              <div
                key={actividad.id_actividad}
                className="border-bottom"
                style={{
                  transition: "all 0.3s ease",
                  background: "white",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#f8f9fa";
                  e.currentTarget.style.transform = "scale(1.01)";
                  e.currentTarget.style.boxShadow =
                    "0 4px 12px rgba(0,0,0,0.08)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "white";
                  e.currentTarget.style.transform = "scale(1)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                <div className="row g-2 align-items-center p-3">
                  {/* Número */}
                  <div className="col-auto" style={{ width: "50px" }}>
                    <div
                      className="rounded-circle d-flex align-items-center justify-content-center fw-bold"
                      style={{
                        width: "32px",
                        height: "32px",
                        background: "rgba(230, 126, 34, 0.1)",
                        color: "#e67e22",
                        fontSize: "14px",
                      }}
                    >
                      {index + 1}
                    </div>
                  </div>

                  {/* Nombre / Tipo */}
                  <div className="col-3">
                    <div
                      className="fw-semibold mb-1"
                      style={{ color: "#2c3e50", fontSize: "14px" }}
                    >
                      {actividad.nombre}
                    </div>
                    <span
                      className="badge d-inline-flex align-items-center px-2 py-1"
                      style={{
                        background: `${color}20`,
                        color: color,
                        fontWeight: "600",
                        fontSize: "11px",
                        border: `1px solid ${color}`,
                        borderRadius: "8px",
                      }}
                    >
                      <TipoIcon className="me-1" />
                      {actividad.tipo}
                    </span>
                  </div>

                  {/* Fecha */}
                  <div className="col-2 text-center">
                    <div
                      className="badge px-3 py-2 d-inline-flex align-items-center"
                      style={{
                        background: "rgba(52, 152, 219, 0.1)",
                        color: "#3498db",
                        fontWeight: "600",
                        fontSize: "13px",
                        border: "2px solid #3498db",
                        borderRadius: "10px",
                      }}
                    >
                      <FaCalendarAlt className="me-2" />
                      {fecha}
                    </div>
                  </div>

                  {/* Ingreso */}
                  <div className="col-2 text-center">
                    <div className="d-flex align-items-center justify-content-center">
                      <FaMoneyBillWave
                        className="me-2"
                        style={{ color: "#27ae60", fontSize: "20px" }}
                      />
                      <div
                        className="fw-bold"
                        style={{ fontSize: "18px", color: "#27ae60" }}
                      >
                        L. {parseFloat(actividad.monto || 0).toFixed(2)}
                      </div>
                    </div>
                  </div>

                  {/* Descripción */}
                  <div className="col-2">
                    {actividad.descripcion ? (
                      <div
                        className="small text-muted"
                        style={{
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                        title={actividad.descripcion}
                      >
                        <FaFileAlt className="me-1" />
                        {actividad.descripcion}
                      </div>
                    ) : (
                      <span className="small text-muted">Sin descripción</span>
                    )}
                  </div>

                  {/* Acciones */}
                  <div className="col text-center">
                    <div className="btn-group" role="group">
                      <button
                        className="btn btn-sm"
                        onClick={() => onEdit(actividad)}
                        style={{
                          background: "rgba(52, 152, 219, 0.1)",
                          color: "#3498db",
                          border: "1px solid #3498db",
                          borderRadius: "8px 0 0 8px",
                          fontWeight: "600",
                          transition: "all 0.3s ease",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "#3498db";
                          e.currentTarget.style.color = "white";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background =
                            "rgba(52, 152, 219, 0.1)";
                          e.currentTarget.style.color = "#3498db";
                        }}
                        title="Editar"
                      >
                        <FaEdit />
                      </button>
                      <button
                        className="btn btn-sm"
                        onClick={() => onDelete(actividad.id_actividad)}
                        style={{
                          background: "rgba(231, 76, 60, 0.1)",
                          color: "#e74c3c",
                          border: "1px solid #e74c3c",
                          borderLeft: "none",
                          borderRadius: "0 8px 8px 0",
                          fontWeight: "600",
                          transition: "all 0.3s ease",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "#e74c3c";
                          e.currentTarget.style.color = "white";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background =
                            "rgba(231, 76, 60, 0.1)";
                          e.currentTarget.style.color = "#e74c3c";
                        }}
                        title="Eliminar"
                      >
                        <FaTrash />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div
        className="card-footer bg-light border-top-0 text-center py-3"
        style={{ borderRadius: "0 0 15px 15px" }}
      >
        <p className="text-muted mb-0 small fw-semibold">
          <FaCheckCircle className="me-2 text-success" />
          Total de actividades:{" "}
          <span className="text-primary fw-bold">{actividades.length}</span>
          {" | "}
          Ingreso total: <span className="text-success fw-bold">
            L.{" "}
            {actividades
              .reduce((sum, a) => sum + parseFloat(a.monto || 0), 0)
              .toFixed(2)}
          </span>
        </p>
      </div>
    </div>
  );
}

// ==================== COMPONENTE MODAL ACTIVIDAD ====================
function ModalActividad({
  show,
  editAct,
  form,
  onClose,
  onSubmit,
  handleInput,
}) {
  if (!show) return null;

  return (
    <div
      className="modal show d-block"
      tabIndex="-1"
      style={{
        background: "rgba(0, 0, 0, 0.6)",
        backdropFilter: "blur(4px)",
        zIndex: 1200,
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        overflowY: "auto",
      }}
      onClick={onClose}
    >
      <div
        className="modal-dialog modal-lg modal-dialog-centered"
        onClick={(e) => e.stopPropagation()}
      >
        <form
          className="modal-content border-0 shadow-lg"
          onSubmit={onSubmit}
          style={{ borderRadius: "20px", overflow: "hidden" }}
        >
          {/* Header */}
          <div
            className="modal-header border-0 text-white"
            style={{
              background: "linear-gradient(135deg, #e67e22 0%, #d35400 100%)",
              padding: "24px",
            }}
          >
            <h4 className="modal-title mb-0 d-flex align-items-center fw-bold">
              <FaCalendarCheck className="me-3" style={{ fontSize: "24px" }} />
              {editAct ? "Editar Actividad" : "Nueva Actividad"}
            </h4>
            <button
              type="button"
              className="btn-close btn-close-white"
              onClick={onClose}
              style={{ filter: "brightness(0) invert(1)" }}
            ></button>
          </div>

          {/* Body */}
          <div
            className="modal-body"
            style={{ padding: "32px", background: "#f8f9fa" }}
          >
            <div className="row g-4">
              {/* Nombre */}
              <div className="col-12">
                <label
                  className="form-label fw-semibold d-flex align-items-center"
                  style={{ color: "#2c3e50" }}
                >
                  <FaCalendarCheck className="me-2" style={{ color: "#e67e22" }} />
                  Nombre de la Actividad
                </label>
                <input
                  type="text"
                  className="form-control form-control-lg"
                  name="nombre"
                  value={form.nombre}
                  onChange={handleInput}
                  required
                  placeholder="Ej: Rifa Navideña 2026"
                  style={{
                    borderRadius: "10px",
                    border: "2px solid #e9ecef",
                    padding: "12px 16px",
                  }}
                />
              </div>

              {/* Tipo y Fecha */}
              <div className="col-md-6">
                <label
                  className="form-label fw-semibold d-flex align-items-center"
                  style={{ color: "#2c3e50" }}
                >
                  <FaTicketAlt className="me-2" style={{ color: "#e67e22" }} />
                  Tipo de Actividad
                </label>
                <select
                  className="form-select form-select-lg"
                  name="tipo"
                  value={form.tipo}
                  onChange={handleInput}
                  required
                  style={{
                    borderRadius: "10px",
                    border: "2px solid #e9ecef",
                    padding: "12px 16px",
                  }}
                >
                  <option value="">Seleccionar tipo...</option>
                  <option value="rifas">🎟️ Rifas</option>
                  <option value="ventas">🛒 Ventas</option>
                  <option value="intereses_ganados">📈 Intereses Ganados</option>
                  <option value="donaciones">🎁 Donaciones</option>
                  <option value="alquileres">🏠 Alquileres</option>
                  <option value="otros_ingresos">📋 Otros Ingresos</option>
                </select>
              </div>

              <div className="col-md-6">
                <label
                  className="form-label fw-semibold d-flex align-items-center"
                  style={{ color: "#2c3e50" }}
                >
                  <FaCalendarAlt className="me-2" style={{ color: "#3498db" }} />
                  Fecha de la Actividad
                </label>
                <input
                  type="date"
                  className="form-control form-control-lg"
                  name="fecha"
                  value={form.fecha}
                  onChange={handleInput}
                  required
                  style={{
                    borderRadius: "10px",
                    border: "2px solid #e9ecef",
                    padding: "12px 16px",
                  }}
                />
              </div>

              {/* Ingreso */}
              <div className="col-12">
                <label
                  className="form-label fw-semibold d-flex align-items-center"
                  style={{ color: "#2c3e50" }}
                >
                  <FaMoneyBillWave className="me-2" style={{ color: "#27ae60" }} />
                  Ingreso Generado (L.)
                </label>
                <input
                  type="number"
                  className="form-control form-control-lg"
                  name="monto"
                  value={form.monto}
                  onChange={handleInput}
                  required
                  min="0.01"
                  step="0.01"
                  placeholder="0.00"
                  style={{
                    borderRadius: "10px",
                    border: "2px solid #e9ecef",
                    padding: "12px 16px",
                  }}
                />
              </div>

              {/* Descripción */}
              <div className="col-12">
                <label
                  className="form-label fw-semibold d-flex align-items-center"
                  style={{ color: "#2c3e50" }}
                >
                  <FaFileAlt className="me-2" style={{ color: "#e67e22" }} />
                  Descripción (Opcional)
                </label>
                <textarea
                  className="form-control form-control-lg"
                  name="descripcion"
                  value={form.descripcion}
                  onChange={handleInput}
                  rows="3"
                  maxLength="200"
                  placeholder="Ej: Rifa benéfica para recaudación de fondos..."
                  style={{
                    borderRadius: "10px",
                    border: "2px solid #e9ecef",
                    padding: "12px 16px",
                  }}
                />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div
            className="modal-footer border-0 bg-white"
            style={{ padding: "20px 32px" }}
          >
            <button
              type="submit"
              className="btn btn-lg shadow-sm"
              style={{
                background: "linear-gradient(135deg, #e67e22 0%, #d35400 100%)",
                color: "white",
                border: "none",
                borderRadius: "10px",
                padding: "12px 32px",
                fontWeight: "600",
              }}
            >
              <FaCalendarCheck className="me-2" />
              {editAct ? "Guardar Cambios" : "Registrar Actividad"}
            </button>
            <button
              type="button"
              className="btn btn-lg btn-light shadow-sm"
              onClick={onClose}
              style={{
                borderRadius: "10px",
                padding: "12px 32px",
                fontWeight: "600",
              }}
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
