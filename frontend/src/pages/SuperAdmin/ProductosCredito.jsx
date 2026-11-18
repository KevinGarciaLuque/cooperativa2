// Productos de crédito (Super Administrador): Consumo, Vivienda, Agrícola... con su tasa
// referencial, montos, plazos y la garantía que exigen. No se borran: se desactivan.
import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { FaPlus, FaEdit, FaLayerGroup } from "react-icons/fa";
import { useAuth } from "../../context/AuthContext";
import { useAlerta } from "../../context/AlertaContext";
import InputMonto from "../../ui/InputMonto";
import { dinero, simboloMoneda } from "../../utils/pais";
import PlantillasDocumentos from "../../components/PlantillasDocumentos";
import { useFunciones } from "../../hooks/useFunciones";
import FormatoCodigoCredito from "../../components/FormatoCodigoCredito";

const ACCENT = "#a8cd3a";
const AZUL = "#1a2035";
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const VACIO = {
  nombre: "",
  descripcion: "",
  tasa_mensual: "",
  monto_min: "",
  monto_max: "",
  plazo_min: "1",
  plazo_max: "",
  garantia_requerida: "aval",
  visible_socios: true,
  activo: true,
  orden: "0",
  mora_tasa_anual: "",
  mora_dias_gracia: "",
  cargo_tipo: "",
  cargo_valor: "",
  cargo_concepto: "",
  redondeo_cuota: "",
};

