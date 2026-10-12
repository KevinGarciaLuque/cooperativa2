// Genera el recibo en PDF (tamaño media carta) a partir de los datos del recibo.
// jsPDF se carga bajo demanda para no aumentar el peso inicial de la aplicación.

const fmt = (n) =>
  `L. ${parseFloat(n || 0).toLocaleString("es-HN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const TIPOS = {
  pago_prestamo: "Recibo de pago de préstamo",
  aportacion: "Recibo de aportación",
  desembolso: "Comprobante de desembolso",
  finiquito: "Constancia de cancelación de préstamo",
};

const METODOS = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  cheque: "Cheque",
  deposito: "Depósito",
  cuenta: "Depósito a cuenta del socio",
};

const fechaLarga = (f) => {
  const d = new Date(f);
  return isNaN(d) ? "" : d.toLocaleString("es-HN", { dateStyle: "long", timeStyle: "short" });
};

export const nombreArchivoRecibo = (recibo) =>
  recibo.tipo === "finiquito" ? `Finiquito-${recibo.numero}.pdf` : `Recibo-${recibo.numero}.pdf`;

const soloFecha = (f) => {
  const d = new Date(f);
  return isNaN(d) ? "" : d.toLocaleDateString("es-HN", { day: "numeric", month: "long", year: "numeric" });
};

// Constancia formal de cancelación (finiquito / paz y salvo)
async function generarFiniquitoPdf(recibo) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a5" });
  const ancho = doc.internal.pageSize.getWidth();
  const margen = 16;
  const d = recibo.detalle || {};
  let y = 20;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(String(recibo.cooperativa || "Cooperativa"), ancho / 2, y, { align: "center" });
  y += 9;
  doc.setFontSize(12);
  doc.text("CONSTANCIA DE CANCELACIÓN DE PRÉSTAMO", ancho / 2, y, { align: "center" });
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Finiquito N.º ${recibo.numero}`, ancho / 2, y, { align: "center" });
  doc.setTextColor(0);
  y += 5;

  if (recibo.anulado) {
    doc.setTextColor(192, 57, 43);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text("ANULADA", ancho / 2, y + 8, { align: "center" });
    doc.setTextColor(0);
    y += 12;
  }
  y += 8;

  const nombre = recibo.socio?.nombre || "el socio";
  const dni = recibo.socio?.dni ? `, con identidad N.º ${recibo.socio.dni}` : "";
  const plazo = parseInt(d.plazo_meses) === 0 ? "plazo indefinido" : `plazo de ${d.plazo_meses} meses`;
  const parrafo =
    `${recibo.cooperativa || "La cooperativa"} HACE CONSTAR que ${nombre}${dni}, canceló en su totalidad ` +
    `el préstamo N.º ${d.id_prestamo}, otorgado el ${soloFecha(d.fecha_otorgado)} por un monto de ${fmt(d.monto_otorgado)} ` +
    `a ${plazo}, habiendo realizado el último pago el ${soloFecha(d.fecha_cancelacion)}.`;
  doc.setFontSize(11);
  const lineas = doc.splitTextToSize(parrafo, ancho - margen * 2);
  doc.text(lineas, margen, y, { align: "left", lineHeightFactor: 1.5 });
  y += lineas.length * 6.2 + 4;

  const parrafo2 =
    "En consecuencia, el socio se encuentra A PAZ Y SALVO por este concepto y no mantiene saldo pendiente " +
    "de capital, intereses ni cargos con la cooperativa respecto a dicho préstamo.";
  const lineas2 = doc.splitTextToSize(parrafo2, ancho - margen * 2);
  doc.text(lineas2, margen, y, { lineHeightFactor: 1.5 });
  y += lineas2.length * 6.2 + 6;

  // Resumen
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(margen, y, ancho - margen * 2, 24, 3, 3, "F");
  doc.setFontSize(10);
  const fila = (etiqueta, valor, yy) => {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100);
    doc.text(etiqueta, margen + 4, yy);
    doc.setTextColor(0);
    doc.setFont("helvetica", "bold");
    doc.text(valor, ancho - margen - 4, yy, { align: "right" });
  };
  fila("Monto otorgado", fmt(d.monto_otorgado), y + 8);
  fila("Total pagado", fmt(d.total_pagado), y + 14);
  fila("Número de pagos", String(d.pagos ?? ""), y + 20);
  y += 40;

  // Firmas
  doc.setDrawColor(148, 163, 184);
  const mitad = (ancho - margen * 2) / 2;
  doc.line(margen, y, margen + mitad - 8, y);
  doc.line(margen + mitad + 8, y, ancho - margen, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100);
  doc.text(recibo.emitido_por || "Representante", margen + (mitad - 8) / 2, y + 4, { align: "center" });
  doc.text("Por la cooperativa", margen + (mitad - 8) / 2, y + 8, { align: "center" });
  doc.text(recibo.socio?.nombre || "Socio", margen + mitad + 8 + (mitad - 8) / 2, y + 4, { align: "center" });
  doc.text("Recibí conforme", margen + mitad + 8 + (mitad - 8) / 2, y + 8, { align: "center" });
  doc.setFontSize(7);
  doc.text(`Emitida el ${soloFecha(recibo.fecha)}`, ancho / 2, y + 18, { align: "center" });

  return doc.output("blob");
}

