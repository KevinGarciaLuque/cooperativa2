import { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { FaHandHoldingUsd, FaCheckCircle, FaExclamationTriangle, FaArrowLeft } from "react-icons/fa";
import { CamposMonto, CamposIngresos, AvisoRelacion } from "../components/CamposSolicitud";
import { SOLICITUD_VACIA, fmt, solicitudDesde, simular } from "../utils/solicitud";
import { CampoFotoIdentidad } from "../components/FotosIdentidad";
import { formatearNombre } from "../utils/nombres";
import { VerPoliticasPublicas } from "../components/PoliticasSocio";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const AZUL = "#1a2035";
const ACCENT = "#a8cd3a";

// Pantalla pública a la que llega el nuevo socio desde el enlace que comparte la cooperativa.
// Va por pasos: primero el préstamo que necesita (con su cuota estimada), luego sus datos y
// al final sus ingresos y referencias. Todo se envía junto en un solo registro.
export default function Registro() {
  const [params] = useSearchParams();
  const codigo = params.get("c") || "";
  const navigate = useNavigate();
  const { login } = useAuth();

  const [estado, setEstado] = useState(null); // { cooperativa, habilitado, valido, parametros }
  const [paso, setPaso] = useState(1);
  const [hayPoliticas, setHayPoliticas] = useState(false);
  const [verPoliticas, setVerPoliticas] = useState(false);
  const [quierePrestamo, setQuierePrestamo] = useState(true);
  const [solicitud, setSolicitud] = useState(SOLICITUD_VACIA);
  const [dni, setDni] = useState({ frente: null, reverso: null }); // fotos de la identidad
  const [form, setForm] = useState({
    nombre_completo: "",
    dni: "",
    telefono: "",
    correo: "",
    direccion: "",
    fecha_nacimiento: "",
    password: "",
    confirmar: "",
    acepta: false,
    website: "", // campo trampa
  });
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");

  // Si la cooperativa publicó sus políticas, se aceptan al registrarse
  useEffect(() => {
    axios
      .get(`${API_URL}/politicas/publicas`)
      .then((r) => setHayPoliticas((r.data.data || []).length > 0))
      .catch(() => setHayPoliticas(false));
  }, []);

  useEffect(() => {
    axios
      .get(`${API_URL}/registro/estado`, { params: { c: codigo } })
      .then((r) => setEstado(r.data))
      .catch(() => setEstado({ cooperativa: "SmartCoop", habilitado: false, valido: false, parametros: null }));
  }, [codigo]);

  const cambiar = (e) => {
    const { name, value, type, checked } = e.target;
    let v = type === "checkbox" ? checked : value;
    if (name === "dni") v = value.replace(/\D/g, "").slice(0, 13);
    if (name === "telefono") v = value.replace(/\D/g, "").slice(0, 8);
    setForm((f) => ({ ...f, [name]: v }));
  };

  const param = estado?.parametros;
  const totalPasos = quierePrestamo ? 3 : 2;
  const irA = (n) => {
    setError("");
    setPaso(n);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Paso 1: el préstamo que necesita
  const continuarPrestamo = (e) => {
    e.preventDefault();
    const monto = parseFloat(solicitud.monto) || 0;
    const plazo = parseInt(solicitud.plazo_meses) || 0;
    if (param && monto > param.monto_max) {
      setError(`El monto máximo es ${fmt(param.monto_max)}.`);
      return;
    }
    if (param && (plazo < 1 || plazo > param.plazo_max)) {
      setError(`El plazo debe estar entre 1 y ${param.plazo_max} meses.`);
      return;
    }
    setQuierePrestamo(true);
    irA(2);
  };

  const soloSocio = () => {
    setQuierePrestamo(false);
    irA(2);
  };

  // Reglas de la contraseña (las mismas que valida el servidor), visibles mientras se escribe
  const reglasPassword = [
    ["Al menos 8 caracteres", form.password.length >= 8],
    ["Letras", /[A-Za-z]/.test(form.password)],
    ["Números", /\d/.test(form.password)],
  ];
  const passwordValida = reglasPassword.every(([, ok]) => ok);
  const coinciden = form.confirmar !== "" && form.password === form.confirmar;

  const Regla = ({ ok, children }) => (
    <span className="me-3 text-nowrap" style={{ color: ok ? "#15803d" : "#94a3b8", fontWeight: ok ? 600 : 400 }}>
      {ok ? "✓" : "○"} {children}
    </span>
  );

  // Paso 2: datos personales
  const continuarDatos = (e) => {
    e.preventDefault();
    if (!passwordValida) {
      setError("La contraseña debe tener al menos 8 caracteres, con letras y números.");
      return;
    }
    if (form.password !== form.confirmar) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    if (!dni.frente || !dni.reverso) {
      setError("Adjunta las fotos del frente y del reverso de tu identidad.");
      return;
    }
    if (quierePrestamo) irA(3);
    else enviar();
  };

  const enviar = async (e) => {
    e?.preventDefault();
    setError("");
    if (!form.acepta) {
      setError("Debes aceptar que los datos son verdaderos.");
      return;
    }
    setEnviando(true);
    try {
      // Datos y fotos de la identidad van juntos en un solo envío
      const envio = new FormData();
      envio.append(
        "datos",
        JSON.stringify({
          nombre_completo: form.nombre_completo,
          dni: form.dni,
          telefono: form.telefono,
          correo: form.correo,
          direccion: form.direccion || undefined,
          fecha_nacimiento: form.fecha_nacimiento,
          password: form.password,
          codigo,
          prestamo: quierePrestamo ? solicitudDesde(solicitud, true) : undefined,
          website: form.website,
        })
      );
      envio.append("dni_frente", dni.frente);
      envio.append("dni_reverso", dni.reverso);
      await axios.post(`${API_URL}/registro`, envio);
      // Inicia sesión automáticamente: en su panel verá el estado de su solicitud
      const ok = await login(form.dni, form.password);
      navigate(ok === true ? "/perfil" : "/login");
    } catch (err) {
      setError(err.response?.data?.message || "No se pudo completar el registro. Intenta de nuevo.");
    } finally {
      setEnviando(false);
    }
  };

  const declaracion = (
    <div className="col-12">
      <div className="form-check">
        <input id="acepta" name="acepta" type="checkbox" className="form-check-input" checked={form.acepta} onChange={cambiar} />
        <label htmlFor="acepta" className="form-check-label small">
          Declaro que los datos son verdaderos y autorizo a la cooperativa a verificarlos y usarlos para gestionar mi
          membresía{quierePrestamo ? " y mi solicitud de préstamo" : ""}.
          {hayPoliticas && (
            <>
              {" "}También acepto las{" "}
              <button
                type="button"
                className="btn btn-link btn-sm p-0 align-baseline"
                onClick={(e) => {
                  e.preventDefault();
                  setVerPoliticas(true);
                }}
              >
                políticas de la cooperativa
              </button>
              .
            </>
          )}
        </label>
      </div>
      {verPoliticas && <VerPoliticasPublicas onCerrar={() => setVerPoliticas(false)} />}
    </div>
  );

  const avisoError = error && (
    <div className="col-12">
      <div className="alert alert-danger py-2 mb-0">{error}</div>
    </div>
  );

  const botonPrincipal = (texto, textoEnviando) => (
    <button
      type="submit"
      className="btn btn-lg w-100 fw-bold"
      style={{ background: ACCENT, color: "#1a2a00", borderRadius: 12 }}
      disabled={enviando}
    >
      {enviando ? textoEnviando : texto}
    </button>
  );

  const volver = (n) => (
    <button type="button" className="btn btn-link text-decoration-none px-0 mb-2" style={{ color: AZUL }} onClick={() => irA(n)}>
      <FaArrowLeft className="me-1" /> Atrás
    </button>
  );

  const titulos = {
    1: "Tu préstamo",
    2: "Tus datos",
    3: "Tus ingresos y referencias",
  };

  const campo = (etiqueta, nombre, props = {}) => (
    <div className={props.col || "col-12"}>
      <label className="form-label fw-semibold small">
        {etiqueta} {props.requerido && <span className="text-danger">*</span>}
      </label>
      <input
        className="form-control form-control-lg"
        style={{ borderRadius: 10 }}
        name={nombre}
        value={form[nombre]}
        onChange={cambiar}
        {...props.input}
      />
      {props.ayuda && <div className="form-text">{props.ayuda}</div>}
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(160deg, #1a2035 0%, #2c3e50 100%)", padding: "24px 12px" }}>
      <div className="container" style={{ maxWidth: 640 }}>
        <div className="text-center text-white mb-4">
          <div
            className="d-inline-flex align-items-center justify-content-center mb-2"
            style={{ width: 64, height: 64, borderRadius: "50%", background: ACCENT, color: "#1a2a00" }}
          >
            <FaHandHoldingUsd size={26} />
          </div>
          <h2 className="fw-bold mb-1">Solicita tu préstamo en {estado?.cooperativa || "la cooperativa"}</h2>
          <div style={{ opacity: 0.8 }}>Calcula tu cuota, hazte socio y envía tu solicitud en pocos minutos.</div>
        </div>

        <div className="p-4" style={{ background: "#fff", borderRadius: 18, boxShadow: "0 12px 40px rgba(0,0,0,.25)" }}>
          {!estado && (
            <div className="text-center py-4">
              <div className="spinner-border text-success" />
            </div>
          )}

          {estado && !estado.valido && (
            <div className="text-center py-4">
              <FaExclamationTriangle size={36} color="#f39c12" />
              <h5 className="fw-bold mt-3">Este enlace no está disponible</h5>
              <p className="text-muted mb-0">
                {estado.habilitado
                  ? "El enlace de registro no es válido o ya venció. Pide uno nuevo a la cooperativa."
                  : "El registro de nuevos socios está cerrado por el momento."}
              </p>
            </div>
          )}

          {estado && estado.valido && (
            <>
              <div className="d-flex justify-content-between align-items-baseline mb-1">
                <h5 className="fw-bold mb-0">{titulos[paso]}</h5>
                <span className="small text-muted text-nowrap ms-2">
                  Paso {paso} de {totalPasos}
                </span>
              </div>
              <div className="progress mb-4" style={{ height: 6 }}>
                <div className="progress-bar" style={{ width: `${(paso / totalPasos) * 100}%`, background: ACCENT }} />
              </div>

              {/* Paso 1: el préstamo */}
              {paso === 1 && (
                <form onSubmit={continuarPrestamo}>
                  <CamposMonto param={param} form={solicitud} setForm={setSolicitud} />
                  <div className="row g-3 mt-0">
                    {avisoError}
                    <div className="col-12">{botonPrincipal("Continuar", "")}</div>
                    <div className="col-12 text-center">
                      <button type="button" className="btn btn-link small text-decoration-none" style={{ color: AZUL }} onClick={soloSocio}>
                        Solo quiero hacerme socio, sin préstamo por ahora
                      </button>
                    </div>
                  </div>
                </form>
              )}

              {/* Paso 2: datos personales */}
              {paso === 2 && (
                <form onSubmit={continuarDatos}>
                  {volver(1)}
                  {quierePrestamo && simular(param, solicitud).cuotaEstimada > 0 && (
                    <div className="small mb-3 p-2 px-3" style={{ background: "#f0f7e6", borderRadius: 10 }}>
                      Préstamo de <strong>{fmt(solicitud.monto)}</strong> a {solicitud.plazo_meses} meses · cuota estimada{" "}
                      <strong>{fmt(simular(param, solicitud).cuotaEstimada)}</strong>
                    </div>
                  )}
                  <div className="row g-3">
                    {campo("Nombre completo", "nombre_completo", {
                      requerido: true,
                      input: {
                        required: true,
                        maxLength: 100,
                        placeholder: "Nombre y apellidos",
                        autoComplete: "name",
                        autoCapitalize: "words",
                        onBlur: () => setForm((f) => ({ ...f, nombre_completo: formatearNombre(f.nombre_completo) })),
                      },
                    })}
                    {campo("Número de identidad", "dni", {
                      requerido: true,
                      col: "col-12 col-md-6",
                      ayuda: "13 dígitos, sin guiones.",
                      input: { required: true, inputMode: "numeric", placeholder: "0801199012345", autoComplete: "off" },
                    })}
                    {campo("Teléfono (WhatsApp)", "telefono", {
                      requerido: true,
                      col: "col-12 col-md-6",
                      ayuda: "8 dígitos.",
                      input: { required: true, inputMode: "numeric", placeholder: "98765432", autoComplete: "tel" },
                    })}
                    {campo("Fecha de nacimiento", "fecha_nacimiento", {
                      requerido: true,
                      col: "col-12 col-md-6",
                      input: { type: "date", required: true },
                    })}
                    {campo("Correo electrónico", "correo", {
                      requerido: true,
                      col: "col-12 col-md-6",
                      ayuda: "Aquí recibirás tus recibos.",
                      input: { type: "email", required: true, maxLength: 100, placeholder: "tucorreo@ejemplo.com", autoComplete: "email" },
                    })}
                    {campo("Dirección", "direccion", {
                      input: { maxLength: 200, placeholder: "Colonia, barrio o aldea y municipio", autoComplete: "street-address" },
                    })}
                    {campo("Contraseña", "password", {
                      requerido: true,
                      col: "col-12 col-md-6",
                      ayuda: (
                        <span className="d-flex flex-wrap">
                          {reglasPassword.map(([texto, ok]) => (
                            <Regla key={texto} ok={ok}>{texto}</Regla>
                          ))}
                        </span>
                      ),
                      input: { type: "password", required: true, autoComplete: "new-password" },
                    })}
                    {campo("Confirmar contraseña", "confirmar", {
                      requerido: true,
                      col: "col-12 col-md-6",
                      ayuda:
                        form.confirmar === "" ? null : coinciden ? (
                          <Regla ok>Las contraseñas coinciden</Regla>
                        ) : (
                          <span style={{ color: "#dc2626" }}>✗ Las contraseñas no coinciden</span>
                        ),
                      input: { type: "password", required: true, autoComplete: "new-password" },
                    })}

                    <div className="col-12">
                      <div className="fw-semibold small mb-1">Fotos de tu identidad</div>
                      <div className="form-text mt-0 mb-2">
                        Toma una foto clara de cada lado de tu tarjeta de identidad, donde se lean los datos.
                      </div>
                      <div className="row g-2">
                        <div className="col-6">
                          <CampoFotoIdentidad
                            etiqueta="Frente"
                            archivo={dni.frente}
                            onChange={(f) => { setError(""); setDni((d) => ({ ...d, frente: f })); }}
                          />
                        </div>
                        <div className="col-6">
                          <CampoFotoIdentidad
                            etiqueta="Reverso"
                            archivo={dni.reverso}
                            onChange={(f) => { setError(""); setDni((d) => ({ ...d, reverso: f })); }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Campo trampa para robots: oculto para las personas */}
                    <div style={{ position: "absolute", left: "-9999px" }} aria-hidden="true">
                      <input name="website" tabIndex={-1} autoComplete="off" value={form.website} onChange={cambiar} />
                    </div>

                    {!quierePrestamo && declaracion}
                    {avisoError}
                    <div className="col-12">
                      {quierePrestamo ? botonPrincipal("Continuar", "") : botonPrincipal("Crear mi cuenta", "Creando tu cuenta...")}
                    </div>
                  </div>
                </form>
              )}

              {/* Paso 3: ingresos y referencias */}
              {paso === 3 && (
                <form onSubmit={enviar}>
                  {volver(2)}
                  <CamposIngresos form={solicitud} setForm={setSolicitud} />
                  <AvisoRelacion sim={simular(param, solicitud)} />
                  <div className="row g-3 mt-0">
                    {declaracion}
                    {avisoError}
                    <div className="col-12">{botonPrincipal("Enviar mi solicitud", "Enviando tu solicitud...")}</div>
                  </div>
                </form>
              )}

              <div className="text-center small text-muted mt-3">
                <FaCheckCircle className="me-1 text-success" />
                La cooperativa revisará tus datos{quierePrestamo ? " y tu solicitud" : ""} y te responderá por correo.
              </div>
              <div className="text-center small mt-2">
                ¿Ya tienes cuenta?{" "}
                <a href="/login" style={{ color: AZUL, fontWeight: 600 }}>
                  Inicia sesión
                </a>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