export default function ProductosCredito() {
  const funciones = useFunciones();
  const { token } = useAuth();
  const { mostrarAlerta } = useAlerta();
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const [productos, setProductos] = useState([]);
  const [garantias, setGarantias] = useState({});
  const [cargando, setCargando] = useState(true);
  const [editando, setEditando] = useState(null); // null = cerrado; {} = nuevo; producto = editar
  const [form, setForm] = useState(VACIO);
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(() => {
    setCargando(true);
    axios
      .get(`${API_URL}/productos`, { headers })
      .then((r) => {
        setProductos(r.data.data || []);
        setGarantias(r.data.garantias || {});
      })
      .catch(() => mostrarAlerta("No se pudieron cargar los productos de crédito.", "error"))
      .finally(() => setCargando(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headers]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const abrir = (p) => {
    setEditando(p || {});
    setForm(
      p
        ? {
            ...VACIO,
            ...p,
            descripcion: p.descripcion || "",
            tasa_mensual: String(p.tasa_mensual),
            monto_min: String(p.monto_min),
            monto_max: String(p.monto_max),
            plazo_min: String(p.plazo_min),
            plazo_max: String(p.plazo_max),
            orden: String(p.orden),
            mora_tasa_anual: p.mora_tasa_anual ?? "",
            mora_dias_gracia: p.mora_dias_gracia ?? "",
            cargo_tipo: p.cargo_tipo || "",
            cargo_valor: p.cargo_valor ?? "",
            cargo_concepto: p.cargo_concepto || "",
            redondeo_cuota: p.redondeo_cuota ?? "",
          }
        : VACIO
    );
  };

  const cambiar = (campo) => (e) => {
    const v = e?.target ? (e.target.type === "checkbox" ? e.target.checked : e.target.value) : e;
    setForm((f) => ({ ...f, [campo]: v }));
  };

  const guardar = async (e) => {
    e.preventDefault();
    setGuardando(true);
    try {
      if (editando?.id_producto) {
        await axios.put(`${API_URL}/productos/${editando.id_producto}`, form, { headers });
        mostrarAlerta("Producto actualizado. Aplica a los préstamos nuevos.", "success");
      } else {
        await axios.post(`${API_URL}/productos`, form, { headers });
        mostrarAlerta("Producto creado.", "success");
      }
      setEditando(null);
      cargar();
    } catch (err) {
      mostrarAlerta(err.response?.data?.message || "No se pudo guardar el producto.", "error");
    } finally {
      setGuardando(false);
    }
  };

  const alternarActivo = async (p) => {
    try {
      await axios.put(`${API_URL}/productos/${p.id_producto}`, { activo: !p.activo }, { headers });
      cargar();
    } catch (err) {
      mostrarAlerta(err.response?.data?.message || "No se pudo cambiar el producto.", "error");
    }
  };

  return (
    <div className="container-fluid py-3">
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
        <div className="d-flex align-items-center gap-3">
          <div
            className="d-flex align-items-center justify-content-center"
            style={{ width: 48, height: 48, borderRadius: 12, background: AZUL, color: ACCENT }}
          >
            <FaLayerGroup size={20} />
          </div>
          <div>
            <h4 className="fw-bold mb-0" style={{ color: AZUL }}>Productos de crédito</h4>
            <div className="text-muted small">Tipos de préstamo con su tasa, montos, plazos y garantía</div>
          </div>
        </div>
        <button className="btn fw-semibold" style={{ background: ACCENT, color: AZUL }} onClick={() => abrir(null)}>
          <FaPlus className="me-2" /> Nuevo producto
        </button>
      </div>

      <div className="alert alert-light border small">
        Los socios eligen el tipo de préstamo al solicitarlo y sus condiciones se validan. Si no hay ningún producto
        activo, las solicitudes usan los parámetros generales (Parámetros → Solicitudes). Cambiar un producto solo
        afecta a los préstamos nuevos: los ya otorgados conservan su tasa y su plazo.
      </div>

      <div className="card border-0 shadow-sm" style={{ borderRadius: 14 }}>
        <div className="card-body p-0">
          {cargando ? (
            <div className="text-center py-5">
              <div className="spinner-border text-success" />
            </div>
          ) : productos.length === 0 ? (
            <div className="text-center text-muted py-5">
              Aún no hay productos. Crea el primero (por ejemplo: Consumo, Vivienda, Agrícola).
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table align-middle mb-0">
                <thead className="small text-muted text-uppercase">
                  <tr>
                    <th className="ps-3">Producto</th>
                    <th className="text-end">Tasa mensual</th>
                    <th className="text-end">Monto</th>
                    <th className="text-end">Plazo</th>
                    <th>Garantía</th>
                    <th>Socios</th>
                    <th className="text-end">Vigentes</th>
                    <th>Estado</th>
                    <th className="pe-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {productos.map((p) => (
                    <tr key={p.id_producto} style={{ opacity: p.activo ? 1 : 0.55 }}>
                      <td className="ps-3">
                        <div className="fw-semibold">{p.nombre}</div>
                        {p.descripcion && <div className="small text-muted">{p.descripcion}</div>}
                      </td>
                      <td className="text-end">{p.tasa_mensual}%</td>
                      <td className="text-end small">
                        {dinero(p.monto_min, 0)} – {dinero(p.monto_max, 0)}
                      </td>
                      <td className="text-end small">
                        {p.plazo_min} – {p.plazo_max} meses
                      </td>
                      <td className="small">{garantias[p.garantia_requerida] || p.garantia_requerida}</td>
                      <td className="small">{p.visible_socios ? "Pueden solicitarlo" : "Solo el personal"}</td>
                      <td className="text-end">{p.prestamos_vigentes}</td>
                      <td>
                        <button
                          className={`btn btn-sm rounded-pill ${p.activo ? "btn-outline-success" : "btn-outline-secondary"}`}
                          onClick={() => alternarActivo(p)}
                          title={p.activo ? "Desactivar" : "Activar"}
                        >
                          {p.activo ? "Activo" : "Inactivo"}
                        </button>
                      </td>
                      <td className="pe-3 text-end">
                        <button className="btn btn-sm btn-outline-dark" onClick={() => abrir(p)}>
                          <FaEdit className="me-1" /> Editar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {editando !== null && (
        <div className="modal d-block" style={{ background: "rgba(0,0,0,.45)" }} onClick={() => setEditando(null)}>
          <div className="modal-dialog modal-lg modal-dialog-scrollable" onClick={(e) => e.stopPropagation()}>
            <form className="modal-content" onSubmit={guardar} style={{ borderRadius: 14 }}>
              <div className="modal-header">
                <h5 className="modal-title fw-bold">{editando.id_producto ? `Editar ${editando.nombre}` : "Nuevo producto"}</h5>
                <button type="button" className="btn-close" onClick={() => setEditando(null)} />
              </div>
              <div className="modal-body">
                <div className="row g-3">
                  <div className="col-12 col-md-6">
                    <label className="form-label small fw-semibold">Nombre *</label>
                    <input className="form-control" required maxLength={80} value={form.nombre} onChange={cambiar("nombre")} placeholder="Ej: Consumo" />
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="form-label small fw-semibold">Tasa mensual referencial (%) *</label>
                    <input className="form-control" required type="number" min="0" max="50" step="0.001" value={form.tasa_mensual} onChange={cambiar("tasa_mensual")} />
                    <div className="form-text">Con la que el socio ve su cuota estimada; al aprobar se puede ajustar.</div>
                  </div>
                  <div className="col-12">
                    <label className="form-label small fw-semibold">Descripción</label>
                    <input className="form-control" maxLength={300} value={form.descripcion} onChange={cambiar("descripcion")} placeholder="Para qué sirve, a quién va dirigido" />
                  </div>
                  <div className="col-6 col-md-3">
                    <label className="form-label small fw-semibold">Monto mínimo ({simboloMoneda()})</label>
                    <InputMonto value={form.monto_min} onChange={cambiar("monto_min")} />
                  </div>
                  <div className="col-6 col-md-3">
                    <label className="form-label small fw-semibold">Monto máximo ({simboloMoneda()}) *</label>
                    <InputMonto required value={form.monto_max} onChange={cambiar("monto_max")} />
                  </div>
                  <div className="col-6 col-md-3">
                    <label className="form-label small fw-semibold">Plazo mínimo (meses)</label>
                    <input className="form-control" type="number" min="1" max="360" value={form.plazo_min} onChange={cambiar("plazo_min")} />
                  </div>
                  <div className="col-6 col-md-3">
                    <label className="form-label small fw-semibold">Plazo máximo (meses) *</label>
                    <input className="form-control" required type="number" min="1" max="360" value={form.plazo_max} onChange={cambiar("plazo_max")} />
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="form-label small fw-semibold">Garantía que exige</label>
                    <select className="form-select" value={form.garantia_requerida} onChange={cambiar("garantia_requerida")}>
                      {Object.entries(garantias).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                    <div className="form-text">No se podrá desembolsar sin ella registrada.</div>
                  </div>
                  {funciones.configuracion_avanzada && (
                    <div className="col-12">
                      <div className="border rounded-3 p-3" style={{ background: "#f8f9fb" }}>
                        <div className="fw-semibold small mb-1">Configuración avanzada (préstamos nuevos de este producto)</div>
                        <div className="form-text mb-2">Vacío = se usa lo general de Parámetros. Se copia a cada préstamo al desembolsarlo.</div>
                        <div className="row g-2">
                          <div className="col-6 col-md-3">
                            <label className="form-label small mb-1">Mora (% anual)</label>
                            <input className="form-control form-control-sm" type="number" step="0.01" min="0" max="120" value={form.mora_tasa_anual} onChange={cambiar("mora_tasa_anual")} placeholder="General" />
                          </div>
                          <div className="col-6 col-md-3">
                            <label className="form-label small mb-1">Días de gracia</label>
                            <input className="form-control form-control-sm" type="number" min="0" max="90" value={form.mora_dias_gracia} onChange={cambiar("mora_dias_gracia")} placeholder="General" />
                          </div>
                          <div className="col-12 col-md-6">
                            <label className="form-label small mb-1">Redondeo de la cuota</label>
                            <select className="form-select form-select-sm" value={form.redondeo_cuota} onChange={cambiar("redondeo_cuota")}>
                              <option value="">Sin redondeo (cuota exacta)</option>
                              {[1, 5, 10, 50, 100].map((r) => <option key={r} value={r}>Subir a múltiplos de {r} (la última ajusta)</option>)}
                            </select>
                          </div>
                          <div className="col-12 col-md-4">
                            <label className="form-label small mb-1">Cargo automático en cada pago</label>
                            <select className="form-select form-select-sm" value={form.cargo_tipo} onChange={cambiar("cargo_tipo")}>
                              <option value="">Ninguno</option>
                              <option value="fijo">Monto fijo por pago</option>
                              <option value="porcentaje">Porcentaje de cada pago</option>
                            </select>
                          </div>
                          {form.cargo_tipo && (
                            <>
                              <div className="col-6 col-md-3">
                                <label className="form-label small mb-1">{form.cargo_tipo === "porcentaje" ? "Porcentaje (%)" : `Monto (${simboloMoneda()})`}</label>
                                <input className="form-control form-control-sm" type="number" step="0.01" min="0" value={form.cargo_valor} onChange={cambiar("cargo_valor")} />
                              </div>
                              <div className="col-6 col-md-5">
                                <label className="form-label small mb-1">Concepto</label>
                                <input className="form-control form-control-sm" maxLength={80} placeholder="Ej.: seguro de deuda" value={form.cargo_concepto} onChange={cambiar("cargo_concepto")} />
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="col-6 col-md-3">
                    <label className="form-label small fw-semibold">Orden en la lista</label>
                    <input className="form-control" type="number" value={form.orden} onChange={cambiar("orden")} />
                  </div>
                  <div className="col-12 d-flex flex-wrap gap-4">
                    <div className="form-check form-switch">
                      <input className="form-check-input" type="checkbox" id="prod-socios" checked={form.visible_socios} onChange={cambiar("visible_socios")} />
                      <label className="form-check-label small" htmlFor="prod-socios">Los socios pueden solicitarlo</label>
                    </div>
                    <div className="form-check form-switch">
                      <input className="form-check-input" type="checkbox" id="prod-activo" checked={form.activo} onChange={cambiar("activo")} />
                      <label className="form-check-label small" htmlFor="prod-activo">Activo</label>
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline-secondary" onClick={() => setEditando(null)}>Cancelar</button>
                <button type="submit" className="btn fw-semibold" style={{ background: ACCENT, color: AZUL }} disabled={guardando}>
                  {guardando && <span className="spinner-border spinner-border-sm me-2" />}
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <FormatoCodigoCredito token={token} mostrarAlerta={mostrarAlerta} />
      <PlantillasDocumentos token={token} mostrarAlerta={mostrarAlerta} />
    </div>
  );
}
