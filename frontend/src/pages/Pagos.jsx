import { useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { useAlerta } from "../context/AlertaContext";
import {
  FaMoneyCheckAlt,
  FaPlus,
  FaSearch,
  FaChartLine,
  FaCalendarAlt,
  FaUser,
  FaMoneyBillWave,
  FaEdit,
  FaTrash,
  FaFileInvoiceDollar,
  FaCheckCircle,
  FaIdCard,
  FaExclamationCircle,
  FaClock,
} from "react-icons/fa";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { CircularProgressbar, buildStyles } from "react-circular-progressbar";

export default function Pagos() {
  const { token } = useAuth();
  const { mostrarAlerta } = useAlerta();
  const [pagos, setPagos] = useState([]);
  const [prestamos, setPrestamos] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState("");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [prestamoFiltro, setPrestamoFiltro] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editPago, setEditPago] = useState(null);
  const [form, setForm] = useState({
    id_prestamo: "",
    monto: "",
    metodo_pago: "Efectivo",
    fecha: new Date().toISOString().split("T")[0],
    descripcion: "",
  });

  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

  const fetchData = async () => {
    try {
      setLoading(true);
      const [pagosRes, prestamosRes, usuariosRes] = await Promise.all([
        axios.get(`${API_URL}/pagos`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`${API_URL}/prestamos`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`${API_URL}/usuarios`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      setPagos(pagosRes.data.data || pagosRes.data || []);
      setPrestamos(prestamosRes.data.data || prestamosRes.data || []);
      setUsuarios(usuariosRes.data.data || usuariosRes.data || []);
    } catch (err) {
      mostrarAlerta("No se pudieron obtener los datos.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line
  }, []);

  // Obtener usuario del préstamo
  const getUsuarioPrestamo = (id_prestamo) => {
    const prestamo = prestamos.find((pr) => pr.id_prestamo === id_prestamo);
    if (!prestamo) return null;
    return usuarios.find((u) => u.id_usuario === prestamo.id_usuario);
  };

  // Obtener préstamo
  const getPrestamo = (id_prestamo) => {
    return prestamos.find((pr) => pr.id_prestamo === id_prestamo);
  };

  // Filtrar pagos
  const pagosFiltrados = pagos.filter((p) => {
    const usuario = getUsuarioPrestamo(p.id_prestamo);
    const nombreUsuario = usuario?.nombre_completo?.toLowerCase() || "";
    const coincideBusqueda = nombreUsuario.includes(filtro.toLowerCase());

    const fechaPago = (p.fecha_pago || p.fecha || "").substring(0, 10);
    const coincideFechaInicio = fechaInicio ? fechaPago >= fechaInicio : true;
    const coincideFechaFin = fechaFin ? fechaPago <= fechaFin : true;

    const coincidePrestamo = prestamoFiltro
      ? p.id_prestamo === parseInt(prestamoFiltro)
      : true;

    return (
      coincideBusqueda &&
      coincideFechaInicio &&
      coincideFechaFin &&
      coincidePrestamo
    );
  });

  const openCrearModal = () => {
    setEditPago(null);
    setForm({
      id_prestamo: "",
      monto: "",
      metodo_pago: "Efectivo",
      fecha: new Date().toISOString().split("T")[0],
      descripcion: "",
    });
    setShowModal(true);
  };

  const handleEdit = (pago) => {
    setEditPago(pago);
    setForm({
      id_prestamo: pago.id_prestamo,
      monto: pago.monto_pagado ?? pago.monto,
      metodo_pago: pago.metodo_pago || "Efectivo",
      fecha: pago.fecha_pago
        ? pago.fecha_pago.substring(0, 10)
        : new Date().toISOString().split("T")[0],
      descripcion: pago.descripcion || "",
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("¿Seguro que deseas eliminar este pago?")) return;
    try {
      await axios.delete(`${API_URL}/pagos/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      mostrarAlerta("Pago eliminado correctamente.", "success");
      fetchData();
    } catch (err) {
      mostrarAlerta("Error al eliminar el pago.", "error");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // El backend espera monto_pagado, no monto
      const payload = {
        id_prestamo: parseInt(form.id_prestamo),
        monto_pagado: parseFloat(form.monto),
        metodo_pago: form.metodo_pago || "Efectivo",
        descripcion: form.descripcion || "",
      };
      if (editPago) {
        await axios.put(`${API_URL}/pagos/${editPago.id_pago}`, payload, {
          headers: { Authorization: `Bearer ${token}` },
        });
        mostrarAlerta("Pago actualizado correctamente.", "success");
      } else {
        await axios.post(`${API_URL}/pagos`, payload, {
          headers: { Authorization: `Bearer ${token}` },
        });
        mostrarAlerta("Pago registrado correctamente.", "success");
      }
      setForm({
        id_prestamo: "",
        monto: "",
        metodo_pago: "Efectivo",
        fecha: new Date().toISOString().split("T")[0],
        descripcion: "",
      });
      setEditPago(null);
      setShowModal(false);
      fetchData();
    } catch (err) {
      mostrarAlerta(
        err.response?.data?.message || "Error al guardar el pago.",
        "error"
      );
    }
  };

  const handleInput = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  // Estadísticas
  const totalPagos = pagos.length;
  const montoTotal = pagos.reduce((sum, p) => sum + parseFloat(p.monto_pagado ?? p.monto ?? 0), 0);
  const promedioPago = totalPagos > 0 ? montoTotal / totalPagos : 0;

  // Pagos este mes
  const hoy = new Date();
  const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
    .toISOString()
    .split("T")[0];
  const pagosMes = pagos.filter(
    (p) => p.fecha_pago && p.fecha_pago.substring(0, 10) >= primerDiaMes
  );
  const montoMes = pagosMes.reduce((sum, p) => sum + parseFloat(p.monto_pagado || 0), 0);

  // Datos para gráfico de pagos mensuales (últimos 6 meses)
  const obtenerDatosMensuales = () => {
    const datos = [];
    for (let i = 5; i >= 0; i--) {
      const fecha = new Date();
      fecha.setMonth(fecha.getMonth() - i);
      const año = fecha.getFullYear();
      const mes = fecha.getMonth() + 1;
      const nombreMes = fecha.toLocaleDateString("es", { month: "short" });

      const pagosMes = pagos.filter((p) => {
        if (!p.fecha_pago) return false;
        const fechaPago = new Date(p.fecha_pago);
        return (
          fechaPago.getFullYear() === año &&
          fechaPago.getMonth() + 1 === mes
        );
      });

      const total = pagosMes.reduce((sum, p) => sum + parseFloat(p.monto_pagado || 0), 0);

      datos.push({
        mes: nombreMes,
        monto: total,
        cantidad: pagosMes.length,
      });
    }
    return datos;
  };

  const datosMensuales = obtenerDatosMensuales();

  // Calcular pagos por préstamo
  const obtenerPagosPorPrestamo = () => {
    const pagosAgrupados = {};
    pagos.forEach((p) => {
      if (!pagosAgrupados[p.id_prestamo]) {
        pagosAgrupados[p.id_prestamo] = [];
      }
      pagosAgrupados[p.id_prestamo].push(p);
    });
    return pagosAgrupados;
  };

  const pagosPorPrestamo = obtenerPagosPorPrestamo();

  return (
    <div
      className="container-fluid px-4 py-4"
      style={{ background: "#f8f9fa", minHeight: "100vh" }}
    >
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="mb-1 fw-bold" style={{ color: "#2c3e50" }}>
            <FaMoneyCheckAlt className="me-2" style={{ color: "#3498db" }} />
            Gestión de Pagos
          </h2>
          <p className="text-muted mb-0">
            Registro y seguimiento de pagos de préstamos
          </p>
        </div>
        <button
          className="btn btn-lg shadow-sm"
          onClick={openCrearModal}
          style={{
            background: "linear-gradient(135deg, #3498db 0%, #2980b9 100%)",
            color: "white",
            border: "none",
            borderRadius: "10px",
            fontWeight: "600",
          }}
        >
          <FaPlus className="me-2" />
          Registrar Pago
        </button>
      </div>

      {/* Cards de Estadísticas */}
      <div className="row g-3 mb-4">
        {/* Total Pagos */}
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
                  <p className="text-muted mb-1 small">Total Pagos</p>
                  <h3 className="mb-0 fw-bold" style={{ color: "#2c3e50" }}>
                    {totalPagos}
                  </h3>
                  <p className="mb-0 small text-muted mt-1">
                    {pagosMes.length} este mes
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
                  <FaFileInvoiceDollar
                    style={{ fontSize: "24px", color: "#3498db" }}
                  />
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
              borderLeft: "4px solid #27ae60",
            }}
          >
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <p className="text-muted mb-1 small">Monto Total Pagado</p>
                  <h3 className="mb-0 fw-bold" style={{ color: "#27ae60" }}>
                    L. {montoTotal.toFixed(2)}
                  </h3>
                  <p className="mb-0 small text-muted mt-1">Acumulado</p>
                </div>
                <div
                  className="rounded-circle d-flex align-items-center justify-content-center"
                  style={{
                    width: "50px",
                    height: "50px",
                    background: "rgba(39, 174, 96, 0.1)",
                  }}
                >
                  <FaMoneyCheckAlt
                    style={{ fontSize: "24px", color: "#27ae60" }}
                  />
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
                    {pagosMes.length} pagos
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
                  <p className="text-muted mb-1 small">Promedio por Pago</p>
                  <h3 className="mb-0 fw-bold" style={{ color: "#f39c12" }}>
                    L. {promedioPago.toFixed(2)}
                  </h3>
                  <p className="mb-0 small text-muted mt-1">Por transacción</p>
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
      </div>

      {/* Gráfico de Pagos Mensuales */}
      <div className="row g-4 mb-4">
        <div className="col-12">
          <div
            className="card border-0 shadow-sm"
            style={{ borderRadius: "15px" }}
          >
            <div className="card-body">
              <h6 className="fw-bold mb-3" style={{ color: "#2c3e50" }}>
                <FaChartLine className="me-2" style={{ color: "#3498db" }} />
                Pagos Mensuales (Últimos 6 Meses)
              </h6>
              {datosMensuales.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={datosMensuales}>
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
                    <Bar
                      dataKey="monto"
                      fill="#3498db"
                      radius={[8, 8, 0, 0]}
                      name="Monto Pagado (L.)"
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center py-5 text-muted">
                  No hay datos suficientes
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="row g-3 mb-4">
        <div className="col-lg-4">
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

        <div className="col-lg-4">
          <div
            className="card border-0 shadow-sm"
            style={{ borderRadius: "15px" }}
          >
            <div className="card-body">
              <label className="form-label fw-semibold small text-muted">
                Filtrar por Préstamo
              </label>
              <select
                className="form-select"
                value={prestamoFiltro}
                onChange={(e) => setPrestamoFiltro(e.target.value)}
                style={{ borderRadius: "10px" }}
              >
                <option value="">Todos los préstamos</option>
                {prestamos.map((pr) => {
                  const usuario = usuarios.find(
                    (u) => u.id_usuario === pr.id_usuario
                  );
                  return (
                    <option key={pr.id_prestamo} value={pr.id_prestamo}>
                      #{pr.id_prestamo} - {usuario?.nombre_completo || "N/A"}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>
        </div>

        <div className="col-lg-4">
          <div
            className="card border-0 shadow-sm"
            style={{ borderRadius: "15px" }}
          >
            <div className="card-body">
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

      {/* Tabla de Pagos */}
      {loading ? (
        <div className="text-center py-5">
          <div
            className="spinner-border text-primary"
            role="status"
            style={{ width: "3rem", height: "3rem" }}
          >
            <span className="visually-hidden">Cargando...</span>
          </div>
          <p className="mt-3 text-muted">Cargando pagos...</p>
        </div>
      ) : (
        <TablaPagos
          pagos={pagosFiltrados}
          prestamos={prestamos}
          usuarios={usuarios}
          pagosPorPrestamo={pagosPorPrestamo}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      )}

      {/* Modal */}
      {showModal && (
        <ModalPago
          show={showModal}
          editPago={editPago}
          form={form}
          prestamos={prestamos}
          usuarios={usuarios}
          onClose={() => setShowModal(false)}
          onSubmit={handleSubmit}
          handleInput={handleInput}
        />
      )}
    </div>
  );
}

// ==================== COMPONENTE TABLA PAGOS ====================
function TablaPagos({
  pagos,
  prestamos,
  usuarios,
  pagosPorPrestamo,
  onEdit,
  onDelete,
}) {
  if (!pagos || pagos.length === 0) {
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
              background: "rgba(52, 152, 219, 0.1)",
            }}
          >
            <FaMoneyCheckAlt style={{ fontSize: "36px", color: "#3498db" }} />
          </div>
          <h5 className="text-muted fw-semibold">No hay pagos registrados</h5>
          <p className="text-muted mb-0">Registra un nuevo pago para comenzar</p>
        </div>
      </div>
    );
  }

  const getPrestamo = (id_prestamo) => {
    return prestamos.find((pr) => pr.id_prestamo === id_prestamo);
  };

  const getUsuario = (id_usuario) => {
    return usuarios.find((u) => u.id_usuario === id_usuario);
  };

  const calcularProgresoPrestamo = (id_prestamo) => {
    const prestamo = getPrestamo(id_prestamo);
    if (!prestamo) return 0;

    const montoPrestamo = parseFloat(prestamo.monto || 0);
    const saldoRestante = parseFloat(prestamo.saldo_restante || montoPrestamo);
    const montoPagado = montoPrestamo - saldoRestante;

    return montoPrestamo > 0 ? (montoPagado / montoPrestamo) * 100 : 0;
  };

  return (
    <div className="card border-0 shadow-sm" style={{ borderRadius: "15px" }}>
      {/* Header */}
      <div
        className="text-white p-3"
        style={{
          background: "linear-gradient(135deg, #3498db 0%, #2980b9 100%)",
          borderRadius: "15px 15px 0 0",
        }}
      >
        <div className="row g-2 align-items-center fw-semibold">
          <div className="col-auto" style={{ width: "50px" }}>
            #
          </div>
          <div className="col-3">Socio / Préstamo</div>
          <div className="col-2 text-center">Monto Pagado</div>
          <div className="col-2 text-center">Fecha / Método</div>
          <div className="col-2 text-center">Progreso</div>
          <div className="col text-center">Acciones</div>
        </div>
      </div>

      {/* Body */}
      <div className="card-body p-0">
        <div style={{ maxHeight: "600px", overflowY: "auto" }}>
          {pagos.map((pago, index) => {
            const prestamo = getPrestamo(pago.id_prestamo);
            const usuario = prestamo ? getUsuario(prestamo.id_usuario) : null;
            const progreso = calcularProgresoPrestamo(pago.id_prestamo);
            const fecha = (pago.fecha_pago || pago.fecha || "").substring(0, 10) || "-";

            // Determinar estado del préstamo
            const saldoRestante = parseFloat(prestamo?.saldo_restante || 0);
            const completado = saldoRestante <= 0;

            return (
              <div
                key={pago.id_pago}
                className="border-bottom"
                style={{
                  transition: "all 0.3s ease",
                  background: "white",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#f8f9fa";
                  e.currentTarget.style.transform = "scale(1.01)";
                  e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.08)";
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
                        background: "rgba(52, 152, 219, 0.1)",
                        color: "#3498db",
                        fontSize: "14px",
                      }}
                    >
                      {index + 1}
                    </div>
                  </div>

                  {/* Socio / Préstamo */}
                  <div className="col-3">
                    <div className="d-flex align-items-center">
                      <div
                        className="rounded-circle d-flex align-items-center justify-content-center me-2"
                        style={{
                          width: "40px",
                          height: "40px",
                          background: "linear-gradient(135deg, #3498db, #2980b9)",
                          color: "white",
                          flexShrink: 0,
                        }}
                      >
                        <FaUser style={{ fontSize: "18px" }} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div
                          className="fw-semibold text-truncate"
                          style={{ color: "#2c3e50", fontSize: "14px" }}
                        >
                          {usuario?.nombre_completo || "N/A"}
                        </div>
                        <div
                          className="text-muted small d-flex align-items-center"
                          style={{ fontSize: "12px" }}
                        >
                          <FaFileInvoiceDollar className="me-1" />
                          Préstamo #{pago.id_prestamo}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Monto Pagado */}
                  <div className="col-2 text-center">
                    <div className="d-flex align-items-center justify-content-center">
                      <FaMoneyBillWave
                        className="me-2"
                        style={{ color: "#27ae60", fontSize: "20px" }}
                      />
                      <div>
                        <div
                          className="fw-bold"
                          style={{ fontSize: "18px", color: "#27ae60" }}
                        >
                          L. {parseFloat(pago.monto_pagado || pago.monto || 0).toFixed(2)}
                        </div>
                        {/* Desglose capital / interés si existe */}
                        {(pago.monto_interes != null || pago.monto_capital != null) && (
                          <div className="d-flex gap-1 justify-content-center mt-1 flex-wrap">
                            <span style={{
                              fontSize: "0.68rem", fontWeight: 600,
                              background: "rgba(230,126,34,0.12)",
                              color: "#d35400",
                              border: "1px solid #e67e22",
                              borderRadius: 4, padding: "1px 5px",
                            }}>
                              Int. L.{parseFloat(pago.monto_interes || 0).toFixed(2)}
                            </span>
                            <span style={{
                              fontSize: "0.68rem", fontWeight: 600,
                              background: "rgba(39,174,96,0.12)",
                              color: "#1e8449",
                              border: "1px solid #27ae60",
                              borderRadius: 4, padding: "1px 5px",
                            }}>
                              Cap. L.{parseFloat(pago.monto_capital || 0).toFixed(2)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Fecha + Método */}
                  <div className="col-2 text-center">
                    <div
                      className="badge px-3 py-2 d-inline-flex align-items-center mb-1"
                      style={{
                        background: "rgba(155, 89, 182, 0.1)",
                        color: "#9b59b6",
                        fontWeight: "600",
                        fontSize: "12px",
                        border: "2px solid #9b59b6",
                        borderRadius: "10px",
                        display: "block",
                      }}
                    >
                      <FaCalendarAlt className="me-1" />
                      {fecha}
                    </div>
                    {pago.metodo_pago && (() => {
                      const metodoBadge = {
                        efectivo:          { label: "💵 Efectivo",      color: "#27ae60", bg: "rgba(39,174,96,0.1)" },
                        transferencia:     { label: "🏦 Transferencia", color: "#3498db", bg: "rgba(52,152,219,0.1)" },
                        cheque:            { label: "📋 Cheque",         color: "#9b59b6", bg: "rgba(155,89,182,0.1)" },
                        deposito:          { label: "🏧 Depósito",       color: "#e67e22", bg: "rgba(230,126,34,0.1)" },
                        "tarjeta de débito": { label: "💳 T. Débito",    color: "#e74c3c", bg: "rgba(231,76,60,0.1)" },
                        "pago móvil":       { label: "📱 Pago Móvil",    color: "#1abc9c", bg: "rgba(26,188,156,0.1)" },
                      };
                      const m = metodoBadge[pago.metodo_pago.toLowerCase()] || { label: pago.metodo_pago, color: "#7f8c8d", bg: "#f1f1f1" };
                      return (
                        <div
                          className="badge px-2 py-1"
                          style={{
                            background: m.bg,
                            color: m.color,
                            border: `1.5px solid ${m.color}`,
                            borderRadius: "8px",
                            fontSize: "11px",
                            fontWeight: "600",
                            display: "block",
                          }}
                        >
                          {m.label}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Progreso */}
                  <div className="col-2 text-center">
                    <div className="d-flex align-items-center justify-content-center">
                      <div style={{ width: "50px", height: "50px", marginRight: "12px" }}>
                        <CircularProgressbar
                          value={progreso}
                          text={`${Math.round(progreso)}%`}
                          styles={buildStyles({
                            textSize: "28px",
                            pathColor: completado ? "#27ae60" : "#3498db",
                            textColor: completado ? "#27ae60" : "#3498db",
                            trailColor: "#e9ecef",
                            pathTransitionDuration: 0.5,
                          })}
                        />
                      </div>
                      <div>
                        {completado ? (
                          <span
                            className="badge"
                            style={{
                              background: "rgba(39, 174, 96, 0.1)",
                              color: "#27ae60",
                              border: "2px solid #27ae60",
                              fontSize: "11px",
                              padding: "4px 8px",
                            }}
                          >
                            <FaCheckCircle className="me-1" />
                            Completado
                          </span>
                        ) : (
                          <span
                            className="badge"
                            style={{
                              background: "rgba(52, 152, 219, 0.1)",
                              color: "#3498db",
                              border: "2px solid #3498db",
                              fontSize: "11px",
                              padding: "4px 8px",
                            }}
                          >
                            <FaClock className="me-1" />
                            En curso
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Acciones */}
                  <div className="col text-center">
                    <div className="btn-group" role="group">
                      <button
                        className="btn btn-sm"
                        onClick={() => onEdit(pago)}
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
                        onClick={() => onDelete(pago.id_pago)}
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
          Total de pagos: <span className="text-primary fw-bold">{pagos.length}</span>
          {" | "}
          Monto total: <span className="text-success fw-bold">
            L. {pagos.reduce((sum, p) => sum + parseFloat(p.monto_pagado || p.monto || 0), 0).toFixed(2)}
          </span>
        </p>
      </div>
    </div>
  );
}

// ==================== COMPONENTE MODAL PAGO ====================
function ModalPago({
  show,
  editPago,
  form,
  prestamos,
  usuarios,
  onClose,
  onSubmit,
  handleInput,
}) {
  if (!show) return null;

  // Obtener info del préstamo seleccionado
  const prestamoSeleccionado = prestamos.find(
    (p) => p.id_prestamo === parseInt(form.id_prestamo)
  );
  const usuarioSeleccionado = prestamoSeleccionado
    ? usuarios.find((u) => u.id_usuario === prestamoSeleccionado.id_usuario)
    : null;

  // Cálculos de interés / capital en tiempo real
  const esIndefinido = parseInt(prestamoSeleccionado?.plazo_meses) === 0;
  const saldoActualPrestamo = parseFloat(prestamoSeleccionado?.saldo_restante || 0);
  const tasaMensual = prestamoSeleccionado
    ? parseFloat(prestamoSeleccionado.tasa_interes) / 100 / 12
    : 0;
  const interesEsperado = parseFloat((saldoActualPrestamo * tasaMensual).toFixed(2));
  const montoPagoIngresado = parseFloat(form.monto) || 0;
  const interesDelPago = parseFloat(Math.min(montoPagoIngresado, interesEsperado).toFixed(2));
  const capitalDelPago = parseFloat(Math.max(0, montoPagoIngresado - interesEsperado).toFixed(2));
  const hayDesglose = prestamoSeleccionado && montoPagoIngresado > 0;

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
              background: "linear-gradient(135deg, #3498db 0%, #2980b9 100%)",
              padding: "24px",
            }}
          >
            <h4 className="modal-title mb-0 d-flex align-items-center fw-bold">
              <FaMoneyCheckAlt className="me-3" style={{ fontSize: "24px" }} />
              {editPago ? "Editar Pago" : "Registrar Pago"}
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
              {/* Préstamo */}
              <div className="col-12">
                <label
                  className="form-label fw-semibold d-flex align-items-center"
                  style={{ color: "#2c3e50" }}
                >
                  <FaFileInvoiceDollar
                    className="me-2"
                    style={{ color: "#3498db" }}
                  />
                  Préstamo
                </label>
                <select
                  className="form-select form-select-lg"
                  name="id_prestamo"
                  value={form.id_prestamo}
                  onChange={handleInput}
                  required
                  style={{
                    borderRadius: "10px",
                    border: "2px solid #e9ecef",
                    padding: "12px 16px",
                  }}
                >
                  <option value="">Seleccionar préstamo...</option>
                  {prestamos.map((pr) => {
                    const usuario = usuarios.find(
                      (u) => u.id_usuario === pr.id_usuario
                    );
                    const saldo = parseFloat(pr.saldo_restante || 0);
                    return (
                      <option key={pr.id_prestamo} value={pr.id_prestamo}>
                        #{pr.id_prestamo} - {usuario?.nombre_completo || "N/A"} -
                        Saldo: L.{saldo.toFixed(2)}
                      </option>
                    );
                  })}
                </select>

                {/* Info del préstamo seleccionado */}
                {prestamoSeleccionado && (
                  <div
                    className="mt-3 p-3"
                    style={{
                      background: "rgba(52, 152, 219, 0.1)",
                      borderRadius: "10px",
                      border: "2px solid rgba(52, 152, 219, 0.3)",
                    }}
                  >
                    <div className="row g-2 small">
                      <div className="col-6">
                        <strong>Socio:</strong> {usuarioSeleccionado?.nombre_completo}
                      </div>
                      <div className="col-6">
                        <strong>Monto Préstamo:</strong> L.
                        {parseFloat(prestamoSeleccionado.monto).toFixed(2)}
                      </div>
                      <div className="col-6">
                        <strong>Saldo Restante:</strong>{" "}
                        <span style={{ color: "#e74c3c", fontWeight: "bold" }}>
                          L.
                          {parseFloat(
                            prestamoSeleccionado.saldo_restante || 0
                          ).toFixed(2)}
                        </span>
                      </div>
                      <div className="col-6">
                        <strong>Estado:</strong>{" "}
                        <span
                          className="badge"
                          style={{
                            background:
                              prestamoSeleccionado.estado === "activo"
                                ? "rgba(39, 174, 96, 0.2)"
                                : "rgba(149, 165, 166, 0.2)",
                            color:
                              prestamoSeleccionado.estado === "activo"
                                ? "#27ae60"
                                : "#95a5a6",
                          }}
                        >
                          {prestamoSeleccionado.estado}
                        </span>
                      </div>
                      {esIndefinido && (
                        <div className="col-12 mt-1">
                          <div style={{
                            background: "#fff3cd",
                            border: "1px solid #ffc107",
                            borderRadius: 8,
                            padding: "6px 10px",
                            fontSize: "0.82rem",
                            color: "#856404",
                          }}>
                            ♾ <strong>Préstamo indefinido</strong> — Interés mensual esperado:
                            {" "}<strong>L. {interesEsperado.toFixed(2)}</strong>.
                            Cualquier monto mayor abona al capital.
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Monto y Fecha */}
              <div className="col-md-6">
                <label
                  className="form-label fw-semibold d-flex align-items-center"
                  style={{ color: "#2c3e50" }}
                >
                  <FaMoneyBillWave className="me-2" style={{ color: "#27ae60" }} />
                  Monto del Pago (L.)
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
                  max={
                    prestamoSeleccionado && !esIndefinido
                      ? parseFloat(prestamoSeleccionado.saldo_restante || 0)
                      : undefined
                  }
                  style={{
                    borderRadius: "10px",
                    border: "2px solid #e9ecef",
                    padding: "12px 16px",
                  }}
                />

                {/* Desglose interés / capital en tiempo real */}
                {hayDesglose && (
                  <div className="mt-2 p-3" style={{
                    background: capitalDelPago > 0 ? "rgba(39,174,96,0.07)" : "rgba(52,152,219,0.07)",
                    border: `1.5px solid ${capitalDelPago > 0 ? "#27ae60" : "#3498db"}`,
                    borderRadius: 10,
                  }}>
                    <div className="small fw-bold mb-2" style={{ color: "#2c3e50" }}>
                      📊 Desglose del pago
                    </div>
                    <div className="d-flex justify-content-between small mb-1">
                      <span style={{ color: "#7f8c8d" }}>Interés del período:</span>
                      <strong style={{ color: "#e67e22" }}>L. {interesDelPago.toFixed(2)}</strong>
                    </div>
                    <div className="d-flex justify-content-between small mb-2">
                      <span style={{ color: "#7f8c8d" }}>Abono a capital:</span>
                      <strong style={{ color: capitalDelPago > 0 ? "#27ae60" : "#95a5a6" }}>
                        L. {capitalDelPago.toFixed(2)}
                      </strong>
                    </div>
                    {/* Barra visual */}
                    <div style={{ height: 8, borderRadius: 4, background: "#e9ecef", overflow: "hidden" }}>
                      <div style={{
                        height: "100%",
                        borderRadius: 4,
                        width: montoPagoIngresado > 0 ? `${Math.min(100, interesDelPago / montoPagoIngresado * 100).toFixed(1)}%` : "0%",
                        background: "linear-gradient(90deg, #e67e22, #f39c12)",
                        transition: "width .35s",
                      }} />
                    </div>
                    <div className="d-flex justify-content-between" style={{ fontSize: "0.72rem", color: "#aaa", marginTop: 3 }}>
                      <span>🟠 Interés</span>
                      <span>🟢 Capital</span>
                    </div>
                    {capitalDelPago > 0 && (
                      <div className="small mt-2" style={{ color: "#27ae60" }}>
                        ✔ Nuevo saldo estimado: <strong>L. {Math.max(0, saldoActualPrestamo - capitalDelPago).toFixed(2)}</strong>
                      </div>
                    )}
                    {montoPagoIngresado < interesEsperado && esIndefinido && (
                      <div className="small mt-1" style={{ color: "#e74c3c" }}>
                        ⚠ El monto es menor al interés mensual (L. {interesEsperado.toFixed(2)})
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="col-md-6">
                <label
                  className="form-label fw-semibold d-flex align-items-center"
                  style={{ color: "#2c3e50" }}
                >
                  <FaCalendarAlt className="me-2" style={{ color: "#3498db" }} />
                  Fecha del Pago
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

              {/* Método de Pago */}
              <div className="col-12">
                <label
                  className="form-label fw-semibold d-flex align-items-center"
                  style={{ color: "#2c3e50" }}
                >
                  <FaMoneyCheckAlt className="me-2" style={{ color: "#27ae60" }} />
                  Método de Pago
                </label>
                <div className="row g-2">
                  {[
                    { value: "Efectivo",           icon: "💵",  color: "#27ae60", bg: "rgba(39,174,96,0.08)",  border: "#27ae60" },
                    { value: "Transferencia",      icon: "🏦",  color: "#3498db", bg: "rgba(52,152,219,0.08)", border: "#3498db" },
                    { value: "Cheque",             icon: "📋",  color: "#9b59b6", bg: "rgba(155,89,182,0.08)", border: "#9b59b6" },
                    { value: "Deposito",           icon: "🏧",  color: "#e67e22", bg: "rgba(230,126,34,0.08)", border: "#e67e22" },
                    { value: "Tarjeta de débito", icon: "💳",  color: "#e74c3c", bg: "rgba(231,76,60,0.08)",  border: "#e74c3c" },
                    { value: "Pago móvil",         icon: "📱",  color: "#1abc9c", bg: "rgba(26,188,156,0.08)", border: "#1abc9c" },
                  ].map(({ value, icon, color, bg, border }) => (
                    <div className="col-6 col-md-4" key={value}>
                      <button
                        type="button"
                        onClick={() => handleInput({ target: { name: "metodo_pago", value } })}
                        style={{
                          width: "100%",
                          padding: "10px 12px",
                          borderRadius: "10px",
                          border: `2px solid ${form.metodo_pago === value ? border : "#e9ecef"}`,
                          background: form.metodo_pago === value ? bg : "white",
                          color: form.metodo_pago === value ? color : "#7f8c8d",
                          fontWeight: form.metodo_pago === value ? "700" : "500",
                          fontSize: "13px",
                          textAlign: "left",
                          transition: "all 0.2s ease",
                          cursor: "pointer",
                        }}
                      >
                        <span className="me-2" style={{ fontSize: "16px" }}>{icon}</span>
                        {value}
                        {form.metodo_pago === value && (
                          <span className="float-end" style={{ color }}>✓</span>
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Descripción */}
              <div className="col-12">
                <label
                  className="form-label fw-semibold d-flex align-items-center"
                  style={{ color: "#2c3e50" }}
                >
                  <FaFileInvoiceDollar
                    className="me-2"
                    style={{ color: "#3498db" }}
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
                  placeholder="Ej: Pago de cuota mensual, pago adelantado, etc."
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
                background: "linear-gradient(135deg, #3498db 0%, #2980b9 100%)",
                color: "white",
                border: "none",
                borderRadius: "10px",
                padding: "12px 32px",
                fontWeight: "600",
              }}
            >
              <FaMoneyCheckAlt className="me-2" />
              {editPago ? "Guardar Cambios" : "Registrar Pago"}
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
