import { useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { useAlerta } from "../context/AlertaContext";
import {
  FaHandHoldingUsd,
  FaPlus,
  FaSearch,
  FaCalendarAlt,
  FaMoneyBillWave,
  FaEdit,
  FaTrash,
  FaChartLine,
  FaUsers,
  FaEye,
  FaFileInvoiceDollar,
  FaCheckCircle,
  FaSpinner,
  FaReceipt,
  FaTimes,
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
  LineChart,
  Line,
  Area,
  AreaChart,
} from "recharts";

export default function Liquidaciones() {
  const { token } = useAuth();
  const { mostrarAlerta } = useAlerta();
  const [liquidaciones, setLiquidaciones] = useState([]);
  const [editLiquidacion, setEditLiquidacion] = useState(null);
  const [form, setForm] = useState({
    fecha: new Date().toISOString().split("T")[0],
    monto: "",
    descripcion: "",
  });
  const [loading, setLoading] = useState(true);
  const [detalle, setDetalle] = useState([]);
  const [showDetalle, setShowDetalle] = useState(false);
  const [liquidacionActual, setLiquidacionActual] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [filtro, setFiltro] = useState("");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");

  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

  // Cargar liquidaciones
  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/liquidaciones`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setLiquidaciones(res.data.data || res.data || []);
    } catch (err) {
      mostrarAlerta("No se pudieron obtener las liquidaciones.", "error");
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

  // Crear o editar liquidación
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editLiquidacion) {
        await axios.put(
          `${API_URL}/liquidaciones/${editLiquidacion.id_liquidacion}`,
          form,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        mostrarAlerta("Liquidación actualizada correctamente.", "success");
      } else {
        await axios.post(`${API_URL}/liquidaciones`, form, {
          headers: { Authorization: `Bearer ${token}` },
        });
        mostrarAlerta("Liquidación registrada correctamente.", "success");
      }
      setForm({
        fecha: new Date().toISOString().split("T")[0],
        monto: "",
        descripcion: "",
      });
      setEditLiquidacion(null);
      setShowModal(false);
      fetchData();
    } catch (err) {
      mostrarAlerta(
        err.response?.data?.message || "Error al guardar la liquidación.",
        "error"
      );
    }
  };

  const handleEdit = (liq) => {
    setEditLiquidacion(liq);
    setForm({
      fecha: liq.fecha ? liq.fecha.substring(0, 10) : new Date().toISOString().split("T")[0],
      monto: liq.monto,
      descripcion: liq.descripcion || "",
    });
    setShowModal(true);
  };

  const openCrearModal = () => {
    setEditLiquidacion(null);
    setForm({
      fecha: new Date().toISOString().split("T")[0],
      monto: "",
      descripcion: "",
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("¿Seguro que deseas eliminar esta liquidación?"))
      return;
    try {
      await axios.delete(`${API_URL}/liquidaciones/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      mostrarAlerta("Liquidación eliminada correctamente.", "success");
      fetchData();
    } catch (err) {
      mostrarAlerta("Error al eliminar la liquidación.", "error");
    }
  };

  // Ver detalle de reparto
  const verDetalle = async (liq) => {
    try {
      const res = await axios.get(
        `${API_URL}/liquidaciones/${liq.id_liquidacion}/detalle`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setDetalle(res.data.data || res.data || []);
      setLiquidacionActual(liq);
      setShowDetalle(true);
    } catch {
      setDetalle([]);
      setLiquidacionActual(liq);
      setShowDetalle(true);
      mostrarAlerta("No se pudo obtener el detalle de reparto.", "error");
    }
  };

  // Filtrar liquidaciones
  const liquidacionesFiltradas = liquidaciones.filter((l) => {
    const coincideDescripcion = l.descripcion
      ?.toLowerCase()
      .includes(filtro.toLowerCase());
    const fechaLiq = l.fecha ? l.fecha.substring(0, 10) : "";
    const coincideFechaInicio = fechaInicio ? fechaLiq >= fechaInicio : true;
    const coincideFechaFin = fechaFin ? fechaLiq <= fechaFin : true;

    return coincideDescripcion && coincideFechaInicio && coincideFechaFin;
  });

  // Estadísticas
  const totalLiquidaciones = liquidaciones.length;
  const montoTotal = liquidaciones.reduce(
    (sum, l) => sum + parseFloat(l.monto || 0),
    0
  );
  const promedioMonto =
    totalLiquidaciones > 0 ? montoTotal / totalLiquidaciones : 0;

  // Última liquidación
  const ultimaLiquidacion =
    liquidaciones.length > 0
      ? [...liquidaciones].sort(
          (a, b) => new Date(b.fecha) - new Date(a.fecha)
        )[0]
      : null;

  // Datos para gráfico de área (últimos 6 meses)
  const obtenerDatosMensuales = () => {
    const datos = [];
    for (let i = 5; i >= 0; i--) {
      const fecha = new Date();
      fecha.setMonth(fecha.getMonth() - i);
      const mes = fecha.toLocaleString("es", { month: "short" });
      const mesNum = fecha.getMonth();
      const año = fecha.getFullYear();

      const liqsMes = liquidaciones.filter((l) => {
        if (!l.fecha) return false;
        const f = new Date(l.fecha);
        return f.getMonth() === mesNum && f.getFullYear() === año;
      });

      const monto = liqsMes.reduce(
        (sum, l) => sum + parseFloat(l.monto || 0),
        0
      );

      datos.push({
        mes: mes.charAt(0).toUpperCase() + mes.slice(1),
        monto: parseFloat(monto.toFixed(2)),
        cantidad: liqsMes.length,
      });
    }
    return datos;
  };

  const datosMensuales = obtenerDatosMensuales();

  return (
    <div
      className="container-fluid px-4 py-4"
      style={{ background: "#f8f9fa", minHeight: "100vh" }}
    >
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="mb-1 fw-bold" style={{ color: "#2c3e50" }}>
            <FaHandHoldingUsd className="me-2" style={{ color: "#16a085" }} />
            Gestión de Liquidaciones
          </h2>
          <p className="text-muted mb-0">
            Registro y distribución de utilidades entre socios
          </p>
        </div>
        <button
          className="btn btn-lg shadow-sm"
          onClick={openCrearModal}
          style={{
            background: "linear-gradient(135deg, #16a085 0%, #138d75 100%)",
            color: "white",
            border: "none",
            borderRadius: "10px",
            fontWeight: "600",
          }}
        >
          <FaPlus className="me-2" />
          Nueva Liquidación
        </button>
      </div>

      {/* Cards de Estadísticas */}
      <div className="row g-3 mb-4">
        {/* Total Liquidaciones */}
        <div className="col-12 col-sm-6 col-lg-3">
          <div
            className="card border-0 shadow-sm h-100"
            style={{
              borderRadius: "15px",
              borderLeft: "4px solid #16a085",
            }}
          >
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <p className="text-muted mb-1 small">Total Liquidaciones</p>
                  <h3 className="mb-0 fw-bold" style={{ color: "#2c3e50" }}>
                    {totalLiquidaciones}
                  </h3>
                  <p className="mb-0 small text-muted mt-1">
                    Registros totales
                  </p>
                </div>
                <div
                  className="rounded-circle d-flex align-items-center justify-content-center"
                  style={{
                    width: "50px",
                    height: "50px",
                    background: "rgba(22, 160, 133, 0.1)",
                  }}
                >
                  <FaFileInvoiceDollar
                    style={{ fontSize: "24px", color: "#16a085" }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Monto Total Distribuido */}
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
                  <p className="text-muted mb-1 small">Monto Total</p>
                  <h3 className="mb-0 fw-bold" style={{ color: "#27ae60" }}>
                    L. {montoTotal.toFixed(2)}
                  </h3>
                  <p className="mb-0 small text-muted mt-1">
                    Distribuido
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
                  <FaHandHoldingUsd
                    style={{ fontSize: "24px", color: "#27ae60" }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Última Liquidación */}
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
                  <p className="text-muted mb-1 small">Última Liquidación</p>
                  {ultimaLiquidacion ? (
                    <>
                      <h4 className="mb-0 fw-bold" style={{ color: "#3498db" }}>
                        L. {parseFloat(ultimaLiquidacion.monto).toFixed(2)}
                      </h4>
                      <p className="mb-0 small text-muted mt-1">
                        {ultimaLiquidacion.fecha?.substring(0, 10)}
                      </p>
                    </>
                  ) : (
                    <h5 className="mb-0 text-muted">Sin registros</h5>
                  )}
                </div>
                <div
                  className="rounded-circle d-flex align-items-center justify-content-center"
                  style={{
                    width: "50px",
                    height: "50px",
                    background: "rgba(52, 152, 219, 0.1)",
                  }}
                >
                  <FaReceipt style={{ fontSize: "24px", color: "#3498db" }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Promedio por Liquidación */}
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
                  <p className="text-muted mb-1 small">Promedio</p>
                  <h3 className="mb-0 fw-bold" style={{ color: "#9b59b6" }}>
                    L. {promedioMonto.toFixed(2)}
                  </h3>
                  <p className="mb-0 small text-muted mt-1">
                    Por liquidación
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
                  <FaChartLine style={{ fontSize: "24px", color: "#9b59b6" }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Gráfico */}
      <div className="row g-4 mb-4">
        <div className="col-12">
          <div
            className="card border-0 shadow-sm"
            style={{ borderRadius: "15px" }}
          >
            <div className="card-body">
              <h6 className="fw-bold mb-3" style={{ color: "#2c3e50" }}>
                <FaChartLine className="me-2" style={{ color: "#16a085" }} />
                Tendencia de Distribución (Últimos 6 Meses)
              </h6>
              {datosMensuales.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={datosMensuales}>
                    <defs>
                      <linearGradient
                        id="colorMonto"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="#16a085"
                          stopOpacity={0.8}
                        />
                        <stop
                          offset="95%"
                          stopColor="#16a085"
                          stopOpacity={0.1}
                        />
                      </linearGradient>
                    </defs>
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
                    <Area
                      type="monotone"
                      dataKey="monto"
                      stroke="#16a085"
                      strokeWidth={3}
                      fillOpacity={1}
                      fill="url(#colorMonto)"
                      name="Monto Distribuido (L.)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
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
            <div className="col-md-6">
              <label className="form-label fw-semibold small text-muted">
                Buscar por Descripción
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
                  placeholder="Buscar liquidación..."
                  value={filtro}
                  onChange={(e) => setFiltro(e.target.value)}
                  style={{
                    borderRadius: "0 10px 10px 0",
                    boxShadow: "none",
                  }}
                />
              </div>
            </div>

            {/* Rango de Fechas */}
            <div className="col-md-6">
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

      {/* Tabla de Liquidaciones */}
      {loading ? (
        <div className="text-center py-5">
          <div
            className="spinner-border text-primary"
            role="status"
            style={{ width: "3rem", height: "3rem" }}
          >
            <span className="visually-hidden">Cargando...</span>
          </div>
          <p className="mt-3 text-muted">Cargando liquidaciones...</p>
        </div>
      ) : (
        <TablaLiquidaciones
          liquidaciones={liquidacionesFiltradas}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onVerDetalle={verDetalle}
        />
      )}

      {/* Modal Crear/Editar */}
      {showModal && (
        <ModalLiquidacion
          show={showModal}
          editLiquidacion={editLiquidacion}
          form={form}
          onClose={() => setShowModal(false)}
          onSubmit={handleSubmit}
          handleInput={handleInput}
        />
      )}

      {/* Modal Detalle */}
      {showDetalle && (
        <ModalDetalle
          show={showDetalle}
          liquidacion={liquidacionActual}
          detalle={detalle}
          onClose={() => setShowDetalle(false)}
        />
      )}
    </div>
  );
}

// ==================== COMPONENTE TABLA LIQUIDACIONES ====================
function TablaLiquidaciones({
  liquidaciones,
  onEdit,
  onDelete,
  onVerDetalle,
}) {
  if (!liquidaciones || liquidaciones.length === 0) {
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
              background: "rgba(22, 160, 133, 0.1)",
            }}
          >
            <FaHandHoldingUsd style={{ fontSize: "36px", color: "#16a085" }} />
          </div>
          <h5 className="text-muted fw-semibold">
            No hay liquidaciones registradas
          </h5>
          <p className="text-muted mb-0">
            Registra una nueva liquidación para comenzar
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="card border-0 shadow-sm" style={{ borderRadius: "15px" }}>
      {/* Header */}
      <div
        className="text-white p-3"
        style={{
          background: "linear-gradient(135deg, #16a085 0%, #138d75 100%)",
          borderRadius: "15px 15px 0 0",
        }}
      >
        <div className="row g-2 align-items-center fw-semibold">
          <div className="col-auto" style={{ width: "50px" }}>
            #
          </div>
          <div className="col-2">Fecha</div>
          <div className="col-3">Monto Distribuido</div>
          <div className="col-3">Descripción</div>
          <div className="col text-center">Acciones</div>
        </div>
      </div>

      {/* Body */}
      <div className="card-body p-0">
        <div style={{ maxHeight: "600px", overflowY: "auto" }}>
          {liquidaciones.map((liquidacion, index) => {
            const fecha = liquidacion.fecha
              ? liquidacion.fecha.substring(0, 10)
              : "-";

            return (
              <div
                key={liquidacion.id_liquidacion}
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
                        background: "rgba(22, 160, 133, 0.1)",
                        color: "#16a085",
                        fontSize: "14px",
                      }}
                    >
                      {index + 1}
                    </div>
                  </div>

                  {/* Fecha */}
                  <div className="col-2">
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

                  {/* Monto */}
                  <div className="col-3">
                    <div className="d-flex align-items-center">
                      <FaHandHoldingUsd
                        className="me-2"
                        style={{ color: "#27ae60", fontSize: "24px" }}
                      />
                      <div>
                        <div
                          className="fw-bold"
                          style={{ fontSize: "18px", color: "#27ae60" }}
                        >
                          L. {parseFloat(liquidacion.monto || 0).toFixed(2)}
                        </div>
                        <div className="small text-muted">Distribuido</div>
                      </div>
                    </div>
                  </div>

                  {/* Descripción */}
                  <div className="col-3">
                    {liquidacion.descripcion ? (
                      <div
                        className="text-muted"
                        style={{
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                        title={liquidacion.descripcion}
                      >
                        <FaFileInvoiceDollar className="me-2" />
                        {liquidacion.descripcion}
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
                        onClick={() => onVerDetalle(liquidacion)}
                        style={{
                          background: "rgba(22, 160, 133, 0.1)",
                          color: "#16a085",
                          border: "1px solid #16a085",
                          borderRadius: "8px 0 0 8px",
                          fontWeight: "600",
                          transition: "all 0.3s ease",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "#16a085";
                          e.currentTarget.style.color = "white";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background =
                            "rgba(22, 160, 133, 0.1)";
                          e.currentTarget.style.color = "#16a085";
                        }}
                        title="Ver Detalle"
                      >
                        <FaEye />
                      </button>
                      <button
                        className="btn btn-sm"
                        onClick={() => onEdit(liquidacion)}
                        style={{
                          background: "rgba(52, 152, 219, 0.1)",
                          color: "#3498db",
                          border: "1px solid #3498db",
                          borderLeft: "none",
                          borderRight: "none",
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
                        onClick={() => onDelete(liquidacion.id_liquidacion)}
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
          Total de liquidaciones:{" "}
          <span className="text-primary fw-bold">{liquidaciones.length}</span>
          {" | "}
          Monto total distribuido:{" "}
          <span className="text-success fw-bold">
            L.{" "}
            {liquidaciones
              .reduce((sum, l) => sum + parseFloat(l.monto || 0), 0)
              .toFixed(2)}
          </span>
        </p>
      </div>
    </div>
  );
}

// ==================== COMPONENTE MODAL LIQUIDACION ====================
function ModalLiquidacion({
  show,
  editLiquidacion,
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
        className="modal-dialog modal-dialog-centered"
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
              background: "linear-gradient(135deg, #16a085 0%, #138d75 100%)",
              padding: "24px",
            }}
          >
            <h4 className="modal-title mb-0 d-flex align-items-center fw-bold">
              <FaHandHoldingUsd
                className="me-3"
                style={{ fontSize: "24px" }}
              />
              {editLiquidacion ? "Editar Liquidación" : "Nueva Liquidación"}
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
              {/* Fecha */}
              <div className="col-12">
                <label
                  className="form-label fw-semibold d-flex align-items-center"
                  style={{ color: "#2c3e50" }}
                >
                  <FaCalendarAlt className="me-2" style={{ color: "#3498db" }} />
                  Fecha de la Liquidación
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

              {/* Monto */}
              <div className="col-12">
                <label
                  className="form-label fw-semibold d-flex align-items-center"
                  style={{ color: "#2c3e50" }}
                >
                  <FaMoneyBillWave
                    className="me-2"
                    style={{ color: "#27ae60" }}
                  />
                  Monto Total a Repartir (L.)
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

              {/* Descripción */}
              <div className="col-12">
                <label
                  className="form-label fw-semibold d-flex align-items-center"
                  style={{ color: "#2c3e50" }}
                >
                  <FaFileInvoiceDollar
                    className="me-2"
                    style={{ color: "#16a085" }}
                  />
                  Descripción (Opcional)
                </label>
                <textarea
                  className="form-control form-control-lg"
                  name="descripcion"
                  value={form.descripcion}
                  onChange={handleInput}
                  rows="3"
                  maxLength="200"
                  placeholder="Ej: Reparto de utilidades del trimestre..."
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
                background: "linear-gradient(135deg, #16a085 0%, #138d75 100%)",
                color: "white",
                border: "none",
                borderRadius: "10px",
                padding: "12px 32px",
                fontWeight: "600",
              }}
            >
              <FaCheckCircle className="me-2" />
              {editLiquidacion ? "Guardar Cambios" : "Registrar Liquidación"}
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

// ==================== COMPONENTE MODAL DETALLE ====================
function ModalDetalle({ show, liquidacion, detalle, onClose }) {
  if (!show) return null;

  const totalReparto = detalle.reduce(
    (sum, d) => sum + parseFloat(d.monto_asignado || 0),
    0
  );

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
        className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="modal-content border-0 shadow-lg"
          style={{ borderRadius: "20px", overflow: "hidden" }}
        >
          {/* Header */}
          <div
            className="modal-header border-0 text-white"
            style={{
              background: "linear-gradient(135deg, #16a085 0%, #138d75 100%)",
              padding: "24px",
            }}
          >
            <h4 className="modal-title mb-0 d-flex align-items-center fw-bold">
              <FaUsers className="me-3" style={{ fontSize: "24px" }} />
              Detalle de Reparto
            </h4>
            <button
              type="button"
              className="btn-close btn-close-white"
              onClick={onClose}
              style={{ filter: "brightness(0) invert(1)" }}
            ></button>
          </div>

          {/* Info Liquidación */}
          <div className="p-4" style={{ background: "#f8f9fa" }}>
            <div className="row g-3">
              <div className="col-md-4">
                <div className="d-flex align-items-center">
                  <div
                    className="rounded-circle d-flex align-items-center justify-content-center me-3"
                    style={{
                      width: "40px",
                      height: "40px",
                      background: "rgba(52, 152, 219, 0.1)",
                    }}
                  >
                    <FaCalendarAlt style={{ color: "#3498db", fontSize: "18px" }} />
                  </div>
                  <div>
                    <div className="small text-muted">Fecha</div>
                    <div className="fw-bold">
                      {liquidacion?.fecha?.substring(0, 10)}
                    </div>
                  </div>
                </div>
              </div>
              <div className="col-md-4">
                <div className="d-flex align-items-center">
                  <div
                    className="rounded-circle d-flex align-items-center justify-content-center me-3"
                    style={{
                      width: "40px",
                      height: "40px",
                      background: "rgba(39, 174, 96, 0.1)",
                    }}
                  >
                    <FaMoneyBillWave
                      style={{ color: "#27ae60", fontSize: "18px" }}
                    />
                  </div>
                  <div>
                    <div className="small text-muted">Monto Total</div>
                    <div className="fw-bold" style={{ color: "#27ae60" }}>
                      L. {parseFloat(liquidacion?.monto || 0).toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>
              <div className="col-md-4">
                <div className="d-flex align-items-center">
                  <div
                    className="rounded-circle d-flex align-items-center justify-content-center me-3"
                    style={{
                      width: "40px",
                      height: "40px",
                      background: "rgba(155, 89, 182, 0.1)",
                    }}
                  >
                    <FaUsers style={{ color: "#9b59b6", fontSize: "18px" }} />
                  </div>
                  <div>
                    <div className="small text-muted">Socios</div>
                    <div className="fw-bold">{detalle.length}</div>
                  </div>
                </div>
              </div>
            </div>
            {liquidacion?.descripcion && (
              <div className="mt-3 p-3" style={{ background: "white", borderRadius: "10px" }}>
                <div className="small text-muted mb-1">Descripción</div>
                <div>{liquidacion.descripcion}</div>
              </div>
            )}
          </div>

          {/* Body - Tabla */}
          <div className="modal-body p-0">
            {detalle.length === 0 ? (
              <div className="text-center py-5">
                <div
                  className="rounded-circle mx-auto d-flex align-items-center justify-content-center mb-3"
                  style={{
                    width: "60px",
                    height: "60px",
                    background: "rgba(149, 165, 166, 0.1)",
                  }}
                >
                  <FaUsers style={{ fontSize: "28px", color: "#95a5a6" }} />
                </div>
                <h6 className="text-muted">Sin detalles de reparto</h6>
              </div>
            ) : (
              <div style={{ maxHeight: "400px", overflowY: "auto" }}>
                <table className="table table-hover mb-0">
                  <thead
                    style={{
                      background: "#f8f9fa",
                      position: "sticky",
                      top: 0,
                      zIndex: 10,
                    }}
                  >
                    <tr>
                      <th className="py-3 ps-4">#</th>
                      <th className="py-3">Socio</th>
                      <th className="py-3 text-end pe-4">Monto Asignado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detalle.map((d, i) => (
                      <tr key={d.id_usuario || i}>
                        <td className="ps-4">
                          <div
                            className="rounded-circle d-flex align-items-center justify-content-center fw-bold"
                            style={{
                              width: "28px",
                              height: "28px",
                              background: "rgba(22, 160, 133, 0.1)",
                              color: "#16a085",
                              fontSize: "12px",
                            }}
                          >
                            {i + 1}
                          </div>
                        </td>
                        <td>
                          <div className="d-flex align-items-center">
                            <div
                              className="rounded-circle d-flex align-items-center justify-content-center me-3 text-white fw-bold"
                              style={{
                                width: "36px",
                                height: "36px",
                                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                                fontSize: "14px",
                              }}
                            >
                              {d.nombre_completo?.charAt(0).toUpperCase() ||
                                "?"}
                            </div>
                            <div className="fw-semibold">
                              {d.nombre_completo}
                            </div>
                          </div>
                        </td>
                        <td className="text-end pe-4">
                          <span
                            className="fw-bold"
                            style={{ fontSize: "16px", color: "#27ae60" }}
                          >
                            L. {parseFloat(d.monto_asignado || 0).toFixed(2)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Footer */}
          <div
            className="modal-footer border-top"
            style={{ background: "#f8f9fa", padding: "20px 32px" }}
          >
            <div className="w-100 d-flex justify-content-between align-items-center">
              <div>
                <span className="fw-semibold me-2">Total Repartido:</span>
                <span
                  className="fw-bold"
                  style={{ fontSize: "20px", color: "#27ae60" }}
                >
                  L. {totalReparto.toFixed(2)}
                </span>
              </div>
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
                <FaTimes className="me-2" />
                Cerrar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
