// Contabilidad formal (partida doble): apertura, catálogo de cuentas, partidas manuales y los
// libros y estados (diario, mayor, balanza, balance general, estado de resultados).
// Las partidas de las operaciones se registran solas (utils/contabilidad.js).
const express = require("express");
const router = express.Router();
const ExcelJS = require("exceljs");
const pool = require("../db");
const { hoyISO } = require("../utils/fechas");
const { dinero } = require("../utils/pais");
const { fechaInicio, registrarPartida } = require("../utils/contabilidad");

const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const num = (v) => parseFloat(v || 0);
const esFecha = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const TIPOS = ["activo", "pasivo", "patrimonio", "ingreso", "gasto"];

const soloSuperAdmin = (req, res, next) =>
  req.usuario?.rol === "Super Administrador"
    ? next()
    : res.status(403).json({ message: "Solo el Super Administrador puede hacer esto." });

// Saldo según la naturaleza de la cuenta (deudora: debe - haber; acreedora: haber - debe)
const saldoDe = (naturaleza, debe, haber) => r2(naturaleza === "deudora" ? debe - haber : haber - debe);

// ── Estado ──────────────────────────────────────────────────────────────────
router.get("/estado", async (req, res) => {
  try {
    const inicio = await fechaInicio(pool);
    const [[p]] = await pool.query("SELECT COUNT(*) AS n, MAX(fecha) AS ultima FROM partidas");
    const [[e]] = await pool.query("SELECT COUNT(*) AS n FROM contabilidad_errores WHERE resuelto = 0");
    res.json({ success: true, iniciada: Boolean(inicio), fecha_inicio: inicio, partidas: p.n, ultima_partida: p.ultima, errores_pendientes: e.n });
  } catch (error) {
    console.error("ERROR ESTADO CONTABILIDAD:", error);
    res.status(500).json({ message: "No se pudo consultar la contabilidad" });
  }
});

// ── Catálogo ────────────────────────────────────────────────────────────────
const catalogo = async (conn = pool) => {
  const [rows] = await conn.query(
    `SELECT id_cuenta_contable, codigo, nombre, tipo, naturaleza, clave, id_padre, acepta_movimientos, activa
     FROM cuentas_contables ORDER BY codigo`
  );
  return rows.map((r) => ({ ...r, acepta_movimientos: Boolean(r.acepta_movimientos), activa: Boolean(r.activa), del_sistema: Boolean(r.clave) }));
};

router.get("/catalogo", async (req, res) => {
  try {
    res.json({ success: true, data: await catalogo() });
  } catch (error) {
    res.status(500).json({ message: "No se pudo cargar el catálogo" });
  }
});

router.post("/catalogo", soloSuperAdmin, async (req, res) => {
  try {
    const codigo = String(req.body.codigo || "").trim();
    const nombre = String(req.body.nombre || "").trim().substring(0, 120);
    if (!/^\d{1,20}$/.test(codigo)) return res.status(400).json({ message: "El código debe tener solo números." });
    if (nombre.length < 3) return res.status(400).json({ message: "Escribe el nombre de la cuenta." });
    // El tipo y el padre salen de la cuenta de mayor nivel cuyo código es prefijo de este
    const [padres] = await pool.query(
      `SELECT * FROM cuentas_contables WHERE ? LIKE CONCAT(codigo, '%') AND codigo <> ? ORDER BY LENGTH(codigo) DESC LIMIT 1`,
      [codigo, codigo]
    );
    const padre = padres[0];
    if (!padre) return res.status(400).json({ message: "El código debe empezar con el de una cuenta existente (por ejemplo 1101 dentro de 11)." });
    const [r] = await pool.query(
      `INSERT INTO cuentas_contables (codigo, nombre, tipo, naturaleza, id_padre, acepta_movimientos) VALUES (?, ?, ?, ?, ?, 1)`,
      [codigo, nombre, padre.tipo, padre.naturaleza, padre.id_cuenta_contable]
    );
    res.status(201).json({ success: true, id_cuenta_contable: r.insertId, data: await catalogo() });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") return res.status(409).json({ message: "Ya existe una cuenta con ese código." });
    console.error("ERROR AL CREAR CUENTA CONTABLE:", error);
    res.status(500).json({ message: "No se pudo crear la cuenta" });
  }
});

