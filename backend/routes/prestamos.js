const express = require("express");
const router = express.Router();
const pool = require("../db");
const { filtroSocio, filtroCaja } = require("../utils/sucursal");
const { registrarCaja } = require("../utils/caja");
const { crearRecibo } = require("../utils/recibos");
const { actualizarEstadosMora } = require("../utils/moraScheduler");
const { notificarSocio, crearNotificacion, escaparHtml } = require("../utils/notificaciones");
const { avisarAprobacion } = require("../utils/cartaAprobacion");
const { dinero } = require("../utils/pais");
const { planDePrestamo } = require("../utils/planPagos");
const { obtenerProducto, fueraDeProducto } = require("../utils/productos");
const { faltaGarantia } = require("../utils/garantias");
const comite = require("../utils/comite");
const { habilitada } = require("../utils/funciones");
const { alDesembolsar } = require("../utils/configCredito");
const { contabilizar, conSalvaguarda } = require("../utils/contabilidad");
const {
  calcularCuotaMensual,
  generarTablaAmortizacion,
  calcularDiasMora,
  calcularInteresMoratorio,
  DIAS_MES,
  soloFecha,
  hoyISO,
  diasEntre,
  calcularInteresPeriodo,
} = require("../utils/calculosPrestamo");

// ============================================
// FUNCIONES AUXILIARES Y CÁLCULOS
// ============================================

// Registrar en bitácora
const registrarBitacora = async (id_usuario, accion, detalle) => {
  try {
    await pool.query(
      `INSERT INTO bitacora (id_usuario, accion, detalle) VALUES (?, ?, ?)`,
      [id_usuario, accion, detalle]
    );
  } catch (error) {
    console.error("Error al registrar en bitácora:", error);
  }
};

// ============================================
// OBTENER TODOS LOS PRÉSTAMOS CON FILTROS
// ============================================
router.get("/", async (req, res) => {
  try {
    const { estado = '', id_usuario = '', search = '' } = req.query;

    let whereClause = "WHERE 1=1";
    let params = [];

    if (estado) {
      whereClause += ` AND p.estado = ?`;
      params.push(estado);
    }

    if (id_usuario) {
      whereClause += ` AND p.id_usuario = ?`;
      params.push(id_usuario);
    }

    if (search) {
      whereClause += ` AND (u.nombre_completo LIKE ? OR u.dni LIKE ?)`;
      const searchParam = `%${search}%`;
      params.push(searchParam, searchParam);
    }
    // Filtros de los datos ampliados
    if (req.query.linea_credito) {
      whereClause += ` AND p.linea_credito = ?`;
      params.push(String(req.query.linea_credito));
    }
    if (req.query.tipo === "grupal") whereClause += " AND p.id_credito_grupal IS NOT NULL";
    if (req.query.tipo === "individual") whereClause += " AND p.id_credito_grupal IS NULL";
    if (parseInt(req.query.id_promotor)) {
      whereClause += ` AND p.id_promotor = ?`;
      params.push(parseInt(req.query.id_promotor));
    }

    // Sucursal que se está viendo (un socio buscado o pedido se atiende en cualquiera)
    const porSucursal = await filtroSocio(req, "u", !!(id_usuario || search));
    whereClause += porSucursal.sql;
    params.push(...porSucursal.params);

    const [prestamos] = await pool.query(
      `SELECT p.*, 
       u.nombre_completo, 
       u.dni,
       (SELECT COUNT(*) FROM pagos_prestamo WHERE id_prestamo = p.id_prestamo) as total_pagos,
       (SELECT IFNULL(SUM(monto_pagado), 0) FROM pagos_prestamo WHERE id_prestamo = p.id_prestamo) as total_pagado,
       pc.nombre AS producto_nombre,
       (SELECT pr.nombre_completo FROM usuarios pr WHERE pr.id_usuario = p.id_promotor) AS promotor_nombre,
       (SELECT g.nombre FROM creditos_grupales cg JOIN grupos g ON g.id_grupo = cg.id_grupo
          WHERE cg.id_credito_grupal = p.id_credito_grupal) AS grupo_nombre
       FROM prestamos p 
       INNER JOIN usuarios u ON p.id_usuario = u.id_usuario
       LEFT JOIN productos_credito pc ON pc.id_producto = p.id_producto
       ${whereClause}
       ORDER BY p.fecha_otorgado DESC`,
      params
    );

    // Calcular cuotas mensuales para cada préstamo
    const prestamosConCuotas = prestamos.map(p => ({
      ...p,
      cuota_mensual: parseFloat(calcularCuotaMensual(
        parseFloat(p.monto),
        parseFloat(p.tasa_interes),
        parseInt(p.plazo_meses)
      ).toFixed(2)),
    }));

    res.json({
      success: true,
      data: prestamosConCuotas,
      total: prestamos.length,
    });
  } catch (error) {
    console.error("ERROR AL OBTENER PRÉSTAMOS:", error);
    res.status(500).json({ 
      message: "Error al obtener los préstamos", 
      error: error.message 
    });
  }
});

// ============================================
// DATOS AMPLIADOS DEL CRÉDITO (función "datos_ampliados")
// ============================================
const LINEAS_BASE = ["General", "Agricultura", "Agropecuario", "Comercio", "Pecuario", "Servicio", "Industria", "Artesanal", "Vivienda", "Emprendimiento", "Sin definir"];
const lineasCredito = async () => {
  try {
    const [[f]] = await pool.query("SELECT valor FROM configuracion_sitio WHERE clave = 'lineas_credito'");
    const l = f?.valor ? JSON.parse(f.valor) : null;
    return Array.isArray(l) && l.length ? l : LINEAS_BASE;
  } catch {
    return LINEAS_BASE;
  }
};
const texto = (v, max) => {
  const t = String(v ?? "").trim();
  return t ? t.substring(0, max) : null;
};

// GET /api/prestamos/catalogos → líneas de crédito y promotores (personal activo)
router.get("/catalogos", async (req, res) => {
  try {
    const [promotores] = await pool.query(
      `SELECT u.id_usuario, u.nombre_completo FROM usuarios u JOIN roles r ON r.id_rol = u.rol_id
       WHERE u.estado = 'activo' AND r.nombre <> 'Socio' ORDER BY u.nombre_completo`
    );
    res.json({ success: true, lineas: await lineasCredito(), promotores, habilitada: await habilitada("datos_ampliados", req.usuario) });
  } catch (error) {
    console.error("ERROR AL LEER CATÁLOGOS DE CRÉDITO:", error);
    res.status(500).json({ message: "No se pudieron leer los catálogos" });
  }
});

