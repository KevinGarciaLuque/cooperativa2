import { useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { useAlerta } from "../context/AlertaContext";
import {
  FaExchangeAlt,
  FaPlus,
  FaSearch,
  FaArrowUp,
  FaArrowDown,
  FaCalendarAlt,
  FaUser,
  FaMoneyBillWave,
  FaEdit,
  FaTrash,
  FaWallet,
  FaChartPie,
  FaIdCard,
  FaFileAlt,
  FaCheckCircle,
  FaRandom,
  FaPiggyBank,
} from "react-icons/fa";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts";

export default function Movimientos() {
  const { token } = useAuth();
  const { mostrarAlerta } = useAlerta();
  const [movimientos, setMovimientos] = useState([]);
  const [cuentas, setCuentas] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState("");
  const [tipoFiltro, setTipoFiltro] = useState("todos");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [cuentaFiltro, setCuentaFiltro] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editMovimiento, setEditMovimiento] = useState(null);
  const [form, setForm] = useState({
    id_cuenta: "",
    tipo: "",
    monto: "",
    fecha: new Date().toISOString().split("T")[0],
    descripcion: "",
  });

  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

  const fetchData = async () => {
    try {
      setLoading(true);
      const [movRes, cuentasRes, usuariosRes] = await Promise.all([
        axios.get(`${API_URL}/movimientos`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`${API_URL}/cuentas`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`${API_URL}/usuarios`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      setMovimientos(movRes.data.data || movRes.data || []);
      setCuentas(cuentasRes.data.data || cuentasRes.data || []);
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

  // Obtener usuario de la cuenta
  const getUsuarioCuenta = (id_cuenta) => {
    const cuenta = cuentas.find((c) => c.id_cuenta === id_cuenta);
    if (!cuenta) return null;
    return usuarios.find((u) => u.id_usuario === cuenta.id_usuario);
  };

  // Obtener cuenta
  const getCuenta = (id_cuenta) => {
    return cuentas.find((c) => c.id_cuenta === id_cuenta);
  };

  // Filtrar movimientos
  const movimientosFiltrados = movimientos.filter((m) => {
    const usuario = getUsuarioCuenta(m.id_cuenta);
    const nombreUsuario = usuario?.nombre_completo?.toLowerCase() || "";
    const coincideBusqueda = nombreUsuario.includes(filtro.toLowerCase());

    const coincideTipo = tipoFiltro === "todos" || m.tipo === tipoFiltro;

    const fechaMovimiento = m.fecha ? m.fecha.substring(0, 10) : "";
    const coincideFechaInicio = fechaInicio
      ? fechaMovimiento >= fechaInicio
      : true;
    const coincideFechaFin = fechaFin ? fechaMovimiento <= fechaFin : true;

    const coincideCuenta = cuentaFiltro
      ? m.id_cuenta === parseInt(cuentaFiltro)
      : true;

    return (
      coincideBusqueda &&
      coincideTipo &&
      coincideFechaInicio &&
      coincideFechaFin &&
      coincideCuenta
    );
  });

  const openCrearModal = () => {
    setEditMovimiento(null);
    setForm({
      id_cuenta: "",
      tipo: "",
      monto: "",
      fecha: new Date().toISOString().split("T")[0],
      descripcion: "",
    });
    setShowModal(true);
  };

  const handleEdit = (movimiento) => {
    setEditMovimiento(movimiento);
    setForm({
      id_cuenta: movimiento.id_cuenta,
      tipo: movimiento.tipo,
      monto: movimiento.monto,
      fecha: movimiento.fecha
        ? movimiento.fecha.substring(0, 10)
        : new Date().toISOString().split("T")[0],
      descripcion: movimiento.descripcion || "",
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("¿Seguro que deseas eliminar este movimiento?")) return;
    try {
      await axios.delete(`${API_URL}/movimientos/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      mostrarAlerta("Movimiento eliminado correctamente.", "success");
      fetchData();
    } catch (err) {
      mostrarAlerta("Error al eliminar el movimiento.", "error");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editMovimiento) {
        await axios.put(
          `${API_URL}/movimientos/${editMovimiento.id_movimiento}`,
          form,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        mostrarAlerta("Movimiento actualizado correctamente.", "success");
      } else {
        await axios.post(`${API_URL}/movimientos`, form, {
          headers: { Authorization: `Bearer ${token}` },
        });
        mostrarAlerta("Movimiento registrado correctamente.", "success");
      }
      setForm({
        id_cuenta: "",
        tipo: "",
        monto: "",
        fecha: new Date().toISOString().split("T")[0],
        descripcion: "",
      });
      setEditMovimiento(null);
      setShowModal(false);
      fetchData();
    } catch (err) {
      mostrarAlerta(
        err.response?.data?.message || "Error al guardar el movimiento.",
        "error"
      );
    }
  };

  const handleInput = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  // Estadísticas
  const totalMovimientos = movimientos.length;
  const abonos = movimientos.filter((m) => m.tipo === "abono");
  const retiros = movimientos.filter((m) => m.tipo === "retiro");
  const transferencias = movimientos.filter((m) => m.tipo === "transferencia");

  const montoAbonos = abonos.reduce((sum, m) => sum + parseFloat(m.monto || 0), 0);
  const montoRetiros = retiros.reduce((sum, m) => sum + parseFloat(m.monto || 0), 0);
  const balance = montoAbonos - montoRetiros;

  // Datos para gráfico
  const graficaData = [
    { name: "Abonos", value: abonos.length, monto: montoAbonos },
    { name: "Retiros", value: retiros.length, monto: montoRetiros },
    {
      name: "Transferencias",
      value: transferencias.length,
      monto: transferencias.reduce((sum, m) => sum + parseFloat(m.monto || 0), 0),
    },
  ].filter((item) => item.value > 0);

  const COLORS = {
    Abonos: "#27ae60",
    Retiros: "#e74c3c",
    Transferencias: "#3498db",
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
            <FaExchangeAlt className="me-2" style={{ color: "#9b59b6" }} />
            Gestión de Movimientos
          </h2>
          <p className="text-muted mb-0">
            Registro de abonos, retiros y transferencias
          </p>
        </div>
        <button
          className="btn btn-lg shadow-sm"
          onClick={openCrearModal}
          style={{
            background: "linear-gradient(135deg, #9b59b6 0%, #8e44ad 100%)",
            color: "white",
            border: "none",
            borderRadius: "10px",
            fontWeight: "600",
          }}
        >
          <FaPlus className="me-2" />
          Nuevo Movimiento
        </button>
      </div>

      {/* Cards de Estadísticas */}
      <div className="row g-3 mb-4">
        {/* Total Movimientos */}
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
                  <p className="text-muted mb-1 small">Total Movimientos</p>
                  <h3 className="mb-0 fw-bold" style={{ color: "#2c3e50" }}>
                    {totalMovimientos}
                  </h3>
                  <p className="mb-0 small text-muted mt-1">
                    Todas las transacciones
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
                  <FaExchangeAlt style={{ fontSize: "24px", color: "#9b59b6" }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Abonos */}
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
                  <p className="text-muted mb-1 small">Abonos</p>
                  <h3 className="mb-0 fw-bold" style={{ color: "#27ae60" }}>
                    L. {montoAbonos.toFixed(2)}
                  </h3>
                  <p className="mb-0 small text-muted mt-1">
                    {abonos.length} transacciones
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
                  <FaArrowUp style={{ fontSize: "24px", color: "#27ae60" }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Retiros */}
        <div className="col-12 col-sm-6 col-lg-3">
          <div
            className="card border-0 shadow-sm h-100"
            style={{
              borderRadius: "15px",
              borderLeft: "4px solid #e74c3c",
            }}
          >
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <p className="text-muted mb-1 small">Retiros</p>
                  <h3 className="mb-0 fw-bold" style={{ color: "#e74c3c" }}>
                    L. {montoRetiros.toFixed(2)}
                  </h3>
                  <p className="mb-0 small text-muted mt-1">
                    {retiros.length} transacciones
                  </p>
                </div>
                <div
                  className="rounded-circle d-flex align-items-center justify-content-center"
                  style={{
                    width: "50px",
                    height: "50px",
                    background: "rgba(231, 76, 60, 0.1)",
                  }}
                >
                  <FaArrowDown style={{ fontSize: "24px", color: "#e74c3c" }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Balance */}
        <div className="col-12 col-sm-6 col-lg-3">
          <div
            className="card border-0 shadow-sm h-100"
            style={{
              borderRadius: "15px",
              borderLeft: `4px solid ${balance >= 0 ? "#27ae60" : "#e74c3c"}`,
            }}
          >
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <p className="text-muted mb-1 small">Balance</p>
                  <h3
                    className="mb-0 fw-bold"
                    style={{ color: balance >= 0 ? "#27ae60" : "#e74c3c" }}
                  >
                    L. {balance.toFixed(2)}
                  </h3>
                  <p className="mb-0 small text-muted mt-1">
                    Abonos - Retiros
                  </p>
                </div>
                <div
                  className="rounded-circle d-flex align-items-center justify-content-center"
                  style={{
                    width: "50px",
                    height: "50px",
                    background:
                      balance >= 0
                        ? "rgba(39, 174, 96, 0.1)"
                        : "rgba(231, 76, 60, 0.1)",
                  }}
                >
                  <FaWallet
                    style={{
                      fontSize: "24px",
                      color: balance >= 0 ? "#27ae60" : "#e74c3c",
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Gráfico y Filtros */}
      <div className="row g-4 mb-4">
        {/* Gráfico de Distribución */}
        <div className="col-lg-4">
          <div
            className="card border-0 shadow-sm h-100"
            style={{ borderRadius: "15px" }}
          >
            <div className="card-body">
              <h6 className="fw-bold mb-3" style={{ color: "#2c3e50" }}>
                <FaChartPie className="me-2" style={{ color: "#9b59b6" }} />
                Distribución por Tipo
              </h6>
              {graficaData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={graficaData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) =>
                        `${name}: ${(percent * 100).toFixed(0)}%`
                      }
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {graficaData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[entry.name]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value, name, props) =>
                        `${value} (L.${props.payload.monto.toFixed(2)})`
                      }
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center py-5 text-muted">
                  No hay datos para mostrar
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Filtros */}
        <div className="col-lg-8">
          <div
            className="card border-0 shadow-sm"
            style={{ borderRadius: "15px" }}
          >
            <div className="card-body">
              <div className="row g-3">
                {/* Búsqueda */}
                <div className="col-md-6">
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

                {/* Filtro por Cuenta */}
                <div className="col-md-6">
                  <label className="form-label fw-semibold small text-muted">
                    Filtrar por Cuenta
                  </label>
                  <select
                    className="form-select"
                    value={cuentaFiltro}
                    onChange={(e) => setCuentaFiltro(e.target.value)}
                    style={{ borderRadius: "10px" }}
                  >
                    <option value="">Todas las cuentas</option>
                    {cuentas.map((c) => {
                      const usuario = usuarios.find(
                        (u) => u.id_usuario === c.id_usuario
                      );
                      return (
                        <option key={c.id_cuenta} value={c.id_cuenta}>
                          {c.tipo_cuenta} - {usuario?.nombre_completo || "N/A"}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Filtro por Tipo */}
                <div className="col-md-6">
                  <label className="form-label fw-semibold small text-muted">
                    Tipo de Movimiento
                  </label>
                  <div className="btn-group w-100" role="group">
                    <button
                      type="button"
                      className={`btn btn-sm ${
                        tipoFiltro === "todos"
                          ? "btn-primary"
                          : "btn-outline-primary"
                      }`}
                      onClick={() => setTipoFiltro("todos")}
                    >
                      Todos
                    </button>
                    <button
                      type="button"
                      className={`btn btn-sm ${
                        tipoFiltro === "abono"
                          ? "btn-success"
                          : "btn-outline-success"
                      }`}
                      onClick={() => setTipoFiltro("abono")}
                    >
                      Abonos
                    </button>
                    <button
                      type="button"
                      className={`btn btn-sm ${
                        tipoFiltro === "retiro"
                          ? "btn-danger"
                          : "btn-outline-danger"
                      }`}
                      onClick={() => setTipoFiltro("retiro")}
                    >
                      Retiros
                    </button>
                    <button
                      type="button"
                      className={`btn btn-sm ${
                        tipoFiltro === "transferencia"
                          ? "btn-info"
                          : "btn-outline-info"
                      }`}
                      onClick={() => setTipoFiltro("transferencia")}
                    >
                      Transferencias
                    </button>
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
        </div>
      </div>

      {/* Tabla de Movimientos */}
      {loading ? (
        <div className="text-center py-5">
          <div
            className="spinner-border text-primary"
            role="status"
            style={{ width: "3rem", height: "3rem" }}
          >
            <span className="visually-hidden">Cargando...</span>
          </div>
          <p className="mt-3 text-muted">Cargando movimientos...</p>
        </div>
      ) : (
        <TablaMovimientos
          movimientos={movimientosFiltrados}
          cuentas={cuentas}
          usuarios={usuarios}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      )}

      {/* Modal */}
      {showModal && (
        <ModalMovimiento
          show={showModal}
          editMovimiento={editMovimiento}
          form={form}
          cuentas={cuentas}
          usuarios={usuarios}
          onClose={() => setShowModal(false)}
          onSubmit={handleSubmit}
          handleInput={handleInput}
        />
      )}
    </div>
  );
}

// ==================== COMPONENTE TABLA MOVIMIENTOS ====================
function TablaMovimientos({
  movimientos,
  cuentas,
  usuarios,
  onEdit,
  onDelete,
}) {
  if (!movimientos || movimientos.length === 0) {
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
              background: "rgba(155, 89, 182, 0.1)",
            }}
          >
            <FaExchangeAlt style={{ fontSize: "36px", color: "#9b59b6" }} />
          </div>
          <h5 className="text-muted fw-semibold">
            No hay movimientos registrados
          </h5>
          <p className="text-muted mb-0">
            Registra un nuevo movimiento para comenzar
          </p>
        </div>
      </div>
    );
  }

  const getCuenta = (id_cuenta) => {
    return cuentas.find((c) => c.id_cuenta === id_cuenta);
  };

  const getUsuario = (id_usuario) => {
    return usuarios.find((u) => u.id_usuario === id_usuario);
  };

  const getTipoConfig = (tipo) => {
    const configs = {
      abono: {
        color: "#27ae60",
        bgColor: "rgba(39, 174, 96, 0.1)",
        icon: FaArrowUp,
        label: "Abono",
      },
      retiro: {
        color: "#e74c3c",
        bgColor: "rgba(231, 76, 60, 0.1)",
        icon: FaArrowDown,
        label: "Retiro",
      },
      transferencia: {
        color: "#3498db",
        bgColor: "rgba(52, 152, 219, 0.1)",
        icon: FaRandom,
        label: "Transferencia",
      },
    };
    return configs[tipo] || configs.abono;
  };

  return (
    <div className="card border-0 shadow-sm" style={{ borderRadius: "15px" }}>
      {/* Header */}
      <div
        className="text-white p-3"
        style={{
          background: "linear-gradient(135deg, #9b59b6 0%, #8e44ad 100%)",
          borderRadius: "15px 15px 0 0",
        }}
      >
        <div className="row g-2 align-items-center fw-semibold">
          <div className="col-auto" style={{ width: "50px" }}>
            #
          </div>
          <div className="col-3">Socio / Cuenta</div>
          <div className="col-2 text-center">Tipo</div>
          <div className="col-2 text-center">Monto</div>
          <div className="col-2 text-center">Fecha</div>
          <div className="col text-center">Acciones</div>
        </div>
      </div>

      {/* Body */}
      <div className="card-body p-0">
        <div style={{ maxHeight: "600px", overflowY: "auto" }}>
          {movimientos.map((movimiento, index) => {
            const cuenta = getCuenta(movimiento.id_cuenta);
            const usuario = cuenta ? getUsuario(cuenta.id_usuario) : null;
            const tipoConfig = getTipoConfig(movimiento.tipo);
            const TipoIcon = tipoConfig.icon;
            const fecha = movimiento.fecha
              ? movimiento.fecha.substring(0, 10)
              : "-";

            return (
              <div
                key={movimiento.id_movimiento}
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
                        background: "rgba(155, 89, 182, 0.1)",
                        color: "#9b59b6",
                        fontSize: "14px",
                      }}
                    >
                      {index + 1}
                    </div>
                  </div>

                  {/* Socio / Cuenta */}
                  <div className="col-3">
                    <div className="d-flex align-items-center">
                      <div
                        className="rounded-circle d-flex align-items-center justify-content-center me-2"
                        style={{
                          width: "40px",
                          height: "40px",
                          background:
                            "linear-gradient(135deg, #9b59b6, #8e44ad)",
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
                          <FaPiggyBank className="me-1" />
                          {cuenta?.tipo_cuenta || "N/A"}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Tipo */}
                  <div className="col-2 text-center">
                    <span
                      className="badge d-inline-flex align-items-center px-3 py-2"
                      style={{
                        background: tipoConfig.bgColor,
                        color: tipoConfig.color,
                        fontWeight: "600",
                        fontSize: "13px",
                        border: `2px solid ${tipoConfig.color}`,
                        borderRadius: "10px",
                      }}
                    >
                      <TipoIcon className="me-2" />
                      {tipoConfig.label}
                    </span>
                  </div>

                  {/* Monto */}
                  <div className="col-2 text-center">
                    <div className="d-flex align-items-center justify-content-center">
                      <FaMoneyBillWave
                        className="me-2"
                        style={{ color: tipoConfig.color, fontSize: "20px" }}
                      />
                      <div>
                        <div
                          className="fw-bold"
                          style={{ fontSize: "18px", color: tipoConfig.color }}
                        >
                          L. {parseFloat(movimiento.monto || 0).toFixed(2)}
                        </div>
                      </div>
                    </div>
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

                  {/* Acciones */}
                  <div className="col text-center">
                    <div className="btn-group" role="group">
                      <button
                        className="btn btn-sm"
                        onClick={() => onEdit(movimiento)}
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
                        onClick={() => onDelete(movimiento.id_movimiento)}
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
          Total de movimientos:{" "}
          <span className="text-primary fw-bold">{movimientos.length}</span>
          {" | "}
          Total: <span className="text-success fw-bold">
            L.{" "}
            {movimientos
              .reduce((sum, m) => sum + parseFloat(m.monto || 0), 0)
              .toFixed(2)}
          </span>
        </p>
      </div>
    </div>
  );
}

// ==================== COMPONENTE MODAL MOVIMIENTO ====================
function ModalMovimiento({
  show,
  editMovimiento,
  form,
  cuentas,
  usuarios,
  onClose,
  onSubmit,
  handleInput,
}) {
  if (!show) return null;

  // Obtener info de la cuenta seleccionada
  const cuentaSeleccionada = cuentas.find(
    (c) => c.id_cuenta === parseInt(form.id_cuenta)
  );
  const usuarioSeleccionado = cuentaSeleccionada
    ? usuarios.find((u) => u.id_usuario === cuentaSeleccionada.id_usuario)
    : null;

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
              background: "linear-gradient(135deg, #9b59b6 0%, #8e44ad 100%)",
              padding: "24px",
            }}
          >
            <h4 className="modal-title mb-0 d-flex align-items-center fw-bold">
              <FaExchangeAlt className="me-3" style={{ fontSize: "24px" }} />
              {editMovimiento ? "Editar Movimiento" : "Nuevo Movimiento"}
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
              {/* Cuenta */}
              <div className="col-12">
                <label
                  className="form-label fw-semibold d-flex align-items-center"
                  style={{ color: "#2c3e50" }}
                >
                  <FaPiggyBank className="me-2" style={{ color: "#9b59b6" }} />
                  Cuenta
                </label>
                <select
                  className="form-select form-select-lg"
                  name="id_cuenta"
                  value={form.id_cuenta}
                  onChange={handleInput}
                  required
                  style={{
                    borderRadius: "10px",
                    border: "2px solid #e9ecef",
                    padding: "12px 16px",
                  }}
                >
                  <option value="">Seleccionar cuenta...</option>
                  {cuentas.map((c) => {
                    const usuario = usuarios.find(
                      (u) => u.id_usuario === c.id_usuario
                    );
                    return (
                      <option key={c.id_cuenta} value={c.id_cuenta}>
                        {c.tipo_cuenta} - {usuario?.nombre_completo || "N/A"} -
                        Saldo: L.{parseFloat(c.saldo_actual || c.saldo || 0).toFixed(2)}
                      </option>
                    );
                  })}
                </select>

                {/* Info de la cuenta seleccionada */}
                {cuentaSeleccionada && (
                  <div
                    className="mt-3 p-3"
                    style={{
                      background: "rgba(155, 89, 182, 0.1)",
                      borderRadius: "10px",
                      border: "2px solid rgba(155, 89, 182, 0.3)",
                    }}
                  >
                    <div className="row g-2 small">
                      <div className="col-6">
                        <strong>Socio:</strong> {usuarioSeleccionado?.nombre_completo}
                      </div>
                      <div className="col-6">
                        <strong>Tipo:</strong> {cuentaSeleccionada.tipo_cuenta}
                      </div>
                      <div className="col-6">
                        <strong>Saldo Actual:</strong>{" "}
                        <span style={{ color: "#27ae60", fontWeight: "bold" }}>
                          L.
                          {parseFloat(
                            cuentaSeleccionada.saldo_actual || cuentaSeleccionada.saldo || 0
                          ).toFixed(2)}
                        </span>
                     </div>
                      <div className="col-6">
                        <strong>Estado:</strong>{" "}
                        <span
                          className="badge"
                          style={{
                            background:
                              cuentaSeleccionada.estado === "activa"
                                ? "rgba(39, 174, 96, 0.2)"
                                : "rgba(149, 165, 166, 0.2)",
                            color:
                              cuentaSeleccionada.estado === "activa"
                                ? "#27ae60"
                                : "#95a5a6",
                          }}
                        >
                          {cuentaSeleccionada.estado}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Tipo y Monto */}
              <div className="col-md-6">
                <label
                  className="form-label fw-semibold d-flex align-items-center"
                  style={{ color: "#2c3e50" }}
                >
                  <FaExchangeAlt className="me-2" style={{ color: "#9b59b6" }} />
                  Tipo de Movimiento
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
                  <option value="abono">⬆️ Abono</option>
                  <option value="retiro">⬇️ Retiro</option>
                  <option value="transferencia">🔄 Transferencia</option>
                </select>
              </div>

              <div className="col-md-6">
                <label
                  className="form-label fw-semibold d-flex align-items-center"
                  style={{ color: "#2c3e50" }}
                >
                  <FaMoneyBillWave className="me-2" style={{ color: "#27ae60" }} />
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

              {/* Fecha */}
              <div className="col-12">
                <label
                  className="form-label fw-semibold d-flex align-items-center"
                  style={{ color: "#2c3e50" }}
                >
                  <FaCalendarAlt className="me-2" style={{ color: "#3498db" }} />
                  Fecha del Movimiento
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
                  <FaFileAlt className="me-2" style={{ color: "#9b59b6" }} />
                  Descripción (Opcional)
                </label>
                <textarea
                  className="form-control form-control-lg"
                  name="descripcion"
                  value={form.descripcion}
                  onChange={handleInput}
                  rows="3"
                  maxLength="200"
                  placeholder="Ej: Depósito de aportación mensual, retiro de fondos, etc."
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
                background: "linear-gradient(135deg, #9b59b6 0%, #8e44ad 100%)",
                color: "white",
                border: "none",
                borderRadius: "10px",
                padding: "12px 32px",
                fontWeight: "600",
              }}
            >
              <FaExchangeAlt className="me-2" />
              {editMovimiento ? "Guardar Cambios" : "Registrar Movimiento"}
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
