// Políticas de la cooperativa: textos que el Super Administrador redacta y publica, y que
// el socio acepta. Cada publicación queda guardada como versión (lo que el socio aceptó).
// En el texto se pueden usar variables que se llenan con los parámetros actuales:
//   {cooperativa}  {mora_tasa_anual}  {mora_dias_gracia}
const pool = require("../db");
const config = require("./configFinanciera");

const nombreCooperativa = async () => {
  try {
    const [rows] = await pool.query("SELECT valor FROM configuracion_sitio WHERE clave = 'site_name'");
    return rows.length ? rows[0].valor : "SmartCoop";
  } catch {
    return "SmartCoop";
  }
};

// Reemplaza las variables del texto por los valores vigentes
const completarTexto = async (texto) => {
  const c = config.obtener();
  const valores = {
    cooperativa: await nombreCooperativa(),
    mora_tasa_anual: String(c.mora_tasa_anual),
    mora_dias_gracia: String(c.mora_dias_gracia),
  };
  return String(texto || "").replace(/\{(cooperativa|mora_tasa_anual|mora_dias_gracia)\}/g, (_, k) => valores[k]);
};

// Última versión publicada de cada política activa
const SQL_PUBLICADAS = `
  SELECT p.id_politica, p.clave, p.orden, p.obligatoria, p.version, p.version_requerida,
         v.titulo, v.contenido, v.publicada_en
  FROM politicas p
  INNER JOIN politicas_versiones v ON v.id_politica = p.id_politica AND v.version = p.version
  WHERE p.activa = 1 AND p.version > 0
  ORDER BY p.orden, p.id_politica`;

const publicadas = async (conn = pool) => {
  const [rows] = await conn.query(SQL_PUBLICADAS);
  return Promise.all(rows.map(async (r) => ({ ...r, obligatoria: !!r.obligatoria, contenido: await completarTexto(r.contenido) })));
};

// Estado de aceptación de un usuario: la última versión que aceptó de cada política
const estadoDe = async (idUsuario, conn = pool) => {
  const lista = await publicadas(conn);
  const [acep] = await conn.query(
    `SELECT id_politica, MAX(version) AS version, MAX(aceptada_en) AS aceptada_en
     FROM politicas_aceptaciones WHERE id_usuario = ? GROUP BY id_politica`,
    [idUsuario]
  );
  const mapa = Object.fromEntries(acep.map((a) => [a.id_politica, a]));
  return lista.map((p) => {
    const a = mapa[p.id_politica];
    const vigente = !!a && a.version >= p.version_requerida;
    return {
      ...p,
      aceptada: vigente,
      version_aceptada: a?.version || null,
      aceptada_en: a?.aceptada_en || null,
      pendiente: p.obligatoria && !vigente,
    };
  });
};

// Registra que el usuario aceptó la versión vigente de las políticas indicadas (o de todas)
const aceptar = async (idUsuario, ip, ids = null, conn = pool) => {
  const lista = await publicadas(conn);
  const elegidas = ids ? lista.filter((p) => ids.includes(p.id_politica)) : lista;
  for (const p of elegidas) {
    await conn.query(
      `INSERT IGNORE INTO politicas_aceptaciones (id_politica, id_usuario, version, ip) VALUES (?, ?, ?, ?)`,
      [p.id_politica, idUsuario, p.version, ip ? String(ip).substring(0, 60) : null]
    );
  }
  return elegidas.length;
};