// PUT /api/prestamos/catalogos/lineas  { lineas: [...] }  (Super Administrador)
router.put("/catalogos/lineas", async (req, res) => {
  if (req.usuario?.rol !== "Super Administrador") {
    return res.status(403).json({ message: "Solo el Super Administrador cambia las líneas de crédito." });
  }
  const lineas = [...new Set((req.body?.lineas || []).map((l) => texto(l, 50)).filter(Boolean))];
  if (!lineas.length) return res.status(400).json({ message: "Escribe al menos una línea de crédito." });
  await pool.query(
    "INSERT INTO configuracion_sitio (clave, valor) VALUES ('lineas_credito', ?) ON DUPLICATE KEY UPDATE valor = VALUES(valor)",
    [JSON.stringify(lineas)]
  );
  res.json({ success: true, lineas });
});

// Valida y arma los datos ampliados del crédito a partir del cuerpo de la petición
const datosCredito = async (b) => {
  const lineas = await lineasCredito();
  const linea = texto(b.linea_credito, 50);
  if (linea && !lineas.includes(linea)) throw Object.assign(new Error("Esa línea de crédito no existe."), { codigo: 400 });
  let promotor = null;
  if (b.id_promotor) {
    const [[p]] = await pool.query(
      `SELECT u.id_usuario FROM usuarios u JOIN roles r ON r.id_rol = u.rol_id
       WHERE u.id_usuario = ? AND u.estado = 'activo' AND r.nombre <> 'Socio'`,
      [parseInt(b.id_promotor)]
    );
    if (!p) throw Object.assign(new Error("El promotor debe ser personal activo."), { codigo: 400 });
    promotor = p.id_usuario;
  }
  return {
    linea_credito: linea,
    destino: texto(b.destino, 150),
    id_promotor: promotor,
    numero_pagare: texto(b.numero_pagare, 30),
    numero_acta: texto(b.numero_acta, 30),
    numero_cheque: texto(b.numero_cheque, 30),
    fecha_recepcion: /^\d{4}-\d{2}-\d{2}$/.test(String(b.fecha_recepcion || "")) ? b.fecha_recepcion : null,
    numero_solicitud: texto(b.numero_solicitud, 30),
  };
};

// PUT /api/prestamos/:id/datos-credito
router.put("/:id/datos-credito", async (req, res) => {
  try {
    if (!(await habilitada("datos_ampliados", req.usuario))) {
      return res.status(403).json({ message: "Esta función no está habilitada." });
    }
    const d = await datosCredito(req.body || {});
    const [r] = await pool.query(
      `UPDATE prestamos SET linea_credito = ?, destino = ?, id_promotor = ?, numero_pagare = ?, numero_acta = ?, numero_cheque = ?,
              fecha_recepcion = ?, numero_solicitud = ?
       WHERE id_prestamo = ?`,
      [d.linea_credito, d.destino, d.id_promotor, d.numero_pagare, d.numero_acta, d.numero_cheque, d.fecha_recepcion, d.numero_solicitud, parseInt(req.params.id)]
    );
    if (!r.affectedRows) return res.status(404).json({ message: "Préstamo no encontrado" });
    res.json({ success: true, message: "Datos del crédito guardados.", data: d });
  } catch (error) {
    if (error.codigo) return res.status(error.codigo).json({ message: error.message });
    console.error("ERROR AL GUARDAR DATOS DEL CRÉDITO:", error);
    res.status(500).json({ message: "No se pudieron guardar los datos del crédito" });
  }
});

