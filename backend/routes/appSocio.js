// App del socio (función "app_socio"): notificaciones en el teléfono, pagar la cuota desde su
// cuenta de ahorro, pasar dinero entre sus propias cuentas y bajar su estado de cuenta en PDF.
// Solo para socios activos; cada operación comprueba que las cuentas y el préstamo sean suyos.
const express = require("express");
const router = express.Router();
const PDFDocument = require("pdfkit");
const pool = require("../db");
const { habilitada } = require("../utils/funciones");
const push = require("../utils/push");
const config = require("../utils/configFinanciera");
const { registrarCaja } = require("../utils/caja");
const { contabilizar, conSalvaguarda } = require("../utils/contabilidad");
const { crearNotificacion } = require("../utils/notificaciones");
const { dinero, fechaTexto, locale } = require("../utils/pais");
const { hoyISO, zona } = require("../utils/fechas");
const { procesarPago, FalloPago } = require("./pagos");

const num = (v) => parseFloat(v || 0);
const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const esFecha = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

// Las aportaciones son capital del socio: no se usan para pagar ni se pasan a otra cuenta
// (salvo que la cooperativa lo permita en Parámetros)
const esAportacion = (c) => /aportaci/i.test(c.tipo_cuenta || "");
const puedeDebitar = (c) => c.estado === "activa" && (!esAportacion(c) || parseInt(config.obtener().app_debito_aportaciones) === 1);

router.use((req, res, next) => {
  if (req.usuario?.rol !== "Socio") return res.status(403).json({ message: "Solo para socios." });
  next();
});

// GET /api/app-socio/estado → si la app está encendida y la clave para las notificaciones
router.get("/estado", async (req, res) => {
  try {
    const encendida = await habilitada("app_socio", req.usuario);
    res.json({ success: true, habilitada: encendida, clave_push: encendida ? await push.clavePublica() : null });
  } catch (error) {
    console.error("ERROR EN ESTADO DE LA APP:", error);
    res.status(500).json({ message: "No se pudo leer el estado de la app" });
  }
});

router.use(async (req, res, next) => {
  if (await habilitada("app_socio", req.usuario)) return next();
  res.status(403).json({ message: "La app del socio no está habilitada." });
});

// POST /api/app-socio/push/suscribir  { subscription }
router.post("/push/suscribir", async (req, res) => {
  try {
    const ok = await push.suscribir(req.usuario.id_usuario, req.body?.subscription);
    if (!ok) return res.status(400).json({ message: "La suscripción no es válida." });
    res.json({ success: true });
  } catch (error) {
    console.error("ERROR AL SUSCRIBIR NOTIFICACIONES:", error);
    res.status(500).json({ message: "No se pudieron activar las notificaciones" });
  }
});

router.post("/push/cancelar", async (req, res) => {
  try {
    await push.cancelar(req.usuario.id_usuario, req.body?.endpoint);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: "No se pudieron desactivar las notificaciones" });
  }
});

// POST /api/app-socio/push/probar → una notificación de prueba al teléfono
router.post("/push/probar", async (req, res) => {
  const n = await push.enviarPush(req.usuario.id_usuario, {
    titulo: "Notificaciones activadas",
    cuerpo: "Así te avisaremos de tus pagos, cuotas por vencer y préstamos.",
  });
  res.json({ success: true, enviadas: n });
});

// GET /api/app-socio/cuentas → sus cuentas y cuáles puede usar para pagar o transferir
router.get("/cuentas", async (req, res) => {
  try {
    const [cuentas] = await pool.query(
      "SELECT id_cuenta, tipo_cuenta, saldo_actual, estado FROM cuentas WHERE id_usuario = ? ORDER BY id_cuenta",
      [req.usuario.id_usuario]
    );
    res.json({
      success: true,
      data: cuentas.map((c) => ({
        ...c,
        saldo_actual: num(c.saldo_actual),
        puede_debitar: puedeDebitar(c),
        puede_recibir: c.estado === "activa",
      })),
    });
  } catch (error) {
    console.error("ERROR AL LISTAR CUENTAS DE LA APP:", error);
    res.status(500).json({ message: "No se pudieron cargar tus cuentas" });
  }
});

