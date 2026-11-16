// Comité de crédito: las solicitudes por encima del monto que aprueba el personal se deciden por
// votos de los miembros. El Super Administrador define el límite (Parámetros) y los miembros.
import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { FaGavel, FaThumbsUp, FaThumbsDown, FaUsers } from "react-icons/fa";
import { useAuth } from "../context/AuthContext";
import { useAlerta } from "../context/AlertaContext";
import { dinero } from "../utils/pais";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const AZUL = "#1a2035";
const ACCENT = "#a8cd3a";

const Tarjeta = ({ children }) => (
  <div className="card border-0 shadow-sm mb-3" style={{ borderRadius: 14 }}>
    <div className="card-body">{children}</div>
  </div>
);

export default function ComiteCredito() {
  const { token, user } = useAuth();
  const { mostrarAlerta } = useAlerta();
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const esSuper = user?.rol === "Super Administrador";
  const [info, setInfo] = useState(null);
  const [pendientes, setPendientes] = useState([]);
  const [personal, setPersonal] = useState([]);
  const [seleccion, setSeleccion] = useState({}); // id_usuario → cargo (o "" si está marcado)
  const [rechazando, setRechazando] = useState(null);
  const [motivo, setMotivo] = useState("");
  const error = (e, msg) => mostrarAlerta(e.response?.data?.message || msg, "error");

  const cargar = useCallback(() => {
    axios
      .get(`${API_URL}/comite`, { headers })
      .then((r) => {
        setInfo(r.data.data);
        setSeleccion(Object.fromEntries(r.data.data.miembros.map((m) => [m.id_usuario, m.cargo || ""])));
      })
      .catch((e) => error(e, "No se pudo leer el comité."));
    axios.get(`${API_URL}/comite/pendientes`, { headers }).then((r) => setPendientes(r.data.data || [])).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headers]);
  useEffect(() => {
    cargar();
    if (esSuper) axios.get(`${API_URL}/comite/personal`, { headers }).then((r) => setPersonal(r.data.data || [])).catch(() => {});
  }, [cargar, esSuper, headers]);

  const votar = async (p, voto, comentario) => {
    try {
      const r = await axios.post(`${API_URL}/comite/prestamos/${p.id_prestamo}/votar`, { voto, comentario }, { headers });
      mostrarAlerta(r.data.message, "success");
      setRechazando(null);
      setMotivo("");
      cargar();
    } catch (e) {
      error(e, "No se pudo registrar el voto.");
    }
  };

  const guardarMiembros = async () => {
    try {
      const miembros = Object.entries(seleccion).map(([id, cargo]) => ({ id_usuario: parseInt(id), cargo }));
      await axios.put(`${API_URL}/comite/miembros`, { miembros }, { headers });
      mostrarAlerta("Comité guardado.", "success");
      cargar();
    } catch (e) {
      error(e, "No se pudo guardar el comité.");
    }
  };

  const tasa = (p) => (p.tipo_tasa === "nominal_mensual" ? `${parseFloat(p.tasa_original)}% mensual` : `${parseFloat(p.tasa_interes)}% anual`);

  return (
    <div className="container-fluid py-3">
      <div className="d-flex align-items-center gap-3 mb-3">
        <div className="d-flex align-items-center justify-content-center" style={{ width: 48, height: 48, borderRadius: 12, background: AZUL, color: ACCENT }}>
          <FaGavel size={20} />
        </div>
        <div>
          <h4 className="fw-bold mb-0" style={{ color: AZUL }}>Comité de crédito</h4>
          <div className="text-muted small">Aprobación de préstamos por niveles de monto</div>
        </div>
      </div>

      {info && !info.activo && (
        <div className="alert alert-info small">
          El comité no está activo: el personal aprueba los préstamos de cualquier monto. Para activarlo, el Super
          Administrador indica en <em>Parámetros</em> el monto máximo que aprueba el personal.
        </div>
      )}
      {info?.activo && (
        <div className="alert alert-light border small">
          El personal aprueba préstamos de hasta <strong>{dinero(info.limite)}</strong>. Por encima, se necesitan{" "}
          <strong>{info.votos_requeridos}</strong> voto(s) a favor del comité (con el mismo número en contra, se rechaza).
          {!info.soy_miembro && " No eres miembro del comité: puedes ver las solicitudes, pero no votar."}
        </div>
      )}

      {info?.activo && (
        <Tarjeta>
          <h6 className="fw-bold mb-3" style={{ color: AZUL }}>Solicitudes en espera del comité</h6>
          {!pendientes.length ? (
            <div className="text-muted small">No hay solicitudes pendientes por encima del límite.</div>
          ) : (
            <div className="table-responsive">
              <table className="table table-sm align-middle">
                <thead className="table-light">
                  <tr>
                    <th>#</th>
                    <th>Socio</th>
                    <th className="text-end">Monto</th>
                    <th>Condiciones</th>
                    <th>Votos</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {pendientes.map((p) => (
                    <tr key={p.id_prestamo}>
                      <td>{p.id_prestamo}</td>
                      <td>
                        <div className="fw-semibold">{p.nombre_completo}</div>
                        {p.numero_socio && <div className="small text-muted">N.º {p.numero_socio}</div>}
                      </td>
                      <td className="text-end text-nowrap">{dinero(p.monto)}</td>
                      <td className="small">{p.plazo_meses} meses · {tasa(p)}</td>
                      <td className="small">
                        <span className="text-success fw-semibold">{p.comite.a_favor}</span> a favor ·{" "}
                        <span className="text-danger fw-semibold">{p.comite.en_contra}</span> en contra · de {p.comite.requeridos}
                        {p.comite.votos.map((v) => (
                          <div key={v.id_usuario} className="text-muted">
                            {v.voto === "aprobar" ? "✔" : "✖"} {v.nombre_completo}
                            {v.comentario && `: ${v.comentario}`}
                          </div>
                        ))}
                      </td>
                      <td className="text-nowrap text-end">
                        {info.soy_miembro && (
                          <>
                            <button
                              className={`btn btn-sm me-1 ${p.mi_voto === "aprobar" ? "btn-success" : "btn-outline-success"}`}
                              title="Votar a favor"
                              onClick={() => votar(p, "aprobar")}
                            >
                              <FaThumbsUp />
                            </button>
                            <button
                              className={`btn btn-sm ${p.mi_voto === "rechazar" ? "btn-danger" : "btn-outline-danger"}`}
                              title="Votar en contra"
                              onClick={() => setRechazando(p)}
                            >
                              <FaThumbsDown />
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Tarjeta>
      )}

      <Tarjeta>
        <h6 className="fw-bold mb-3" style={{ color: AZUL }}>
          <FaUsers className="me-2" />
          Miembros del comité
        </h6>
        {!esSuper ? (
          info?.miembros.length ? (
            <ul className="small mb-0">
              {info.miembros.map((m) => (
                <li key={m.id_usuario}>
                  {m.nombre_completo} {m.cargo && <span className="text-muted">({m.cargo})</span>}
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-muted small">Sin miembros.</div>
          )
        ) : (
          <>
            <div className="row g-2">
              {personal.map((u) => {
                const marcado = u.id_usuario in seleccion;
                return (
                  <div className="col-12 col-md-6" key={u.id_usuario}>
                    <div className="d-flex align-items-center gap-2">
                      <input
                        type="checkbox"
                        className="form-check-input mt-0"
                        id={`m${u.id_usuario}`}
                        checked={marcado}
                        onChange={(e) => {
                          const n = { ...seleccion };
                          if (e.target.checked) n[u.id_usuario] = "";
                          else delete n[u.id_usuario];
                          setSeleccion(n);
                        }}
                      />
                      <label htmlFor={`m${u.id_usuario}`} className="small flex-grow-1">
                        {u.nombre_completo} <span className="text-muted">· {u.rol}</span>
                      </label>
                      {marcado && (
                        <input
                          className="form-control form-control-sm"
                          style={{ maxWidth: 160 }}
                          placeholder="Cargo (opcional)"
                          maxLength={60}
                          value={seleccion[u.id_usuario]}
                          onChange={(e) => setSeleccion({ ...seleccion, [u.id_usuario]: e.target.value })}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <button className="btn btn-sm btn-primary mt-3" onClick={guardarMiembros}>
              Guardar miembros
            </button>
          </>
        )}
      </Tarjeta>

      {rechazando && (
        <div className="modal d-block" style={{ background: "rgba(0,0,0,.4)" }} onClick={() => setRechazando(null)}>
          <div className="modal-dialog modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content" style={{ borderRadius: 14 }}>
              <div className="modal-header">
                <h5 className="modal-title">Votar en contra</h5>
                <button className="btn-close" onClick={() => setRechazando(null)} />
              </div>
              <div className="modal-body">
                <p className="small">
                  Préstamo #{rechazando.id_prestamo} de {rechazando.nombre_completo} por {dinero(rechazando.monto)}
                </p>
                <label className="form-label small">Motivo</label>
                <textarea className="form-control" rows={3} maxLength={500} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
              </div>
              <div className="modal-footer">
                <button className="btn btn-light" onClick={() => setRechazando(null)}>Cancelar</button>
                <button className="btn btn-danger" disabled={!motivo.trim()} onClick={() => votar(rechazando, "rechazar", motivo)}>
                  Votar en contra
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
