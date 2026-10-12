import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { FaArrowLeft, FaPrint } from "react-icons/fa";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const fmt = (n) =>
  `L. ${parseFloat(n || 0).toLocaleString("es-HN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const fecha = (v) => (v ? String(v).substring(0, 10) : "—");

// Estado de cuenta imprimible del socio (con filtro por período)
export default function EstadoCuentaSocio({ idSocio, headers, onBack, textoVolver = "Volver" }) {
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(true);

  const cabecera = useMemo(() => headers, [headers]);

  useEffect(() => {
    let activo = true;
    setCargando(true);
    axios
      .get(`${API_URL}/socios/${idSocio}/estado-cuenta`, {
        headers: cabecera,
        params: { desde: desde || undefined, hasta: hasta || undefined },
      })
      .then((r) => activo && (setData(r.data), setError("")))
      .catch(() => activo && setError("No se pudo generar el estado de cuenta."))
      .finally(() => activo && setCargando(false));
    return () => {
      activo = false;
    };
  }, [idSocio, desde, hasta, cabecera]);

  return (
    <div className="container-fluid py-3">
      <style>{`
        .ec-card { background: #fff; border-radius: 1rem; box-shadow: 0 2px 12px #0000000f; }
        .ec-table th { font-size: .75rem; text-transform: uppercase; color: #64748b; white-space: nowrap; }
        .ec-table td { white-space: nowrap; }
        @media print {
          body * { visibility: hidden; }
          .ec-print, .ec-print * { visibility: visible; }
          .ec-print { position: absolute; left: 0; top: 0; width: 100%; }
          .ec-no-print { display: none !important; }
          .ec-card { box-shadow: none !important; border: 1px solid #ddd; }
        }
      `}</style>

      <div className="ec-print">
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3 ec-no-print">
          <button className="btn btn-outline-secondary" onClick={onBack}>
            <FaArrowLeft className="me-2" /> {textoVolver}
          </button>
          <div className="d-flex flex-wrap align-items-center gap-2">
            <label className="small text-muted">Desde</label>
            <input type="date" className="form-control form-control-sm" style={{ width: 150 }} value={desde} onChange={(e) => setDesde(e.target.value)} />
            <label className="small text-muted">Hasta</label>
            <input type="date" className="form-control form-control-sm" style={{ width: 150 }} value={hasta} onChange={(e) => setHasta(e.target.value)} />
            <button className="btn btn-dark" onClick={() => window.print()} disabled={!data}>
              <FaPrint className="me-2" /> Imprimir
            </button>
          </div>
        </div>

        {error && <div className="alert alert-danger">{error}</div>}
        {cargando && !data && (
          <div className="text-center py-5">
            <div className="spinner-border text-success" />
          </div>
        )}

        {data && (
          <div style={{ opacity: cargando ? 0.5 : 1 }}>
            <div className="ec-card p-4 mb-3">
              <img src="/smartcoop.png" alt="SmartCoop" style={{ height: 56, float: "right" }} />
              <h4 className="fw-bold mb-1">Estado de cuenta</h4>
              <div className="fw-semibold">{data.socio.nombre_completo}</div>
              <div className="text-muted small">
                Identidad: {data.socio.dni} · Socio desde {fecha(data.socio.fecha_registro)}
              </div>
              <div className="text-muted small">
                {desde || hasta
                  ? `Período: ${desde || "inicio"} al ${hasta || "hoy"}`
                  : "Todo el historial"}{" "}
                · Generado el {new Date(data.generado).toLocaleString("es-HN")}
              </div>

              <div className="row g-2 mt-2">
                {[
                  ["Saldo en cuentas", data.resumen.saldo_cuentas],
                  ["Total aportado", data.resumen.total_aportaciones],
                  ["Saldo de préstamos", data.resumen.saldo_prestamos],
                  ["Pagado a préstamos", data.resumen.total_pagado],
                ].map(([t, v]) => (
                  <div className="col-6 col-lg-3" key={t}>
                    <div className="p-2 px-3" style={{ background: "#f6f8fb", borderRadius: 10 }}>
                      <div className="small text-muted">{t}</div>
                      <div className="fw-bold">{fmt(v)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="ec-card p-4 mb-3">
              <h6 className="fw-bold">Cuentas</h6>
              {data.cuentas.length === 0 ? (
                <div className="text-muted small">Sin cuentas.</div>
              ) : (
                <table className="table table-sm ec-table mb-0">
                  <thead>
                    <tr><th>Cuenta</th><th>Tipo</th><th>Estado</th><th className="text-end">Saldo</th></tr>
                  </thead>
                  <tbody>
                    {data.cuentas.map((c) => (
                      <tr key={c.id_cuenta}>
                        <td>#{c.id_cuenta}</td>
                        <td>{c.tipo_cuenta}</td>
                        <td>{c.estado}</td>
                        <td className="text-end">{fmt(c.saldo_actual)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="ec-card p-4 mb-3">
              <h6 className="fw-bold">Préstamos</h6>
              {data.prestamos.length === 0 ? (
                <div className="text-muted small">Sin préstamos.</div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-sm ec-table mb-0">
                    <thead>
                      <tr><th>N.º</th><th>Otorgado</th><th className="text-end">Monto</th><th>Plazo</th><th>Estado</th><th className="text-end">Saldo</th></tr>
                    </thead>
                    <tbody>
                      {data.prestamos.map((p) => (
                        <tr key={p.id_prestamo}>
                          <td>#{p.id_prestamo}</td>
                          <td>{fecha(p.fecha_otorgado)}</td>
                          <td className="text-end">{fmt(p.monto)}</td>
                          <td>{parseInt(p.plazo_meses) === 0 ? "Indefinido" : `${p.plazo_meses} meses`}</td>
                          <td>{p.estado}</td>
                          <td className="text-end">{p.estado === "pagado" ? "Liquidado" : fmt(p.saldo_restante)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="ec-card p-4 mb-3">
              <h6 className="fw-bold">Pagos de préstamos</h6>
              {data.pagos.length === 0 ? (
                <div className="text-muted small">Sin pagos en el período.</div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-sm ec-table mb-0">
                    <thead>
                      <tr><th>Fecha</th><th>Préstamo</th><th>Método</th><th className="text-end">Pagado</th><th className="text-end">Saldo</th></tr>
                    </thead>
                    <tbody>
                      {data.pagos.map((p) => (
                        <tr key={p.id_pago}>
                          <td>{fecha(p.fecha_pago)}</td>
                          <td>#{p.id_prestamo}</td>
                          <td>{p.metodo_pago || "—"}</td>
                          <td className="text-end">{fmt(p.monto_pagado)}</td>
                          <td className="text-end">{fmt(p.saldo_restante)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="ec-card p-4 mb-3">
              <h6 className="fw-bold">Aportaciones</h6>
              {data.aportaciones.length === 0 ? (
                <div className="text-muted small">Sin aportaciones en el período.</div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-sm ec-table mb-0">
                    <thead>
                      <tr><th>Fecha</th><th>Descripción</th><th className="text-end">Monto</th></tr>
                    </thead>
                    <tbody>
                      {data.aportaciones.map((a) => (
                        <tr key={a.id_aportacion}>
                          <td>{fecha(a.fecha)}</td>
                          <td>{a.descripcion || "—"}</td>
                          <td className="text-end">{fmt(a.monto)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
