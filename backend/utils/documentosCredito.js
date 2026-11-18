// Contrato y pagaré en Word (función "contratos_word"). Se llenan plantillas .docx con
// marcadores como {socio_nombre} o {monto}. La cooperativa puede subir su propio formato; si no,
// se usan las plantillas de backend/plantillas.
const fs = require("fs");
const path = require("path");
const PizZip = require("pizzip");
const Docxtemplater = require("docxtemplater");
const pool = require("../db");
const pais = require("./pais");
const { montoALetras } = require("./letras");
const { generarPlan } = require("./planPagos");
const { describir } = require("./garantias");
const { hoyISO } = require("./fechas");

const TIPOS = { contrato: "Contrato de préstamo", pagare: "Pagaré", ficha_socio: "Ficha de inscripción del socio" };
const rutaPersonalizada = (tipo) => `plantillas/${tipo}.docx`; // en la tabla archivos (no se sirve en /uploads)

// Marcadores disponibles (para la ayuda en pantalla)
const CAMPOS = [
  ["cooperativa", "Nombre de la cooperativa"], ["lugar", "Sucursal del socio"], ["fecha_hoy", "Fecha de hoy en letras"],
  ["numero_prestamo", "Número (o código) del préstamo"], ["socio_nombre", "Nombre del socio"], ["socio_identidad", "Documento de identidad"],
  ["socio_numero", "Número de socio"], ["socio_direccion", "Dirección"], ["socio_telefono", "Teléfono"],
  ["monto", "Monto (con separador de miles)"], ["monto_letras", "Monto en letras"], ["moneda_simbolo", "Símbolo de la moneda"],
  ["moneda_nombre", "Nombre de la moneda"], ["tasa_mensual", "Tasa mensual (%)"], ["tasa_anual", "Tasa anual (%)"],
  ["plazo_meses", "Plazo en meses"], ["cuota", "Cuota mensual"], ["fecha_otorgado", "Fecha de otorgamiento"],
  ["fecha_vencimiento", "Fecha de la última cuota"], ["linea", "Línea de crédito"], ["destino", "Destino"],
  ["numero_pagare", "N.º de pagaré"], ["numero_acta", "N.º de acta"], ["numero_cheque", "N.º de cheque"],
  ["grupo", "Grupo (créditos grupales)"], ["promotor", "Promotor"], ["garantias_texto", "Garantías en un párrafo"],
  ["firma_cooperativa", "Quien genera el documento"],
  ["#cuotas … /cuotas", "Tabla del plan: numero, fecha, cuota, capital, interes, saldo"],
  ["#garantias … /garantias", "Lista de garantías: descripcion"],
];

const fechaLarga = (iso) => {
  if (!iso) return "";
  const d = new Date(`${String(iso).substring(0, 10)}T12:00:00`);
  return isNaN(d) ? "" : d.toLocaleDateString(pais.locale(), { day: "numeric", month: "long", year: "numeric" });
};
const soloFecha = (v) => (v instanceof Date ? v.toISOString().substring(0, 10) : v ? String(v).substring(0, 10) : null);