// ============================================
// OBTENER UN PRÉSTAMO POR ID CON TABLA DE AMORTIZACIÓN
// ============================================
// Plan de pagos: cuotas con su vencimiento y estado (pagada, parcial, vencida, pendiente).
// Al socio le llega sin el desglose de interés y capital (lo quita ocultarInteresSocio).
router.get("/:id/plan", async (req, res) => {
  try {
    const [[p]] = await pool.query(
      `SELECT id_prestamo, id_usuario, monto, tasa_interes, plazo_meses, saldo_restante, estado, fecha_otorgado, redondeo_cuota
       FROM prestamos WHERE id_prestamo = ?`,
      [req.params.id]
    );
    if (!p) return res.status(404).json({ message: "Préstamo no encontrado" });
    const plan = planDePrestamo(p);
    res.json({
      success: true,
      id_prestamo: p.id_prestamo,
      // null: préstamo sin desembolsar o de plazo indefinido (paga solo interés cada mes)
      plan: plan ? plan.cuotas : null,
      resumen: plan ? plan.resumen : null,
      motivo: plan ? null : parseInt(p.plazo_meses) === 0 ? "indefinido" : "sin_desembolsar",
    });
  } catch (error) {
    console.error("ERROR AL OBTENER PLAN DE PAGOS:", error);
    res.status(500).json({ message: "Error al obtener el plan de pagos" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const [prestamo] = await pool.query(
      `SELECT p.*, 
       u.nombre_completo, 
       u.dni, 
       u.telefono, 
       u.correo,
       pc.nombre AS producto_nombre
       FROM prestamos p 
       INNER JOIN usuarios u ON p.id_usuario = u.id_usuario
       LEFT JOIN productos_credito pc ON pc.id_producto = p.id_producto
       WHERE p.id_prestamo = ?`,
      [req.params.id]
    );
    
    if (prestamo.length === 0) {
      return res.status(404).json({ message: "Préstamo no encontrado" });
    }

    const prestamoData = prestamo[0];

    // Calcular cuota mensual
    const cuotaMensual = calcularCuotaMensual(
      parseFloat(prestamoData.monto),
      parseFloat(prestamoData.tasa_interes),
      parseInt(prestamoData.plazo_meses)
    );

    // Generar tabla de amortización
    const tablaAmortizacion = generarTablaAmortizacion(
      parseFloat(prestamoData.monto),
      parseFloat(prestamoData.tasa_interes),
      parseInt(prestamoData.plazo_meses),
      prestamoData.fecha_otorgado
    );

    // Obtener historial de pagos
    const [pagos] = await pool.query(
      `SELECT * FROM pagos_prestamo 
       WHERE id_prestamo = ? 
       ORDER BY fecha_pago DESC`,
      [req.params.id]
    );

    res.json({
      success: true,
      prestamo: {
        ...prestamoData,
        cuota_mensual: parseFloat(cuotaMensual.toFixed(2)),
      },
      tabla_amortizacion: tablaAmortizacion,
      historial_pagos: pagos,
    });
  } catch (error) {
    console.error("ERROR AL OBTENER PRÉSTAMO:", error);
    res.status(500).json({ 
      message: "Error al obtener el préstamo", 
      error: error.message 
    });
  }
});

// ============================================
// OBTENER PRÉSTAMOS POR USUARIO
// ============================================
router.get("/usuario/:id_usuario", async (req, res) => {
  try {
    const [prestamos] = await pool.query(
      `SELECT p.*,
       (SELECT COUNT(*) FROM pagos_prestamo WHERE id_prestamo = p.id_prestamo) as total_pagos,
       (SELECT IFNULL(SUM(monto_pagado), 0) FROM pagos_prestamo WHERE id_prestamo = p.id_prestamo) as total_pagado,
       pc.nombre AS producto_nombre
       FROM prestamos p
       LEFT JOIN productos_credito pc ON pc.id_producto = p.id_producto
       WHERE p.id_usuario = ?
       ORDER BY p.fecha_otorgado DESC`,
      [req.params.id_usuario]
    );

    // Agregar cuota mensual a cada préstamo
    const prestamosConCuotas = prestamos.map(p => ({
      ...p,
      cuota_mensual: parseFloat(calcularCuotaMensual(
        parseFloat(p.monto),
        parseFloat(p.tasa_interes),
        parseInt(p.plazo_meses)
      ).toFixed(2)),
    }));

    // Calcular estadísticas
    const totales = {
      total_prestamos: prestamos.length,
      prestamos_activos: prestamos.filter(p => p.estado === 'activo').length,
      prestamos_en_mora: prestamos.filter(p => p.estado === 'mora').length,
      monto_total_prestado: prestamos.reduce((sum, p) => sum + parseFloat(p.monto), 0),
      saldo_total_pendiente: prestamos.reduce((sum, p) => sum + parseFloat(p.saldo_restante), 0),
    };

    res.json({
      success: true,
      data: prestamosConCuotas,
      estadisticas: totales,
    });
  } catch (error) {
    console.error("ERROR AL OBTENER PRÉSTAMOS DEL USUARIO:", error);
    res.status(500).json({ 
      message: "Error al obtener préstamos del usuario", 
      error: error.message 
    });
  }
});

// ============================================
// SOLICITAR UN NUEVO PRÉSTAMO
// ============================================
router.post("/solicitar", async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const { id_usuario, monto, tasa_interes, plazo_meses, descripcion } = req.body;

    // Validaciones
    if (!id_usuario || !monto || !tasa_interes || !plazo_meses) {
      return res.status(400).json({ 
        message: "Usuario, monto, tasa de interés y plazo son requeridos." 
      });
    }

    const montoNum = parseFloat(monto);
    const tasaNum = parseFloat(tasa_interes);
    const plazoNum = parseInt(plazo_meses);

    if (isNaN(montoNum) || montoNum <= 0) {
      return res.status(400).json({ message: "El monto debe ser positivo" });
    }

    if (isNaN(tasaNum) || tasaNum < 0 || tasaNum > 1000) {
      return res.status(400).json({ message: "La tasa de interés debe ser un valor positivo" });
    }

    if (isNaN(plazoNum) || plazoNum <= 0 || plazoNum > 360) {
      return res.status(400).json({ message: "El plazo debe ser entre 1 y 360 meses" });
    }

    // Verificar que el usuario existe y está activo
    const [usuario] = await connection.query(
      `SELECT * FROM usuarios WHERE id_usuario = ? AND estado = 'activo'`,
      [id_usuario]
    );

    if (usuario.length === 0) {
      return res.status(404).json({ message: "Usuario no encontrado o inactivo" });
    }

    // Verificar si tiene préstamos en mora
    const [prestamosEnMora] = await connection.query(
      `SELECT COUNT(*) as total FROM prestamos 
       WHERE id_usuario = ? AND estado = 'mora'`,
      [id_usuario]
    );

    if (prestamosEnMora[0].total > 0) {
      return res.status(400).json({ 
        message: "El socio tiene préstamos en mora. No puede solicitar un nuevo préstamo." 
      });
    }

    // Calcular cuota mensual
    const cuotaMensual = calcularCuotaMensual(montoNum, tasaNum, plazoNum);

    await connection.beginTransaction();

    // Crear el préstamo con estado "pendiente"
    const [result] = await connection.query(
      `INSERT INTO prestamos (id_usuario, monto, tasa_interes, plazo_meses, saldo_restante, estado, fecha_otorgado) 
       VALUES (?, ?, ?, ?, ?, 'pendiente', NOW())`,
      [id_usuario, montoNum, tasaNum, plazoNum, montoNum]
    );

    const nuevoPrestamoId = result.insertId;

    // Registrar en bitácora
    await connection.query(
      `INSERT INTO bitacora (id_usuario, accion, detalle, fecha) 
       VALUES (?, ?, ?, NOW())`,
      [
        id_usuario,
        "Solicitud de préstamo",
        `Solicitud de préstamo por ${dinero(montoNum)} a ${plazoNum} meses. Cuota mensual: ${dinero(cuotaMensual)}`
      ]
    );

    await connection.commit();

    res.status(201).json({
      success: true,
      message: "Préstamo solicitado correctamente. Pendiente de aprobación.",
      id_prestamo: nuevoPrestamoId,
      cuota_mensual: parseFloat(cuotaMensual.toFixed(2)),
    });

  } catch (error) {
    await connection.rollback();
    console.error("ERROR AL SOLICITAR PRÉSTAMO:", error);
    res.status(500).json({ 
      message: "Error al solicitar el préstamo", 
      error: error.message 
    });
  } finally {
    connection.release();
  }
});

// ============================================
// FLUJO DE APROBACIÓN: pendiente → aprobado → (desembolso) → activo
// ============================================

// Aprobar una solicitud pendiente (todavía no sale dinero)
router.patch("/:id/aprobar", async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query(
      `SELECT * FROM prestamos WHERE id_prestamo = ? FOR UPDATE`,
      [req.params.id]
    );
    if (!rows.length) {
      await connection.rollback();
      return res.status(404).json({ message: "Préstamo no encontrado" });
    }
    const p = rows[0];
    if (p.estado !== "pendiente") {
      await connection.rollback();
      return res.status(400).json({
        message: `Solo se puede aprobar una solicitud pendiente (estado actual: ${p.estado}).`,
      });
    }

    // Por encima del límite del personal decide el comité de crédito: esta aprobación es un voto
    if (comite.requiere(p.monto)) {
      const r = await comite.votar(connection, p, req.usuario.id_usuario, "aprobar", req.body?.comentario);
      if (!r.aprobado) {
        await connection.commit();
        return res.status(202).json({
          success: true,
          en_comite: true,
          comite: { a_favor: r.a_favor, en_contra: r.en_contra, requeridos: r.requeridos },
          message: `Voto registrado. El comité lleva ${r.a_favor} de ${r.requeridos} votos a favor.`,
        });
      }
    }

    await connection.query(
      `UPDATE prestamos SET estado = 'aprobado', aprobado_por = ?, fecha_aprobacion = NOW() WHERE id_prestamo = ?`,
      [req.usuario?.id_usuario || null, req.params.id]
    );
    await connection.query(
      `INSERT INTO bitacora (id_usuario, accion, detalle, fecha) VALUES (?, ?, ?, NOW())`,
      [p.id_usuario, "Préstamo aprobado", `Préstamo #${req.params.id} por ${dinero(parseFloat(p.monto))} aprobado. Pendiente de desembolso.`]
    );
    await connection.commit();
    const avisoCarta = await avisarAprobacion(p.id_prestamo, p.id_usuario);
    res.json({ success: true, message: `Préstamo aprobado. Falta registrar el desembolso.${avisoCarta}` });
  } catch (error) {
    await connection.rollback().catch(() => {});
    if (error.codigo) return res.status(error.codigo).json({ message: error.message });
    console.error("ERROR AL APROBAR PRÉSTAMO:", error);
    res.status(500).json({ message: "Error al aprobar el préstamo" });
  } finally {
    connection.release();
  }
});

