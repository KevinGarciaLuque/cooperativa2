// Permisos por acción (función "permisos_por_accion") y segregación de funciones
// (función "segregacion_funciones"). Las dos las enciende el Super Administrador.
//
// Los permisos por módulo siguen igual (qué pantallas ve un rol). Encima, cada acción
// sensible (aprobar, desembolsar, anular...) se puede quitar a un rol. Si un rol no tiene la
// acción configurada, la conserva: encender la función no le quita nada a nadie hasta que
// el Super Administrador lo decida (o cree los roles recomendados).
const pool = require("../db");

const ACCIONES = [
  { grupo: "Socios", clave: "socios.crear", nombre: "Registrar socios" },
  { grupo: "Socios", clave: "socios.editar", nombre: "Editar datos de socios y usuarios" },
  { grupo: "Socios", clave: "socios.aprobar", nombre: "Aprobar o rechazar afiliaciones" },
  { grupo: "Socios", clave: "socios.estado", nombre: "Activar, suspender o dar de baja" },
  { grupo: "Socios", clave: "socios.eliminar", nombre: "Eliminar usuarios" },
  { grupo: "Créditos", clave: "prestamos.crear", nombre: "Registrar créditos, grupos y solicitudes" },
  { grupo: "Créditos", clave: "prestamos.editar", nombre: "Editar créditos" },
  { grupo: "Créditos", clave: "prestamos.aprobar", nombre: "Aprobar créditos" },
  { grupo: "Créditos", clave: "prestamos.rechazar", nombre: "Rechazar créditos" },
  { grupo: "Créditos", clave: "prestamos.desembolsar", nombre: "Desembolsar créditos" },
  { grupo: "Créditos", clave: "prestamos.eliminar", nombre: "Eliminar o reversar créditos" },
  { grupo: "Pagos", clave: "pagos.registrar", nombre: "Cobrar pagos de créditos" },
  { grupo: "Pagos", clave: "pagos.editar", nombre: "Corregir pagos" },
  { grupo: "Pagos", clave: "pagos.anular", nombre: "Anular pagos" },
  { grupo: "Pagos", clave: "pagos.conciliar", nombre: "Conciliar boletas" },
  { grupo: "Pagos", clave: "pagos.condonar", nombre: "Omitir la mora de un pago" },
  { grupo: "Ahorro", clave: "ahorro.depositar", nombre: "Depósitos y aportaciones" },
  { grupo: "Ahorro", clave: "ahorro.retirar", nombre: "Retiros de ahorro" },
  { grupo: "Ahorro", clave: "ahorro.corregir", nombre: "Corregir o anular depósitos, retiros y aportaciones" },
  { grupo: "Caja", clave: "caja.gastos", nombre: "Registrar gastos e ingresos de caja" },
  { grupo: "Caja", clave: "caja.cierre", nombre: "Cierre diario de caja" },
  { grupo: "Contabilidad", clave: "contabilidad.partidas", nombre: "Partidas manuales y anulaciones contables" },
  { grupo: "Otros", clave: "actividades.registrar", nombre: "Actividades y liquidaciones" },
  { grupo: "Supervisión", clave: "autorizaciones.resolver", nombre: "Autorizar operaciones de otros" },
];

// Acciones a las que se les puede poner un monto máximo por rol (por encima, pide autorización)
const ACCIONES_CON_MONTO = [
  "prestamos.crear", "prestamos.aprobar", "prestamos.desembolsar", "pagos.registrar", "pagos.anular",
  "ahorro.depositar", "ahorro.retirar", "caja.gastos",
];
// Estas solo cuentan si se dan expresamente (sin configurar = no): autorizar y omitir mora directo.
// El Administrador puede autorizar salvo que se le quite.
const SOLO_EXPRESAS = new Set(["autorizaciones.resolver", "pagos.condonar"]);
const CLAVES = new Set(ACCIONES.map((a) => a.clave));
const nombreDe = (clave) => ACCIONES.find((a) => a.clave === clave)?.nombre || clave;

