// Reportes ampliados: historial crediticio, proyección de cobros, créditos vencidos, por cerrar,
// cerrados y cartera agrupada. Se ven en pantalla y se bajan en Excel. Función nueva.
import { useState } from "react";
import axios from "axios";
import { FaChartBar, FaFileExcel, FaPlay } from "react-icons/fa";
import { useAuth } from "../context/AuthContext";
import { useAlerta } from "../context/AlertaContext";
import { dinero } from "../utils/pais";
import { bajarArchivo, mensajeBlob } from "../components/DocumentosCredito";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const AZUL = "#1a2035";
const ACCENT = "#a8cd3a";
const REPORTES = [
  ["proyeccion", "Proyección de cobros", "Cuotas que vencen en un rango de fechas y las vencidas sin pagar."],
  ["vencidos", "Créditos vencidos", "Préstamos cuyo plazo ya terminó y todavía tienen saldo."],
  ["por_cerrar", "Pendientes de cerrar", "Sin saldo de capital pero todavía activos."],
  ["cerrados", "Créditos cerrados", "Préstamos pagados, por fecha del último pago."],
  ["cartera", "Cartera agrupada", "Saldo y atraso por promotor, línea, municipio, sucursal, producto o tipo."],
  ["historial", "Historial crediticio", "Todos los préstamos de un socio y su comportamiento de pago."],
];
const AGRUPAR = [["promotor", "Promotor"], ["linea", "Línea"], ["municipio", "Municipio"], ["sucursal", "Sucursal"], ["producto", "Producto"], ["tipo", "Individual o grupal"]];

