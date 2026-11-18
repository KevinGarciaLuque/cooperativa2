// Expediente de cumplimiento del socio (conozca a su cliente): actividad económica, ingresos,
// origen de los fondos, si es persona expuesta políticamente (PEP) y sus beneficiarios.
import { useEffect, useState } from "react";
import axios from "axios";
import { FaShieldAlt, FaEdit, FaPlus, FaTrash, FaExclamationTriangle, FaFileWord } from "react-icons/fa";
import InputMonto from "../ui/InputMonto";
import { dinero, pais } from "../utils/pais";
import { useFunciones } from "../hooks/useFunciones";
import { bajarArchivo, mensajeBlob } from "./DocumentosCredito";

const ESCOLARIDADES = ["Ninguna", "Primaria incompleta", "Primaria", "Básico", "Secundaria / Diversificado", "Técnico", "Universitaria", "Posgrado"];
const fechaCorta = (v) => (v ? String(v).substring(0, 10) : "");

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const AZUL = "#1a2035";
const VACIO = { nombre: "", parentesco: "", identidad: "", telefono: "", porcentaje: "" };

const Dato = ({ etiqueta, valor }) => (
  <div className="col-12 col-sm-6 col-lg-4">
    <div className="small text-muted">{etiqueta}</div>
    <div className="fw-semibold text-break">{valor || <span className="text-muted fw-normal">—</span>}</div>
  </div>
);

