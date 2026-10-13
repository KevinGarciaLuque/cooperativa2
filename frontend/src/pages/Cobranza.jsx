import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useAlerta } from "../context/AlertaContext";
import { FaPhoneAlt, FaClipboardList, FaTimes, FaWhatsapp, FaEnvelope } from "react-icons/fa";
import { DataTable, EmptyState, PageHeader } from "../ui/Componentes";

const AZUL = "#1a2035";
const ACCENT = "#a8cd3a";
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const fmt = (n) =>
  `L. ${parseFloat(n || 0).toLocaleString("es-HN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const CATEGORIAS = [
  { key: "todas", label: "Toda la cartera", color: "#475569" },
  { key: "por_vencer", label: "Por vencer (7 días)", color: "#b45309" },
  { key: "mora_1_30", label: "Mora 1-30 días", color: "#c2410c" },
  { key: "mora_31_60", label: "Mora 31-60", color: "#b91c1c" },
  { key: "mora_61_90", label: "Mora 61-90", color: "#991b1b" },
  { key: "mora_90_mas", label: "Mora +90", color: "#7f1d1d" },
  { key: "al_dia", label: "Al día", color: "#047857" },
];

const MEDIOS = ["llamada", "visita", "mensaje", "correo", "otro"];

export default function Cobranza() {
  const { token } = useAuth();
  const { mostrarAlerta } = useAlerta();
  const navigate = useNavigate();
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const [cartera, setCartera] = useState(null);
  const [categoria, setCategoria] = useState("todas");
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(true);

  const [gestion, setGestion] = useState(null); // fila del préstamo en gestión
  const [historial, setHistorial] = useState([]);
  const [form, setForm] = useState({ medio: "llamada", nota: "", promesa_fecha: "", promesa_monto: "" });
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const res = await axios.get(`${API_URL}/cobranza/cartera`, { headers });
      setCartera(res.data);
    } catch {
      mostrarAlerta("No se pudo cargar la cartera.", "error");
    } finally {
      setCargando(false);
    }
    // eslint-disable-next-line
  }, [headers]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const abrirGestion = async (fila) => {
    setGestion(fila);
    setForm({ medio: "llamada", nota: "", promesa_fecha: "", promesa_monto: "" });
    setHistorial([]);
    try {
      const r = await axios.get(`${API_URL}/cobranza/gestiones/${fila.id_prestamo}`, { headers });
      setHistorial(r.data.data || []);
    } catch {
      setHistorial([]);
    }
  };

  const guardarGestion = async (e) => {
    e.preventDefault();
    setGuardando(true);
    try {
      await axios.post(
        `${API_URL}/cobranza/gestiones`,
        {
          id_prestamo: gestion.id_prestamo,
          medio: form.medio,
          nota: form.nota,
          promesa_fecha: form.promesa_fecha || undefined,
          promesa_monto: form.promesa_monto || undefined,
        },
        { headers }
      );
      mostrarAlerta("Gestión registrada.", "success");
      setGestion(null);
      cargar();
    } catch (err) {
      mostrarAlerta(err.response?.data?.message || "No se pudo registrar la gestión.", "error");
    } finally {
      setGuardando(false);
    }
  };

  // Recordatorio por WhatsApp: abre el chat del socio con el mensaje listo y lo anota en Cobranza
  const recordarWhatsapp = async (f) => {
    try {
      const r = await axios.get(`${API_URL}/cobranza/recordatorio/${f.id_prestamo}`, { headers });
      const { texto, telefono } = r.data.data;
      const tel = String(telefono || "").replace(/\D/g, "");
      const numero = tel.length === 8 ? `504${tel}` : tel;
      window.open(
        numero ? `https://wa.me/${numero}?text=${encodeURIComponent(texto)}` : `https://wa.me/?text=${encodeURIComponent(texto)}`,
        "_blank",
        "noopener"
      );
      await axios.post(
        `${API_URL}/cobranza/gestiones`,
        { id_prestamo: f.id_prestamo, medio: "mensaje", nota: "Recordatorio de pago enviado por WhatsApp." },
        { headers }
      );
      cargar();
    } catch (err) {
      mostrarAlerta(err.response?.data?.message || "No se pudo preparar el recordatorio.", "error");
    }
  };

  const recordarCorreo = async (f) => {
    try {
      const r = await axios.post(`${API_URL}/cobranza/recordatorio/${f.id_prestamo}`, {}, { headers });
      mostrarAlerta(r.data.message, "success");
      cargar();
    } catch (err) {
      mostrarAlerta(err.response?.data?.message || "No se pudo enviar el recordatorio.", "error");
    }
  };

  const filas = useMemo(() => {
    if (!cartera) return [];
    const q = busqueda.trim().toLowerCase();
    return cartera.data.filter(
      (f) =>
        (categoria === "todas" || f.categoria === categoria) &&
        (!q || f.socio.toLowerCase().includes(q) || (f.dni || "").includes(q))
    );
  }, [cartera, categoria, busqueda]);

  const resumen = cartera?.resumen || {};
  const colorDe = (cat) => CATEGORIAS.find((c) => c.key === cat)?.color || "#475569";
  const etiquetaDe = (cat) => CATEGORIAS.find((c) => c.key === cat)?.label || cat;

  return (
    <div className="container-fluid py-3">
      <PageHeader
        icono={<FaClipboardList />}
        titulo="Cobranza"
        subtitulo="Cartera por vencer y en mora, con el seguimiento de cada gestión."
      />

      {/* Filtros por categoría */}
      <div className="d-flex flex-wrap gap-2 mb-3">
        {CATEGORIAS.map((c) => {
          const r = c.key === "todas" ? null : resumen[c.key];
          const activo = categoria === c.key;
          return (
            <button
              key={c.key}
              className="btn btn-sm"
              onClick={() => setCategoria(c.key)}
              style={{
                background: activo ? c.color : "#fff",
                color: activo ? "#fff" : c.color,
                border: `1.5px solid ${c.color}`,
                borderRadius: 20,
                fontWeight: 600,
              }}
            >
              {c.label}
              {c.key === "todas"
                ? ` (${cartera?.data.length ?? 0})`
                : ` (${r ? r.cantidad : 0})`}
            </button>
          );
        })}
      </div>

      <input
        className="form-control mb-3"
        style={{ maxWidth: 360 }}
        placeholder="Buscar por nombre o identidad..."
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
      />

      <div className="ui-card">
        <DataTable
          cargando={cargando && !cartera}
          filas={filas}
          claveFila={(f) => f.id_prestamo}
          tam={15}
          etiqueta="préstamos"
          vacio={<EmptyState titulo="No hay préstamos en esta categoría" />}
          columnas={[
            {
              clave: "socio",
              titulo: "Socio",
              ordenable: true,
              render: (f) => (
                <>
                  <div className="fw-semibold">{f.socio}</div>
                  <div className="small text-muted">
                    {f.telefono ? (
                      <>
                        <FaPhoneAlt className="me-1" size={10} />
                        {f.telefono}
                      </>
                    ) : (
                      "Sin teléfono"
                    )}
                  </div>
                </>
              ),
            },
            { clave: "id_prestamo", titulo: "Préstamo", ordenable: true, render: (f) => `#${f.id_prestamo}` },
            {
              clave: "dias_mora",
              titulo: "Situación",
              ordenable: true,
              render: (f) => (
                <>
                  <span
                    className="badge rounded-pill"
                    style={{ background: `${colorDe(f.categoria)}1a`, color: colorDe(f.categoria) }}
                  >
                    {etiquetaDe(f.categoria)}
                  </span>
                  <div className="small text-muted">
                    {f.dias_mora > 0
                      ? `${f.dias_mora} día(s) de atraso`
                      : `Vence ${f.vencimiento} (${f.dias_para_vencer} d)`}
                  </div>
                </>
              ),
            },
            { clave: "saldo", titulo: "Saldo", alinear: "end", ordenable: true, render: (f) => fmt(f.saldo) },
            { clave: "cuota", titulo: "Cuota", alinear: "end", ordenable: true, render: (f) => fmt(f.cuota) },
            {
              clave: "mora_generada",
              titulo: "Mora",
              alinear: "end",
              ordenable: true,
              render: (f) => (
                <span className="fw-semibold" style={{ color: f.mora_generada > 0 ? "#b91c1c" : "inherit" }}>
                  {fmt(f.mora_generada)}
                </span>
              ),
            },
            {
              clave: "ultima_nota",
              titulo: "Última gestión",
              render: (f) =>
                f.ultima_nota ? (
                  <div className="small" style={{ maxWidth: 220 }}>
                    <div className="text-truncate">{f.ultima_nota}</div>
                    {f.promesa_fecha && (
                      <div style={{ color: f.promesa_vencida ? "#b91c1c" : "#047857" }}>
                        Promesa: {f.promesa_fecha}
                        {f.promesa_vencida && " (incumplida)"}
                      </div>
                    )}
                  </div>
                ) : (
                  <span className="small text-muted">Sin gestiones</span>
                ),
            },
            {
              clave: "acciones",
              titulo: "",
              render: (f) => (
                <span className="text-nowrap">
                  <button
                    className="btn btn-sm me-1"
                    style={{ background: "#25D366", color: "#fff" }}
                    title="Enviar recordatorio de pago por WhatsApp"
                    onClick={() => recordarWhatsapp(f)}
                  >
                    <FaWhatsapp />
                  </button>
                  <button
                    className="btn btn-sm btn-outline-secondary me-1"
                    title={f.correo ? `Enviar recordatorio de pago a ${f.correo}` : "El socio no tiene correo"}
                    disabled={!f.correo}
                    onClick={() => recordarCorreo(f)}
                  >
                    <FaEnvelope />
                  </button>
                  <button className="btn btn-sm btn-outline-dark me-1" onClick={() => abrirGestion(f)}>
                    Gestión
                  </button>
                  <button
                    className="btn btn-sm fw-semibold"
                    style={{ background: ACCENT, color: "#1a2a00" }}
                    onClick={() => navigate(`/pagos?accion=nuevo&socio=${f.id_usuario}&prestamo=${f.id_prestamo}`)}
                  >
                    Cobrar
                  </button>
                </span>
              ),
            },
          ]}
        />
      </div>

      {/* Modal de gestión */}
      {gestion && (
        <div
          className="modal show d-block"
          style={{ background: "rgba(0,0,0,.6)", zIndex: 6000, position: "fixed", inset: 0, overflowY: "auto" }}
        >
          <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: 560 }}>
            <form className="modal-content border-0 shadow-lg" style={{ borderRadius: 16 }} onSubmit={guardarGestion}>
              <div className="modal-header border-0 pb-0">
                <div>
                  <h5 className="modal-title fw-bold">Gestión de cobro</h5>
                  <div className="small text-muted">
                    {gestion.socio} · Préstamo #{gestion.id_prestamo} · Mora {fmt(gestion.mora_generada)}
                  </div>
                </div>
                <button type="button" className="btn-close" onClick={() => setGestion(null)} />
              </div>
              <div className="modal-body">
                {historial.length > 0 && (
                  <div className="mb-3" style={{ maxHeight: 150, overflowY: "auto" }}>
                    {historial.map((h) => (
                      <div key={h.id_gestion} className="small border-bottom py-1">
                        <strong>{String(h.fecha).substring(0, 10)}</strong> · {h.medio}
                        {h.registrado_por ? ` · ${h.registrado_por}` : ""}
                        <div>{h.nota}</div>
                        {h.promesa_fecha && (
                          <div className="text-success">
                            Promesa: {String(h.promesa_fecha).substring(0, 10)}
                            {h.promesa_monto ? ` por ${fmt(h.promesa_monto)}` : ""}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div className="row g-2">
                  <div className="col-12 col-md-4">
                    <label className="form-label small fw-semibold">Medio</label>
                    <select
                      className="form-select"
                      value={form.medio}
                      onChange={(e) => setForm({ ...form, medio: e.target.value })}
                    >
                      {MEDIOS.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-12">
                    <label className="form-label small fw-semibold">Nota</label>
                    <textarea
                      className="form-control"
                      rows={3}
                      required
                      maxLength={500}
                      value={form.nota}
                      onChange={(e) => setForm({ ...form, nota: e.target.value })}
                      placeholder="Qué se habló o acordó con el socio"
                    />
                  </div>
                  <div className="col-6">
                    <label className="form-label small fw-semibold">Promesa de pago (fecha)</label>
                    <input
                      type="date"
                      className="form-control"
                      value={form.promesa_fecha}
                      onChange={(e) => setForm({ ...form, promesa_fecha: e.target.value })}
                    />
                  </div>
                  <div className="col-6">
                    <label className="form-label small fw-semibold">Monto prometido</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="form-control"
                      value={form.promesa_monto}
                      onChange={(e) => setForm({ ...form, promesa_monto: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer border-0 pt-0">
                <button type="button" className="btn btn-outline-secondary" onClick={() => setGestion(null)}>
                  <FaTimes className="me-1" /> Cancelar
                </button>
                <button
                  type="submit"
                  className="btn fw-semibold"
                  style={{ background: ACCENT, color: "#1a2a00" }}
                  disabled={guardando}
                >
                  {guardando ? "Guardando..." : "Registrar gestión"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