export default function ReportesAmpliados() {
  const { token } = useAuth();
  const { mostrarAlerta } = useAlerta();
  const headers = { Authorization: `Bearer ${token}` };
  const [tipo, setTipo] = useState("proyeccion");
  const [params, setParams] = useState({ desde: "", hasta: "", por: "promotor", id_usuario: "" });
  const [buscar, setBuscar] = useState("");
  const [socios, setSocios] = useState([]);
  const [socio, setSocio] = useState(null);
  const [resultado, setResultado] = useState(null);
  const [cargando, setCargando] = useState(false);

  const consulta = () => {
    const q = {};
    if (["proyeccion", "cerrados"].includes(tipo)) {
      if (params.desde) q.desde = params.desde;
      if (params.hasta) q.hasta = params.hasta;
    }
    if (tipo === "cartera") q.por = params.por;
    if (tipo === "historial" && socio) q.id_usuario = socio.id_usuario;
    return q;
  };

  const ver = async () => {
    setCargando(true);
    try {
      const r = await axios.get(`${API_URL}/reportes-ampliados/${tipo}`, { headers, params: consulta() });
      setResultado(r.data);
    } catch (e) {
      mostrarAlerta(e.response?.data?.message || "No se pudo generar el reporte.", "error");
    } finally {
      setCargando(false);
    }
  };
  const excel = async () => {
    try {
      const q = new URLSearchParams({ ...consulta(), formato: "excel" }).toString();
      await bajarArchivo(`${API_URL}/reportes-ampliados/${tipo}?${q}`, token, `${tipo}.xlsx`);
    } catch (e) {
      mostrarAlerta(await mensajeBlob(e, "No se pudo bajar el reporte."), "error");
    }
  };
  const buscarSocio = async (texto) => {
    setBuscar(texto);
    if (texto.trim().length < 2) return setSocios([]);
    try {
      const r = await axios.get(`${API_URL}/usuarios`, { headers, params: { rol: "Socio", search: texto.trim(), limit: 8 } });
      setSocios(r.data.data || []);
    } catch {
      setSocios([]);
    }
  };
  const formato = (v, t) => (t === "dinero" ? dinero(v) : v ?? "");
  const actual = REPORTES.find((r) => r[0] === tipo);

  return (
    <div className="container-fluid py-3">
      <div className="d-flex align-items-center gap-3 mb-3">
        <div className="d-flex align-items-center justify-content-center" style={{ width: 48, height: 48, borderRadius: 12, background: AZUL, color: ACCENT }}>
          <FaChartBar size={20} />
        </div>
        <div>
          <h4 className="fw-bold mb-0" style={{ color: AZUL }}>Reportes de cartera</h4>
          <div className="text-muted small">Se ven aquí y se bajan en Excel; respetan la sucursal elegida arriba</div>
        </div>
      </div>

      <div className="card border-0 shadow-sm mb-3" style={{ borderRadius: 14 }}>
        <div className="card-body">
          <div className="d-flex flex-wrap gap-2 mb-3">
            {REPORTES.map(([k, t]) => (
              <button key={k} className={`btn btn-sm ${tipo === k ? "btn-primary" : "btn-outline-secondary"}`} onClick={() => { setTipo(k); setResultado(null); }}>
                {t}
              </button>
            ))}
          </div>
          <div className="small text-muted mb-2">{actual[2]}</div>
          <div className="row g-2 align-items-end">
            {["proyeccion", "cerrados"].includes(tipo) && (
              <>
                <div className="col-6 col-md-3">
                  <label className="form-label small mb-1">Desde</label>
                  <input type="date" className="form-control form-control-sm" value={params.desde} onChange={(e) => setParams({ ...params, desde: e.target.value })} />
                </div>
                <div className="col-6 col-md-3">
                  <label className="form-label small mb-1">Hasta</label>
                  <input type="date" className="form-control form-control-sm" value={params.hasta} onChange={(e) => setParams({ ...params, hasta: e.target.value })} />
                </div>
              </>
            )}
            {tipo === "cartera" && (
              <div className="col-12 col-md-4">
                <label className="form-label small mb-1">Agrupar por</label>
                <select className="form-select form-select-sm" value={params.por} onChange={(e) => setParams({ ...params, por: e.target.value })}>
                  {AGRUPAR.map(([k, t]) => <option key={k} value={k}>{t}</option>)}
                </select>
              </div>
            )}
            {tipo === "historial" && (
              <div className="col-12 col-md-6 position-relative">
                <label className="form-label small mb-1">Socio</label>
                <input className="form-control form-control-sm" placeholder="Nombre, identidad o número" value={socio ? socio.nombre_completo : buscar}
                  onChange={(e) => { setSocio(null); buscarSocio(e.target.value); }} />
                {!socio && socios.length > 0 && (
                  <div className="list-group position-absolute w-100 shadow" style={{ zIndex: 10 }}>
                    {socios.map((s) => (
                      <button key={s.id_usuario} className="list-group-item list-group-item-action small" onClick={() => { setSocio(s); setSocios([]); }}>
                        {s.nombre_completo} <span className="text-muted">· {s.dni}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <div className="col-auto">
              <button className="btn btn-primary btn-sm" disabled={cargando || (tipo === "historial" && !socio)} onClick={ver}>
                <FaPlay className="me-1" /> {cargando ? "Generando..." : "Ver"}
              </button>
            </div>
            <div className="col-auto">
              <button className="btn btn-outline-success btn-sm" disabled={tipo === "historial" && !socio} onClick={excel}>
                <FaFileExcel className="me-1" /> Excel
              </button>
            </div>
          </div>
        </div>
      </div>

      {resultado && (
        <div className="card border-0 shadow-sm" style={{ borderRadius: 14 }}>
          <div className="card-body">
            <h6 className="fw-bold mb-0" style={{ color: AZUL }}>{resultado.titulo}</h6>
            <div className="small text-muted mb-3">{resultado.subtitulo} · {resultado.filas.length} fila(s)</div>
            <div className="table-responsive" style={{ maxHeight: 560 }}>
              <table className="table table-sm table-hover align-middle">
                <thead className="table-light" style={{ position: "sticky", top: 0 }}>
                  <tr>{resultado.columnas.map(([k, t, f]) => <th key={k} className={f === "dinero" ? "text-end" : ""}>{t}</th>)}</tr>
                </thead>
                <tbody>
                  {resultado.filas.map((fila, i) => (
                    <tr key={i}>
                      {resultado.columnas.map(([k, , f]) => (
                        <td key={k} className={`small ${f === "dinero" ? "text-end text-nowrap" : ""}`}>{formato(fila[k], f)}</td>
                      ))}
                    </tr>
                  ))}
                  {!resultado.filas.length && (
                    <tr><td colSpan={resultado.columnas.length} className="text-center text-muted py-3">Sin resultados.</td></tr>
                  )}
                </tbody>
                {resultado.totales && resultado.filas.length > 0 && (
                  <tfoot>
                    <tr className="fw-bold">
                      {resultado.columnas.map(([k, , f], i) => (
                        <td key={k} className={f === "dinero" ? "text-end text-nowrap" : ""}>
                          {i === 0 ? "Totales" : resultado.totales[k] != null ? formato(resultado.totales[k], f) : ""}
                        </td>
                      ))}
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
