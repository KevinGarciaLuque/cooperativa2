// Funciones nuevas que el Super Administrador enciende cuando quiere (Control de Accesos).
// Apagadas, solo el Super Administrador las ve (para probarlas); encendidas, todo el personal.
// Se guardan en configuracion_sitio con la clave "funciones" (JSON).
const pool = require("../db");

const CATALOGO = [
  {
    clave: "datos_ampliados",
    nombre: "Datos ampliados de socios y créditos",
    descripcion: "Escolaridad, cónyuge, departamento, municipio y comunidad del socio; línea, destino, promotor, pagaré, acta y cheque del crédito.",
  },
  {
    clave: "creditos_grupales",
    nombre: "Créditos grupales",
    descripcion: "Grupos con integrantes y cargos, crédito con desglose y plan por integrante, pago grupal.",
  },
  {
    clave: "pagos_ampliados",
    nombre: "Pagos ampliados",
    descripcion: "Número de boleta, lugar de pago, otros cargos, conciliación de boletas y pago rápido.",
    proximamente: true,
  },
  {
    clave: "contratos_word",
    nombre: "Contrato y pagaré en Word",
    descripcion: "Documentos del crédito generados desde plantillas que la cooperativa puede editar.",
    proximamente: true,
  },
  {
    clave: "reportes_ampliados",
    nombre: "Reportes ampliados",
    descripcion: "Historial crediticio, proyección de cobros, créditos vencidos, por cerrar y cerrados, por promotor y línea.",
    proximamente: true,
  },
];

let cache = null;
let leidoEn = 0;
const leer = async () => {
  if (cache && Date.now() - leidoEn < 30 * 1000) return cache;
  let guardado = {};
  try {
    const [[f]] = await pool.query("SELECT valor FROM configuracion_sitio WHERE clave = 'funciones'");
    guardado = f?.valor ? JSON.parse(f.valor) : {};
  } catch {
    guardado = {};
  }
  cache = Object.fromEntries(CATALOGO.map((c) => [c.clave, !!guardado[c.clave]]));
  leidoEn = Date.now();
  return cache;
};

const guardar = async (cambios) => {
  const actual = await leer();
  const nuevo = { ...actual };
  for (const c of CATALOGO) if (cambios[c.clave] !== undefined) nuevo[c.clave] = !!cambios[c.clave];
  await pool.query(
    "INSERT INTO configuracion_sitio (clave, valor) VALUES ('funciones', ?) ON DUPLICATE KEY UPDATE valor = VALUES(valor)",
    [JSON.stringify(nuevo)]
  );
  cache = nuevo;
  leidoEn = Date.now();
  return nuevo;
};

// ¿Puede este usuario usar la función? (el Super Administrador siempre, para probarla)
const habilitada = async (clave, usuario) => {
  if (usuario?.rol === "Super Administrador") return true;
  if (usuario?.rol === "Socio") return false;
  return !!(await leer())[clave];
};

// Para el navegador: qué funciones ve este usuario
const efectivas = async (usuario) => {
  const f = await leer();
  return Object.fromEntries(CATALOGO.map((c) => [c.clave, usuario?.rol === "Super Administrador" ? true : usuario?.rol === "Socio" ? false : f[c.clave]]));
};

module.exports = { CATALOGO, leer, guardar, habilitada, efectivas };