// Borradores iniciales: no se muestran a nadie hasta que el Super Administrador los revise y publique
const BORRADORES = [
  {
    clave: "reglamento_prestamos",
    titulo: "Reglamento de préstamos y pagos",
    contenido: `# Solicitud y aprobación
- El socio puede solicitar un préstamo desde la app o en la oficina de {cooperativa}.
- La cooperativa revisa la solicitud, los ingresos y la capacidad de pago del socio. Puede aprobarla, ajustar el monto o el plazo, o rechazarla indicando el motivo.
- Al aprobarse se emite una carta de aprobación. El dinero se entrega con un comprobante de desembolso que el socio debe firmar.

# Cuotas e intereses
- El préstamo se paga en cuotas mensuales fijas durante el plazo pactado.
- El interés se calcula sobre el saldo pendiente. En cada pago se cobra como mínimo un mes de interés; pasados 30 días desde el último pago, el interés se calcula por los días transcurridos.
- Cada pago se aplica primero a la mora (si la hay), luego a los intereses y el resto al capital.

# Abonos a capital y pago anticipado
- Lo que el socio pague por encima de su cuota se abona directamente a capital, lo que reduce el saldo y los intereses futuros.
- El socio puede cancelar su préstamo en cualquier momento pagando el saldo más los intereses del tiempo transcurrido. No se cobran los intereses de los meses que faltaban ni penalidad por pago anticipado.
- Al cancelar el préstamo se entrega una constancia de cancelación (finiquito).

# Mora
- Si pasan {mora_dias_gracia} días desde el último pago sin que se pague la cuota, el préstamo entra en mora.
- La mora genera un interés del {mora_tasa_anual}% anual sobre el saldo, por cada día de atraso, y se cobra junto con el siguiente pago.
- La cooperativa enviará recordatorios antes del vencimiento y durante el atraso.

# Pagos por transferencia o depósito
- El socio puede pagar por transferencia, depósito o pago móvil y reportarlo desde la app con la foto del comprobante.
- El pago se considera hecho cuando la cooperativa lo confirma. Al confirmarlo se emite el recibo correspondiente.
- Si el comprobante no corresponde, el pago se rechaza indicando el motivo.`,
  },
  {
    clave: "privacidad",
    titulo: "Privacidad y protección de datos",
    contenido: `# Qué datos guardamos
- Datos personales: nombre, número de identidad, fecha de nacimiento, teléfono, correo y dirección.
- Fotos del frente y reverso de la tarjeta de identidad.
- Información laboral e ingresos que el socio indica al solicitar un préstamo.
- Su firma digital, si decide usarla, y el historial de sus operaciones con la cooperativa.

# Para qué los usamos
- Para identificar al socio, evaluar sus solicitudes y administrar sus préstamos, cuentas y aportaciones.
- Para emitir recibos y constancias, y enviarle avisos y recordatorios por la app o por correo.

# Quién los ve
- Solo el personal autorizado de {cooperativa}, según su función.
- No vendemos ni compartimos los datos con terceros, salvo cuando la ley o una autoridad competente lo exija.

# Cómo los protegemos
- El acceso a la app requiere usuario y contraseña. Las fotos de la identidad no son públicas.
- Todas las operaciones quedan registradas con fecha y usuario.

# Derechos del socio
- El socio puede consultar sus datos y pedir que se corrijan si están incorrectos, comunicándose con la cooperativa.`,
  },
  {
    clave: "uso_app",
    titulo: "Términos de uso de la app y firma digital",
    contenido: `# Cuenta del socio
- La cuenta es personal. El socio es responsable de cuidar su contraseña y no compartirla.
- Si sospecha que alguien más usa su cuenta, debe cambiar su contraseña y avisar a la cooperativa.

# Firma digital
- El socio puede dibujar su firma en la app y usarla para firmar sus recibos y comprobantes.
- Al firmar un documento desde la app, el socio confirma que está de acuerdo con su contenido. La firma queda guardada en el documento con la fecha y hora.
- Una vez firmado, el documento no se puede modificar.

# Comunicaciones
- La cooperativa enviará avisos de pagos, recibos, préstamos y cambios en estas políticas por la app y, si el socio tiene correo registrado, por correo electrónico.

# Cambios en las políticas
- {cooperativa} puede actualizar estas políticas. Cuando un cambio sea importante, el socio deberá leerlo y aceptarlo para seguir usando la app.`,
  },
];

module.exports = { completarTexto, publicadas, estadoDe, aceptar, BORRADORES };