router.put("/catalogo/:id", soloSuperAdmin, async (req, res) => {
  try {
    const [[c]] = await pool.query("SELECT * FROM cuentas_contables WHERE id_cuenta_contable = ?", [req.params.id]);
    if (!c) return res.status(404).json({ message: "Cuenta no encontrada" });
    const nombre = req.body.nombre !== undefined ? String(req.body.nombre).trim().substring(0, 120) : c.nombre;
    if (nombre.length < 3) return res.status(400).json({ message: "Escribe el nombre de la cuenta." });
    let activa = req.body.activa !== undefined ? (req.body.activa ? 1 : 0) : c.activa;
    if (c.clave && !activa) return res.status(400).json({ message: "Las cuentas que usa el sistema no se pueden desactivar." });
    if (!activa) {
      const [[s]] = await pool.query(
        "SELECT IFNULL(SUM(debe - haber), 0) AS saldo FROM partida_lineas WHERE id_cuenta_contable = ?",
        [c.id_cuenta_contable]
      );
      if (Math.abs(num(s.saldo)) >= 0.005) return res.status(400).json({ message: "La cuenta tiene saldo: déjala en cero antes de desactivarla." });
    }
    await pool.query("UPDATE cuentas_contables SET nombre = ?, activa = ? WHERE id_cuenta_contable = ?", [nombre, activa, c.id_cuenta_contable]);
    res.json({ success: true, data: await catalogo() });
  } catch (error) {
    console.error("ERROR AL MODIFICAR CUENTA CONTABLE:", error);
    res.status(500).json({ message: "No se pudo modificar la cuenta" });
  }
});

// ── Apertura ────────────────────────────────────────────────────────────────
// Saldos que propone el sistema a hoy. El contador los revisa (sobre todo caja y bancos) y la
// diferencia entre activo y pasivo + capital queda en resultados acumulados.
const propuestaApertura = async () => {
  const [[cierre]] = await pool.query("SELECT fecha, efectivo_contado FROM cierres_caja ORDER BY fecha DESC LIMIT 1");
  const [[efectivo]] = await pool.query(
    `SELECT IFNULL(SUM(CASE WHEN tipo = 'ingreso' THEN monto ELSE -monto END), 0) AS neto
     FROM caja_movimientos WHERE metodo = 'efectivo' ${cierre ? "AND DATE(fecha) > ?" : ""}`,
    cierre ? [cierre.fecha] : []
  );
  const [[banco]] = await pool.query(
    `SELECT IFNULL(SUM(CASE WHEN tipo = 'ingreso' THEN monto ELSE -monto END), 0) AS neto
     FROM caja_movimientos WHERE metodo <> 'efectivo'`
  );
  const [[cartera]] = await pool.query("SELECT IFNULL(SUM(saldo_restante), 0) AS s FROM prestamos WHERE estado IN ('activo','mora')");
  const [socios] = await pool.query("SELECT tipo_cuenta, IFNULL(SUM(saldo_actual), 0) AS s FROM cuentas GROUP BY tipo_cuenta");
  const deSocios = (t) => num(socios.find((x) => String(x.tipo_cuenta).toLowerCase() === t)?.s);
  const otros = socios.filter((x) => !["aportaciones", "vivienda", "pensiones"].includes(String(x.tipo_cuenta).toLowerCase())).reduce((t, x) => t + num(x.s), 0);

  const saldos = {
    caja: r2((cierre ? num(cierre.efectivo_contado) : 0) + num(efectivo.neto)),
    bancos: r2(Math.max(0, num(banco.neto))),
    cartera: r2(cartera.s),
    ahorro_vivienda: r2(deSocios("vivienda")),
    ahorro_pensiones: r2(deSocios("pensiones")),
    ahorro_otros: r2(otros),
    aportaciones: r2(deSocios("aportaciones")),
  };
  const activo = saldos.caja + saldos.bancos + saldos.cartera;
  const pasivoCapital = saldos.ahorro_vivienda + saldos.ahorro_pensiones + saldos.ahorro_otros + saldos.aportaciones;
  saldos.resultados_acumulados = r2(activo - pasivoCapital); // negativo = pérdidas acumuladas

  const [cuentas] = await pool.query("SELECT id_cuenta_contable, codigo, nombre, naturaleza, clave FROM cuentas_contables WHERE clave IN (?)", [Object.keys(saldos)]);
  return cuentas
    .map((c) => {
      const s = saldos[c.clave];
      const deudora = c.naturaleza === "deudora";
      return {
        id_cuenta_contable: c.id_cuenta_contable,
        codigo: c.codigo,
        nombre: c.nombre,
        clave: c.clave,
        debe: (deudora && s > 0) || (!deudora && s < 0) ? Math.abs(s) : 0,
        haber: (!deudora && s > 0) || (deudora && s < 0) ? Math.abs(s) : 0,
      };
    })
    .sort((a, b) => a.codigo.localeCompare(b.codigo));
};

