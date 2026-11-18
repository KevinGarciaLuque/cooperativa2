// Sucursales: qué sucursal está viendo cada usuario del personal.
//
// - Cada socio pertenece a una sucursal (usuarios.id_sucursal; vacío = la principal). Su
//   cartera (préstamos, cuentas, aportaciones, solicitudes) se ve en las listas de esa sucursal,
//   pero puede pagar o depositar en cualquiera.
// - Cada movimiento de caja queda en la sucursal donde se hizo (caja_movimientos.id_sucursal).
// - El personal elige en la barra superior qué sucursal ver (cabecera X-Sucursal: un id o vacío
//   para todas). Un usuario con "sucursal_restringida" ve siempre solo la suya en las listas,
//   aunque puede buscar y atender a un socio de otra sucursal.
const pool = require("../db");

let principalCache = null;
const sucursalPrincipal = async (conn = pool) => {
  if (principalCache) return principalCache;
  try {
    const [[s]] = await conn.query("SELECT id_sucursal FROM sucursales ORDER BY id_sucursal LIMIT 1");
    principalCache = s?.id_sucursal || null;
  } catch {
    principalCache = null;
  }
  return principalCache;
};
const olvidarPrincipal = () => {
  principalCache = null;
};

// Datos de sucursal del usuario (con caché corta, como los permisos)
const cache = new Map();
const datosUsuario = async (idUsuario) => {
  const c = cache.get(idUsuario);
  if (c && Date.now() - c.t < 30 * 1000) return c.d;
  let d = { id_sucursal: null, restringida: false };
  try {
    const [[u]] = await pool.query("SELECT id_sucursal, sucursal_restringida FROM usuarios WHERE id_usuario = ?", [idUsuario]);
    if (u) d = { id_sucursal: u.id_sucursal, restringida: !!u.sucursal_restringida };
  } catch {}
  cache.set(idUsuario, { t: Date.now(), d });
  return d;
};
const olvidarUsuario = (idUsuario) => cache.delete(idUsuario);

// Sucursal que el usuario está viendo: un id, o null = todas
const sucursalVista = async (req) => {
  const u = req.usuario;
  if (!u || u.rol === "Socio") return null;
  const d = await datosUsuario(u.id_usuario);
  if (d.restringida) return d.id_sucursal || (await sucursalPrincipal());
  const pedida = parseInt(req.get?.("X-Sucursal") || req.headers?.["x-sucursal"] || req.query?.id_sucursal);
  return pedida > 0 ? pedida : null;
};

// Condición SQL para la sucursal del socio (alias de la tabla usuarios).
// Con `explicito` (se pidió un socio o una búsqueda concreta) no se filtra: un socio puede ser
// atendido en cualquier sucursal.
const filtroSocio = async (req, alias = "u", explicito = false) => {
  if (explicito) return { sql: "", params: [] };
  const id = await sucursalVista(req);
  if (!id) return { sql: "", params: [] };
  const principal = await sucursalPrincipal();
  return { sql: ` AND IFNULL(${alias}.id_sucursal, ?) = ?`, params: [principal, id] };
};

// Condición SQL "de socios de la sucursal" para una columna con el id del socio, sin unir tablas
// (por ejemplo, prestamos.id_usuario). Devuelve { sql, params } o vacío si se ven todas.
const deSociosDeSucursal = async (req, columna) => {
  const id = await sucursalVista(req);
  if (!id) return { sql: "", params: [] };
  const principal = await sucursalPrincipal();
  return {
    sql: ` AND ${columna} IN (SELECT id_usuario FROM usuarios WHERE IFNULL(id_sucursal, ?) = ?)`,
    params: [principal, id],
  };
};

