import { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { FaUserPlus, FaCheckCircle, FaExclamationTriangle } from "react-icons/fa";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const AZUL = "#1a2035";
const ACCENT = "#a8cd3a";

// Pantalla pública a la que llega el nuevo socio desde el enlace que comparte la cooperativa
export default function Registro() {
  const [params] = useSearchParams();
  const codigo = params.get("c") || "";
  const navigate = useNavigate();
  const { login } = useAuth();

  const [estado, setEstado] = useState(null); // { cooperativa, habilitado, valido }
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

  useEffect(() => {
    axios
      .get(`${API_URL}/registro/estado`, { params: { c: codigo } })
      .then((r) => setEstado(r.data))
      .catch(() => setEstado({ cooperativa: "Cooperativa", habilitado: false, valido: false }));
  }, [codigo]);

  const cambiar = (e) => {
    const { name, value, type, checked } = e.target;
    let v = type === "checkbox" ? checked : value;
    if (name === "dni") v = value.replace(/\D/g, "").slice(0, 13);
    if (name === "telefono") v = value.replace(/\D/g, "").slice(0, 8);
    setForm((f) => ({ ...f, [name]: v }));
  };

  const enviar = async (e) => {
    e.preventDefault();
    setError("");
    if (form.password !== form.confirmar) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    if (!form.acepta) {
      setError("Debes aceptar que los datos son verdaderos.");
      return;
    }
    setEnviando(true);
    try {
      await axios.post(`${API_URL}/registro`, {
        nombre_completo: form.nombre_completo,
        dni: form.dni,
        telefono: form.telefono,
        correo: form.correo,
        direccion: form.direccion || undefined,
        fecha_nacimiento: form.fecha_nacimiento,
        password: form.password,
        codigo,
        website: form.website,
      });
      // Inicia sesión automáticamente para que pueda enviar su solicitud de préstamo
      const ok = await login(form.dni, form.password);
      navigate(ok === true ? "/perfil" : "/login");
    } catch (err) {
      setError(err.response?.data?.message || "No se pudo completar el registro. Intenta de nuevo.");
    } finally {
      setEnviando(false);
    }
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
            <FaUserPlus size={26} />
          </div>
          <h2 className="fw-bold mb-1">Únete a {estado?.cooperativa || "la cooperativa"}</h2>
          <div style={{ opacity: 0.8 }}>Crea tu cuenta de socio en pocos minutos.</div>
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
            <form onSubmit={enviar}>
              <div className="row g-3">
                {campo("Nombre completo", "nombre_completo", {
                  requerido: true,
                  input: { required: true, maxLength: 100, placeholder: "Nombre y apellidos", autoComplete: "name" },
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
                  ayuda: "Mínimo 8 caracteres, con letras y números.",
                  input: { type: "password", required: true, autoComplete: "new-password" },
                })}
                {campo("Confirmar contraseña", "confirmar", {
                  requerido: true,
                  col: "col-12 col-md-6",
                  input: { type: "password", required: true, autoComplete: "new-password" },
                })}

                {/* Campo trampa para robots: oculto para las personas */}
                <div style={{ position: "absolute", left: "-9999px" }} aria-hidden="true">
                  <input name="website" tabIndex={-1} autoComplete="off" value={form.website} onChange={cambiar} />
                </div>

                <div className="col-12">
                  <div className="form-check">
                    <input id="acepta" name="acepta" type="checkbox" className="form-check-input" checked={form.acepta} onChange={cambiar} />
                    <label htmlFor="acepta" className="form-check-label small">
                      Declaro que los datos son verdaderos y autorizo a la cooperativa a usarlos para gestionar mi
                      membresía.
                    </label>
                  </div>
                </div>

                {error && (
                  <div className="col-12">
                    <div className="alert alert-danger py-2 mb-0">{error}</div>
                  </div>
                )}

                <div className="col-12">
                  <button
                    type="submit"
                    className="btn btn-lg w-100 fw-bold"
                    style={{ background: ACCENT, color: "#1a2a00", borderRadius: 12 }}
                    disabled={enviando}
                  >
                    {enviando ? "Creando tu cuenta..." : "Crear mi cuenta"}
                  </button>
                  <div className="text-center small text-muted mt-3">
                    <FaCheckCircle className="me-1 text-success" />
                    Tu cuenta quedará pendiente hasta que la cooperativa la apruebe.
                  </div>
                  <div className="text-center small mt-2">
                    ¿Ya tienes cuenta?{" "}
                    <a href="/login" style={{ color: AZUL, fontWeight: 600 }}>
                      Inicia sesión
                    </a>
                  </div>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
