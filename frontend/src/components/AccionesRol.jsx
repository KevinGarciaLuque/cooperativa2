// Control de Accesos → acciones del rol (función "permisos_por_accion"): qué puede hacer dentro
// de sus módulos (aprobar, desembolsar, anular...), si es de solo lectura, y crear los roles
// recomendados para una cooperativa.
import { useEffect, useState } from "react";
import axios from "axios";
import { FaUserCheck, FaSave, FaMagic } from "react-icons/fa";
import { useFunciones } from "../hooks/useFunciones";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export default function AccionesRol({ token, rol, mostrarAlerta, onRolesCreados }) {
  const { permisos_por_accion: habilitada } = useFunciones();
  const [catalogo, setCatalogo] = useState([]);
  const [datos, setDatos] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    if (!habilitada) return;
    axios.get(`${API_URL}/permisos/acciones/catalogo`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => setCatalogo(r.data.data || [])).catch(() => {});
  }, [habilitada, token]);
  useEffect(() => {
    setDatos(null);
    if (!habilitada || !rol?.id_rol || ["Super Administrador", "Socio"].includes(rol.nombre)) return;
    axios.get(`${API_URL}/permisos/${rol.id_rol}/acciones`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => setDatos(r.data)).catch(() => {});
  }, [habilitada, rol?.id_rol, rol?.nombre, token]);

  if (!habilitada) return null;

  const crearRecomendados = async () => {
    if (!window.confirm("¿Crear los roles recomendados (Gerente General, Jefe de Agencia, Cajero, Asesor de Crédito, Gestor de Cobranza, Oficial de Cumplimiento, Atención al Socio y Auditor) con sus permisos?")) return;
    try {
      const r = await axios.post(`${API_URL}/permisos/roles-recomendados`, {}, { headers });
      mostrarAlerta(r.data.message, "success");
      onRolesCreados?.();
    } catch (e) {
      mostrarAlerta(e.response?.data?.message || "No se pudieron crear los roles.", "error");
    }
  };
  const guardar = async () => {
    setGuardando(true);
    try {
      const r = await axios.put(`${API_URL}/permisos/${rol.id_rol}/acciones`, datos, { headers });
      mostrarAlerta(r.data.message, "success");
    } catch (e) {
      mostrarAlerta(e.response?.data?.message || "No se pudieron guardar los permisos.", "error");
    } finally {
      setGuardando(false);
    }
  };
  const grupos = [...new Set(catalogo.map((a) => a.grupo))];

  return (
    <div className="card border-0 shadow-sm mt-4" style={{ borderRadius: 16 }}>
      <div className="card-header border-0 py-3 px-4 d-flex align-items-center justify-content-between flex-wrap gap-2"
        style={{ background: "linear-gradient(135deg, #1a2035 0%, #2d3a5a 100%)", borderRadius: "16px 16px 0 0" }}>
        <div className="d-flex align-items-center gap-2">
          <FaUserCheck style={{ color: "#a8cd3a", fontSize: 18 }} />
          <span className="fw-semibold text-white" style={{ fontSize: 15 }}>
            Acciones del rol {rol?.nombre && <span style={{ color: "#a8cd3a" }}>{rol.nombre}</span>}
          </span>
        </div>
        <button className="btn btn-sm btn-light" onClick={crearRecomendados}>
          <FaMagic className="me-1" /> Crear roles recomendados
        </button>
      </div>
      <div className="card-body p-4">
        {!rol || ["Super Administrador", "Socio"].includes(rol.nombre) ? (
          <div className="text-muted small">Elige un rol del personal para ver qué acciones puede hacer dentro de sus módulos.</div>
        ) : !datos ? (
          <div className="spinner-border spinner-border-sm text-success" />
        ) : (
          <>
            <div className="form-check form-switch mb-3">
              <input id="solo-lectura" type="checkbox" className="form-check-input" checked={!!datos.solo_lectura}
                onChange={(e) => setDatos({ ...datos, solo_lectura: e.target.checked })} />
              <label htmlFor="solo-lectura" className="form-check-label fw-semibold">
                Solo lectura <span className="fw-normal text-muted small">(auditor, junta de vigilancia: consulta todo y no cambia nada)</span>
              </label>
            </div>
            <div className="row g-3" style={{ opacity: datos.solo_lectura ? 0.45 : 1 }}>
              {grupos.map((g) => (
                <div className="col-12 col-md-6 col-xl-4" key={g}>
                  <div className="fw-semibold small mb-1">{g}</div>
                  {catalogo.filter((a) => a.grupo === g).map((a) => {
                    const valor = datos.acciones[a.clave];
                    const conMonto = (datos.con_monto || []).includes(a.clave);
                    return (
                      <div className="mb-2" key={a.clave}>
                        <div className="small">{a.nombre}</div>
                        <div className="d-flex gap-2 align-items-center flex-wrap">
                          <select
                            className="form-select form-select-sm"
                            style={{ width: 170 }}
                            disabled={datos.solo_lectura}
                            value={valor === "autorizar" ? "autorizar" : valor ? "si" : "no"}
                            onChange={(e) =>
                              setDatos({
                                ...datos,
                                acciones: { ...datos.acciones, [a.clave]: e.target.value === "autorizar" ? "autorizar" : e.target.value === "si" },
                              })
                            }
                          >
                            <option value="si">Puede</option>
                            {a.clave !== "autorizaciones.resolver" && <option value="autorizar">Con autorización</option>}
                            <option value="no">No puede</option>
                          </select>
                          {conMonto && valor === true && (
                            <div className="input-group input-group-sm" style={{ width: 170 }} title="Por encima de este monto pide autorización. Vacío = sin límite.">
                              <span className="input-group-text">hasta</span>
                              <input
                                type="number" min="0" step="0.01" className="form-control" placeholder="sin límite"
                                disabled={datos.solo_lectura}
                                value={datos.limites?.[a.clave] ?? ""}
                                onChange={(e) => setDatos({ ...datos, limites: { ...(datos.limites || {}), [a.clave]: e.target.value } })}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
            <div className="small text-muted mt-3">
              Estas acciones se aplican dentro de los módulos que el rol tiene arriba. <strong>Con autorización</strong>: la operación
              queda pendiente hasta que un superior la autoriza en Autorizaciones. <strong>Hasta</strong>: por encima de ese monto
              también pide autorización. Autorizan el Administrador y los roles con "Autorizar operaciones de otros". El Super
              Administrador siempre puede todo.
            </div>
            <button className="btn btn-primary mt-3" onClick={guardar} disabled={guardando}>
              <FaSave className="me-2" /> {guardando ? "Guardando..." : "Guardar acciones"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