// Desembolsar un préstamo aprobado: sale el dinero, empieza el plazo y se emite el comprobante
router.post("/:id/desembolsar", async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const metodosValidos = ["efectivo", "transferencia", "cheque", "cuenta"];
    const metodo = metodosValidos.includes(String(req.body.metodo || "").toLowerCase())
      ? String(req.body.metodo).toLowerCase()
      : "efectivo";
    const referencia = String(req.body.referencia || "").trim().substring(0, 100);

    await connection.beginTransaction();
    const [rows] = await connection.query(
      `SELECT p.*, u.nombre_completo FROM prestamos p
       INNER JOIN usuarios u ON p.id_usuario = u.id_usuario
       WHERE p.id_prestamo = ? FOR UPDATE OF p`,
      [req.params.id]
    );
    if (!rows.length) {
      await connection.rollback();
      return res.status(404).json({ message: "Préstamo no encontrado" });
    }
    const p = rows[0];
    if (p.estado !== "aprobado") {
      await connection.rollback();
      return res.status(400).json({
        message: p.estado === "pendiente"
          ? "El préstamo debe aprobarse antes de desembolsarse."
          : `Este préstamo no se puede desembolsar (estado actual: ${p.estado}).`,
      });
    }

    // La garantía que exige el producto debe estar registrada antes de entregar el dinero
    const falta = await faltaGarantia(connection, p);
    if (falta) {
      await connection.rollback();
      return res.status(400).json({ message: falta });
    }

    const monto = parseFloat(p.monto);
    let detalleCuenta = null;

    if (metodo === "cuenta") {
      const [cuenta] = await connection.query(
        `SELECT * FROM cuentas WHERE id_usuario = ? AND tipo_cuenta = 'Aportaciones' AND estado = 'activa' LIMIT 1 FOR UPDATE`,
        [p.id_usuario]
      );
      if (!cuenta.length) {
        await connection.rollback();
        return res.status(400).json({ message: "El socio no tiene una cuenta de Aportaciones activa para recibir el desembolso." });
      }
      const nuevoSaldo = parseFloat(cuenta[0].saldo_actual) + monto;
      await connection.query(`UPDATE cuentas SET saldo_actual = ? WHERE id_cuenta = ?`, [nuevoSaldo, cuenta[0].id_cuenta]);
      await connection.query(
        `INSERT INTO movimientos_cuenta (id_cuenta, tipo_movimiento, monto, descripcion, saldo_anterior, saldo_nuevo, fecha)
         VALUES (?, 'aporte', ?, ?, ?, ?, NOW())`,
        [cuenta[0].id_cuenta, monto, `Desembolso de préstamo #${req.params.id}`, cuenta[0].saldo_actual, nuevoSaldo]
      );
      detalleCuenta = `cuenta ${cuenta[0].tipo_cuenta} #${cuenta[0].id_cuenta}`;
      // No pasa por caja: la partida va de la cartera a la cuenta del socio
      await conSalvaguarda(connection, { concepto: `Desembolso del préstamo #${req.params.id}`, origen: "prestamo", origen_id: parseInt(req.params.id) }, () =>
        contabilizar(connection, "desembolso_prestamo", { monto, metodo: "cuenta", tipo_cuenta: cuenta[0].tipo_cuenta }, {
          concepto: `Desembolso del préstamo #${req.params.id} a la ${detalleCuenta}`,
          origen: "prestamo",
          origen_id: parseInt(req.params.id),
          creada_por: req.usuario?.id_usuario,
        })
      );
    }

    await connection.query(
      `UPDATE prestamos SET estado = 'activo', fecha_otorgado = NOW(), saldo_restante = monto WHERE id_prestamo = ?`,
      [req.params.id]
    );
    // Copia la configuración de su producto (mora, gracia, cargos, redondeo) y le da su código
    await alDesembolsar(connection, req.params.id);

    // El efectivo o la transferencia sale de caja; el depósito a cuenta no mueve caja
    if (metodo !== "cuenta") {
      await registrarCaja(connection, {
        tipo: "egreso",
        categoria: "desembolso_prestamo",
        monto,
        metodo,
        descripcion: `Desembolso de préstamo #${req.params.id}${referencia ? ` (ref. ${referencia})` : ""}`,
        referencia_tipo: "prestamo",
        referencia_id: parseInt(req.params.id),
        id_socio: p.id_usuario,
        id_registrado_por: req.usuario?.id_usuario,
      });
    }

    const idRecibo = await crearRecibo(connection, {
      tipo: "desembolso",
      referencia_tipo: "prestamo",
      referencia_id: parseInt(req.params.id),
      id_socio: p.id_usuario,
      monto,
      metodo,
      concepto: `Desembolso de préstamo #${req.params.id}`,
      detalle: {
        id_prestamo: parseInt(req.params.id),
        plazo_meses: p.plazo_meses,
        referencia: referencia || null,
        destino: detalleCuenta,
      },
      emitido_por: req.usuario?.id_usuario,
    });

    await connection.query(
      `INSERT INTO bitacora (id_usuario, accion, detalle, fecha) VALUES (?, ?, ?, NOW())`,
      [p.id_usuario, "Desembolso de préstamo", `Préstamo #${req.params.id} desembolsado por ${dinero(monto)} (${metodo}${detalleCuenta ? ", " + detalleCuenta : ""})`]
    );

    await connection.commit();
    crearNotificacion(p.id_usuario, {
      titulo: `Préstamo #${req.params.id} desembolsado`,
      mensaje: `Te entregamos ${dinero(monto)} de tu préstamo. Puedes ver el comprobante de entrega.`,
      tipo: "prestamo",
      idRecibo,
    });
    res.json({
      success: true,
      message: "Préstamo desembolsado correctamente.",
      id_recibo: idRecibo,
    });
  } catch (error) {
    await connection.rollback().catch(() => {});
    console.error("ERROR AL DESEMBOLSAR PRÉSTAMO:", error);
    res.status(500).json({ message: "Error al desembolsar el préstamo" });
  } finally {
    connection.release();
  }
});

