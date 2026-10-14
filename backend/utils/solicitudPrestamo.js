// Validación y registro de una solicitud de préstamo. Se usa desde el panel del socio
// y desde el enlace de registro (donde la solicitud llega junto con los datos del socio).
const config = require("./configFinanciera");
const { calcularCuotaMensual } = require("./calculosPrestamo");
const { formatearNombre } = require("./nombres");

const PROPOSITOS = ["negocio", "vivienda", "educacion", "salud", "agricultura", "consumo", "otro"];
const OCUPACIONES = ["empleado", "negocio_propio", "agricultor", "independiente", "jubilado", "otro"];

const num = (v) => parseFloat(v || 0);
const aTexto = (v, max) => String(v || "").trim().substring(0, max);

// Parámetros que ve quien llena el formulario
const parametrosSolicitud = () => {
  const c = config.obtener();
  return {
    tasa_mensual: c.sol_tasa_mensual,
    monto_max: c.sol_monto_max,
    plazo_max: c.sol_plazo_max,
    pct_ingreso_max: c.sol_pct_ingreso_max,
    propositos: PROPOSITOS,
    ocupaciones: OCUPACIONES,
  };
};

// Devuelve { error } o { datos } con los valores ya normalizados
const validarSolicitud = (b = {}) => {
  const c = config.obtener();
  const monto = num(b.monto);
  const plazo = parseInt(b.plazo_meses);
  // Ya no se pregunta en el formulario; si viene (formularios anteriores) se guarda, si no queda en 0
  const cuotaPosible = num(b.cuota_posible) > 0 ? num(b.cuota_posible) : 0;
  const ingreso = num(b.ingreso_mensual);

  if (!(monto > 0) || monto > c.sol_monto_max) {
    return { error: `El monto debe ser mayor a 0 y no superar L. ${c.sol_monto_max.toLocaleString("es-HN")}.` };
  }
  if (!Number.isInteger(plazo) || plazo < 1 || plazo > c.sol_plazo_max) {
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
    },
  };
};

// Crea el préstamo pendiente y su solicitud dentro de la transacción recibida
const insertarSolicitud = async (conn, idUsuario, d) => {
  const tasaMensual = config.obtener().sol_tasa_mensual;
  const tasaAnual = parseFloat((tasaMensual * 12).toFixed(4));
  const cuotaEstimada = parseFloat(calcularCuotaMensual(d.monto, tasaAnual, d.plazo).toFixed(2));

  const [pr] = await conn.query(
    `INSERT INTO prestamos (id_usuario, monto, tasa_interes, tipo_tasa, tasa_original, plazo_meses, saldo_restante, estado)
     VALUES (?, ?, ?, 'nominal_mensual', ?, ?, ?, 'pendiente')`,
    [idUsuario, d.monto, tasaAnual, tasaMensual, d.plazo, d.monto]
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

  return { id_prestamo: pr.insertId, cuota_estimada: cuotaEstimada };
};

module.exports = { PROPOSITOS, OCUPACIONES, parametrosSolicitud, validarSolicitud, insertarSolicitud };
