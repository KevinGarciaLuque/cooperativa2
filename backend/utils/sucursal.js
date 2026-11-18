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
  sucursalOperacion,
};
