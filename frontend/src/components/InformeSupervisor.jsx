// Informe al supervisor: indicadores financieros con semáforo (morosidad, cobertura, liquidez,
// solvencia, rentabilidad, concentración), la cartera por categoría y los mayores deudores.
// Se baja en Excel para entregarlo a INACOP / INGECOP u otro supervisor.
import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { FaFileExcel, FaSyncAlt, FaCheckCircle, FaExclamationTriangle, FaTimesCircle, FaMinusCircle } from "react-icons/fa";
import { dinero } from "../utils/pais";
import { hoyLocal } from "../utils/fechas";
import { bajarArchivo, mensajeBlob } from "./DocumentosCredito";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const ESTADOS = {
  bien: { texto: "Cumple", color: "#15803d", fondo: "#dcfce7", borde: "#86efac", Icono: FaCheckCircle },
  atencion: { texto: "En observación", color: "#b45309", fondo: "#fef3c7", borde: "#fcd34d", Icono: FaExclamationTriangle },
  mal: { texto: "No cumple", color: "#b91c1c", fondo: "#fee2e2", borde: "#fca5a5", Icono: FaTimesCircle },
  sin_dato: { texto: "Referencia", color: "#475569", fondo: "#f1f5f9", borde: "#e2e8f0", Icono: FaMinusCircle },
};

const valor = (v) => (v === null || v === undefined ? "—" : `${v.toFixed(2)}%`);
const monto = (v) => (v === null || v === undefined ? "—" : dinero(v));

