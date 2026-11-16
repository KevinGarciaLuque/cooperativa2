// Mi turno de caja: abrir con un fondo inicial, ver lo que va entrando y saliendo en efectivo y
// cerrar contando el dinero. Debajo, los turnos del día de todos los cajeros y (Super
// Administrador) las sucursales.
import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { FaUserClock, FaStore, FaPlus } from "react-icons/fa";
import InputMonto from "../ui/InputMonto";
import { dinero } from "../utils/pais";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const AZUL = "#1a2035";
const hora = (v) => (v ? String(v).replace("T", " ").substring(11, 16) : "");

export default function TurnoCaja({ headers, fecha, esSuper, mostrarAlerta, onCambio }) {
  const [turno, setTurno] = useState(undefined);
  const [extra, setExtra] = useState({});
  const [sucursales, setSucursales] = useState([]);
  const [turnos, setTurnos] = useState([]);
  const [apertura, setApertura] = useState({ id_sucursal: "", fondo_inicial: "" });
  const [cierre, setCierre] = useState({ efectivo_contado: "", observacion: "" });
  const [cerrando, setCerrando] = useState(false);
  const [nuevaSucursal, setNuevaSucursal] = useState("");
  const error = (e, msg) => mostrarAlerta(e.response?.data?.message || msg, "error");

  const cargar = useCallback(() => {
    axios
      .get(`${API_URL}/caja/turno`, { headers })
      .then((r) => {
        setTurno(r.data.data);
        setExtra({ exigir: r.data.exigir_turno, habitual: r.data.id_sucursal_habitual });
      })
      .catch(() => setTurno(null));
    axios.get(`${API_URL}/caja/sucursales`, { headers }).then((r) => setSucursales(r.data.data || [])).catch(() => {});
    axios.get(`${API_URL}/caja/turnos`, { headers, params: { fecha } }).then((r) => setTurnos(r.data.data || [])).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headers?.Authorization, fecha]);
  useEffect(() => {
    cargar();
  }, [cargar]);

  const activas = sucursales.filter((s) => s.activa);
  const sucursalElegida = apertura.id_sucursal || extra.habitual || activas[0]?.id_sucursal || "";

  const abrir = async () => {
    try {
      await axios.post(`${API_URL}/caja/turno/abrir`, { id_sucursal: sucursalElegida, fondo_inicial: apertura.fondo_inicial || 0 }, { headers });
      mostrarAlerta("Turno abierto.", "success");
      setApertura({ id_sucursal: "", fondo_inicial: "" });
      cargar();
      onCambio?.();
    } catch (e) {
      error(e, "No se pudo abrir el turno.");
    }
  };

  const cerrar = async () => {
    try {
      const r = await axios.post(`${API_URL}/caja/turno/cerrar`, cierre, { headers });
      mostrarAlerta(`Turno cerrado. Diferencia: ${dinero(r.data.diferencia)}`, Math.abs(r.data.diferencia) > 0.005 ? "warning" : "success");
      setCierre({ efectivo_contado: "", observacion: "" });
      setCerrando(false);
      cargar();
      onCambio?.();
    } catch (e) {
      error(e, "No se pudo cerrar el turno.");
    }
  };

  const crearSucursal = async () => {
    try {
      await axios.post(`${API_URL}/caja/sucursales`, { nombre: nuevaSucursal }, { headers });
      setNuevaSucursal("");
      cargar();
    } catch (e) {
      error(e, "No se pudo crear la sucursal.");
    }
  };
  const alternarSucursal = async (s) => {
    try {
      await axios.put(`${API_URL}/caja/sucursales/${s.id_sucursal}`, { ...s, activa: !s.activa }, { headers });
      cargar();
    } catch (e) {
      error(e, "No se pudo actualizar la sucursal.");
    }
  };

  if (turno === undefined) return null;
  const diferencia = cierre.efectivo_contado !== "" && turno ? parseFloat(cierre.efectivo_contado) - turno.efectivo_esperado : null;

  return (
    <div className="card border-0 shadow-sm mb-4" style={{ borderRadius: 14 }}>
      <div className="card-body">
        <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-2">
          <h6 className="fw-bold mb-0" style={{ color: AZUL }}>
            <FaUserClock className="me-2" />
            Mi turno
          </h6>
          {extra.exigir && !turno && <span className="badge bg-warning text-dark">Necesitas un turno abierto para operar en efectivo</span>}
        </div>

        {!turno ? (
          <div className="row g-2 align-items-end">
            <div className="col-12 col-md-4">
              <label className="form-label small mb-1">Sucursal</label>
              <select className="form-select form-select-sm" value={sucursalElegida} onChange={(e) => setApertura({ ...apertura, id_sucursal: e.target.value })}>
                {activas.map((s) => (
                  <option key={s.id_sucursal} value={s.id_sucursal}>{s.nombre}</option>
                ))}
              </select>
            </div>
            <div className="col-7 col-md-4">
              <label className="form-label small mb-1">Fondo inicial (efectivo recibido)</label>
              <InputMonto className="form-control form-control-sm" value={apertura.fondo_inicial} onChange={(v) => setApertura({ ...apertura, fondo_inicial: v })} />
            </div>
            <div className="col-5 col-md-4">
              <button className="btn btn-sm btn-success w-100" onClick={abrir} disabled={!sucursalElegida}>
                Abrir turno
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="row g-2 small">
              <div className="col-6 col-md-2"><div className="text-muted">Sucursal</div><strong>{turno.sucursal}</strong></div>
              <div className="col-6 col-md-2"><div className="text-muted">Desde</div><strong>{hora(turno.abierto_en)}</strong></div>
              <div className="col-6 col-md-2"><div className="text-muted">Fondo inicial</div><strong>{dinero(turno.fondo_inicial)}</strong></div>
              <div className="col-6 col-md-2"><div className="text-muted">Entradas en efectivo</div><strong className="text-success">{dinero(turno.ingresos_efectivo)}</strong></div>
              <div className="col-6 col-md-2"><div className="text-muted">Salidas en efectivo</div><strong className="text-danger">{dinero(turno.egresos_efectivo)}</strong></div>
              <div className="col-6 col-md-2"><div className="text-muted">Debe haber</div><strong>{dinero(turno.efectivo_esperado)}</strong></div>
            </div>
            {!cerrando ? (
              <button className="btn btn-sm btn-outline-primary mt-3" onClick={() => setCerrando(true)}>
                Cerrar turno
              </button>
            ) : (
              <div className="row g-2 align-items-end mt-2">
                <div className="col-12 col-md-3">
                  <label className="form-label small mb-1">Efectivo contado</label>
                  <InputMonto className="form-control form-control-sm" value={cierre.efectivo_contado} onChange={(v) => setCierre({ ...cierre, efectivo_contado: v })} />
                </div>
                <div className="col-12 col-md-5">
                  <label className="form-label small mb-1">
                    Observación{diferencia !== null && Math.abs(diferencia) > 0.005 && <span className="text-danger"> (diferencia de {dinero(diferencia)})</span>}
                  </label>
                  <input className="form-control form-control-sm" maxLength={255} value={cierre.observacion} onChange={(e) => setCierre({ ...cierre, observacion: e.target.value })} />
                </div>
                <div className="col-6 col-md-2">
                  <button className="btn btn-sm btn-primary w-100" onClick={cerrar} disabled={cierre.efectivo_contado === ""}>Cerrar</button>
                </div>
                <div className="col-6 col-md-2">
                  <button className="btn btn-sm btn-light w-100" onClick={() => setCerrando(false)}>Cancelar</button>
                </div>
              </div>
            )}
          </>
        )}

        {turnos.length > 0 && (
          <div className="table-responsive mt-3">
            <div className="small fw-semibold mb-1">Turnos del día</div>
            <table className="table table-sm small align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th>Cajero</th><th>Sucursal</th><th>Horario</th>
                  <th className="text-end">Fondo</th><th className="text-end">Esperado</th><th className="text-end">Contado</th><th className="text-end">Diferencia</th>
                </tr>
              </thead>
              <tbody>
                {turnos.map((t) => (
                  <tr key={t.id_turno}>
                    <td>{t.cajero}</td>
                    <td>{t.sucursal}</td>
                    <td className="text-nowrap">{hora(t.abierto_en)} – {t.estado === "abierto" ? <span className="badge bg-success">abierto</span> : hora(t.cerrado_en)}</td>
                    <td className="text-end">{dinero(t.fondo_inicial)}</td>
                    <td className="text-end">{dinero(t.efectivo_esperado)}</td>
                    <td className="text-end">{t.efectivo_contado != null ? dinero(t.efectivo_contado) : "—"}</td>
                    <td className={`text-end ${Math.abs(parseFloat(t.diferencia || 0)) > 0.005 ? "text-danger fw-semibold" : ""}`} title={t.observacion || ""}>
                      {t.diferencia != null ? dinero(t.diferencia) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {esSuper && (
          <details className="mt-3">
            <summary className="small fw-semibold" style={{ cursor: "pointer" }}>
              <FaStore className="me-1" /> Sucursales
            </summary>
            <div className="mt-2">
              {sucursales.map((s) => (
                <div key={s.id_sucursal} className="d-flex align-items-center gap-2 small mb-1">
                  <span className={s.activa ? "" : "text-muted text-decoration-line-through"}>{s.nombre}</span>
                  <button className="btn btn-link btn-sm p-0" onClick={() => alternarSucursal(s)}>
                    {s.activa ? "desactivar" : "activar"}
                  </button>
                </div>
              ))}
              <div className="d-flex gap-2 mt-2" style={{ maxWidth: 380 }}>
                <input className="form-control form-control-sm" placeholder="Nueva sucursal" maxLength={100} value={nuevaSucursal} onChange={(e) => setNuevaSucursal(e.target.value)} />
                <button className="btn btn-sm btn-outline-primary" onClick={crearSucursal} disabled={!nuevaSucursal.trim()}>
                  <FaPlus />
                </button>
              </div>
            </div>
          </details>
        )}
      </div>
    </div>
  );
}
