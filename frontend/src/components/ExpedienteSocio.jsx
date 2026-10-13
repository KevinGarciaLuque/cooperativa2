// Expediente del socio en Ventanilla: los datos que dejó en el formulario de ingreso,
// su información laboral (de la última solicitud) y las fotos de su identidad.
import { useEffect, useState } from "react";
import axios from "axios";
import { FaBriefcase, FaIdCard, FaUser } from "react-icons/fa";
import FotosIdentidad from "./FotosIdentidad";
import { OCUPACIONES, fmt } from "../utils/solicitud";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const AZUL = "#1a2035";

const fecha = (v) => {
  if (!v) return null;
  const [a, m, d] = String(v).substring(0, 10).split("-");
  return d ? `${d}/${m}/${a}` : null;
};

const edad = (v) => {
  if (!v) return null;
  const n = new Date(String(v).substring(0, 10) + "T00:00:00");
  if (isNaN(n)) return null;
  const hoy = new Date();
  let e = hoy.getFullYear() - n.getFullYear();
  if (hoy.getMonth() < n.getMonth() || (hoy.getMonth() === n.getMonth() && hoy.getDate() < n.getDate())) e--;
  return e;
};

function Dato({ etiqueta, valor, col = "col-12 col-sm-6 col-lg-4" }) {
  return (
    <div className={col}>
      <div className="small text-muted">{etiqueta}</div>
      <div className="fw-semibold text-break">{valor || <span className="text-muted fw-normal">—</span>}</div>
    </div>
  );
}

function Seccion({ icono, titulo, children }) {
  return (
    <div className="mb-4">
      <h6 className="fw-bold mb-3" style={{ color: AZUL }}>
        {icono}
        <span className="ms-2">{titulo}</span>
      </h6>
      {children}
    </div>
  );
}

export default function ExpedienteSocio({ idSocio, headers }) {
  const [datos, setDatos] = useState(null);
  const [laboral, setLaboral] = useState(undefined); // undefined = cargando, null = sin solicitudes

  useEffect(() => {
    let activo = true;
    axios
      .get(`${API_URL}/usuarios/${idSocio}`, { headers })
      .then((r) => activo && setDatos(r.data.data || r.data.usuario || r.data))
      .catch(() => activo && setDatos({}));
    axios
      .get(`${API_URL}/solicitudes/socio/${idSocio}`, { headers })
      .then((r) => activo && setLaboral((r.data.data || [])[0] || null))
      .catch(() => activo && setLaboral(null));
    return () => {
      activo = false;
    };
  }, [idSocio, headers]);

  const años = edad(datos?.fecha_nacimiento);

  return (
    <div>
      <Seccion icono={<FaUser />} titulo="Datos personales">
        {!datos ? (
          <div className="spinner-border spinner-border-sm text-success" />
        ) : (
          <div className="row g-3">
            <Dato etiqueta="Nombre completo" valor={datos.nombre_completo} />
            <Dato etiqueta="Identidad" valor={datos.dni} />
            <Dato
              etiqueta="Fecha de nacimiento"
              valor={fecha(datos.fecha_nacimiento) && `${fecha(datos.fecha_nacimiento)}${años != null ? ` (${años} años)` : ""}`}
            />
            <Dato etiqueta="Teléfono" valor={datos.telefono} />
            <Dato etiqueta="Correo" valor={datos.correo || datos.email} />
            <Dato etiqueta="Socio desde" valor={fecha(datos.fecha_registro)} />
            <Dato etiqueta="Dirección" valor={datos.direccion} col="col-12" />
          </div>
        )}
      </Seccion>

      <Seccion icono={<FaBriefcase />} titulo="Información laboral">
        {laboral === undefined ? (
          <div className="spinner-border spinner-border-sm text-success" />
        ) : !laboral ? (
          <div className="small text-muted">Se registra cuando el socio envía una solicitud de préstamo.</div>
        ) : (
          <div className="row g-3">
            <Dato etiqueta="Ocupación" valor={OCUPACIONES[laboral.ocupacion] || laboral.ocupacion} />
            <Dato etiqueta="Lugar de trabajo" valor={laboral.lugar_trabajo} />
            <Dato etiqueta="Ingreso mensual" valor={laboral.ingreso_mensual != null && fmt(laboral.ingreso_mensual)} />
            <div className="col-12 small text-muted">
              Según su solicitud del {fecha(laboral.creada_en)}.
            </div>
          </div>
        )}
      </Seccion>

      <Seccion icono={<FaIdCard />} titulo="Identidad (DNI)">
        <FotosIdentidad idSocio={idSocio} headers={headers} />
      </Seccion>
    </div>
  );
}
