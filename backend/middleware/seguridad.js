const jwt = require("jsonwebtoken");
const pool = require("../db");

const SUPER_ADMIN = "Super Administrador";

// ── Rutas públicas (no requieren sesión) ──────────────────────────────────
const PUBLICAS = [
  { metodo: "POST", re: /^\/usuarios\/login$/ },
  { metodo: "*", re: /^\/recuperar(\/.*)?$/ },
  { metodo: "GET", re: /^\/configuracion$/ }, // logo y nombre para la pantalla de login
  { metodo: "GET", re: /^\/registro\/estado$/ },
  { metodo: "POST", re: /^\/registro$/ },
];

// Primer segmento de la ruta → módulo de permisos (los mismos del menú)
const MODULO_POR_PREFIJO = {
  usuarios: "usuarios",
  roles: "roles",
  cuentas: "cuentas",
  prestamos: "prestamos",
  aportaciones: "aportaciones",
  pagos: "pagos",
  movimientos: "movimientos",
  reportes: "reportes",
  actividades: "actividades",
  liquidaciones: "liquidaciones",
  bitacora: "bitacora",
  basedatos: "basedatos",
  dashboard: "dashboard",
  caja: "caja",
  cobranza: "cobranza",
  solicitudes: "prestamos",
  contabilidad: "contabilidad",
  recibos: "pagos",
  socios: "usuarios",
};

// ── Qué puede consultar/hacer un Socio: solo lo suyo ──────────────────────
const SQL_PRESTAMO = "SELECT id_usuario FROM prestamos WHERE id_prestamo = ?";
const SQL_CUENTA = "SELECT id_usuario FROM cuentas WHERE id_cuenta = ?";
const SQL_RECIBO = "SELECT id_socio AS id_usuario FROM recibos WHERE id_recibo = ?";
const REGLAS_SOCIO = [
  // Permitidas también para un socio que aún no ha sido aprobado
  { metodo: "GET", re: /^\/usuarios\/(\d+)$/, propio: 1, pendiente: true },
  { metodo: "POST", re: /^\/usuarios\/(\d+)\/cambiar-password$/, propio: 1, pendiente: true },
  { metodo: "GET", re: /^\/prestamos$/, forzarUsuario: true, pendiente: true },
  { metodo: "GET", re: /^\/solicitudes\/(parametros|mias)$/, libre: true, pendiente: true },
  { metodo: "POST", re: /^\/solicitudes\/prestamo$/, libre: true, pendiente: true },
  { metodo: "GET", re: /^\/socios\/(\d+)\/identidad(\/(frente|reverso))?$/, propio: 1, pendiente: true },
  { metodo: "POST", re: /^\/socios\/(\d+)\/identidad\/(frente|reverso)$/, propio: 1, pendiente: true },
  { metodo: "GET", re: /^\/socios\/(\d+)\/estado-cuenta$/, propio: 1 },
  { metodo: "PUT", re: /^\/usuarios\/(\d+)\/foto$/, propio: 1 },
  { metodo: "POST", re: /^\/usuarios\/(\d+)\/cambiar-password$/, propio: 1 },
  { metodo: "GET", re: /^\/(cuentas|aportaciones|prestamos|pagos)$/, forzarUsuario: true },
  { metodo: "GET", re: /^\/(cuentas|aportaciones|prestamos)\/usuario\/(\d+)$/, propio: 2 },
  { metodo: "GET", re: /^\/pagos\/usuario\/(\d+)\/historial$/, propio: 1 },
  { metodo: "GET", re: /^\/movimientos\/usuario\/(\d+)$/, propio: 1 },
  { metodo: "GET", re: /^\/cuentas\/(\d+)(\/estado-cuenta)?$/, sql: SQL_CUENTA, id: 1 },
  { metodo: "GET", re: /^\/movimientos\/cuenta\/(\d+)$/, sql: SQL_CUENTA, id: 1 },
  { metodo: "GET", re: /^\/aportaciones\/(\d+)$/, sql: "SELECT id_usuario FROM aportaciones WHERE id_aportacion = ?", id: 1 },
  { metodo: "GET", re: /^\/prestamos\/(\d+)$/, sql: SQL_PRESTAMO, id: 1 },
  { metodo: "GET", re: /^\/recibos\/finiquito\/(\d+)$/, sql: SQL_PRESTAMO, id: 1 },
  { metodo: "GET", re: /^\/solicitudes\/prestamos\/(\d+)\/carta$/, sql: SQL_PRESTAMO, id: 1 },
  { metodo: "GET", re: /^\/recibos\/socio\/(\d+)$/, propio: 1 },
  { metodo: "GET", re: /^\/recibos\/(\d+)$/, sql: SQL_RECIBO, id: 1 },
  { metodo: "GET", re: /^\/recibos\/(\d+)\/comprobante-firmado$/, sql: SQL_RECIBO, id: 1 },
  { metodo: "POST", re: /^\/recibos\/(\d+)\/comprobante-firmado$/, sql: SQL_RECIBO, id: 1 },
  { metodo: "GET", re: /^\/pagos\/prestamo\/(\d+)(\/proximo-pago)?$/, sql: SQL_PRESTAMO, id: 1 },
  {
    metodo: "GET",
    re: /^\/pagos\/(\d+)(\/comprobante)?$/,
    sql: "SELECT pr.id_usuario FROM pagos_prestamo p INNER JOIN prestamos pr ON p.id_prestamo = pr.id_prestamo WHERE p.id_pago = ?",
    id: 1,
  },
];