// Cuenta del socio bloqueada para la operación (o error)
const cuentaPropia = async (conn, idCuenta, idUsuario) => {
  const [[c]] = await conn.query("SELECT * FROM cuentas WHERE id_cuenta = ? FOR UPDATE", [parseInt(idCuenta) || 0]);
  if (!c || c.id_usuario !== idUsuario) throw new FalloPago(404, { message: "La cuenta no existe." });
  return c;
};

const debitar = async (conn, cuenta, monto, descripcion, usuario) => {
  const anterior = num(cuenta.saldo_actual);
  const nuevo = r2(anterior - monto);
  await conn.query("UPDATE cuentas SET saldo_actual = ? WHERE id_cuenta = ?", [nuevo, cuenta.id_cuenta]);
  const [mov] = await conn.query(
    `INSERT INTO movimientos_cuenta (id_cuenta, tipo_movimiento, monto, descripcion, fecha, saldo_anterior, saldo_nuevo, referencia)
     VALUES (?, 'retiro', ?, ?, NOW(), ?, ?, 'app')`,
    [cuenta.id_cuenta, monto, descripcion.substring(0, 200), anterior, nuevo]
  );
  return { nuevo, idMovimiento: mov.insertId, usuario };
};

// POST /api/app-socio/pagar-cuota  { id_prestamo, id_cuenta, monto }
// El pago se aplica igual que en ventanilla (interés, mora, recibo) y se descuenta de su ahorro.
router.post("/pagar-cuota", async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const idUsuario = req.usuario.id_usuario;
    const monto = r2(num(req.body?.monto));
    const idPrestamo = parseInt(req.body?.id_prestamo) || 0;
    if (!(monto > 0)) return res.status(400).json({ message: "Indica el monto a pagar." });
    const [[p]] = await pool.query("SELECT id_usuario, estado FROM prestamos WHERE id_prestamo = ?", [idPrestamo]);
    if (!p || p.id_usuario !== idUsuario) return res.status(404).json({ message: "El préstamo no existe." });

    // Evita el pago doble por tocar dos veces el botón
    const [[reciente]] = await pool.query(
      `SELECT COUNT(*) AS n FROM pagos_prestamo
       WHERE id_prestamo = ? AND metodo_pago = 'debito_ahorro' AND monto_pagado = ? AND fecha_pago >= DATE_SUB(NOW(), INTERVAL 2 MINUTE)`,
      [idPrestamo, monto]
    );
    if (reciente.n) return res.status(409).json({ message: "Ya se aplicó un pago igual hace un momento. Revisa tus recibos." });

    await conn.beginTransaction();
    const cuenta = await cuentaPropia(conn, req.body?.id_cuenta, idUsuario);
    if (!puedeDebitar(cuenta)) throw new FalloPago(400, { message: `No puedes pagar desde la cuenta ${cuenta.tipo_cuenta}.` });
    if (num(cuenta.saldo_actual) < monto) throw new FalloPago(400, { message: `Saldo insuficiente: tienes ${dinero(cuenta.saldo_actual)} en ${cuenta.tipo_cuenta}.` });

    const r = await procesarPago(conn, { id_prestamo: idPrestamo, monto_pagado: monto, metodo_pago: "debito_ahorro" }, req.usuario);
    // Los cargos automáticos del préstamo (seguro, gastos) también salen de su cuenta
    const total = r2(r.montoPagadoNum + num(r.otrosCargos));
    if (num(cuenta.saldo_actual) < total) {
      throw new FalloPago(400, { message: `Con los cargos del préstamo el pago es de ${dinero(total)} y tienes ${dinero(cuenta.saldo_actual)}.` });
    }
    const d = await debitar(conn, cuenta, total, `Pago de préstamo #${idPrestamo} desde la app`, req.usuario);
    await registrarCaja(conn, {
      tipo: "egreso",
      categoria: "retiro_ahorro",
      monto: total,
      metodo: "debito_ahorro",
      descripcion: `Débito a ${cuenta.tipo_cuenta} para el pago del préstamo #${idPrestamo} (app del socio)`,
      referencia_tipo: "movimiento_cuenta",
      referencia_id: d.idMovimiento,
      id_socio: idUsuario,
      id_registrado_por: idUsuario,
      contable: { tipo_cuenta: cuenta.tipo_cuenta },
    });
    await conn.query("INSERT INTO bitacora (id_usuario, accion, detalle, fecha) VALUES (?, ?, ?, NOW())", [
      idUsuario,
      "Pago desde la app",
      `Pago de ${dinero(total)} al préstamo #${idPrestamo} desde ${cuenta.tipo_cuenta}. Saldo de la cuenta: ${dinero(d.nuevo)}`,
    ]);
    await conn.commit();

    crearNotificacion(idUsuario, {
      titulo: r.prestamoLiquidado ? `¡Préstamo #${idPrestamo} cancelado!` : "Pago aplicado",
      mensaje:
        `Pagaste ${dinero(total)} a tu préstamo #${idPrestamo} desde tu cuenta ${cuenta.tipo_cuenta}. ` +
        (r.prestamoLiquidado ? "Tu préstamo quedó totalmente pagado." : `Tu nuevo saldo es ${dinero(r.nuevoSaldo)}.`),
      tipo: "pago",
      idRecibo: r.idRecibo,
    });
    res.status(201).json({
      success: true,
      message: r.prestamoLiquidado ? "¡Pago aplicado! Tu préstamo quedó cancelado." : "Pago aplicado.",
      id_recibo: r.idRecibo,
      id_finiquito: r.idFiniquito,
      saldo_prestamo: r.nuevoSaldo,
      saldo_cuenta: d.nuevo,
      total_debitado: total,
    });
  } catch (error) {
    await conn.rollback().catch(() => {});
    if (error instanceof FalloPago) return res.status(error.codigo).json(error.cuerpo);
    console.error("ERROR AL PAGAR DESDE LA APP:", error);
    res.status(500).json({ message: "No se pudo aplicar el pago" });
  } finally {
    conn.release();
  }
});

