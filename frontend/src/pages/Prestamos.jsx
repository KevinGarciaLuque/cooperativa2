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
          onLiquidado={fetchData}
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
                            {parseInt(p.plazo_meses) === 0 ? (
                              <span style={{ color: "#e67e22", fontWeight: 600 }}>\u221e Indefinido</span>
                            ) : `${p.plazo_meses} meses`}
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
  if (!monto || !tasaAnual) return 0;
  if (plazo === 0) return monto * (tasaAnual / 100) / 12; // Indefinido: solo interés mensual
  if (!plazo) return 0;
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
  // ── Hooks antes del early return (regla de React) ──
  const [busquedaSocio, setBusquedaSocio] = useState("");
  const [dropdownSocioAbierto, setDropdownSocioAbierto] = useState(false);
  const [montoDisplay, setMontoDisplay] = useState(() => {
    if (!form.monto && form.monto !== 0) return "";
    const parts = String(form.monto).split(".");
    return parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (parts[1] !== undefined ? "." + parts[1] : "");
  });

  const handleMontoChange = (e) => {
    const raw = e.target.value.replace(/,/g, "");
    if (raw !== "" && !/^\d*\.?\d*$/.test(raw)) return;
    const parts = raw.split(".");
    const display = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (parts.length > 1 ? "." + parts[1] : "");
    setMontoDisplay(display);
    handleInput({ target: { name: "monto", value: raw } });
  };

  if (!show) return null;

  const tipoTasaInfo = TIPOS_TASA.find((t) => t.value === (form.tipo_tasa || "nominal_anual"));
  const tasaAnualEquiv = calcularTasaAnual(form.tasa_interes, form.tipo_tasa || "nominal_anual");
  const tasaMensualEquiv = tasaAnualEquiv / 12;
  const esIndefinido = parseInt(form.plazo_meses) === 0;
  const cuotaSimulada = calcularCuotaSimulador(
    parseFloat(form.monto) || 0,
    tasaAnualEquiv,
    esIndefinido ? 0 : (parseInt(form.plazo_meses) || 0)
  );
  const totalPagar = esIndefinido ? 0 : cuotaSimulada * (parseInt(form.plazo_meses) || 0);
  const totalIntereses = esIndefinido ? 0 : totalPagar - (parseFloat(form.monto) || 0);
  const haySimulacion = form.monto && form.tasa_interes && (esIndefinido || form.plazo_meses) && cuotaSimulada > 0;

  const fmt = (n) =>
    parseFloat(n || 0).toLocaleString("es-HN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <>
      <style>{`
        .pmt-tipo-btn { border: 1.5px solid #e2e8f0; border-radius: 2rem; padding: .25rem .75rem;
          cursor: pointer; transition: all .15s; background: #fff; white-space: nowrap; }
        .pmt-tipo-btn:hover { border-color: #27ae60; background: #f0faf4; }
        .pmt-tipo-btn.selected { border-color: var(--tc); background: var(--tb); }
        .pmt-sim-card { background: linear-gradient(135deg,#27ae60,#1e8449);
          border-radius: .75rem; color: #fff; padding: .9rem 1.1rem; }
        .pmt-sim-item { background: rgba(255,255,255,.15); border-radius:.5rem;
          padding:.4rem .75rem; display:flex; justify-content:space-between; align-items:center; }
      `}</style>
      <div
        className="modal show d-block"
        tabIndex="-1"
        style={{
          background: "rgba(0,0,0,0.65)",
          backdropFilter: "blur(5px)",
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
              style={{ background: "linear-gradient(135deg,#27ae60 0%,#1a7a40 100%)" }}
            >
              <div className="d-flex align-items-center gap-2">
                <FaMoneyBillWave style={{ fontSize: 18 }} />
                <div>
                  <span className="fw-bold" style={{ fontSize: "1rem" }}>
                    {editPrestamo ? "Editar Préstamo" : "Nuevo Préstamo"}
                  </span>
                  <div style={{ fontSize: ".75rem", opacity: .8 }}>Sistema francés · cuota fija</div>
                </div>
              </div>
              <button type="button" className="btn-close btn-close-white btn-sm" onClick={onClose} />
            </div>

            {/* ── Body ── */}
            <div className="modal-body p-0" style={{ background: "#f8fafc" }}>
              <div className="row g-0">

                {/* Columna izquierda – formulario */}
                <div className="col-lg-7 p-3 d-flex flex-column gap-2" style={{ borderRight: "1px solid #e2e8f0" }}>

                  {/* Socio */}
                  <div>
                    <label className="form-label fw-semibold small" style={{ color: "#2c3e50" }}>
                      <FaUserTie className="me-1 text-success" /> Socio
                    </label>

                    {editPrestamo !== null ? (
                      /* En edición: solo mostrar el nombre, no se puede cambiar */
                      <div style={{ border: "2px solid #e2e8f0", borderRadius: 8, padding: "10px 14px", background: "#e9ecef", fontSize: "0.9rem", color: "#2c3e50" }}>
                        {usuarios.find((u) => u.id_usuario === parseInt(form.id_usuario))?.nombre_completo || "—"}
                      </div>
                    ) : (
                      /* En creación: dropdown buscable */
                      <div style={{ position: "relative" }}>
                        <div
                          onClick={() => { setDropdownSocioAbierto((v) => !v); setBusquedaSocio(""); }}
                          style={{
                            border: "2px solid #e2e8f0", borderRadius: 8,
                            padding: "10px 14px", background: "white",
                            cursor: "pointer", display: "flex",
                            justifyContent: "space-between", alignItems: "center",
                            userSelect: "none", fontSize: "0.9rem",
                            color: form.id_usuario ? "#2c3e50" : "#94a3b8",
                          }}
                        >
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {form.id_usuario
                              ? (() => { const u = usuarios.find((u) => u.id_usuario === parseInt(form.id_usuario)); return u ? `${u.nombre_completo} — ${u.dni}` : "Seleccionar socio..."; })()
                              : "Seleccionar socio..."}
                          </span>
                          <span style={{ fontSize: "0.7rem", color: "#94a3b8", flexShrink: 0, marginLeft: 8 }}>{dropdownSocioAbierto ? "▲" : "▼"}</span>
                        </div>
                        <input type="hidden" name="id_usuario" value={form.id_usuario} required />

                        {dropdownSocioAbierto && (
                          <>
                            <div style={{ position: "fixed", inset: 0, zIndex: 5998 }} onClick={() => setDropdownSocioAbierto(false)} />
                            <div style={{
                              position: "absolute", top: "100%", left: 0, right: 0,
                              zIndex: 5999, background: "white",
                              border: "2px solid #e2e8f0", borderRadius: 8,
                              boxShadow: "0 8px 24px rgba(0,0,0,0.13)",
                              marginTop: 2, overflow: "hidden",
                            }}>
                              <div style={{ padding: "8px 8px 4px" }}>
                                <input
                                  autoFocus
                                  type="text"
                                  className="form-control form-control-sm"
                                  placeholder="🔍 Buscar por nombre o DNI..."
                                  value={busquedaSocio}
                                  onChange={(e) => setBusquedaSocio(e.target.value)}
                                  onClick={(e) => e.stopPropagation()}
                                  style={{ borderRadius: 6, fontSize: "0.82rem" }}
                                />
                              </div>
                              <div style={{ maxHeight: 200, overflowY: "auto" }}>
                                <div
                                  onClick={() => { handleInput({ target: { name: "id_usuario", value: "" } }); setDropdownSocioAbierto(false); }}
                                  style={{ padding: "7px 12px", fontSize: "0.82rem", color: "#94a3b8", cursor: "pointer", borderBottom: "1px solid #f1f5f9" }}
                                  onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
                                  onMouseLeave={(e) => (e.currentTarget.style.background = "white")}
                                >
                                  — Seleccionar socio —
                                </div>
                                {usuarios
                                  .filter((u) => {
                                    if (!busquedaSocio) return true;
                                    return `${u.nombre_completo} ${u.dni}`.toLowerCase().includes(busquedaSocio.toLowerCase());
                                  })
                                  .map((u) => {
                                    const sel = parseInt(form.id_usuario) === u.id_usuario;
                                    return (
                                      <div
                                        key={u.id_usuario}
                                        onClick={() => { handleInput({ target: { name: "id_usuario", value: String(u.id_usuario) } }); setDropdownSocioAbierto(false); setBusquedaSocio(""); }}
                                        style={{
                                          padding: "8px 12px", fontSize: "0.82rem", cursor: "pointer",
                                          background: sel ? "rgba(39,174,96,0.09)" : "white",
                                          borderLeft: sel ? "3px solid #27ae60" : "3px solid transparent",
                                          display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8,
                                        }}
                                        onMouseEnter={(e) => { if (!sel) e.currentTarget.style.background = "#f8fafc"; }}
                                        onMouseLeave={(e) => { if (!sel) e.currentTarget.style.background = "white"; }}
                                      >
                                        <span style={{ fontWeight: sel ? 700 : 400, color: sel ? "#27ae60" : "#2c3e50" }}>{u.nombre_completo}</span>
                                        <span style={{ color: "#94a3b8", fontSize: "0.78rem", whiteSpace: "nowrap" }}>{u.dni}</span>
                                      </div>
                                    );
                                  })}
                                {usuarios.filter((u) => {
                                  if (!busquedaSocio) return true;
                                  return `${u.nombre_completo} ${u.dni}`.toLowerCase().includes(busquedaSocio.toLowerCase());
                                }).length === 0 && (
                                  <div style={{ padding: "10px 12px", fontSize: "0.82rem", color: "#94a3b8", textAlign: "center" }}>
                                    Sin resultados para "{busquedaSocio}"
                                  </div>
                                )}
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Monto */}
                  <div>
                    <label className="form-label fw-semibold small" style={{ color: "#2c3e50" }}>
                      <FaMoneyBillWave className="me-1 text-success" /> Monto del Préstamo (L.)
                    </label>
                    <div className="input-group">
                      <span className="input-group-text fw-bold" style={{ background: "#27ae60", color: "#fff", border: "2px solid #27ae60" }}>L.</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        className="form-control rounded-end"
                        name="monto"
                        value={montoDisplay}
                        onChange={handleMontoChange}
                        required
                        placeholder="0.00"
                        style={{ border: "2px solid #e2e8f0", borderLeft: "none", padding: "6px 10px" }}
                      />
                    </div>
                  </div>

                  {/* Tipo de Tasa */}
                  <div>
                    <label className="form-label fw-semibold small d-flex align-items-center gap-1" style={{ color: "#2c3e50" }}>
                      <FaPercentage className="text-success" /> Tipo de Tasa de Interés
                      <span className="badge ms-1 px-2" style={{ background: tipoTasaInfo?.color, fontSize: ".7rem" }}>
                        {tipoTasaInfo?.abbr}
                      </span>
                    </label>
                    <div className="d-flex flex-wrap gap-1 mb-2">
                      {TIPOS_TASA.map((t) => (
                        <button
                          key={t.value}
                          type="button"
                          className={`pmt-tipo-btn ${(form.tipo_tasa || "nominal_anual") === t.value ? "selected" : ""}`}
                          style={{
                            "--tc": t.color,
                            "--tb": t.color + "18",
                            borderColor: (form.tipo_tasa || "nominal_anual") === t.value ? t.color : "#e2e8f0",
                            background: (form.tipo_tasa || "nominal_anual") === t.value ? t.color + "18" : "#f8fafc",
                          }}
                          onClick={() => handleInput({ target: { name: "tipo_tasa", value: t.value } })}
                        >
                          <span className="fw-bold" style={{ fontSize: ".78rem", color: (form.tipo_tasa || "nominal_anual") === t.value ? t.color : "#475569" }}>{t.abbr}</span>
                        </button>
                      ))}
                    </div>
                    {tipoTasaInfo && (
                      <div className="small px-2 py-1 rounded-2" style={{ background: tipoTasaInfo.color + "15", color: tipoTasaInfo.color, border: `1px solid ${tipoTasaInfo.color}30` }}>
                        ℹ {tipoTasaInfo.desc}
                      </div>
                    )}
                  </div>

                  {/* Valor de la Tasa */}
                  <div>
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
                        style={{ border: "2px solid #e2e8f0", padding: "6px 10px" }}
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
                  <div className="row g-2">
                    <div className="col-6">
                      <label className="form-label fw-semibold small" style={{ color: "#2c3e50" }}>
                        <FaClock className="me-1 text-success" /> Plazo (meses)
                      </label>

                      {/* Toggle indefinido */}
                      <div className="form-check form-switch mb-2">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          id="plazo-indefinido-toggle"
                          checked={esIndefinido}
                          onChange={(e) =>
                            handleInput({ target: { name: "plazo_meses", value: e.target.checked ? "0" : "" } })
                          }
                          style={{ cursor: "pointer" }}
                        />
                        <label
                          className="form-check-label small fw-semibold"
                          htmlFor="plazo-indefinido-toggle"
                          style={{ color: esIndefinido ? "#e67e22" : "#64748b", cursor: "pointer" }}
                        >
                          ♾ Plazo indefinido (solo interés mensual)
                        </label>
                      </div>

                      <input
                        type="number"
                        className="form-control rounded-3"
                        name="plazo_meses"
                        value={esIndefinido ? "" : form.plazo_meses}
                        onChange={handleInput}
                        required={!esIndefinido}
                        disabled={esIndefinido}
                        min="1"
                        max="360"
                        step="1"
                        placeholder={esIndefinido ? "Sin plazo fijo" : "Ej: 12"}
                        list="plazo-opciones"
                        style={{
                          border: `2px solid ${esIndefinido ? "#fbd38d" : "#e2e8f0"}`,
                          padding: "6px 10px",
                          background: esIndefinido ? "#fffaf0" : "white",
                          color: esIndefinido ? "#c05621" : "#2c3e50",
                        }}
                      />
                      <datalist id="plazo-opciones">
                        {[3,6,9,12,18,24,36,48,60,72,84,96,120].map(m => (
                          <option key={m} value={m}>{m} meses{m >= 12 ? ` (${m/12} año${m/12>1?"s":""})` : ""}</option>
                        ))}
                      </datalist>
                      {esIndefinido ? (
                        <div className="small mt-1 fw-semibold" style={{ color: "#e67e22" }}>
                          ♾ Sin fecha de vencimiento — pago mensual de intereses
                        </div>
                      ) : form.plazo_meses > 0 && (
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
                        style={{ border: "2px solid #e2e8f0", padding: "6px 10px" }}
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
                      style={{ border: "2px solid #e2e8f0", padding: "6px 10px" }}
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
                <div className="col-lg-5 p-3 d-flex flex-column gap-2"
                  style={{ background: "#edf2f7" }}>
                  <div className="fw-bold" style={{ color: "#2c3e50", fontSize: ".95rem" }}>
                    📊 Simulador de Cuotas
                  </div>

                  {haySimulacion ? (
                    <>
                      {/* Card principal */}
                      <div className="pmt-sim-card shadow-sm">
                        <div className="small mb-1" style={{ opacity: .85 }}>
                          {esIndefinido ? "Interés mensual (solo intereses)" : "Cuota mensual estimada"}
                        </div>
                        <div className="fw-bold" style={{ fontSize: "1.7rem", letterSpacing: "-.5px" }}>
                          L. {fmt(cuotaSimulada)}
                        </div>
                        <div className="small mt-1" style={{ opacity: .75 }}>
                          {esIndefinido
                            ? "♾ Préstamo indefinido · Capital no se amortiza"
                            : `Sistema francés · ${form.plazo_meses} cuotas fijas`}
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
                        {esIndefinido ? (
                          <>
                            <div className="pmt-sim-item" style={{ background: "#fff3cd", border: "1px solid #ffc107" }}>
                              <span className="small" style={{ color: "#856404" }}>Interés anual estimado</span>
                              <strong style={{ color: "#b7791f" }}>L. {fmt(cuotaSimulada * 12)}</strong>
                            </div>
                            <div className="pmt-sim-item" style={{ background: "#fde8d8", border: "1px solid #e67e22" }}>
                              <span className="small" style={{ color: "#7d4e2e" }}>Capital adeudado (fijo)</span>
                              <strong style={{ color: "#7d4e2e" }}>L. {fmt(form.monto)}</strong>
                            </div>
                            <div className="small px-1 mt-1" style={{ color: "#92400e", background: "#fef3c7", borderRadius: 6, padding: "6px 10px", border: "1px solid #fcd34d" }}>
                              ℹ El socio paga solo el interés cada mes. El capital permanece sin cambio hasta que se cancele el préstamo.
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="pmt-sim-item" style={{ background: "#fff3cd", border: "1px solid #ffc107" }}>
                              <span className="small" style={{ color: "#856404" }}>Total intereses</span>
                              <strong style={{ color: "#b7791f" }}>L. {fmt(totalIntereses)}</strong>
                            </div>
                            <div className="pmt-sim-item" style={{ background: "#d4edda", border: "1px solid #28a745" }}>
                              <span className="small" style={{ color: "#155724" }}>Total a pagar</span>
                              <strong style={{ color: "#155724" }}>L. {fmt(totalPagar)}</strong>
                            </div>
                          </>
                        )}
                      </div>

                      {/* Barra costo del crédito (solo préstamo con plazo fijo) */}
                      {!esIndefinido && (
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
                      )}
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
            <div className="modal-footer border-0 bg-white px-3 py-2 gap-2">
              <button
                type="submit"
                className="btn shadow-sm fw-semibold"
                style={{
                  background: "linear-gradient(135deg,#27ae60,#1e8449)",
                  color: "white", border: "none",
                  borderRadius: "8px", padding: "7px 22px", fontSize: ".9rem",
                }}
              >
                <FaCheckCircle className="me-2" />
                {editPrestamo ? "Guardar Cambios" : "Registrar Préstamo"}
              </button>
              <button
                type="button"
                className="btn btn-light shadow-sm fw-semibold"
                onClick={onClose}
                style={{ borderRadius: "8px", padding: "7px 18px", fontSize: ".9rem" }}
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
function ModalDetallePrestamo({ show, prestamo, usuario, onClose, getEstadoInfo, token, apiUrl, onLiquidado }) {
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

  // Usar null-check explícito para no confundir saldo_restante=0 con "no definido"
  const saldoRestante = parseFloat(
    prestamo.saldo_restante != null ? prestamo.saldo_restante : (prestamo.monto || 0)
  );
  const monto = montoP;

  // Total realmente pagado según los registros de pagos
  const totalPagadoReal = pagosPrestamo.reduce(
    (sum, p) => sum + parseFloat(p.monto_pagado || 0), 0
  );

  // El saldo_restante del ÚLTIMO pago es el indicador más fiable
  const ultimoPago = pagosPrestamo.length > 0
    ? pagosPrestamo[pagosPrestamo.length - 1]
    : null;
  const saldoUltimoPago = ultimoPago != null
    ? parseFloat(ultimoPago.saldo_restante ?? 0)
    : null;

  // Capital amortizado real (suma de monto_capital de cada pago)
  const capitalAmortizadoReal = pagosPrestamo.reduce(
    (sum, p) => sum + parseFloat(p.monto_capital || 0), 0
  );

  // Está liquidado si cualquiera de estas condiciones aplica:
  // 1. El estado en BD ya es 'pagado' (cualquier capitalización)
  // 2. El saldo_restante en BD ya es 0 o negativo
  // 3. El saldo_restante del último pago registrado es 0
  // 4. El capital amortizado acumulado cubre el principal
  const estaLiquidado =
    (prestamo.estado || "").toLowerCase() === "pagado" ||
    saldoRestante <= 0.01 ||
    (saldoUltimoPago !== null && saldoUltimoPago <= 0.01) ||
    (pagosPrestamo.length > 0 && capitalAmortizadoReal >= montoP - 0.01);

  // Saldo y progreso corregidos — si está liquidado siempre 100%
  const saldoMostrar = estaLiquidado ? 0 : saldoRestante;
  const progreso = estaLiquidado
    ? 100
    : monto > 0
    ? Math.min(99, ((monto - Math.max(0, saldoMostrar)) / monto) * 100)
    : 0;

  const fmt = (n) =>
    parseFloat(n || 0).toLocaleString("es-HN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  // Timeline states — usa estaLiquidado para el paso final
  const estadoNorm = (prestamo.estado || "").toLowerCase();
  const timeline = {
    solicitud: true,
    aprobacion: ["aprobado", "activo", "mora", "pagado"].includes(estadoNorm),
    desembolso: ["activo", "mora", "pagado"].includes(estadoNorm),
    pago: estaLiquidado,
  };

  return (
    <div
      className="modal show d-block"
      tabIndex="-1"
      style={{
        background: "rgba(0, 0, 0, 0.6)",
        backdropFilter: "blur(4px)",
        zIndex: 5000,
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        overflowY: "auto",
      }}
    >
      <div
        className="modal-dialog modal-dialog-centered modal-dialog-scrollable"
        style={{ maxWidth: "980px" }}
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
              padding: "16px 24px",
            }}
          >
            <div>
              <h5 className="modal-title mb-0 d-flex align-items-center fw-bold">
                <FaMoneyBillWave className="me-2" style={{ fontSize: "18px" }} />
                Detalle del Préstamo
                <span className="ms-2 badge" style={{ background: "rgba(255,255,255,0.2)", fontSize: "0.75rem", borderRadius: 8, padding: "3px 8px" }}>
                  #{prestamo.id_prestamo}
                </span>
              </h5>
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
            style={{ padding: "18px 24px", background: "#f8f9fa" }}
          >
            {/* Información del Socio y Estado */}
            <div className="row g-3 mb-3">
              <div className="col-md-6">
                <div
                  className="card border-0 shadow-sm h-100"
                  style={{ borderRadius: "12px" }}
                >
                  <div className="card-body py-2 px-3">
                    <h6 className="fw-bold mb-2" style={{ color: "#2c3e50", fontSize: "0.85rem" }}
                    >
                      <FaUserTie className="me-2" style={{ color: "#3498db" }} />
                      Información del Socio
                    </h6>
                    <div className="mb-1 small"><strong>Nombre:</strong> {usuario?.nombre_completo || "N/A"}</div>
                    <div className="mb-1 small"><strong>DNI:</strong> {usuario?.dni || "N/A"}</div>
                    <div className="mb-1 small"><strong>Teléfono:</strong> {usuario?.telefono || "N/A"}</div>
                    <div className="small"><strong>Correo:</strong> {usuario?.correo || "N/A"}</div>
                  </div>
                </div>
              </div>

              <div className="col-md-6">
                <div
                  className="card border-0 shadow-sm h-100"
                  style={{ borderRadius: "12px" }}
                >
                  <div className="card-body py-2 px-3">
                    <h6 className="fw-bold mb-2" style={{ color: "#2c3e50", fontSize: "0.85rem" }}>
                      <FaChartLine className="me-2" style={{ color: "#27ae60" }} />
                      Estado del Préstamo
                    </h6>
                    <div className="d-flex align-items-center justify-content-between mb-2">
                      <div className="d-flex flex-column gap-1">
                        <span
                          className="badge d-inline-flex align-items-center"
                          style={{
                            background: estaLiquidado ? "rgba(39,174,96,0.15)" : estadoInfo.bg,
                            color: estaLiquidado ? "#27ae60" : estadoInfo.color,
                            border: `1.5px solid ${estaLiquidado ? "#27ae60" : estadoInfo.color}`,
                            fontWeight: "600",
                            borderRadius: "20px",
                            fontSize: "12px",
                            padding: "4px 10px",
                          }}
                        >
                          {estaLiquidado ? <FaCheckCircle className="me-1" /> : <IconoEstado className="me-1" />}
                          {estaLiquidado ? "Pagado" : estadoInfo.label}
                        </span>
                      </div>
                      <div style={{ width: "65px", height: "65px" }}>
                        <CircularProgressbar
                          value={progreso}
                          text={`${progreso.toFixed(0)}%`}
                          styles={buildStyles({
                            textSize: "22px",
                            pathColor: progreso === 100 ? "#27ae60" : "#3498db",
                            textColor: "#2c3e50",
                            trailColor: "#ecf0f1",
                          })}
                        />
                      </div>
                    </div>
                    <div className="mb-1 small">
                      <strong>Monto Original:</strong> L.{" "}
                      {monto.toFixed(2)}
                    </div>
                    <div className="mb-1 small">
                      <strong>Total Pagado:</strong>{" "}
                      <span style={{ color: "#3498db", fontWeight: "bold" }}>
                        L. {fmt(totalPagadoReal)}
                      </span>
                    </div>
                    <div className="small">
                      <strong>Saldo Restante:</strong>{" "}
                      <span style={{ color: estaLiquidado ? "#27ae60" : "#e74c3c", fontWeight: "bold" }}>
                        {estaLiquidado ? (
                          <><span style={{ fontSize: "0.85rem" }}>✅</span> L. 0.00 — Liquidado</>
                        ) : (
                          `L. ${saldoMostrar.toFixed(2)}`
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Timeline del Proceso */}
            <div className="card border-0 shadow-sm mb-3" style={{ borderRadius: "12px" }}>
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
            <div className="card border-0 shadow-sm" style={{ borderRadius: "12px" }}>
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
                      {tablaAmortizacion
                        .filter((fila) => !estaLiquidado || !!pagoMap[fila.cuota])
                        .map((fila) => {
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
                          {estaLiquidado ? (
                            <span style={{ color: "#27ae60" }}>✅ {pagosPrestamo.length} pagadas — Liquidado</span>
                          ) : (
                            <>
                              <span style={{ color: "#27ae60" }}>{pagosPrestamo.length} pagadas</span>
                              {" / "}
                              <span style={{ color: "#95a5a6" }}>{tablaAmortizacion.length - pagosPrestamo.length} pend.</span>
                            </>
                          )}
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
            style={{ padding: "12px 24px" }}
          >
            {estaLiquidado ? (
              <span className="badge me-auto" style={{ background: "rgba(39,174,96,0.15)", color: "#27ae60", border: "1.5px solid #27ae60", borderRadius: 10, fontSize: 13, padding: "6px 14px", fontWeight: 700 }}>
                ✅ Préstamo liquidado en su totalidad
              </span>
            ) : (
              <button
                type="button"
                className="btn btn-sm me-auto fw-semibold"
                style={{
                  background: "rgba(39,174,96,0.12)",
                  color: "#27ae60",
                  border: "1.5px solid #27ae60",
                  borderRadius: "8px",
                  padding: "6px 16px",
                }}
                onClick={async () => {
                  if (!window.confirm(`¿Marcar el préstamo #${prestamo.id_prestamo} como PAGADO/LIQUIDADO? Esto pondrá el saldo en L. 0.00.`)) return;
                  try {
                    await axios.patch(
                      `${apiUrl}/prestamos/${prestamo.id_prestamo}/estado`,
                      { estado: "pagado" },
                      { headers: { Authorization: `Bearer ${token}` } }
                    );
                    if (onLiquidado) onLiquidado();
                    onClose();
                  } catch (e) {
                    alert("Error al actualizar el préstamo: " + (e?.response?.data?.message || e.message));
                  }
                }}
              >
                <FaCheckCircle className="me-1" /> Marcar como Liquidado
              </button>
            )}
            <button
              type="button"
              className="btn btn-sm btn-light shadow-sm"
              onClick={onClose}
              style={{
                borderRadius: "8px",
                padding: "8px 24px",
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
