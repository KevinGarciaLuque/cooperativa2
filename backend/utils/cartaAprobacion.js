// Carta de aprobación de préstamo en PDF: se envía al socio por correo al aprobar su
// solicitud y queda disponible para descargarla. No muestra la tasa de interés: el
// socio solo ve el monto, el plazo y la cuota.
const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");
const pool = require("../db");
const { calcularCuotaMensual } = require("./calculosPrestamo");
const { notificarSocio, escaparHtml, correoConfigurado } = require("./notificaciones");

// Estados en los que el préstamo ya fue aprobado alguna vez. Un préstamo registrado
// directamente (sin pasar por "aprobado") no tiene fecha de aprobación: se usa la de otorgado.
const ESTADOS_APROBADOS = ["aprobado", "activo", "mora", "pagado"];

const num = (v) => parseFloat(v || 0);
const fmt = (n) =>
  `L. ${num(n).toLocaleString("es-HN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fechaLarga = (f) => {
  const d = new Date(f);
  return isNaN(d) ? "" : d.toLocaleDateString("es-HN", { day: "numeric", month: "long", year: "numeric" });
};

const leerConfig = async (clave) => {
  const [rows] = await pool.query("SELECT valor FROM configuracion_sitio WHERE clave = ?", [clave]);
  return rows.length ? rows[0].valor : null;
};

// Todos los documentos llevan el logo de SmartCoop
const LOGO = path.join(__dirname, "..", "assets", "smartcoop.png");
const leerLogo = () => {
  try {
    return fs.readFileSync(LOGO);
  } catch {
    return null;
  }
};

// Datos de la carta, o null si el préstamo no existe o nunca fue aprobado
const datosCarta = async (idPrestamo) => {
  const [rows] = await pool.query(
    `SELECT p.id_prestamo, p.id_usuario, p.monto, p.plazo_meses, p.tasa_interes, p.estado, p.fecha_aprobacion, p.fecha_otorgado,
            u.nombre_completo, u.dni, a.nombre_completo AS aprobado_por
     FROM prestamos p
     INNER JOIN usuarios u ON p.id_usuario = u.id_usuario
     LEFT JOIN usuarios a ON p.aprobado_por = a.id_usuario
     WHERE p.id_prestamo = ?`,
    [idPrestamo]
  );
  const p = rows[0];
  if (!p || !ESTADOS_APROBADOS.includes(p.estado)) return null;
  const fechaAprobacion = p.fecha_aprobacion || (p.estado !== "aprobado" ? p.fecha_otorgado : null);
  if (!fechaAprobacion) return null;
  const plazo = parseInt(p.plazo_meses) || 0;
  return {
    cooperativa: (await leerConfig("site_name")) || "SmartCoop",
    logo: leerLogo(),
    id_prestamo: p.id_prestamo,
    id_usuario: p.id_usuario,
    socio: p.nombre_completo,
    dni: p.dni,
    monto: num(p.monto),
    plazo,
    cuota: parseFloat(calcularCuotaMensual(num(p.monto), num(p.tasa_interes), plazo).toFixed(2)),
    fecha_aprobacion: fechaAprobacion,
    aprobado_por: p.aprobado_por,
  };
};

const nombreArchivoCarta = (d) => `Carta-aprobacion-prestamo-${d.id_prestamo}.pdf`;

const generarCartaPdf = (d) =>
  new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "LETTER", margin: 60, info: { Title: "Carta de aprobación de préstamo" } });
    const partes = [];
    doc.on("data", (b) => partes.push(b));
    doc.on("end", () => resolve(Buffer.concat(partes)));
    doc.on("error", reject);

    const ancho = doc.page.width - 120;
    const AZUL = "#1a2035";
    const GRIS = "#64748b";

    // Encabezado (el logo, si hay, centrado sobre el nombre)
    let yTitulo = 60;
    if (d.logo) {
      try {
        doc.image(d.logo, doc.page.width / 2 - 35, 40, { fit: [70, 70], align: "center", valign: "center" });
        yTitulo = 120;
      } catch {
        // logo dañado: la carta sale sin él
      }
    }
    doc.fillColor(AZUL).font("Helvetica-Bold").fontSize(18).text(d.cooperativa, 60, yTitulo, { width: ancho, align: "center" });
    doc.moveDown(0.3);
    doc.fontSize(13).text("CARTA DE APROBACIÓN DE PRÉSTAMO", { width: ancho, align: "center" });
    doc.moveDown(0.2);
    doc.fillColor(GRIS).font("Helvetica").fontSize(10)
      .text(`Préstamo N.º ${d.id_prestamo} · ${fechaLarga(d.fecha_aprobacion)}`, { width: ancho, align: "center" });
    doc.moveDown(2);

    // Cuerpo
    doc.fillColor("#000").font("Helvetica").fontSize(11.5);
    doc.text(`Estimado(a) ${d.socio}:`, { width: ancho });
    doc.moveDown();
    doc.text(
      `Nos complace informarle que ${d.cooperativa} APROBÓ su solicitud de préstamo, presentada por ` +
        `${d.socio}${d.dni ? `, con identidad N.º ${d.dni}` : ""}, en las condiciones siguientes:`,
      { width: ancho, align: "justify", lineGap: 3 }
    );
    doc.moveDown(1.2);

    // Condiciones
    const filas = [
      ["Monto aprobado", fmt(d.monto)],
      ["Plazo", d.plazo === 0 ? "Plazo indefinido" : `${d.plazo} ${d.plazo === 1 ? "mes" : "meses"}`],
      [d.plazo === 0 ? "Pago mensual" : "Cuota mensual", fmt(d.cuota)],
      ["Fecha de aprobación", fechaLarga(d.fecha_aprobacion)],
    ];
    const alto = filas.length * 26 + 16;
    const y0 = doc.y;
    doc.roundedRect(60, y0, ancho, alto, 8).fill("#f1f5f9");
    filas.forEach(([etiqueta, valor], i) => {
      const y = y0 + 14 + i * 26;
      doc.fillColor(GRIS).font("Helvetica").fontSize(11).text(etiqueta, 76, y, { width: ancho / 2 });
      doc.fillColor(AZUL).font("Helvetica-Bold").fontSize(12)
        .text(valor, 60 + ancho / 2, y, { width: ancho / 2 - 16, align: "right" });
    });
    doc.y = y0 + alto + 20;
    doc.x = 60;

    doc.fillColor("#000").font("Helvetica-Bold").fontSize(11.5).text("Próximos pasos", { width: ancho });
    doc.moveDown(0.4);
    doc.font("Helvetica").fontSize(11);
    [
      "La cooperativa se comunicará con usted para coordinar la entrega del dinero (desembolso).",
      "Preséntese con su tarjeta de identidad. Al recibir el dinero firmará el comprobante de desembolso.",
      d.plazo === 0
        ? "Los pagos mensuales comienzan un mes después del desembolso."
        : "Su primera cuota vence aproximadamente un mes después del desembolso.",
      "Puede consultar su préstamo, sus pagos y sus recibos en su cuenta de socio.",
    ].forEach((t) => {
      doc.text(`•  ${t}`, { width: ancho, lineGap: 2, indent: 0 });
      doc.moveDown(0.3);
    });
    doc.moveDown(0.6);
    doc.fillColor(GRIS).fontSize(9.5).text(
      "La cuota indicada corresponde a las condiciones aprobadas y puede variar levemente según la fecha del " +
        "desembolso. Esta carta no constituye el desembolso del préstamo.",
      { width: ancho, align: "justify" }
    );

    // Firma
    const yFirma = Math.max(doc.y + 70, doc.page.height - 170);
    doc.strokeColor("#94a3b8").moveTo(60 + ancho / 4, yFirma).lineTo(60 + (ancho * 3) / 4, yFirma).stroke();
    doc.fillColor("#000").font("Helvetica-Bold").fontSize(10)
      .text(d.aprobado_por || "Administración", 60, yFirma + 6, { width: ancho, align: "center" });
    doc.fillColor(GRIS).font("Helvetica").fontSize(9).text(`Por ${d.cooperativa}`, { width: ancho, align: "center" });

    doc.end();
  });

// Genera la carta y la envía al correo del socio. Devuelve { enviado, correo, motivo }.
const enviarCartaAprobacion = async (idPrestamo) => {
  const d = await datosCarta(idPrestamo);
  if (!d) return { enviado: false, motivo: "El préstamo no está aprobado." };
  const pdf = await generarCartaPdf(d);
  return notificarSocio(
    d.id_usuario,
    `¡Tu préstamo fue aprobado! — ${d.cooperativa}`,
    `<p>Hola <strong>${escaparHtml(d.socio)}</strong>:</p>
     <p>Tu solicitud de préstamo fue <strong>aprobada</strong>: ${fmt(d.monto)}` +
      `${d.plazo ? ` a ${d.plazo} meses, con una cuota mensual de ${fmt(d.cuota)}` : ""}.</p>
     <p>Te adjuntamos la carta de aprobación. La cooperativa se comunicará contigo para entregarte el dinero.</p>`,
    [{ filename: nombreArchivoCarta(d), content: pdf, contentType: "application/pdf" }]
  );
};

// Tras aprobar un préstamo (desde Solicitudes o desde Préstamos): la carta sale sola al
// correo del socio sin hacer esperar al personal. Devuelve el texto para el aviso y
// nunca falla: el préstamo ya quedó aprobado.
const avisarAprobacion = async (idPrestamo, idUsuario) => {
  const sinCorreo = " La carta de aprobación no se envió por correo: descárgala y compártela con el socio.";
  try {
    const [[u]] = await pool.query("SELECT correo FROM usuarios WHERE id_usuario = ?", [idUsuario]);
    const correo = String(u?.correo || "").trim();
    if (!correoConfigurado() || !correo) return sinCorreo;
    enviarCartaAprobacion(idPrestamo).catch(() => {});
    return ` La carta de aprobación se está enviando a ${correo}.`;
  } catch {
    return sinCorreo;
  }
};

module.exports = { datosCarta, generarCartaPdf, enviarCartaAprobacion, avisarAprobacion, nombreArchivoCarta };