// POST /api/app-socio/transferir  { id_cuenta_origen, id_cuenta_destino, monto }
router.post("/transferir", async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const idUsuario = req.usuario.id_usuario;
    const monto = r2(num(req.body?.monto));
    if (!(monto > 0)) return res.status(400).json({ message: "Indica el monto." });
    if (parseInt(req.body?.id_cuenta_origen) === parseInt(req.body?.id_cuenta_destino)) {
      return res.status(400).json({ message: "Elige dos cuentas distintas." });
    }
    await conn.beginTransaction();
    // Se bloquean en orden de id para que dos transferencias cruzadas no se traben
    const ids = [parseInt(req.body?.id_cuenta_origen) || 0, parseInt(req.body?.id_cuenta_destino) || 0];
    const [a, b] = [...ids].sort((x, y) => x - y);
    const ca = await cuentaPropia(conn, a, idUsuario);
    const cb = await cuentaPropia(conn, b, idUsuario);
    const origen = ca.id_cuenta === ids[0] ? ca : cb;
    const destino = origen === ca ? cb : ca;
    if (!puedeDebitar(origen)) throw new FalloPago(400, { message: `No puedes sacar dinero de la cuenta ${origen.tipo_cuenta}.` });
    if (destino.estado !== "activa") throw new FalloPago(400, { message: `La cuenta ${destino.tipo_cuenta} no está activa.` });
    if (num(origen.saldo_actual) < monto) throw new FalloPago(400, { message: `Saldo insuficiente: tienes ${dinero(origen.saldo_actual)} en ${origen.tipo_cuenta}.` });

    const salida = await debitar(conn, origen, monto, `Enviado a ${destino.tipo_cuenta} desde la app`, req.usuario);
    const antes = num(destino.saldo_actual);
    const despues = r2(antes + monto);
    await conn.query("UPDATE cuentas SET saldo_actual = ? WHERE id_cuenta = ?", [despues, destino.id_cuenta]);
    await conn.query(
      `INSERT INTO movimientos_cuenta (id_cuenta, tipo_movimiento, monto, descripcion, fecha, saldo_anterior, saldo_nuevo, referencia)
       VALUES (?, 'aporte', ?, ?, NOW(), ?, ?, 'app')`,
      [destino.id_cuenta, monto, `Recibido de ${origen.tipo_cuenta} desde la app`, antes, despues]
    );
    await conSalvaguarda(conn, { concepto: "Transferencia entre cuentas (app)", origen: "transferencia", origen_id: origen.id_cuenta }, () =>
      contabilizar(
        conn,
        "transferencia_socio",
        { monto, tipo_origen: origen.tipo_cuenta, tipo_destino: destino.tipo_cuenta },
        { concepto: `Transferencia de ${origen.tipo_cuenta} a ${destino.tipo_cuenta} (app)`, origen: "transferencia", origen_id: origen.id_cuenta, creada_por: idUsuario }
      )
    );
    await conn.query("INSERT INTO bitacora (id_usuario, accion, detalle, fecha) VALUES (?, ?, ?, NOW())", [
      idUsuario,
      "Transferencia desde la app",
      `${dinero(monto)} de ${origen.tipo_cuenta} a ${destino.tipo_cuenta}`,
    ]);
    await conn.commit();
    crearNotificacion(idUsuario, {
      titulo: "Transferencia realizada",
      mensaje: `Pasaste ${dinero(monto)} de ${origen.tipo_cuenta} a ${destino.tipo_cuenta}.`,
      tipo: "aportacion",
    });
    res.json({ success: true, message: "Transferencia realizada.", saldo_origen: salida.nuevo, saldo_destino: despues });
  } catch (error) {
    await conn.rollback().catch(() => {});
    if (error instanceof FalloPago) return res.status(error.codigo).json(error.cuerpo);
    console.error("ERROR EN TRANSFERENCIA DE LA APP:", error);
    res.status(500).json({ message: "No se pudo hacer la transferencia" });
  } finally {
    conn.release();
  }
});