export default function PerfilCumplimiento({ idSocio, headers }) {
  const { datos_ampliados: ampliados, contratos_word: fichaWord } = useFunciones();
  const regiones = pais()?.regiones || { nombre: "Departamento", lista: [] };
  const [datos, setDatos] = useState(undefined);
  const [editando, setEditando] = useState(false);
  const [form, setForm] = useState(null);
  const [mensaje, setMensaje] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [municipios, setMunicipios] = useState([]);
  // Municipios ya registrados en ese departamento, para sugerirlos (y escribirlos igual)
  useEffect(() => {
    if (!editando || !ampliados) return;
    axios
      .get(`${API_URL}/socios/municipios`, { headers, params: form?.departamento ? { departamento: form.departamento } : {} })
      .then((r) => setMunicipios(r.data.data || []))
      .catch(() => setMunicipios([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editando, ampliados, form?.departamento]);

  const cargar = () =>
    axios
      .get(`${API_URL}/socios/${idSocio}/expediente`, { headers })
      .then((r) => setDatos(r.data.data))
      .catch(() => setDatos(null));
  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idSocio, headers?.Authorization]);

  const editar = () => {
    setForm({
      ...datos,
      ingreso_mensual: datos.ingreso_mensual ?? "",
      fecha_ingreso: fechaCorta(datos.fecha_ingreso),
      beneficiarios: datos.beneficiarios.length ? datos.beneficiarios.map((b) => ({ ...b })) : [{ ...VACIO, porcentaje: "100" }],
    });
    setMensaje(null);
    setEditando(true);
  };
  const campo = (k) => ({ value: form[k] ?? "", onChange: (e) => setForm({ ...form, [k]: e.target.value }) });
  const benef = (i, k, v) => setForm({ ...form, beneficiarios: form.beneficiarios.map((b, j) => (j === i ? { ...b, [k]: v } : b)) });
  const suma = form ? form.beneficiarios.reduce((t, b) => t + (parseFloat(b.porcentaje) || 0), 0) : 0;

  const guardar = async () => {
    setGuardando(true);
    setMensaje(null);
    try {
      const beneficiarios = form.beneficiarios.filter((b) => b.nombre.trim() || b.porcentaje);
      const r = await axios.put(`${API_URL}/socios/${idSocio}/expediente`, { ...form, beneficiarios }, { headers });
      setDatos(r.data.data);
      setEditando(false);
    } catch (e) {
      setMensaje(e.response?.data?.message || "No se pudo guardar.");
    } finally {
      setGuardando(false);
    }
  };

  if (datos === undefined) return <div className="spinner-border spinner-border-sm text-success" />;
  if (!datos) return <div className="small text-muted">No se pudo leer el expediente de cumplimiento.</div>;

  if (!editando) {
    return (
      <div>
        {datos.faltantes.length > 0 && (
          <div className="alert alert-warning py-2 small d-flex align-items-center gap-2">
            <FaExclamationTriangle /> Expediente incompleto: falta {datos.faltantes.join(", ")}.
          </div>
        )}
        <div className="row g-3 mb-3">
          <Dato etiqueta="Actividad económica" valor={datos.actividad_economica} />
          <Dato etiqueta="Profesión u oficio" valor={datos.profesion} />
          <Dato etiqueta="Lugar de trabajo / negocio" valor={datos.lugar_trabajo} />
          <Dato etiqueta="Ingreso mensual declarado" valor={datos.ingreso_mensual != null && dinero(datos.ingreso_mensual)} />
          <Dato etiqueta="Origen de los fondos" valor={datos.origen_fondos} />
          <Dato etiqueta="Nacionalidad" valor={datos.nacionalidad} />
          <Dato etiqueta="Estado civil" valor={datos.estado_civil} />
          <Dato etiqueta="Género" valor={datos.genero} />
          <Dato
            etiqueta="Persona expuesta políticamente"
            valor={datos.es_pep ? <span className="badge bg-dark">PEP · {datos.pep_detalle}</span> : "No"}
          />
        </div>
        {ampliados && (
          <div className="row g-3 mb-3">
            {(datos.nombres || datos.apellidos) && <Dato etiqueta="Nombres / apellidos" valor={`${datos.nombres || ""} / ${datos.apellidos || ""}`} />}
            <Dato etiqueta="Escolaridad" valor={datos.escolaridad} />
            <Dato etiqueta="Cónyuge" valor={[datos.conyuge_nombre, datos.conyuge_identidad, datos.conyuge_telefono].filter(Boolean).join(" · ")} />
            <Dato etiqueta="Fecha de ingreso" valor={fechaCorta(datos.fecha_ingreso) || fechaCorta(datos.fecha_registro)} />
            <Dato etiqueta={regiones.nombre} valor={datos.departamento} />
            <Dato etiqueta="Municipio" valor={datos.municipio} />
            <Dato etiqueta="Comunidad / aldea" valor={datos.comunidad} />
          </div>
        )}
        <div className="small text-muted mb-1">Beneficiarios</div>
        {datos.beneficiarios.length ? (
          <ul className="list-unstyled small mb-3">
            {datos.beneficiarios.map((b) => (
              <li key={b.id_beneficiario}>
                <strong>{b.nombre}</strong> {b.parentesco && `(${b.parentesco})`} · {parseFloat(b.porcentaje)}%
                {b.identidad && ` · ${b.identidad}`}
                {b.telefono && ` · ${b.telefono}`}
              </li>
            ))}
          </ul>
        ) : (
          <div className="small text-muted mb-3">Sin beneficiarios registrados.</div>
        )}
        <button className="btn btn-sm btn-outline-primary" onClick={editar}>
          <FaEdit className="me-1" /> Actualizar expediente
        </button>
        {fichaWord && (
          <button
            className="btn btn-sm btn-outline-secondary ms-2"
            onClick={() =>
              bajarArchivo(`${API_URL}/documentos-credito/socios/${idSocio}/ficha`, String(headers?.Authorization || "").replace("Bearer ", ""), `ficha_socio_${idSocio}.docx`).catch(
                async (e) => setMensaje(await mensajeBlob(e, "No se pudo generar la ficha."))
              )
            }
          >
            <FaFileWord className="me-1" /> Ficha de inscripción (Word)
          </button>
        )}
        {mensaje && !editando && <div className="text-danger small mt-2">{mensaje}</div>}
        {datos.perfil_actualizado_en && (
          <span className="small text-muted ms-2">Actualizado el {String(datos.perfil_actualizado_en).substring(0, 10)}</span>
        )}
      </div>
    );
  }

  return (
    <div className="border rounded-3 p-3" style={{ background: "#fafbfc" }}>
      <div className="row g-2">
        <div className="col-12 col-md-6">
          <label className="form-label small">Actividad económica *</label>
          <input className="form-control form-control-sm" maxLength={150} placeholder="Ej.: comerciante, agricultor, empleado" {...campo("actividad_economica")} />
        </div>
        <div className="col-12 col-md-6">
          <label className="form-label small">Profesión u oficio</label>
          <input className="form-control form-control-sm" maxLength={100} {...campo("profesion")} />
        </div>
        <div className="col-12 col-md-6">
          <label className="form-label small">Lugar de trabajo / negocio</label>
          <input className="form-control form-control-sm" maxLength={150} {...campo("lugar_trabajo")} />
        </div>
        <div className="col-12 col-md-6">
          <label className="form-label small">Ingreso mensual *</label>
          <InputMonto className="form-control form-control-sm" value={form.ingreso_mensual} onChange={(v) => setForm({ ...form, ingreso_mensual: v })} />
        </div>
        <div className="col-12">
          <label className="form-label small">Origen de los fondos *</label>
          <input className="form-control form-control-sm" maxLength={255} placeholder="Ej.: salario, venta de cosecha, remesas" {...campo("origen_fondos")} />
        </div>
        <div className="col-6 col-md-4">
          <label className="form-label small">Nacionalidad</label>
          <input className="form-control form-control-sm" maxLength={60} {...campo("nacionalidad")} />
        </div>
        <div className="col-6 col-md-4">
          <label className="form-label small">Estado civil</label>
          <select className="form-select form-select-sm" {...campo("estado_civil")}>
            <option value="">—</option>
            {["Soltero(a)", "Casado(a)", "Unión libre", "Divorciado(a)", "Viudo(a)"].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </div>
        <div className="col-6 col-md-4">
          <label className="form-label small">Género</label>
          <select className="form-select form-select-sm" {...campo("genero")}>
            <option value="">—</option>
            {["Femenino", "Masculino", "Otro"].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </div>
        <div className="col-12">
          <div className="form-check">
            <input
              id="es_pep"
              type="checkbox"
              className="form-check-input"
              checked={!!form.es_pep}
              onChange={(e) => setForm({ ...form, es_pep: e.target.checked })}
            />
            <label htmlFor="es_pep" className="form-check-label small">
              Es persona expuesta políticamente (PEP): tiene o tuvo un cargo público importante, o es familiar o socio cercano de quien lo tiene
            </label>
          </div>
          {form.es_pep && (
            <input className="form-control form-control-sm mt-1" maxLength={255} placeholder="Cargo o relación (ej.: alcalde municipal 2022–2026)" {...campo("pep_detalle")} />
          )}
        </div>
      </div>

      {ampliados && (
        <div className="row g-2 mt-2">
          <div className="col-12 small fw-semibold mt-2">Datos generales</div>
          <div className="col-12 col-md-6">
            <label className="form-label small">Nombres</label>
            <input className="form-control form-control-sm" maxLength={80} {...campo("nombres")} />
          </div>
          <div className="col-12 col-md-6">
            <label className="form-label small">Apellidos</label>
            <input className="form-control form-control-sm" maxLength={80} {...campo("apellidos")} />
            <div className="form-text">Con los dos llenos, el nombre completo del socio se actualiza.</div>
          </div>
          <div className="col-6 col-md-4">
            <label className="form-label small">Escolaridad</label>
            <select className="form-select form-select-sm" {...campo("escolaridad")}>
              <option value="">—</option>
              {ESCOLARIDADES.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </div>
          <div className="col-6 col-md-4">
            <label className="form-label small">Fecha de ingreso a la cooperativa</label>
            <input type="date" className="form-control form-control-sm" {...campo("fecha_ingreso")} />
          </div>
          <div className="col-12 col-md-4">
            <label className="form-label small">{regiones.nombre}</label>
            {regiones.lista?.length ? (
              <select className="form-select form-select-sm" {...campo("departamento")}>
                <option value="">—</option>
                {regiones.lista.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            ) : (
              <input className="form-control form-control-sm" maxLength={60} {...campo("departamento")} />
            )}
          </div>
          <div className="col-6 col-md-4">
            <label className="form-label small">Municipio</label>
            <input className="form-control form-control-sm" maxLength={80} list="municipios-sugeridos" {...campo("municipio")} />
            <datalist id="municipios-sugeridos">
              {municipios.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </div>
          <div className="col-6 col-md-8">
            <label className="form-label small">Comunidad / aldea / caserío</label>
            <input className="form-control form-control-sm" maxLength={120} {...campo("comunidad")} />
          </div>
          <div className="col-12 col-md-5">
            <label className="form-label small">Nombre del cónyuge</label>
            <input className="form-control form-control-sm" maxLength={100} {...campo("conyuge_nombre")} />
          </div>
          <div className="col-6 col-md-4">
            <label className="form-label small">Identidad del cónyuge</label>
            <input className="form-control form-control-sm" maxLength={20} {...campo("conyuge_identidad")} />
          </div>
          <div className="col-6 col-md-3">
            <label className="form-label small">Teléfono del cónyuge</label>
            <input className="form-control form-control-sm" maxLength={20} {...campo("conyuge_telefono")} />
          </div>
        </div>
      )}

      <div className="d-flex justify-content-between align-items-center mt-3 mb-1">
        <div className="small fw-semibold">Beneficiarios</div>
        <span className={`small ${Math.abs(suma - 100) > 0.01 ? "text-danger" : "text-success"}`}>Suma: {suma}%</span>
      </div>
      {form.beneficiarios.map((b, i) => (
        <div className="row g-1 mb-1" key={i}>
          <div className="col-12 col-md-4">
            <input className="form-control form-control-sm" placeholder="Nombre completo" maxLength={100} value={b.nombre} onChange={(e) => benef(i, "nombre", e.target.value)} />
          </div>
          <div className="col-6 col-md-2">
            <input className="form-control form-control-sm" placeholder="Parentesco" maxLength={50} value={b.parentesco || ""} onChange={(e) => benef(i, "parentesco", e.target.value)} />
          </div>
          <div className="col-6 col-md-2">
            <input className="form-control form-control-sm" placeholder="Identidad" maxLength={20} value={b.identidad || ""} onChange={(e) => benef(i, "identidad", e.target.value)} />
          </div>
          <div className="col-5 col-md-2">
            <input className="form-control form-control-sm" placeholder="Teléfono" maxLength={20} value={b.telefono || ""} onChange={(e) => benef(i, "telefono", e.target.value)} />
          </div>
          <div className="col-5 col-md-1">
            <input className="form-control form-control-sm" placeholder="%" inputMode="decimal" value={b.porcentaje} onChange={(e) => benef(i, "porcentaje", e.target.value.replace(/[^\d.]/g, ""))} />
          </div>
          <div className="col-2 col-md-1">
            <button className="btn btn-sm btn-outline-danger w-100" title="Quitar" onClick={() => setForm({ ...form, beneficiarios: form.beneficiarios.filter((_, j) => j !== i) })}>
              <FaTrash />
            </button>
          </div>
        </div>
      ))}
      <button className="btn btn-sm btn-link px-0" onClick={() => setForm({ ...form, beneficiarios: [...form.beneficiarios, { ...VACIO }] })}>
        <FaPlus className="me-1" /> Agregar beneficiario
      </button>

      {mensaje && <div className="alert alert-danger py-2 small mt-2 mb-0">{mensaje}</div>}
      <div className="d-flex gap-2 mt-3">
        <button className="btn btn-sm btn-primary" onClick={guardar} disabled={guardando}>
          {guardando ? "Guardando..." : "Guardar expediente"}
        </button>
        <button className="btn btn-sm btn-light" onClick={() => setEditando(false)}>Cancelar</button>
      </div>
    </div>
  );
}

export const IconoCumplimiento = FaShieldAlt;
