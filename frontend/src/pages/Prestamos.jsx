import { useEffect, useState } from "react";
import useAccionRapida from "../hooks/useAccionRapida";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { useAlerta } from "../context/AlertaContext";
import ModalConfirmacion from "../components/ModalConfirmacion";
import ReciboModal from "../components/ReciboModal";
import DesembolsoModal from "../components/DesembolsoModal";
import { FaMoneyBillWave, FaPlus, FaCheckCircle, FaExclamationTriangle, FaHourglassHalf, FaTimesCircle, FaSearch, FaChartLine } from "react-icons/fa";
import TablaPrestamos from "./PrestamosUI/TablaPrestamos";
import ModalPrestamo from "./PrestamosUI/ModalPrestamo";
import ModalDetallePrestamo from "./PrestamosUI/ModalDetallePrestamo";

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
    tipo_tasa: "nominal_mensual",
    plazo_meses: "",
    fecha_otorgado: "",
    estado: "pendiente",
  });
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [prestamoParaEliminar, setPrestamoParaEliminar] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [aDesembolsar, setADesembolsar] = useState(null); // préstamo aprobado en proceso de desembolso
  const [desembolsando, setDesembolsando] = useState(false);
  const [reciboNuevo, setReciboNuevo] = useState(null);

  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

  // Cargar préstamos y usuarios
  const fetchData = async () => {
    try {
      setLoading(true);
      const [prestamosRes, usuariosRes] = await Promise.all([
        axios.get(`${API_URL}/prestamos`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`${API_URL}/usuarios?limit=1000`, {
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
    if (submitting) return;
    setSubmitting(true);
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
        tipo_tasa: "nominal_mensual",
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
    } finally {
      setSubmitting(false);
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

  // ── Flujo de aprobación ───────────────────────────────────────────────
  const aprobarPrestamo = async (p) => {
    if (!window.confirm(`¿Aprobar el préstamo #${p.id_prestamo} por L. ${parseFloat(p.monto).toLocaleString("es-HN")}? El dinero se entrega al registrar el desembolso.`)) return;
    try {
      await axios.patch(`${API_URL}/prestamos/${p.id_prestamo}/aprobar`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      mostrarAlerta("Préstamo aprobado. Falta registrar el desembolso.", "success");
      fetchData();
    } catch (err) {
      mostrarAlerta(err.response?.data?.message || "No se pudo aprobar el préstamo.", "error");
    }
  };

  const rechazarPrestamo = async (p) => {
    const motivo = window.prompt(`Motivo del rechazo del préstamo #${p.id_prestamo}:`);
    if (motivo === null) return;
    if (motivo.trim().length < 3) {
      mostrarAlerta("El motivo del rechazo es obligatorio.", "error");
      return;
    }
    try {
      await axios.patch(`${API_URL}/prestamos/${p.id_prestamo}/rechazar`, { motivo: motivo.trim() }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      mostrarAlerta("Solicitud rechazada.", "success");
      fetchData();
    } catch (err) {
      mostrarAlerta(err.response?.data?.message || "No se pudo rechazar la solicitud.", "error");
    }
  };

  const confirmarDesembolso = async ({ metodo, referencia }) => {
    setDesembolsando(true);
    try {
      const r = await axios.post(
        `${API_URL}/prestamos/${aDesembolsar.id_prestamo}/desembolsar`,
        { metodo, referencia },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      mostrarAlerta("Préstamo desembolsado correctamente.", "success");
      setADesembolsar(null);
      if (r.data?.id_recibo) setReciboNuevo(r.data.id_recibo);
      fetchData();
    } catch (err) {
      mostrarAlerta(err.response?.data?.message || "No se pudo registrar el desembolso.", "error");
    } finally {
      setDesembolsando(false);
    }
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

  // Acciones rápidas que llegan desde la Ventanilla
  useAccionRapida(!loading, ({ accion, socio, q }) => {
    if (accion === "ver") {
      setFiltro(q);
    } else if (accion === "nuevo") {
      openCrearModal();
      if (socio) setForm((f) => ({ ...f, id_usuario: socio }));
    }
  });

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
  const prestamosPendientes = prestamos.filter((p) => ["pendiente", "aprobado"].includes(p.estado)).length;
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
      cancelado: {
        color: "#e74c3c",
        bg: "rgba(231, 76, 60, 0.1)",
        icon: FaTimesCircle,
        label: "Cancelado",
      },
    };
    // compatibilidad: "rechazado" antiguo se trata como "cancelado"
    if (estado === "rechazado") return estados.cancelado;
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
          onAprobar={aprobarPrestamo}
          onRechazar={rechazarPrestamo}
          onDesembolsar={setADesembolsar}
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
          submitting={submitting}
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

      {aDesembolsar && (
        <DesembolsoModal
          prestamo={aDesembolsar}
          nombreSocio={usuarios.find((u) => u.id_usuario === aDesembolsar.id_usuario)?.nombre_completo || ""}
          enviando={desembolsando}
          onConfirmar={confirmarDesembolso}
          onCancelar={() => setADesembolsar(null)}
        />
      )}

      {reciboNuevo && (
        <ReciboModal idRecibo={reciboNuevo} onClose={() => setReciboNuevo(null)} />
      )}

      <ModalConfirmacion
        show={showConfirmDelete}
        mensaje="¿Estás seguro que deseas eliminar este préstamo? Solo se pueden eliminar préstamos sin pagos registrados. Esta acción no se puede deshacer."
        onConfirm={confirmarEliminar}
        onCancel={() => {
          setShowConfirmDelete(false);
          setPrestamoParaEliminar(null);
        }}
      />
    </div>
  );
}
