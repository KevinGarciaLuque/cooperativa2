// Créditos grupales (función "creditos_grupales", la enciende el Super Administrador).
//
// Un grupo reúne socios con un cargo (presidente, tesorero...). Un crédito grupal es un préstamo
// normal para cada integrante (con su monto, su plan de pagos y su mora), unidos por
// prestamos.id_credito_grupal. Así todo lo que ya existe (aprobación, comité, garantías,
// desembolso, caja, contabilidad, recibos, cartera) sirve igual para cada integrante.
// El pago grupal registra en una sola operación lo que paga cada integrante.
const express = require("express");
const router = express.Router();
const pool = require("../db");
const { habilitada } = require("../utils/funciones");
const { sucursalVista, sucursalPrincipal } = require("../utils/sucursal");
const { procesarPago, FalloPago } = require("./pagos");
const { crearNotificacion } = require("../utils/notificaciones");
const { dinero } = require("../utils/pais");
const { hoyISO } = require("../utils/fechas");

const CARGOS = ["presidente", "vicepresidente", "secretario", "tesorero", "vocal", "integrante"];
const UNICOS = ["presidente", "vicepresidente", "secretario", "tesorero"];
const num = (v) => parseFloat(v || 0);
const texto = (v, max) => {
  const t = String(v ?? "").trim();
  return t ? t.substring(0, max) : null;
};
const error = (codigo, message) => Object.assign(new Error(message), { codigo });

// Solo con la función habilitada (el Super Administrador siempre la ve)
router.use(async (req, res, next) => {
  if (await habilitada("creditos_grupales", req.usuario)) return next();
  res.status(403).json({ message: "Los créditos grupales no están habilitados." });
});

const bitacora = (conn, idUsuario, accion, detalle) =>
  conn.query("INSERT INTO bitacora (id_usuario, accion, detalle, fecha) VALUES (?, ?, ?, NOW())", [idUsuario, accion, detalle]);

// Valida los integrantes: socios activos, sin repetir, cargos válidos y un solo presidente, etc.
const validarIntegrantes = async (conn, lista) => {
  const integrantes = [];
  const vistos = new Set();
  for (const x of Array.isArray(lista) ? lista : []) {
    const id = parseInt(x?.id_usuario);
    if (!id || vistos.has(id)) continue;
    vistos.add(id);
    const cargo = CARGOS.includes(x.cargo) ? x.cargo : "integrante";
    integrantes.push({ id_usuario: id, cargo });
  }
  if (integrantes.length < 2) throw error(400, "Un grupo necesita al menos 2 integrantes.");
  for (const c of UNICOS) {
    if (integrantes.filter((i) => i.cargo === c).length > 1) throw error(400, `El grupo solo puede tener un ${c}.`);
  }
  const [socios] = await conn.query(
    `SELECT u.id_usuario FROM usuarios u JOIN roles r ON r.id_rol = u.rol_id
     WHERE u.id_usuario IN (?) AND r.nombre = 'Socio' AND u.estado = 'activo'`,
    [integrantes.map((i) => i.id_usuario)]
  );
  if (socios.length !== integrantes.length) throw error(400, "Todos los integrantes deben ser socios activos.");
  return integrantes;
};

const integrantesDe = async (conn, idGrupo) => {
  const [filas] = await conn.query(
    `SELECT gi.id_usuario, gi.cargo, u.nombre_completo, u.dni, u.numero_socio, u.telefono
     FROM grupo_integrantes gi JOIN usuarios u ON u.id_usuario = gi.id_usuario
     WHERE gi.id_grupo = ?
     ORDER BY FIELD(gi.cargo, 'presidente','vicepresidente','secretario','tesorero','vocal','integrante'), u.nombre_completo`,
    [idGrupo]
  );
  return filas;
};