export async function generarReciboPdf(recibo) {
  if (recibo.tipo === "finiquito") return generarFiniquitoPdf(recibo);
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a5" });
  const ancho = doc.internal.pageSize.getWidth();
  const margen = 14;
  const d = recibo.detalle || {};
  let y = 18;

  // Encabezado
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(String(recibo.cooperativa || "Cooperativa"), ancho / 2, y, { align: "center" });
  y += 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(TIPOS[recibo.tipo] || "Recibo", ancho / 2, y, { align: "center" });
  y += 7;
  doc.setTextColor(0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(`N.º ${recibo.numero}`, ancho / 2, y, { align: "center" });
  y += 4;

  if (recibo.anulado) {
    doc.setTextColor(192, 57, 43);
    doc.setFontSize(20);
    doc.text("ANULADO", ancho / 2, y + 10, { align: "center", angle: 0 });
    doc.setTextColor(0);
    y += 10;
  }
  y += 5;

  // Filas de detalle
  const filas = [["Fecha", fechaLarga(recibo.fecha)]];
  if (recibo.socio) {
    filas.push(["Socio", recibo.socio.nombre]);
    filas.push(["Identidad", recibo.socio.dni || "—"]);
  }
  filas.push(["Concepto", recibo.concepto || "—"]);
  filas.push(["Forma de pago", METODOS[recibo.metodo] || recibo.metodo || "—"]);

  if (recibo.tipo === "pago_prestamo") {
    filas.push(["Abono a capital", fmt(d.capital)]);
    filas.push(["Intereses", fmt(d.interes)]);
    if (parseFloat(d.mora) > 0) filas.push(["Mora", fmt(d.mora)]);
    filas.push(["Saldo del préstamo", d.liquidado ? "Liquidado" : fmt(d.saldo_nuevo)]);
  } else if (recibo.tipo === "aportacion" && d.saldo_nuevo != null) {
    filas.push([`Saldo de la cuenta ${d.cuenta || ""}`.trim(), fmt(d.saldo_nuevo)]);
  } else if (recibo.tipo === "desembolso") {
    if (d.plazo_meses != null) {
      filas.push(["Plazo", parseInt(d.plazo_meses) === 0 ? "Indefinido" : `${d.plazo_meses} meses`]);
    }
    if (d.referencia) filas.push(["Referencia", d.referencia]);
  }

  doc.setFontSize(10);
  filas.forEach(([etiqueta, valor]) => {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100);
    doc.text(etiqueta, margen, y);
    doc.setTextColor(0);
    doc.setFont("helvetica", "bold");
    const lineas = doc.splitTextToSize(String(valor), ancho - margen * 2 - 45);
    doc.text(lineas, ancho - margen, y, { align: "right" });
    y += 5.5 * lineas.length;
    doc.setDrawColor(226, 232, 240);
    doc.line(margen, y - 3.2, ancho - margen, y - 3.2);
  });

  // Monto
  y += 4;
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(margen, y, ancho - margen * 2, 16, 3, 3, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(recibo.tipo === "desembolso" ? "Monto entregado" : "Monto recibido", margen + 4, y + 10);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(fmt(recibo.monto), ancho - margen - 4, y + 10.5, { align: "right" });
  y += 36;

  // Firmas
  doc.setDrawColor(148, 163, 184);
  const mitad = (ancho - margen * 2) / 2;
  doc.line(margen, y, margen + mitad - 8, y);
  doc.line(margen + mitad + 8, y, ancho - margen, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100);
  doc.text(recibo.emitido_por || "Cajero", margen + (mitad - 8) / 2, y + 4, { align: "center" });
  doc.text("Recibido por", margen + (mitad - 8) / 2, y + 8, { align: "center" });
  doc.text(recibo.socio?.nombre || "Socio", margen + mitad + 8 + (mitad - 8) / 2, y + 4, { align: "center" });
  doc.text(recibo.tipo === "desembolso" ? "Recibí conforme" : "Entregado por", margen + mitad + 8 + (mitad - 8) / 2, y + 8, { align: "center" });

  return doc.output("blob");
}