const datosDocumento = async (idPrestamo, usuario) => {
  const [[p]] = await pool.query(
    `SELECT p.*, u.nombre_completo, u.dni, u.numero_socio, u.direccion, u.telefono, u.municipio, u.departamento,
            s.nombre AS sucursal, pr.nombre_completo AS promotor,
            (SELECT g.nombre FROM creditos_grupales cg JOIN grupos g ON g.id_grupo = cg.id_grupo WHERE cg.id_credito_grupal = p.id_credito_grupal) AS grupo
     FROM prestamos p JOIN usuarios u ON u.id_usuario = p.id_usuario
     LEFT JOIN sucursales s ON s.id_sucursal = u.id_sucursal
     LEFT JOIN usuarios pr ON pr.id_usuario = p.id_promotor
     WHERE p.id_prestamo = ?`,
    [idPrestamo]
  );
  if (!p) return null;
  const [[coop]] = await pool.query("SELECT valor FROM configuracion_sitio WHERE clave = 'site_name'");
  const [garantias] = await pool.query("SELECT * FROM garantias WHERE id_prestamo = ? AND estado = 'vigente' ORDER BY id_garantia", [idPrestamo]).catch(() => [[]]);
  const otorgado = soloFecha(p.fecha_otorgado) || hoyISO();
  const plan = generarPlan({ monto: p.monto, tasaAnual: p.tasa_interes, plazo: p.plazo_meses, fechaInicio: otorgado, redondeo: p.redondeo_cuota, metodo: p.metodo_interes });
  const tasaMensual = p.tipo_tasa === "nominal_mensual" && p.tasa_original != null ? parseFloat(p.tasa_original) : parseFloat(p.tasa_interes) / 12;
  const n = (v) => pais.numero(v);
  const textoGarantias = garantias.length
    ? `El Deudor garantiza el préstamo con: ${garantias.map((g) => describir(g)).join("; ")}.`
    : "El préstamo se otorga sin garantías adicionales a la responsabilidad personal del Deudor.";
  return {
    cooperativa: coop?.valor || "la Cooperativa",
    lugar: [p.municipio, p.sucursal].filter(Boolean)[0] || p.sucursal || "",
    fecha_hoy: fechaLarga(hoyISO()),
    numero_prestamo: p.codigo || String(p.id_prestamo),
    codigo_credito: p.codigo || String(p.id_prestamo),
    socio_nombre: p.nombre_completo,
    socio_identidad: p.dni || "",
    socio_numero: p.numero_socio ? String(p.numero_socio) : "",
    socio_direccion: p.direccion || [p.municipio, p.departamento].filter(Boolean).join(", ") || "(no indicado)",
    socio_telefono: p.telefono || "",
    monto: n(p.monto),
    monto_letras: montoALetras(p.monto),
    moneda_simbolo: pais.obtener().moneda.simbolo,
    moneda_nombre: pais.obtener().moneda.nombre,
    tasa_mensual: n(tasaMensual),
    tasa_anual: n(tasaMensual * 12),
    plazo_meses: String(p.plazo_meses),
    cuota: plan.length ? n(plan[0].cuota) : "",
    fecha_otorgado: fechaLarga(otorgado),
    fecha_vencimiento: plan.length ? fechaLarga(plan[plan.length - 1].fecha_vencimiento) : "",
    linea: p.linea_credito || "no especificada",
    destino: p.destino || "no especificado",
    numero_pagare: p.numero_pagare || String(p.id_prestamo),
    numero_acta: p.numero_acta || "—",
    numero_cheque: p.numero_cheque || "",
    grupo: p.grupo || "",
    promotor: p.promotor || "",
    garantias_texto: textoGarantias,
    garantias: garantias.map((g) => ({ descripcion: describir(g) })),
    firma_cooperativa: usuario?.nombre_completo || "",
    cuotas: plan.map((c) => ({
      numero: String(c.numero),
      fecha: soloFecha(c.fecha_vencimiento),
      cuota: n(c.cuota),
      capital: n(c.capital),
      interes: n(c.interes),
      saldo: n(c.saldo),
    })),
  };
};