router.get("/apertura/propuesta", async (req, res) => {
  try {
    res.json({ success: true, fecha: hoyISO(), lineas: await propuestaApertura() });
  } catch (error) {
    console.error("ERROR PROPUESTA DE APERTURA:", error);
    res.status(500).json({ message: "No se pudo calcular la propuesta de apertura" });
  }
});

// Abre la contabilidad (una sola vez): la partida de apertura con los saldos revisados
router.post("/apertura", soloSuperAdmin, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    if (await fechaInicio(conn)) {
      await conn.rollback();
      return res.status(409).json({ message: "La contabilidad ya está abierta. Para corregir saldos registra una partida manual." });
    }
    const lineas = (Array.isArray(req.body.lineas) ? req.body.lineas : [])
      .map((l) => ({ id_cuenta_contable: parseInt(l.id_cuenta_contable), debe: r2(num(l.debe)), haber: r2(num(l.haber)) }))
      .filter((l) => l.id_cuenta_contable && (l.debe > 0 || l.haber > 0));
    if (!lineas.length) {
      await conn.rollback();
      return res.status(400).json({ message: "La partida de apertura no tiene saldos." });
    }
    const hoy = hoyISO();
    await conn.query(
      "INSERT INTO configuracion_sitio (clave, valor) VALUES ('cont_inicio', ?) ON DUPLICATE KEY UPDATE valor = VALUES(valor)",
      [hoy]
    );
    const id = await registrarPartida(conn, {
      fecha: hoy,
      concepto: "Partida de apertura: saldos iniciales de la contabilidad",
      origen: "apertura",
      lineas,
      creada_por: req.usuario.id_usuario,
      forzar: true,
    });
    await conn.query(`INSERT INTO bitacora (id_usuario, accion, detalle, fecha) VALUES (?, ?, ?, NOW())`, [
      req.usuario.id_usuario,
      "Apertura de la contabilidad",
      `Contabilidad de partida doble abierta el ${hoy}`,
    ]);
    await conn.commit();
    res.status(201).json({ success: true, id_partida: id, fecha_inicio: hoy });
  } catch (error) {
    await conn.rollback().catch(() => {});
    if (/no cuadra/.test(error.message)) return res.status(400).json({ message: error.message });
    console.error("ERROR EN LA APERTURA:", error);
    res.status(500).json({ message: "No se pudo abrir la contabilidad" });
  } finally {
    conn.release();
  }
});

// ── Partidas manuales ───────────────────────────────────────────────────────
const mesCerrado = async (conn, fecha) => {
  const [y, m] = fecha.split("-").map(Number);
  const [[c]] = await conn.query("SELECT id_cierre FROM cierres_mensuales WHERE anio = ? AND mes = ?", [y, m]);
  return Boolean(c);
};

