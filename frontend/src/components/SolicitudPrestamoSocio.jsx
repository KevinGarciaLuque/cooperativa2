import { useEffect, useMemo, useState } from "react";
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const fmt = (n) =>
  `L. ${parseFloat(n || 0).toLocaleString("es-HN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const PROPOSITOS = {
  negocio: "Negocio o capital de trabajo",
  vivienda: "Vivienda o mejoras del hogar",
  educacion: "Educación",
  salud: "Salud o emergencia",
  agricultura: "Agricultura o ganadería",
  consumo: "Consumo personal",
  otro: "Otro",
};

const OCUPACIONES = {
  empleado: "Empleado",
  negocio_propio: "Negocio propio",
  agricultor: "Agricultor / ganadero",
  independiente: "Trabajador independiente",
  jubilado: "Jubilado o pensionado",
  otro: "Otro",
};

const ESTADOS = {
  pendiente: { label: "En revisión", bg: "#fef3c7", color: "#92400e" },
  aprobado: { label: "Aprobada", bg: "#d1fae5", color: "#065f46" },
  activo: { label: "Desembolsada", bg: "#dbeafe", color: "#1e40af" },
  rechazado: { label: "No aprobada", bg: "#fee2e2", color: "#991b1b" },
  pagado: { label: "Pagada", bg: "#e5e7eb", color: "#374151" },
  mora: { label: "En mora", bg: "#fee2e2", color: "#991b1b" },
};

// Formulario con el que el socio pide un préstamo: la cooperativa lo recibe para su revisión
export default function SolicitudPrestamoSocio({ token, onEnviada }) {
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const [param, setParam] = useState(null);
  const [mias, setMias] = useState([]);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const [exito, setExito] = useState("");
  const [form, setForm] = useState({
    monto: "",
    plazo_meses: "",
    cuota_posible: "",
    proposito: "",
    descripcion: "",
    ocupacion: "",
    lugar_trabajo: "",
    ingreso_mensual: "",
    ref1_nombre: "",
    ref1_telefono: "",
    ref1_parentesco: "",
    ref2_nombre: "",
    ref2_telefono: "",
    ref2_parentesco: "",
    acepta: false,
  });

  const cargarMias = () =>
    axios
      .get(`${API_URL}/solicitudes/mias`, { headers })
      .then((r) => setMias(r.data.data || []))
      .catch(() => setMias([]));

  useEffect(() => {
    axios
      .get(`${API_URL}/solicitudes/parametros`, { headers })
      .then((r) => setParam(r.data.data))
      .catch(() => setError("No se pudieron cargar los datos del formulario."));
    cargarMias();
    // eslint-disable-next-line
  }, [headers]);

  const cambiar = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === "checkbox" ? checked : value }));
  };

  const monto = parseFloat(form.monto) || 0;
  const plazo = parseInt(form.plazo_meses) || 0;
  const cuotaPosible = parseFloat(form.cuota_posible) || 0;
  const ingreso = parseFloat(form.ingreso_mensual) || 0;

  // Cuota estimada con la tasa referencial (sistema francés)
  const cuotaEstimada = useMemo(() => {
    if (!param || monto <= 0 || plazo <= 0) return 0;
    const i = param.tasa_mensual / 100;
    if (i === 0) return monto / plazo;
    return (monto * i * Math.pow(1 + i, plazo)) / (Math.pow(1 + i, plazo) - 1);
  }, [param, monto, plazo]);

  const totalAPagar = cuotaEstimada * plazo;
  const relacion = ingreso > 0 && cuotaEstimada > 0 ? (cuotaEstimada / ingreso) * 100 : null;
  const superaCapacidad = cuotaEstimada > 0 && cuotaPosible > 0 && cuotaEstimada > cuotaPosible * 1.001;

  // Plazo mínimo para que la cuota entre en lo que el socio dice poder pagar
  const plazoSugerido = useMemo(() => {
    if (!param || monto <= 0 || cuotaPosible <= 0 || !superaCapacidad) return null;
    for (let n = 1; n <= param.plazo_max; n++) {
      const i = param.tasa_mensual / 100;
      const c = i === 0 ? monto / n : (monto * i * Math.pow(1 + i, n)) / (Math.pow(1 + i, n) - 1);
      if (c <= cuotaPosible) return n;
    }
    return null;
  }, [param, monto, cuotaPosible, superaCapacidad]);

  const enviar = async (e) => {
    e.preventDefault();
    setError("");
    setExito("");
    setEnviando(true);
    try {
      const referencias = [1, 2]
        .map((n) => ({
          nombre: form[`ref${n}_nombre`],
          telefono: form[`ref${n}_telefono`],
          parentesco: form[`ref${n}_parentesco`],
        }))
        .filter((r) => r.nombre && r.telefono);
      const r = await axios.post(
        `${API_URL}/solicitudes/prestamo`,
        {
          monto,
          plazo_meses: plazo,
          cuota_posible: cuotaPosible,
          proposito: form.proposito,
          descripcion: form.descripcion,
          ocupacion: form.ocupacion,
          lugar_trabajo: form.lugar_trabajo,
          ingreso_mensual: ingreso,
          referencias,
          acepta: form.acepta,
        },
        { headers }
      );
      setExito(r.data.message);
      setForm((f) => ({ ...f, monto: "", plazo_meses: "", cuota_posible: "", descripcion: "", acepta: false }));
      cargarMias();
      if (onEnviada) onEnviada();
    } catch (err) {
      setError(err.response?.data?.message || "No se pudo enviar la solicitud.");
    } finally {
      setEnviando(false);
    }
  };

  const enTramite = mias.some((m) => ["pendiente", "aprobado"].includes(m.estado));

  return (
    <div className="d-flex flex-column gap-3">
      {mias.length > 0 && (
        <div className="card border-0 shadow-sm rounded-4">
          <div className="card-body p-4">
            <h6 className="fw-bold mb-3">Mis solicitudes</h6>
            {mias.map((m) => {
              const e = ESTADOS[m.estado] || { label: m.estado, bg: "#e5e7eb", color: "#374151" };
              return (
                <div key={m.id_prestamo} className="d-flex flex-wrap justify-content-between align-items-center py-2 border-bottom">
                  <div>
                    <div className="fw-semibold">{fmt(m.monto)} a {m.plazo_meses} meses</div>
                    <div className="small text-muted">
                      Cuota estimada {fmt(m.cuota_estimada)} · {String(m.creada_en).substring(0, 10)}
                    </div>
                    {m.estado === "rechazado" && m.motivo_rechazo && (
                      <div className="small text-danger">Motivo: {m.motivo_rechazo}</div>
                    )}
                  </div>
                  <span className="badge rounded-pill px-3 py-2" style={{ background: e.bg, color: e.color }}>
                    {e.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="card border-0 shadow-sm rounded-4">
        <div className="card-body p-4">
          <h5 className="fw-bold mb-1">Solicitar un préstamo</h5>
          <p className="text-muted small mb-4">
            Completa el formulario y la cooperativa revisará tu solicitud. La tasa y las condiciones finales las confirma la
            cooperativa al aprobarla.
          </p>

          {enTramite ? (
            <div className="alert alert-info mb-0">
              Ya tienes una solicitud en trámite. Podrás enviar otra cuando la cooperativa responda la actual.
            </div>
          ) : (
            <form onSubmit={enviar}>
              <div className="row g-3">
                <div className="col-12 col-md-4">
                  <label className="form-label fw-semibold small">¿Cuánto necesitas? (L.) *</label>
                  <input
                    type="number" min="1" step="0.01" required className="form-control form-control-lg"
                    name="monto" value={form.monto} onChange={cambiar} placeholder="0.00"
                  />
                  {param && <div className="form-text">Máximo {fmt(param.monto_max)}</div>}
                </div>
                <div className="col-12 col-md-4">
                  <label className="form-label fw-semibold small">¿En cuántos meses lo pagarás? *</label>
                  <input
                    type="number" min="1" max={param?.plazo_max || 60} step="1" required className="form-control form-control-lg"
                    name="plazo_meses" value={form.plazo_meses} onChange={cambiar} placeholder="Ej: 6"
                  />
                </div>
                <div className="col-12 col-md-4">
                  <label className="form-label fw-semibold small">¿Cuánto puedes pagar al mes? (L.) *</label>
                  <input
                    type="number" min="1" step="0.01" required className="form-control form-control-lg"
                    name="cuota_posible" value={form.cuota_posible} onChange={cambiar} placeholder="0.00"
                  />
                </div>

                {/* Simulación */}
                {cuotaEstimada > 0 && (
                  <div className="col-12">
                    <div className="p-3" style={{ background: "#f0f7e6", borderRadius: 12, border: "1px solid #cfe5a0" }}>
                      <div className="row g-2 text-center">
                        <div className="col-6 col-md-3">
                          <div className="small text-muted">Cuota estimada</div>
                          <div className="fw-bold fs-5">{fmt(cuotaEstimada)}</div>
                        </div>
                        <div className="col-6 col-md-3">
                          <div className="small text-muted">Plazo</div>
                          <div className="fw-bold fs-5">{plazo} meses</div>
                        </div>
                        <div className="col-6 col-md-3">
                          <div className="small text-muted">Total a pagar aprox.</div>
                          <div className="fw-bold fs-5">{fmt(totalAPagar)}</div>
                        </div>
                        <div className="col-6 col-md-3">
                          <div className="small text-muted">Tasa referencial</div>
                          <div className="fw-bold fs-5">{param?.tasa_mensual}% mensual</div>
                        </div>
                      </div>
                      {superaCapacidad && (
                        <div className="alert alert-warning py-2 mt-3 mb-0 small">
                          La cuota estimada ({fmt(cuotaEstimada)}) es mayor a lo que dices poder pagar ({fmt(cuotaPosible)}).
                          {plazoSugerido && <> Con <strong>{plazoSugerido} meses</strong> la cuota se ajusta a tu capacidad.</>}
                        </div>
                      )}
                      {relacion !== null && relacion > (param?.pct_ingreso_max || 40) && (
                        <div className="alert alert-warning py-2 mt-2 mb-0 small">
                          La cuota sería el {relacion.toFixed(0)}% de tu ingreso mensual. La cooperativa puede pedirte un plazo
                          mayor o un monto menor.
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="col-12 col-md-6">
                  <label className="form-label fw-semibold small">¿Para qué usarás el préstamo? *</label>
                  <select required className="form-select" name="proposito" value={form.proposito} onChange={cambiar}>
                    <option value="">Selecciona...</option>
                    {Object.entries(PROPOSITOS).map(([v, t]) => (
                      <option key={v} value={v}>{t}</option>
                    ))}
                  </select>
                </div>
                <div className="col-12 col-md-6">
                  <label className="form-label fw-semibold small">Cuéntanos un poco más</label>
                  <input
                    className="form-control" name="descripcion" maxLength={300} value={form.descripcion}
                    onChange={cambiar} placeholder="Ej: comprar mercadería para mi pulpería"
                  />
                </div>

                <div className="col-12 col-md-4">
                  <label className="form-label fw-semibold small">¿De qué vives? *</label>
                  <select required className="form-select" name="ocupacion" value={form.ocupacion} onChange={cambiar}>
                    <option value="">Selecciona...</option>
                    {Object.entries(OCUPACIONES).map(([v, t]) => (
                      <option key={v} value={v}>{t}</option>
                    ))}
                  </select>
                </div>
                <div className="col-12 col-md-4">
                  <label className="form-label fw-semibold small">Lugar de trabajo o nombre del negocio</label>
                  <input className="form-control" name="lugar_trabajo" maxLength={120} value={form.lugar_trabajo} onChange={cambiar} />
                </div>
                <div className="col-12 col-md-4">
                  <label className="form-label fw-semibold small">Ingreso mensual aproximado (L.) *</label>
                  <input
                    type="number" min="1" step="0.01" required className="form-control"
                    name="ingreso_mensual" value={form.ingreso_mensual} onChange={cambiar}
                  />
                </div>

                <div className="col-12">
                  <div className="fw-semibold small mb-2">Referencias personales (recomendado)</div>
                  <div className="row g-2">
                    {[1, 2].map((n) => (
                      <div className="col-12" key={n}>
                        <div className="row g-2">
                          <div className="col-12 col-md-5">
                            <input
                              className="form-control" placeholder={`Referencia ${n}: nombre`} maxLength={100}
                              name={`ref${n}_nombre`} value={form[`ref${n}_nombre`]} onChange={cambiar}
                            />
                          </div>
                          <div className="col-6 col-md-3">
                            <input
                              className="form-control" placeholder="Teléfono" maxLength={20}
                              name={`ref${n}_telefono`} value={form[`ref${n}_telefono`]} onChange={cambiar}
                            />
                          </div>
                          <div className="col-6 col-md-4">
                            <input
                              className="form-control" placeholder="Parentesco o relación" maxLength={50}
                              name={`ref${n}_parentesco`} value={form[`ref${n}_parentesco`]} onChange={cambiar}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="col-12">
                  <div className="form-check">
                    <input id="acepta-sol" name="acepta" type="checkbox" className="form-check-input" checked={form.acepta} onChange={cambiar} />
                    <label htmlFor="acepta-sol" className="form-check-label small">
                      Declaro que la información es verdadera y autorizo a la cooperativa a verificarla.
                    </label>
                  </div>
                </div>

                {error && (
                  <div className="col-12">
                    <div className="alert alert-danger py-2 mb-0">{error}</div>
                  </div>
                )}
                {exito && (
                  <div className="col-12">
                    <div className="alert alert-success py-2 mb-0">{exito}</div>
                  </div>
                )}

                <div className="col-12">
                  <button
                    type="submit" className="btn btn-lg fw-bold"
                    style={{ background: "#a8cd3a", color: "#1a2a00", borderRadius: 12 }}
                    disabled={enviando || !form.acepta}
                  >
                    {enviando ? "Enviando..." : "Enviar solicitud"}
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