// Rechazar una solicitud (queda archivada con su motivo; no se borra)
router.patch("/:id/rechazar", async (req, res) => {
  try {
    const motivo = String(req.body.motivo || "").trim();
    if (motivo.length < 3) {
      return res.status(400).json({ message: "Indica el motivo del rechazo (mínimo 3 caracteres)." });
    }

    const [rows] = await pool.query(`SELECT * FROM prestamos WHERE id_prestamo = ?`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ message: "Préstamo no encontrado" });
    const p = rows[0];
    if (!["pendiente", "aprobado"].includes(p.estado)) {
      return res.status(400).json({ message: "Solo se pueden rechazar solicitudes pendientes o aprobadas sin desembolsar." });
    }

    await pool.query(
      `UPDATE prestamos SET estado = 'rechazado', motivo_rechazo = ? WHERE id_prestamo = ?`,
      [motivo.substring(0, 255), req.params.id]
    );
    await registrarBitacora(p.id_usuario, "Préstamo rechazado", `Préstamo #${req.params.id} rechazado. Motivo: ${motivo}`);
    notificarSocio(
      p.id_usuario,
      "Respuesta a tu solicitud de préstamo",
      `<p>Lamentamos informarte que tu solicitud de préstamo por ${dinero(parseFloat(p.monto))} no fue aprobada.</p>
       <p><strong>Motivo:</strong> ${escaparHtml(motivo)}</p>
       <p>Si tienes dudas, comunícate con la cooperativa.</p>`
    );

    res.json({ success: true, message: "Solicitud rechazada" });
  } catch (error) {
    console.error("ERROR AL RECHAZAR PRÉSTAMO:", error);
    res.status(500).json({ message: "Error al rechazar el préstamo" });
  }
});

// ============================================
// ACTUALIZAR ESTADO DE PRÉSTAMO (mora/activo/pagado)
// ============================================
router.patch("/:id/estado", async (req, res) => {
  try {
    const { estado } = req.body;

    const estadosValidos = ['pendiente', 'aprobado', 'activo', 'pagado', 'mora', 'rechazado'];
    if (!estado || !estadosValidos.includes(estado)) {
      return res.status(400).json({
        message: "Estado inválido. Debe ser: pendiente, aprobado, activo, pagado, mora o rechazado"
      });
    }

    const [prestamo] = await pool.query(
      `SELECT * FROM prestamos WHERE id_prestamo = ?`,
      [req.params.id]
    );

    if (prestamo.length === 0) {
      return res.status(404).json({ message: "Préstamo no encontrado" });
    }

    if (comite.bloqueaCambioDirecto(req.usuario, prestamo[0].monto, prestamo[0].estado, estado)) {
      return res.status(409).json({ message: `${comite.mensajeBloqueo()} Usa "Aprobar" para votar.` });
    }

    // Solo se marca como pagado un préstamo sin saldo (el saldo se salda registrando el pago)
    if (estado === 'pagado' && parseFloat(prestamo[0].saldo_restante) > 0.01) {
      return res.status(409).json({
        message: `El préstamo aún tiene saldo (${dinero(parseFloat(prestamo[0].saldo_restante))}). Regístralo como pago de liquidación.`,
      });
    }

    if (estado === 'pagado') {
      await pool.query(
        `UPDATE prestamos SET estado = 'pagado', saldo_restante = 0.00 WHERE id_prestamo = ?`,
        [req.params.id]
      );
    } else {
      await pool.query(
        `UPDATE prestamos SET estado = ? WHERE id_prestamo = ?`,
        [estado, req.params.id]
      );
    }

    // Registrar en bitácora
    await registrarBitacora(
      prestamo[0].id_usuario,
      "Cambio de estado de préstamo",
      `Préstamo #${req.params.id} cambió de estado a: ${estado}${
        estado === 'pagado' ? ' — saldo_restante puesto en 0 manualmente' : ''
      }`
    );

    res.json({
      success: true,
      message: `Estado del préstamo actualizado a: ${estado}`,
    });

  } catch (error) {
    console.error("ERROR AL ACTUALIZAR ESTADO:", error);
    res.status(500).json({ 
      message: "Error al actualizar el estado", 
      error: error.message 
    });
  }
});

// ============================================
// CANCELAR/LIQUIDAR PRÉSTAMO COMPLETAMENTE
// ============================================
// COTIZAR LIQUIDACIÓN TOTAL (saldo + interés, mínimo un mes completo)
// ============================================
const cotizarLiquidacion = async (conn, idPrestamo) => {
  const [prestamo] = await conn.query(`SELECT * FROM prestamos WHERE id_prestamo = ?`, [idPrestamo]);
  if (prestamo.length === 0) return { error: 404, message: "Préstamo no encontrado" };
  const p = prestamo[0];
  if (p.estado === "pagado") return { error: 400, message: "El préstamo ya está pagado" };
  if (p.estado === "pendiente") return { error: 400, message: "El préstamo aún no ha sido aprobado" };

  const [ultimo] = await conn.query(
    `SELECT fecha_pago FROM pagos_prestamo WHERE id_prestamo = ? ORDER BY fecha_pago DESC LIMIT 1`,
    [idPrestamo]
  );
  const hoy = hoyISO();
  const fechaBase = soloFecha(ultimo.length > 0 ? ultimo[0].fecha_pago : p.fecha_otorgado) || hoy;
  const dias = Math.max(DIAS_MES, diasEntre(fechaBase, hoy));
  const saldo = parseFloat(p.saldo_restante);
  const interes = calcularInteresPeriodo(saldo, p.tasa_interes, dias);
  const diasMora = calcularDiasMora(p.fecha_otorgado, ultimo.length > 0 ? ultimo[0].fecha_pago : null, p.mora_dias_gracia);
  const mora = parseFloat(calcularInteresMoratorio(saldo, diasMora, p.mora_tasa_anual).toFixed(2));
  return {
    prestamo: p,
    saldo,
    interes,
    mora,
    dias_mora: diasMora,
    dias,
    fecha_base: fechaBase,
    total: parseFloat((saldo + interes + mora).toFixed(2)),
  };
};

