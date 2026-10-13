// Políticas de la cooperativa: el Super Administrador las redacta, las publica como versión
// y ve cuántos socios las aceptaron.
import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import { useAlerta } from "../../context/AlertaContext";
import { FaBook, FaCheckCircle, FaEye, FaPen, FaPlus, FaSave, FaTrash, FaUsers } from "react-icons/fa";
import TextoPolitica from "../../components/TextoPolitica";

const ACCENT = "#a8cd3a";
const AZUL = "#1a2035";
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const fecha = (v) => {
  const d = new Date(v);
  return isNaN(d) ? "" : d.toLocaleDateString("es-HN", { day: "numeric", month: "short", year: "numeric" });
};

export default function Politicas() {
  const { token } = useAuth();
  const { mostrarAlerta } = useAlerta();
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const [lista, setLista] = useState(null);
  const [sociosActivos, setSociosActivos] = useState(0);
  const [elegida, setElegida] = useState(null); // id_politica
  const [form, setForm] = useState({ titulo: "", contenido: "", obligatoria: true });
  const [modo, setModo] = useState("editar"); // editar | vista
  const [vista, setVista] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [publicar, setPublicar] = useState(null); // diálogo de publicación
  const [aceptaciones, setAceptaciones] = useState(null);

  const cargar = useCallback(
    async (seleccionar) => {
      try {
        const r = await axios.get(`${API_URL}/politicas`, { headers });
        const datos = r.data.data || [];
        setLista(datos);
        setSociosActivos(r.data.socios_activos || 0);
        const id = seleccionar ?? datos[0]?.id_politica ?? null;
        const p = datos.find((x) => x.id_politica === id);
        setElegida(id);
        if (p) setForm({ titulo: p.titulo, contenido: p.contenido, obligatoria: p.obligatoria });
      } catch {
        mostrarAlerta("No se pudieron cargar las políticas.", "error");
        setLista([]);
      }
    },
    // eslint-disable-next-line
    [headers]
  );

  useEffect(() => {
    cargar();
  }, [cargar]);

  const actual = lista?.find((p) => p.id_politica === elegida);
  const sinGuardar =
    !!actual && (form.titulo !== actual.titulo || form.contenido !== actual.contenido || form.obligatoria !== actual.obligatoria);

  const elegir = (p) => {
    if (sinGuardar && !window.confirm("Tienes cambios sin guardar. ¿Descartarlos?")) return;
    setElegida(p.id_politica);
    setForm({ titulo: p.titulo, contenido: p.contenido, obligatoria: p.obligatoria });
    setModo("editar");
    setAceptaciones(null);
  };

  const verVista = async () => {
    setModo("vista");
    try {
      const r = await axios.post(`${API_URL}/politicas/vista-previa`, { contenido: form.contenido }, { headers });
      setVista(r.data.contenido);
    } catch {
      setVista(form.contenido);
    }
  };

  const guardar = async () => {
    setOcupado(true);
    try {
      await axios.put(`${API_URL}/politicas/${elegida}`, form, { headers });
      await cargar(elegida);
      mostrarAlerta("Borrador guardado. Los socios verán los cambios cuando lo publiques.", "success");
    } catch (err) {
      mostrarAlerta(err.response?.data?.message || "No se pudo guardar.", "error");
    } finally {
      setOcupado(false);
    }
  };

  const confirmarPublicacion = async () => {
    setOcupado(true);
    try {
      if (sinGuardar) await axios.put(`${API_URL}/politicas/${elegida}`, form, { headers });
      const r = await axios.post(
        `${API_URL}/politicas/${elegida}/publicar`,
        { pedir_aceptacion: publicar.pedir },
        { headers }
      );
      setPublicar(null);
      await cargar(elegida);
      mostrarAlerta(
        r.data.pide_aceptacion
          ? `${r.data.message} Los socios deberán leerla y aceptarla.`
          : `${r.data.message} Se publicó como cambio menor.`,
        "success"
      );
    } catch (err) {
      mostrarAlerta(err.response?.data?.message || "No se pudo publicar.", "error");
    } finally {
      setOcupado(false);
    }
  };

  const nueva = async () => {
    const titulo = window.prompt("Título de la nueva política:");
    if (!titulo || titulo.trim().length < 3) return;
    try {
      const r = await axios.post(`${API_URL}/politicas`, { titulo, contenido: "" }, { headers });
      await cargar(r.data.id_politica);
    } catch (err) {
      mostrarAlerta(err.response?.data?.message || "No se pudo crear.", "error");
    }
  };

  const retirar = async () => {
    if (!window.confirm(`¿Retirar "${actual.titulo}"? Dejará de mostrarse a los socios (su historial se conserva).`)) return;
    try {
      await axios.delete(`${API_URL}/politicas/${elegida}`, { headers });
      await cargar(null);
      mostrarAlerta("Política retirada.", "success");
    } catch (err) {
      mostrarAlerta(err.response?.data?.message || "No se pudo retirar.", "error");
    }
  };

  const verAceptaciones = async () => {
    try {
      const r = await axios.get(`${API_URL}/politicas/${elegida}/aceptaciones`, { headers });
      setAceptaciones(r.data.data || []);
    } catch {
      mostrarAlerta("No se pudo cargar la lista.", "error");
    }
  };

  return (
    <div className="container-fluid py-3">
      <style>{`
        .pol-card { border: 0; border-radius: 1rem; box-shadow: 0 2px 12px #0000000f; background: #fff; }
        .pol-item { border: 0; background: none; width: 100%; text-align: left; padding: .8rem 1rem; border-radius: .8rem; }
        .pol-item:hover { background: #f4f8e8; }
        .pol-item.activa { background: #eef6d8; }
      `}</style>

      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <div>
          <h3 className="fw-bold mb-0" style={{ color: AZUL }}>
            <FaBook className="me-2" />
            Políticas de la cooperativa
          </h3>
          <span className="text-muted">
            Redáctalas, publícalas y revisa qué socios las aceptaron. Nada cambia para los socios hasta que publicas.
          </span>
        </div>
        <button className="btn fw-semibold" style={{ background: ACCENT, color: "#1a2a00" }} onClick={nueva}>
          <FaPlus className="me-1" /> Nueva política
        </button>
      </div>

      {lista === null ? (
        <div className="spinner-border spinner-border-sm text-success" />
      ) : (
        <div className="row g-3">
          <div className="col-12 col-lg-4">
            <div className="pol-card p-2">
              {lista.length === 0 && <div className="p-3 text-muted small">No hay políticas.</div>}
              {lista.map((p) => (
                <button
                  key={p.id_politica}
                  className={`pol-item ${p.id_politica === elegida ? "activa" : ""}`}
                  onClick={() => elegir(p)}
                >
                  <div className="fw-semibold" style={{ color: AZUL }}>{p.titulo}</div>
                  <div className="d-flex flex-wrap gap-1 mt-1">
                    {p.version === 0 ? (
                      <span className="badge text-bg-warning">Borrador sin publicar</span>
                    ) : (
                      <span className="badge text-bg-success">Versión {p.version} · {fecha(p.publicada_en)}</span>
                    )}
                    {p.version > 0 && p.cambios_sin_publicar && (
                      <span className="badge text-bg-light border">Cambios sin publicar</span>
                    )}
                    {p.version > 0 && p.obligatoria && (
                      <span className="badge text-bg-light border">
                        <FaUsers className="me-1" />
                        {p.aceptaron}/{sociosActivos} aceptaron
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
            <div className="small text-muted mt-3 px-1">
              <strong>Formato:</strong> una línea que empieza con <code>#</code> es un subtítulo y con <code>-</code> es una
              viñeta. Puedes usar <code>{"{cooperativa}"}</code>, <code>{"{mora_tasa_anual}"}</code> y{" "}
              <code>{"{mora_dias_gracia}"}</code>: se llenan solos con los Parámetros vigentes.
            </div>
          </div>

          {actual && (
            <div className="col-12 col-lg-8">
              <div className="pol-card p-3 p-md-4">
                <div className="d-flex flex-wrap gap-2 align-items-center mb-3">
                  <input
                    className="form-control form-control-lg fw-bold flex-grow-1"
                    style={{ minWidth: 220 }}
                    value={form.titulo}
                    maxLength={150}
                    onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
                  />
                  <div className="btn-group">
                    <button className={`btn btn-sm ${modo === "editar" ? "btn-dark" : "btn-outline-dark"}`} onClick={() => setModo("editar")}>
                      <FaPen className="me-1" /> Editar
                    </button>
                    <button className={`btn btn-sm ${modo === "vista" ? "btn-dark" : "btn-outline-dark"}`} onClick={verVista}>
                      <FaEye className="me-1" /> Vista previa
                    </button>
                  </div>
                </div>

                {modo === "editar" ? (
                  <textarea
                    className="form-control"
                    style={{ minHeight: 420, fontFamily: "inherit", lineHeight: 1.55 }}
                    value={form.contenido}
                    onChange={(e) => setForm((f) => ({ ...f, contenido: e.target.value }))}
                    placeholder={"# Subtítulo\n- Primer punto\n- Segundo punto"}
                  />
                ) : (
                  <div className="p-3 rounded-3" style={{ border: "1px solid #e2e8f0", minHeight: 420 }}>
                    <TextoPolitica texto={vista} />
                  </div>
                )}

                <div className="form-check form-switch mt-3">
                  <input
                    id="pol-obligatoria"
                    className="form-check-input"
                    type="checkbox"
                    checked={form.obligatoria}
                    onChange={(e) => setForm((f) => ({ ...f, obligatoria: e.target.checked }))}
                  />
                  <label className="form-check-label small" htmlFor="pol-obligatoria">
                    Los socios deben aceptarla (si la desactivas, solo queda para consulta)
                  </label>
                </div>

                <div className="d-flex flex-wrap gap-2 mt-3">
                  <button className="btn btn-outline-dark" disabled={ocupado || !sinGuardar} onClick={guardar}>
                    <FaSave className="me-1" /> Guardar borrador
                  </button>
                  <button
                    className="btn fw-semibold"
                    style={{ background: "#16a34a", color: "#fff" }}
                    disabled={ocupado || (!sinGuardar && !actual.cambios_sin_publicar)}
                    onClick={() => setPublicar({ pedir: true })}
                  >
                    <FaCheckCircle className="me-1" /> {actual.version === 0 ? "Publicar" : "Publicar nueva versión"}
                  </button>
                  {actual.version > 0 && actual.obligatoria && (
                    <button className="btn btn-outline-secondary" onClick={verAceptaciones}>
                      <FaUsers className="me-1" /> Ver quién la aceptó
                    </button>
                  )}
                  <button className="btn btn-link text-danger ms-auto" onClick={retirar}>
                    <FaTrash className="me-1" /> Retirar
                  </button>
                </div>

                {aceptaciones && (
                  <div className="mt-4">
                    <h6 className="fw-bold">Socios activos</h6>
                    <div className="table-responsive" style={{ maxHeight: 320 }}>
                      <table className="table table-sm align-middle mb-0">
                        <thead>
                          <tr className="small text-muted">
                            <th>Socio</th>
                            <th>Identidad</th>
                            <th>Aceptó</th>
                          </tr>
                        </thead>
                        <tbody>
                          {aceptaciones.map((a) => (
                            <tr key={a.id_usuario}>
                              <td>{a.nombre_completo}</td>
                              <td className="small">{a.dni}</td>
                              <td className="small">
                                {a.aceptada ? (
                                  <span className="text-success">
                                    <FaCheckCircle className="me-1" />
                                    {fecha(a.aceptada_en)} (v{a.version})
                                  </span>
                                ) : (
                                  <span className="text-warning fw-semibold">Pendiente</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {publicar && actual && (
        <div className="modal show d-block" style={{ background: "rgba(0,0,0,.55)", zIndex: 5500, position: "fixed", inset: 0 }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg" style={{ borderRadius: 16 }}>
              <div className="modal-body p-4">
                <h5 className="fw-bold mb-2">
                  {actual.version === 0 ? "Publicar" : "Publicar nueva versión de"} “{form.titulo}”
                </h5>
                {actual.version === 0 ? (
                  <p className="text-muted mb-3">
                    Los socios activos recibirán un aviso y deberán leerla y aceptarla al entrar a la app. Los socios nuevos la
                    aceptan al registrarse.
                  </p>
                ) : (
                  <>
                    <p className="text-muted mb-2">¿Qué tipo de cambio es?</p>
                    {[
                      [true, "Cambio importante", "Los socios deberán leerla y aceptarla de nuevo."],
                      [false, "Cambio menor", "Corrección de redacción u ortografía: se publica sin pedir aceptarla otra vez."],
                    ].map(([valor, titulo, desc]) => (
                      <label
                        key={titulo}
                        className="d-flex gap-2 p-3 mb-2 rounded-3"
                        style={{ border: `1.5px solid ${publicar.pedir === valor ? "#16a34a" : "#e2e8f0"}`, cursor: "pointer" }}
                      >
                        <input type="radio" className="form-check-input mt-1" checked={publicar.pedir === valor} onChange={() => setPublicar({ pedir: valor })} />
                        <span>
                          <span className="fw-semibold d-block">{titulo}</span>
                          <span className="small text-muted">{desc}</span>
                        </span>
                      </label>
                    ))}
                  </>
                )}
                <div className="d-flex justify-content-end gap-2 mt-3">
                  <button className="btn btn-outline-secondary" onClick={() => setPublicar(null)}>
                    Cancelar
                  </button>
                  <button className="btn fw-semibold" style={{ background: "#16a34a", color: "#fff" }} disabled={ocupado} onClick={confirmarPublicacion}>
                    {ocupado ? "Publicando..." : "Publicar"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
