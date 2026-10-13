import { hoyLocal } from "../utils/fechas";
import { useEffect, useState } from "react";
import { verComprobanteReportado } from "../utils/pagosReportados";
import useAccionRapida from "../hooks/useAccionRapida";
import ReciboModal from "../components/ReciboModal";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { useAlerta } from "../context/AlertaContext";
import { FaMoneyCheckAlt, FaPlus, FaSearch, FaChartLine, FaCalendarAlt, FaFileInvoiceDollar } from "react-icons/fa";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import TablaPagos from "./PagosUI/TablaPagos";
import ModalPago from "./PagosUI/ModalPago";

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
  const [reciboNuevo, setReciboNuevo] = useState(null); // id del recibo recién emitido
  const [tipoInicial, setTipoInicial] = useState(""); // tipo de pago sugerido desde la Ventanilla
  const [reporte, setReporte] = useState(null); // pago reportado por el socio que se está confirmando
  const [form, setForm] = useState({
    id_prestamo: "",
    monto: "",
    metodo_pago: "Efectivo",
    fecha: hoyLocal(),
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

  // Acciones rápidas que llegan desde la Ventanilla
  useAccionRapida(!loading, async ({ accion, prestamo, tipo, q, reporte: idReporte }) => {
    if (accion === "ver") {
      setFiltro(q);
    } else if (accion === "nuevo" && idReporte) {
      // Confirmar un pago que reportó el socio: el formulario llega con sus datos
      try {
        const r = await axios.get(`${API_URL}/pagos-reportados/${idReporte}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const rep = r.data.data;
        if (rep.estado !== "pendiente") {
          mostrarAlerta("Ese pago reportado ya fue revisado.", "error");
          return;
        }
        setEditPago(null);
        setTipoInicial("");
        setReporte(rep);
        setForm({
          id_prestamo: rep.id_prestamo,
          monto: String(rep.monto),
          metodo_pago: rep.metodo,
          fecha: String(rep.fecha_pago).substring(0, 10),
          descripcion: "",
        });
        setShowModal(true);
      } catch {
        mostrarAlerta("No se pudo cargar el pago reportado.", "error");
      }
    } else if (accion === "nuevo") {
      openCrearModal();
      if (prestamo) setForm((f) => ({ ...f, id_prestamo: prestamo }));
      setTipoInicial(tipo || "");
    }
  });

  const openCrearModal = () => {
    setEditPago(null);
    setReporte(null);
    setTipoInicial("");
    setForm({
      id_prestamo: "",
      monto: "",
      metodo_pago: "Efectivo",
      fecha: hoyLocal(),
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
        : hoyLocal(),
      descripcion: pago.descripcion || "",
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    const motivo = window.prompt(
      "Anular este pago devuelve el saldo al préstamo y queda registrado.\n\nIndica el motivo de la anulación:"
    );
    if (motivo === null) return;
    if (motivo.trim().length < 3) {
      mostrarAlerta("El motivo de la anulación es obligatorio.", "error");
      return;
    }
    try {
      await axios.delete(`${API_URL}/pagos/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { motivo: motivo.trim() },
      });
      mostrarAlerta("Pago anulado correctamente.", "success");
      fetchData();
    } catch (err) {
      mostrarAlerta(err.response?.data?.message || "Error al anular el pago.", "error");
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
        tipo_pago: form.tipo_pago || "cuota_fija",
        fecha_pago: form.fecha || undefined,
        fecha_referencia: form.fecha_referencia || undefined,
        condonar_mora: form.condonar_mora ? true : undefined,
        id_reporte: !editPago && reporte ? reporte.id_reporte : undefined,
      };
      if (editPago) {
        await axios.put(`${API_URL}/pagos/${editPago.id_pago}`, payload, {
          headers: { Authorization: `Bearer ${token}` },
        });
        mostrarAlerta("Pago actualizado correctamente.", "success");
      } else {
        const resp = await axios.post(`${API_URL}/pagos`, payload, {
          headers: { Authorization: `Bearer ${token}` },
        });
        mostrarAlerta("Pago registrado correctamente.", "success");
        if (resp.data?.id_recibo) setReciboNuevo(resp.data.id_recibo);
      }
      setForm({
        id_prestamo: "",
        monto: "",
        metodo_pago: "Efectivo",
        fecha: hoyLocal(),
        descripcion: "",
      });
      setEditPago(null);
      setReporte(null);
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
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
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

      {reciboNuevo && (
        <ReciboModal idRecibo={reciboNuevo} onClose={() => setReciboNuevo(null)} />
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
          onClose={() => {
            setShowModal(false);
            setReporte(null);
          }}
          onSubmit={handleSubmit}
          handleInput={handleInput}
          tipoInicial={tipoInicial}
          reporte={reporte}
          onVerComprobante={reporte ? () => verComprobanteReportado(reporte.id_reporte, token) : undefined}
        />
      )}
    </div>
  );
}