router.get("/:id/cotizar-liquidacion", async (req, res) => {
  try {
    const c = await cotizarLiquidacion(pool, req.params.id);
    if (c.error) return res.status(c.error).json({ message: c.message });
    res.json({
      success: true,
      data: {
        saldo_capital: c.saldo,
        interes: c.interes,
        mora: c.mora,
        dias_mora: c.dias_mora,
        dias: c.dias,
        desde: c.fecha_base,
        total_a_pagar: c.total,
      },
    });
  } catch (error) {
    console.error("ERROR AL COTIZAR LIQUIDACIÓN:", error);
    res.status(500).json({ message: "Error al cotizar la liquidación", error: error.message });
  }
});

// ============================================
// LIQUIDAR UN PRÉSTAMO COMPLETAMENTE (cobra saldo + interés devengado)
// ============================================
router.post("/:id/liquidar", async (req, res) => {
  const connection = await pool.getConnection();

  try {
    const c = await cotizarLiquidacion(connection, req.params.id);
    if (c.error) return res.status(c.error).json({ message: c.message });

    await connection.beginTransaction();

    // Registrar el pago final con su desglose capital / interés
    await connection.query(
      `INSERT INTO pagos_prestamo (id_prestamo, monto_pagado, monto_capital, monto_interes, saldo_restante, metodo_pago, fecha_pago)
       VALUES (?, ?, ?, ?, 0.00, 'Liquidación total', NOW())`,
      [req.params.id, c.total, c.saldo, c.interes]
    );

    await connection.query(
      `UPDATE prestamos SET saldo_restante = 0.00, estado = 'pagado' WHERE id_prestamo = ?`,
      [req.params.id]
    );

    await connection.query(
      `INSERT INTO bitacora (id_usuario, accion, detalle, fecha)
       VALUES (?, ?, ?, NOW())`,
      [
        c.prestamo.id_usuario,
        "Liquidación de préstamo",
        `Préstamo #${req.params.id} liquidado. Capital: ${dinero(c.saldo)}, interés (${c.dias} días): ${dinero(c.interes)}, mora (${c.dias_mora} días): ${dinero(c.mora)}, total: ${dinero(c.total)}`,
      ]
    );

    await connection.commit();

    res.json({
      success: true,
      message: "Préstamo liquidado completamente",
      monto_liquidado: c.total,
      saldo_capital: c.saldo,
      interes: c.interes,
      mora: c.mora,
    });
  } catch (error) {
    await connection.rollback();
    console.error("ERROR AL LIQUIDAR PRÉSTAMO:", error);
    res.status(500).json({
      message: "Error al liquidar el préstamo",
      error: error.message,
    });
  } finally {
    connection.release();
  }
});

// ============================================
// VERIFICAR Y ACTUALIZAR PRÉSTAMOS EN MORA
// ============================================
router.post("/verificar-mora", async (req, res) => {
  try {
    const r = await actualizarEstadosMora();
    res.json({
      success: true,
      message: "Verificación de mora completada",
      prestamos_en_mora: r.entraron.length,
      regularizados: r.salieron.length,
      detalle: r.entraron,
    });
  } catch (error) {
    console.error("ERROR AL VERIFICAR MORA:", error);
    res.status(500).json({ message: "Error al verificar mora" });
  }
});

// ============================================
// ESTADÍSTICAS GENERALES DE PRÉSTAMOS
// ============================================
router.get("/estadisticas/general", async (req, res) => {
  try {
    // Totales generales
    const [totales] = await pool.query(`
      SELECT 
      COUNT(*) as total_prestamos,
      IFNULL(SUM(monto), 0) as monto_total_prestado,
      IFNULL(SUM(saldo_restante), 0) as saldo_total_pendiente,
      IFNULL(AVG(tasa_interes), 0) as tasa_promedio,
      COUNT(DISTINCT id_usuario) as total_prestatarios
      FROM prestamos
    `);

    // Por estado
    const [porEstado] = await pool.query(`
      SELECT 
      estado,
      COUNT(*) as cantidad,
      IFNULL(SUM(saldo_restante), 0) as saldo_pendiente
      FROM prestamos
      GROUP BY estado
    `);

    // Préstamos del mes actual
    const [esteMes] = await pool.query(`
      SELECT 
      COUNT(*) as total,
      IFNULL(SUM(monto), 0) as monto_total
      FROM prestamos
      WHERE MONTH(fecha_otorgado) = MONTH(CURRENT_DATE())
      AND YEAR(fecha_otorgado) = YEAR(CURRENT_DATE())
    `);

    // Top socios con más préstamos
    const [topSocios] = await pool.query(`
      SELECT 
      u.id_usuario,
      u.nombre_completo,
      u.dni,
      COUNT(p.id_prestamo) as total_prestamos,
      IFNULL(SUM(p.monto), 0) as monto_total,
      IFNULL(SUM(p.saldo_restante), 0) as saldo_pendiente
      FROM prestamos p
      INNER JOIN usuarios u ON p.id_usuario = u.id_usuario
      WHERE p.estado IN ('activo', 'mora')
      GROUP BY u.id_usuario
      ORDER BY monto_total DESC
      LIMIT 5
    `);

    res.json({
      success: true,
      estadisticas: {
        totales: totales[0],
        por_estado: porEstado,
        este_mes: esteMes[0],
        top_socios: topSocios,
      },
    });

  } catch (error) {
    console.error("ERROR AL OBTENER ESTADÍSTICAS:", error);
    res.status(500).json({ 
      message: "Error al obtener estadísticas", 
      error: error.message 
    });
  }
});

