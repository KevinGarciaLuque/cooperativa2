import { useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { useAlerta } from "../context/AlertaContext";
import {
  FaMoneyBillWave,
  FaPlus,
  FaCheckCircle,
  FaExclamationTriangle,
  FaHourglassHalf,
  FaTimesCircle,
  FaSearch,
  FaEye,
  FaEdit,
  FaTrash,
  FaChartLine,
  FaCalendarAlt,
  FaPercentage,
  FaClock,
  FaUserTie,
} from "react-icons/fa";
import { CircularProgressbar, buildStyles } from "react-circular-progressbar";
import "react-circular-progressbar/dist/styles.css";

export default function Prestamos() {
  const { token } = useAuth();
  const { mostrarAlerta } = useAlerta();
  const [prestamos, setPrestamos] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState("todos");
  const [showModal, setShowModal] = useState(false);
  const [showDetalleModal, setShowDetalleModal] = useState(false);
  const [prestamoSeleccionado, setPrestamoSeleccionado] = useState(null);
  const [editPrestamo, setEditPrestamo] = useState(null);
  const [form, setForm] = useState({
    id_usuario: "",
    monto: "",
    tasa_interes: "",
    plazo_meses: "",
    fecha_otorgado: "",
    estado: "pendiente",
  });

  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

  // Cargar préstamos y usuarios
  const fetchData = async () => {
    try {
      setLoading(true);
      const [prestamosRes, usuariosRes] = await Promise.all([
        axios.get(`${API_URL}/prestamos`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`${API_URL}/usuarios`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
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

  const handleInput = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  // Crear o editar préstamo
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editPrestamo) {
        await axios.put(
          `${API_URL}/prestamos/${editPrestamo.id_prestamo}`,
          form,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        mostrarAlerta("Préstamo actualizado correctamente.", "success");
      } else {
        await axios.post(`${API_URL}/prestamos`, form, {
          headers: { Authorization: `Bearer ${token}` },
        });
        mostrarAlerta("Préstamo registrado correctamente.", "success");
      }
      setForm({
        id_usuario: "",
        monto: "",
        tasa_interes: "",
        plazo_meses: "",
        fecha_otorgado: "",
        estado: "pendiente",
      });
      setEditPrestamo(null);
      setShowModal(false);
      fetchData();
    } catch (err) {
      mostrarAlerta(
        err.response?.data?.message || "Error al guardar el préstamo.",
        "error"
      );
    }
  };

  const handleEdit = (prestamo) => {
    setEditPrestamo(prestamo);
    setForm({
      id_usuario: prestamo.id_usuario,
      monto: prestamo.monto,
      tasa_interes: prestamo.tasa_interes,
      plazo_meses: prestamo.plazo_meses,
      fecha_otorgado: prestamo.fecha_otorgado
        ? prestamo.fecha_otorgado.substring(0, 10)
        : "",
      estado: prestamo.estado,
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("¿Seguro que deseas eliminar este préstamo?")) return;
    try {
      await axios.delete(`${API_URL}/prestamos/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      mostrarAlerta("Préstamo eliminado correctamente.", "success");
      fetchData();
    } catch (err) {
      mostrarAlerta("Error al eliminar el préstamo.", "error");
    }
  };

  const openCrearModal = () => {
    setEditPrestamo(null);
    setForm({
      id_usuario: "",
      monto: "",
      tasa_interes: "",
      plazo_meses: "",
      fecha_otorgado: "",
      estado: "pendiente",
    });
    setShowModal(true);
  };

  const verDetalle = (prestamo) => {
    setPrestamoSeleccionado(prestamo);
    setShowDetalleModal(true);
  };

  // Filtros
  const prestamosFiltrados = prestamos.filter((p) => {
    const usuario = usuarios.find((u) => u.id_usuario === p.id_usuario);
    const nombreUsuario = usuario?.nombre_completo || "";
    const coincideBusqueda = nombreUsuario
      .toLowerCase()
      .includes(filtro.toLowerCase());

    const coincideEstado =
      estadoFiltro === "todos" || p.estado === estadoFiltro;

    return coincideBusqueda && coincideEstado;
  });

  // Estadísticas
  const totalPrestamos = prestamos.length;
  const prestamosActivos = prestamos.filter((p) => p.estado === "activo").length;
  const prestamosPendientes = prestamos.filter((p) => p.estado === "pendiente").length;
  const prestamosMora = prestamos.filter((p) => p.estado === "mora").length;
  const prestamosPagados = prestamos.filter((p) => p.estado === "pagado").length;
  const montoTotal = prestamos.reduce((acc, p) => acc + parseFloat(p.monto || 0), 0);
  const montoActivo = prestamos
    .filter((p) => p.estado === "activo" || p.estado === "mora")
    .reduce((acc, p) => acc + parseFloat(p.saldo_restante || 0), 0);

  // Función para obtener color e icono según el estado
  const getEstadoInfo = (estado) => {
    const estados = {
      pendiente: {
        color: "#f39c12",
        bg: "rgba(243, 156, 18, 0.1)",
        icon: FaHourglassHalf,
        label: "Pendiente",
      },
      aprobado: {
        color: "#3498db",
        bg: "rgba(52, 152, 219, 0.1)",
        icon: FaCheckCircle,
        label: "Aprobado",
      },
      activo: {
        color: "#27ae60",
        bg: "rgba(39, 174, 96, 0.1)",
        icon: FaCheckCircle,
        label: "Activo",
      },
      mora: {
        color: "#e74c3c",
        bg: "rgba(231, 76, 60, 0.1)",
        icon: FaExclamationTriangle,
        label: "En Mora",
      },
      pagado: {
        color: "#95a5a6",
        bg: "rgba(149, 165, 166, 0.1)",
        icon: FaCheckCircle,
        label: "Pagado",
      },
      rechazado: {
        color: "#e74c3c",
        bg: "rgba(231, 76, 60, 0.1)",
        icon: FaTimesCircle,
        label: "Rechazado",
      },
    };
    return estados[estado] || estados.pendiente;
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
            <FaMoneyBillWave
              className="me-2"
              style={{ color: "#27ae60" }}
            />
            Gestión de Préstamos
          </h2>
          <p className="text-muted mb-0">
            Administra los préstamos de la cooperativa
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
          Nuevo Préstamo
        </button>
      </div>

      {/* Cards de Estadísticas */}
      <div className="row g-3 mb-4">
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
                  <p className="text-muted mb-1 small">Total Préstamos</p>
                  <h3 className="mb-0 fw-bold" style={{ color: "#2c3e50" }}>
                    {totalPrestamos}
                  </h3>
                  <p className="mb-0 small text-muted mt-1">
                    L. {montoTotal.toFixed(2)}
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
                  <p className="text-muted mb-1 small">Préstamos Activos</p>
                  <h3 className="mb-0 fw-bold" style={{ color: "#27ae60" }}>
                    {prestamosActivos}
                  </h3>
                  <p className="mb-0 small text-muted mt-1">
                    L. {montoActivo.toFixed(2)}
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
                  <FaCheckCircle style={{ fontSize: "24px", color: "#27ae60" }} />
                </div>
              </div>
            </div>
          </div>
        </div>

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
                  <p className="text-muted mb-1 small">En Mora</p>
                  <h3 className="mb-0 fw-bold" style={{ color: "#e74c3c" }}>
                    {prestamosMora}
                  </h3>
                  <p className="mb-0 small text-muted mt-1">
                    {prestamosActivos > 0
                      ? ((prestamosMora / prestamosActivos) * 100).toFixed(1)
                      : 0}
                    % de activos
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
                  <FaExclamationTriangle
                    style={{ fontSize: "24px", color: "#e74c3c" }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

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
                  <p className="text-muted mb-1 small">Pendientes</p>
                  <h3 className="mb-0 fw-bold" style={{ color: "#f39c12" }}>
                    {prestamosPendientes}
                  </h3>
                  <p className="mb-0 small text-muted mt-1">
                    {prestamosPagados} pagados
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
                  <FaHourglassHalf
                    style={{ fontSize: "24px", color: "#f39c12" }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Barra de Búsqueda y Filtros */}
      <div className="card border-0 shadow-sm mb-4" style={{ borderRadius: "15px" }}>
        <div className="card-body">
          <div className="row g-3">
            <div className="col-12 col-md-6">
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
                  style={{ borderRadius: "0 10px 10px 0", boxShadow: "none" }}
                />
              </div>
            </div>
            <div className="col-12 col-md-6">
              <div className="btn-group w-100" role="group">
                <button
                  type="button"
                  className={`btn btn-sm ${
                    estadoFiltro === "todos"
                      ? "btn-primary"
                      : "btn-outline-primary"
                  }`}
                  onClick={() => setEstadoFiltro("todos")}
                  style={{ borderRadius: "10px 0 0 10px" }}
                >
                  Todos
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${
                    estadoFiltro === "activo"
                      ? "btn-success"
                      : "btn-outline-success"
                  }`}
                  onClick={() => setEstadoFiltro("activo")}
                >
                  Activos
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${
                    estadoFiltro === "mora" ? "btn-danger" : "btn-outline-danger"
                  }`}
                  onClick={() => setEstadoFiltro("mora")}
                >
                  Mora
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${
                    estadoFiltro === "pendiente"
                      ? "btn-warning"
                      : "btn-outline-warning"
                  }`}
                  onClick={() => setEstadoFiltro("pendiente")}
                >
                  Pendientes
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${
                    estadoFiltro === "pagado"
                      ? "btn-secondary"
                      : "btn-outline-secondary"
                  }`}
                  onClick={() => setEstadoFiltro("pagado")}
                  style={{ borderRadius: "0 10px 10px 0" }}
                >
                  Pagados
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabla de Préstamos */}
      {loading ? (
        <div className="text-center py-5">
          <div
            className="spinner-border text-primary"
            role="status"
            style={{ width: "3rem", height: "3rem" }}
          >
            <span className="visually-hidden">Cargando...</span>
          </div>
          <p className="mt-3 text-muted">Cargando préstamos...</p>
        </div>
      ) : (
        <TablaPrestamos
          prestamos={prestamosFiltrados}
          usuarios={usuarios}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onVerDetalle={verDetalle}
          getEstadoInfo={getEstadoInfo}
        />
      )}

      {/* Modales */}
      {showModal && (
        <ModalPrestamo
          show={showModal}
          editPrestamo={editPrestamo}
          form={form}
          usuarios={usuarios}
          onClose={() => setShowModal(false)}
          onSubmit={handleSubmit}
          handleInput={handleInput}
        />
      )}

      {showDetalleModal && prestamoSeleccionado && (
        <ModalDetallePrestamo
          show={showDetalleModal}
          prestamo={prestamoSeleccionado}
          usuario={usuarios.find(
            (u) => u.id_usuario === prestamoSeleccionado.id_usuario
          )}
          onClose={() => setShowDetalleModal(false)}
          getEstadoInfo={getEstadoInfo}
        />
      )}
    </div>
  );
}

// ==================== COMPONENTE TABLA PRÉSTAMOS ====================
function TablaPrestamos({
  prestamos,
  usuarios,
  onEdit,
  onDelete,
  onVerDetalle,
  getEstadoInfo,
}) {
  const calcularProgreso = (prestamo) => {
    const monto = parseFloat(prestamo.monto || 0);
    const saldoRestante = parseFloat(prestamo.saldo_restante || monto);
    const pagado = monto - saldoRestante;
    return monto > 0 ? (pagado / monto) * 100 : 0;
  };

  return (
    <div
      className="card border-0 shadow-sm"
      style={{ borderRadius: "15px", overflow: "hidden" }}
    >
      <div className="card-body p-0">
        {prestamos.length === 0 ? (
          <div className="text-center py-5">
            <div className="mb-3" style={{ fontSize: "48px", opacity: 0.3 }}>
              💰
            </div>
            <h5 className="text-muted">No se encontraron préstamos</h5>
            <p className="text-muted small">
              Intenta con otros filtros de búsqueda
            </p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead
                style={{
                  background: "linear-gradient(135deg, #27ae60 0%, #229954 100%)",
                  color: "white",
                }}
              >
                <tr>
                  <th
                    className="text-center"
                    style={{ padding: "16px 12px", borderBottom: "none" }}
                  >
                    #
                  </th>
                  <th style={{ padding: "16px 12px", borderBottom: "none" }}>
                    Socio
                  </th>
                  <th style={{ padding: "16px 12px", borderBottom: "none" }}>
                    Monto / Saldo
                  </th>
                  <th style={{ padding: "16px 12px", borderBottom: "none" }}>
                    Términos
                  </th>
                  <th style={{ padding: "16px 12px", borderBottom: "none" }}>
                    Progreso
                  </th>
                  <th
                    className="text-center"
                    style={{ padding: "16px 12px", borderBottom: "none" }}
                  >
                    Estado
                  </th>
                  <th
                    className="text-center"
                    style={{ padding: "16px 12px", borderBottom: "none" }}
                  >
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {prestamos.map((p, i) => {
                  const usuario = usuarios.find((u) => u.id_usuario === p.id_usuario);
                  const estadoInfo = getEstadoInfo(p.estado);
                  const IconoEstado = estadoInfo.icon;
                  const progreso = calcularProgreso(p);

                  return (
                    <tr
                      key={p.id_prestamo}
                      style={{
                        transition: "all 0.2s ease",
                        cursor: "pointer",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = "scale(1.01)";
                        e.currentTarget.style.boxShadow =
                          "0 4px 12px rgba(0,0,0,0.1)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = "scale(1)";
                        e.currentTarget.style.boxShadow = "none";
                      }}
                    >
                      <td className="text-center" style={{ padding: "16px 12px" }}>
                        <div
                          className="rounded-circle d-inline-flex align-items-center justify-content-center fw-bold"
                          style={{
                            width: "32px",
                            height: "32px",
                            background:
                              "linear-gradient(135deg, #27ae60 0%, #229954 100%)",
                            color: "white",
                            fontSize: "12px",
                          }}
                        >
                          {i + 1}
                        </div>
                      </td>
                      <td style={{ padding: "16px 12px" }}>
                        <div className="d-flex align-items-center">
                          <div
                            className="rounded-circle d-flex align-items-center justify-content-center me-2"
                            style={{
                              width: "40px",
                              height: "40px",
                              background: "rgba(52, 152, 219, 0.1)",
                            }}
                          >
                            <FaUserTie style={{ color: "#3498db" }} />
                          </div>
                          <div>
                            <div className="fw-bold" style={{ color: "#2c3e50" }}>
                              {usuario?.nombre_completo || "Desconocido"}
                            </div>
                            <div className="small text-muted">
                              DNI: {usuario?.dni || "N/A"}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: "16px 12px" }}>
                        <div>
                          <div className="fw-bold" style={{ color: "#27ae60" }}>
                            L. {parseFloat(p.monto || 0).toFixed(2)}
                          </div>
                          <div className="small text-muted">
                            Saldo: L.{" "}
                            {parseFloat(p.saldo_restante || p.monto || 0).toFixed(2)}
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: "16px 12px" }}>
                        <div className="d-flex flex-column gap-1">
                          <div className="d-flex align-items-center small">
                            <FaPercentage
                              className="me-2"
                              style={{ fontSize: "12px", color: "#3498db" }}
                            />
                            {p.tasa_interes}% interés
                          </div>
                          <div className="d-flex align-items-center small">
                            <FaClock
                              className="me-2"
                              style={{ fontSize: "12px", color: "#f39c12" }}
                            />
                            {p.plazo_meses} meses
                          </div>
                          <div className="d-flex align-items-center small text-muted">
                            <FaCalendarAlt
                              className="me-2"
                              style={{ fontSize: "12px" }}
                            />
                            {p.fecha_otorgado?.substring(0, 10) || "N/A"}
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: "16px 12px" }}>
                        <div style={{ width: "60px", height: "60px", margin: "0 auto" }}>
                          <CircularProgressbar
                            value={progreso}
                            text={`${progreso.toFixed(0)}%`}
                            styles={buildStyles({
                              textSize: "24px",
                              pathColor: progreso === 100 ? "#27ae60" : "#3498db",
                              textColor: "#2c3e50",
                              trailColor: "#ecf0f1",
                            })}
                          />
                        </div>
                      </td>
                      <td className="text-center" style={{ padding: "16px 12px" }}>
                        <span
                          className="badge px-3 py-2 d-inline-flex align-items-center"
                          style={{
                            background: estadoInfo.bg,
                            color: estadoInfo.color,
                            fontWeight: "600",
                            borderRadius: "20px",
                          }}
                        >
                          <IconoEstado className="me-2" />
                          {estadoInfo.label}
                        </span>
                      </td>
                      <td className="text-center" style={{ padding: "16px 12px" }}>
                        <div className="d-flex gap-2 justify-content-center">
                          <button
                            className="btn btn-sm shadow-sm"
                            title="Ver detalle"
                            onClick={() => onVerDetalle(p)}
                            style={{
                              background: "rgba(52, 152, 219, 0.1)",
                              color: "#3498db",
                              border: "1px solid rgba(52, 152, 219, 0.3)",
                              borderRadius: "8px",
                              padding: "6px 12px",
                              transition: "all 0.2s ease",
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
                          >
                            <FaEye size={14} />
                          </button>
                          <button
                            className="btn btn-sm shadow-sm"
                            title="Editar préstamo"
                            onClick={() => onEdit(p)}
                            style={{
                              background: "rgba(243, 156, 18, 0.1)",
                              color: "#f39c12",
                              border: "1px solid rgba(243, 156, 18, 0.3)",
                              borderRadius: "8px",
                              padding: "6px 12px",
                              transition: "all 0.2s ease",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = "#f39c12";
                              e.currentTarget.style.color = "white";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background =
                                "rgba(243, 156, 18, 0.1)";
                              e.currentTarget.style.color = "#f39c12";
                            }}
                          >
                            <FaEdit size={14} />
                          </button>
                          <button
                            className="btn btn-sm shadow-sm"
                            title="Eliminar préstamo"
                            onClick={() => onDelete(p.id_prestamo)}
                            style={{
                              background: "rgba(231, 76, 60, 0.1)",
                              color: "#e74c3c",
                              border: "1px solid rgba(231, 76, 60, 0.3)",
                              borderRadius: "8px",
                              padding: "6px 12px",
                              transition: "all 0.2s ease",
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
                          >
                            <FaTrash size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Footer con contador */}
      {prestamos.length > 0 && (
        <div className="card-footer bg-light border-top-0 text-center py-3">
          <small className="text-muted">
            Mostrando <strong>{prestamos.length}</strong> préstamo
            {prestamos.length !== 1 ? "s" : ""}
          </small>
        </div>
      )}
    </div>
  );
}

// ==================== COMPONENTE MODAL PRÉSTAMO ====================
function ModalPrestamo({
  show,
  editPrestamo,
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
              {editPrestamo ? "Editar Préstamo" : "Nuevo Préstamo"}
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
                  <FaUserTie className="me-2" style={{ color: "#27ae60" }} />
                  Socio
                </label>
                <select
                  className="form-select form-select-lg"
                  name="id_usuario"
                  value={form.id_usuario}
                  onChange={handleInput}
                  required
                  disabled={editPrestamo !== null}
                  style={{
                    borderRadius: "10px",
                    border: "2px solid #e9ecef",
                    padding: "12px 16px",
                    background: editPrestamo ? "#e9ecef" : "white",
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

              {/* Monto e Interés */}
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
                  placeholder="15000.00"
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
                  <FaPercentage className="me-2" style={{ color: "#27ae60" }} />
                  Tasa de Interés (%)
                </label>
                <input
                  type="number"
                  className="form-control form-control-lg"
                  name="tasa_interes"
                  value={form.tasa_interes}
                  onChange={handleInput}
                  required
                  min="0"
                  step="0.01"
                  placeholder="5.00"
                  style={{
                    borderRadius: "10px",
                    border: "2px solid #e9ecef",
                    padding: "12px 16px",
                  }}
                />
              </div>

              {/* Plazo y Fecha */}
              <div className="col-md-6">
                <label
                  className="form-label fw-semibold d-flex align-items-center"
                  style={{ color: "#2c3e50" }}
                >
                  <FaClock className="me-2" style={{ color: "#27ae60" }} />
                  Plazo (meses)
                </label>
                <input
                  type="number"
                  className="form-control form-control-lg"
                  name="plazo_meses"
                  value={form.plazo_meses}
                  onChange={handleInput}
                  required
                  min="1"
                  placeholder="12"
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
                  Fecha de Otorgamiento
                </label>
                <input
                  type="date"
                  className="form-control form-control-lg"
                  name="fecha_otorgado"
                  value={form.fecha_otorgado}
                  onChange={handleInput}
                  required
                  style={{
                    borderRadius: "10px",
                    border: "2px solid #e9ecef",
                    padding: "12px 16px",
                  }}
                />
              </div>

              {/* Estado */}
              <div className="col-12">
                <label
                  className="form-label fw-semibold d-flex align-items-center"
                  style={{ color: "#2c3e50" }}
                >
                  <FaCheckCircle className="me-2" style={{ color: "#27ae60" }} />
                  Estado
                </label>
                <select
                  className="form-select form-select-lg"
                  name="estado"
                  value={form.estado}
                  onChange={handleInput}
                  required
                  style={{
                    borderRadius: "10px",
                    border: "2px solid #e9ecef",
                    padding: "12px 16px",
                  }}
                >
                  <option value="pendiente">⏳ Pendiente de Aprobación</option>
                  <option value="aprobado">✓ Aprobado</option>
                  <option value="activo">✓ Activo</option>
                  <option value="mora">⚠ En Mora</option>
                  <option value="pagado">✓ Pagado Completamente</option>
                  <option value="rechazado">✗ Rechazado</option>
                </select>
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
              <FaCheckCircle className="me-2" />
              {editPrestamo ? "Guardar Cambios" : "Registrar Préstamo"}
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
              <FaTimesCircle className="me-2" />
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ==================== COMPONENTE MODAL DETALLE PRÉSTAMO ====================
function ModalDetallePrestamo({ show, prestamo, usuario, onClose, getEstadoInfo }) {
  if (!show) return null;

  const estadoInfo = getEstadoInfo(prestamo.estado);
  const IconoEstado = estadoInfo.icon;

  // Calcular tabla de amortización
  const calcularAmortizacion = () => {
    const monto = parseFloat(prestamo.monto || 0);
    const tasaMensual = parseFloat(prestamo.tasa_interes || 0) / 100;
    const plazo = parseInt(prestamo.plazo_meses || 0);

    if (monto === 0 || plazo === 0) return [];

    // Cuota mensual con sistema francés
    const cuotaMensual =
      tasaMensual === 0
        ? monto / plazo
        : (monto * tasaMensual * Math.pow(1 + tasaMensual, plazo)) /
          (Math.pow(1 + tasaMensual, plazo) - 1);

    let saldo = monto;
    const tabla = [];

    for (let i = 1; i <= plazo; i++) {
      const interes = saldo * tasaMensual;
      const capital = cuotaMensual - interes;
      saldo = saldo - capital;

      tabla.push({
        cuota: i,
        capital: capital,
        interes: interes,
        cuotaMensual: cuotaMensual,
        saldo: Math.max(0, saldo),
      });
    }

    return tabla;
  };

  const tablaAmortizacion = calcularAmortizacion();
  const saldoRestante = parseFloat(prestamo.saldo_restante || prestamo.monto || 0);
  const monto = parseFloat(prestamo.monto || 0);
  const progreso = monto > 0 ? ((monto - saldoRestante) / monto) * 100 : 0;

  // Timeline states
  const getTimelineStates = () => {
    const estado = prestamo.estado;
    return {
      solicitud: true,
      aprobacion: ["aprobado", "activo", "mora", "pagado"].includes(estado),
      desembolso: ["activo", "mora", "pagado"].includes(estado),
      pago: estado === "pagado",
    };
  };

  const timeline = getTimelineStates();

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
        className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable"
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
              background: "linear-gradient(135deg, #27ae60 0%, #229954 100%)",
              padding: "24px",
            }}
          >
            <div>
              <h4 className="modal-title mb-1 d-flex align-items-center fw-bold">
                <FaMoneyBillWave className="me-3" style={{ fontSize: "24px" }} />
                Detalle del Préstamo
              </h4>
              <p className="mb-0 small" style={{ opacity: 0.9 }}>
                Préstamo #{prestamo.id_prestamo}
              </p>
            </div>
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
            {/* Información del Socio y Estado */}
            <div className="row g-4 mb-4">
              <div className="col-md-6">
                <div
                  className="card border-0 shadow-sm h-100"
                  style={{ borderRadius: "15px" }}
                >
                  <div className="card-body">
                    <h6 className="fw-bold mb-3" style={{ color: "#2c3e50" }}>
                      <FaUserTie className="me-2" style={{ color: "#3498db" }} />
                      Información del Socio
                    </h6>
                    <div className="mb-2">
                      <strong>Nombre:</strong> {usuario?.nombre_completo || "N/A"}
                    </div>
                    <div className="mb-2">
                      <strong>DNI:</strong> {usuario?.dni || "N/A"}
                    </div>
                    <div className="mb-2">
                      <strong>Teléfono:</strong> {usuario?.telefono || "N/A"}
                    </div>
                    <div>
                      <strong>Correo:</strong> {usuario?.correo || "N/A"}
                    </div>
                  </div>
                </div>
              </div>

              <div className="col-md-6">
                <div
                  className="card border-0 shadow-sm h-100"
                  style={{ borderRadius: "15px" }}
                >
                  <div className="card-body">
                    <h6 className="fw-bold mb-3" style={{ color: "#2c3e50" }}>
                      <FaChartLine className="me-2" style={{ color: "#27ae60" }} />
                      Estado del Préstamo
                    </h6>
                    <div className="d-flex align-items-center justify-content-between mb-3">
                      <span
                        className="badge px-3 py-2 d-inline-flex align-items-center"
                        style={{
                          background: estadoInfo.bg,
                          color: estadoInfo.color,
                          fontWeight: "600",
                          borderRadius: "20px",
                          fontSize: "14px",
                        }}
                      >
                        <IconoEstado className="me-2" />
                        {estadoInfo.label}
                      </span>
                      <div style={{ width: "80px", height: "80px" }}>
                        <CircularProgressbar
                          value={progreso}
                          text={`${progreso.toFixed(0)}%`}
                          styles={buildStyles({
                            textSize: "20px",
                            pathColor: progreso === 100 ? "#27ae60" : "#3498db",
                            textColor: "#2c3e50",
                            trailColor: "#ecf0f1",
                          })}
                        />
                      </div>
                    </div>
                    <div className="mb-2">
                      <strong>Monto Original:</strong> L.{" "}
                      {monto.toFixed(2)}
                    </div>
                    <div>
                      <strong>Saldo Restante:</strong>{" "}
                      <span style={{ color: "#27ae60", fontWeight: "bold" }}>
                        L. {saldoRestante.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Timeline del Proceso */}
            <div className="card border-0 shadow-sm mb-4" style={{ borderRadius: "15px" }}>
              <div className="card-body">
                <h6 className="fw-bold mb-4" style={{ color: "#2c3e50" }}>
                  <FaClock className="me-2" style={{ color: "#f39c12" }} />
                  Proceso del Préstamo
                </h6>
                <div className="d-flex align-items-center justify-content-between position-relative">
                  {/* Línea de conexión */}
                  <div
                    style={{
                      position: "absolute",
                      top: "20px",
                      left: "10%",
                      right: "10%",
                      height: "4px",
                      background: "#e9ecef",
                      zIndex: 0,
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: timeline.pago
                          ? "100%"
                          : timeline.desembolso
                          ? "66%"
                          : timeline.aprobacion
                          ? "33%"
                          : "0%",
                        background: "linear-gradient(90deg, #27ae60 0%, #229954 100%)",
                        transition: "width 0.3s ease",
                      }}
                    ></div>
                  </div>

                  {/* Paso 1: Solicitud */}
                  <div className="text-center" style={{ zIndex: 1, flex: 1 }}>
                    <div
                      className="rounded-circle d-inline-flex align-items-center justify-content-center mb-2"
                      style={{
                        width: "40px",
                        height: "40px",
                        background: timeline.solicitud
                          ? "linear-gradient(135deg, #27ae60 0%, #229954 100%)"
                          : "#e9ecef",
                        color: timeline.solicitud ? "white" : "#95a5a6",
                        boxShadow: timeline.solicitud
                          ? "0 4px 12px rgba(39, 174, 96, 0.3)"
                          : "none",
                      }}
                    >
                      <FaHourglassHalf size={16} />
                    </div>
                    <div className="small fw-semibold" style={{ color: "#2c3e50" }}>
                      Solicitud
                    </div>
                    <div className="small text-muted">
                      {prestamo.fecha_solicitud?.substring(0, 10) || "N/A"}
                    </div>
                  </div>

                  {/* Paso 2: Aprobación */}
                  <div className="text-center" style={{ zIndex: 1, flex: 1 }}>
                    <div
                      className="rounded-circle d-inline-flex align-items-center justify-content-center mb-2"
                      style={{
                        width: "40px",
                        height: "40px",
                        background: timeline.aprobacion
                          ? "linear-gradient(135deg, #27ae60 0%, #229954 100%)"
                          : "#e9ecef",
                        color: timeline.aprobacion ? "white" : "#95a5a6",
                        boxShadow: timeline.aprobacion
                          ? "0 4px 12px rgba(39, 174, 96, 0.3)"
                          : "none",
                      }}
                    >
                      <FaCheckCircle size={16} />
                    </div>
                    <div className="small fw-semibold" style={{ color: "#2c3e50" }}>
                      Aprobación
                    </div>
                    <div className="small text-muted">
                      {prestamo.fecha_aprobacion?.substring(0, 10) || "-"}
                    </div>
                  </div>

                  {/* Paso 3: Desembolso */}
                  <div className="text-center" style={{ zIndex: 1, flex: 1 }}>
                    <div
                      className="rounded-circle d-inline-flex align-items-center justify-content-center mb-2"
                      style={{
                        width: "40px",
                        height: "40px",
                        background: timeline.desembolso
                          ? "linear-gradient(135deg, #27ae60 0%, #229954 100%)"
                          : "#e9ecef",
                        color: timeline.desembolso ? "white" : "#95a5a6",
                        boxShadow: timeline.desembolso
                          ? "0 4px 12px rgba(39, 174, 96, 0.3)"
                          : "none",
                      }}
                    >
                      <FaMoneyBillWave size={16} />
                    </div>
                    <div className="small fw-semibold" style={{ color: "#2c3e50" }}>
                      Desembolso
                    </div>
                    <div className="small text-muted">
                      {prestamo.fecha_otorgado?.substring(0, 10) || "-"}
                    </div>
                  </div>

                  {/* Paso 4: Pago Completo */}
                  <div className="text-center" style={{ zIndex: 1, flex: 1 }}>
                    <div
                      className="rounded-circle d-inline-flex align-items-center justify-content-center mb-2"
                      style={{
                        width: "40px",
                        height: "40px",
                        background: timeline.pago
                          ? "linear-gradient(135deg, #27ae60 0%, #229954 100%)"
                          : "#e9ecef",
                        color: timeline.pago ? "white" : "#95a5a6",
                        boxShadow: timeline.pago
                          ? "0 4px 12px rgba(39, 174, 96, 0.3)"
                          : "none",
                      }}
                    >
                      <FaCheckCircle size={16} />
                    </div>
                    <div className="small fw-semibold" style={{ color: "#2c3e50" }}>
                      Pagado
                    </div>
                    <div className="small text-muted">
                      {prestamo.fecha_liquidacion?.substring(0, 10) || "-"}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Tabla de Amortización */}
            <div className="card border-0 shadow-sm" style={{ borderRadius: "15px" }}>
              <div className="card-body">
                <h6 className="fw-bold mb-3" style={{ color: "#2c3e50" }}>
                  <FaChartLine className="me-2" style={{ color: "#27ae60" }} />
                  Tabla de Amortización
                </h6>
                <div className="table-responsive">
                  <table className="table table-sm table-hover align-middle mb-0">
                    <thead
                      style={{
                        background:
                          "linear-gradient(135deg, #3498db 0%, #2980b9 100%)",
                        color: "white",
                      }}
                    >
                      <tr>
                        <th
                          className="text-center"
                          style={{ padding: "12px", borderBottom: "none" }}
                        >
                          Cuota
                        </th>
                        <th style={{ padding: "12px", borderBottom: "none" }}>
                          Capital
                        </th>
                        <th style={{ padding: "12px", borderBottom: "none" }}>
                          Interés
                        </th>
                        <th style={{ padding: "12px", borderBottom: "none" }}>
                          Cuota Mensual
                        </th>
                        <th style={{ padding: "12px", borderBottom: "none" }}>
                          Saldo Restante
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {tablaAmortizacion.map((fila) => (
                        <tr
                          key={fila.cuota}
                          style={{
                            background:
                              fila.cuota % 2 === 0 ? "#ffffff" : "#f8f9fa",
                          }}
                        >
                          <td
                            className="text-center fw-bold"
                            style={{ padding: "12px" }}
                          >
                            {fila.cuota}
                          </td>
                          <td style={{ padding: "12px" }}>
                            L. {fila.capital.toFixed(2)}
                          </td>
                          <td style={{ padding: "12px" }}>
                            L. {fila.interes.toFixed(2)}
                          </td>
                          <td
                            className="fw-bold"
                            style={{ padding: "12px", color: "#27ae60" }}
                          >
                            L. {fila.cuotaMensual.toFixed(2)}
                          </td>
                          <td style={{ padding: "12px", color: "#e74c3c" }}>
                            L. {fila.saldo.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot
                      style={{
                        background: "#2c3e50",
                        color: "white",
                        fontWeight: "bold",
                      }}
                    >
                      <tr>
                        <td
                          colSpan="1"
                          className="text-center"
                          style={{ padding: "12px" }}
                        >
                          TOTAL
                        </td>
                        <td style={{ padding: "12px" }}>
                          L.{" "}
                          {tablaAmortizacion
                            .reduce((acc, f) => acc + f.capital, 0)
                            .toFixed(2)}
                        </td>
                        <td style={{ padding: "12px" }}>
                          L.{" "}
                          {tablaAmortizacion
                            .reduce((acc, f) => acc + f.interes, 0)
                            .toFixed(2)}
                        </td>
                        <td style={{ padding: "12px" }}>
                          L.{" "}
                          {tablaAmortizacion
                            .reduce((acc, f) => acc + f.cuotaMensual, 0)
                            .toFixed(2)}
                        </td>
                        <td style={{ padding: "12px" }}>-</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div
            className="modal-footer border-0 bg-white"
            style={{ padding: "20px 32px" }}
          >
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
              <FaTimesCircle className="me-2" />
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
