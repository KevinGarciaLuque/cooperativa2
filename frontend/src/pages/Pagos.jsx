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

const fmt = (n) =>
  parseFloat(n || 0).toLocaleString("es-HN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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
                    L. {fmt(montoTotal)}
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
                    L. {fmt(montoMes)}
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
                    L. {fmt(promedioPago)}
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
                      formatter={(value) => `L. ${fmt(value)}`}
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
          pagos={pagos}
          onClose={() => setShowModal(false)}
          onSubmit={handleSubmit}
          handleInput={handleInput}
        />
      )}
    </div>
  );
}

// ==================== COMPONENTE TABLA PAGOS (agrupada por socio) ====================
function TablaPagos({ pagos, prestamos, usuarios, onEdit, onDelete }) {
  const [usuarioModal, setUsuarioModal] = useState(null);

  if (!pagos || pagos.length === 0) {
    return (
      <div className="card border-0 shadow-sm" style={{ borderRadius: "15px" }}>
        <div className="card-body text-center py-5">
          <div className="rounded-circle mx-auto d-flex align-items-center justify-content-center mb-3"
            style={{ width: "80px", height: "80px", background: "rgba(52,152,219,0.1)" }}>
            <FaMoneyCheckAlt style={{ fontSize: "36px", color: "#3498db" }} />
          </div>
          <h5 className="text-muted fw-semibold">No hay pagos registrados</h5>
          <p className="text-muted mb-0">Registra un nuevo pago para comenzar</p>
        </div>
      </div>
    );
  }

  const getPrestamo = (id_prestamo) => prestamos.find((pr) => pr.id_prestamo === id_prestamo);

  // Agrupar pagos por id_usuario (vía prestamos)
  const gruposMap = {};
  pagos.forEach((pago) => {
    const prestamo = getPrestamo(pago.id_prestamo);
    const id_usuario = prestamo?.id_usuario ?? `__${pago.nombre_completo}`;
    if (!gruposMap[id_usuario]) {
      gruposMap[id_usuario] = { id_usuario, nombre: pago.nombre_completo || "N/A", pagos: [] };
    }
    gruposMap[id_usuario].pagos.push(pago);
  });
  const grupos = Object.values(gruposMap).sort((a, b) => a.nombre.localeCompare(b.nombre));

  const montoTotalFooter = pagos.reduce((s, p) => s + parseFloat(p.monto_pagado || p.monto || 0), 0);
  const grupoSeleccionado = usuarioModal !== null ? gruposMap[usuarioModal] : null;

  const metodoBadgeMap = {
    efectivo:            { label: "💵 Efectivo",      color: "#27ae60" },
    transferencia:       { label: "🏦 Transferencia", color: "#3498db" },
    cheque:              { label: "📋 Cheque",         color: "#9b59b6" },
    deposito:            { label: "🏧 Depósito",       color: "#e67e22" },
    "tarjeta de débito": { label: "💳 T. Débito",      color: "#e74c3c" },
    "pago móvil":        { label: "📱 Pago Móvil",     color: "#1abc9c" },
  };

  return (
    <>
      <div className="card border-0 shadow-sm" style={{ borderRadius: "15px" }}>
        {/* Header */}
        <div className="text-white p-3"
          style={{ background: "linear-gradient(135deg,#3498db 0%,#2980b9 100%)", borderRadius: "15px 15px 0 0" }}>
          <div className="d-none d-lg-flex align-items-center fw-semibold" style={{ gap: 0 }}>
            <div style={{ width: "44px" }}>#</div>
            <div style={{ flex: "0 0 28%" }}>Socio</div>
            <div style={{ flex: "0 0 16%", textAlign: "center" }}>Progreso</div>
            <div style={{ flex: "0 0 18%", textAlign: "center" }}>Total Pagado</div>
            <div style={{ flex: "0 0 22%", textAlign: "center" }}>Último Pago</div>
            <div style={{ flex: 1, textAlign: "center" }}>Historial</div>
          </div>
          <div className="d-flex d-lg-none align-items-center gap-2 fw-semibold">
            <FaMoneyCheckAlt style={{ fontSize: "18px" }} />
            Socios con Pagos
          </div>
        </div>

        {/* Body */}
        <div className="card-body p-0">
          <div style={{ maxHeight: "680px", overflowY: "auto" }}>
            {grupos.map((grupo, index) => {
              const totalPagado = grupo.pagos.reduce((s, p) => s + parseFloat(p.monto_pagado || p.monto || 0), 0);
              const numPagos = grupo.pagos.length;
              const prestamosIds = [...new Set(grupo.pagos.map(p => p.id_prestamo))];

              const ultimaFechaStr = grupo.pagos
                .map(p => (p.fecha_pago || p.fecha || "").substring(0, 10))
                .filter(Boolean)
                .sort()
                .reverse()[0] || "";

              // Método más frecuente
              const metodoCount = {};
              grupo.pagos.forEach(p => {
                const k = (p.metodo_pago || "").toLowerCase();
                metodoCount[k] = (metodoCount[k] || 0) + 1;
              });
              const metodoTop = Object.entries(metodoCount).sort((a, b) => b[1] - a[1])[0]?.[0] || "";
              const m = metodoBadgeMap[metodoTop] || { label: metodoTop || "—", color: "#7f8c8d" };

              // Progreso promedio de sus préstamos
              const progresosArr = prestamosIds.map(id => {
                const pr = getPrestamo(id);
                if (!pr) return 0;
                const mp = parseFloat(pr.monto || 0);
                const sr = parseFloat(pr.saldo_restante || mp);
                return mp > 0 ? ((mp - sr) / mp) * 100 : 0;
              });
              const progresoPromedio = progresosArr.length
                ? progresosArr.reduce((a, b) => a + b, 0) / progresosArr.length : 0;
              const completados = prestamosIds.filter(id => {
                const pr = getPrestamo(id);
                return pr && parseFloat(pr.saldo_restante || 0) <= 0;
              }).length;
              const todosCompletos = completados === prestamosIds.length;

              const iniciales = grupo.nombre.split(" ").slice(0, 2).map(n => n[0] || "").join("").toUpperCase();

              return (
                <div key={grupo.id_usuario} className="border-bottom"
                  style={{ transition: "background 0.2s", background: "white", cursor: "pointer" }}
                  onClick={() => setUsuarioModal(grupo.id_usuario)}
                  onMouseEnter={e => (e.currentTarget.style.background = "#f0f6ff")}
                  onMouseLeave={e => (e.currentTarget.style.background = "white")}>

                  {/* ── Desktop ── */}
                  <div className="d-none d-lg-flex align-items-center px-3 py-3" style={{ gap: 0 }}>
                    {/* # */}
                    <div style={{ width: "44px" }}>
                      <div className="rounded-circle d-flex align-items-center justify-content-center fw-bold"
                        style={{ width: 32, height: 32, background: "rgba(52,152,219,0.1)", color: "#3498db", fontSize: 13 }}>
                        {index + 1}
                      </div>
                    </div>

                    {/* Socio */}
                    <div style={{ flex: "0 0 28%", minWidth: 0 }}>
                      <div className="d-flex align-items-center gap-2">
                        <div className="rounded-circle d-flex align-items-center justify-content-center fw-bold flex-shrink-0"
                          style={{ width: 44, height: 44, background: "linear-gradient(135deg,#3498db,#2980b9)", color: "white", fontSize: 16 }}>
                          {iniciales}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div className="fw-semibold text-truncate" style={{ color: "#2c3e50", fontSize: 14 }}>
                            {grupo.nombre}
                          </div>
                          <div className="d-flex gap-1 flex-wrap mt-1">
                            <span style={{ fontSize: "0.69rem", background: "rgba(52,152,219,0.1)", color: "#2980b9", border: "1px solid #3498db", borderRadius: 5, padding: "1px 6px", fontWeight: 600 }}>
                              {prestamosIds.length} préstamo{prestamosIds.length !== 1 ? "s" : ""}
                            </span>
                            <span style={{ fontSize: "0.69rem", background: "rgba(39,174,96,0.1)", color: "#1e8449", border: "1px solid #27ae60", borderRadius: 5, padding: "1px 6px", fontWeight: 600 }}>
                              {numPagos} pago{numPagos !== 1 ? "s" : ""}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Progreso */}
                    <div style={{ flex: "0 0 16%", textAlign: "center" }}>
                      <div style={{ width: 50, height: 50, margin: "0 auto" }}>
                        <CircularProgressbar value={progresoPromedio} text={`${Math.round(progresoPromedio)}%`}
                          styles={buildStyles({ textSize: "26px", pathColor: todosCompletos ? "#27ae60" : "#3498db", textColor: todosCompletos ? "#27ae60" : "#3498db", trailColor: "#e9ecef" })} />
                      </div>
                      <div style={{ fontSize: "0.67rem", color: "#7f8c8d", marginTop: 3 }}>
                        {completados}/{prestamosIds.length} completado{completados !== 1 ? "s" : ""}
                      </div>
                    </div>

                    {/* Total pagado */}
                    <div style={{ flex: "0 0 18%", textAlign: "center" }}>
                      <div className="fw-bold" style={{ fontSize: 18, color: "#27ae60" }}>
                        L. {fmt(totalPagado)}
                      </div>
                      <div style={{ fontSize: "0.72rem", color: "#7f8c8d" }}>acumulado</div>
                    </div>

                    {/* Último pago */}
                    <div style={{ flex: "0 0 22%", textAlign: "center" }}>
                      <div className="badge mb-1 d-inline-flex align-items-center"
                        style={{ background: "rgba(155,89,182,0.1)", color: "#9b59b6", border: "2px solid #9b59b6", borderRadius: 10, fontSize: 12, fontWeight: 600, padding: "4px 10px" }}>
                        <FaCalendarAlt className="me-1" />{ultimaFechaStr || "—"}
                      </div>
                      <div className="badge d-block"
                        style={{ background: "rgba(52,152,219,0.07)", color: m.color, border: `1.5px solid ${m.color}`, borderRadius: 8, fontSize: 11, fontWeight: 600 }}>
                        {m.label}
                      </div>
                    </div>

                    {/* Botón historial */}
                    <div style={{ flex: 1, textAlign: "center" }}>
                      <button className="btn btn-sm fw-semibold"
                        style={{ background: "linear-gradient(135deg,#3498db,#2980b9)", color: "white", border: "none", borderRadius: 8, padding: "7px 16px", fontSize: "0.78rem" }}
                        onClick={e => { e.stopPropagation(); setUsuarioModal(grupo.id_usuario); }}>
                        <FaFileInvoiceDollar className="me-1" />
                        Ver {numPagos} pago{numPagos !== 1 ? "s" : ""}
                      </button>
                    </div>
                  </div>

                  {/* ── Móvil ── */}
                  <div className="d-flex d-lg-none flex-column p-3 gap-2">
                    <div className="d-flex align-items-center justify-content-between gap-2">
                      <div className="d-flex align-items-center gap-2" style={{ minWidth: 0 }}>
                        <div className="rounded-circle d-flex align-items-center justify-content-center fw-bold flex-shrink-0"
                          style={{ width: 44, height: 44, background: "linear-gradient(135deg,#3498db,#2980b9)", color: "white", fontSize: 16 }}>
                          {iniciales}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div className="fw-semibold text-truncate" style={{ color: "#2c3e50", fontSize: 14 }}>{grupo.nombre}</div>
                          <div className="d-flex gap-1 flex-wrap mt-1">
                            <span style={{ fontSize: "0.69rem", background: "rgba(52,152,219,0.1)", color: "#2980b9", border: "1px solid #3498db", borderRadius: 5, padding: "1px 6px", fontWeight: 600 }}>
                              {prestamosIds.length} préstamo{prestamosIds.length !== 1 ? "s" : ""}
                            </span>
                            <span style={{ fontSize: "0.69rem", background: "rgba(39,174,96,0.1)", color: "#1e8449", border: "1px solid #27ae60", borderRadius: 5, padding: "1px 6px", fontWeight: 600 }}>
                              {numPagos} pagos
                            </span>
                          </div>
                        </div>
                      </div>
                      <button className="btn btn-sm fw-semibold flex-shrink-0"
                        style={{ background: "linear-gradient(135deg,#3498db,#2980b9)", color: "white", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: "0.75rem" }}
                        onClick={e => { e.stopPropagation(); setUsuarioModal(grupo.id_usuario); }}>
                        <FaFileInvoiceDollar className="me-1" />Ver
                      </button>
                    </div>
                    <div className="d-flex flex-wrap gap-2 align-items-center">
                      <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#27ae60" }}>L. {fmt(totalPagado)}</span>
                      <span className="badge d-inline-flex align-items-center gap-1"
                        style={{ background: "rgba(155,89,182,0.1)", color: "#9b59b6", border: "2px solid #9b59b6", borderRadius: 10, fontSize: 11, fontWeight: 600, padding: "4px 8px" }}>
                        <FaCalendarAlt />{ultimaFechaStr || "—"}
                      </span>
                      <span className="badge" style={{ background: "rgba(52,152,219,0.07)", color: m.color, border: `1.5px solid ${m.color}`, borderRadius: 8, fontSize: 11, fontWeight: 600, padding: "4px 8px" }}>
                        {m.label}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="card-footer bg-light border-top-0 py-3 px-3" style={{ borderRadius: "0 0 15px 15px" }}>
          <div className="d-flex flex-wrap justify-content-center gap-4 text-center">
            <span className="small fw-semibold text-muted">
              <FaUser className="me-1 text-primary" />
              Socios: <span className="text-primary fw-bold">{grupos.length}</span>
            </span>
            <span className="small fw-semibold text-muted">
              <FaCheckCircle className="me-1 text-success" />
              Total pagos: <span className="text-primary fw-bold">{pagos.length}</span>
            </span>
            <span className="small fw-semibold text-muted">
              Monto total: <span className="text-success fw-bold">L. {fmt(montoTotalFooter)}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Modal historial del socio */}
      {grupoSeleccionado && (
        <ModalHistorialPagos
          grupo={grupoSeleccionado}
          prestamos={prestamos}
          onClose={() => setUsuarioModal(null)}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      )}
    </>
  );
}

// ==================== MODAL HISTORIAL DE PAGOS POR SOCIO ====================
function ModalHistorialPagos({ grupo, prestamos, onClose, onEdit, onDelete }) {
  const getPrestamo = (id_prestamo) => prestamos.find((pr) => pr.id_prestamo === id_prestamo);

  // Agrupar pagos del socio por préstamo
  const pagosAgrupados = {};
  grupo.pagos.forEach(pago => {
    const key = pago.id_prestamo;
    if (!pagosAgrupados[key]) pagosAgrupados[key] = [];
    pagosAgrupados[key].push(pago);
  });

  const metodoBadgeMap = {
    efectivo:            { label: "💵 Efectivo",      color: "#27ae60", bg: "rgba(39,174,96,0.1)" },
    transferencia:       { label: "🏦 Transferencia", color: "#3498db", bg: "rgba(52,152,219,0.1)" },
    cheque:              { label: "📋 Cheque",         color: "#9b59b6", bg: "rgba(155,89,182,0.1)" },
    deposito:            { label: "🏧 Depósito",       color: "#e67e22", bg: "rgba(230,126,34,0.1)" },
    "tarjeta de débito": { label: "💳 T. Débito",      color: "#e74c3c", bg: "rgba(231,76,60,0.1)" },
    "pago móvil":        { label: "📱 Pago Móvil",     color: "#1abc9c", bg: "rgba(26,188,156,0.1)" },
  };

  const totalGeneral = grupo.pagos.reduce((s, p) => s + parseFloat(p.monto_pagado || p.monto || 0), 0);
  const iniciales = grupo.nombre.split(" ").slice(0, 2).map(n => n[0] || "").join("").toUpperCase();

  return (
    <div className="modal show d-block" tabIndex="-1"
      style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)", zIndex: 6000, position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", overflowY: "auto" }}
      onClick={onClose}>
      <div className="modal-dialog modal-dialog-centered modal-lg" style={{ maxWidth: 840 }}
        onClick={e => e.stopPropagation()}>
        <div className="modal-content border-0 shadow-lg" style={{ borderRadius: 16, overflow: "hidden" }}>

          {/* Header */}
          <div className="d-flex align-items-center justify-content-between text-white px-4 py-3"
            style={{ background: "linear-gradient(135deg,#3498db 0%,#2980b9 100%)" }}>
            <div className="d-flex align-items-center gap-3">
              <div className="rounded-circle d-flex align-items-center justify-content-center fw-bold"
                style={{ width: 46, height: 46, background: "rgba(255,255,255,0.2)", fontSize: 17 }}>
                {iniciales}
              </div>
              <div>
                <div className="fw-bold" style={{ fontSize: "1.05rem" }}>{grupo.nombre}</div>
                <div style={{ fontSize: "0.78rem", opacity: 0.85 }}>
                  {grupo.pagos.length} pago{grupo.pagos.length !== 1 ? "s" : ""} · Total acumulado: L. {fmt(totalGeneral)}
                </div>
              </div>
            </div>
            <button type="button" className="btn-close btn-close-white btn-sm" onClick={onClose} />
          </div>

          {/* Body */}
          <div className="modal-body p-0" style={{ background: "#f8fafc", maxHeight: "72vh", overflowY: "auto" }}>
            {Object.entries(pagosAgrupados).map(([id_prestamo, pagosList]) => {
              const prestamo = getPrestamo(parseInt(id_prestamo));
              const montoPr  = parseFloat(prestamo?.monto || 0);
              const saldoPr  = parseFloat(prestamo?.saldo_restante || montoPr);
              const pagadoPr = montoPr - saldoPr;
              const progresoPr = montoPr > 0 ? (pagadoPr / montoPr) * 100 : 0;
              const completado = saldoPr <= 0;
              const subtotalPr = pagosList.reduce((s, p) => s + parseFloat(p.monto_pagado || p.monto || 0), 0);

              return (
                <div key={id_prestamo}>
                  {/* Sub-cabecera del préstamo */}
                  <div className="px-4 py-2 d-flex flex-wrap align-items-center gap-2"
                    style={{ background: "#edf2f7", borderBottom: "1px solid #dee2e6" }}>
                    <span className="fw-bold" style={{ color: "#2c3e50", fontSize: "0.88rem" }}>
                      <FaFileInvoiceDollar className="me-1" style={{ color: "#3498db" }} />
                      Préstamo #{id_prestamo}
                    </span>
                    {prestamo && (
                      <>
                        <span style={{ fontSize: "0.75rem", color: "#7f8c8d" }}>
                          Principal: <strong style={{ color: "#2c3e50" }}>L. {fmt(montoPr)}</strong>
                        </span>
                        <span style={{ fontSize: "0.75rem", color: "#7f8c8d" }}>
                          Saldo: <strong style={{ color: "#e74c3c" }}>L. {fmt(saldoPr)}</strong>
                        </span>
                        <span style={{ fontSize: "0.75rem", color: "#7f8c8d" }}>
                          Pagado: <strong style={{ color: "#27ae60" }}>L. {fmt(pagadoPr)}</strong>
                        </span>
                        <span className="ms-auto badge"
                          style={completado
                            ? { background: "rgba(39,174,96,0.12)", color: "#1e8449", border: "1.5px solid #27ae60", fontSize: 11, padding: "3px 10px" }
                            : { background: "rgba(52,152,219,0.1)", color: "#2980b9", border: "1.5px solid #3498db", fontSize: 11, padding: "3px 10px" }}>
                          {completado
                            ? <><FaCheckCircle className="me-1" />Completado</>
                            : <><FaClock className="me-1" />{Math.round(progresoPr)}% pagado</>}
                        </span>
                      </>
                    )}
                  </div>
                  {/* Barra de progreso */}
                  <div style={{ height: 3, background: "#e9ecef" }}>
                    <div style={{ height: "100%", width: `${Math.min(progresoPr, 100)}%`, background: completado ? "#27ae60" : "#3498db", transition: "width .4s" }} />
                  </div>

                  {/* Filas de pagos */}
                  {pagosList
                    .sort((a, b) => new Date(b.fecha_pago || b.fecha) - new Date(a.fecha_pago || a.fecha))
                    .map((pago, idx) => {
                      const fecha = (pago.fecha_pago || pago.fecha || "").substring(0, 10);
                      const monto = parseFloat(pago.monto_pagado || pago.monto || 0);
                      const mp = metodoBadgeMap[(pago.metodo_pago || "").toLowerCase()] || { label: pago.metodo_pago || "—", color: "#7f8c8d", bg: "#f1f1f1" };

                      return (
                        <div key={pago.id_pago}
                          className="d-flex align-items-center flex-wrap gap-2 px-4 py-2 border-bottom"
                          style={{ background: idx % 2 === 0 ? "white" : "#fafbfc", fontSize: "0.84rem" }}>
                          {/* N° */}
                          <div className="rounded-circle d-flex align-items-center justify-content-center fw-bold flex-shrink-0"
                            style={{ width: 26, height: 26, background: "rgba(52,152,219,0.1)", color: "#3498db", fontSize: 11 }}>
                            {idx + 1}
                          </div>

                          {/* Monto */}
                          <div className="fw-bold flex-shrink-0" style={{ color: "#27ae60", minWidth: 95 }}>
                            L. {fmt(monto)}
                          </div>

                          {/* Desglose int/cap */}
                          {(pago.monto_interes != null || pago.monto_capital != null) && (
                            <div className="d-flex gap-1 flex-wrap">
                              <span style={{ fontSize: "0.68rem", fontWeight: 600, background: "rgba(230,126,34,0.12)", color: "#d35400", border: "1px solid #e67e22", borderRadius: 4, padding: "1px 5px" }}>
                                Int. L.{fmt(pago.monto_interes)}
                              </span>
                              <span style={{ fontSize: "0.68rem", fontWeight: 600, background: "rgba(39,174,96,0.12)", color: "#1e8449", border: "1px solid #27ae60", borderRadius: 4, padding: "1px 5px" }}>
                                Cap. L.{fmt(pago.monto_capital)}
                              </span>
                            </div>
                          )}

                          {/* Fecha */}
                          <span className="badge d-inline-flex align-items-center gap-1 flex-shrink-0"
                            style={{ background: "rgba(155,89,182,0.1)", color: "#9b59b6", border: "1.5px solid #9b59b6", borderRadius: 8, fontSize: 11, fontWeight: 600, padding: "3px 8px" }}>
                            <FaCalendarAlt style={{ fontSize: 10 }} />{fecha}
                          </span>

                          {/* Método */}
                          <span className="badge flex-shrink-0"
                            style={{ background: mp.bg, color: mp.color, border: `1.5px solid ${mp.color}`, borderRadius: 8, fontSize: 11, fontWeight: 600, padding: "3px 8px" }}>
                            {mp.label}
                          </span>

                          {/* Descripción */}
                          {pago.descripcion && (
                            <span className="text-muted" style={{ fontSize: "0.72rem", fontStyle: "italic", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              "{pago.descripcion}"
                            </span>
                          )}

                          {/* Acciones */}
                          <div className="ms-auto d-flex gap-1 flex-shrink-0">
                            <button className="btn btn-sm" title="Editar"
                              onClick={() => { onClose(); setTimeout(() => onEdit(pago), 60); }}
                              style={{ background: "rgba(52,152,219,0.1)", color: "#3498db", border: "1px solid #3498db", borderRadius: "6px 0 0 6px", padding: "3px 8px" }}
                              onMouseEnter={e => { e.currentTarget.style.background = "#3498db"; e.currentTarget.style.color = "white"; }}
                              onMouseLeave={e => { e.currentTarget.style.background = "rgba(52,152,219,0.1)"; e.currentTarget.style.color = "#3498db"; }}>
                              <FaEdit style={{ fontSize: 12 }} />
                            </button>
                            <button className="btn btn-sm" title="Eliminar"
                              onClick={() => onDelete(pago.id_pago)}
                              style={{ background: "rgba(231,76,60,0.1)", color: "#e74c3c", border: "1px solid #e74c3c", borderLeft: "none", borderRadius: "0 6px 6px 0", padding: "3px 8px" }}
                              onMouseEnter={e => { e.currentTarget.style.background = "#e74c3c"; e.currentTarget.style.color = "white"; }}
                              onMouseLeave={e => { e.currentTarget.style.background = "rgba(231,76,60,0.1)"; e.currentTarget.style.color = "#e74c3c"; }}>
                              <FaTrash style={{ fontSize: 12 }} />
                            </button>
                          </div>
                        </div>
                      );
                    })}

                  {/* Subtotal por préstamo */}
                  <div className="d-flex justify-content-end align-items-center gap-3 px-4 py-2"
                    style={{ background: "rgba(39,174,96,0.05)", borderBottom: "2px solid #e2e8f0" }}>
                    <span className="small text-muted">Subtotal préstamo #{id_prestamo}:</span>
                    <strong style={{ color: "#27ae60" }}>L. {fmt(subtotalPr)}</strong>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="modal-footer border-0 bg-white px-4 py-2 d-flex justify-content-between align-items-center">
            <div className="d-flex gap-4">
              <span className="small fw-semibold text-muted">
                <FaCheckCircle className="me-1 text-success" />
                Total pagos: <strong className="text-primary">{grupo.pagos.length}</strong>
              </span>
              <span className="small fw-semibold text-muted">
                Acumulado: <strong style={{ color: "#27ae60" }}>L. {fmt(totalGeneral)}</strong>
              </span>
            </div>
            <button type="button" className="btn btn-sm btn-light fw-semibold shadow-sm"
              onClick={onClose} style={{ borderRadius: 8, padding: "6px 20px" }}>
              Cerrar
            </button>
          </div>
        </div>
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
  pagos = [],
  onClose,
  onSubmit,
  handleInput,
}) {
  // ── Hooks SIEMPRE antes del early return (regla de React) ────────────
  const [fechaReferencia, setFechaReferencia] = useState("");
  const [busquedaPrestamo, setBusquedaPrestamo] = useState("");
  const [dropdownAbierto, setDropdownAbierto] = useState(false);
  const [tipoPago, setTipoPago] = useState("cuota_fija"); // "cuota_fija" | "desglose" | "indefinido"

  // Estado local para mostrar el monto con comas mientras se escribe
  const [montoDisplay, setMontoDisplay] = useState(() => {
    if (!form.monto && form.monto !== 0) return "";
    const raw = String(form.monto);
    const parts = raw.split(".");
    const intFmt = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return parts.length > 1 ? intFmt + "." + parts[1] : intFmt;
  });

  const handleMontoChange = (e) => {
    const raw = e.target.value.replace(/,/g, ""); // quitar comas
    if (raw !== "" && !/^\d*\.?\d*$/.test(raw)) return; // solo números
    // Formatear parte entera con comas
    const parts = raw.split(".");
    const intFmt = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    const display = parts.length > 1 ? intFmt + "." + parts[1] : intFmt;
    setMontoDisplay(display);
    handleInput({ target: { name: "monto", value: raw } });
  };

  // Préstamo seleccionado (necesario para useEffect)
  const prestamoSeleccionado = prestamos.find(
    (p) => p.id_prestamo === parseInt(form.id_prestamo)
  );

  // Cuando cambia el préstamo: inicio del período + auto-selección de tipo
  useEffect(() => {
    if (prestamoSeleccionado) {
      // Para desglose: usar fecha del último pago realizado como inicio de período
      const pagosDelPrestamo = pagos
        .filter(p => p.id_prestamo === prestamoSeleccionado.id_prestamo)
        .sort((a, b) => new Date(b.fecha_pago) - new Date(a.fecha_pago));
      const ultimaFecha = pagosDelPrestamo[0]?.fecha_pago?.substring(0, 10);
      setFechaReferencia(ultimaFecha || prestamoSeleccionado.fecha_otorgado?.substring(0, 10) || "");
    } else {
      setFechaReferencia("");
    }
    if (prestamoSeleccionado && !editPago) {
      setTipoPago(parseInt(prestamoSeleccionado.plazo_meses) === 0 ? "indefinido" : "cuota_fija");
    }
  // eslint-disable-next-line
  }, [prestamoSeleccionado?.id_prestamo]);

  // Auto-relleno de monto: Cuota Fija (se dispara al cambiar tipo o préstamo)
  useEffect(() => {
    if (editPago || !prestamoSeleccionado || tipoPago !== "cuota_fija") return;
    const valor = parseFloat((prestamoSeleccionado.cuota_mensual || 0).toFixed(2));
    const raw = String(valor);
    const parts = raw.split(".");
    const intFmt = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    setMontoDisplay(parts.length > 1 ? intFmt + "." + parts[1] : intFmt);
    handleInput({ target: { name: "monto", value: raw } });
  // eslint-disable-next-line
  }, [tipoPago, prestamoSeleccionado?.id_prestamo]);

  // Auto-relleno y recálculo: Desglose Total (se actualiza al cambiar período o fecha)
  useEffect(() => {
    if (editPago || !prestamoSeleccionado || tipoPago !== "desglose") return;
    const ref = fechaReferencia ? new Date(fechaReferencia + "T00:00:00") : null;
    const fechaPagoDate = form.fecha ? new Date(form.fecha + "T00:00:00") : null;
    const dias = (ref && fechaPagoDate)
      ? Math.max(1, Math.round((fechaPagoDate - ref) / (1000 * 60 * 60 * 24)))
      : 30;
    const tasaMens = parseFloat(prestamoSeleccionado.tasa_interes) / 100 / 12;
    const tasaDia = tasaMens / 30;
    const saldo = parseFloat(prestamoSeleccionado.saldo_restante || 0);
    const interes = parseFloat((saldo * tasaDia * dias).toFixed(2));
    const valor = parseFloat((saldo + interes).toFixed(2));
    const raw = String(valor);
    const parts = raw.split(".");
    const intFmt = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    setMontoDisplay(parts.length > 1 ? intFmt + "." + parts[1] : intFmt);
    handleInput({ target: { name: "monto", value: raw } });
  // eslint-disable-next-line
  }, [tipoPago, prestamoSeleccionado?.id_prestamo, fechaReferencia, form.fecha]);

  // Cuando cambia la fecha del pago: recalcular días (sin tocar fechaReferencia)
  // Se fuerza re-render natural — diasTranscurridos se recalcula automáticamente

  if (!show) return null;

  const usuarioSeleccionado = prestamoSeleccionado
    ? usuarios.find((u) => u.id_usuario === prestamoSeleccionado.id_usuario)
    : null;

  // ── Cálculo de interés proporcional por días ─────────────────────────
  const esIndefinido = parseInt(prestamoSeleccionado?.plazo_meses) === 0;
  const saldoActualPrestamo = parseFloat(prestamoSeleccionado?.saldo_restante || 0);

  // Tasa mensual (la BD guarda tasa anual / 12)
  const tasaMensual = prestamoSeleccionado
    ? parseFloat(prestamoSeleccionado.tasa_interes) / 100 / 12
    : 0;

  // Días transcurridos entre la fecha de referencia y la fecha del pago
  const calcularDias = () => {
    if (!fechaReferencia || !form.fecha) return 30;
    const ref  = new Date(fechaReferencia + "T00:00:00");
    const pago = new Date(form.fecha      + "T00:00:00");
    const diff = Math.round((pago - ref) / (1000 * 60 * 60 * 24));
    return diff >= 1 ? diff : 1; // mínimo 1 día
  };
  const diasTranscurridos = prestamoSeleccionado ? calcularDias() : 30;
  const tasaDiaria = tasaMensual / 30;                       // tasa diaria = mensual / 30
  // Cuota fija: siempre usa tasa mensual completa (30 días), nunca días del calendario
  const diasParaCalculo = tipoPago === "cuota_fija" ? 30 : diasTranscurridos;
  const interesEsperado = parseFloat(
    (saldoActualPrestamo * tasaDiaria * diasParaCalculo).toFixed(2)
  );
  const interesBase30 = parseFloat((saldoActualPrestamo * tasaMensual).toFixed(2)); // referencia mes completo

  const montoPagoIngresado = parseFloat(form.monto) || 0;
  const interesDelPago = parseFloat(Math.min(montoPagoIngresado, interesEsperado).toFixed(2));
  const capitalDelPago = parseFloat(Math.max(0, montoPagoIngresado - interesEsperado).toFixed(2));
  const hayDesglose = prestamoSeleccionado && montoPagoIngresado > 0;

  return (
    <div
      className="modal show d-block"
      tabIndex="-1"
      style={{
        background: "rgba(0,0,0,0.65)",
        backdropFilter: "blur(4px)",
        zIndex: 5000,
        position: "fixed",
        top: 0, left: 0,
        width: "100vw", height: "100vh",
        overflowY: "auto",
      }}
    >
      <div
        className="modal-dialog modal-dialog-centered"
        style={{ maxWidth: 760 }}
        onClick={(e) => e.stopPropagation()}
      >
        <form
          className="modal-content border-0 shadow-lg"
          onSubmit={onSubmit}
          style={{ borderRadius: "16px", overflow: "hidden" }}
        >
          {/* ── Header ── */}
          <div
            className="d-flex align-items-center justify-content-between text-white px-4 py-3"
            style={{ background: "linear-gradient(135deg,#3498db 0%,#2980b9 100%)" }}
          >
            <div className="d-flex align-items-center gap-2">
              <FaMoneyBillWave style={{ fontSize: 18 }} />
              <span className="fw-bold" style={{ fontSize: "1rem" }}>
                {editPago ? "Editar Pago" : "Registrar Pago"}
              </span>
            </div>
            <button type="button" className="btn-close btn-close-white btn-sm" onClick={onClose} />
          </div>

          {/* ── Body: 2 columnas ── */}
          <div className="modal-body p-0" style={{ background: "#f8fafc" }}>
            <div className="row g-0">

              {/* Columna izquierda — formulario */}
              <div className="col-lg-7 p-3 d-flex flex-column gap-3" style={{ borderRight: "1px solid #e2e8f0" }}>

                {/* ── Tipo de Pago ── */}
                <div>
                  <label className="form-label fw-semibold small mb-1" style={{ color: "#2c3e50" }}>
                    🏷️ Tipo de Pago
                  </label>
                  <div className="d-flex gap-2 flex-wrap">
                    {[
                      { value: "cuota_fija", icon: "💰", label: "Cuota Fija",     color: "#3498db", desc: "Cuota mensual acordada" },
                      { value: "desglose",   icon: "📊", label: "Desglose Total", color: "#27ae60", desc: "Liquida saldo + interés exacto por días" },
                      { value: "indefinido", icon: "♾️", label: "Pago Libre",     color: "#e67e22", desc: "Monto personalizado" },
                    ].map(({ value, icon, label, color, desc }) => {
                      const sel = tipoPago === value;
                      const esIndef = parseInt(prestamoSeleccionado?.plazo_meses) === 0;
                      const disabled = value === "indefinido" && !!prestamoSeleccionado && !esIndef;
                      return (
                        <button
                          key={value}
                          type="button"
                          disabled={disabled}
                          title={desc}
                          onClick={() => !disabled && setTipoPago(value)}
                          style={{
                            flex: "1 1 100px",
                            padding: "6px 8px",
                            borderRadius: 10,
                            border: `2px solid ${sel ? color : disabled ? "#e9ecef" : "#dee2e6"}`,
                            background: sel ? color + "18" : disabled ? "#f8f9fa" : "white",
                            color: sel ? color : disabled ? "#adb5bd" : "#495057",
                            fontWeight: sel ? 700 : 500,
                            fontSize: "0.75rem",
                            cursor: disabled ? "not-allowed" : "pointer",
                            transition: "all .15s",
                            textAlign: "center",
                            lineHeight: 1.3,
                          }}
                        >
                          <div>{icon} {label}</div>
                          {sel && <div style={{ fontSize: "0.65rem", opacity: 0.75, marginTop: 1 }}>{desc}</div>}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Préstamo — dropdown con búsqueda */}
                <div style={{ position: "relative" }}>
                  <label className="form-label fw-semibold small mb-1" style={{ color: "#2c3e50" }}>
                    <FaFileInvoiceDollar className="me-1" style={{ color: "#3498db" }} /> Préstamo
                  </label>

                  {/* Campo que muestra el préstamo elegido y abre el dropdown */}
                  <div
                    onClick={() => { setDropdownAbierto((v) => !v); setBusquedaPrestamo(""); }}
                    style={{
                      borderRadius: 8,
                      border: "1.5px solid #e2e8f0",
                      fontSize: "0.85rem",
                      padding: "6px 10px",
                      background: "white",
                      cursor: "pointer",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      userSelect: "none",
                      color: prestamoSeleccionado ? "#2c3e50" : "#94a3b8",
                    }}
                  >
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {prestamoSeleccionado
                        ? `#${prestamoSeleccionado.id_prestamo} · ${
                            usuarios.find((u) => u.id_usuario === prestamoSeleccionado.id_usuario)?.nombre_completo || "N/A"
                          } · L.${fmt(prestamoSeleccionado.saldo_restante)}`
                        : "Seleccionar préstamo..."}
                    </span>
                    <span style={{ fontSize: "0.7rem", color: "#94a3b8", flexShrink: 0, marginLeft: 6 }}>{dropdownAbierto ? "▲" : "▼"}</span>
                  </div>

                  {/* input hidden para required */}
                  <input type="hidden" name="id_prestamo" value={form.id_prestamo} required />

                  {/* Panel desplegable */}
                  {dropdownAbierto && (
                    <>
                    {/* Backdrop para cerrar al hacer clic afuera */}
                    <div
                      style={{ position: "fixed", inset: 0, zIndex: 9998 }}
                      onClick={() => setDropdownAbierto(false)}
                    />
                    <div
                      style={{
                        position: "absolute",
                        top: "100%",
                        left: 0,
                        right: 0,
                        zIndex: 9999,
                        background: "white",
                        border: "1.5px solid #e2e8f0",
                        borderRadius: 8,
                        boxShadow: "0 8px 24px rgba(0,0,0,0.13)",
                        marginTop: 2,
                        overflow: "hidden",
                      }}
                    >
                      {/* Input de búsqueda */}
                      <div style={{ padding: "8px 8px 4px" }}>
                        <input
                          autoFocus
                          type="text"
                          className="form-control form-control-sm"
                          placeholder="🔍 Buscar por nombre o #..."
                          value={busquedaPrestamo}
                          onChange={(e) => setBusquedaPrestamo(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          style={{ borderRadius: 6, fontSize: "0.82rem" }}
                        />
                      </div>

                      {/* Lista filtrada */}
                      <div style={{ maxHeight: 200, overflowY: "auto" }}>
                        {/* Opción vacía */}
                        <div
                          onClick={() => {
                            handleInput({ target: { name: "id_prestamo", value: "" } });
                            setDropdownAbierto(false);
                          }}
                          style={{
                            padding: "7px 12px",
                            fontSize: "0.82rem",
                            color: "#94a3b8",
                            cursor: "pointer",
                            borderBottom: "1px solid #f1f5f9",
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "white")}
                        >
                          — Seleccionar préstamo —
                        </div>

                        {prestamos
                          .filter((pr) => {
                            if (!busquedaPrestamo) return true;
                            const u = usuarios.find((u) => u.id_usuario === pr.id_usuario);
                            const texto = `${pr.id_prestamo} ${u?.nombre_completo || ""}`.toLowerCase();
                            return texto.includes(busquedaPrestamo.toLowerCase());
                          })
                          .map((pr) => {
                            const u = usuarios.find((u) => u.id_usuario === pr.id_usuario);
                            const seleccionado = parseInt(form.id_prestamo) === pr.id_prestamo;
                            return (
                              <div
                                key={pr.id_prestamo}
                                onClick={() => {
                                  handleInput({ target: { name: "id_prestamo", value: String(pr.id_prestamo) } });
                                  setDropdownAbierto(false);
                                  setBusquedaPrestamo("");
                                }}
                                style={{
                                  padding: "8px 12px",
                                  fontSize: "0.82rem",
                                  cursor: "pointer",
                                  background: seleccionado ? "rgba(52,152,219,0.09)" : "white",
                                  borderLeft: seleccionado ? "3px solid #3498db" : "3px solid transparent",
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                  gap: 8,
                                }}
                                onMouseEnter={(e) => { if (!seleccionado) e.currentTarget.style.background = "#f8fafc"; }}
                                onMouseLeave={(e) => { if (!seleccionado) e.currentTarget.style.background = "white"; }}
                              >
                                <span>
                                  <span style={{ fontWeight: 600, color: "#3498db" }}>#{pr.id_prestamo}</span>
                                  {" · "}
                                  <span style={{ color: "#2c3e50" }}>{u?.nombre_completo || "N/A"}</span>
                                </span>
                                <span style={{ color: "#e74c3c", fontWeight: 600, whiteSpace: "nowrap", fontSize: "0.78rem" }}>
                                  L.{fmt(pr.saldo_restante)}
                                </span>
                              </div>
                            );
                          })}

                        {prestamos.filter((pr) => {
                          if (!busquedaPrestamo) return true;
                          const u = usuarios.find((u) => u.id_usuario === pr.id_usuario);
                          const texto = `${pr.id_prestamo} ${u?.nombre_completo || ""}`.toLowerCase();
                          return texto.includes(busquedaPrestamo.toLowerCase());
                        }).length === 0 && (
                          <div style={{ padding: "10px 12px", fontSize: "0.82rem", color: "#94a3b8", textAlign: "center" }}>
                            Sin resultados para "{busquedaPrestamo}"
                          </div>
                        )}
                      </div>
                    </div>
                    </>
                  )}
                </div>

                {/* Info compacta del préstamo */}
                {prestamoSeleccionado && (
                    <div className="mt-2 px-2 py-1 d-flex flex-wrap gap-2 small"
                      style={{ background: "rgba(52,152,219,0.07)", borderRadius: 8, border: "1px solid rgba(52,152,219,0.2)" }}>
                      <span><strong>{usuarioSeleccionado?.nombre_completo}</strong></span>
                      <span className="text-muted">·</span>
                      <span>Préstamo: <strong>L. {fmt(prestamoSeleccionado.monto)}</strong></span>
                      <span className="text-muted">·</span>
                      <span>Saldo: <strong style={{ color: "#e74c3c" }}>L. {fmt(prestamoSeleccionado.saldo_restante)}</strong></span>
                      <span className="text-muted">·</span>
                      <span className="badge" style={{
                        background: prestamoSeleccionado.estado === "activo" ? "rgba(39,174,96,0.15)" : "rgba(149,165,166,0.15)",
                        color: prestamoSeleccionado.estado === "activo" ? "#27ae60" : "#95a5a6",
                        fontSize: "0.72rem",
                      }}>{prestamoSeleccionado.estado}</span>
                      {esIndefinido && (
                        <span style={{ color: "#e67e22", fontSize: "0.72rem" }}>♾ Indefinido · base 30d: L.{fmt(interesBase30)}</span>
                      )}
                    </div>
                  )}

                {/* Monto + Fecha en fila */}
                <div className="row g-2">
                  <div className="col-7">
                    <label className="form-label fw-semibold small mb-1" style={{ color: "#2c3e50" }}>
                      <FaMoneyBillWave className="me-1" style={{ color: "#27ae60" }} /> Monto (L.)
                    </label>
                    <div className="input-group input-group-sm">
                      <span className="input-group-text fw-bold"
                        style={{ background: "#27ae60", color: "#fff", border: "1.5px solid #27ae60", borderRight: "none" }}>L.</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        className="form-control"
                        name="monto"
                        value={montoDisplay}
                        onChange={handleMontoChange}
                        required
                        placeholder="0.00"
                        style={{ borderRadius: "0 6px 6px 0", border: "1.5px solid #e2e8f0", borderLeft: "none" }}
                      />
                    </div>
                  </div>
                  <div className="col-5">
                    <label className="form-label fw-semibold small mb-1" style={{ color: "#2c3e50" }}>
                      <FaCalendarAlt className="me-1" style={{ color: "#3498db" }} /> Fecha
                    </label>
                    <input
                      type="date"
                      className="form-control form-control-sm"
                      name="fecha"
                      value={form.fecha}
                      onChange={handleInput}
                      required
                      style={{ borderRadius: 8, border: "1.5px solid #e2e8f0" }}
                    />
                  </div>
                </div>

                {/* Método de pago — píldoras compactas */}
                <div>
                  <label className="form-label fw-semibold small mb-1" style={{ color: "#2c3e50" }}>
                    <FaMoneyCheckAlt className="me-1" style={{ color: "#27ae60" }} /> Método de Pago
                  </label>
                  <div className="d-flex flex-wrap gap-1">
                    {[
                      { value: "Efectivo",          icon: "💵", color: "#27ae60" },
                      { value: "Transferencia",     icon: "🏦", color: "#3498db" },
                      { value: "Cheque",            icon: "📋", color: "#9b59b6" },
                      { value: "Deposito",          icon: "🏧", color: "#e67e22" },
                      { value: "Tarjeta de débito", icon: "💳", color: "#e74c3c" },
                      { value: "Pago móvil",        icon: "📱", color: "#1abc9c" },
                    ].map(({ value, icon, color }) => {
                      const sel = form.metodo_pago === value;
                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => handleInput({ target: { name: "metodo_pago", value } })}
                          style={{
                            padding: "4px 10px",
                            borderRadius: 20,
                            border: `1.5px solid ${sel ? color : "#e2e8f0"}`,
                            background: sel ? color + "18" : "white",
                            color: sel ? color : "#64748b",
                            fontWeight: sel ? 700 : 500,
                            fontSize: "0.75rem",
                            cursor: "pointer",
                            transition: "all .15s",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {icon} {value} {sel && "✓"}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Descripción */}
                <div>
                  <label className="form-label fw-semibold small mb-1" style={{ color: "#2c3e50" }}>
                    Descripción <span style={{ color: "#94a3b8", fontWeight: 400 }}>(opcional)</span>
                  </label>
                  <textarea
                    className="form-control form-control-sm"
                    name="descripcion"
                    value={form.descripcion}
                    onChange={handleInput}
                    rows="2"
                    maxLength="200"
                    placeholder="Ej: Pago cuota mensual, abono adelantado…"
                    style={{ borderRadius: 8, border: "1.5px solid #e2e8f0", resize: "none" }}
                  />
                </div>
              </div>

              {/* Columna derecha — desglose */}
              <div className="col-lg-5 p-3 d-flex flex-column gap-2" style={{ background: "#edf2f7" }}>
                <div className="d-flex align-items-center justify-content-between mb-1">
                  <div className="fw-bold small" style={{ color: "#2c3e50" }}>📊 Desglose del pago</div>
                  {prestamoSeleccionado && (
                    <span style={{
                      fontSize: "0.68rem", fontWeight: 700, padding: "2px 8px", borderRadius: 8,
                      background: tipoPago === "cuota_fija" ? "rgba(52,152,219,0.12)" : tipoPago === "desglose" ? "rgba(39,174,96,0.12)" : "rgba(230,126,34,0.12)",
                      color: tipoPago === "cuota_fija" ? "#2980b9" : tipoPago === "desglose" ? "#1e8449" : "#d35400",
                      border: `1.5px solid ${tipoPago === "cuota_fija" ? "#3498db" : tipoPago === "desglose" ? "#27ae60" : "#e67e22"}`,
                    }}>
                      {tipoPago === "cuota_fija" ? "💰 Cuota Fija" : tipoPago === "desglose" ? "📊 Desglose" : "♾️ Pago Libre"}
                    </span>
                  )}
                </div>

                {prestamoSeleccionado ? (
                  <>
                    {/* ── Nota visual del tipo seleccionado ── */}
                    {tipoPago === "cuota_fija" && (
                      <div className="d-flex justify-content-between align-items-center small px-2 py-1"
                        style={{ background: "rgba(52,152,219,0.08)", borderRadius: 7, border: "1.5px solid #3498db" }}>
                        <span style={{ color: "#2980b9", fontWeight: 600 }}>💰 Cuota mensual:</span>
                        <strong style={{ color: "#2980b9" }}>L. {fmt(prestamoSeleccionado.cuota_mensual)}</strong>
                      </div>
                    )}
                    {tipoPago === "desglose" && (
                      <div className="small px-2 py-1"
                        style={{ background: "rgba(39,174,96,0.08)", borderRadius: 7, border: "1.5px solid #27ae60", color: "#1e8449", fontWeight: 600 }}>
                        📊 Liquidación total: saldo + interés por días exactos
                      </div>
                    )}
                    {tipoPago === "indefinido" && (
                      <div className="small px-2 py-1"
                        style={{ background: "rgba(230,126,34,0.08)", borderRadius: 7, border: "1.5px solid #e67e22", color: "#d35400", fontWeight: 600 }}>
                        ♾️ Pago libre — ingresa el monto a abonar
                      </div>
                    )}
                    {/* ── Período del préstamo: distinto según tipo de pago ── */}
                    {tipoPago === "cuota_fija" ? (
                      /* Cuota fija: período estándar 30 días, sin selector de fecha */
                      <div style={{ background: "rgba(52,152,219,0.07)", border: "1px solid #d6eaf8", borderRadius: 10, padding: "10px 12px" }}>
                        <div className="fw-semibold mb-2" style={{ fontSize: "0.72rem", color: "#2980b9" }}>
                          <FaCalendarAlt className="me-1" /> Período estándar
                        </div>
                        <div className="d-flex justify-content-between align-items-center mb-1">
                          <span style={{ fontSize: "0.75rem", color: "#64748b" }}>Ciclo mensual fijo:</span>
                          <span className="badge" style={{ background: "rgba(52,152,219,0.13)", color: "#2980b9", border: "1.5px solid #3498db", borderRadius: 8, fontSize: 12, fontWeight: 700, padding: "4px 12px" }}>
                            <FaClock className="me-1" style={{ fontSize: 10 }} />30 días
                          </span>
                        </div>
                        <div className="d-flex justify-content-between align-items-center">
                          <span style={{ fontSize: "0.75rem", color: "#64748b" }}>Tasa mensual:</span>
                          <strong style={{ fontSize: "0.82rem", color: "#2980b9" }}>{(tasaMensual * 100).toFixed(4)}%</strong>
                        </div>
                      </div>
                    ) : (
                      /* Desglose / Libre: período con fechas editables */
                      <div style={{ background: "rgba(52,152,219,0.07)", border: "1px solid #d6eaf8", borderRadius: 10, padding: "10px 12px" }}>
                        <div className="fw-semibold mb-2" style={{ fontSize: "0.72rem", color: "#2980b9" }}>
                          <FaCalendarAlt className="me-1" /> Período del préstamo
                        </div>
                        <label style={{ fontSize: "0.7rem", color: "#64748b", display: "block", marginBottom: 3 }}>
                          Inicio del período
                        </label>
                        <input
                          type="date"
                          className="form-control form-control-sm mb-2"
                          value={fechaReferencia}
                          onChange={(e) => setFechaReferencia(e.target.value)}
                          style={{ borderRadius: 6, border: "1.5px solid #cbd5e1", fontSize: "0.8rem" }}
                        />
                        <div className="d-flex align-items-center justify-content-between gap-1 flex-wrap">
                          <span className="badge" style={{ background: "rgba(155,89,182,0.12)", color: "#8e44ad", border: "1.5px solid #9b59b6", borderRadius: 7, fontSize: 11, fontWeight: 700, padding: "4px 8px" }}>
                            📅 {fechaReferencia || "—"}
                          </span>
                          <span style={{ color: "#94a3b8", fontSize: 13, fontWeight: 700 }}>→</span>
                          <span className="badge" style={{ background: "rgba(155,89,182,0.12)", color: "#8e44ad", border: "1.5px solid #9b59b6", borderRadius: 7, fontSize: 11, fontWeight: 700, padding: "4px 8px" }}>
                            📅 {form.fecha || "—"}
                          </span>
                        </div>
                        <div className="d-flex justify-content-center mt-2">
                          <span className="badge" style={{ background: "rgba(52,152,219,0.13)", color: "#2980b9", border: "1.5px solid #3498db", borderRadius: 8, fontSize: 12, fontWeight: 700, padding: "5px 14px" }}>
                            <FaClock className="me-1" style={{ fontSize: 11 }} />
                            {diasTranscurridos} día{diasTranscurridos !== 1 ? "s" : ""}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* ── Saldo actual ── */}
                    <div className="d-flex justify-content-between align-items-center small px-2 py-1"
                      style={{ background: "white", borderRadius: 7, border: "1px solid #e2e8f0" }}>
                      <span style={{ color: "#7f8c8d" }}>Saldo actual:</span>
                      <strong style={{ color: "#e74c3c" }}>L. {fmt(saldoActualPrestamo)}</strong>
                    </div>

                    {/* ── Interés generado ── */}
                    <div className="d-flex justify-content-between align-items-center small px-2 py-1"
                      style={{ background: "rgba(230,126,34,0.08)", borderRadius: 7, border: "1.5px solid #e67e22" }}>
                      <span style={{ color: "#d35400", fontWeight: 600 }}>
                        Interés {tipoPago === "cuota_fija" ? "(mensual)" : `(${diasTranscurridos}d)`}:
                      </span>
                      <strong style={{ color: "#d35400", fontSize: "0.9rem" }}>
                        + L. {fmt(interesEsperado)}
                      </strong>
                    </div>

                    {/* Referencia 30 días — solo para desglose con días ≠ 30 */}
                    {tipoPago !== "cuota_fija" && diasTranscurridos !== 30 && (
                      <div className="d-flex justify-content-between small" style={{ color: "#94a3b8", paddingLeft: 4 }}>
                        <span>(30 días serían):</span>
                        <span>L. {fmt(interesBase30)}</span>
                      </div>
                    )}

                    {/* ── Total a pagar ── */}
                    {tipoPago === "cuota_fija" ? (
                      /* Cuota fija: el total ES la cuota acordada */
                      <div className="d-flex justify-content-between align-items-center px-2 py-2 fw-bold"
                        style={{ background: "rgba(52,152,219,0.1)", borderRadius: 8, border: "2px solid #3498db" }}>
                        <span style={{ color: "#2980b9", fontSize: "0.82rem" }}>
                          💰 Cuota acordada:
                        </span>
                        <strong style={{ color: "#2980b9", fontSize: "1rem" }}>
                          L. {fmt(prestamoSeleccionado.cuota_mensual)}
                        </strong>
                      </div>
                    ) : (
                      /* Desglose / libre: total = saldo + interés */
                      <div className="d-flex justify-content-between align-items-center px-2 py-2 fw-bold"
                        style={{ background: "rgba(39,174,96,0.1)", borderRadius: 8, border: "2px solid #27ae60" }}>
                        <span style={{ color: "#1e8449", fontSize: "0.82rem" }}>
                          💰 Total a pagar ({diasTranscurridos}d):
                        </span>
                        <strong style={{ color: "#1e8449", fontSize: "1rem" }}>
                          L. {fmt(saldoActualPrestamo + interesEsperado)}
                        </strong>
                      </div>
                    )}

                    <hr className="my-0" style={{ borderColor: "#cbd5e1" }} />

                    {/* ── Desglose del monto ingresado ── */}
                    {montoPagoIngresado > 0 && (
                      <>
                        <div className="d-flex justify-content-between small">
                          <span style={{ color: "#7f8c8d" }}>De ese monto — Interés:</span>
                          <strong style={{ color: "#e67e22" }}>L. {fmt(interesDelPago)}</strong>
                        </div>
                        <div className="d-flex justify-content-between small">
                          <span style={{ color: "#7f8c8d" }}>Abono a capital:</span>
                          <strong style={{ color: capitalDelPago > 0 ? "#27ae60" : "#94a3b8" }}>
                            L. {fmt(capitalDelPago)}
                          </strong>
                        </div>

                        {/* Barra interés / capital */}
                        <div>
                          <div style={{ height: 7, borderRadius: 4, background: "#e2e8f0", overflow: "hidden" }}>
                            <div style={{
                              height: "100%", borderRadius: 4,
                              width: `${Math.min(100, (interesDelPago / montoPagoIngresado) * 100).toFixed(1)}%`,
                              background: "linear-gradient(90deg,#e67e22,#f39c12)",
                              transition: "width .35s",
                            }} />
                          </div>
                          <div className="d-flex justify-content-between" style={{ fontSize: "0.68rem", color: "#aaa", marginTop: 2 }}>
                            <span>🟠 Interés</span>
                            <span>🟢 Capital</span>
                          </div>
                        </div>

                        {/* Nuevo saldo */}
                        {capitalDelPago > 0 && (
                          <div className="small px-2 py-1 fw-semibold"
                            style={{ background: "rgba(39,174,96,0.1)", borderRadius: 6, color: "#27ae60", border: "1px solid #27ae60" }}>
                            ✔ Nuevo saldo estimado: <strong>L. {fmt(Math.max(0, saldoActualPrestamo - capitalDelPago))}</strong>
                          </div>
                        )}

                        {/* Aviso si monto < interés */}
                        {montoPagoIngresado < interesEsperado && (
                          <div className="small px-2 py-1"
                            style={{ background: "rgba(231,76,60,0.08)", borderRadius: 6, color: "#e74c3c", border: "1px solid #e74c3c" }}>
                            ⚠ Monto menor al interés generado (L. {fmt(interesEsperado)})
                          </div>
                        )}
                      </>
                    )}

                    {!montoPagoIngresado && (
                      <div className="small text-center text-muted mt-1" style={{ opacity: 0.6 }}>
                        Ingresa un monto para ver el desglose
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-4 text-muted small" style={{ opacity: 0.5 }}>
                    <FaMoneyCheckAlt size={28} className="mb-2 d-block mx-auto" />
                    Selecciona un préstamo
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Footer ── */}
          <div className="modal-footer border-0 bg-white px-3 py-2 gap-2">
            <button
              type="submit"
              className="btn btn-sm shadow-sm fw-semibold"
              style={{
                background: "linear-gradient(135deg,#3498db,#2980b9)",
                color: "white", border: "none",
                borderRadius: 8, padding: "7px 22px",
              }}
            >
              <FaMoneyCheckAlt className="me-1" />
              {editPago ? "Guardar Cambios" : "Registrar Pago"}
            </button>
            <button
              type="button"
              className="btn btn-sm btn-light shadow-sm fw-semibold"
              onClick={onClose}
              style={{ borderRadius: 8, padding: "7px 18px" }}
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