router.post("/partidas", async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const inicio = await fechaInicio(conn);
    if (!inicio) return res.status(400).json({ message: "Primero hay que abrir la contabilidad (partida de apertura)." });
    const fecha = esFecha(req.body.fecha) ? req.body.fecha : hoyISO();
    const concepto = String(req.body.concepto || "").trim();
    if (concepto.length < 5) return res.status(400).json({ message: "Escribe el concepto de la partida." });
    if (fecha > hoyISO()) return res.status(400).json({ message: "La fecha no puede ser futura." });
    if (fecha < inicio) return res.status(400).json({ message: `La contabilidad empieza el ${inicio}.` });
    if (await mesCerrado(conn, fecha)) return res.status(400).json({ message: "Ese mes ya está cerrado: usa una fecha del mes abierto." });

    const lineas = (Array.isArray(req.body.lineas) ? req.body.lineas : [])
      .map((l) => ({ id_cuenta_contable: parseInt(l.id_cuenta_contable), debe: r2(num(l.debe)), haber: r2(num(l.haber)) }))
      .filter((l) => l.id_cuenta_contable && (l.debe > 0 || l.haber > 0));
    if (lineas.length < 2) return res.status(400).json({ message: "La partida necesita al menos dos líneas." });
    if (lineas.some((l) => l.debe > 0 && l.haber > 0)) return res.status(400).json({ message: "Cada línea va al debe o al haber, no a los dos." });
    const ids = [...new Set(lineas.map((l) => l.id_cuenta_contable))];
    const [validas] = await conn.query(
      "SELECT id_cuenta_contable FROM cuentas_contables WHERE id_cuenta_contable IN (?) AND activa = 1 AND acepta_movimientos = 1",
      [ids]
    );
    if (validas.length !== ids.length) return res.status(400).json({ message: "Usa solo cuentas activas de detalle (las de 4 o más dígitos)." });

    await conn.beginTransaction();
    const id = await registrarPartida(conn, { fecha, concepto, origen: "manual", lineas, creada_por: req.usuario.id_usuario });
    await conn.query(`INSERT INTO bitacora (id_usuario, accion, detalle, fecha) VALUES (?, ?, ?, NOW())`, [
      req.usuario.id_usuario,
      "Partida contable manual",
      `${concepto} (${dinero(lineas.reduce((t, l) => t + l.debe, 0))})`,
    ]);
    await conn.commit();
    res.status(201).json({ success: true, id_partida: id });
  } catch (error) {
    await conn.rollback().catch(() => {});
    if (/no cuadra/.test(error.message)) return res.status(400).json({ message: error.message });
    console.error("ERROR EN PARTIDA MANUAL:", error);
    res.status(500).json({ message: "No se pudo registrar la partida" });
  } finally {
    conn.release();
  }
});

// Anular una partida manual: se registra la partida inversa (nunca se borra)
router.post("/partidas/:id/anular", async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const motivo = String(req.body.motivo || "").trim();
    if (motivo.length < 5) return res.status(400).json({ message: "Escribe el motivo de la anulación." });
    const [[p]] = await conn.query("SELECT * FROM partidas WHERE id_partida = ?", [req.params.id]);
    if (!p) return res.status(404).json({ message: "Partida no encontrada" });
    if (p.origen !== "manual") return res.status(400).json({ message: "Solo se anulan partidas manuales; las de las operaciones se corrigen desde su módulo." });
    const [[ya]] = await conn.query("SELECT id_partida FROM partidas WHERE origen = 'anulacion' AND origen_id = ?", [p.id_partida]);
    if (ya) return res.status(400).json({ message: "Esa partida ya fue anulada." });
    const [lineas] = await conn.query("SELECT id_cuenta_contable, debe, haber FROM partida_lineas WHERE id_partida = ?", [p.id_partida]);
    await conn.beginTransaction();
    const id = await registrarPartida(conn, {
      concepto: `Anulación de la partida #${p.numero}: ${motivo}`,
      origen: "anulacion",
      origen_id: p.id_partida,
      lineas: lineas.map((l) => ({ id_cuenta_contable: l.id_cuenta_contable, debe: num(l.haber), haber: num(l.debe) })),
      creada_por: req.usuario.id_usuario,
    });
    await conn.commit();
    res.json({ success: true, id_partida: id });
  } catch (error) {
    await conn.rollback().catch(() => {});
    console.error("ERROR AL ANULAR PARTIDA:", error);
    res.status(500).json({ message: "No se pudo anular la partida" });
  } finally {
    conn.release();
  }
});

// ── Libros y estados ────────────────────────────────────────────────────────
const rango = (q) => ({
  desde: esFecha(q.desde) ? q.desde : "1900-01-01",
  hasta: esFecha(q.hasta) ? q.hasta : hoyISO(),
});

const libroDiario = async ({ desde, hasta }) => {
  const [partidas] = await pool.query(
    `SELECT p.*, u.nombre_completo AS creada_por_nombre,
            (SELECT a.numero FROM partidas a WHERE a.origen = 'anulacion' AND a.origen_id = p.id_partida LIMIT 1) AS anulada_en
     FROM partidas p LEFT JOIN usuarios u ON u.id_usuario = p.creada_por
     WHERE p.fecha BETWEEN ? AND ? ORDER BY p.numero`,
    [desde, hasta]
  );
  if (!partidas.length) return [];
  const [lineas] = await pool.query(
    `SELECT l.id_partida, l.debe, l.haber, c.codigo, c.nombre FROM partida_lineas l
     INNER JOIN cuentas_contables c ON c.id_cuenta_contable = l.id_cuenta_contable
     WHERE l.id_partida IN (?) ORDER BY l.id_partida, (l.debe > 0) DESC, c.codigo`,
    [partidas.map((p) => p.id_partida)]
  );
  return partidas.map((p) => ({
    ...p,
    total: num(p.total),
    lineas: lineas.filter((l) => l.id_partida === p.id_partida).map((l) => ({ ...l, debe: num(l.debe), haber: num(l.haber) })),
  }));
};

