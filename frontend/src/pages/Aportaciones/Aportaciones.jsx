import { useState, useEffect } from "react";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import { useAlerta } from "../../context/AlertaContext";
import TablaAportaciones from "./TablaAportaciones";
import {
  FaMoneyBillWave,
  FaPlus,
  FaSearch,
  FaChartLine,
  FaTrophy,
  FaCalendarAlt,
  FaCoins,
  FaArrowUp,
  FaExclamationTriangle,
} from "react-icons/fa";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

export default function Aportaciones() {
  const { token } = useAuth();
  const { mostrarAlerta } = useAlerta();
  const [aportaciones, setAportaciones] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filtro, setFiltro] = useState("");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editAportacion, setEditAportacion] = useState(null);
  const [form, setForm] = useState({
    id_usuario: "",
    monto: "",
    fecha: new Date().toISOString().split("T")[0],
    descripcion: "",
  });

  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [aportacionesRes, usuariosRes] = await Promise.all([
        axios.get(`${API_URL}/aportaciones`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`${API_URL}/usuarios`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      setAportaciones(aportacionesRes.data.data || aportacionesRes.data || []);
      setUsuarios(usuariosRes.data.data || usuariosRes.data || []);
    } catch (err) {
      console.error('Error al cargar datos:', err);
      const mensaje = err.response?.data?.message || err.message || "No se pudieron obtener los datos del servidor";
      setError(mensaje);
      mostrarAlerta(mensaje, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line
  }, []);

  // Filtrar aportaciones
  const aportacionesFiltradas = aportaciones.filter((a) => {
    const usuario = usuarios.find((u) => u.id_usuario === a.id_usuario);
    const nombreUsuario = usuario?.nombre_completo?.toLowerCase() || "";
    const coincideBusqueda = nombreUsuario.includes(filtro.toLowerCase());

    const fechaAportacion = a.fecha ? a.fecha.substring(0, 10) : "";
    const coincideFechaInicio = fechaInicio
      ? fechaAportacion >= fechaInicio
      : true;
    const coincideFechaFin = fechaFin ? fechaAportacion <= fechaFin : true;

    return coincideBusqueda && coincideFechaInicio && coincideFechaFin;
  });

  const openCrearModal = () => {
    setEditAportacion(null);
    setForm({
      id_usuario: "",
      monto: "",
      fecha: new Date().toISOString().split("T")[0],
      descripcion: "",
    });
    setShowModal(true);
  };

  const handleEdit = (aportacion) => {
    setEditAportacion(aportacion);
    setForm({
      id_usuario: aportacion.id_usuario,
      monto: aportacion.monto,
      fecha: aportacion.fecha
        ? aportacion.fecha.substring(0, 10)
        : new Date().toISOString().split("T")[0],
      descripcion: aportacion.descripcion || "",
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("¿Seguro que deseas eliminar esta aportación?")) return;
    try {
      await axios.delete(`${API_URL}/aportaciones/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      mostrarAlerta("Aportación eliminada correctamente.", "success");
      fetchData();
    } catch (err) {
      mostrarAlerta("Error al eliminar la aportación.", "error");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editAportacion) {
        await axios.put(
          `${API_URL}/aportaciones/${editAportacion.id_aportacion}`,
          form,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        mostrarAlerta("Aportación actualizada correctamente.", "success");
      } else {
        await axios.post(`${API_URL}/aportaciones`, form, {
          headers: { Authorization: `Bearer ${token}` },
        });
        mostrarAlerta("Aportación registrada correctamente.", "success");
      }
      setForm({
        id_usuario: "",
        monto: "",
        fecha: new Date().toISOString().split("T")[0],
        descripcion: "",
      });
      setEditAportacion(null);
      setShowModal(false);
      fetchData();
    } catch (err) {
      mostrarAlerta(
        err.response?.data?.message || "Error al guardar la aportación.",
        "error"
      );
    }
  };

  const handleInput = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  // Estadísticas
  const totalAportaciones = aportaciones.length;
  const montoTotal = aportaciones.reduce(
    (sum, a) => sum + parseFloat(a.monto || 0),
    0
  );
  const promedioAportacion = totalAportaciones > 0 ? montoTotal / totalAportaciones : 0;

  // Aportaciones este mes
  const hoy = new Date();
  const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
    .toISOString()
    .split("T")[0];
  const aportacionesMes = aportaciones.filter(
    (a) => a.fecha && a.fecha.substring(0, 10) >= primerDiaMes
  );
  const montoMes = aportacionesMes.reduce(
    (sum, a) => sum + parseFloat(a.monto || 0),
    0
  );

  // Datos para gráfico de tendencia (últimos 6 meses)
  const obtenerDatosTendencia = () => {
    const meses = [];
    const datos = [];
    for (let i = 5; i >= 0; i--) {
      const fecha = new Date();
      fecha.setMonth(fecha.getMonth() - i);
      const año = fecha.getFullYear();
      const mes = fecha.getMonth() + 1;
      const nombreMes = fecha.toLocaleDateString("es", { month: "short" });

      const aportacionesMes = aportaciones.filter((a) => {
        if (!a.fecha) return false;
        const fechaAportacion = new Date(a.fecha);
        return (
          fechaAportacion.getFullYear() === año &&
          fechaAportacion.getMonth() + 1 === mes
        );
      });

      const total = aportacionesMes.reduce(
        (sum, a) => sum + parseFloat(a.monto || 0),
        0
      );

      datos.push({
        mes: nombreMes,
        monto: total,
        cantidad: aportacionesMes.length,
      });
    }
    return datos;
  };

  const datosTendencia = obtenerDatosTendencia();

  // Top 5 contribuyentes
  const obtenerTopContribuyentes = () => {
    const aportesPorUsuario = {};
    aportaciones.forEach((a) => {
      if (!aportesPorUsuario[a.id_usuario]) {
        aportesPorUsuario[a.id_usuario] = 0;
      }
      aportesPorUsuario[a.id_usuario] += parseFloat(a.monto || 0);
    });

    const ranking = Object.entries(aportesPorUsuario)
      .map(([id_usuario, total]) => {
        const usuario = usuarios.find((u) => u.id_usuario === parseInt(id_usuario));
        return {
          id_usuario: parseInt(id_usuario),
          nombre: usuario?.nombre_completo || "Desconocido",
          total,
        };
      })
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    return ranking;
  };

  const topContribuyentes = obtenerTopContribuyentes();

  return (
    <div
      className="container-fluid px-4 py-4"
      style={{ background: "#f8f9fa", minHeight: "100vh" }}
    >
      {/* Error Alert */}
      {error && (
        <div 
          className="alert alert-danger border-0 shadow-sm mb-4 d-flex align-items-center"
          style={{ 
            borderRadius: "15px", 
            borderLeft: "4px solid #e74c3c",
            background: "linear-gradient(135deg, #fff5f5 0%, #ffe0e0 100%)"
          }}
        >
          <div
            className="rounded-circle d-flex align-items-center justify-content-center me-3"
            style={{
              width: "40px",
              height: "40px",
              background: "#e74c3c20",
              flexShrink: 0
            }}
          >
            <FaExclamationTriangle style={{ fontSize: "20px", color: "#e74c3c" }} />
          </div>
          <div className="flex-grow-1">
            <h6 className="mb-1 fw-bold" style={{ color: "#c0392b" }}>Error al cargar datos</h6>
            <p className="mb-0 small" style={{ color: "#e74c3c" }}>{error}</p>
          </div>
          <button
            type="button"
            className="btn-close"
            onClick={() => setError(null)}
            style={{ flexShrink: 0 }}
          ></button>
        </div>
      )}

      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="mb-1 fw-bold" style={{ color: "#2c3e50" }}>
            <FaMoneyBillWave className="me-2" style={{ color: "#27ae60" }} />
            Gestión de Aportaciones
          </h2>
          <p className="text-muted mb-0">
            Registro y seguimiento de aportaciones de socios
          </p>
        </div>
        <button
          className="btn btn-lg shadow-sm"
          onClick={openCrearModal}
          style={{
            background: "linear-gradient(135deg, #27ae60 0%, #229954 100%)",
            color: "white",
            border: "none",
            borderRadius: "10px",
            fontWeight: "600",
          }}
        >
          <FaPlus className="me-2" />
          Nueva Aportación
        </button>
      </div>

      {/* Cards de Estadísticas */}
      <div className="row g-3 mb-4">
        {/* Total Aportaciones */}
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
                  <p className="text-muted mb-1 small">Total Aportaciones</p>
                  <h3 className="mb-0 fw-bold" style={{ color: "#2c3e50" }}>
                    {totalAportaciones}
                  </h3>
                  <p className="mb-0 small text-muted mt-1">
                    {aportacionesMes.length} este mes
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
                  <FaCoins style={{ fontSize: "24px", color: "#27ae60" }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Monto Total */}
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
                  <p className="text-muted mb-1 small">Monto Acumulado</p>
                  <h3 className="mb-0 fw-bold" style={{ color: "#3498db" }}>
                    L. {montoTotal.toFixed(2)}
                  </h3>
                  <p className="mb-0 small text-muted mt-1">
                    Total histórico
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
                  <FaMoneyBillWave
                    style={{ fontSize: "24px", color: "#3498db" }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Promedio */}
        <div className="col-12 col-sm-6 col-lg-3">
          <div
            className="card border-0 shadow-sm h-100"
            style={{
              borderRadius: "15px",
              borderLeft: "4px solid #f39c12",
            }}
          >
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <p className="text-muted mb-1 small">Promedio</p>
                  <h3 className="mb-0 fw-bold" style={{ color: "#f39c12" }}>
                    L. {promedioAportacion.toFixed(2)}
                  </h3>
                  <p className="mb-0 small text-muted mt-1">
                    Por aportación
                  </p>
                </div>
                <div
                  className="rounded-circle d-flex align-items-center justify-content-center"
                  style={{
                    width: "50px",
                    height: "50px",
                    background: "rgba(243, 156, 18, 0.1)",
                  }}
                >
                  <FaChartLine style={{ fontSize: "24px", color: "#f39c12" }} />
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
                    L. {montoMes.toFixed(2)}
                  </h3>
                  <p className="mb-0 small text-muted mt-1">
                    {aportacionesMes.length} registros
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
                  <FaArrowUp style={{ fontSize: "24px", color: "#9b59b6" }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="row g-4 mb-4">
        {/* Gráfico de Tendencia */}
        <div className="col-lg-7">
          <div
            className="card border-0 shadow-sm h-100"
            style={{ borderRadius: "15px" }}
          >
            <div className="card-body">
              <h6 className="fw-bold mb-3" style={{ color: "#2c3e50" }}>
                <FaChartLine className="me-2" style={{ color: "#27ae60" }} />
                Tendencia de Aportaciones (Últimos 6 Meses)
              </h6>
              {datosTendencia.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={datosTendencia}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e9ecef" />
                    <XAxis dataKey="mes" stroke="#95a5a6" />
                    <YAxis stroke="#95a5a6" />
                    <Tooltip
                      formatter={(value) => `L. ${value.toFixed(2)}`}
                      contentStyle={{
                        background: "white",
                        border: "1px solid #e9ecef",
                        borderRadius: "8px",
                      }}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="monto"
                      stroke="#27ae60"
                      strokeWidth={3}
                      dot={{ fill: "#27ae60", r: 5 }}
                      activeDot={{ r: 7 }}
                      name="Monto (L.)"
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center py-5 text-muted">
                  No hay datos suficientes
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Top Contribuyentes */}
        <div className="col-lg-5">
          <div
            className="card border-0 shadow-sm h-100"
            style={{ borderRadius: "15px" }}
          >
            <div className="card-body">
              <h6 className="fw-bold mb-3" style={{ color: "#2c3e50" }}>
                <FaTrophy className="me-2" style={{ color: "#f39c12" }} />
                Top 5 Contribuyentes
              </h6>
              {topContribuyentes.length > 0 ? (
                <div className="d-flex flex-column gap-2">
                  {topContribuyentes.map((contribuyente, index) => {
                    const colores = [
                      "#f39c12",
                      "#95a5a6",
                      "#cd7f32",
                      "#3498db",
                      "#27ae60",
                    ];
                    const color = colores[index];
                    const porcentaje = (contribuyente.total / montoTotal) * 100;

                    return (
                      <div
                        key={contribuyente.id_usuario}
                        className="p-3"
                        style={{
                          background: "#f8f9fa",
                          borderRadius: "10px",
                          borderLeft: `4px solid ${color}`,
                        }}
                      >
                        <div className="d-flex justify-content-between align-items-center mb-2">
                          <div className="d-flex align-items-center">
                            <div
                              className="rounded-circle d-flex align-items-center justify-content-center me-2 fw-bold"
                              style={{
                                width: "28px",
                                height: "28px",
                                background: color,
                                color: "white",
                                fontSize: "14px",
                              }}
                            >
                              {index + 1}
                            </div>
                            <span className="fw-semibold" style={{ fontSize: "14px" }}>
                              {contribuyente.nombre}
                            </span>
                          </div>
                          <span
                            className="fw-bold"
                            style={{ fontSize: "14px", color: color }}
                          >
                            L. {contribuyente.total.toFixed(2)}
                          </span>
                        </div>
                        <div
                          className="progress"
                          style={{ height: "6px", background: "#e9ecef" }}
                        >
                          <div
                            className="progress-bar"
                            style={{
                              width: `${porcentaje}%`,
                              background: color,
                            }}
                          ></div>
                        </div>
                        <small className="text-muted" style={{ fontSize: "11px" }}>
                          {porcentaje.toFixed(1)}% del total
                        </small>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-5 text-muted">
                  No hay datos disponibles
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="row g-3 mb-4">
        <div className="col-lg-5">
          <div
            className="card border-0 shadow-sm"
            style={{ borderRadius: "15px" }}
          >
            <div className="card-body">
              <label className="form-label fw-semibold small text-muted">
                Buscar por Socio
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
                  placeholder="Buscar por nombre del socio..."
                  value={filtro}
                  onChange={(e) => setFiltro(e.target.value)}
                  style={{
                    borderRadius: "0 10px 10px 0",
                    boxShadow: "none",
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="col-lg-7">
          <div
            className="card border-0 shadow-sm"
            style={{ borderRadius: "15px" }}
          >
            <div className="card-body">
              <label className="form-label fw-semibold small text-muted">
                <FaCalendarAlt className="me-2" />
                Filtrar por Rango de Fechas
              </label>
              <div className="row g-2">
                <div className="col-md-6">
                  <input
                    type="date"
                    className="form-control"
                    value={fechaInicio}
                    onChange={(e) => setFechaInicio(e.target.value)}
                    style={{ borderRadius: "10px" }}
                    placeholder="Fecha inicio"
                  />
                </div>
                <div className="col-md-6">
                  <input
                    type="date"
                    className="form-control"
                    value={fechaFin}
                    onChange={(e) => setFechaFin(e.target.value)}
                    style={{ borderRadius: "10px" }}
                    placeholder="Fecha fin"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabla de Aportaciones */}
      {loading ? (
        <div className="text-center py-5">
          <div
            className="spinner-border text-success"
            role="status"
            style={{ width: "3rem", height: "3rem" }}
          >
            <span className="visually-hidden">Cargando...</span>
          </div>
          <p className="mt-3 text-muted">Cargando aportaciones...</p>
        </div>
      ) : (
        <TablaAportaciones
          aportaciones={aportacionesFiltradas}
          usuarios={usuarios}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      )}

      {/* Modal */}
      {showModal && (
        <ModalAportacion
          show={showModal}
          editAportacion={editAportacion}
          form={form}
          usuarios={usuarios}
          onClose={() => setShowModal(false)}
          onSubmit={handleSubmit}
          handleInput={handleInput}
        />
      )}
    </div>
  );
}

// ==================== COMPONENTE MODAL APORTACIÓN ====================
function ModalAportacion({
  show,
  editAportacion,
  form,
  usuarios,
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
              background: "linear-gradient(135deg, #27ae60 0%, #229954 100%)",
              padding: "24px",
            }}
          >
            <h4 className="modal-title mb-0 d-flex align-items-center fw-bold">
              <FaMoneyBillWave className="me-3" style={{ fontSize: "24px" }} />
              {editAportacion ? "Editar Aportación" : "Nueva Aportación"}
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
              {/* Socio */}
              <div className="col-12">
                <label
                  className="form-label fw-semibold d-flex align-items-center"
                  style={{ color: "#2c3e50" }}
                >
                  <FaCoins className="me-2" style={{ color: "#27ae60" }} />
                  Socio
                </label>
                <select
                  className="form-select form-select-lg"
                  name="id_usuario"
                  value={form.id_usuario}
                  onChange={handleInput}
                  required
                  style={{
                    borderRadius: "10px",
                    border: "2px solid #e9ecef",
                    padding: "12px 16px",
                  }}
                >
                  <option value="">Seleccionar socio...</option>
                  {usuarios.map((u) => (
                    <option key={u.id_usuario} value={u.id_usuario}>
                      {u.nombre_completo} - {u.dni}
                    </option>
                  ))}
                </select>
              </div>

              {/* Monto y Fecha */}
              <div className="col-md-6">
                <label
                  className="form-label fw-semibold d-flex align-items-center"
                  style={{ color: "#2c3e50" }}
                >
                  <FaMoneyBillWave
                    className="me-2"
                    style={{ color: "#27ae60" }}
                  />
                  Monto (L.)
                </label>
                <input
                  type="number"
                  className="form-control form-control-lg"
                  name="monto"
                  value={form.monto}
                  onChange={handleInput}
                  required
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  style={{
                    borderRadius: "10px",
                    border: "2px solid #e9ecef",
                    padding: "12px 16px",
                  }}
                />
              </div>

              <div className="col-md-6">
                <label
                  className="form-label fw-semibold d-flex align-items-center"
                  style={{ color: "#2c3e50" }}
                >
                  <FaCalendarAlt className="me-2" style={{ color: "#27ae60" }} />
                  Fecha
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

              {/* Descripción */}
              <div className="col-12">
                <label
                  className="form-label fw-semibold d-flex align-items-center"
                  style={{ color: "#2c3e50" }}
                >
                  <FaCoins className="me-2" style={{ color: "#27ae60" }} />
                  Descripción (Opcional)
                </label>
                <textarea
                  className="form-control form-control-lg"
                  name="descripcion"
                  value={form.descripcion}
                  onChange={handleInput}
                  rows="3"
                  maxLength="200"
                  placeholder="Ej: Aportación mensual, aportación inicial, etc."
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
                background: "linear-gradient(135deg, #27ae60 0%, #229954 100%)",
                color: "white",
                border: "none",
                borderRadius: "10px",
                padding: "12px 32px",
                fontWeight: "600",
              }}
            >
              <FaMoneyBillWave className="me-2" />
              {editAportacion ? "Guardar Cambios" : "Registrar Aportación"}
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
