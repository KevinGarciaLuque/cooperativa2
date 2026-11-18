// Configuración avanzada de créditos (función "configuracion_avanzada").
// Al desembolsar, cada préstamo copia la configuración de su producto (mora, gracia, cargo
// automático, redondeo de cuota): así un cambio posterior en el producto no altera los
// préstamos ya entregados. Además recibe su código con el formato de la cooperativa.
const pool = require("../db");

const CAMPOS = ["mora_tasa_anual", "mora_dias_gracia", "cargo_tipo", "cargo_valor", "cargo_concepto", "redondeo_cuota", "metodo_interes", "frecuencia_pago"];

const formatoCodigo = async (conn = pool) => {
  try {
    const [[f]] = await conn.query("SELECT valor FROM configuracion_sitio WHERE clave = 'codigo_credito_formato'");
    return f?.valor || "";
  } catch {
    return "";
  }
};

// {n} número del préstamo, {anio} año, {aa} año en dos dígitos, {suc} sucursal del socio,
// {prod} tres letras del producto, {socio} número de socio
const armarCodigo = (formato, p) => {
  const anio = String(new Date().getFullYear());
  return String(formato)
    .replace(/\{n\}/g, String(p.id_prestamo))
    .replace(/\{anio\}/g, anio)
    .replace(/\{aa\}/g, anio.substring(2))
    .replace(/\{suc\}/g, String(p.id_sucursal || 1))
    .replace(/\{prod\}/g, String(p.producto || "GEN").normalize("NFD").replace(/[^A-Za-z]/g, "").substring(0, 3).toUpperCase() || "GEN")
    .replace(/\{socio\}/g, String(p.numero_socio || ""))
    .substring(0, 30);
};

const alDesembolsar = async (conn, idPrestamo) => {
  const [[p]] = await conn.query(
    `SELECT p.id_prestamo, p.id_producto, p.codigo, u.id_sucursal, u.numero_socio, pc.nombre AS producto,
            ${CAMPOS.map((c) => `pc.${c} AS prod_${c}`).join(", ")}
     FROM prestamos p JOIN usuarios u ON u.id_usuario = p.id_usuario
     LEFT JOIN productos_credito pc ON pc.id_producto = p.id_producto
     WHERE p.id_prestamo = ?`,
    [idPrestamo]
  );
  if (!p) return;
  if (p.id_producto) {
    await conn.query(`UPDATE prestamos SET ${CAMPOS.map((c) => `${c} = ?`).join(", ")} WHERE id_prestamo = ?`, [
      ...CAMPOS.map((c) => p[`prod_${c}`] ?? null),
      idPrestamo,
    ]);
  }
  // Semanal o quincenal sin gracia propia: la gracia general (30 días) es para pagos mensuales;
  // se usa el periodo (7 o 15 días) más la tolerancia que la cooperativa da por encima del mes.
  const periodo = { semanal: 7, quincenal: 15 }[p.prod_frecuencia_pago];
  if (p.id_producto && periodo && p.prod_mora_dias_gracia == null) {
    const extra = Math.max(0, parseInt(require("./configFinanciera").obtener().mora_dias_gracia) - 30);
    await conn.query("UPDATE prestamos SET mora_dias_gracia = ? WHERE id_prestamo = ?", [periodo + extra, idPrestamo]);
  }
  const formato = await formatoCodigo(conn);
  if (formato && !p.codigo) await conn.query("UPDATE prestamos SET codigo = ? WHERE id_prestamo = ?", [armarCodigo(formato, p), idPrestamo]);
};

// Cargo automático de un pago según el préstamo (0 si no tiene)
const cargoAutomatico = (prestamo, montoPagado) => {
  const v = parseFloat(prestamo?.cargo_valor || 0);
  if (!prestamo?.cargo_tipo || !(v > 0)) return 0;
  return prestamo.cargo_tipo === "porcentaje" ? Math.round(parseFloat(montoPagado || 0) * v) / 100 : v;
};

module.exports = { alDesembolsar, cargoAutomatico, formatoCodigo, armarCodigo };