// Qué acción es cada operación. "fn" decide con el cuerpo de la petición cuando hace falta.
const REGLAS = [
  ["POST", /^\/usuarios$/, "socios.crear"],
  ["PUT", /^\/usuarios\/\d+$/, "socios.editar"],
  ["PATCH", /^\/usuarios\/\d+\/estado$/, "socios.estado"],
  ["DELETE", /^\/usuarios\/\d+$/, "socios.eliminar"],
  ["POST", /^\/solicitudes\/socios\/\d+\/(aprobar|rechazar)$/, "socios.aprobar"],
  ["PUT", /^\/socios\/\d+\/expediente$/, "socios.editar"],
  ["POST", /^\/prestamos$/, "prestamos.crear"],
  ["POST", /^\/grupos$/, "prestamos.crear"],
  ["PUT", /^\/grupos\/\d+$/, "prestamos.crear"],
  ["POST", /^\/grupos\/\d+\/creditos$/, "prestamos.crear"],
  ["PUT", /^\/prestamos\/\d+(\/datos-credito)?$/, "prestamos.editar"],
  ["PATCH", /^\/prestamos\/\d+\/estado$/, "prestamos.editar"],
  ["POST", /^\/cobranza\/asignar$/, "prestamos.editar"],
  ["PATCH", /^\/prestamos\/\d+\/aprobar$/, "prestamos.aprobar"],
  ["POST", /^\/solicitudes\/prestamos\/\d+\/aprobar$/, "prestamos.aprobar"],
  ["PATCH", /^\/prestamos\/\d+\/rechazar$/, "prestamos.rechazar"],
  ["POST", /^\/prestamos\/\d+\/desembolsar$/, "prestamos.desembolsar"],
  ["DELETE", /^\/prestamos\/\d+$/, "prestamos.eliminar"],
  ["POST", /^\/consolidaciones$/, "prestamos.crear"],
  ["POST", /^\/pagos$/, "pagos.registrar"],
  ["POST", /^\/prestamos\/\d+\/liquidar$/, "pagos.registrar"],
  ["POST", /^\/grupos\/creditos\/\d+\/pagar$/, "pagos.registrar"],
  ["POST", /^\/pagos-ampliados\/rapido$/, "pagos.registrar"],
  ["POST", /^\/planillas\/lotes\/\d+\/aplicar$/, "pagos.registrar"],
  ["POST", /^\/pagos-reportados\/\d+\/rechazar$/, "pagos.registrar"],
  ["PUT", /^\/pagos\/\d+$/, "pagos.editar"],
  ["DELETE", /^\/pagos\/\d+$/, "pagos.anular"],
  ["PUT", /^\/pagos-ampliados\/conciliacion$/, "pagos.conciliar"],
  ["POST", /^\/movimientos$/, null, (b) => (String(b?.tipo) === "retiro" ? "ahorro.retirar" : "ahorro.depositar")],
  ["POST", /^\/movimientos\/ajuste-manual$/, "ahorro.corregir"],
  ["PUT", /^\/movimientos\/\d+$/, "ahorro.corregir"],
  ["DELETE", /^\/movimientos\/\d+$/, "ahorro.corregir"],
  ["POST", /^\/aportaciones$/, "ahorro.depositar"],
  ["PUT", /^\/aportaciones\/\d+$/, "ahorro.corregir"],
  ["DELETE", /^\/aportaciones\/\d+$/, "ahorro.corregir"],
  ["POST", /^\/ahorro\/plazos$/, "ahorro.depositar"],
  ["POST", /^\/ahorro\/plazos\/\d+\/pagar$/, "ahorro.retirar"],
  ["POST", /^\/caja\/(gasto|ingreso)$/, "caja.gastos"],
  ["POST", /^\/caja\/cierre$/, "caja.cierre"],
  ["POST", /^\/libros\/partidas(\/\d+\/anular)?$/, "contabilidad.partidas"],
  ["POST", /^\/actividades$/, "actividades.registrar"],
  ["PUT", /^\/actividades\/\d+$/, "actividades.registrar"],
  ["DELETE", /^\/actividades\/\d+$/, "actividades.registrar"],
  ["POST", /^\/liquidaciones(\/\d+\/desembolsar\/\d+)?$/, "actividades.registrar"],
];
const accionDe = (metodo, ruta, cuerpo) => {
  for (const [m, re, accion, fn] of REGLAS) {
    if (m === metodo && re.test(ruta)) return accion || fn(cuerpo);
  }
  return null;
};