// Datos de la ficha de inscripción del socio
const CAMPOS_FICHA = [
  ["nombres", "Nombres"], ["apellidos", "Apellidos"], ["fecha_nacimiento", "Fecha de nacimiento"], ["genero", "Género"],
  ["estado_civil", "Estado civil"], ["escolaridad", "Escolaridad"], ["nacionalidad", "Nacionalidad"], ["socio_correo", "Correo"],
  ["region_nombre", "Departamento / provincia (palabra)"], ["departamento", "Departamento"], ["municipio", "Municipio"],
  ["comunidad", "Comunidad"], ["fecha_ingreso", "Fecha de ingreso"], ["estado", "Estado del socio"], ["sucursal", "Sucursal"],
  ["profesion", "Profesión"], ["actividad_economica", "Actividad económica"], ["lugar_trabajo", "Lugar de trabajo"],
  ["ingreso_mensual", "Ingreso mensual"], ["origen_fondos", "Origen de fondos"], ["es_pep", "PEP (Sí/No)"],
  ["conyuge_nombre", "Cónyuge"], ["conyuge_identidad", "Identidad del cónyuge"],
  ["#beneficiarios … /beneficiarios", "Beneficiarios: nombre, parentesco, identidad, porcentaje"],
];
const datosFicha = async (idUsuario) => {
  const [[u]] = await pool.query(
    `SELECT u.*, s.nombre AS sucursal FROM usuarios u LEFT JOIN sucursales s ON s.id_sucursal = u.id_sucursal WHERE u.id_usuario = ?`,
    [idUsuario]
  );
  if (!u) return null;
  const [[coop]] = await pool.query("SELECT valor FROM configuracion_sitio WHERE clave = 'site_name'");
  const [benef] = await pool.query("SELECT * FROM beneficiarios WHERE id_usuario = ? ORDER BY id_beneficiario", [idUsuario]).catch(() => [[]]);
  const partes = String(u.nombre_completo || "").split(" ");
  const v = (x) => (x == null || x === "" ? "" : String(x));
  return {
    cooperativa: coop?.valor || "Cooperativa",
    fecha_hoy: fechaLarga(hoyISO()),
    lugar: v(u.municipio) || v(u.sucursal),
    socio_numero: v(u.numero_socio),
    socio_nombre: v(u.nombre_completo),
    nombres: v(u.nombres) || partes.slice(0, Math.ceil(partes.length / 2)).join(" "),
    apellidos: v(u.apellidos) || partes.slice(Math.ceil(partes.length / 2)).join(" "),
    socio_identidad: v(u.dni),
    fecha_nacimiento: fechaLarga(soloFecha(u.fecha_nacimiento)),
    genero: v(u.genero),
    estado_civil: v(u.estado_civil),
    escolaridad: v(u.escolaridad),
    nacionalidad: v(u.nacionalidad),
    socio_telefono: v(u.telefono),
    socio_correo: v(u.correo),
    region_nombre: pais.obtener().regiones?.nombre || "Departamento",
    departamento: v(u.departamento),
    municipio: v(u.municipio),
    comunidad: v(u.comunidad),
    socio_direccion: v(u.direccion),
    fecha_ingreso: fechaLarga(soloFecha(u.fecha_ingreso || u.fecha_registro)),
    estado: v(u.estado),
    sucursal: v(u.sucursal),
    profesion: v(u.profesion),
    actividad_economica: v(u.actividad_economica),
    lugar_trabajo: v(u.lugar_trabajo),
    ingreso_mensual: u.ingreso_mensual != null ? pais.dinero(u.ingreso_mensual) : "",
    origen_fondos: v(u.origen_fondos),
    es_pep: u.es_pep ? `Sí (${v(u.pep_detalle)})` : "No",
    conyuge_nombre: v(u.conyuge_nombre),
    conyuge_identidad: v(u.conyuge_identidad),
    beneficiarios: benef.map((b) => ({ nombre: b.nombre, parentesco: v(b.parentesco), identidad: v(b.identidad), porcentaje: pais.numero(b.porcentaje) })),
  };
};

const plantilla = async (tipo) => {
  try {
    const [[f]] = await pool.query("SELECT contenido FROM archivos WHERE ruta = ?", [rutaPersonalizada(tipo)]);
    if (f?.contenido) return { buffer: f.contenido, personalizada: true };
  } catch {}
  return { buffer: fs.readFileSync(path.join(__dirname, "..", "plantillas", `${tipo}.docx`)), personalizada: false };
};

// Llena una plantilla. Lanza un error con .codigo 400 si la plantilla tiene marcadores mal escritos.
const llenar = (buffer, datos) => {
  try {
    const doc = new Docxtemplater(new PizZip(buffer), { paragraphLoop: true, linebreaks: true, nullGetter: () => "" });
    doc.render(datos);
    return doc.getZip().generate({ type: "nodebuffer", compression: "DEFLATE" });
  } catch (e) {
    const detalle = (e.properties?.errors || []).map((x) => x.properties?.explanation).filter(Boolean).slice(0, 3).join(" ");
    throw Object.assign(new Error(`La plantilla tiene un error: ${detalle || e.message}`), { codigo: 400 });
  }
};

module.exports = { TIPOS, CAMPOS, CAMPOS_FICHA, rutaPersonalizada, datosDocumento, datosFicha, plantilla, llenar };