// ── Cachés cortos para no consultar la base en cada petición ─────────────
const TTL = 20 * 1000;
const cachePermisos = new Map(); // rol_id -> { t, mapa }
const cacheEstado = new Map(); // id_usuario -> { t, estado }

const permisosDelRol = async (rolId) => {
  const c = cachePermisos.get(rolId);
  if (c && Date.now() - c.t < TTL) return c.mapa;
  const [rows] = await pool.query(
    "SELECT modulo, activo FROM permisos_modulos WHERE rol_id = ?",
    [rolId]
  );
  const mapa = {};
  rows.forEach((r) => {
    mapa[r.modulo] = r.activo === 1;
  });
  cachePermisos.set(rolId, { t: Date.now(), mapa });
  return mapa;
};

const estadoDelUsuario = async (idUsuario) => {
  const c = cacheEstado.get(idUsuario);
  if (c && Date.now() - c.t < TTL) return c.estado;
  const [rows] = await pool.query("SELECT estado FROM usuarios WHERE id_usuario = ?", [idUsuario]);
  const estado = rows.length ? rows[0].estado : null;
  cacheEstado.set(idUsuario, { t: Date.now(), estado });
  return estado;
};

const prohibido = (res, mensaje = "No tienes permiso para realizar esta acción.") =>
  res.status(403).json({ message: mensaje });

// ── Elimina datos internos de cualquier respuesta ────────────────────────
const CAMPOS_SECRETOS = new Set(["password", "reset_token", "reset_token_expiry"]);
const limpiarSecretosEn = (valor) => {
  if (Array.isArray(valor)) return valor.map(limpiarSecretosEn);
  if (valor && typeof valor === "object" && !(valor instanceof Date) && !Buffer.isBuffer(valor)) {
    const salida = {};
    for (const [k, v] of Object.entries(valor)) {
      if (!CAMPOS_SECRETOS.has(k)) salida[k] = limpiarSecretosEn(v);
    }
    return salida;
  }
  return valor;
};

const limpiarRespuestas = (req, res, next) => {
  const jsonOriginal = res.json.bind(res);
  res.json = (body) => {
    const salida = limpiarSecretosEn(body);
    // En errores de servidor no se expone el detalle interno al cliente
    if (res.statusCode >= 500 && salida && typeof salida === "object" && "error" in salida) {
      delete salida.error;
    }
    return jsonOriginal(salida);
  };
  next();
};

