import { useEffect, useMemo, useState } from "react";
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const fmt = (n) =>
  `L. ${parseFloat(n || 0).toLocaleString("es-HN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

// Nueva liquidación: elegir actividad, tipo de reparto, ver quién recibe cuánto y confirmar
export default function NuevaLiquidacionModal({ token, onClose, onCreada, mostrarAlerta }) {
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const [actividades, setActividades] = useState(null);
  const [idActividad, setIdActividad] = useState("");
  const [tipoReparto, setTipoReparto] = useState("proporcional");
  const [aCuenta, setACuenta] = useState(true);
  const [descripcion, setDescripcion] = useState("");
  const [preview, setPreview] = useState(null);
  const [errorPreview, setErrorPreview] = useState("");
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    axios
      .get(`${API_URL}/liquidaciones/actividades-disponibles`, { headers })
      .then((r) => setActividades(r.data.data || []))
      .catch(() => setActividades([]));
  }, [headers]);

  useEffect(() => {
    setPreview(null);
    setErrorPreview("");
    if (!idActividad) return;
    let activo = true;
    setCargando(true);
    axios
      .get(`${API_URL}/liquidaciones/preview`, {
        headers,
        params: { id_actividad: idActividad, tipo_reparto: tipoReparto },
      })
      .then((r) => activo && setPreview(r.data))
      .catch((e) => activo && setErrorPreview(e.response?.data?.message || "No se pudo calcular el reparto."))
      .finally(() => activo && setCargando(false));
    return () => {
      activo = false;
    };
  }, [idActividad, tipoReparto, headers]);

  const confirmar = async () => {
    setGuardando(true);
    try {
      await axios.post(
        `${API_URL}/liquidaciones`,
        {
          id_actividad: parseInt(idActividad),
          tipo_reparto: tipoReparto,
          desembolsar_a_cuenta: aCuenta,
          descripcion: descripcion || undefined,
        },
        { headers }
      );
      mostrarAlerta("Liquidación registrada correctamente.", "success");
      onCreada();
    } catch (err) {
      mostrarAlerta(err.response?.data?.message || "No se pudo registrar la liquidación.", "error");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div
      className="modal show d-block"
      style={{ background: "rgba(0,0,0,.6)", zIndex: 1300, position: "fixed", inset: 0, overflowY: "auto" }}
    >
      <div className="modal-dialog modal-dialog-centered modal-lg">
        <div className="modal-content border-0 shadow-lg" style={{ borderRadius: 16 }}>
          <div className="modal-header border-0 pb-0">
            <h5 className="modal-title fw-bold">Nueva liquidación de utilidades</h5>
            <button type="button" className="btn-close" onClick={onClose} />
          </div>
          <div className="modal-body">
            {actividades && actividades.length === 0 ? (
              <div className="alert alert-info mb-0">
                No hay actividades pendientes de liquidar. Registra primero la actividad que generó la utilidad.
              </div>
            ) : (
              <>
                <div className="row g-3 mb-3">
                  <div className="col-12">
                    <label className="form-label fw-semibold small">Actividad a liquidar</label>
                    <select className="form-select" value={idActividad} onChange={(e) => setIdActividad(e.target.value)}>
                      <option value="">Selecciona una actividad...</option>
                      {(actividades || []).map((a) => (
                        <option key={a.id_actividad} value={a.id_actividad}>
                          {a.nombre} — {fmt(a.monto)} ({String(a.fecha).substring(0, 10)})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="col-12">
                    <label className="form-label fw-semibold small">¿Cómo se reparte?</label>
                    <div className="d-flex flex-column flex-md-row gap-2">
                      {[
                        ["proporcional", "Proporcional a las aportaciones", "Quien más ha aportado recibe una parte mayor"],
                        ["igualitario", "En partes iguales", "Todos los socios activos reciben lo mismo"],
                      ].map(([v, t, d]) => (
                        <label
                          key={v}
                          className="flex-fill p-2 rounded-3"
                          style={{
                            border: `1.5px solid ${tipoReparto === v ? "#a8cd3a" : "#e2e8f0"}`,
                            background: tipoReparto === v ? "#f7fbe8" : "#fff",
                            cursor: "pointer",
                          }}
                        >
                          <input type="radio" className="me-2" checked={tipoReparto === v} onChange={() => setTipoReparto(v)} />
                          <span className="fw-semibold">{t}</span>
                          <span className="d-block small text-muted ps-4">{d}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                {cargando && (
                  <div className="text-center py-3">
                    <div className="spinner-border spinner-border-sm text-success" />
                  </div>
                )}
                {errorPreview && <div className="alert alert-warning">{errorPreview}</div>}

                {preview && (
                  <>
                    <div className="d-flex flex-wrap justify-content-between align-items-center mb-2">
                      <div className="fw-semibold">
                        Vista previa: {preview.total_socios} socios · Total {fmt(preview.total_repartido)}
                      </div>
                      {preview.ya_liquidada && <span className="badge bg-danger">Esta actividad ya fue liquidada</span>}
                    </div>
                    <div className="table-responsive" style={{ maxHeight: 280, overflowY: "auto" }}>
                      <table className="table table-sm mb-0">
                        <thead>
                          <tr className="small text-muted">
                            <th>Socio</th>
                            <th className="text-end">Aportado</th>
                            <th className="text-end">Participación</th>
                            <th className="text-end">Recibe</th>
                          </tr>
                        </thead>
                        <tbody>
                          {preview.detalle.map((d) => (
                            <tr key={d.id_usuario}>
                              <td>{d.nombre_completo}</td>
                              <td className="text-end">{fmt(d.total_aportado)}</td>
                              <td className="text-end">{d.porcentaje}%</td>
                              <td className="text-end fw-semibold">{fmt(d.monto_recibido)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="form-check mt-3">
                      <input
                        id="chk-cuenta"
                        type="checkbox"
                        className="form-check-input"
                        checked={aCuenta}
                        onChange={(e) => setACuenta(e.target.checked)}
                      />
                      <label className="form-check-label" htmlFor="chk-cuenta">
                        Depositar de inmediato en la cuenta de Aportaciones de cada socio
                      </label>
                    </div>
                    <input
                      className="form-control mt-2"
                      placeholder="Descripción (opcional)"
                      maxLength={200}
                      value={descripcion}
                      onChange={(e) => setDescripcion(e.target.value)}
                    />
                  </>
                )}
              </>
            )}
          </div>
          <div className="modal-footer border-0 pt-0">
            <button className="btn btn-outline-secondary" onClick={onClose} disabled={guardando}>
              Cancelar
            </button>
            <button
              className="btn fw-semibold"
              style={{ background: "#a8cd3a", color: "#1a2a00" }}
              disabled={!preview || preview.ya_liquidada || guardando}
              onClick={confirmar}
            >
              {guardando ? "Registrando..." : "Confirmar liquidación"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
