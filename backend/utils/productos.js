// Productos de crédito (Consumo, Vivienda, Agrícola...): tasa referencial, montos, plazos y la
// garantía que exigen. Si no hay productos activos, las solicitudes usan los parámetros
// generales (Parámetros → Solicitudes), como siempre.
const pool = require("../db");

const GARANTIAS = {
  ninguna: "Sin garantía",
  aval: "Aval (garantía fiduciaria)",
  real: "Garantía prendaria o hipotecaria",
};

const num = (v) => parseFloat(v || 0);

const normalizar = (p) =>
  p && {
    id_producto: p.id_producto,
    nombre: p.nombre,
    descripcion: p.descripcion,
    tasa_mensual: num(p.tasa_mensual),
    monto_min: num(p.monto_min),
    monto_max: num(p.monto_max),
    plazo_min: parseInt(p.plazo_min),
    plazo_max: parseInt(p.plazo_max),
    garantia_requerida: p.garantia_requerida,
    visible_socios: Boolean(p.visible_socios),
    activo: Boolean(p.activo),
    orden: parseInt(p.orden) || 0,
    // Configuración avanzada (vacío = lo general de Parámetros)
    mora_tasa_anual: p.mora_tasa_anual == null ? null : num(p.mora_tasa_anual),
    mora_dias_gracia: p.mora_dias_gracia == null ? null : parseInt(p.mora_dias_gracia),
    cargo_tipo: p.cargo_tipo || null,
    cargo_valor: p.cargo_valor == null ? null : num(p.cargo_valor),
    cargo_concepto: p.cargo_concepto || null,
    redondeo_cuota: p.redondeo_cuota == null ? null : num(p.redondeo_cuota),
  };

const CARGOS = { fijo: "Monto fijo por pago", porcentaje: "Porcentaje de cada pago" };
const REDONDEOS = [1, 5, 10, 50, 100];
const vacio = (v) => v === undefined || v === null || v === "";

const listarProductos = async ({ soloActivos = false, paraSocios = false } = {}, conn = pool) => {
  const where = [];
  if (soloActivos || paraSocios) where.push("activo = 1");
  if (paraSocios) where.push("visible_socios = 1");
  const [rows] = await conn.query(
    `SELECT * FROM productos_credito ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY orden, nombre`
  );
  return rows.map(normalizar);
};

const obtenerProducto = async (id, conn = pool) => {
  const [[p]] = await conn.query("SELECT * FROM productos_credito WHERE id_producto = ?", [id]);
  return normalizar(p) || null;
};

// Valida los datos de un producto. Devuelve { error } o { datos }
const validarProducto = (b = {}) => {
  const datos = {
    nombre: String(b.nombre || "").trim().substring(0, 80),
    descripcion: String(b.descripcion || "").trim().substring(0, 300) || null,
    tasa_mensual: num(b.tasa_mensual),
    monto_min: num(b.monto_min),
    monto_max: num(b.monto_max),
    plazo_min: parseInt(b.plazo_min),
    plazo_max: parseInt(b.plazo_max),
    garantia_requerida: GARANTIAS[b.garantia_requerida] ? b.garantia_requerida : "aval",
    visible_socios: b.visible_socios === undefined ? 1 : b.visible_socios ? 1 : 0,
    activo: b.activo === undefined ? 1 : b.activo ? 1 : 0,
    orden: parseInt(b.orden) || 0,
  };
  // Configuración avanzada (opcional)
  datos.mora_tasa_anual = vacio(b.mora_tasa_anual) ? null : num(b.mora_tasa_anual);
  datos.mora_dias_gracia = vacio(b.mora_dias_gracia) ? null : parseInt(b.mora_dias_gracia);
  datos.cargo_tipo = CARGOS[b.cargo_tipo] ? b.cargo_tipo : null;
  datos.cargo_valor = datos.cargo_tipo ? num(b.cargo_valor) : null;
  datos.cargo_concepto = datos.cargo_tipo ? String(b.cargo_concepto || "").trim().substring(0, 80) || null : null;
  datos.redondeo_cuota = REDONDEOS.includes(num(b.redondeo_cuota)) ? num(b.redondeo_cuota) : null;
  if (datos.mora_tasa_anual != null && !(datos.mora_tasa_anual >= 0 && datos.mora_tasa_anual <= 120)) return { error: "La tasa de mora debe estar entre 0 y 120% anual." };
  if (datos.mora_dias_gracia != null && !(datos.mora_dias_gracia >= 0 && datos.mora_dias_gracia <= 90)) return { error: "Los días de gracia deben estar entre 0 y 90." };
  if (datos.cargo_tipo && !(datos.cargo_valor > 0)) return { error: "Indica el valor del cargo automático." };
  if (datos.cargo_tipo === "porcentaje" && datos.cargo_valor > 50) return { error: "El cargo no puede ser más del 50% del pago." };
  if (datos.cargo_tipo && !datos.cargo_concepto) return { error: "Escribe el concepto del cargo (por ejemplo, seguro de deuda)." };
  if (datos.nombre.length < 3) return { error: "Escribe el nombre del producto." };
  if (!(datos.tasa_mensual >= 0) || datos.tasa_mensual > 50) return { error: "La tasa mensual debe estar entre 0 y 50%." };
  if (!(datos.monto_min >= 0) || !(datos.monto_max > 0) || datos.monto_min > datos.monto_max) {
    return { error: "Revisa los montos: el máximo debe ser mayor que cero y no menor que el mínimo." };
  }
  if (!Number.isInteger(datos.plazo_min) || !Number.isInteger(datos.plazo_max) || datos.plazo_min < 1 || datos.plazo_max > 360 || datos.plazo_min > datos.plazo_max) {
    return { error: "Revisa los plazos: entre 1 y 360 meses, y el máximo no menor que el mínimo." };
  }
  return { datos };
};

// ¿Cabe un préstamo en las condiciones del producto? Devuelve el mensaje de error o null
const fueraDeProducto = (producto, monto, plazo) => {
  if (monto < producto.monto_min || monto > producto.monto_max) {
    return { campo: "monto", min: producto.monto_min, max: producto.monto_max };
  }
  if (plazo < producto.plazo_min || plazo > producto.plazo_max) {
    return { campo: "plazo", min: producto.plazo_min, max: producto.plazo_max };
  }
  return null;
};

module.exports = {
  CARGOS,
  REDONDEOS, GARANTIAS, listarProductos, obtenerProducto, validarProducto, fueraDeProducto };
