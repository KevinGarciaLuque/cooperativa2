// Cobranza por asesor (función "cartera_asesor"): la agenda de cobro del día y la cartera,
// atraso y cobros del mes de cada asesor.
import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { FaPhoneAlt, FaCheckCircle, FaWhatsapp } from "react-icons/fa";
import { dinero, numeroWhatsApp } from "../utils/pais";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const PRIORIDAD = {
  1: ["Urgente", "#b91c1c", "#fee2e2"],
  2: ["Atrasado", "#c2410c", "#ffedd5"],
  3: ["Vence hoy", "#b45309", "#fef3c7"],
  4: ["Recordar", "#2563eb", "#dbeafe"],
};

export function AgendaCobro({ headers, asesores, onGestionar, recarga }) {
  const [quien, setQuien] = useState("yo");
  const [d, setD] = useState(null);

  const cargar = useCallback(() => {
    axios.get(`${API_URL}/cobranza/agenda`, { headers, params: { id_asesor: quien } }).then((r) => setD(r.data)).catch(() => setD({ data: [], pendientes: 0 }));
  }, [headers, quien]);
  useEffect(() => {
    cargar();
  }, [cargar, recarga]);

  return (
    <div className="ui-card p-3">
      <div className="d-flex flex-wrap justify-content-between align-items-end gap-2 mb-3">
        <div>
          <div className="fw-bold" style={{ color: "#1a2035" }}>Agenda de cobro de hoy</div>
          <div className="small text-muted">
            Primero las promesas de pago y los atrasos sin gestionar; luego las cuotas que vencen hoy y en 3 días.
            {d && ` ${d.pendientes} por gestionar.`}
          </div>
        </div>
        <select className="form-select form-select-sm" style={{ maxWidth: 260 }} value={quien} onChange={(e) => setQuien(e.target.value)}>
          <option value="yo">Mi cartera</option>
          <option value="todos">Todos los asesores</option>
          <option value="sin">Préstamos sin asesor</option>
          {asesores.map((a) => <option key={a.id_usuario} value={a.id_usuario}>{a.nombre_completo}</option>)}
        </select>
      </div>
      {!d ? (
        <div className="text-center py-4"><div className="spinner-border spinner-border-sm" /></div>
      ) : d.data.length === 0 ? (
        <div className="text-center text-muted py-4">
          <FaCheckCircle size={26} className="mb-2" style={{ color: "#a8cd3a" }} />
          <div>Nada pendiente en esta cartera hoy.</div>
        </div>
      ) : (
        <div className="d-flex flex-column gap-2">
          {d.data.map((i) => {
            const [t, c, f] = PRIORIDAD[i.prioridad];
            const wa = numeroWhatsApp(i.telefono);
            return (
              <div key={i.id_prestamo} className="d-flex flex-wrap align-items-center gap-3 rounded-3 px-3 py-2"
                style={{ border: "1px solid #e2e8f0", background: i.gestionado_hoy ? "#f8fafc" : "#fff", opacity: i.gestionado_hoy ? 0.6 : 1 }}>
                <span className="badge rounded-pill" style={{ background: f, color: c, minWidth: 86 }}>{t}</span>
                <div className="flex-grow-1" style={{ minWidth: 200 }}>
                  <div className="fw-semibold">{i.socio} <span className="text-muted small">· #{i.id_prestamo}</span></div>
                  <div className="small text-muted">
                    {i.motivo}{i.asesor && quien !== "yo" ? ` · ${i.asesor}` : ""}{i.gestionado_hoy ? " · ya gestionado hoy" : ""}
                  </div>
                  {i.ultima_nota && <div className="small text-muted text-truncate" style={{ maxWidth: 420 }}>Última nota: {i.ultima_nota}</div>}
                </div>
                <div className="text-end small">
                  <div className="fw-semibold">{dinero(i.monto_vencido || i.cuota)}</div>
                  {i.mora_generada > 0 && <div style={{ color: "#b91c1c" }}>+ mora {dinero(i.mora_generada)}</div>}
                </div>
                <div className="d-flex gap-1">
                  {i.telefono && (
                    <a className="btn btn-sm btn-outline-secondary" href={`tel:${i.telefono}`} title="Llamar"><FaPhoneAlt /></a>
                  )}
                  {wa && (
                    <a className="btn btn-sm btn-outline-success" href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer" title="WhatsApp"><FaWhatsapp /></a>
                  )}
                  <button className="btn btn-sm fw-semibold" style={{ background: "#a8cd3a", color: "#1a2a00" }} onClick={() => onGestionar(i)}>
                    Gestionar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function CarteraAsesores({ headers }) {
  const [d, setD] = useState(null);
  useEffect(() => {
    axios.get(`${API_URL}/cobranza/asesores`, { headers }).then((r) => setD(r.data)).catch(() => setD({ data: [] }));
  }, [headers]);
  if (!d) return <div className="text-center py-4"><div className="spinner-border spinner-border-sm" /></div>;
  return (
    <div className="ui-card p-3">
      <div className="fw-bold" style={{ color: "#1a2035" }}>Cartera por asesor</div>
      <div className="small text-muted mb-3">Préstamos vigentes, atraso y lo cobrado en {d.mes}. La morosidad es el saldo con atraso entre el saldo total.</div>
      {d.data.length === 0 ? (
        <div className="text-muted small">No hay préstamos vigentes.</div>
      ) : (
        <div className="table-responsive">
          <table className="table align-middle mb-0">
            <thead>
              <tr className="small text-muted">
                <th>Asesor</th><th className="text-end">Préstamos</th><th className="text-end">Saldo</th><th className="text-end">Con atraso</th>
                <th className="text-end">Morosidad</th><th className="text-end">Mora</th><th className="text-end">Cobrado del mes</th><th className="text-end">Gestiones</th>
              </tr>
            </thead>
            <tbody>
              {d.data.map((a) => (
                <tr key={a.id_asesor || 0} style={{ color: a.id_asesor ? "inherit" : "#64748b" }}>
                  <td className="fw-semibold">{a.asesor}{a.promesas_vencidas > 0 && <span className="badge bg-danger ms-2">{a.promesas_vencidas} promesa(s) incumplida(s)</span>}</td>
                  <td className="text-end">{a.prestamos}</td>
                  <td className="text-end">{dinero(a.saldo)}</td>
                  <td className="text-end">{a.con_atraso} · {dinero(a.saldo_atraso)}</td>
                  <td className="text-end">
                    <span className="badge rounded-pill" style={{ background: a.morosidad > 10 ? "#fee2e2" : a.morosidad > 5 ? "#fef3c7" : "#dcfce7", color: a.morosidad > 10 ? "#b91c1c" : a.morosidad > 5 ? "#b45309" : "#15803d" }}>
                      {a.morosidad.toFixed(2)}%
                    </span>
                  </td>
                  <td className="text-end">{dinero(a.mora)}</td>
                  <td className="text-end">{dinero(a.cobrado_mes)}</td>
                  <td className="text-end">{a.gestiones_mes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