// ============================================
// POST / → alias de /solicitar (compatibilidad frontend)
// ============================================
router.post("/", async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { id_usuario, monto, tasa_interes, plazo_meses, descripcion, estado, fecha_otorgado, tipo_tasa, tasa_original, id_producto } = req.body;

    if (!id_usuario || !monto || !tasa_interes || !plazo_meses) {
      return res.status(400).json({ message: "Usuario, monto, tasa de interés y plazo son requeridos." });
    }

    const montoNum = parseFloat(monto);
    const tasaNum = parseFloat(tasa_interes);
    const plazoNum = parseInt(plazo_meses);

    if (isNaN(montoNum) || montoNum <= 0)
      return res.status(400).json({ message: "El monto debe ser positivo" });
    if (isNaN(tasaNum) || tasaNum < 0 || tasaNum > 1000)
      return res.status(400).json({ message: "La tasa de interés debe ser un valor positivo" });
    if (isNaN(plazoNum) || plazoNum < 0 || plazoNum > 360)
      return res.status(400).json({ message: "El plazo debe ser entre 1 y 360 meses (0 = préstamo indefinido, solo intereses)" });

    const [usuario] = await connection.query(
      `SELECT * FROM usuarios WHERE id_usuario = ? AND estado = 'activo'`,
      [id_usuario]
    );
    if (usuario.length === 0)
      return res.status(404).json({ message: "Usuario no encontrado o inactivo" });

    // Producto de crédito (opcional): el monto y el plazo deben caber en sus condiciones.
    // La tasa la pone quien otorga (la del producto es la referencial).
    let producto = null;
    if (id_producto) {
      producto = await obtenerProducto(parseInt(id_producto), connection);
      if (!producto || !producto.activo) return res.status(400).json({ message: "Ese producto de crédito no está activo." });
      const fuera = fueraDeProducto(producto, montoNum, plazoNum);
      if (fuera) {
        return res.status(400).json({
          message: fuera.campo === "monto"
            ? `Para ${producto.nombre}, el monto va de ${dinero(fuera.min)} a ${dinero(fuera.max)}.`
            : `Para ${producto.nombre}, el plazo va de ${fuera.min} a ${fuera.max} meses.`,
        });
      }
    }

    const cuotaMensual = calcularCuotaMensual(montoNum, tasaNum, plazoNum);
    const estadosPermitidos = ['pendiente', 'aprobado', 'activo', 'mora', 'pagado', 'rechazado'];
    const estadoPrestamo = (estado && estadosPermitidos.includes(estado)) ? estado : 'pendiente';
    if (comite.bloqueaCambioDirecto(req.usuario, montoNum, null, estadoPrestamo)) {
      return res.status(409).json({ message: `${comite.mensajeBloqueo()} Regístralo como pendiente.` });
    }
    // Datos ampliados del crédito (si la función está habilitada para quien registra)
    let ampliados = null;
    if (await habilitada("datos_ampliados", req.usuario)) {
      try {
        ampliados = await datosCredito(req.body);
      } catch (e) {
        return res.status(e.codigo || 400).json({ message: e.message });
      }
    }
    const fechaOtorgado = fecha_otorgado || null;
    const tipoTasaGuardar = tipo_tasa || "nominal_anual";
    const tasaOriginalGuardar = tasa_original != null ? parseFloat(tasa_original) : tasaNum;

    await connection.beginTransaction();

    const [result] = await connection.query(
      `INSERT INTO prestamos (id_usuario, monto, tasa_interes, tipo_tasa, tasa_original, plazo_meses, saldo_restante, estado, fecha_otorgado, id_producto)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id_usuario, montoNum, tasaNum, tipoTasaGuardar, tasaOriginalGuardar, plazoNum, montoNum, estadoPrestamo, fechaOtorgado, producto?.id_producto || null]
    );
    if (ampliados && Object.values(ampliados).some((v) => v != null)) {
      await connection.query(
        `UPDATE prestamos SET linea_credito = ?, destino = ?, id_promotor = ?, numero_pagare = ?, numero_acta = ?, numero_cheque = ?,
                fecha_recepcion = ?, numero_solicitud = ?
         WHERE id_prestamo = ?`,
        [ampliados.linea_credito, ampliados.destino, ampliados.id_promotor, ampliados.numero_pagare, ampliados.numero_acta, ampliados.numero_cheque, ampliados.fecha_recepcion, ampliados.numero_solicitud, result.insertId]
      );
    }

    if (["activo", "mora", "pagado"].includes(estadoPrestamo)) {
      await registrarCaja(connection, {
        tipo: "egreso",
        categoria: "desembolso_prestamo",
        monto: montoNum,
        metodo: "efectivo",
        descripcion: `Desembolso de préstamo #${result.insertId}`,
        referencia_tipo: "prestamo",
        referencia_id: result.insertId,
        id_socio: id_usuario,
        id_registrado_por: req.usuario?.id_usuario,
        fecha: fechaOtorgado ? (String(fechaOtorgado).length === 10 ? `${fechaOtorgado} 12:00:00` : fechaOtorgado) : null,
      });
    }

    await connection.query(
      `INSERT INTO bitacora (id_usuario, accion, detalle, fecha) VALUES (?, ?, ?, NOW())`,
      [id_usuario, "Registro de préstamo", `Préstamo por ${dinero(montoNum)} a ${plazoNum} meses. Cuota: ${dinero(cuotaMensual)}`]
    );

    await connection.commit();

    res.status(201).json({
      success: true,
      message: "Préstamo registrado correctamente.",
      id_prestamo: result.insertId,
      cuota_mensual: parseFloat(cuotaMensual.toFixed(2)),
    });
  } catch (error) {
    await connection.rollback();
    console.error("ERROR AL REGISTRAR PRÉSTAMO:", error);
    res.status(500).json({ message: "Error al registrar el préstamo", error: error.message });
  } finally {
    connection.release();
  }
});

