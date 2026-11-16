// Plan de pagos de un préstamo: cuotas con su vencimiento y estado. Lo calcula el servidor
// (/prestamos/:id/plan) a partir de las condiciones pactadas. Recibe los datos ya cargados
// (`datos`) o los pide con `idPrestamo` y `headers`. Al socio el servidor no le manda el
// desglose de capital e interés, así que esas columnas no aparecen.
import { useEffect, useState } from "react";
import axios from "axios";
import { cifra, dinero } from "../utils/pais";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const ESTADOS = {
  pagada: { bg: "#d1fae5", color: "#065f46", label: "Pagada", fila: "#f4fbf7" },
  vencida: { bg: "#fee2e2", color: "#991b1b", label: "Vencida", fila: "#fff5f5" },
  parcial: { bg: "#fef3c7", color: "#92400e", label: "Abono parcial", fila: "#fffbeb" },
  proxima: { bg: "#fef3c7", color: "#92400e", label: "Próxima", fila: "#fffbeb" },
  pendiente: { bg: "#eef2f7", color: "#475569", label: "Pendiente", fila: "transparent" },
};

export default function PlanPagos({ datos, idPrestamo, headers, titulo = "Plan de pagos", maxAlto }) {
  const [cargado, setCargado] = useState(datos === undefined ? null : datos);

  useEffect(() => {
    if (datos !== undefined) {
      setCargado(datos);
      return undefined;
    }
    let activo = true;
    axios
      .get(`${API_URL}/prestamos/${idPrestamo}/plan`, { headers })
      .then((r) => activo && setCargado(r.data))
      .catch(() => activo && setCargado({ plan: null, motivo: "error" }));
    return () => {
      activo = false;
    };
  }, [datos, idPrestamo, headers]);

  if (cargado === null) return <div className="spinner-border spinner-border-sm text-success" />;
  if (!cargado?.plan) {
    const motivo = cargado?.motivo;
    return (
      <div className="small text-muted">
        {motivo === "indefinido"
          ? "Préstamo de plazo indefinido: no tiene cuotas fijas, se paga el interés cada mes."
          : motivo === "sin_desembolsar"
            ? "El plan de pagos se arma cuando se desembolsa el préstamo."
            : "No se pudo cargar el plan de pagos."}
      </div>
    );
  }

  const { plan, resumen } = cargado;
  const conDesglose = plan[0]?.capital !== undefined; // el socio no lo recibe

  return (
    <div>
      {titulo && <h6 className="fw-bold mb-1">{titulo}</h6>}
      <div className="d-flex flex-wrap gap-3 small mb-2">
        <span>
          <strong>{resumen.cuotas_pagadas}</strong> de {resumen.total_cuotas} cuotas pagadas
        </span>
        {resumen.cuotas_vencidas > 0 ? (
          <span style={{ color: "#991b1b" }}>
            <strong>{resumen.cuotas_vencidas}</strong> vencida{resumen.cuotas_vencidas > 1 ? "s" : ""} ·{" "}
            {resumen.dias_atraso} días de atraso · {dinero(resumen.monto_vencido)} atrasado
          </span>
        ) : (
          <span style={{ color: "#065f46" }}>Al día</span>
        )}
        {resumen.proxima_cuota && (
          <span className="text-muted">
            Próxima: cuota {resumen.proxima_cuota.numero} el {resumen.proxima_cuota.fecha_vencimiento} por{" "}
            {dinero(resumen.proxima_cuota.cuota)}
          </span>
        )}
      </div>
      <div className="table-responsive" style={maxAlto ? { maxHeight: maxAlto, overflowY: "auto" } : undefined}>
        <table className="table table-sm align-middle mb-0" style={{ fontSize: ".85rem" }}>
          <thead style={{ position: "sticky", top: 0, background: "#fff" }}>
            <tr className="text-muted" style={{ fontSize: ".75rem", textTransform: "uppercase" }}>
              <th>#</th>
              <th>Vence</th>
              <th className="text-end">Cuota</th>
              {conDesglose && <th className="text-end">Capital</th>}
              {conDesglose && <th className="text-end">Interés</th>}
              <th className="text-end">Saldo</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {plan.map((c) => {
              const clave = c.estado === "pendiente" && c.numero === resumen.proxima_cuota?.numero ? "proxima" : c.estado;
              const e = ESTADOS[clave] || ESTADOS.pendiente;
              return (
                <tr key={c.numero} style={{ background: e.fila }}>
                  <td className="fw-semibold">{c.numero}</td>
                  <td>{c.fecha_vencimiento}</td>
                  <td className="text-end fw-semibold">{cifra(c.cuota)}</td>
                  {conDesglose && <td className="text-end">{cifra(c.capital)}</td>}
                  {conDesglose && <td className="text-end">{cifra(c.interes)}</td>}
                  <td className="text-end">{cifra(c.saldo)}</td>
                  <td>
                    <span className="badge rounded-pill" style={{ background: e.bg, color: e.color, fontWeight: 600 }}>
                      {e.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
