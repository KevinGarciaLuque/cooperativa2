// Reportes para la IVE: transacciones en efectivo (individuales sobre el umbral y múltiples del
// mismo día que juntas lo alcanzan) y transacciones sospechosas (alertas marcadas como
// reportadas). Se ven en pantalla y se bajan en Excel con los datos del socio.
import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { FaFileExcel, FaPlay } from "react-icons/fa";
import { dinero } from "../utils/pais";
import { hoyLocal } from "../utils/fechas";
import { bajarArchivo, mensajeBlob } from "./DocumentosCredito";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const fechaHora = (v) => (v ? String(v).replace("T", " ").substring(0, 16) : "");

export default function ReportesIve({ modo, token, onError }) {
  const hoy = hoyLocal();
  const [rango, setRango] = useState({ desde: `${hoy.substring(0, 7)}-01`, hasta: hoy });
  const [d, setD] = useState(null);
  const [cargando, setCargando] = useState(false);
  const ruta = modo === "efectivo" ? "efectivo" : "sospechosas";

  const ver = useCallback(async () => {
    setCargando(true);
    try {
      const r = await axios.get(`${API_URL}/cumplimiento/ive/${ruta}`, { headers: { Authorization: `Bearer ${token}` }, params: rango });
      setD(r.data);
    } catch (e) {
      onError?.(e.response?.data?.message || "No se pudo generar el reporte.");
    }
    setCargando(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, ruta, rango]);

  useEffect(() => {
    setD(null);
    ver();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ruta]);

  const exportar = async () => {
    try {
      await bajarArchivo(
        `${API_URL}/cumplimiento/ive/${ruta}/exportar?desde=${rango.desde}&hasta=${rango.hasta}`,
        token,
        `ive_${ruta}_${rango.desde}_${rango.hasta}.xlsx`
      );
    } catch (e) {
      onError?.(await mensajeBlob(e, "No se pudo exportar."));
    }
  };

  return (
    <div className="card border-0 shadow-sm" style={{ borderRadius: 14 }}>
      <div className="card-body">
        <div className="small text-muted mb-3">
          {modo === "efectivo" ? (
            <>
              Movimientos en efectivo iguales o mayores al umbral{d ? <> de <strong>{dinero(d.umbral)}</strong></> : ""}, y las
              transacciones <strong>múltiples</strong>: varios movimientos más pequeños del mismo socio en un mismo día que juntos lo
              alcanzan. El Excel lleva los datos del socio que pide el formulario.
            </>
          ) : (
            <>
              Alertas que el oficial de cumplimiento marcó como <strong>reportadas</strong>, con su análisis y los datos del socio.
              Información reservada: no se le comunica al socio.
            </>
          )}
        </div>
        <div className="row g-2 align-items-end mb-3">
          <div className="col-6 col-md-3">
            <label className="form-label small mb-1">Desde</label>
            <input type="date" className="form-control form-control-sm" value={rango.desde} onChange={(e) => setRango({ ...rango, desde: e.target.value })} />
          </div>
          <div className="col-6 col-md-3">
            <label className="form-label small mb-1">Hasta</label>
            <input type="date" className="form-control form-control-sm" value={rango.hasta} onChange={(e) => setRango({ ...rango, hasta: e.target.value })} />
          </div>
          <div className="col-auto">
            <button className="btn btn-sm btn-primary" onClick={ver} disabled={cargando}>
              <FaPlay className="me-1" /> Ver
            </button>
          </div>
          <div className="col-auto">
            <button className="btn btn-sm btn-outline-success" onClick={exportar} disabled={!d}>
              <FaFileExcel className="me-1" /> Excel para la IVE
            </button>
          </div>
        </div>

        {cargando && !d && <div className="text-center py-4"><div className="spinner-border spinner-border-sm" /></div>}

        {d && modo === "efectivo" && (
          <>
            <div className="fw-semibold small mb-1">Individuales ({d.individuales.length})</div>
            {d.individuales.length === 0 ? (
              <div className="text-muted small mb-3">Ningún movimiento en efectivo alcanzó el umbral en estas fechas.</div>
            ) : (
              <div className="table-responsive mb-3">
                <table className="table table-sm small align-middle">
                  <thead><tr className="text-muted"><th>Fecha</th><th>Socio</th><th>Operación</th><th>Agencia</th><th className="text-end">Monto</th></tr></thead>
                  <tbody>
                    {d.individuales.map((m) => (
                      <tr key={m.id_movimiento}>
                        <td className="text-nowrap">{fechaHora(m.fecha)}</td>
                        <td>{m.nombre_completo}<div className="text-muted">{m.dni}</div></td>
                        <td>{m.tipo === "ingreso" ? "Ingreso" : "Salida"} · {m.descripcion || m.categoria}</td>
                        <td>{m.agencia || "—"}</td>
                        <td className="text-end fw-semibold">{dinero(m.monto)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="fw-semibold small mb-1">Múltiples ({d.multiples.length})</div>
            {d.multiples.length === 0 ? (
              <div className="text-muted small">No hay socios con varios movimientos el mismo día que sumen el umbral.</div>
            ) : (
              <div className="table-responsive">
                <table className="table table-sm small align-middle mb-0">
                  <thead><tr className="text-muted"><th>Día</th><th>Socio</th><th>Movimientos</th><th className="text-end">Total del día</th></tr></thead>
                  <tbody>
                    {d.multiples.map((g) => (
                      <tr key={`${g.socio.id_socio}-${g.dia}-${g.tipo}`}>
                        <td className="text-nowrap">{g.dia}</td>
                        <td>{g.socio.nombre_completo}<div className="text-muted">{g.socio.dni}</div></td>
                        <td>
                          {g.movimientos.length} {g.tipo === "ingreso" ? "ingresos" : "salidas"}:{" "}
                          <span className="text-muted">{g.movimientos.map((m) => `${m.hora} ${dinero(m.monto)}`).join(" · ")}</span>
                        </td>
                        <td className="text-end fw-semibold">{dinero(g.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {d && modo === "sospechosas" && (
          d.data.length === 0 ? (
            <div className="text-muted small">No hay alertas reportadas en estas fechas. Se marcan desde la pestaña Alertas con el botón de la bandera.</div>
          ) : (
            <div className="table-responsive">
              <table className="table table-sm small align-middle mb-0">
                <thead><tr className="text-muted"><th>Reportada</th><th>Socio</th><th>Alerta</th><th>Análisis del oficial</th><th className="text-end">Monto</th></tr></thead>
                <tbody>
                  {d.data.map((a) => (
                    <tr key={a.id_alerta}>
                      <td className="text-nowrap">{fechaHora(a.revisado_en || a.fecha)}</td>
                      <td>{a.nombre_completo}<div className="text-muted">{a.dni}</div></td>
                      <td>{a.tipo_texto}<div className="text-muted">{a.detalle}</div></td>
                      <td>{a.nota || "—"}{a.revisor && <div className="text-muted">{a.revisor}</div>}</td>
                      <td className="text-end fw-semibold">{dinero(a.monto)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>
    </div>
  );
}
