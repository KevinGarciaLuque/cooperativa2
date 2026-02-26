import { useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { useAlerta } from "../context/AlertaContext";
import ModalConfirmacion from "../components/ModalConfirmacion";
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
    tipo_tasa: "nominal_anual",
    plazo_meses: "",
    fecha_otorgado: "",
    estado: "pendiente",
  });
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [prestamoParaEliminar, setPrestamoParaEliminar] = useState(null);

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
      // Convertir tasa al equivalente anual antes de enviar al backend
      const tasaInput = parseFloat(form.tasa_interes) || 0;
      let tasaAnual = tasaInput;
      if (form.tipo_tasa === "nominal_mensual") {
        tasaAnual = tasaInput * 12;
      } else if (form.tipo_tasa === "efectiva_mensual") {
        // TEM → TEA: (1 + TEM/100)^12 - 1
        tasaAnual = (Math.pow(1 + tasaInput / 100, 12) - 1) * 100;
      } else if (form.tipo_tasa === "efectiva_anual") {
        tasaAnual = tasaInput; // ya es anual efectiva, se usa directamente
      }
      const payload = {
        ...form,
        tasa_interes: parseFloat(tasaAnual.toFixed(4)),
        tasa_original: tasaInput,
      };
      if (editPrestamo) {
        await axios.put(
          `${API_URL}/prestamos/${editPrestamo.id_prestamo}`,
          payload,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        mostrarAlerta("Préstamo actualizado correctamente.", "success");
      } else {
        await axios.post(`${API_URL}/prestamos`, payload, {
          headers: { Authorization: `Bearer ${token}` },
        });
        mostrarAlerta("Préstamo registrado correctamente.", "success");
      }
      setForm({
        id_usuario: "",
        monto: "",
        tasa_interes: "",
        tipo_tasa: "nominal_anual",
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
      // Mostrar la tasa original ingresada por el usuario, no la convertida a anual
      tasa_interes: prestamo.tasa_original != null ? prestamo.tasa_original : prestamo.tasa_interes,
      tipo_tasa: prestamo.tipo_tasa || "nominal_anual",
      plazo_meses: prestamo.plazo_meses,
      fecha_otorgado: prestamo.fecha_otorgado
        ? prestamo.fecha_otorgado.substring(0, 10)
        : "",
      estado: prestamo.estado,
    });
    setShowModal(true);
  };

  const handleDelete = (id) => {
    setPrestamoParaEliminar(id);
    setShowConfirmDelete(true);
  };

  const confirmarEliminar = async () => {
    setShowConfirmDelete(false);
    try {
      await axios.delete(`${API_URL}/prestamos/${prestamoParaEliminar}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      mostrarAlerta("Préstamo eliminado correctamente.", "success");
      fetchData();
    } catch (err) {
      mostrarAlerta(
        err.response?.data?.message || "Error al eliminar el préstamo.",
        "error"
      );
    } finally {
      setPrestamoParaEliminar(null);
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
          token={token}
          apiUrl={API_URL}
        />
      )}

      <ModalConfirmacion
        show={showConfirmDelete}
        mensaje="¿Estás seguro que deseas eliminar este préstamo? Se eliminarán también todos sus pagos y cuotas registrados. Esta acción no se puede deshacer."
        onConfirm={confirmarEliminar}
        onCancel={() => {
          setShowConfirmDelete(false);
          setPrestamoParaEliminar(null);
        }}
      />
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
                            {parseFloat(p.tasa_original != null ? p.tasa_original : p.tasa_interes)}%{" "}
                            <span className="ms-1 badge" style={{
                              background: "#e8f0fe",
                              color: "#3498db",
                              fontSize: "0.65rem",
                              padding: "1px 5px",
                              borderRadius: "4px",
                            }}>
                              {TIPOS_TASA.find(t => t.value === (p.tipo_tasa || "nominal_anual"))?.abbr || "TNA"}
                            </span>
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

// ==================== HELPERS TASA ====================
const TIPOS_TASA = [
  {
    value: "nominal_anual",
    label: "Tasa Nominal Anual (TNA)",
    desc: "La más usada en cooperativas. Se divide entre 12 para obtener la cuota mensual.",
    abbr: "TNA",
    color: "#27ae60",
  },
  {
    value: "nominal_mensual",
    label: "Tasa Nominal Mensual (TNM)",
    desc: "Se multiplica por 12 para obtener la tasa anual equivalente.",
    abbr: "TNM",
    color: "#2980b9",
  },
  {
    value: "efectiva_anual",
    label: "Tasa Efectiva Anual (TEA)",
    desc: "Incluye la capitalización. Común en créditos formales y microfinanzas.",
    abbr: "TEA",
    color: "#8e44ad",
  },
  {
    value: "efectiva_mensual",
    label: "Tasa Efectiva Mensual (TEM)",
    desc: "Se convierte a TEA mediante: (1 + TEM)^12 - 1.",
    abbr: "TEM",
    color: "#e67e22",
  },
];

const calcularTasaAnual = (tasa, tipo) => {
  const t = parseFloat(tasa) || 0;
  if (tipo === "nominal_mensual") return t * 12;
  if (tipo === "efectiva_mensual") return (Math.pow(1 + t / 100, 12) - 1) * 100;
  return t; // nominal_anual y efectiva_anual ya son anuales
};

const calcularCuotaSimulador = (monto, tasaAnual, plazo) => {
  if (!monto || !tasaAnual || !plazo) return 0;
  const tm = tasaAnual / 100 / 12;
  if (tm === 0) return monto / plazo;
  return (monto * (tm * Math.pow(1 + tm, plazo))) / (Math.pow(1 + tm, plazo) - 1);
};

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

  const tipoTasaInfo = TIPOS_TASA.find((t) => t.value === (form.tipo_tasa || "nominal_anual"));
  const tasaAnualEquiv = calcularTasaAnual(form.tasa_interes, form.tipo_tasa || "nominal_anual");
  const tasaMensualEquiv = tasaAnualEquiv / 12;
  const cuotaSimulada = calcularCuotaSimulador(
    parseFloat(form.monto) || 0,
    tasaAnualEquiv,
    parseInt(form.plazo_meses) || 0
  );
  const totalPagar = cuotaSimulada * (parseInt(form.plazo_meses) || 0);
  const totalIntereses = totalPagar - (parseFloat(form.monto) || 0);
  const haySimulacion = form.monto && form.tasa_interes && form.plazo_meses && cuotaSimulada > 0;

  const fmt = (n) =>
    parseFloat(n || 0).toLocaleString("es-HN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <>
      <style>{`
        .pmt-tipo-btn { border: 2px solid #e2e8f0; border-radius: .75rem; padding: .65rem 1rem;
          cursor: pointer; transition: all .18s; background: #fff; text-align:left; }
        .pmt-tipo-btn:hover { border-color: #27ae60; background: #f0faf4; }
        .pmt-tipo-btn.selected { border-color: var(--tc); background: var(--tb); }
        .pmt-sim-card { background: linear-gradient(135deg,#27ae60,#1e8449);
          border-radius: 1rem; color: #fff; padding: 1.25rem 1.5rem; }
        .pmt-sim-item { background: rgba(255,255,255,.15); border-radius:.6rem;
          padding:.55rem .9rem; display:flex; justify-content:space-between; align-items:center; }
      `}</style>
      <div
        className="modal show d-block"
        tabIndex="-1"
        style={{
          background: "rgba(0,0,0,0.65)",
          backdropFilter: "blur(5px)",
          zIndex: 1200,
          position: "fixed",
          top: 0, left: 0,
          width: "100vw", height: "100vh",
          overflowY: "auto",
        }}
        onClick={onClose}
      >
        <div
          className="modal-dialog modal-xl modal-dialog-centered"
          style={{ maxWidth: 900 }}
          onClick={(e) => e.stopPropagation()}
        >
          <form
            className="modal-content border-0 shadow-lg"
            onSubmit={onSubmit}
            style={{ borderRadius: "1.25rem", overflow: "hidden" }}
          >
            {/* ── Header ── */}
            <div
              className="modal-header border-0 text-white"
              style={{
                background: "linear-gradient(135deg,#27ae60 0%,#1a7a40 100%)",
                padding: "22px 28px",
              }}
            >
              <div className="d-flex align-items-center gap-3">
                <div style={{ background: "rgba(255,255,255,.18)", borderRadius: ".8rem", padding: ".65rem" }}>
                  <FaMoneyBillWave size={22} />
                </div>
                <div>
                  <h4 className="modal-title mb-0 fw-bold">
                    {editPrestamo ? "Editar Préstamo" : "Nuevo Préstamo"}
                  </h4>
                  <div style={{ fontSize: ".8rem", opacity: .8 }}>
                    Sistema de amortización francés (cuota fija)
                  </div>
                </div>
              </div>
              <button type="button" className="btn-close btn-close-white" onClick={onClose} />
            </div>

            {/* ── Body ── */}
            <div className="modal-body p-0" style={{ background: "#f0f4f8" }}>
              <div className="row g-0">

                {/* Columna izquierda – formulario */}
                <div className="col-lg-7 p-4" style={{ background: "#f8fafc" }}>

                  {/* Socio */}
                  <div className="mb-3">
                    <label className="form-label fw-semibold small" style={{ color: "#2c3e50" }}>
                      <FaUserTie className="me-1 text-success" /> Socio
                    </label>
                    <select
                      className="form-select rounded-3"
                      name="id_usuario"
                      value={form.id_usuario}
                      onChange={handleInput}
                      required
                      disabled={editPrestamo !== null}
                      style={{ border: "2px solid #e2e8f0", padding: "10px 14px",
                        background: editPrestamo ? "#e9ecef" : "white" }}
                    >
                      <option value="">Seleccionar socio...</option>
                      {usuarios.map((u) => (
                        <option key={u.id_usuario} value={u.id_usuario}>
                          {u.nombre_completo} — {u.dni}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Monto */}
                  <div className="mb-3">
                    <label className="form-label fw-semibold small" style={{ color: "#2c3e50" }}>
                      <FaMoneyBillWave className="me-1 text-success" /> Monto del Préstamo (L.)
                    </label>
                    <div className="input-group">
                      <span className="input-group-text fw-bold" style={{ background: "#27ae60", color: "#fff", border: "2px solid #27ae60" }}>L.</span>
                      <input
                        type="number"
                        className="form-control rounded-end"
                        name="monto"
                        value={form.monto}
                        onChange={handleInput}
                        required
                        min="100"
                        step="0.01"
                        placeholder="0.00"
                        style={{ border: "2px solid #e2e8f0", borderLeft: "none", padding: "10px 14px" }}
                      />
                    </div>
                  </div>

                  {/* Tipo de Tasa */}
                  <div className="mb-3">
                    <label className="form-label fw-semibold small d-flex align-items-center gap-1" style={{ color: "#2c3e50" }}>
                      <FaPercentage className="text-success" /> Tipo de Tasa de Interés
                      <span className="badge ms-1 px-2" style={{ background: tipoTasaInfo?.color, fontSize: ".7rem" }}>
                        {tipoTasaInfo?.abbr}
                      </span>
                    </label>
                    <div className="row g-2 mb-2">
                      {TIPOS_TASA.map((t) => (
                        <div className="col-6" key={t.value}>
                          <button
                            type="button"
                            className={`pmt-tipo-btn w-100 ${(form.tipo_tasa || "nominal_anual") === t.value ? "selected" : ""}`}
                            style={{
                              "--tc": t.color,
                              "--tb": t.color + "12",
                              borderColor: (form.tipo_tasa || "nominal_anual") === t.value ? t.color : "#e2e8f0",
                              background: (form.tipo_tasa || "nominal_anual") === t.value ? t.color + "12" : "#fff",
                            }}
                            onClick={() => handleInput({ target: { name: "tipo_tasa", value: t.value } })}
                          >
                            <div className="fw-bold" style={{ fontSize: ".82rem", color: t.color }}>{t.abbr}</div>
                            <div style={{ fontSize: ".73rem", color: "#555", lineHeight: 1.3, marginTop: "2px" }}>
                              {t.label.split("(")[0].trim()}
                            </div>
                          </button>
                        </div>
                      ))}
                    </div>
                    {tipoTasaInfo && (
                      <div className="small px-2 py-1 rounded-2" style={{ background: tipoTasaInfo.color + "15", color: tipoTasaInfo.color, border: `1px solid ${tipoTasaInfo.color}30` }}>
                        ℹ {tipoTasaInfo.desc}
                      </div>
                    )}
                  </div>

                  {/* Valor de la Tasa */}
                  <div className="mb-3">
                    <label className="form-label fw-semibold small" style={{ color: "#2c3e50" }}>
                      Valor de la Tasa ({tipoTasaInfo?.abbr})
                    </label>
                    <div className="input-group">
                      <input
                        type="number"
                        className="form-control rounded-start"
                        name="tasa_interes"
                        value={form.tasa_interes}
                        onChange={handleInput}
                        required
                        min="0.01"
                        max="100"
                        step="0.001"
                        placeholder={form.tipo_tasa === "nominal_mensual" || form.tipo_tasa === "efectiva_mensual" ? "2.00" : "24.00"}
                        style={{ border: "2px solid #e2e8f0", padding: "10px 14px" }}
                      />
                      <span className="input-group-text fw-bold" style={{ background: tipoTasaInfo?.color, color: "#fff", border: `2px solid ${tipoTasaInfo?.color}` }}>%</span>
                    </div>
                    {form.tasa_interes > 0 && (
                      <div className="d-flex gap-3 mt-1 small text-muted">
                        <span>≈ <strong>{+tasaMensualEquiv.toFixed(4)}%</strong> mensual</span>
                        <span>≈ <strong>{+tasaAnualEquiv.toFixed(4)}%</strong> anual equiv.</span>
                      </div>
                    )}
                  </div>

                  {/* Plazo y Fecha */}
                  <div className="row g-3 mb-3">
                    <div className="col-6">
                      <label className="form-label fw-semibold small" style={{ color: "#2c3e50" }}>
                        <FaClock className="me-1 text-success" /> Plazo (meses)
                      </label>
                      <input
                        type="number"
                        className="form-control rounded-3"
                        name="plazo_meses"
                        value={form.plazo_meses}
                        onChange={handleInput}
                        required
                        min="1"
                        max="360"
                        step="1"
                        placeholder="Ej: 12"
                        list="plazo-opciones"
                        style={{ border: "2px solid #e2e8f0", padding: "10px 14px" }}
                      />
                      <datalist id="plazo-opciones">
                        {[3,6,9,12,18,24,36,48,60,72,84,96,120].map(m => (
                          <option key={m} value={m}>{m} meses{m >= 12 ? ` (${m/12} año${m/12>1?"s":""})` : ""}</option>
                        ))}
                      </datalist>
                      {form.plazo_meses > 0 && (
                        <div className="small text-muted mt-1">
                          {form.plazo_meses >= 12
                            ? `${Math.floor(form.plazo_meses / 12)} año${Math.floor(form.plazo_meses/12)>1?"s":""} ${form.plazo_meses % 12 > 0 ? `y ${form.plazo_meses % 12} mes${form.plazo_meses%12>1?"es":""}` : ""}`
                            : `${form.plazo_meses} mes${form.plazo_meses>1?"es":""}`}
                        </div>
                      )}
                    </div>
                    <div className="col-6">
                      <label className="form-label fw-semibold small" style={{ color: "#2c3e50" }}>
                        <FaCalendarAlt className="me-1 text-success" /> Fecha Otorgamiento
                      </label>
                      <input
                        type="date"
                        className="form-control rounded-3"
                        name="fecha_otorgado"
                        value={form.fecha_otorgado}
                        onChange={handleInput}
                        required
                        style={{ border: "2px solid #e2e8f0", padding: "10px 14px" }}
                      />
                    </div>
                  </div>

                  {/* Estado */}
                  <div>
                    <label className="form-label fw-semibold small" style={{ color: "#2c3e50" }}>
                      <FaCheckCircle className="me-1 text-success" /> Estado inicial
                    </label>
                    <select
                      className="form-select rounded-3"
                      name="estado"
                      value={form.estado}
                      onChange={handleInput}
                      required
                      style={{ border: "2px solid #e2e8f0", padding: "10px 14px" }}
                    >
                      <option value="pendiente">⏳ Pendiente de Aprobación</option>
                      <option value="aprobado">✅ Aprobado</option>
                      <option value="activo">✅ Activo</option>
                      <option value="mora">⚠️ En Mora</option>
                      <option value="pagado">✅ Pagado Completamente</option>
                      <option value="rechazado">❌ Rechazado</option>
                    </select>
                  </div>
                </div>

                {/* Columna derecha – simulador */}
                <div className="col-lg-5 p-4 d-flex flex-column gap-3"
                  style={{ background: "#edf2f7", borderLeft: "1px solid #e2e8f0" }}>
                  <div className="fw-bold" style={{ color: "#2c3e50", fontSize: ".95rem" }}>
                    📊 Simulador de Cuotas
                  </div>

                  {haySimulacion ? (
                    <>
                      {/* Card principal */}
                      <div className="pmt-sim-card shadow-sm">
                        <div className="small mb-1" style={{ opacity: .85 }}>Cuota mensual estimada</div>
                        <div className="fw-bold" style={{ fontSize: "2rem", letterSpacing: "-.5px" }}>
                          L. {fmt(cuotaSimulada)}
                        </div>
                        <div className="small mt-1" style={{ opacity: .75 }}>
                          Sistema francés · {form.plazo_meses} cuotas fijas
                        </div>
                      </div>

                      {/* Desglose */}
                      <div className="d-flex flex-column gap-2">
                        <div className="pmt-sim-item" style={{ background: "#fff", border: "1px solid #e2e8f0" }}>
                          <span className="small text-muted">Monto solicitado</span>
                          <strong style={{ color: "#2c3e50" }}>L. {fmt(form.monto)}</strong>
                        </div>
                        <div className="pmt-sim-item" style={{ background: "#fff", border: "1px solid #e2e8f0" }}>
                          <span className="small text-muted">Tasa anual equivalente</span>
                          <strong style={{ color: "#27ae60" }}>{+tasaAnualEquiv.toFixed(2)}%</strong>
                        </div>
                        <div className="pmt-sim-item" style={{ background: "#fff", border: "1px solid #e2e8f0" }}>
                          <span className="small text-muted">Tasa mensual efectiva</span>
                          <strong style={{ color: "#2980b9" }}>{+tasaMensualEquiv.toFixed(4)}%</strong>
                        </div>
                        <div className="pmt-sim-item" style={{ background: "#fff3cd", border: "1px solid #ffc107" }}>
                          <span className="small" style={{ color: "#856404" }}>Total intereses</span>
                          <strong style={{ color: "#b7791f" }}>L. {fmt(totalIntereses)}</strong>
                        </div>
                        <div className="pmt-sim-item" style={{ background: "#d4edda", border: "1px solid #28a745" }}>
                          <span className="small" style={{ color: "#155724" }}>Total a pagar</span>
                          <strong style={{ color: "#155724" }}>L. {fmt(totalPagar)}</strong>
                        </div>
                      </div>

                      {/* Barra costo del crédito */}
                      <div>
                        <div className="d-flex justify-content-between small text-muted mb-1">
                          <span>Capital</span>
                          <span>Intereses</span>
                        </div>
                        <div style={{ height: 10, borderRadius: 6, background: "#e2e8f0", overflow: "hidden" }}>
                          <div style={{
                            height: "100%",
                            width: `${totalPagar > 0 ? (parseFloat(form.monto) / totalPagar * 100) : 0}%`,
                            background: "linear-gradient(90deg,#27ae60,#1e8449)",
                            borderRadius: 6,
                            transition: "width .4s"
                          }} />
                        </div>
                        <div className="d-flex justify-content-between small text-muted mt-1">
                          <span>{totalPagar > 0 ? (parseFloat(form.monto) / totalPagar * 100).toFixed(1) : 0}%</span>
                          <span>{totalPagar > 0 ? (totalIntereses / totalPagar * 100).toFixed(1) : 0}%</span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-4" style={{ color: "#9ca3af" }}>
                      <FaMoneyBillWave size={36} style={{ opacity: .3, marginBottom: 8 }} />
                      <p className="small mb-0">
                        Ingresa monto, tasa y plazo para ver la simulación de cuotas.
                      </p>
                    </div>
                  )}

                  {/* Tasas de referencia cooperativas */}
                  <div className="mt-auto">
                    <div className="small fw-semibold mb-2" style={{ color: "#64748b" }}>
                      Tasas de referencia usuales en cooperativas:
                    </div>
                    <div className="d-flex flex-wrap gap-1">
                      {[
                        { label: "12% TNA", v: "12", t: "nominal_anual" },
                        { label: "18% TNA", v: "18", t: "nominal_anual" },
                        { label: "24% TNA", v: "24", t: "nominal_anual" },
                        { label: "2% TNM", v: "2",  t: "nominal_mensual" },
                        { label: "3% TNM", v: "3",  t: "nominal_mensual" },
                      ].map((ref) => (
                        <button
                          key={ref.label}
                          type="button"
                          className="btn btn-sm"
                          style={{ background: "#e2e8f0", color: "#2c3e50", fontSize: ".72rem", borderRadius: ".5rem", padding: "2px 8px" }}
                          onClick={() => {
                            handleInput({ target: { name: "tasa_interes", value: ref.v } });
                            handleInput({ target: { name: "tipo_tasa",    value: ref.t } });
                          }}
                        >
                          {ref.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Footer ── */}
            <div className="modal-footer border-0 bg-white px-4 py-3 gap-2">
              <button
                type="submit"
                className="btn btn-lg shadow-sm fw-semibold"
                style={{
                  background: "linear-gradient(135deg,#27ae60,#1e8449)",
                  color: "white", border: "none",
                  borderRadius: "10px", padding: "11px 32px",
                }}
              >
                <FaCheckCircle className="me-2" />
                {editPrestamo ? "Guardar Cambios" : "Registrar Préstamo"}
              </button>
              <button
                type="button"
                className="btn btn-lg btn-light shadow-sm fw-semibold"
                onClick={onClose}
                style={{ borderRadius: "10px", padding: "11px 28px" }}
              >
                <FaTimesCircle className="me-2" />
                Cancelar
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

// ==================== COMPONENTE MODAL DETALLE PRÉSTAMO ====================
function ModalDetallePrestamo({ show, prestamo, usuario, onClose, getEstadoInfo, token, apiUrl }) {
  const [cuotaPersonalizada, setCuotaPersonalizada] = useState("");
  const [pagosPrestamo, setPagosPrestamo] = useState([]);

  // Cargar pagos reales del préstamo desde la API
  useEffect(() => {
    if (show && prestamo?.id_prestamo && token && apiUrl) {
      axios
        .get(`${apiUrl}/pagos/prestamo/${prestamo.id_prestamo}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        .then((res) => {
          const data = (res.data.data || []).sort(
            (a, b) => new Date(a.fecha_pago) - new Date(b.fecha_pago)
          );
          setPagosPrestamo(data);
        })
        .catch(() => setPagosPrestamo([]));
    }
    if (!show) setPagosPrestamo([]);
  }, [show, prestamo?.id_prestamo, token, apiUrl]);

  // Mapeo: número de cuota (1-N) → pago real
  const pagoMap = {};
  pagosPrestamo.forEach((p, i) => {
    pagoMap[i + 1] = p;
  });

  const metodoBadgeConfig = {
    efectivo:            { label: "💵 Efectivo",      color: "#27ae60", bg: "rgba(39,174,96,0.12)" },
    transferencia:       { label: "🏦 Transferencia", color: "#3498db", bg: "rgba(52,152,219,0.12)" },
    cheque:              { label: "📋 Cheque",         color: "#9b59b6", bg: "rgba(155,89,182,0.12)" },
    deposito:            { label: "🏧 Depósito",       color: "#e67e22", bg: "rgba(230,126,34,0.12)" },
    "tarjeta de débito": { label: "💳 T. Débito",      color: "#e74c3c", bg: "rgba(231,76,60,0.12)" },
    "pago móvil":         { label: "📱 Pago Móvil",    color: "#1abc9c", bg: "rgba(26,188,156,0.12)" },
  };

  if (!show) return null;

  const estadoInfo = getEstadoInfo(prestamo.estado);
  const IconoEstado = estadoInfo.icon;

  const montoP = parseFloat(prestamo.monto || 0);
  // La tasa se almacena en BD como % anual; tasa_original guarda el % mensual ingresado por el usuario
  const tasaMensualP =
    prestamo.tasa_original != null
      ? parseFloat(prestamo.tasa_original || 0) / 100
      : parseFloat(prestamo.tasa_interes || 0) / 100 / 12;
  const tasaMensualPct = parseFloat((tasaMensualP * 100).toFixed(4));
  const tasaAnualPct = parseFloat((tasaMensualP * 12 * 100).toFixed(4));
  const plazoP = parseInt(prestamo.plazo_meses || 0);

  // Calcular fecha de vencimiento de cada cuota
  const calcularFechaVencimiento = (cuotaNum) => {
    if (!prestamo.fecha_otorgado) return null;
    const base = new Date(prestamo.fecha_otorgado);
    base.setMonth(base.getMonth() + cuotaNum);
    return base.toISOString().substring(0, 10);
  };

  // Cuota mínima sistema francés (referencia matemática)
  const cuotaFrances =
    montoP === 0 || plazoP === 0
      ? 0
      : tasaMensualP === 0
      ? montoP / plazoP
      : (montoP * tasaMensualP * Math.pow(1 + tasaMensualP, plazoP)) /
        (Math.pow(1 + tasaMensualP, plazoP) - 1);

  // Detectar cuota real acordada desde los pagos registrados
  // (tomar el primer pago no-último como referencia del monto acordado)
  const cuotaDetectada = (() => {
    if (pagosPrestamo.length === 0) return 0;
    // Usar los pagos que no sean el último (el último puede ser parcial)
    const pagosRef = pagosPrestamo.length > 1
      ? pagosPrestamo.slice(0, -1)
      : pagosPrestamo;
    const montos = pagosRef.map((pg) => parseFloat(pg.monto_pagado || 0));
    // Moda: el monto más frecuente
    const cuenta = {};
    montos.forEach((m) => { const k = m.toFixed(2); cuenta[k] = (cuenta[k] || 0) + 1; });
    const moda = parseFloat(Object.entries(cuenta).sort((a, b) => b[1] - a[1])[0][0]);
    return moda;
  })();

  // Cuota estándar = la real detectada (si >= francés) o la mínima de francés
  const cuotaEstandar = cuotaDetectada >= cuotaFrances - 0.005
    ? cuotaDetectada
    : cuotaFrances;

  const cuotaCustom = parseFloat(cuotaPersonalizada) || 0;
  const usandoCustom = cuotaCustom > cuotaEstandar + 0.005;

  // Calcular tabla de amortización (estándar o personalizada)
  const calcularAmortizacion = (cuotaOverride = null) => {
    if (montoP === 0 || plazoP === 0) return [];

    const cuota =
      cuotaOverride && cuotaOverride > cuotaEstandar + 0.005
        ? cuotaOverride
        : cuotaEstandar;

    let saldo = montoP;
    const tabla = [];
    const MAX_ITER = 1200;

    while (saldo > 0.005 && tabla.length < MAX_ITER) {
      const saldoInicial = saldo;
      const numCuota = tabla.length + 1;
      const interes = saldo * tasaMensualP;
      let pagoCapital = cuota - interes;
      if (pagoCapital <= 0) break; // tasa mayor que cuota, evitar loop infinito
      if (pagoCapital > saldo) pagoCapital = saldo;
      const pagoReal = pagoCapital + interes;
      saldo = Math.max(0, saldo - pagoCapital);
      tabla.push({
        cuota: numCuota,
        fecha: calcularFechaVencimiento(numCuota),
        saldoInicial: saldoInicial,
        capital: pagoCapital,
        interes: interes,
        cuotaMensual: pagoReal,
        abonoExtra:
          cuotaOverride && cuotaOverride > cuotaEstandar + 0.005
            ? pagoReal - cuotaEstandar
            : 0,
        saldo: saldo,
      });
    }

    return tabla;
  };

  const tablaAmortizacion = calcularAmortizacion(usandoCustom ? cuotaCustom : null);

  // Tabla estándar para comparación de ahorros
  const tablaEstandar = calcularAmortizacion(null);
  const interesesEstandar = tablaEstandar.reduce((a, f) => a + f.interes, 0);
  const interesesCustom = tablaAmortizacion.reduce((a, f) => a + f.interes, 0);
  const cuotasAhorradas = tablaEstandar.length - tablaAmortizacion.length;
  const ahorroIntereses = interesesEstandar - interesesCustom;

  const saldoRestante = parseFloat(prestamo.saldo_restante || prestamo.monto || 0);
  const monto = montoP;
  const progreso = monto > 0 ? ((monto - saldoRestante) / monto) * 100 : 0;

  const fmt = (n) =>
    parseFloat(n || 0).toLocaleString("es-HN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

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
                {/* Encabezado + simulador de cuota */}
                <div className="d-flex flex-wrap align-items-start justify-content-between gap-3 mb-3">
                  <div>
                    <h6 className="fw-bold mb-1" style={{ color: "#2c3e50" }}>
                      <FaChartLine className="me-2" style={{ color: "#27ae60" }} />
                      Tabla de Amortización
                    </h6>
                    <div className="d-flex flex-wrap gap-3" style={{ fontSize: ".8rem", color: "#555" }}>
                      <span>
                        Principal:{" "}
                        <strong style={{ color: "#2c3e50" }}>L. {fmt(montoP)}</strong>
                      </span>
                      <span>
                        Tasa mensual:{" "}
                        <strong style={{ color: "#e67e22" }}>{tasaMensualPct}%</strong>
                      </span>
                      <span>
                        Tasa anual equiv.:{" "}
                        <strong style={{ color: "#e67e22" }}>{tasaAnualPct}%</strong>
                      </span>
                      <span>
                        1er pago:{" "}
                        <strong style={{ color: "#2c3e50" }}>
                          {calcularFechaVencimiento(1) || "—"}
                        </strong>
                      </span>
                    </div>
                  </div>

                  {/* Simulador cuota personalizada */}
                  <div
                    style={{
                      background: "linear-gradient(135deg,#edf7ff,#dbeeff)",
                      border: "1.5px solid #90caf9",
                      borderRadius: "12px",
                      padding: "12px 16px",
                      minWidth: "280px",
                    }}
                  >
                    <div
                      className="small fw-bold mb-2"
                      style={{ color: "#1565c0" }}
                    >
                      💡 Simular cuota personalizada
                    </div>
                    <div className="d-flex align-items-center gap-2">
                      <div className="input-group input-group-sm" style={{ maxWidth: 200 }}>
                        <span
                          className="input-group-text fw-bold"
                          style={{ background: "#1976d2", color: "#fff", border: "none" }}
                        >
                          L.
                        </span>
                        <input
                          type="number"
                          className="form-control"
                          style={{ border: "1.5px solid #90caf9" }}
                          placeholder={`Mín. ${fmt(cuotaFrances)}`}
                          min={cuotaFrances.toFixed(2)}
                          step="0.01"
                          value={cuotaPersonalizada}
                          onChange={(e) => setCuotaPersonalizada(e.target.value)}
                        />
                      </div>
                      {cuotaPersonalizada && (
                        <button
                          type="button"
                          className="btn btn-sm"
                          style={{
                            background: "#e3f2fd",
                            color: "#1565c0",
                            border: "1px solid #90caf9",
                            borderRadius: "8px",
                          }}
                          onClick={() => setCuotaPersonalizada("")}
                          title="Restaurar cuota estándar"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                    <div className="small mt-1" style={{ color: "#555" }}>
                      Cuota acordada:{" "}
                      <strong style={{ color: cuotaDetectada > 0 ? "#27ae60" : "#e67e22" }}>L. {fmt(cuotaEstandar)}</strong>
                      {cuotaDetectada > 0 && Math.abs(cuotaDetectada - cuotaFrances) > 0.05 && (
                        <span className="ms-1" style={{ color: "#7f8c8d" }}>
                          (mín. francés: L. {fmt(cuotaFrances)})
                        </span>
                      )}
                    </div>
                    {cuotaPersonalizada && !usandoCustom && (
                      <div className="small mt-1" style={{ color: "#e53935" }}>
                        ⚠ Ingresa un valor mayor a L. {fmt(cuotaEstandar)}
                      </div>
                    )}
                  </div>
                </div>

                {/* Banner de ahorro */}
                {usandoCustom && (
                  <div
                    className="rounded-3 mb-3 p-3"
                    style={{
                      background: "linear-gradient(135deg,#e8f5e9,#f1f8e9)",
                      border: "1.5px solid #a5d6a7",
                    }}
                  >
                    <div className="row g-2 text-center">
                      <div className="col-6 col-md-3">
                        <div className="small text-muted">Cuota personalizada</div>
                        <div className="fw-bold" style={{ color: "#1565c0", fontSize: "1rem" }}>
                          L. {fmt(cuotaCustom)}
                        </div>
                        <div className="small" style={{ color: "#e53935" }}>
                          +L. {fmt(cuotaCustom - cuotaEstandar)} extra/mes
                        </div>
                      </div>
                      <div className="col-6 col-md-3">
                        <div className="small text-muted">Cuotas necesarias</div>
                        <div className="fw-bold" style={{ color: "#2c3e50", fontSize: "1rem" }}>
                          {tablaAmortizacion.length}{" "}
                          <span className="small text-muted fw-normal">de {tablaEstandar.length}</span>
                        </div>
                        <div className="small" style={{ color: "#27ae60" }}>
                          {cuotasAhorradas > 0
                            ? `✂ ${cuotasAhorradas} cuota${cuotasAhorradas !== 1 ? "s" : ""} menos`
                            : "Sin ahorro de tiempo"}
                        </div>
                      </div>
                      <div className="col-6 col-md-3">
                        <div className="small text-muted">Intereses totales</div>
                        <div className="fw-bold" style={{ color: "#b7791f", fontSize: "1rem" }}>
                          L. {fmt(interesesCustom)}
                        </div>
                        <div className="small text-muted">
                          vs L. {fmt(interesesEstandar)} estándar
                        </div>
                      </div>
                      <div className="col-6 col-md-3">
                        <div className="small text-muted">Ahorro en intereses</div>
                        <div
                          className="fw-bold"
                          style={{
                            color: ahorroIntereses > 0 ? "#27ae60" : "#e53935",
                            fontSize: "1rem",
                          }}
                        >
                          {ahorroIntereses > 0 ? "🎉 " : ""}L. {fmt(ahorroIntereses)}
                        </div>
                        <div className="small" style={{ color: "#27ae60" }}>
                          {ahorroIntereses > 0
                            ? `${((ahorroIntereses / interesesEstandar) * 100).toFixed(1)}% menos interés`
                            : ""}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="table-responsive">
                  <table className="table table-sm table-hover align-middle mb-0">
                    <thead
                      style={{
                        background: usandoCustom
                          ? "linear-gradient(135deg, #1565c0 0%, #1976d2 100%)"
                          : "linear-gradient(135deg, #3498db 0%, #2980b9 100%)",
                        color: "white",
                      }}
                    >
                      <tr>
                        <th
                          className="text-center"
                          style={{ padding: "10px 12px", borderBottom: "none", whiteSpace: "nowrap" }}
                        >
                          #
                        </th>
                        <th style={{ padding: "10px 12px", borderBottom: "none", whiteSpace: "nowrap" }}>
                          Fecha Venc.
                        </th>
                        <th style={{ padding: "10px 12px", borderBottom: "none", whiteSpace: "nowrap" }}>
                          Saldo Inicial
                        </th>
                        <th style={{ padding: "10px 12px", borderBottom: "none", whiteSpace: "nowrap" }}>
                          Interés ({tasaMensualPct}%)
                        </th>
                        <th style={{ padding: "10px 12px", borderBottom: "none", whiteSpace: "nowrap" }}>
                          Pago
                        </th>
                        <th style={{ padding: "10px 12px", borderBottom: "none", whiteSpace: "nowrap" }}>
                          Abono Capital
                        </th>
                        {usandoCustom && (
                          <th
                            style={{
                              padding: "10px 12px",
                              borderBottom: "none",
                              background: "rgba(255,255,255,0.15)",
                              whiteSpace: "nowrap",
                            }}
                          >
                            Abono Extra
                          </th>
                        )}
                        <th style={{ padding: "10px 12px", borderBottom: "none", whiteSpace: "nowrap" }}>
                          Saldo Final
                        </th>
                        <th style={{ padding: "10px 12px", borderBottom: "none", whiteSpace: "nowrap" }}>
                          Estado
                        </th>
                        <th style={{ padding: "10px 12px", borderBottom: "none", whiteSpace: "nowrap" }}>
                          Método
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {tablaAmortizacion.map((fila) => {
                        const esUltima = fila.cuota === tablaAmortizacion.length;
                        const tieneExtra = fila.abonoExtra > 0.005;
                        const pagoReal = pagoMap[fila.cuota];
                        const estaPagado = !!pagoReal;
                        const metodoPago = pagoReal?.metodo_pago || null;
                        const metodoInfo = metodoPago
                          ? metodoBadgeConfig[metodoPago.toLowerCase()] || { label: metodoPago, color: "#7f8c8d", bg: "#f1f1f1" }
                          : null;
                        return (
                          <tr
                            key={fila.cuota}
                            style={{
                              background: estaPagado
                                ? "rgba(39,174,96,0.08)"
                                : esUltima
                                ? "#e8f5e9"
                                : fila.cuota % 2 === 0
                                ? "#ffffff"
                                : "#f8f9fa",
                              transition: "background 0.15s",
                              opacity: estaPagado ? 0.92 : 1,
                            }}
                          >
                            <td
                              className="text-center fw-bold"
                              style={{ padding: "10px 12px", color: estaPagado ? "#27ae60" : esUltima ? "#27ae60" : "#2c3e50", whiteSpace: "nowrap" }}
                            >
                              {fila.cuota}
                              {estaPagado && (
                                <span className="ms-1" style={{ fontSize: ".65rem", color: "#27ae60" }}>✓</span>
                              )}
                            </td>
                            <td style={{ padding: "10px 12px", whiteSpace: "nowrap", color: "#546e7a" }}>
                              {fila.fecha || "—"}
                            </td>
                            <td style={{ padding: "10px 12px", whiteSpace: "nowrap", color: "#2c3e50" }}>
                              L. {fmt(fila.saldoInicial)}
                            </td>
                            <td style={{ padding: "10px 12px", whiteSpace: "nowrap", color: "#b7791f" }}>
                              L. {fmt(fila.interes)}
                            </td>
                            <td
                              className="fw-bold"
                              style={{ padding: "10px 12px", whiteSpace: "nowrap", color: "#27ae60" }}
                            >
                              L. {fmt(fila.cuotaMensual)}
                            </td>
                            <td style={{ padding: "10px 12px", whiteSpace: "nowrap", color: "#1565c0" }}>
                              L. {fmt(fila.capital)}
                            </td>
                            {usandoCustom && (
                              <td
                                style={{
                                  padding: "10px 12px",
                                  whiteSpace: "nowrap",
                                  color: tieneExtra ? "#1565c0" : "#aaa",
                                  fontWeight: tieneExtra ? "600" : "400",
                                  background: tieneExtra ? "rgba(21,101,192,0.05)" : "transparent",
                                }}
                              >
                                {tieneExtra ? `+L. ${fmt(fila.abonoExtra)}` : "—"}
                              </td>
                            )}
                            <td style={{ padding: "10px 12px", whiteSpace: "nowrap", color: fila.saldo < 0.01 ? "#27ae60" : "#e74c3c", fontWeight: fila.saldo < 0.01 ? "700" : "400" }}>
                              L. {fmt(fila.saldo)}
                            </td>
                            {/* Estado */}
                            <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>
                              {estaPagado ? (
                                <span
                                  className="badge"
                                  style={{
                                    background: "rgba(39,174,96,0.15)",
                                    color: "#27ae60",
                                    border: "1.5px solid #27ae60",
                                    borderRadius: "8px",
                                    fontSize: "11px",
                                    padding: "3px 8px",
                                    fontWeight: "700",
                                  }}
                                >
                                  ✓ Pagado
                                </span>
                              ) : (
                                <span
                                  className="badge"
                                  style={{
                                    background: "rgba(149,165,166,0.12)",
                                    color: "#95a5a6",
                                    border: "1.5px solid #bdc3c7",
                                    borderRadius: "8px",
                                    fontSize: "11px",
                                    padding: "3px 8px",
                                  }}
                                >
                                  Pendiente
                                </span>
                              )}
                            </td>
                            {/* Método */}
                            <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>
                              {metodoInfo ? (
                                <span
                                  className="badge"
                                  style={{
                                    background: metodoInfo.bg,
                                    color: metodoInfo.color,
                                    border: `1.5px solid ${metodoInfo.color}`,
                                    borderRadius: "8px",
                                    fontSize: "11px",
                                    padding: "3px 8px",
                                    fontWeight: "600",
                                  }}
                                >
                                  {metodoInfo.label}
                                </span>
                              ) : (
                                <span style={{ color: "#ccc" }}>—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot
                      style={{
                        background: "#2c3e50",
                        color: "white",
                        fontWeight: "bold",
                      }}
                    >
                      <tr>
                        <td className="text-center" style={{ padding: "12px" }}>TOTAL</td>
                        <td style={{ padding: "12px" }}>—</td>
                        <td style={{ padding: "12px" }}>—</td>
                        <td style={{ padding: "12px" }}>
                          L. {fmt(tablaAmortizacion.reduce((acc, f) => acc + f.interes, 0))}
                        </td>
                        <td style={{ padding: "12px" }}>
                          L. {fmt(tablaAmortizacion.reduce((acc, f) => acc + f.cuotaMensual, 0))}
                        </td>
                        <td style={{ padding: "12px" }}>
                          L. {fmt(tablaAmortizacion.reduce((acc, f) => acc + f.capital, 0))}
                        </td>
                        {usandoCustom && (
                          <td style={{ padding: "12px" }}>
                            +L. {fmt(tablaAmortizacion.reduce((acc, f) => acc + f.abonoExtra, 0))}
                          </td>
                        )}
                        <td style={{ padding: "12px" }}>L. 0.00</td>
                        <td style={{ padding: "12px" }}>
                          <span style={{ color: "#27ae60" }}>{pagosPrestamo.length} pagadas</span>
                          {" / "}
                          <span style={{ color: "#95a5a6" }}>{tablaAmortizacion.length - pagosPrestamo.length} pend.</span>
                        </td>
                        <td style={{ padding: "12px" }}>—</td>
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
