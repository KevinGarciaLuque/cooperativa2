// Comité de crédito: miembros, préstamos que esperan su decisión y votos.
const express = require("express");
const router = express.Router();
const pool = require("../db");
const comite = require("../utils/comite");
const { avisarAprobacion } = require("../utils/cartaAprobacion");
const { notificarSocio } = require("../utils/notificaciones");
const { dinero } = require("../utils/pais");

const bitacora = (conn, idUsuario, accion, detalle) =>
  conn.query(`INSERT INTO bitacora (id_usuario, accion, detalle, fecha) VALUES (?, ?, ?, NOW())`, [idUsuario, accion, detalle]);

const miembros = async () => {
  const [filas] = await pool.query(
    `SELECT c.id_usuario, c.cargo, u.nombre_completo, r.nombre AS rol
     FROM comite_credito c JOIN usuarios u ON u.id_usuario = c.id_usuario JOIN roles r ON r.id_rol = u.rol_id
     ORDER BY u.nombre_completo`
  );
  return filas;
};

// GET /api/comite → configuración, miembros y si el usuario es miembro
router.get("/", async (req, res) => {
  try {
    const lista = await miembros();
    res.json({
      success: true,
      data: {
        activo: comite.limite() > 0,
        limite: comite.limite(),
        votos_requeridos: comite.votosRequeridos(),
        miembros: lista,
        soy_miembro: lista.some((m) => m.id_usuario === req.usuario.id_usuario),
      },
    });
  } catch (error) {
    console.error("ERROR AL LEER EL COMITÉ:", error);
    res.status(500).json({ message: "No se pudo leer el comité" });
  }
});

// GET /api/comite/personal → personal activo que puede integrar el comité
router.get("/personal", async (req, res) => {
  try {
    const [filas] = await pool.query(
      `SELECT u.id_usuario, u.nombre_completo, r.nombre AS rol
       FROM usuarios u JOIN roles r ON r.id_rol = u.rol_id
       WHERE u.estado = 'activo' AND r.nombre <> 'Socio'
       ORDER BY u.nombre_completo`
    );
    res.json({ success: true, data: filas });
  } catch (error) {
    console.error("ERROR AL LISTAR PERSONAL:", error);
    res.status(500).json({ message: "No se pudo leer el personal" });
  }
});

// PUT /api/comite/miembros  { miembros: [{ id_usuario, cargo }] }  (Super Administrador)
router.put("/miembros", async (req, res) => {
  if (req.usuario.rol !== "Super Administrador") {
    return res.status(403).json({ message: "Solo el Super Administrador define el comité." });
  }
  const lista = Array.isArray(req.body?.miembros) ? req.body.miembros : [];
  const ids = [...new Set(lista.map((m) => parseInt(m.id_usuario)).filter(Boolean))];
  const conn = await pool.getConnection();
  try {
    if (ids.length) {
      const [validos] = await conn.query(
        `SELECT u.id_usuario FROM usuarios u JOIN roles r ON r.id_rol = u.rol_id
         WHERE u.id_usuario IN (?) AND u.estado = 'activo' AND r.nombre <> 'Socio'`,
        [ids]
      );
      if (validos.length !== ids.length) {
        return res.status(400).json({ message: "Los miembros del comité deben ser personal activo de la cooperativa." });
      }
    }
    await conn.beginTransaction();
    await conn.query("DELETE FROM comite_credito");
    for (const id of ids) {
      const m = lista.find((x) => parseInt(x.id_usuario) === id);
      await conn.query("INSERT INTO comite_credito (id_usuario, cargo) VALUES (?, ?)", [id, String(m?.cargo || "").trim().substring(0, 60) || null]);
    }
    await bitacora(conn, req.usuario.id_usuario, "Comité de crédito", `Miembros del comité: ${ids.length}`);
    await conn.commit();
    res.json({ success: true, message: "Comité guardado.", data: await miembros() });
  } catch (error) {
    await conn.rollback().catch(() => {});
    console.error("ERROR AL GUARDAR EL COMITÉ:", error);
    res.status(500).json({ message: "No se pudo guardar el comité" });
  } finally {
    conn.release();
  }
});

// GET /api/comite/pendientes → solicitudes pendientes que necesitan al comité, con sus votos
router.get("/pendientes", async (req, res) => {
  try {
    if (!(comite.limite() > 0)) return res.json({ success: true, data: [] });
    const [filas] = await pool.query(
      `SELECT p.id_prestamo, p.id_usuario, p.monto, p.plazo_meses, p.tasa_original, p.tipo_tasa, p.tasa_interes,
              u.nombre_completo, u.numero_socio
       FROM prestamos p JOIN usuarios u ON u.id_usuario = p.id_usuario
       WHERE p.estado = 'pendiente' AND p.monto > ?
       ORDER BY p.id_prestamo`,
      [comite.limite()]
    );
    for (const f of filas) {
      const c = await comite.conteo(pool, f.id_prestamo, f.monto);
      f.comite = c;
      f.mi_voto = c.votos.find((v) => v.id_usuario === req.usuario.id_usuario)?.voto || null;
    }
    res.json({ success: true, data: filas });
  } catch (error) {
    console.error("ERROR AL LISTAR PENDIENTES DEL COMITÉ:", error);
    res.status(500).json({ message: "No se pudieron leer las solicitudes" });
  }
});

