// Control por acción (después de la sesión y los permisos de módulo):
//  - Permisos por acción y solo lectura (función "permisos_por_accion")
//  - Segregación de funciones (función "segregacion_funciones")
// El Super Administrador y los socios no pasan por aquí (los socios ya tienen sus reglas).
const pool = require("../db");
const funciones = require("../utils/funciones");
const { accionDe, nombreDe, datosDelRol, PERMITIDO_SOLO_LECTURA } = require("../utils/acciones");

const prohibido = (res, message) => res.status(403).json({ message });

// ¿Quién registró la operación que se quiere aprobar, desembolsar, anular o corregir?
const registradoPor = async (accion, metodo, ruta) => {
  let m;
  if ((m = ruta.match(/^\/prestamos\/(\d+)\/(aprobar|desembolsar)$/)) || (m = ruta.match(/^\/solicitudes\/prestamos\/(\d+)\/aprobar$/))) {
    const [[p]] = await pool.query("SELECT creado_por FROM prestamos WHERE id_prestamo = ?", [m[1]]);
    return { quien: p?.creado_por, que: "este crédito", verbo: ruta.endsWith("desembolsar") ? "desembolsarlo" : "aprobarlo" };
  }
  const porCaja = async (tipoRef, id, que) => {
    const [[c]] = await pool.query(
      "SELECT id_registrado_por FROM caja_movimientos WHERE referencia_tipo = ? AND referencia_id = ? ORDER BY id_movimiento LIMIT 1",
      [tipoRef, id]
    );
    return { quien: c?.id_registrado_por, que, verbo: metodo === "DELETE" ? "anularlo" : "corregirlo" };
  };
  if ((m = ruta.match(/^\/pagos\/(\d+)$/)) && ["PUT", "DELETE"].includes(metodo)) return porCaja("pago", m[1], "este pago");
  if ((m = ruta.match(/^\/movimientos\/(\d+)$/)) && ["PUT", "DELETE"].includes(metodo)) return porCaja("movimiento_cuenta", m[1], "este movimiento");
  if ((m = ruta.match(/^\/aportaciones\/(\d+)$/)) && ["PUT", "DELETE"].includes(metodo)) return porCaja("aportacion", m[1], "esta aportación");
  return null;
};

const controlAcciones = async (req, res, next) => {
  try {
    const u = req.usuario;
    if (!u || u.rol === "Super Administrador" || u.rol === "Socio" || req.method === "GET" || req.method === "OPTIONS") return next();
    const estado = await funciones.leer();
    if (!estado.permisos_por_accion && !estado.segregacion_funciones) return next();
    const ruta = req.path;

    if (estado.permisos_por_accion) {
      const rol = await datosDelRol(u.rol_id);
      // Solo lectura (auditor, junta de vigilancia): nada que cambie datos, salvo su propia sesión
      if (rol.solo_lectura && !PERMITIDO_SOLO_LECTURA.some((re) => re.test(ruta))) {
        return prohibido(res, "Tu rol es de solo lectura: puedes consultar, pero no hacer cambios.");
      }
      const accion = accionDe(req.method, ruta, req.body);
      // Sin configurar = permitido (encender la función no le quita nada a nadie)
      if (accion && rol.acciones[accion] === false) {
        return prohibido(res, `Tu rol no tiene permiso para: ${nombreDe(accion).toLowerCase()}.`);
      }
    }

    if (estado.segregacion_funciones) {
      const r = await registradoPor(accionDe(req.method, ruta, req.body), req.method, ruta);
      if (r && r.quien && r.quien === u.id_usuario) {
        return prohibido(res, `Registraste ${r.que}: otra persona debe ${r.verbo} (segregación de funciones).`);
      }
    }
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = { controlAcciones };