// ── Guardia principal: sesión + permisos ─────────────────────────────────
const guardiaApi = async (req, res, next) => {
  try {
    const ruta = req.path;
    const metodo = req.method;

    if (metodo === "OPTIONS") return next();
    if (PUBLICAS.some((p) => (p.metodo === "*" || p.metodo === metodo) && p.re.test(ruta))) {
      return next();
    }

    // 1. Sesión válida
    const token = req.header("Authorization")?.replace("Bearer ", "");
    if (!token) return res.status(401).json({ message: "Token no proporcionado" });

    let usuario;
    try {
      usuario = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ message: "Token inválido o expirado" });
    }
    // Los tokens de recuperación de contraseña no son sesiones
    if (!usuario.id_usuario || !usuario.rol) {
      return res.status(401).json({ message: "Token inválido o expirado" });
    }
    req.usuario = usuario;

    // 2. El usuario debe seguir activo (un socio nuevo puede estar pendiente de aprobación)
    const estado = await estadoDelUsuario(usuario.id_usuario);
    const socioPendiente = estado === "pendiente" && usuario.rol === "Socio";
    if (estado !== "activo" && !socioPendiente) {
      return res.status(401).json({ message: "Tu cuenta está inactiva o ya no existe." });
    }

    // 3. Super Administrador: acceso total
    if (usuario.rol === SUPER_ADMIN) return next();

    // 4. Socio: solo sus propios datos
    if (usuario.rol === "Socio") {
      // Comprobante de desembolso de un préstamo propio (se busca por la operación)
      if (metodo === "GET" && ruta === "/recibos/buscar" && !socioPendiente) {
        if (req.query.referencia_tipo === "prestamo" && /^\d+$/.test(String(req.query.referencia_id || ""))) {
          const [pr] = await pool.query(SQL_PRESTAMO, [req.query.referencia_id]);
          if (pr.length && pr[0].id_usuario === usuario.id_usuario) return next();
        }
        return prohibido(res);
      }

      for (const regla of REGLAS_SOCIO) {
        if (regla.metodo !== metodo) continue;
        const m = regla.re.exec(ruta);
        if (!m) continue;
        if (socioPendiente && !regla.pendiente) continue;

        if (regla.libre) return next();

        if (regla.forzarUsuario) {
          req.query.id_usuario = String(usuario.id_usuario);
          return next();
        }
        if (regla.propio) {
          return parseInt(m[regla.propio]) === usuario.id_usuario ? next() : prohibido(res);
        }
        if (regla.sql) {
          const [rows] = await pool.query(regla.sql, [m[regla.id]]);
          return rows.length && rows[0].id_usuario === usuario.id_usuario ? next() : prohibido(res);
        }
      }
      return socioPendiente
        ? prohibido(res, "Tu cuenta está pendiente de aprobación por la cooperativa.")
        : prohibido(res);
    }

    // 5. Resto del personal: permisos por módulo del rol
    const segmento = ruta.split("/")[1] || "";
    const modulo = MODULO_POR_PREFIJO[segmento];
    if (!modulo) return next(); // permisos, configuración: validan en su propia ruta

    const esEscritura = metodo !== "GET";
    const propioId = (ruta.match(/^\/usuarios\/(\d+)(\/|$)/) || [])[1];
    const esPropioPerfil =
      segmento === "usuarios" && propioId && parseInt(propioId) === usuario.id_usuario;

    const permisos = await permisosDelRol(usuario.rol_id);
    const tieneModulo = permisos[modulo] !== false;
    const lecturaCatalogo = !esEscritura && ["usuarios", "roles", "socios"].includes(segmento);

    // Su propia actividad reciente (pantalla Mi Perfil) siempre es visible para el usuario
    const bitacoraPropia = (ruta.match(/^\/bitacora\/usuario\/(\d+)$/) || [])[1];
    const esBitacoraPropia =
      metodo === "GET" && bitacoraPropia && parseInt(bitacoraPropia) === usuario.id_usuario;

    if (!tieneModulo && !lecturaCatalogo && !esPropioPerfil && !esBitacoraPropia) {
      return prohibido(res, "Tu rol no tiene acceso a este módulo.");
    }

    // Sin acceso al módulo, solo puede editar su propio perfil (sin cambiar rol ni estado)
    if (!tieneModulo && esPropioPerfil && esEscritura && req.body) {
      delete req.body.rol_id;
      delete req.body.estado;
    }

    // 6. Solo el Super Administrador crea o modifica Super Administradores
    if (segmento === "usuarios" && ["POST", "PUT", "DELETE"].includes(metodo)) {
      if (req.body?.rol_id) {
        const [r] = await pool.query("SELECT nombre FROM roles WHERE id_rol = ?", [req.body.rol_id]);
        if (r.length && r[0].nombre === SUPER_ADMIN) {
          return prohibido(res, "Solo el Super Administrador puede asignar ese rol.");
        }
      }
      if (propioId && !esPropioPerfil) {
        const [t] = await pool.query(
          "SELECT r.nombre FROM usuarios u INNER JOIN roles r ON u.rol_id = r.id_rol WHERE u.id_usuario = ?",
          [propioId]
        );
        if (t.length && t[0].nombre === SUPER_ADMIN) {
          return prohibido(res, "Solo el Super Administrador puede modificar a otro Super Administrador.");
        }
      }
    }

    next();
  } catch (error) {
    console.error("ERROR EN GUARDIA DE API:", error);
    res.status(500).json({ message: "Error verificando permisos" });
  }
};

// Fuerza que el cambio de estado de un usuario se vea de inmediato
const invalidarEstado = (idUsuario) => cacheEstado.delete(idUsuario);

module.exports = { guardiaApi, limpiarRespuestas, invalidarEstado };