// GET /api/comite/prestamos/:id → votos de un préstamo
router.get("/prestamos/:id", async (req, res) => {
  try {
    const [[p]] = await pool.query("SELECT id_prestamo, monto, estado FROM prestamos WHERE id_prestamo = ?", [parseInt(req.params.id)]);
    if (!p) return res.status(404).json({ message: "Préstamo no encontrado" });
    res.json({ success: true, data: { requiere: comite.requiere(p.monto), ...(await comite.conteo(pool, p.id_prestamo, p.monto)) } });
  } catch (error) {
    console.error("ERROR AL LEER VOTOS:", error);
    res.status(500).json({ message: "No se pudieron leer los votos" });
  }
});

// POST /api/comite/prestamos/:id/votar  { voto: aprobar|rechazar, comentario }
router.post("/prestamos/:id/votar", async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [[p]] = await conn.query("SELECT * FROM prestamos WHERE id_prestamo = ? FOR UPDATE", [parseInt(req.params.id)]);
    if (!p) {
      await conn.rollback();
      return res.status(404).json({ message: "Préstamo no encontrado" });
    }
    if (p.estado !== "pendiente") {
      await conn.rollback();
      return res.status(400).json({ message: `El préstamo ya está en estado "${p.estado}".` });
    }
    if (!comite.requiere(p.monto)) {
      await conn.rollback();
      return res.status(400).json({ message: "Este préstamo no necesita al comité: apruébalo directamente." });
    }
    const { voto, comentario } = req.body || {};
    const r = await comite.votar(conn, p, req.usuario.id_usuario, voto, comentario);
    let resultado = "pendiente";
    if (r.aprobado) {
      await conn.query(
        `UPDATE prestamos SET estado = 'aprobado', aprobado_por = ?, fecha_aprobacion = NOW() WHERE id_prestamo = ?`,
        [req.usuario.id_usuario, p.id_prestamo]
      );
      await bitacora(conn, p.id_usuario, "Préstamo aprobado", `Préstamo #${p.id_prestamo} por ${dinero(p.monto)} aprobado por el comité (${r.a_favor} votos a favor). Pendiente de desembolso.`);
      resultado = "aprobado";
    } else if (r.rechazado) {
      const motivos = r.votos.filter((v) => v.voto === "rechazar" && v.comentario).map((v) => v.comentario).join("; ");
      await conn.query(`UPDATE prestamos SET estado = 'rechazado', motivo_rechazo = ? WHERE id_prestamo = ?`, [
        `Comité de crédito: ${motivos}`.substring(0, 255),
        p.id_prestamo,
      ]);
      await bitacora(conn, p.id_usuario, "Préstamo rechazado", `Préstamo #${p.id_prestamo} rechazado por el comité. ${motivos}`);
      resultado = "rechazado";
    }
    await conn.commit();

    let aviso = "";
    if (resultado === "aprobado") aviso = await avisarAprobacion(p.id_prestamo, p.id_usuario);
    if (resultado === "rechazado") {
      notificarSocio(
        p.id_usuario,
        "Respuesta a tu solicitud de préstamo",
        `<p>Lamentamos informarte que tu solicitud de préstamo por ${dinero(p.monto)} no fue aprobada por el comité de crédito.</p>
         <p>Si tienes dudas, comunícate con la cooperativa.</p>`
      );
    }
    const textos = {
      aprobado: `Préstamo aprobado por el comité. Falta registrar el desembolso.${aviso}`,
      rechazado: "El comité rechazó la solicitud.",
      pendiente: `Voto registrado: ${r.a_favor} a favor y ${r.en_contra} en contra de ${r.requeridos} necesarios.`,
    };
    res.json({
      success: true,
      resultado,
      comite: { a_favor: r.a_favor, en_contra: r.en_contra, requeridos: r.requeridos },
      message: textos[resultado],
    });
  } catch (error) {
    await conn.rollback().catch(() => {});
    if (error.codigo) return res.status(error.codigo).json({ message: error.message });
    console.error("ERROR AL VOTAR:", error);
    res.status(500).json({ message: "No se pudo registrar el voto" });
  } finally {
    conn.release();
  }
});

module.exports = router;