// Lo que un usuario de solo lectura sí puede hacer (su propia sesión y perfil)
const PERMITIDO_SOLO_LECTURA = [
  /^\/usuarios\/(\d+)\/cambiar-password$/,
  /^\/notificaciones\/leer$/,
  /^\/politicas\/aceptar$/,
  /^\/firma\/mia$/,
  /^\/usuarios\/login(\/.*)?$/,
];

// Caché corta por rol (como los permisos de módulo)
const cache = new Map();
const datosDelRol = async (rolId) => {
  const c = cache.get(rolId);
  if (c && Date.now() - c.t < 30 * 1000) return c.d;
  let d = { solo_lectura: false, acciones: {}, limites: {} };
  try {
    const [[r]] = await pool.query("SELECT solo_lectura FROM roles WHERE id_rol = ?", [rolId]);
    const [filas] = await pool.query("SELECT accion, activo FROM permisos_acciones WHERE rol_id = ?", [rolId]);
    // activo: 1 = puede, 0 = no puede, 2 = puede con autorización de un superior
    let limites = {};
    try {
      const [lim] = await pool.query("SELECT accion, monto_max FROM roles_limites WHERE rol_id = ?", [rolId]);
      limites = Object.fromEntries(lim.map((l) => [l.accion, parseFloat(l.monto_max)]));
    } catch {}
    d = {
      solo_lectura: !!r?.solo_lectura,
      acciones: Object.fromEntries(filas.map((f) => [f.accion, f.activo === 1 ? true : f.activo === 2 ? "autorizar" : false])),
      limites,
    };
  } catch {}
  cache.set(rolId, { t: Date.now(), d });
  return d;
};
const olvidarRol = (rolId) => (rolId ? cache.delete(rolId) : cache.clear());

