// Validación y registro de una solicitud de préstamo. Se usa desde el panel del socio
// y desde el enlace de registro (donde la solicitud llega junto con los datos del socio).
const config = require("./configFinanciera");
const { calcularCuotaMensual } = require("./calculosPrestamo");
const { formatearNombre } = require("./nombres");
const { dinero } = require("./pais");
const { listarProductos, obtenerProducto, fueraDeProducto } = require("./productos");

const PROPOSITOS = ["negocio", "vivienda", "educacion", "salud", "agricultura", "consumo", "otro"];
const OCUPACIONES = ["empleado", "negocio_propio", "agricultor", "independiente", "jubilado", "otro"];

const num = (v) => parseFloat(v || 0);
const aTexto = (v, max) => String(v || "").trim().substring(0, max);

// Parámetros que ve quien llena el formulario. Si la cooperativa tiene productos de crédito
// visibles para los socios, se elige uno y sus condiciones mandan sobre las generales.
const parametrosSolicitud = async () => {
  const c = config.obtener();
  const productos = await listarProductos({ paraSocios: true });
  return {
    tasa_mensual: c.sol_tasa_mensual,
    monto_max: c.sol_monto_max,
    plazo_max: c.sol_plazo_max,
    pct_ingreso_max: c.sol_pct_ingreso_max,
    propositos: PROPOSITOS,
    ocupaciones: OCUPACIONES,
    productos: productos.map(({ id_producto, nombre, descripcion, tasa_mensual, monto_min, monto_max, plazo_min, plazo_max }) => ({
      id_producto, nombre, descripcion, tasa_mensual, monto_min, monto_max, plazo_min, plazo_max,
    })),
  };
};

// Devuelve { error } o { datos } con los valores ya normalizados
const validarSolicitud = async (b = {}) => {
  const c = config.obtener();
  const monto = num(b.monto);
  const plazo = parseInt(b.plazo_meses);

  // Producto de crédito: obligatorio si la cooperativa ofrece alguno a los socios
  let producto = null;
  if (b.id_producto) {
    producto = await obtenerProducto(parseInt(b.id_producto));
    if (!producto || !producto.activo || !producto.visible_socios) {
      return { error: "Ese tipo de préstamo ya no está disponible. Elige otro." };
    }
    const fuera = fueraDeProducto(producto, monto, plazo);
    if (fuera?.campo === "monto") {
      return { error: `Para ${producto.nombre}, el monto va de ${dinero(fuera.min)} a ${dinero(fuera.max)}.` };
    }
    if (fuera?.campo === "plazo") {
      return { error: `Para ${producto.nombre}, el plazo va de ${fuera.min} a ${fuera.max} meses.` };
    }
  } else if ((await listarProductos({ paraSocios: true })).length) {
    return { error: "Elige el tipo de préstamo." };
  }

  // Ya no se pregunta en el formulario; si viene (formularios anteriores) se guarda, si no queda en 0
  const cuotaPosible = num(b.cuota_posible) > 0 ? num(b.cuota_posible) : 0;
  const ingreso = num(b.ingreso_mensual);

  if (!producto && (!(monto > 0) || monto > c.sol_monto_max)) {
    return { error: `El monto debe ser mayor a 0 y no superar ${dinero(c.sol_monto_max)}.` };
  }
  if (!producto && (!Number.isInteger(plazo) || plazo < 1 || plazo > c.sol_plazo_max)) {
    return { error: `El plazo debe estar entre 1 y ${c.sol_plazo_max} meses.` };
  }
  if (!PROPOSITOS.includes(b.proposito)) return { error: "Selecciona el destino del préstamo." };
  if (!OCUPACIONES.includes(b.ocupacion)) return { error: "Selecciona tu fuente de ingresos." };
  if (!(ingreso > 0)) return { error: "Indica tu ingreso mensual aproximado." };
  if (b.acepta !== true) return { error: "Debes confirmar que la información es verdadera." };

  // Primero el aval (obligatorio) y después una referencia personal (opcional).
  // Si no traen "tipo" (formularios anteriores), el primero se toma como aval.
  const lista = (Array.isArray(b.referencias) ? b.referencias : []).slice(0, 2).map((r, i) => ({
    tipo: r?.tipo === "referencia" || r?.tipo === "aval" ? r.tipo : i === 0 ? "aval" : "referencia",
    nombre: formatearNombre(aTexto(r?.nombre, 100)),
    telefono: aTexto(r?.telefono, 20),
    parentesco: aTexto(r?.parentesco, 50),
  }));
  const aval = lista.find((r) => r.tipo === "aval");
  if (!aval || !aval.nombre || !aval.telefono) {
    return { error: "Indica el nombre y el teléfono de tu aval." };
  }
  const referencia = lista.find((r) => r.tipo === "referencia" && r.nombre && r.telefono);
  const referencias = referencia ? [aval, referencia] : [aval];

  return {
    datos: {
      monto,
      plazo,
      cuotaPosible,
      ingreso,
      proposito: b.proposito,
      descripcion: aTexto(b.descripcion, 300) || null,
      ocupacion: b.ocupacion,
      lugar_trabajo: aTexto(b.lugar_trabajo, 120) || null,
      referencias,
      producto,
    },
  };
};

// Crea el préstamo pendiente y su solicitud dentro de la transacción recibida
const insertarSolicitud = async (conn, idUsuario, d) => {
  // La tasa referencial del producto elegido, o la general (Parámetros → Solicitudes)
  const tasaMensual = d.producto ? d.producto.tasa_mensual : config.obtener().sol_tasa_mensual;
  const tasaAnual = parseFloat((tasaMensual * 12).toFixed(4));
  const cuotaEstimada = parseFloat(calcularCuotaMensual(d.monto, tasaAnual, d.plazo).toFixed(2));

  const [pr] = await conn.query(
    `INSERT INTO prestamos (id_usuario, monto, tasa_interes, tipo_tasa, tasa_original, plazo_meses, saldo_restante, estado, id_producto)
     VALUES (?, ?, ?, 'nominal_mensual', ?, ?, ?, 'pendiente', ?)`,
    [idUsuario, d.monto, tasaAnual, tasaMensual, d.plazo, d.monto, d.producto?.id_producto || null]
  );

  await conn.query(
    `INSERT INTO solicitudes_prestamo
       (id_prestamo, id_usuario, proposito, descripcion, ocupacion, lugar_trabajo, ingreso_mensual,
        cuota_posible, cuota_estimada, tasa_referencial, referencias)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      pr.insertId,
      idUsuario,
      d.proposito,
      d.descripcion,
      d.ocupacion,
      d.lugar_trabajo,
      d.ingreso,
      d.cuotaPosible,
      cuotaEstimada,
      tasaMensual,
      JSON.stringify(d.referencias),
    ]
  );

  // El aval de la solicitud queda registrado como garantía fiduciaria del préstamo
  const aval = (d.referencias || []).find((r) => r.tipo === "aval");
  if (aval?.nombre) {
    await conn.query(
      `INSERT INTO garantias (id_prestamo, tipo, descripcion, aval_nombre, aval_telefono, aval_parentesco, registrada_por)
       VALUES (?, 'aval', 'Aval indicado en la solicitud', ?, ?, ?, ?)`,
      [pr.insertId, aval.nombre, aval.telefono || null, aval.parentesco || null, idUsuario]
    );
  }

  return { id_prestamo: pr.insertId, cuota_estimada: cuotaEstimada };
};

module.exports = { PROPOSITOS, OCUPACIONES, parametrosSolicitud, validarSolicitud, insertarSolicitud };
