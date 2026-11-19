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
  },
  {
    clave: "contratos_word",
    nombre: "Contrato y pagaré en Word",
    descripcion: "Documentos del crédito generados desde plantillas que la cooperativa puede editar.",
  },
  {
    clave: "configuracion_avanzada",
    nombre: "Configuración avanzada de créditos",
    descripcion: "Por producto: mora y días de gracia propios, cargos automáticos (seguro, gastos), redondeo de cuota; código del crédito con formato propio.",
  },
  {
    clave: "permisos_por_accion",
    nombre: "Permisos por acción y roles recomendados",
    descripcion: "Quitar a un rol acciones como aprobar, desembolsar o anular; roles de solo lectura (auditor); crear los roles recomendados.",
  },
  {
    clave: "segregacion_funciones",
    nombre: "Segregación de funciones",
    descripcion: "Quien registra un crédito no lo aprueba ni lo desembolsa; quien registra un pago o depósito no lo anula ni lo corrige.",
  },
  {
    clave: "reportes_ampliados",
    nombre: "Reportes ampliados",
    descripcion: "Historial crediticio, proyección de cobros, créditos vencidos, por cerrar y cerrados, por promotor y línea.",
  },
  {
    clave: "cartera_asesor",
    nombre: "Cartera por asesor y agenda de cobro",
    descripcion: "Cada préstamo con su asesor; cartera y morosidad por asesor; agenda diaria de a quién llamar o visitar (promesas, cuotas atrasadas y por vencer).",
  },
  {
    clave: "descuento_planilla",
    nombre: "Descuento por planilla",
    descripcion: "Empresas con convenio, préstamos que se cobran por planilla, listado mensual de cuotas a descontar en Excel y aplicar en un paso el pago que manda la empresa.",
  },
  {
    clave: "calificacion_credito",
    nombre: "Calificación del socio y reglas de aprobación",
    descripcion: "Puntaje de 0 a 100 (A a E) con el detalle de cada factor en Solicitudes y Comité; no aprobar con cuotas atrasadas y mandar al comité los puntajes bajos.",
  },
  {
    clave: "app_socio",
    socio: true, // la usan los socios (las demás funciones son solo para el personal)
    nombre: "App del socio",
    descripcion: "Notificaciones en el teléfono, pagar la cuota desde su ahorro, pasar dinero entre sus cuentas y descargar su estado de cuenta en PDF.",
  },
  {
    clave: "reportes_supervisor",
    nombre: "Informe al supervisor y reportes IVE",
    descripcion: "Indicadores financieros con semáforo (morosidad, cobertura, liquidez, solvencia, rentabilidad) en Excel; reporte de transacciones en efectivo y de transacciones sospechosas para la IVE.",
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
  if (usuario?.rol === "Socio" && !CATALOGO.find((c) => c.clave === clave)?.socio) return false;
  return !!(await leer())[clave];
};

// Para el navegador: qué funciones ve este usuario
const efectivas = async (usuario) => {
  const f = await leer();
  return Object.fromEntries(
    CATALOGO.map((c) => [
      c.clave,
      usuario?.rol === "Super Administrador" ? true : usuario?.rol === "Socio" ? !!(c.socio && f[c.clave]) : f[c.clave],
    ])
  );
};

module.exports = { CATALOGO, leer, guardar, habilitada, efectivas };
