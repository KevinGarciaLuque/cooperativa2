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
  };

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

module.exports = { GARANTIAS, listarProductos, obtenerProducto, validarProducto, fueraDeProducto };
