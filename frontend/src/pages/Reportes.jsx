import { useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { useAlerta } from "../context/AlertaContext";
import {
  FaFileExcel,
  FaUser,
  FaSearch,
  FaDownload,
  FaChartBar,
  FaMoneyBillWave,
  FaPiggyBank,
  FaExchangeAlt,
  FaCalendarAlt,
  FaFileInvoiceDollar,
  FaCheckCircle,
  FaSpinner,
  FaIdCard,
  FaEnvelope,
  FaPhone,
  FaInfoCircle,
} from "react-icons/fa";

export default function Reportes() {
  const { token } = useAuth();
  const { mostrarAlerta } = useAlerta();
  const [usuarios, setUsuarios] = useState([]);
  const [idUsuario, setIdUsuario] = useState("");
  const [filtro, setFiltro] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [usuarioInfo, setUsuarioInfo] = useState(null);

  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

  // Obtener usuarios
  useEffect(() => {
    const fetchUsuarios = async () => {
      try {
        setLoading(true);
        const res = await axios.get(`${API_URL}/usuarios`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setUsuarios(res.data.data || res.data || []);
      } catch (err) {
        mostrarAlerta("No se pudieron obtener los usuarios.", "error");
      } finally {
        setLoading(false);
      }
    };
    fetchUsuarios();
    // eslint-disable-next-line
  }, []);

  // Cargar información del usuario cuando se selecciona
  useEffect(() => {
    const cargarInfoUsuario = async () => {
      if (!idUsuario) {
        setUsuarioInfo(null);
        return;
      }

      try {
        // Obtener datos del usuario y sus cuentas
        const [cuentasRes, prestamosRes, aportacionesRes] = await Promise.all([
          axios.get(`${API_URL}/cuentas`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          axios.get(`${API_URL}/prestamos`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          axios.get(`${API_URL}/aportaciones`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        const usuario = usuarios.find((u) => u.id_usuario === Number(idUsuario));
        const cuentas = (cuentasRes.data.data || cuentasRes.data || []).filter(
          (c) => c.id_usuario === Number(idUsuario)
        );
        const prestamos = (prestamosRes.data.data || prestamosRes.data || []).filter(
          (p) => p.id_usuario === Number(idUsuario)
        );
        const aportaciones = (
          aportacionesRes.data.data || aportacionesRes.data || []
        ).filter((a) => a.id_usuario === Number(idUsuario));

        setUsuarioInfo({
          usuario,
          totalCuentas: cuentas.length,
          totalPrestamos: prestamos.length,
          totalAportaciones: aportaciones.length,
          saldoCuentas: cuentas.reduce(
            (sum, c) => sum + parseFloat(c.saldo_actual || c.saldo || 0),
            0
          ),
          montoAportaciones: aportaciones.reduce(
            (sum, a) => sum + parseFloat(a.monto || 0),
            0
          ),
          montoPrestamos: prestamos.reduce(
            (sum, p) => sum + parseFloat(p.monto || 0),
            0
          ),
        });
      } catch (err) {
        mostrarAlerta("Error al cargar información del usuario.", "error");
      }
    };

    cargarInfoUsuario();
    // eslint-disable-next-line
  }, [idUsuario]);

  // Descargar reporte Excel
  const descargarReporte = async () => {
    if (!idUsuario) {
      mostrarAlerta("Debes seleccionar un socio.", "warning");
      return;
    }
    setDownloading(true);
    try {
      const res = await axios.get(
        `${API_URL}/reportes/estado-cuenta/${idUsuario}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: "blob",
        }
      );
      // Descargar archivo
      const usuario = usuarios.find((u) => u.id_usuario === Number(idUsuario));
      const nombre =
        usuario?.nombre_completo?.replace(/\s+/g, "_") || "usuario";
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `estado_cuenta_${nombre}.xlsx`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      mostrarAlerta("Reporte descargado correctamente.", "success");
    } catch (err) {
      mostrarAlerta("Error al descargar el reporte.", "error");
    } finally {
      setDownloading(false);
    }
  };

  // Filtrar usuarios
  const usuariosFiltrados = usuarios.filter((u) =>
    u.nombre_completo?.toLowerCase().includes(filtro.toLowerCase())
  );

  return (
    <div
      className="container-fluid px-4 py-4"
      style={{ background: "#f8f9fa", minHeight: "100vh" }}
    >
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="mb-1 fw-bold" style={{ color: "#2c3e50" }}>
            <FaChartBar className="me-2" style={{ color: "#e67e22" }} />
            Reportes y Estados de Cuenta
          </h2>
          <p className="text-muted mb-0">
            Genera reportes detallados en formato Excel
          </p>
        </div>
      </div>

      {/* Selector de Usuario */}
      <div className="row g-4 mb-4">
        {/* Búsqueda y Selección */}
        <div className="col-lg-5">
          <div
            className="card border-0 shadow-sm h-100"
            style={{ borderRadius: "15px" }}
          >
            <div
              className="card-header border-0 text-white"
              style={{
                background: "linear-gradient(135deg, #e67e22 0%, #d35400 100%)",
                borderRadius: "15px 15px 0 0",
                padding: "20px",
              }}
            >
              <h5 className="mb-0 fw-bold d-flex align-items-center">
                <FaUser className="me-2" />
                Seleccionar Socio
              </h5>
            </div>
            <div className="card-body" style={{ padding: "24px" }}>
              {/* Búsqueda */}
              <div className="mb-3">
                <label className="form-label fw-semibold small text-muted">
                  Buscar Socio
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
                    placeholder="Buscar por nombre..."
                    value={filtro}
                    onChange={(e) => setFiltro(e.target.value)}
                    style={{
                      borderRadius: "0 10px 10px 0",
                      boxShadow: "none",
                    }}
                  />
                </div>
              </div>

              {/* Select de Usuario */}
              <div className="mb-3">
                <label className="form-label fw-semibold small text-muted">
                  Seleccionar de la lista
                </label>
                {loading ? (
                  <div className="text-center py-3">
                    <FaSpinner className="fa-spin" style={{ fontSize: "24px", color: "#e67e22" }} />
                    <p className="text-muted mt-2 mb-0 small">Cargando socios...</p>
                  </div>
                ) : (
                  <select
                    className="form-select form-select-lg"
                    value={idUsuario}
                    onChange={(e) => setIdUsuario(e.target.value)}
                    style={{
                      borderRadius: "10px",
                      border: "2px solid #e9ecef",
                      padding: "12px 16px",
                    }}
                  >
                    <option value="">Selecciona un socio...</option>
                    {usuariosFiltrados.map((u) => (
                      <option key={u.id_usuario} value={u.id_usuario}>
                        {u.nombre_completo} - DNI: {u.dni || "N/A"}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Botón de descarga */}
              <button
                className="btn btn-lg w-100 shadow-sm"
                disabled={downloading || !idUsuario}
                onClick={descargarReporte}
                style={{
                  background: downloading
                    ? "#95a5a6"
                    : "linear-gradient(135deg, #27ae60 0%, #229954 100%)",
                  color: "white",
                  border: "none",
                  borderRadius: "10px",
                  fontWeight: "600",
                  padding: "14px",
                }}
              >
                {downloading ? (
                  <>
                    <FaSpinner className="fa-spin me-2" />
                    Generando reporte...
                  </>
                ) : (
                  <>
                    <FaDownload className="me-2" />
                    Descargar Estado de Cuenta
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Información del Usuario */}
        <div className="col-lg-7">
          {usuarioInfo && usuarioInfo.usuario ? (
            <div
              className="card border-0 shadow-sm h-100"
              style={{ borderRadius: "15px" }}
            >
              <div
                className="card-header border-0 text-white"
                style={{
                  background: "linear-gradient(135deg, #3498db 0%, #2980b9 100%)",
                  borderRadius: "15px 15px 0 0",
                  padding: "20px",
                }}
              >
                <h5 className="mb-0 fw-bold d-flex align-items-center">
                  <FaInfoCircle className="me-2" />
                  Información del Socio
                </h5>
              </div>
              <div className="card-body" style={{ padding: "24px" }}>
                {/* Datos del Usuario */}
                <div className="row g-3 mb-4">
                  <div className="col-md-6">
                    <div
                      className="d-flex align-items-center p-3"
                      style={{
                        background: "rgba(52, 152, 219, 0.1)",
                        borderRadius: "10px",
                      }}
                    >
                      <div
                        className="rounded-circle d-flex align-items-center justify-content-center me-3"
                        style={{
                          width: "45px",
                          height: "45px",
                          background: "linear-gradient(135deg, #3498db, #2980b9)",
                          color: "white",
                        }}
                      >
                        <FaUser style={{ fontSize: "20px" }} />
                      </div>
                      <div>
                        <p className="mb-0 small text-muted">Nombre</p>
                        <p className="mb-0 fw-bold" style={{ color: "#2c3e50" }}>
                          {usuarioInfo.usuario.nombre_completo}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="col-md-6">
                    <div
                      className="d-flex align-items-center p-3"
                      style={{
                        background: "rgba(155, 89, 182, 0.1)",
                        borderRadius: "10px",
                      }}
                    >
                      <div
                        className="rounded-circle d-flex align-items-center justify-content-center me-3"
                        style={{
                          width: "45px",
                          height: "45px",
                          background: "linear-gradient(135deg, #9b59b6, #8e44ad)",
                          color: "white",
                        }}
                      >
                        <FaIdCard style={{ fontSize: "20px" }} />
                      </div>
                      <div>
                        <p className="mb-0 small text-muted">DNI</p>
                        <p className="mb-0 fw-bold" style={{ color: "#2c3e50" }}>
                          {usuarioInfo.usuario.dni || "N/A"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="col-md-6">
                    <div
                      className="d-flex align-items-center p-3"
                      style={{
                        background: "rgba(231, 76, 60, 0.1)",
                        borderRadius: "10px",
                      }}
                    >
                      <div
                        className="rounded-circle d-flex align-items-center justify-content-center me-3"
                        style={{
                          width: "45px",
                          height: "45px",
                          background: "linear-gradient(135deg, #e74c3c, #c0392b)",
                          color: "white",
                        }}
                      >
                        <FaEnvelope style={{ fontSize: "18px" }} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <p className="mb-0 small text-muted">Email</p>
                        <p
                          className="mb-0 fw-bold text-truncate"
                          style={{ color: "#2c3e50" }}
                        >
                          {usuarioInfo.usuario.email || "N/A"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="col-md-6">
                    <div
                      className="d-flex align-items-center p-3"
                      style={{
                        background: "rgba(39, 174, 96, 0.1)",
                        borderRadius: "10px",
                      }}
                    >
                      <div
                        className="rounded-circle d-flex align-items-center justify-content-center me-3"
                        style={{
                          width: "45px",
                          height: "45px",
                          background: "linear-gradient(135deg, #27ae60, #229954)",
                          color: "white",
                        }}
                      >
                        <FaPhone style={{ fontSize: "18px" }} />
                      </div>
                      <div>
                        <p className="mb-0 small text-muted">Teléfono</p>
                        <p className="mb-0 fw-bold" style={{ color: "#2c3e50" }}>
                          {usuarioInfo.usuario.telefono || "N/A"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Estadísticas Rápidas */}
                <div className="row g-3">
                  <div className="col-md-4">
                    <div
                      className="text-center p-3"
                      style={{
                        background: "rgba(52, 152, 219, 0.1)",
                        borderRadius: "10px",
                        border: "2px solid rgba(52, 152, 219, 0.3)",
                      }}
                    >
                      <FaPiggyBank
                        style={{ fontSize: "32px", color: "#3498db", marginBottom: "8px" }}
                      />
                      <p className="mb-1 small text-muted">Cuentas</p>
                      <h4 className="mb-0 fw-bold" style={{ color: "#3498db" }}>
                        {usuarioInfo.totalCuentas}
                      </h4>
                      <p className="mb-0 small" style={{ color: "#27ae60", fontWeight: "600" }}>
                        L. {usuarioInfo.saldoCuentas.toFixed(2)}
                      </p>
                    </div>
                  </div>

                  <div className="col-md-4">
                    <div
                      className="text-center p-3"
                      style={{
                        background: "rgba(230, 126, 34, 0.1)",
                        borderRadius: "10px",
                        border: "2px solid rgba(230, 126, 34, 0.3)",
                      }}
                    >
                      <FaFileInvoiceDollar
                        style={{ fontSize: "32px", color: "#e67e22", marginBottom: "8px" }}
                      />
                      <p className="mb-1 small text-muted">Préstamos</p>
                      <h4 className="mb-0 fw-bold" style={{ color: "#e67e22" }}>
                        {usuarioInfo.totalPrestamos}
                      </h4>
                      <p className="mb-0 small" style={{ color: "#e67e22", fontWeight: "600" }}>
                        L. {usuarioInfo.montoPrestamos.toFixed(2)}
                      </p>
                    </div>
                  </div>

                  <div className="col-md-4">
                    <div
                      className="text-center p-3"
                      style={{
                        background: "rgba(39, 174, 96, 0.1)",
                        borderRadius: "10px",
                        border: "2px solid rgba(39, 174, 96, 0.3)",
                      }}
                    >
                      <FaMoneyBillWave
                        style={{ fontSize: "32px", color: "#27ae60", marginBottom: "8px" }}
                      />
                      <p className="mb-1 small text-muted">Aportaciones</p>
                      <h4 className="mb-0 fw-bold" style={{ color: "#27ae60" }}>
                        {usuarioInfo.totalAportaciones}
                      </h4>
                      <p className="mb-0 small" style={{ color: "#27ae60", fontWeight: "600" }}>
                        L. {usuarioInfo.montoAportaciones.toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div
              className="card border-0 shadow-sm h-100"
              style={{ borderRadius: "15px" }}
            >
              <div className="card-body d-flex flex-column align-items-center justify-content-center py-5">
                <div
                  className="rounded-circle d-flex align-items-center justify-content-center mb-3"
                  style={{
                    width: "80px",
                    height: "80px",
                    background: "rgba(230, 126, 34, 0.1)",
                  }}
                >
                  <FaUser style={{ fontSize: "36px", color: "#e67e22" }} />
                </div>
                <h5 className="text-muted fw-semibold mb-2">
                  Selecciona un socio
                </h5>
                <p className="text-muted text-center mb-0">
                  Elige un socio de la lista para ver su información y generar reportes
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tipos de Reportes Disponibles */}
      <div className="row g-4 mb-4">
        <div className="col-12">
          <h5 className="mb-3 fw-bold" style={{ color: "#2c3e50" }}>
            <FaFileExcel className="me-2" style={{ color: "#27ae60" }} />
            Reportes Disponibles
          </h5>
        </div>

        {/* Reporte Estado de Cuenta */}
        <div className="col-md-6 col-lg-3">
          <div
            className="card border-0 shadow-sm h-100"
            style={{
              borderRadius: "15px",
              transition: "all 0.3s ease",
              cursor: "pointer",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-5px)";
              e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.12)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.08)";
            }}
          >
            <div className="card-body text-center p-4">
              <div
                className="rounded-circle d-flex align-items-center justify-content-center mx-auto mb-3"
                style={{
                  width: "70px",
                  height: "70px",
                  background: "linear-gradient(135deg, #27ae60, #229954)",
                }}
              >
                <FaFileExcel style={{ fontSize: "36px", color: "white" }} />
              </div>
              <h6 className="fw-bold mb-2" style={{ color: "#2c3e50" }}>
                Estado de Cuenta
              </h6>
              <p className="text-muted small mb-0">
                Resumen completo de cuentas, préstamos y movimientos del socio
              </p>
            </div>
          </div>
        </div>

        {/* Reporte de Préstamos */}
        <div className="col-md-6 col-lg-3">
          <div
            className="card border-0 shadow-sm h-100"
            style={{
              borderRadius: "15px",
              transition: "all 0.3s ease",
              cursor: "pointer",
              opacity: 0.6,
            }}
          >
            <div className="card-body text-center p-4">
              <div
                className="rounded-circle d-flex align-items-center justify-content-center mx-auto mb-3"
                style={{
                  width: "70px",
                  height: "70px",
                  background: "linear-gradient(135deg, #e67e22, #d35400)",
                }}
              >
                <FaFileInvoiceDollar style={{ fontSize: "36px", color: "white" }} />
              </div>
              <h6 className="fw-bold mb-2" style={{ color: "#2c3e50" }}>
                Préstamos
              </h6>
              <p className="text-muted small mb-0">
                Detalle de préstamos activos y pagos registrados
              </p>
              <span className="badge bg-secondary mt-2">Próximamente</span>
            </div>
          </div>
        </div>

        {/* Reporte de Aportaciones */}
        <div className="col-md-6 col-lg-3">
          <div
            className="card border-0 shadow-sm h-100"
            style={{
              borderRadius: "15px",
              transition: "all 0.3s ease",
              cursor: "pointer",
              opacity: 0.6,
            }}
          >
            <div className="card-body text-center p-4">
              <div
                className="rounded-circle d-flex align-items-center justify-content-center mx-auto mb-3"
                style={{
                  width: "70px",
                  height: "70px",
                  background: "linear-gradient(135deg, #3498db, #2980b9)",
                }}
              >
                <FaMoneyBillWave style={{ fontSize: "36px", color: "white" }} />
              </div>
              <h6 className="fw-bold mb-2" style={{ color: "#2c3e50" }}>
                Aportaciones
              </h6>
              <p className="text-muted small mb-0">
                Historial completo de aportaciones del socio
              </p>
              <span className="badge bg-secondary mt-2">Próximamente</span>
            </div>
          </div>
        </div>

        {/* Reporte de Movimientos */}
        <div className="col-md-6 col-lg-3">
          <div
            className="card border-0 shadow-sm h-100"
            style={{
              borderRadius: "15px",
              transition: "all 0.3s ease",
              cursor: "pointer",
              opacity: 0.6,
            }}
          >
            <div className="card-body text-center p-4">
              <div
                className="rounded-circle d-flex align-items-center justify-content-center mx-auto mb-3"
                style={{
                  width: "70px",
                  height: "70px",
                  background: "linear-gradient(135deg, #9b59b6, #8e44ad)",
                }}
              >
                <FaExchangeAlt style={{ fontSize: "36px", color: "white" }} />
              </div>
              <h6 className="fw-bold mb-2" style={{ color: "#2c3e50" }}>
                Movimientos
              </h6>
              <p className="text-muted small mb-0">
                Reporte detallado de movimientos en cuentas
              </p>
              <span className="badge bg-secondary mt-2">Próximamente</span>
            </div>
          </div>
        </div>
      </div>

      {/* Información Adicional */}
      <div
        className="card border-0 shadow-sm"
        style={{ borderRadius: "15px" }}
      >
        <div className="card-body p-4">
          <div className="row align-items-center">
            <div className="col-md-1 text-center">
              <FaInfoCircle style={{ fontSize: "36px", color: "#3498db" }} />
            </div>
            <div className="col-md-11">
              <h6 className="fw-bold mb-2" style={{ color: "#2c3e50" }}>
                Información sobre los reportes
              </h6>
              <p className="text-muted mb-0">
                Los reportes se generan en formato Excel (.xlsx) y contienen información detallada y actualizada.
                El <strong>Estado de Cuenta</strong> incluye un resumen de todas las cuentas, préstamos activos,
                aportaciones realizadas y movimientos recientes del socio seleccionado.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