export default function InformeSupervisor({ token, onError }) {
  const [hasta, setHasta] = useState(hoyLocal());
  const [d, setD] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [bajando, setBajando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const r = await axios.get(`${API_URL}/supervisor/indicadores`, { headers: { Authorization: `Bearer ${token}` }, params: { hasta } });
      setD(r.data);
    } catch (e) {
      onError?.(e.response?.data?.message || "No se pudieron calcular los indicadores.");
    }
    setCargando(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, hasta]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const exportar = async () => {
    setBajando(true);
    try {
      await bajarArchivo(`${API_URL}/supervisor/exportar?hasta=${hasta}`, token, `informe_supervisor_${hasta}.xlsx`);
    } catch (e) {
      onError?.(await mensajeBlob(e, "No se pudo generar el informe."));
    }
    setBajando(false);
  };

  const c = d?.cifras;
  return (
    <div style={{ opacity: cargando ? 0.55 : 1, transition: "opacity .15s" }}>
      <div className="d-flex flex-wrap align-items-end justify-content-between gap-2 mb-3">
        <div>
          <div className="fw-bold" style={{ color: "#1a2035" }}>Informe al supervisor</div>
          <div className="text-muted small">Indicadores con la meta de la cooperativa; las metas se cambian en Parámetros.</div>
        </div>
        <div className="d-flex align-items-end gap-2">
          <div>
            <label className="form-label small mb-1">Fecha de corte</label>
            <input type="date" className="form-control form-control-sm" value={hasta} max={hoyLocal()} onChange={(e) => setHasta(e.target.value)} />
          </div>
          <button className="btn btn-sm btn-outline-secondary" onClick={cargar} title="Actualizar">
            <FaSyncAlt />
          </button>
          <button className="btn btn-sm btn-success" onClick={exportar} disabled={bajando || !d}>
            <FaFileExcel className="me-1" /> {bajando ? "Generando…" : "Informe en Excel"}
          </button>
        </div>
      </div>

      {d?.aviso && <div className="alert alert-warning small py-2">{d.aviso}</div>}

      {d && (
        <>
          <div className="row g-3 mb-4">
            {d.indicadores.map((i) => {
              // Sin dato con meta: no hay con qué calcularlo (por ejemplo, ninguna cuota atrasada)
              const e = i.estado === "sin_dato" && i.meta !== null ? { ...ESTADOS.sin_dato, texto: "Sin dato" } : ESTADOS[i.estado] || ESTADOS.sin_dato;
              return (
                <div className="col-12 col-sm-6 col-xl-4" key={i.clave}>
                  <div className="h-100 rounded-4 p-3 bg-white shadow-sm" style={{ borderLeft: `5px solid ${e.borde}` }}>
                    <div className="d-flex justify-content-between align-items-start gap-2">
                      <div className="small fw-semibold" style={{ color: "#475569" }}>{i.nombre}</div>
                      <span className="badge rounded-pill d-inline-flex align-items-center gap-1" style={{ background: e.fondo, color: e.color }}>
                        <e.Icono /> {e.texto}
                      </span>
                    </div>
                    <div className="fw-bold mt-1" style={{ fontSize: "1.7rem", color: e.color === "#475569" ? "#1a2035" : e.color }}>
                      {valor(i.valor)}
                    </div>
                    {i.regla && <div className="small" style={{ color: "#334155" }}>Meta: {i.regla}</div>}
                    {i.valor === null && i.clave === "cobertura" && (
                      <div className="small text-muted">No hay cartera con ese atraso: no hay nada que cubrir.</div>
                    )}
                    <div className="text-muted" style={{ fontSize: ".76rem" }}>{i.formula}</div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="row g-3">
            <div className="col-lg-5">
              <div className="bg-white rounded-4 shadow-sm p-3 h-100">
                <div className="fw-bold mb-2" style={{ color: "#1a2035" }}>Cifras del informe</div>
                <table className="table table-sm mb-0 small">
                  <tbody>
                    {[
                      ["Cartera total", monto(c.cartera_total)],
                      ["Cartera con atraso", monto(c.cartera_con_atraso)],
                      ["Provisión requerida", monto(c.provision_requerida)],
                      ["Provisión registrada", monto(c.provision_contable)],
                      ["Caja y bancos", monto(c.disponibilidades)],
                      ["Depósitos de socios", monto(c.depositos_socios)],
                      ["Activo total", monto(c.activo_total)],
                      ["Patrimonio", monto(c.patrimonio)],
                      ["Excedente del año", monto(c.excedente_anio)],
                      ["Socios activos", c.socios_activos],
                      ["Socios con préstamo", c.socios_con_prestamo],
                    ].map(([k, v]) => (
                      <tr key={k}>
                        <td className="text-muted">{k}</td>
                        <td className="text-end fw-semibold">{v}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="text-muted mt-2" style={{ fontSize: ".75rem" }}>
                  Fuente: {d.fuente === "contabilidad" ? "saldos de la contabilidad" : "datos de la operación (aproximado)"} al {d.fecha}.
                </div>
              </div>
            </div>
            <div className="col-lg-7">
              <div className="bg-white rounded-4 shadow-sm p-3 mb-3">
                <div className="fw-bold mb-2" style={{ color: "#1a2035" }}>Cartera por categoría y provisión</div>
                <div className="table-responsive">
                  <table className="table table-sm mb-0 small align-middle">
                    <thead>
                      <tr className="text-muted">
                        <th>Categoría</th>
                        <th className="text-end">Préstamos</th>
                        <th className="text-end">Saldo</th>
                        <th className="text-end">% prov.</th>
                        <th className="text-end">Provisión</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.cartera_por_categoria.map((k) => (
                        <tr key={k.categoria}>
                          <td>{k.nombre}</td>
                          <td className="text-end">{k.cantidad}</td>
                          <td className="text-end">{dinero(k.saldo)}</td>
                          <td className="text-end">{k.porcentaje_provision}%</td>
                          <td className="text-end">{dinero(k.provision)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="bg-white rounded-4 shadow-sm p-3">
                <div className="fw-bold mb-2" style={{ color: "#1a2035" }}>Los 10 mayores deudores</div>
                {d.mayores_deudores.length === 0 ? (
                  <div className="text-muted small">No hay préstamos vigentes.</div>
                ) : (
                  <div className="table-responsive">
                    <table className="table table-sm mb-0 small">
                      <tbody>
                        {d.mayores_deudores.map((m, i) => (
                          <tr key={`${m.dni}-${i}`}>
                            <td className="text-muted" style={{ width: 28 }}>{i + 1}</td>
                            <td>{m.socio}</td>
                            <td className="text-muted">{m.prestamos} {m.prestamos === 1 ? "préstamo" : "préstamos"}</td>
                            <td className="text-end fw-semibold">{dinero(m.saldo)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