// ── Roles recomendados ──────────────────────────────────────────────────────
const TODAS = ACCIONES.map((a) => a.clave);
const menos = (...quitar) => TODAS.filter((a) => !quitar.includes(a));
const MODULOS_TODOS = ["dashboard", "ventanilla", "usuarios", "cuentas", "prestamos", "aportaciones", "pagos", "caja", "cobranza", "contabilidad", "movimientos", "reportes", "actividades", "liquidaciones", "bitacora"];
const ROLES_RECOMENDADOS = [
  {
    nombre: "Gerente General",
    descripcion: "Dirige la cooperativa: ve todo, aprueba y autoriza correcciones",
    modulos: [...MODULOS_TODOS, "cumplimiento"],
    acciones: menos("socios.eliminar", "contabilidad.partidas"),
  },
  {
    nombre: "Jefe de Agencia",
    descripcion: "Responsable de una sucursal: aprueba, desembolsa, cierra caja y autoriza correcciones",
    modulos: MODULOS_TODOS.filter((m) => !["contabilidad", "bitacora"].includes(m)),
    acciones: menos("socios.eliminar", "prestamos.eliminar", "contabilidad.partidas"),
  },
  {
    nombre: "Cajero",
    descripcion: "Ventanilla de dinero: cobros, depósitos, retiros y su turno de caja",
    modulos: ["dashboard", "ventanilla", "cuentas", "aportaciones", "pagos", "caja", "movimientos"],
    acciones: ["pagos.registrar", "ahorro.depositar", "ahorro.retirar"],
  },
  {
    nombre: "Asesor de Crédito",
    descripcion: "Atiende socios y grupos: registra solicitudes y garantías y da seguimiento a su cartera",
    modulos: ["dashboard", "ventanilla", "usuarios", "prestamos", "cobranza", "reportes"],
    acciones: ["socios.crear", "socios.editar", "prestamos.crear", "prestamos.editar"],
  },
  {
    nombre: "Gestor de Cobranza",
    descripcion: "Recupera la mora: llamadas, visitas y promesas de pago",
    modulos: ["dashboard", "ventanilla", "cobranza", "prestamos", "reportes"],
    acciones: [],
  },
  {
    nombre: "Oficial de Cumplimiento",
    descripcion: "Prevención de lavado: alertas, expedientes y reportes al regulador",
    modulos: ["dashboard", "ventanilla", "usuarios", "cumplimiento", "reportes", "bitacora"],
    acciones: ["socios.editar"],
  },
  {
    nombre: "Atención al Socio",
    descripcion: "Recepción y afiliación: registra y actualiza socios; no mueve dinero",
    modulos: ["dashboard", "ventanilla", "usuarios", "cuentas", "prestamos"],
    acciones: ["socios.crear", "socios.editar", "socios.aprobar"],
  },
  {
    nombre: "Auditor",
    descripcion: "Junta de vigilancia o auditoría: ve todo y no puede cambiar nada",
    modulos: [...MODULOS_TODOS, "cumplimiento"],
    acciones: [],
    solo_lectura: true,
  },
  {
    nombre: "Contador",
    descripcion: "Contabilidad: libros, partidas, conciliación, cierres y reportes",
    modulos: ["dashboard", "contabilidad", "reportes", "caja", "pagos", "movimientos", "bitacora"],
    acciones: ["contabilidad.partidas", "pagos.conciliar", "caja.cierre"],
    actualizarSiExiste: true,
  },
];

// Crea los que falten (y configura el Contador que ya existe). Devuelve los nombres creados.
const crearRolesRecomendados = async (conn) => {
  const creados = [];
  const [modulosSistema] = await conn.query("SELECT DISTINCT modulo FROM permisos_modulos");
  const todosModulos = new Set([...MODULOS_TODOS, "cumplimiento", "roles", "basedatos", ...modulosSistema.map((m) => m.modulo)]);
  for (const r of ROLES_RECOMENDADOS) {
    const [[existe]] = await conn.query("SELECT id_rol FROM roles WHERE nombre = ?", [r.nombre]);
    if (existe && !r.actualizarSiExiste) continue;
    let id = existe?.id_rol;
    if (!id) {
      const [ins] = await conn.query("INSERT INTO roles (nombre, descripcion, solo_lectura) VALUES (?, ?, ?)", [r.nombre, r.descripcion, r.solo_lectura ? 1 : 0]);
      id = ins.insertId;
      creados.push(r.nombre);
    }
    for (const m of todosModulos) {
      await conn.query(
        "INSERT INTO permisos_modulos (rol_id, modulo, activo) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE activo = VALUES(activo)",
        [id, m, r.modulos.includes(m) ? 1 : 0]
      );
    }
    for (const a of TODAS) {
      await conn.query(
        "INSERT INTO permisos_acciones (rol_id, accion, activo) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE activo = VALUES(activo)",
        [id, a, r.acciones.includes(a) ? 1 : 0]
      );
    }
    olvidarRol(id);
  }
  return creados;
};

module.exports = {
  ACCIONES, CLAVES, nombreDe, accionDe, PERMITIDO_SOLO_LECTURA, datosDelRol, olvidarRol, ACCIONES_CON_MONTO, SOLO_EXPRESAS,
  ROLES_RECOMENDADOS, crearRolesRecomendados,
};