router.get("/diario", async (req, res) => {
  try {
    res.json({ success: true, ...rango(req.query), data: await libroDiario(rango(req.query)) });
  } catch (error) {
    console.error("ERROR LIBRO DIARIO:", error);
    res.status(500).json({ message: "No se pudo cargar el libro diario" });
  }
});

router.get("/mayor/:id", async (req, res) => {
  try {
    const { desde, hasta } = rango(req.query);
    const [[c]] = await pool.query("SELECT * FROM cuentas_contables WHERE id_cuenta_contable = ?", [req.params.id]);
    if (!c) return res.status(404).json({ message: "Cuenta no encontrada" });
    const [[previo]] = await pool.query(
      `SELECT IFNULL(SUM(l.debe), 0) AS d, IFNULL(SUM(l.haber), 0) AS h FROM partida_lineas l
       INNER JOIN partidas p ON p.id_partida = l.id_partida WHERE l.id_cuenta_contable = ? AND p.fecha < ?`,
      [c.id_cuenta_contable, desde]
    );
    const [movs] = await pool.query(
      `SELECT p.numero, p.fecha, p.concepto, p.origen, l.debe, l.haber FROM partida_lineas l
       INNER JOIN partidas p ON p.id_partida = l.id_partida
       WHERE l.id_cuenta_contable = ? AND p.fecha BETWEEN ? AND ? ORDER BY p.fecha, p.numero`,
      [c.id_cuenta_contable, desde, hasta]
    );
    let saldo = saldoDe(c.naturaleza, num(previo.d), num(previo.h));
    const saldoInicial = saldo;
    const movimientos = movs.map((m) => {
      saldo = r2(saldo + saldoDe(c.naturaleza, num(m.debe), num(m.haber)));
      return { ...m, debe: num(m.debe), haber: num(m.haber), saldo };
    });
    res.json({ success: true, cuenta: c, desde, hasta, saldo_inicial: saldoInicial, movimientos, saldo_final: saldo });
  } catch (error) {
    console.error("ERROR LIBRO MAYOR:", error);
    res.status(500).json({ message: "No se pudo cargar el libro mayor" });
  }
});

// Saldos por cuenta (de detalle) al final del rango, y movimientos dentro del rango
const balanza = async ({ desde, hasta }) => {
  const [rows] = await pool.query(
    `SELECT c.id_cuenta_contable, c.codigo, c.nombre, c.tipo, c.naturaleza,
            IFNULL(SUM(CASE WHEN p.fecha < ? THEN l.debe ELSE 0 END), 0) AS debe_previo,
            IFNULL(SUM(CASE WHEN p.fecha < ? THEN l.haber ELSE 0 END), 0) AS haber_previo,
            IFNULL(SUM(CASE WHEN p.fecha >= ? THEN l.debe ELSE 0 END), 0) AS debe,
            IFNULL(SUM(CASE WHEN p.fecha >= ? THEN l.haber ELSE 0 END), 0) AS haber
     FROM cuentas_contables c
     INNER JOIN partida_lineas l ON l.id_cuenta_contable = c.id_cuenta_contable
     INNER JOIN partidas p ON p.id_partida = l.id_partida AND p.fecha <= ?
     GROUP BY c.id_cuenta_contable ORDER BY c.codigo`,
    [desde, desde, desde, desde, hasta]
  );
  const filas = rows.map((r) => {
    const inicial = saldoDe(r.naturaleza, num(r.debe_previo), num(r.haber_previo));
    const final = saldoDe(r.naturaleza, num(r.debe_previo) + num(r.debe), num(r.haber_previo) + num(r.haber));
    return { id_cuenta_contable: r.id_cuenta_contable, codigo: r.codigo, nombre: r.nombre, tipo: r.tipo, naturaleza: r.naturaleza, saldo_inicial: inicial, debe: r2(r.debe), haber: r2(r.haber), saldo_final: final };
  });
  const totales = filas.reduce((t, f) => ({ debe: r2(t.debe + f.debe), haber: r2(t.haber + f.haber) }), { debe: 0, haber: 0 });
  return { filas, totales, cuadra: Math.abs(totales.debe - totales.haber) < 0.005 };
};

