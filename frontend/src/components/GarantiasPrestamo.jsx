// Garantías de un préstamo (personal): las registradas, su estado y la cobertura de las
// garantías reales; permite agregar una (aval, prendaria, hipotecaria, ahorros u otra) y
// liberarla dejando el motivo.
import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { FaShieldAlt, FaPlus, FaUnlock } from "react-icons/fa";
import { useAlerta } from "../context/AlertaContext";
import InputMonto from "../ui/InputMonto";
import { dinero, docIdentidad, simboloMoneda } from "../utils/pais";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const VACIA = { tipo: "aval", descripcion: "", valor_estimado: "", aval_nombre: "", aval_identidad: "", aval_telefono: "", aval_parentesco: "" };

export default function GarantiasPrestamo({ idPrestamo, headers, estadoPrestamo }) {
  const { mostrarAlerta } = useAlerta();
  const [datos, setDatos] = useState(null);
  const [form, setForm] = useState(null); // null = cerrado
  const [guardando, setGuardando] = useState(false);

  // Depende del token y no del objeto headers (que puede ser nuevo en cada render)
  const autorizacion = headers?.Authorization;
  const cargar = useCallback(() => {
    axios
      .get(`${API_URL}/garantias/prestamo/${idPrestamo}`, { headers: { Authorization: autorizacion } })
      .then((r) => setDatos(r.data))
      .catch(() => setDatos({ garantias: [], resumen: null, tipos: {} }));
  }, [idPrestamo, autorizacion]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const editable = !["rechazado", "pagado", "consolidado"].includes(String(estadoPrestamo || "").toLowerCase());
  const poner = (campo) => (e) => {
    const v = e?.target ? e.target.value : e;
    setForm((f) => ({ ...f, [campo]: v }));
  };

  const guardar = async (e) => {
    e.preventDefault();
    setGuardando(true);
    try {
      const r = await axios.post(`${API_URL}/garantias/prestamo/${idPrestamo}`, form, { headers });
      setDatos((d) => ({ ...d, ...r.data }));
      setForm(null);
      mostrarAlerta("Garantía registrada.", "success");
    } catch (err) {
      mostrarAlerta(err.response?.data?.message || "No se pudo registrar la garantía.", "error");
    } finally {
      setGuardando(false);
    }
  };

  const liberar = async (g) => {
    const motivo = window.prompt("¿Por qué se libera esta garantía? (por ejemplo: se devolvió el documento, se cambió de aval)");
    if (motivo === null) return;
    try {
      const r = await axios.post(`${API_URL}/garantias/${g.id_garantia}/liberar`, { motivo }, { headers });
      setDatos((d) => ({ ...d, ...r.data }));
    } catch (err) {
      mostrarAlerta(err.response?.data?.message || "No se pudo liberar la garantía.", "error");
    }
  };

  if (!datos) return <div className="spinner-border spinner-border-sm text-success" />;
  const { garantias, resumen, tipos = {} } = datos;

  return (
    <div>
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
        <h6 className="fw-bold mb-0">
          <FaShieldAlt className="me-2" style={{ color: "#0f766e" }} />
          Garantías
        </h6>
        {editable && !form && (
          <button className="btn btn-sm btn-outline-dark" onClick={() => setForm(VACIA)}>
            <FaPlus className="me-1" /> Agregar garantía
          </button>
        )}
      </div>

      {resumen && resumen.valor_garantias_reales > 0 && (
        <div className="small text-muted mb-2">
          Garantías reales: {dinero(resumen.valor_garantias_reales)} · cubren el {resumen.cobertura_real_pct}% del préstamo
        </div>
      )}

      {garantias.length === 0 ? (
        <div className="small text-muted">Sin garantías registradas.</div>
      ) : (
        <div className="d-flex flex-column gap-2">
          {garantias.map((g) => {
            const liberada = g.estado_efectivo === "liberada";
            return (
              <div
                key={g.id_garantia}
                className="d-flex flex-wrap align-items-start justify-content-between gap-2 p-2 rounded-3"
                style={{ background: liberada ? "#f8fafc" : "#f0fdfa", border: `1px solid ${liberada ? "#e2e8f0" : "#99f6e4"}` }}
              >
                <div className="small" style={{ opacity: liberada ? 0.65 : 1 }}>
                  <span className="badge me-2" style={{ background: "#ccfbf1", color: "#115e59" }}>{g.tipo_nombre}</span>
                  {g.tipo === "aval" ? (
                    <>
                      <strong>{g.aval_nombre}</strong>
                      {g.aval_parentesco && <span className="text-muted"> ({g.aval_parentesco})</span>}
                      {g.aval_identidad && <span className="text-muted"> · {docIdentidad().nombre} {g.aval_identidad}</span>}
                      {g.aval_telefono && <span className="text-muted"> · {g.aval_telefono}</span>}
                    </>
                  ) : (
                    <strong>{g.descripcion}</strong>
                  )}
                  {g.valor_estimado > 0 && <span> · {dinero(g.valor_estimado)}</span>}
                  {liberada && (
                    <div className="text-muted">
                      Liberada{g.motivo_liberacion ? `: ${g.motivo_liberacion}` : " (préstamo cancelado)"}
                    </div>
                  )}
                </div>
                {!liberada && editable && (
                  <button className="btn btn-sm btn-link text-muted p-0" onClick={() => liberar(g)}>
                    <FaUnlock className="me-1" /> Liberar
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {form && (
        <form className="mt-3 p-3 rounded-3" style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }} onSubmit={guardar}>
          <div className="row g-2">
            <div className="col-12 col-md-4">
              <label className="form-label small fw-semibold mb-1">Tipo</label>
              <select className="form-select form-select-sm" value={form.tipo} onChange={poner("tipo")}>
                {Object.entries(tipos).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            {form.tipo === "aval" ? (
              <>
                <div className="col-12 col-md-8">
                  <label className="form-label small fw-semibold mb-1">Nombre del aval *</label>
                  <input className="form-control form-control-sm" required value={form.aval_nombre} onChange={poner("aval_nombre")} />
                </div>
                <div className="col-6 col-md-4">
                  <label className="form-label small fw-semibold mb-1">{docIdentidad().nombre}</label>
                  <input className="form-control form-control-sm" value={form.aval_identidad} onChange={poner("aval_identidad")} />
                </div>
                <div className="col-6 col-md-4">
                  <label className="form-label small fw-semibold mb-1">Teléfono *</label>
                  <input className="form-control form-control-sm" required value={form.aval_telefono} onChange={poner("aval_telefono")} />
                </div>
                <div className="col-12 col-md-4">
                  <label className="form-label small fw-semibold mb-1">Parentesco</label>
                  <input className="form-control form-control-sm" value={form.aval_parentesco} onChange={poner("aval_parentesco")} />
                </div>
              </>
            ) : (
              <>
                <div className="col-12 col-md-8">
                  <label className="form-label small fw-semibold mb-1">Descripción *</label>
                  <input
                    className="form-control form-control-sm"
                    required
                    value={form.descripcion}
                    onChange={poner("descripcion")}
                    placeholder={form.tipo === "hipotecaria" ? "Terreno, matrícula, ubicación" : form.tipo === "prendaria" ? "Vehículo: marca, año, placa" : "Qué es"}
                  />
                </div>
                <div className="col-12 col-md-4">
                  <label className="form-label small fw-semibold mb-1">
                    Valor estimado ({simboloMoneda()}){["prendaria", "hipotecaria"].includes(form.tipo) ? " *" : ""}
                  </label>
                  <InputMonto className="form-control form-control-sm" value={form.valor_estimado} onChange={poner("valor_estimado")} />
                </div>
              </>
            )}
          </div>
          <div className="d-flex justify-content-end gap-2 mt-2">
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setForm(null)}>Cancelar</button>
            <button type="submit" className="btn btn-sm btn-dark" disabled={guardando}>
              {guardando && <span className="spinner-border spinner-border-sm me-1" />}
              Guardar garantía
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
