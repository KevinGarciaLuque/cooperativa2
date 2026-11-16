// Garantías de un préstamo: aval (fiduciaria), prendaria (vehículo, maquinaria...), hipotecaria
// (terreno, casa), ahorros del socio u otra. Cuando el préstamo se cancela, sus garantías
// quedan liberadas; el personal también puede liberar una antes, dejando el motivo.
const { dinero } = require("./pais");

const TIPOS = {
  aval: "Aval (fiduciaria)",
  prendaria: "Prendaria",
  hipotecaria: "Hipotecaria",
  ahorros: "Ahorros del socio",
  otra: "Otra",
};
const REALES = ["prendaria", "hipotecaria"];

const num = (v) => (v === null || v === undefined || v === "" ? null : parseFloat(v));
const texto = (v, max) => String(v || "").trim().substring(0, max) || null;

// Estado que se muestra: liberada si se liberó o si el préstamo ya se canceló
const conEstado = (g, estadoPrestamo) => ({
  ...g,
  valor_estimado: num(g.valor_estimado),
  estado_efectivo:
    g.estado === "liberada" ? "liberada" : ["pagado", "consolidado"].includes(estadoPrestamo) ? "liberada" : g.estado,
  tipo_nombre: TIPOS[g.tipo] || g.tipo,
});

const listarGarantias = async (conn, idPrestamo) => {
  const [[p]] = await conn.query("SELECT estado, monto FROM prestamos WHERE id_prestamo = ?", [idPrestamo]);
  if (!p) return null;
  const [rows] = await conn.query(
    `SELECT g.*, u.nombre_completo AS registrada_por_nombre
     FROM garantias g LEFT JOIN usuarios u ON u.id_usuario = g.registrada_por
     WHERE g.id_prestamo = ? ORDER BY g.registrada_en, g.id_garantia`,
    [idPrestamo]
  );
  const garantias = rows.map((g) => conEstado(g, p.estado));
  const vigentes = garantias.filter((g) => g.estado_efectivo === "vigente");
  const valorReal = vigentes.filter((g) => REALES.includes(g.tipo)).reduce((t, g) => t + (g.valor_estimado || 0), 0);
  return {
    garantias,
    resumen: {
      vigentes: vigentes.length,
      avales: vigentes.filter((g) => g.tipo === "aval").length,
      valor_garantias_reales: parseFloat(valorReal.toFixed(2)),
      // Cuánto del préstamo cubren las garantías reales (prendaria e hipotecaria)
      cobertura_real_pct: parseFloat(p.monto) > 0 ? parseFloat(((valorReal / parseFloat(p.monto)) * 100).toFixed(1)) : 0,
    },
  };
};

// Valida una garantía nueva. Devuelve { error } o { datos }
const validarGarantia = (b = {}) => {
  const tipo = TIPOS[b.tipo] ? b.tipo : null;
  if (!tipo) return { error: "Elige el tipo de garantía." };
  const datos = {
    tipo,
    descripcion: texto(b.descripcion, 300),
    valor_estimado: num(b.valor_estimado),
    aval_nombre: null,
    aval_identidad: null,
    aval_telefono: null,
    aval_parentesco: null,
  };
  if (tipo === "aval") {
    datos.aval_nombre = texto(b.aval_nombre, 100);
    datos.aval_identidad = texto(b.aval_identidad, 20);
    datos.aval_telefono = texto(b.aval_telefono, 20);
    datos.aval_parentesco = texto(b.aval_parentesco, 50);
    if (!datos.aval_nombre || !datos.aval_telefono) return { error: "Escribe el nombre y el teléfono del aval." };
  } else {
    if (!datos.descripcion) return { error: "Describe la garantía (qué es y sus datos de identificación)." };
    if (REALES.includes(tipo) && !(datos.valor_estimado > 0)) {
      return { error: "Indica el valor estimado de la garantía." };
    }
  }
  if (datos.valor_estimado !== null && !(datos.valor_estimado >= 0)) return { error: "El valor estimado no es válido." };
  return { datos };
};

// ¿Tiene el préstamo la garantía que exige su producto? Devuelve el mensaje que impide
// desembolsar, o null. Sin producto (o "ninguna") no se exige nada, como siempre.
const faltaGarantia = async (conn, prestamo) => {
  if (!prestamo.id_producto) return null;
  const [[prod]] = await conn.query("SELECT nombre, garantia_requerida FROM productos_credito WHERE id_producto = ?", [
    prestamo.id_producto,
  ]);
  if (!prod || prod.garantia_requerida === "ninguna") return null;
  const [[c]] = await conn.query(
    `SELECT SUM(tipo = 'aval') AS avales, SUM(tipo IN ('prendaria','hipotecaria')) AS reales
     FROM garantias WHERE id_prestamo = ? AND estado = 'vigente'`,
    [prestamo.id_prestamo]
  );
  if (prod.garantia_requerida === "aval" && !(parseInt(c.avales) > 0)) {
    return `El producto ${prod.nombre} exige un aval: regístralo en las garantías del préstamo antes de desembolsar.`;
  }
  if (prod.garantia_requerida === "real" && !(parseInt(c.reales) > 0)) {
    return `El producto ${prod.nombre} exige una garantía prendaria o hipotecaria: regístrala antes de desembolsar.`;
  }
  return null;
};

const describir = (g) =>
  g.tipo === "aval"
    ? `aval ${g.aval_nombre}`
    : `${TIPOS[g.tipo].toLowerCase()}${g.descripcion ? `: ${g.descripcion}` : ""}${g.valor_estimado ? ` (${dinero(g.valor_estimado)})` : ""}`;

module.exports = { TIPOS, REALES, listarGarantias, validarGarantia, faltaGarantia, describir };