router.get("/balanza", async (req, res) => {
  try {
    res.json({ success: true, ...rango(req.query), ...(await balanza(rango(req.query))) });
  } catch (error) {
    console.error("ERROR BALANZA:", error);
    res.status(500).json({ message: "No se pudo cargar la balanza" });
  }
});

// Balance general al cierre del rango y estado de resultados del rango
const estados = async ({ desde, hasta }) => {
  const b = await balanza({ desde: "1900-01-01", hasta });
  const periodo = await balanza({ desde, hasta });
  const suma = (filas, tipo, campo) => r2(filas.filter((f) => f.tipo === tipo).reduce((t, f) => t + f[campo], 0));
  const de = (filas, tipo, campo) => filas.filter((f) => f.tipo === tipo && Math.abs(f[campo]) >= 0.005).map((f) => ({ codigo: f.codigo, nombre: f.nombre, monto: f[campo] }));

  // Movimiento del período (sin el saldo anterior) para ingresos y gastos
  const movPeriodo = periodo.filas.map((f) => ({ ...f, periodo: saldoDe(f.naturaleza, f.debe, f.haber) }));
  const ingresos = de(movPeriodo, "ingreso", "periodo");
  const gastos = de(movPeriodo, "gasto", "periodo");
  const totalIngresos = suma(movPeriodo, "ingreso", "periodo");
  const totalGastos = suma(movPeriodo, "gasto", "periodo");

  // En el balance, el resultado acumulado de ingresos y gastos aparece como excedente
  const excedenteAcumulado = r2(suma(b.filas, "ingreso", "saldo_final") - suma(b.filas, "gasto", "saldo_final"));
  const activo = suma(b.filas, "activo", "saldo_final");
  const pasivo = suma(b.filas, "pasivo", "saldo_final");
  const patrimonio = r2(suma(b.filas, "patrimonio", "saldo_final") + excedenteAcumulado);
  return {
    desde,
    hasta,
    balance: {
      activo: de(b.filas, "activo", "saldo_final"),
      pasivo: de(b.filas, "pasivo", "saldo_final"),
      patrimonio: de(b.filas, "patrimonio", "saldo_final"),
      excedente_no_distribuido: excedenteAcumulado,
      total_activo: activo,
      total_pasivo: pasivo,
      total_patrimonio: patrimonio,
      cuadra: Math.abs(activo - pasivo - patrimonio) < 0.005,
    },
    resultados: { ingresos, gastos, total_ingresos: totalIngresos, total_gastos: totalGastos, excedente: r2(totalIngresos - totalGastos) },
  };
};

router.get("/estados", async (req, res) => {
  try {
    const q = rango(req.query);
    // Por defecto, el estado de resultados es del año en curso
    if (!esFecha(req.query.desde)) q.desde = `${q.hasta.substring(0, 4)}-01-01`;
    res.json({ success: true, ...(await estados(q)) });
  } catch (error) {
    console.error("ERROR ESTADOS FINANCIEROS:", error);
    res.status(500).json({ message: "No se pudieron calcular los estados financieros" });
  }
});

// ── Partidas que no se pudieron registrar ──────────────────────────────────
router.get("/errores", async (req, res) => {
  const [rows] = await pool.query("SELECT * FROM contabilidad_errores WHERE resuelto = 0 ORDER BY fecha DESC LIMIT 200");
  res.json({ success: true, data: rows });
});

router.post("/errores/:id/resolver", async (req, res) => {
  await pool.query("UPDATE contabilidad_errores SET resuelto = 1 WHERE id_error = ?", [req.params.id]);
  res.json({ success: true });
});

// ── Excel ───────────────────────────────────────────────────────────────────
const nombreCooperativa = async () => {
  const [[r]] = await pool.query("SELECT valor FROM configuracion_sitio WHERE clave = 'site_name'");
  return r?.valor || "Cooperativa";
};