// Préstamos de cada integrante en un crédito grupal, con lo que deben
const prestamosDelCredito = async (conn, idCredito) => {
  const [filas] = await conn.query(
    `SELECT p.id_prestamo, p.id_usuario, p.monto, p.saldo_restante, p.estado, p.plazo_meses, p.fecha_otorgado,
            u.nombre_completo, u.dni, u.numero_socio,
            IFNULL(gi.cargo, 'integrante') AS cargo,
            (SELECT IFNULL(SUM(monto_pagado), 0) FROM pagos_prestamo pp WHERE pp.id_prestamo = p.id_prestamo) AS total_pagado
     FROM prestamos p
     JOIN usuarios u ON u.id_usuario = p.id_usuario
     JOIN creditos_grupales cg ON cg.id_credito_grupal = p.id_credito_grupal
     LEFT JOIN grupo_integrantes gi ON gi.id_grupo = cg.id_grupo AND gi.id_usuario = p.id_usuario
     WHERE p.id_credito_grupal = ?
     ORDER BY FIELD(IFNULL(gi.cargo,'integrante'), 'presidente','vicepresidente','secretario','tesorero','vocal','integrante'), u.nombre_completo`,
    [idCredito]
  );
  return filas.map((f) => ({ ...f, monto: num(f.monto), saldo_restante: num(f.saldo_restante), total_pagado: num(f.total_pagado) }));
};

// Estado del crédito grupal a partir de los préstamos de sus integrantes
const estadoGrupal = (prestamos) => {
  const estados = new Set(prestamos.map((p) => p.estado));
  if (!prestamos.length) return "sin_prestamos";
  if (estados.has("mora")) return "mora";
  if (estados.has("pendiente")) return "pendiente";
  if (estados.has("aprobado")) return "aprobado";
  if (estados.has("activo")) return "activo";
  if ([...estados].every((e) => e === "pagado")) return "pagado";
  if ([...estados].every((e) => e === "rechazado")) return "rechazado";
  return [...estados][0];
};

// ── Grupos ─────────────────────────────────────────────────────────────────

// GET /api/grupos?search=
router.get("/", async (req, res) => {
  try {
    const w = [];
    const p = [];
    const vista = await sucursalVista(req);
    if (vista) {
      w.push("IFNULL(g.id_sucursal, ?) = ?");
      p.push(await sucursalPrincipal(), vista);
    }
    if (req.query.search) {
      w.push("(g.nombre LIKE ? OR EXISTS (SELECT 1 FROM grupo_integrantes gi JOIN usuarios u ON u.id_usuario = gi.id_usuario WHERE gi.id_grupo = g.id_grupo AND (u.nombre_completo LIKE ? OR u.dni LIKE ?)))");
      const t = `%${req.query.search}%`;
      p.push(t, t, t);
    }
    const [grupos] = await pool.query(
      `SELECT g.*, s.nombre AS sucursal, pr.nombre_completo AS promotor_nombre,
              (SELECT COUNT(*) FROM grupo_integrantes gi WHERE gi.id_grupo = g.id_grupo) AS integrantes,
              (SELECT u.nombre_completo FROM grupo_integrantes gi JOIN usuarios u ON u.id_usuario = gi.id_usuario
                 WHERE gi.id_grupo = g.id_grupo AND gi.cargo = 'presidente' LIMIT 1) AS presidente,
              (SELECT COUNT(DISTINCT cg.id_credito_grupal) FROM creditos_grupales cg JOIN prestamos x ON x.id_credito_grupal = cg.id_credito_grupal
                 WHERE cg.id_grupo = g.id_grupo AND x.estado IN ('pendiente','aprobado','activo','mora')) AS creditos_vigentes,
              (SELECT IFNULL(SUM(x.saldo_restante), 0) FROM creditos_grupales cg JOIN prestamos x ON x.id_credito_grupal = cg.id_credito_grupal
                 WHERE cg.id_grupo = g.id_grupo AND x.estado IN ('activo','mora')) AS saldo_vigente
       FROM grupos g
       LEFT JOIN sucursales s ON s.id_sucursal = g.id_sucursal
       LEFT JOIN usuarios pr ON pr.id_usuario = g.id_promotor
       ${w.length ? "WHERE " + w.join(" AND ") : ""}
       ORDER BY g.estado, g.nombre`,
      p
    );
    res.json({ success: true, data: grupos.map((g) => ({ ...g, saldo_vigente: num(g.saldo_vigente) })) });
  } catch (e) {
    console.error("ERROR AL LISTAR GRUPOS:", e);
    res.status(500).json({ message: "No se pudieron leer los grupos" });
  }
});