// ============================================
// PUT /:id → actualizar datos de un préstamo
// ============================================
router.put("/:id", async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { id } = req.params;
    const { monto, tasa_interes, plazo_meses, fecha_otorgado, estado, tipo_tasa, tasa_original } = req.body;

    await connection.beginTransaction();

    const [existing] = await connection.query(
      `SELECT * FROM prestamos WHERE id_prestamo = ? FOR UPDATE`,
      [id]
    );
    if (existing.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: "Préstamo no encontrado" });
    }
    const actual = existing[0];

    if (actual.estado === "consolidado") {
      await connection.rollback();
      return res.status(409).json({ message: "Este préstamo fue consolidado en otro y ya no se puede editar." });
    }

    const [[{ cantidad_pagos }]] = await connection.query(
      `SELECT COUNT(*) AS cantidad_pagos FROM pagos_prestamo WHERE id_prestamo = ?`,
      [id]
    );
    const tienePagos = cantidad_pagos > 0;

    const montoNum = parseFloat(monto) || parseFloat(actual.monto);
    const tasaNum = parseFloat(tasa_interes) || parseFloat(actual.tasa_interes);
    // Usar !== undefined/null/'' para no pisar el valor 0 (indefinido)
    const plazoNum = (plazo_meses !== undefined && plazo_meses !== null && plazo_meses !== '')
      ? parseInt(plazo_meses)
      : actual.plazo_meses;

    if (isNaN(plazoNum) || plazoNum < 0 || plazoNum > 360) {
      await connection.rollback();
      return res.status(400).json({ message: "El plazo debe ser entre 1 y 360 meses (0 = indefinido)" });
    }

    // Con pagos registrados el capital otorgado no se puede cambiar: descuadraría el saldo
    if (tienePagos && Math.abs(montoNum - parseFloat(actual.monto)) >= 0.01) {
      await connection.rollback();
      return res.status(409).json({
        message: "Este préstamo ya tiene pagos registrados: no se puede cambiar el monto otorgado.",
      });
    }

    const estadosPermitidosPut = ['pendiente', 'aprobado', 'activo', 'mora', 'pagado', 'rechazado'];
    const nuevoEstado = (estado && estadosPermitidosPut.includes(estado))
      ? estado
      : actual.estado;
    if (comite.bloqueaCambioDirecto(req.usuario, montoNum, actual.estado, nuevoEstado)) {
      await connection.rollback();
      return res.status(409).json({ message: `${comite.mensajeBloqueo()} Usa "Aprobar" para votar.` });
    }

    // Un préstamo solo pasa a "pagado" cuando su saldo ya es cero (se salda registrando el pago)
    const saldoActual = parseFloat(actual.saldo_restante);
    if (nuevoEstado === 'pagado' && actual.estado !== 'pagado' && saldoActual > 0.01) {
      await connection.rollback();
      return res.status(409).json({
        message: `El préstamo aún tiene saldo (${dinero(saldoActual)}). Regístralo como pago de liquidación en Pagos.`,
      });
    }

    const nuevaFecha = fecha_otorgado || actual.fecha_otorgado;
    const tipoTasaGuardar = tipo_tasa || actual.tipo_tasa || "nominal_anual";
    const tasaOriginalGuardar = tasa_original != null ? parseFloat(tasa_original) : (actual.tasa_original || tasaNum);

    // Sin pagos, el saldo acompaña al monto; con pagos, el saldo se conserva
    const nuevoSaldo = tienePagos ? saldoActual : montoNum;

    await connection.query(
      `UPDATE prestamos SET monto = ?, tasa_interes = ?, tipo_tasa = ?, tasa_original = ?, plazo_meses = ?, saldo_restante = ?, estado = ?, fecha_otorgado = ? WHERE id_prestamo = ?`,
      [montoNum, tasaNum, tipoTasaGuardar, tasaOriginalGuardar, plazoNum, nuevoSaldo, nuevoEstado, nuevaFecha, id]
    );

    // Pasar de pendiente a vigente es el desembolso: sale dinero de caja
    if (actual.estado === 'pendiente' && ['activo', 'mora', 'pagado'].includes(nuevoEstado)) {
      await registrarCaja(connection, {
        tipo: "egreso",
        categoria: "desembolso_prestamo",
        monto: montoNum,
        metodo: "efectivo",
        descripcion: `Desembolso de préstamo #${id}`,
        referencia_tipo: "prestamo",
        referencia_id: parseInt(id),
        id_socio: actual.id_usuario,
        id_registrado_por: req.usuario?.id_usuario,
        fecha: fecha_otorgado ? (String(fecha_otorgado).length === 10 ? `${fecha_otorgado} 12:00:00` : fecha_otorgado) : null,
      });
    }

    // Bitácora de los cambios relevantes
    const cambios = [];
    if (Math.abs(montoNum - parseFloat(actual.monto)) >= 0.01) cambios.push(`monto ${dinero(parseFloat(actual.monto))} → ${dinero(montoNum)}`);
    if (Math.abs(tasaNum - parseFloat(actual.tasa_interes)) >= 0.0001) cambios.push(`tasa anual ${parseFloat(actual.tasa_interes)}% → ${tasaNum}%`);
    if (plazoNum !== actual.plazo_meses) cambios.push(`plazo ${actual.plazo_meses} → ${plazoNum} meses`);
    if (nuevoEstado !== actual.estado) cambios.push(`estado ${actual.estado} → ${nuevoEstado}`);
    if (cambios.length > 0) {
      await connection.query(
        `INSERT INTO bitacora (id_usuario, accion, detalle, fecha) VALUES (?, ?, ?, NOW())`,
        [actual.id_usuario, "Modificación de préstamo", `Préstamo #${id}: ${cambios.join("; ")}`]
      );
    }

    await connection.commit();
    res.json({ success: true, message: "Préstamo actualizado correctamente." });
  } catch (error) {
    await connection.rollback().catch(() => {});
    console.error("ERROR AL ACTUALIZAR PRÉSTAMO:", error);
    res.status(500).json({ message: "Error al actualizar el préstamo", error: error.message });
  } finally {
    connection.release();
  }
});

// ============================================
// DELETE /:id → eliminar un préstamo
// ============================================
router.delete("/:id", async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { id } = req.params;

    await connection.beginTransaction();

    const [existing] = await connection.query(
      `SELECT * FROM prestamos WHERE id_prestamo = ? FOR UPDATE`,
      [id]
    );
    if (existing.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: "Préstamo no encontrado" });
    }
    const p = existing[0];

    if (p.estado === "consolidado") {
      await connection.rollback();
      return res.status(409).json({ message: "Este préstamo fue consolidado: forma parte del historial y no se puede eliminar." });
    }

    // Nunca se borra el historial de pagos: primero hay que anularlos uno a uno (con motivo)
    const [[{ cantidad_pagos }]] = await connection.query(
      `SELECT COUNT(*) AS cantidad_pagos FROM pagos_prestamo WHERE id_prestamo = ?`,
      [id]
    );
    if (cantidad_pagos > 0) {
      await connection.rollback();
      return res.status(409).json({
        message: `Este préstamo tiene ${cantidad_pagos} pago(s) registrado(s). Anula los pagos antes de eliminarlo.`,
      });
    }

    await connection.query(`DELETE FROM prestamos WHERE id_prestamo = ?`, [id]);

    // Si ya se había desembolsado, el dinero vuelve a caja
    if (p.estado !== "pendiente") {
      await registrarCaja(connection, {
        tipo: "ingreso",
        categoria: "anulacion_desembolso",
        monto: p.monto,
        metodo: "efectivo",
        descripcion: `Eliminación del préstamo #${id} (reversión del desembolso)`,
        referencia_tipo: "prestamo",
        referencia_id: parseInt(id),
        id_socio: p.id_usuario,
        id_registrado_por: req.usuario?.id_usuario,
      });
    }

    await connection.query(
      `INSERT INTO bitacora (id_usuario, accion, detalle, fecha) VALUES (?, ?, ?, NOW())`,
      [
        p.id_usuario,
        "Eliminación de préstamo",
        `Préstamo #${id} por ${dinero(parseFloat(p.monto))} eliminado (estado: ${p.estado})`,
      ]
    );

    await connection.commit();

    res.json({ success: true, message: "Préstamo eliminado correctamente." });
  } catch (error) {
    await connection.rollback().catch(() => {});
    console.error("ERROR AL ELIMINAR PRÉSTAMO:", error);
    res.status(500).json({ message: "Error al eliminar el préstamo", error: error.message });
  } finally {
    connection.release();
  }
});

module.exports = router;
