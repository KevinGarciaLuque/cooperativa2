import { useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import { useAlerta } from "../../context/AlertaContext";
import TablaCuenta from "./TablaCuenta";
import {
  FaPiggyBank,
  FaSearch,
  FaPlus,
  FaWallet,
  FaHome,
  FaCoins,
  FaChartPie,
} from "react-icons/fa";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

export default function Cuentas() {
  const { token } = useAuth();
  const { mostrarAlerta } = useAlerta();
  const [cuentas, setCuentas] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState("");
  const [tipoFiltro, setTipoFiltro] = useState("todos");
  const [estadoFiltro, setEstadoFiltro] = useState("todos");
  const [showModal, setShowModal] = useState(false);
  const [editCuenta, setEditCuenta] = useState(null);
  const [form, setForm] = useState({
    id_usuario: "",
    tipo_cuenta: "",
    saldo_inicial: "0",
    estado: "activa",
  });

  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

  // Obtener cuentas y usuarios
  const fetchData = async () => {
    try {
      setLoading(true);
      const [cuentasRes, usuariosRes] = await Promise.all([
        axios.get(`${API_URL}/cuentas`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`${API_URL}/usuarios`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
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

  // Filtrar cuentas
  const cuentasFiltradas = cuentas.filter((c) => {
    const usuario = usuarios.find((u) => u.id_usuario === c.id_usuario);
    const nombreUsuario = usuario?.nombre_completo?.toLowerCase() || "";
    const coincideBusqueda =
      nombreUsuario.includes(filtro.toLowerCase()) ||
      c.tipo_cuenta.toLowerCase().includes(filtro.toLowerCase());

    const coincideTipo =
      tipoFiltro === "todos" || c.tipo_cuenta === tipoFiltro;

    const coincideEstado =
      estadoFiltro === "todos" || c.estado === estadoFiltro;

    return coincideBusqueda && coincideTipo && coincideEstado;
  });

  const openCrearModal = () => {
    setEditCuenta(null);
    setForm({
      id_usuario: "",
      tipo_cuenta: "",
      saldo_inicial: "0",
      estado: "activa",
    });
    setShowModal(true);
  };

  const handleEdit = (cuenta) => {
    setEditCuenta(cuenta);
    setForm({
      id_usuario: cuenta.id_usuario,
      tipo_cuenta: cuenta.tipo_cuenta,
      saldo_inicial: cuenta.saldo_actual || "0",
      estado: cuenta.estado,
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("¿Seguro que deseas eliminar esta cuenta?")) return;
    try {
      await axios.delete(`${API_URL}/cuentas/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      mostrarAlerta("Cuenta eliminada correctamente.", "success");
      fetchData();
    } catch (err) {
      mostrarAlerta("Error al eliminar la cuenta.", "error");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editCuenta) {
        await axios.put(`${API_URL}/cuentas/${editCuenta.id_cuenta}`, form, {
          headers: { Authorization: `Bearer ${token}` },
        });
        mostrarAlerta("Cuenta actualizada correctamente.", "success");
      } else {
        await axios.post(`${API_URL}/cuentas`, form, {
          headers: { Authorization: `Bearer ${token}` },
        });
        mostrarAlerta("Cuenta creada correctamente.", "success");
      }
      setForm({
        id_usuario: "",
        tipo_cuenta: "",
        saldo_inicial: "0",
        estado: "activa",
      });
      setEditCuenta(null);
      setShowModal(false);
      fetchData();
    } catch (err) {
      mostrarAlerta(
        err.response?.data?.message || "Error al guardar la cuenta.",
        "error"
      );
    }
  };

  const handleInput = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  // Estadísticas
  const totalCuentas = cuentas.length;
  const cuentasActivas = cuentas.filter((c) => c.estado === "activa").length;
  const cuentasInactivas = cuentas.filter((c) => c.estado === "inactiva").length;

  // Totales por tipo
  const cuentasAportaciones = cuentas.filter(
    (c) => c.tipo_cuenta === "Aportaciones"
  );
  const cuentasVivienda = cuentas.filter((c) => c.tipo_cuenta === "Vivienda");
  const cuentasPensiones = cuentas.filter((c) => c.tipo_cuenta === "Pensiones");

  const saldoAportaciones = cuentasAportaciones.reduce(
    (acc, c) => acc + parseFloat(c.saldo_actual || c.saldo || 0),
    0
  );
  const saldoVivienda = cuentasVivienda.reduce(
    (acc, c) => acc + parseFloat(c.saldo_actual || c.saldo || 0),
    0
  );
  const saldoPensiones = cuentasPensiones.reduce(
    (acc, c) => acc + parseFloat(c.saldo_actual || c.saldo || 0),
    0
  );
  const saldoTotal = saldoAportaciones + saldoVivienda + saldoPensiones;

  // Datos para gráfico
  const graficaData = [
    {
      name: "Aportaciones",
      value: saldoAportaciones,
      count: cuentasAportaciones.length,
    },
    { name: "Vivienda", value: saldoVivienda, count: cuentasVivienda.length },
    {
      name: "Pensiones",
      value: saldoPensiones,
      count: cuentasPensiones.length,
    },
  ].filter((item) => item.value > 0);

  const COLORS = {
    Aportaciones: "#3498db",
    Vivienda: "#27ae60",
    Pensiones: "#f39c12",
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
            <FaWallet className="me-2" style={{ color: "#3498db" }} />
            Gestión de Cuentas
          </h2>
          <p className="text-muted mb-0">
            Administra las cuentas de los socios
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
          Nueva Cuenta
        </button>
      </div>

      {/* Cards de Estadísticas */}
      <div className="row g-3 mb-4">
        {/* Total Cuentas */}
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
                  <p className="text-muted mb-1 small">Total Cuentas</p>
                  <h3 className="mb-0 fw-bold" style={{ color: "#2c3e50" }}>
                    {totalCuentas}
                  </h3>
                  <p className="mb-0 small text-muted mt-1">
                    {cuentasActivas} activas
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
                  <FaPiggyBank style={{ fontSize: "24px", color: "#3498db" }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Aportaciones */}
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
                  <p className="text-muted mb-1 small">Aportaciones</p>
                  <h3 className="mb-0 fw-bold" style={{ color: "#3498db" }}>
                    L. {saldoAportaciones.toFixed(2)}
                  </h3>
                  <p className="mb-0 small text-muted mt-1">
                    {cuentasAportaciones.length} cuentas
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
                  <FaCoins style={{ fontSize: "24px", color: "#3498db" }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Vivienda */}
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
                  <p className="text-muted mb-1 small">Vivienda</p>
                  <h3 className="mb-0 fw-bold" style={{ color: "#27ae60" }}>
                    L. {saldoVivienda.toFixed(2)}
                  </h3>
                  <p className="mb-0 small text-muted mt-1">
                    {cuentasVivienda.length} cuentas
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
                  <FaHome style={{ fontSize: "24px", color: "#27ae60" }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Pensiones */}
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
                  <p className="text-muted mb-1 small">Pensiones</p>
                  <h3 className="mb-0 fw-bold" style={{ color: "#f39c12" }}>
                    L. {saldoPensiones.toFixed(2)}
                  </h3>
                  <p className="mb-0 small text-muted mt-1">
                    {cuentasPensiones.length} cuentas
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
                  <FaWallet style={{ fontSize: "24px", color: "#f39c12" }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="row g-4 mb-4">
        {/* Gráfico de Distribución */}
        <div className="col-lg-4">
          <div
            className="card border-0 shadow-sm h-100"
            style={{ borderRadius: "15px" }}
          >
            <div className="card-body">
              <h6 className="fw-bold mb-3" style={{ color: "#2c3e50" }}>
                <FaChartPie className="me-2" style={{ color: "#3498db" }} />
                Distribución de Saldos
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
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[entry.name]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => `L. ${value.toFixed(2)}`}
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

        {/* Filtros y Búsqueda */}
        <div className="col-lg-8">
          <div
            className="card border-0 shadow-sm"
            style={{ borderRadius: "15px" }}
          >
            <div className="card-body">
              <div className="row g-3">
                {/* Búsqueda */}
                <div className="col-12">
                  <label className="form-label fw-semibold small text-muted">
                    Buscar
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
                      placeholder="Buscar por socio o tipo de cuenta..."
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
                <div className="col-md-6">
                  <label className="form-label fw-semibold small text-muted">
                    Tipo de Cuenta
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
                        tipoFiltro === "Aportaciones"
                          ? "btn-info"
                          : "btn-outline-info"
                      }`}
                      onClick={() => setTipoFiltro("Aportaciones")}
                    >
                      Aportaciones
                    </button>
                    <button
                      type="button"
                      className={`btn btn-sm ${
                        tipoFiltro === "Vivienda"
                          ? "btn-success"
                          : "btn-outline-success"
                      }`}
                      onClick={() => setTipoFiltro("Vivienda")}
                    >
                      Vivienda
                    </button>
                    <button
                      type="button"
                      className={`btn btn-sm ${
                        tipoFiltro === "Pensiones"
                          ? "btn-warning"
                          : "btn-outline-warning"
                      }`}
                      onClick={() => setTipoFiltro("Pensiones")}
                    >
                      Pensiones
                    </button>
                  </div>
                </div>

                {/* Filtro por Estado */}
                <div className="col-md-6">
                  <label className="form-label fw-semibold small text-muted">
                    Estado
                  </label>
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
                        estadoFiltro === "activa"
                          ? "btn-success"
                          : "btn-outline-success"
                      }`}
                      onClick={() => setEstadoFiltro("activa")}
                    >
                      Activas
                    </button>
                    <button
                      type="button"
                      className={`btn btn-sm ${
                        estadoFiltro === "inactiva"
                          ? "btn-secondary"
                          : "btn-outline-secondary"
                      }`}
                      onClick={() => setEstadoFiltro("inactiva")}
                      style={{ borderRadius: "0 10px 10px 0" }}
                    >
                      Inactivas
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabla de Cuentas */}
      {loading ? (
        <div className="text-center py-5">
          <div
            className="spinner-border text-primary"
            role="status"
            style={{ width: "3rem", height: "3rem" }}
          >
            <span className="visually-hidden">Cargando...</span>
          </div>
          <p className="mt-3 text-muted">Cargando cuentas...</p>
        </div>
      ) : (
        <TablaCuenta
          cuentas={cuentasFiltradas}
          usuarios={usuarios}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      )}

      {/* Modal */}
      {showModal && (
        <ModalCuenta
          show={showModal}
          editCuenta={editCuenta}
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

// ==================== COMPONENTE MODAL CUENTA ====================
function ModalCuenta({
  show,
  editCuenta,
  form,
  usuarios,
  onClose,
  onSubmit,
  handleInput,
}) {
  if (!show) return null;

  const getTipoCuentaInfo = (tipo) => {
    const tipos = {
      Aportaciones: { color: "#3498db", icon: FaCoins },
      Vivienda: { color: "#27ae60", icon: FaHome },
      Pensiones: { color: "#f39c12", icon: FaWallet },
    };
    return tipos[tipo] || { color: "#3498db", icon: FaPiggyBank };
  };

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
              <FaWallet className="me-3" style={{ fontSize: "24px" }} />
              {editCuenta ? "Editar Cuenta" : "Nueva Cuenta"}
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
                  <FaPiggyBank className="me-2" style={{ color: "#3498db" }} />
                  Socio
                </label>
                <select
                  className="form-select form-select-lg"
                  name="id_usuario"
                  value={form.id_usuario}
                  onChange={handleInput}
                  required
                  disabled={editCuenta !== null}
                  style={{
                    borderRadius: "10px",
                    border: "2px solid #e9ecef",
                    padding: "12px 16px",
                    background: editCuenta ? "#e9ecef" : "white",
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

              {/* Tipo de Cuenta */}
              <div className="col-md-6">
                <label
                  className="form-label fw-semibold d-flex align-items-center"
                  style={{ color: "#2c3e50" }}
                >
                  <FaWallet className="me-2" style={{ color: "#3498db" }} />
                  Tipo de Cuenta
                </label>
                <select
                  className="form-select form-select-lg"
                  name="tipo_cuenta"
                  value={form.tipo_cuenta}
                  onChange={handleInput}
                  required
                  style={{
                    borderRadius: "10px",
                    border: "2px solid #e9ecef",
                    padding: "12px 16px",
                  }}
                >
                  <option value="">Seleccionar tipo...</option>
                  <option value="Aportaciones">💰 Aportaciones</option>
                  <option value="Vivienda">🏠 Vivienda</option>
                  <option value="Pensiones">👴 Pensiones</option>
                </select>
              </div>

              {/* Saldo Inicial */}
              <div className="col-md-6">
                <label
                  className="form-label fw-semibold d-flex align-items-center"
                  style={{ color: "#2c3e50" }}
                >
                  <FaCoins className="me-2" style={{ color: "#3498db" }} />
                  Saldo {editCuenta ? "Actual" : "Inicial"} (L.)
                </label>
                <input
                  type="number"
                  className="form-control form-control-lg"
                  name="saldo_inicial"
                  value={form.saldo_inicial}
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

              {/* Estado */}
              <div className="col-12">
                <label
                  className="form-label fw-semibold d-flex align-items-center"
                  style={{ color: "#2c3e50" }}
                >
                  <FaPiggyBank className="me-2" style={{ color: "#3498db" }} />
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
                  <option value="activa">✓ Activa</option>
                  <option value="inactiva">✗ Inactiva</option>
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
                background: "linear-gradient(135deg, #3498db 0%, #2980b9 100%)",
                color: "white",
                border: "none",
                borderRadius: "10px",
                padding: "12px 32px",
                fontWeight: "600",
              }}
            >
              <FaPiggyBank className="me-2" />
              {editCuenta ? "Guardar Cambios" : "Crear Cuenta"}
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