// GET /api/grupos/socio/:id → grupos a los que pertenece un socio
router.get("/socio/:id", async (req, res) => {
  try {
    const [filas] = await pool.query(
      `SELECT g.id_grupo, g.nombre, gi.cargo FROM grupo_integrantes gi JOIN grupos g ON g.id_grupo = gi.id_grupo
       WHERE gi.id_usuario = ? ORDER BY g.nombre`,
      [parseInt(req.params.id)]
    );
    res.json({ success: true, data: filas });
  } catch (e) {
    res.status(500).json({ message: "No se pudieron leer los grupos del socio" });
  }
});

// GET /api/grupos/:id → grupo, integrantes y sus créditos
router.get("/:id(\\d+)", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [[g]] = await pool.query(
      `SELECT g.*, s.nombre AS sucursal, pr.nombre_completo AS promotor_nombre
       FROM grupos g LEFT JOIN sucursales s ON s.id_sucursal = g.id_sucursal LEFT JOIN usuarios pr ON pr.id_usuario = g.id_promotor
       WHERE g.id_grupo = ?`,
      [id]
    );
    if (!g) return res.status(404).json({ message: "Grupo no encontrado" });
    const [creditos] = await pool.query("SELECT * FROM creditos_grupales WHERE id_grupo = ? ORDER BY id_credito_grupal DESC", [id]);
    for (const c of creditos) {
      const ps = await prestamosDelCredito(pool, c.id_credito_grupal);
      c.estado = estadoGrupal(ps);
      c.saldo = ps.filter((x) => ["activo", "mora"].includes(x.estado)).reduce((t, x) => t + x.saldo_restante, 0);
      c.monto_total = num(c.monto_total);
      c.integrantes = ps.length;
    }
    res.json({ success: true, data: { ...g, integrantes: await integrantesDe(pool, id), creditos } });
  } catch (e) {
    console.error("ERROR AL LEER GRUPO:", e);
    res.status(500).json({ message: "No se pudo leer el grupo" });
  }
});