const enviarExcel = async (res, nombre, armar) => {
  const libro = new ExcelJS.Workbook();
  const ws = libro.addWorksheet(nombre.substring(0, 30));
  await armar(ws);
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${nombre.replace(/\s+/g, "_")}.xlsx"`);
  await libro.xlsx.write(res);
  res.end();
};

const encabezado = async (ws, titulo, subtitulo) => {
  ws.addRow([await nombreCooperativa()]).font = { size: 14, bold: true };
  ws.addRow([titulo]).font = { size: 12, bold: true };
  ws.addRow([subtitulo]).font = { size: 10, color: { argb: "FF666666" } };
  ws.addRow([]);
};
const negrita = (fila) => {
  fila.font = { bold: true };
  return fila;
};

router.get("/exportar/:libro", async (req, res) => {
  try {
    const q = rango(req.query);
    if (req.params.libro === "balanza") {
      const b = await balanza(q);
      return enviarExcel(res, "Balanza de comprobacion", async (ws) => {
        await encabezado(ws, "Balanza de comprobación", `Del ${q.desde === "1900-01-01" ? "inicio" : q.desde} al ${q.hasta}`);
        negrita(ws.addRow(["Código", "Cuenta", "Saldo inicial", "Debe", "Haber", "Saldo final"]));
        b.filas.forEach((f) => ws.addRow([f.codigo, f.nombre, f.saldo_inicial, f.debe, f.haber, f.saldo_final]));
        negrita(ws.addRow(["", "Totales", "", b.totales.debe, b.totales.haber, ""]));
        [3, 4, 5, 6].forEach((c) => (ws.getColumn(c).numFmt = "#,##0.00"));
        ws.getColumn(2).width = 42;
      });
    }
    if (req.params.libro === "diario") {
      const partidas = await libroDiario(q);
      return enviarExcel(res, "Libro diario", async (ws) => {
        await encabezado(ws, "Libro diario", `Del ${q.desde === "1900-01-01" ? "inicio" : q.desde} al ${q.hasta}`);
        negrita(ws.addRow(["Partida", "Fecha", "Código", "Cuenta / concepto", "Debe", "Haber"]));
        partidas.forEach((p) => {
          negrita(ws.addRow([`#${p.numero}`, p.fecha instanceof Date ? p.fecha.toISOString().substring(0, 10) : p.fecha, "", p.concepto]));
          p.lineas.forEach((l) => ws.addRow(["", "", l.codigo, l.nombre, l.debe || null, l.haber || null]));
        });
        [5, 6].forEach((c) => (ws.getColumn(c).numFmt = "#,##0.00"));
        ws.getColumn(4).width = 55;
      });
    }
    if (req.params.libro === "estados") {
      if (!esFecha(req.query.desde)) q.desde = `${q.hasta.substring(0, 4)}-01-01`;
      const e = await estados(q);
      return enviarExcel(res, "Estados financieros", async (ws) => {
        await encabezado(ws, "Balance general y estado de resultados", `Balance al ${q.hasta}; resultados del ${q.desde} al ${q.hasta}`);
        const seccion = (titulo, filas, total) => {
          negrita(ws.addRow([titulo]));
          filas.forEach((f) => ws.addRow([f.codigo, f.nombre, f.monto]));
          negrita(ws.addRow(["", `Total ${titulo.toLowerCase()}`, total]));
          ws.addRow([]);
        };
        seccion("ACTIVO", e.balance.activo, e.balance.total_activo);
        seccion("PASIVO", e.balance.pasivo, e.balance.total_pasivo);
        seccion("PATRIMONIO", [...e.balance.patrimonio, { codigo: "", nombre: "Excedente no distribuido", monto: e.balance.excedente_no_distribuido }], e.balance.total_patrimonio);
        seccion("INGRESOS DEL PERÍODO", e.resultados.ingresos, e.resultados.total_ingresos);
        seccion("GASTOS DEL PERÍODO", e.resultados.gastos, e.resultados.total_gastos);
        negrita(ws.addRow(["", "EXCEDENTE DEL PERÍODO", e.resultados.excedente]));
        ws.getColumn(3).numFmt = "#,##0.00";
        ws.getColumn(2).width = 45;
      });
    }
    res.status(404).json({ message: "Libro no encontrado" });
  } catch (error) {
    console.error("ERROR AL EXPORTAR LIBRO:", error);
    if (!res.headersSent) res.status(500).json({ message: "No se pudo exportar" });
  }
});

module.exports = router;