// Para pantallas con muchas consultas (dashboard): devuelve una función como pool.query que,
// con una sucursal elegida, lee las tablas de socios solo con los datos de los socios de esa
// sucursal. Cada "FROM/JOIN tabla" se cambia por una subconsulta filtrada con el mismo nombre
// (o alias), así la consulta original no cambia. Los ids van como números (no hay texto del
// usuario en el SQL). Actividades y liquidaciones son de toda la cooperativa: no se filtran.
const TABLAS_DE_SOCIOS = ["usuarios", "prestamos", "aportaciones", "cuentas", "pagos_prestamo", "movimientos_cuenta", "liquidacion_socios"];
const PALABRAS = new Set(["where", "left", "right", "inner", "join", "on", "group", "order", "limit", "having", "cross", "union", "and", "or", "set"]);
const consultaPorSucursal = async (req, conn = pool) => {
  const id = parseInt(await sucursalVista(req));
  if (!id) return (sql, params) => conn.query(sql, params);
  const principal = parseInt(await sucursalPrincipal()) || 0;
  const socios = `SELECT su.id_usuario FROM usuarios su WHERE IFNULL(su.id_sucursal, ${principal}) = ${id}`;
  const sub = {
    usuarios: `SELECT * FROM usuarios WHERE IFNULL(id_sucursal, ${principal}) = ${id}`,
    prestamos: `SELECT * FROM prestamos WHERE id_usuario IN (${socios})`,
    aportaciones: `SELECT * FROM aportaciones WHERE id_usuario IN (${socios})`,
    cuentas: `SELECT * FROM cuentas WHERE id_usuario IN (${socios})`,
    liquidacion_socios: `SELECT * FROM liquidacion_socios WHERE id_usuario IN (${socios})`,
    pagos_prestamo: `SELECT * FROM pagos_prestamo WHERE id_prestamo IN (SELECT sp.id_prestamo FROM prestamos sp WHERE sp.id_usuario IN (${socios}))`,
    movimientos_cuenta: `SELECT * FROM movimientos_cuenta WHERE id_cuenta IN (SELECT sc.id_cuenta FROM cuentas sc WHERE sc.id_usuario IN (${socios}))`,
  };
  const re = new RegExp(`\\b(FROM|JOIN)\\s+(${TABLAS_DE_SOCIOS.join("|")})\\b(\\s+(?:AS\\s+)?([A-Za-z_][A-Za-z0-9_]*))?`, "gi");
  const reescribir = (sql) =>
    sql.replace(re, (todo, palabra, tabla, conAlias, alias) => {
      const t = tabla.toLowerCase();
      if (alias && !PALABRAS.has(alias.toLowerCase())) return `${palabra} (${sub[t]}) AS ${alias}`;
      return `${palabra} (${sub[t]}) AS ${tabla}${conAlias || ""}`;
    });
  return (sql, params) => conn.query(reescribir(sql), params);
};

// Condición SQL para la sucursal donde se hizo un movimiento de caja (alias de caja_movimientos)
const filtroCaja = async (req, alias = "c") => {
  const id = await sucursalVista(req);
  if (!id) return { sql: "", params: [] };
  const principal = await sucursalPrincipal();
  return { sql: ` AND IFNULL(${alias}.id_sucursal, ?) = ?`, params: [principal, id] };
};

// Sucursal donde se registra una operación: el turno abierto de quien la registra, su
// sucursal, la del socio o la principal
const sucursalOperacion = async (conn, idOperador, idSocio, turno) => {
  if (turno?.id_sucursal) return turno.id_sucursal;
  try {
    if (idOperador) {
      const [[o]] = await conn.query(
        "SELECT u.id_sucursal, r.nombre AS rol FROM usuarios u JOIN roles r ON r.id_rol = u.rol_id WHERE u.id_usuario = ?",
        [idOperador]
      );
      if (o?.id_sucursal && o.rol !== "Socio") return o.id_sucursal;
    }
    if (idSocio) {
      const [[s]] = await conn.query("SELECT id_sucursal FROM usuarios WHERE id_usuario = ?", [idSocio]);
      if (s?.id_sucursal) return s.id_sucursal;
    }
  } catch {}
  return sucursalPrincipal(conn);
};

module.exports = {
  sucursalPrincipal,
  olvidarPrincipal,
  datosUsuario,
  olvidarUsuario,
  sucursalVista,
  filtroSocio,
  filtroCaja,
  deSociosDeSucursal,
  consultaPorSucursal,
  sucursalOperacion,
};