// GET /api/app-socio/estado-cuenta.pdf?desde=&hasta=  (por defecto, los últimos 3 meses)
router.get("/estado-cuenta.pdf", async (req, res) => {
  try {
    const id = req.usuario.id_usuario;
    const hasta = esFecha(req.query.hasta) ? req.query.hasta : hoyISO();
    const d0 = new Date(`${hasta}T12:00:00`);
    d0.setMonth(d0.getMonth() - 3);
    const desde = esFecha(req.query.desde) ? req.query.desde : d0.toISOString().substring(0, 10);

    const [[u]] = await pool.query("SELECT numero_socio, nombre_completo, dni, direccion FROM usuarios WHERE id_usuario = ?", [id]);
    const [[sitio]] = await pool.query("SELECT valor FROM configuracion_sitio WHERE clave = 'site_name'");
    const [cuentas] = await pool.query("SELECT id_cuenta, tipo_cuenta, saldo_actual FROM cuentas WHERE id_usuario = ? AND estado = 'activa'", [id]);
    const [prestamos] = await pool.query(
      "SELECT id_prestamo, monto, saldo_restante, estado, fecha_otorgado FROM prestamos WHERE id_usuario = ? AND estado IN ('activo','mora') ORDER BY id_prestamo",
      [id]
    );
    const [movs] = await pool.query(
      `SELECT m.fecha, c.tipo_cuenta, m.tipo_movimiento, m.monto, m.descripcion
       FROM movimientos_cuenta m JOIN cuentas c ON c.id_cuenta = m.id_cuenta
       WHERE c.id_usuario = ? AND DATE(m.fecha) BETWEEN ? AND ? ORDER BY m.fecha, m.id_movimiento`,
      [id, desde, hasta]
    );
    const [pagos] = await pool.query(
      `SELECT pp.fecha_pago, pp.id_prestamo, pp.monto_pagado, pp.saldo_restante
       FROM pagos_prestamo pp JOIN prestamos p ON p.id_prestamo = pp.id_prestamo
       WHERE p.id_usuario = ? AND DATE(pp.fecha_pago) BETWEEN ? AND ? ORDER BY pp.fecha_pago`,
      [id, desde, hasta]
    );

    const doc = new PDFDocument({ size: "LETTER", margin: 50, info: { Title: "Estado de cuenta" } });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="estado_de_cuenta_${hasta}.pdf"`);
    doc.pipe(res);

    const AZUL = "#1a2035";
    const GRIS = "#64748b";
    const izq = 50;
    const ancho = doc.page.width - 100;
    const f = (v) => fechaTexto(v, { day: "2-digit", month: "2-digit", year: "numeric" });

    doc.fillColor(AZUL).font("Helvetica-Bold").fontSize(17).text(sitio?.valor || "Cooperativa", izq, 50, { width: ancho });
    doc.fontSize(12).text("ESTADO DE CUENTA");
    doc.font("Helvetica").fillColor(GRIS).fontSize(9.5)
      .text(`Del ${f(`${desde}T12:00:00`)} al ${f(`${hasta}T12:00:00`)} · Generado el ${new Date().toLocaleString(locale(), { timeZone: zona(), dateStyle: "short", timeStyle: "short" })}`);
    doc.moveDown(0.8);
    doc.fillColor("#000").fontSize(10.5)
      .text(`Socio: ${u.nombre_completo}${u.numero_socio ? ` · N.º ${u.numero_socio}` : ""}`)
      .text(`Identidad: ${u.dni}`);
    if (u.direccion) doc.text(`Dirección: ${u.direccion}`);
    doc.moveDown(0.8);

    // Tabla simple: columnas con ancho fijo; salta de página si no cabe
    const tabla = (titulo, columnas, filas) => {
      if (doc.y > doc.page.height - 140) doc.addPage();
      doc.fillColor(AZUL).font("Helvetica-Bold").fontSize(11.5).text(titulo, izq, doc.y, { width: ancho });
      doc.moveDown(0.3);
      const fila = (valores, negrita) => {
        if (doc.y > doc.page.height - 70) doc.addPage();
        const y = doc.y;
        let x = izq;
        doc.font(negrita ? "Helvetica-Bold" : "Helvetica").fontSize(9).fillColor(negrita ? "#334155" : "#000");
        let alto = 0;
        valores.forEach((v, i) => {
          const c = columnas[i];
          doc.text(String(v ?? ""), x, y, { width: c.w - 6, align: c.der ? "right" : "left" });
          alto = Math.max(alto, doc.y - y);
          x += c.w;
        });
        doc.y = y + alto + 3;
        doc.moveTo(izq, doc.y - 1).lineTo(izq + ancho, doc.y - 1).strokeColor("#e2e8f0").lineWidth(0.5).stroke();
      };
      fila(columnas.map((c) => c.t), true);
      if (!filas.length) {
        doc.font("Helvetica-Oblique").fontSize(9).fillColor(GRIS).text("Sin movimientos en el período.", izq, doc.y + 2);
        doc.moveDown(0.3);
      }
      filas.forEach((v) => fila(v));
      doc.moveDown(0.8);
    };

    tabla("Mis cuentas", [{ t: "Cuenta", w: 350 }, { t: "Saldo", w: 162, der: true }], cuentas.map((c) => [c.tipo_cuenta, dinero(c.saldo_actual)]));
    tabla(
      "Mis préstamos vigentes",
      [{ t: "Préstamo", w: 110 }, { t: "Otorgado", w: 110 }, { t: "Monto", w: 146, der: true }, { t: "Saldo", w: 146, der: true }],
      prestamos.map((p) => [`#${p.id_prestamo}${p.estado === "mora" ? " (en mora)" : ""}`, p.fecha_otorgado ? f(p.fecha_otorgado) : "", dinero(p.monto), dinero(p.saldo_restante)])
    );
    tabla(
      "Movimientos de mis cuentas",
      [{ t: "Fecha", w: 75 }, { t: "Cuenta", w: 95 }, { t: "Descripción", w: 232 }, { t: "Monto", w: 110, der: true }],
      movs.map((m) => {
        const sale = ["retiro"].includes(m.tipo_movimiento) || /enviado/i.test(m.descripcion || "");
        return [f(m.fecha), m.tipo_cuenta, m.descripcion || m.tipo_movimiento, `${sale ? "-" : ""}${dinero(m.monto)}`];
      })
    );
    tabla(
      "Pagos a mis préstamos",
      [{ t: "Fecha", w: 90 }, { t: "Préstamo", w: 110 }, { t: "Pagado", w: 156, der: true }, { t: "Saldo después del pago", w: 156, der: true }],
      pagos.map((p) => [f(p.fecha_pago), `#${p.id_prestamo}`, dinero(p.monto_pagado), dinero(p.saldo_restante)])
    );
    doc.font("Helvetica").fontSize(8).fillColor(GRIS)
      .text("Documento informativo generado desde la app del socio. Ante cualquier diferencia, comuníquese con la cooperativa.", izq, doc.y, { width: ancho });
    doc.end();
  } catch (error) {
    console.error("ERROR AL GENERAR ESTADO DE CUENTA PDF:", error);
    if (!res.headersSent) res.status(500).json({ message: "No se pudo generar el estado de cuenta" });
  }
});

module.exports = router;