// POST /api/grupos  y  PUT /api/grupos/:id
// { nombre, id_promotor, id_sucursal, comunidad, estado, integrantes: [{ id_usuario, cargo }] }
const guardarGrupo = async (req, res) => {
  const idGrupo = req.params.id ? parseInt(req.params.id) : null;
  const b = req.body || {};
  const conn = await pool.getConnection();
  try {
    const nombre = texto(b.nombre, 100);
    if (!nombre) throw error(400, "Escribe el nombre del grupo.");
    const integrantes = await validarIntegrantes(conn, b.integrantes);
    let promotor = null;
    if (b.id_promotor) {
      const [[p]] = await conn.query(
        `SELECT u.id_usuario FROM usuarios u JOIN roles r ON r.id_rol = u.rol_id WHERE u.id_usuario = ? AND u.estado = 'activo' AND r.nombre <> 'Socio'`,
        [parseInt(b.id_promotor)]
      );
      if (!p) throw error(400, "El promotor debe ser personal activo.");
      promotor = p.id_usuario;
    }
    let sucursal = parseInt(b.id_sucursal) || (await sucursalVista(req)) || (await sucursalPrincipal(conn));
    const [[s]] = await conn.query("SELECT id_sucursal FROM sucursales WHERE id_sucursal = ?", [sucursal || 0]);
    sucursal = s?.id_sucursal || null;

    await conn.beginTransaction();
    if (idGrupo) {
      const [[g]] = await conn.query("SELECT id_grupo FROM grupos WHERE id_grupo = ? FOR UPDATE", [idGrupo]);
      if (!g) throw error(404, "Grupo no encontrado");
      // No se puede sacar del grupo a quien tiene un crédito grupal vigente
      const [conCredito] = await conn.query(
        `SELECT DISTINCT p.id_usuario, u.nombre_completo FROM prestamos p
         JOIN creditos_grupales cg ON cg.id_credito_grupal = p.id_credito_grupal
         JOIN usuarios u ON u.id_usuario = p.id_usuario
         WHERE cg.id_grupo = ? AND p.estado IN ('pendiente','aprobado','activo','mora')`,
        [idGrupo]
      );
      const quedan = new Set(integrantes.map((i) => i.id_usuario));
      const fuera = conCredito.filter((c) => !quedan.has(c.id_usuario));
      if (fuera.length) throw error(409, `${fuera.map((f) => f.nombre_completo).join(", ")} tiene un crédito grupal vigente: no se puede quitar del grupo.`);
      await conn.query(
        "UPDATE grupos SET nombre = ?, id_promotor = ?, id_sucursal = ?, comunidad = ?, estado = ? WHERE id_grupo = ?",
        [nombre, promotor, sucursal, texto(b.comunidad, 120), b.estado === "inactivo" ? "inactivo" : "activo", idGrupo]
      );
      await conn.query("DELETE FROM grupo_integrantes WHERE id_grupo = ?", [idGrupo]);
    }
    let id = idGrupo;
    if (!id) {
      const [r] = await conn.query(
        "INSERT INTO grupos (nombre, id_promotor, id_sucursal, comunidad, creado_por) VALUES (?, ?, ?, ?, ?)",
        [nombre, promotor, sucursal, texto(b.comunidad, 120), req.usuario.id_usuario]
      );
      id = r.insertId;
    }
    await conn.query("INSERT INTO grupo_integrantes (id_grupo, id_usuario, cargo) VALUES ?", [
      integrantes.map((i) => [id, i.id_usuario, i.cargo]),
    ]);
    await bitacora(conn, req.usuario.id_usuario, idGrupo ? "Grupo actualizado" : "Grupo creado", `Grupo #${id} "${nombre}" con ${integrantes.length} integrantes`);
    await conn.commit();
    res.status(idGrupo ? 200 : 201).json({ success: true, message: idGrupo ? "Grupo guardado." : "Grupo creado.", id_grupo: id });
  } catch (e) {
    await conn.rollback().catch(() => {});
    if (e.codigo) return res.status(e.codigo).json({ message: e.message });
    console.error("ERROR AL GUARDAR GRUPO:", e);
    res.status(500).json({ message: "No se pudo guardar el grupo" });
  } finally {
    conn.release();
  }
};
router.post("/", guardarGrupo);
router.put("/:id(\\d+)", guardarGrupo);

// ── Créditos grupales ──────────────────────────────────────────────────────

// POST /api/grupos/:id/creditos
// { tasa_mensual, plazo_meses, id_producto?, descripcion?, fecha_otorgado?, montos: [{ id_usuario, monto }],
//   linea_credito?, destino?, numero_pagare?, numero_acta? }
// Crea un préstamo pendiente para cada integrante con monto; luego se aprueban y desembolsan
// como cualquier préstamo (desde esta misma pantalla, para todos a la vez).
router.post("/:id(\\d+)/creditos", async (req, res) => {
  const idGrupo = parseInt(req.params.id);
  const b = req.body || {};
  const conn = await pool.getConnection();
  try {
    const tasa = num(b.tasa_mensual);
    const plazo = parseInt(b.plazo_meses);
    if (!(tasa >= 0) || tasa > 30) throw error(400, "La tasa mensual debe estar entre 0 y 30%.");
    if (!Number.isInteger(plazo) || plazo < 1 || plazo > 360) throw error(400, "El plazo debe ser de 1 a 360 meses.");
    const [[g]] = await conn.query("SELECT id_grupo, nombre, estado, id_promotor FROM grupos WHERE id_grupo = ?", [idGrupo]);
    if (!g) throw error(404, "Grupo no encontrado");
    if (g.estado !== "activo") throw error(400, "El grupo está inactivo.");
    const miembros = new Set((await integrantesDe(conn, idGrupo)).map((i) => i.id_usuario));
    const montos = (Array.isArray(b.montos) ? b.montos : [])
      .map((m) => ({ id_usuario: parseInt(m.id_usuario), monto: Math.round(num(m.monto) * 100) / 100 }))
      .filter((m) => m.monto > 0);
    if (montos.length < 1) throw error(400, "Indica el monto de al menos un integrante.");
    if (montos.some((m) => !miembros.has(m.id_usuario))) throw error(400, "Solo los integrantes del grupo reciben el crédito.");
    if (new Set(montos.map((m) => m.id_usuario)).size !== montos.length) throw error(400, "Un integrante aparece dos veces.");
    const total = montos.reduce((t, m) => t + m.monto, 0);
    const fecha = /^\d{4}-\d{2}-\d{2}$/.test(String(b.fecha_otorgado || "")) ? b.fecha_otorgado : null;
    let producto = null;
    if (b.id_producto) {
      const [[pr]] = await conn.query("SELECT id_producto FROM productos_credito WHERE id_producto = ? AND activo = 1", [parseInt(b.id_producto)]);
      if (!pr) throw error(400, "Ese producto de crédito no está activo.");
      producto = pr.id_producto;
    }

    await conn.beginTransaction();
    const [r] = await conn.query(
      "INSERT INTO creditos_grupales (id_grupo, monto_total, tasa_mensual, plazo_meses, id_producto, descripcion, creado_por) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [idGrupo, total, tasa, plazo, producto, texto(b.descripcion, 255), req.usuario.id_usuario]
    );
    const idCredito = r.insertId;
    for (const m of montos) {
      await conn.query(
        `INSERT INTO prestamos (id_usuario, monto, tasa_interes, tipo_tasa, tasa_original, plazo_meses, saldo_restante, estado,
                                fecha_otorgado, id_producto, id_credito_grupal, linea_credito, destino, id_promotor, numero_pagare, numero_acta)
         VALUES (?, ?, ?, 'nominal_mensual', ?, ?, ?, 'pendiente', ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          m.id_usuario, m.monto, parseFloat((tasa * 12).toFixed(4)), tasa, plazo, m.monto, fecha, producto, idCredito,
          texto(b.linea_credito, 50), texto(b.destino, 150), g.id_promotor, texto(b.numero_pagare, 30), texto(b.numero_acta, 30),
        ]
      );
    }
    await bitacora(conn, req.usuario.id_usuario, "Crédito grupal", `Crédito grupal #${idCredito} del grupo "${g.nombre}": ${dinero(total)} para ${montos.length} integrantes, ${plazo} meses al ${tasa}% mensual`);
    await conn.commit();
    res.status(201).json({ success: true, message: "Crédito grupal registrado. Ahora apruébalo y desembólsalo.", id_credito_grupal: idCredito });
  } catch (e) {
    await conn.rollback().catch(() => {});
    if (e.codigo) return res.status(e.codigo).json({ message: e.message });
    console.error("ERROR AL CREAR CRÉDITO GRUPAL:", e);
    res.status(500).json({ message: "No se pudo registrar el crédito grupal" });
  } finally {
    conn.release();
  }
});

// GET /api/grupos/creditos/:id → crédito grupal con el préstamo de cada integrante
router.get("/creditos/:id(\\d+)", async (req, res) => {
  try {
    const [[c]] = await pool.query(
      `SELECT cg.*, g.nombre AS grupo, g.id_grupo FROM creditos_grupales cg JOIN grupos g ON g.id_grupo = cg.id_grupo
       WHERE cg.id_credito_grupal = ?`,
      [parseInt(req.params.id)]
    );
    if (!c) return res.status(404).json({ message: "Crédito grupal no encontrado" });
    const prestamos = await prestamosDelCredito(pool, c.id_credito_grupal);
    res.json({
      success: true,
      data: {
        ...c,
        monto_total: num(c.monto_total),
        estado: estadoGrupal(prestamos),
        saldo: prestamos.filter((x) => ["activo", "mora"].includes(x.estado)).reduce((t, x) => t + x.saldo_restante, 0),
        prestamos,
      },
    });
  } catch (e) {
    console.error("ERROR AL LEER CRÉDITO GRUPAL:", e);
    res.status(500).json({ message: "No se pudo leer el crédito grupal" });
  }
});

// POST /api/grupos/creditos/:id/pagar
// { metodo_pago, fecha_pago?, tipo_pago?, detalles: [{ id_prestamo, monto_pagado, condonar_mora? }] }
// Registra el pago de cada integrante (con la misma lógica que un pago individual) en una sola
// operación: si uno falla, no se registra ninguno.
router.post("/creditos/:id(\\d+)/pagar", async (req, res) => {
  const idCredito = parseInt(req.params.id);
  const b = req.body || {};
  const conn = await pool.getConnection();
  try {
    const prestamos = await prestamosDelCredito(conn, idCredito);
    if (!prestamos.length) throw error(404, "Crédito grupal no encontrado");
    const delCredito = new Map(prestamos.map((p) => [p.id_prestamo, p]));
    const detalles = (Array.isArray(b.detalles) ? b.detalles : [])
      .map((d) => ({ ...d, id_prestamo: parseInt(d.id_prestamo), monto_pagado: Math.round(num(d.monto_pagado) * 100) / 100 }))
      .filter((d) => d.monto_pagado > 0);
    if (!detalles.length) throw error(400, "Indica lo que paga al menos un integrante.");
    if (detalles.some((d) => !delCredito.has(d.id_prestamo))) throw error(400, "Uno de los préstamos no es de este crédito grupal.");
    if (new Set(detalles.map((d) => d.id_prestamo)).size !== detalles.length) throw error(400, "Un integrante aparece dos veces.");

    await conn.beginTransaction();
    const resultados = [];
    for (const d of detalles) {
      try {
        const r = await procesarPago(
          conn,
          {
            id_prestamo: d.id_prestamo,
            monto_pagado: d.monto_pagado,
            metodo_pago: b.metodo_pago,
            fecha_pago: b.fecha_pago,
            tipo_pago: b.tipo_pago,
            condonar_mora: !!d.condonar_mora,
            numero_boleta: b.numero_boleta,
            lugar_pago: b.lugar_pago,
          },
          req.usuario
        );
        resultados.push({ ...r, nombre: delCredito.get(d.id_prestamo).nombre_completo });
      } catch (e) {
        if (e instanceof FalloPago) {
          throw error(e.codigo, `${delCredito.get(d.id_prestamo).nombre_completo}: ${e.cuerpo?.message || e.message}`);
        }
        throw e;
      }
    }
    const total = resultados.reduce((t, r) => t + r.montoPagadoNum, 0);
    await bitacora(conn, req.usuario.id_usuario, "Pago grupal", `Crédito grupal #${idCredito}: ${dinero(total)} de ${resultados.length} integrantes`);
    await conn.commit();

    for (const r of resultados) {
      crearNotificacion(r.prestamoData.id_usuario, {
        titulo: r.prestamoLiquidado ? `¡Préstamo #${r.id_prestamo} cancelado!` : "Pago registrado",
        mensaje: `Registramos tu pago de ${dinero(r.montoPagadoNum)} a tu préstamo #${r.id_prestamo} (crédito grupal). ` +
          (r.prestamoLiquidado ? "Tu préstamo quedó totalmente pagado." : `Tu nuevo saldo es ${dinero(r.nuevoSaldo)}.`),
        tipo: "pago",
        idRecibo: r.idRecibo,
      });
    }
    res.status(201).json({
      success: true,
      message: `Pago grupal registrado: ${dinero(total)} de ${resultados.length} integrante(s).`,
      total,
      detalles: resultados.map((r) => ({
        id_prestamo: Number(r.id_prestamo),
        nombre: r.nombre,
        monto_pagado: r.montoPagadoNum,
        capital: r.capitalDelPeriodo,
        interes: r.interesEfectivo,
        mora: r.interesMoratorio,
        saldo_nuevo: r.nuevoSaldo,
        id_recibo: r.idRecibo,
        liquidado: r.prestamoLiquidado,
      })),
      fecha: b.fecha_pago || hoyISO(),
    });
  } catch (e) {
    await conn.rollback().catch(() => {});
    if (e.codigo) return res.status(e.codigo).json({ message: e.message });
    console.error("ERROR EN PAGO GRUPAL:", e);
    res.status(500).json({ message: "No se pudo registrar el pago grupal" });
  } finally {
    conn.release();
  }
});

module.exports = router;
