// Notificaciones dentro de la app (campanita). Cada usuario solo ve y marca las suyas.
const express = require("express");
const router = express.Router();
const pool = require("../db");
const { recordatoriosSocio, pendientesPersonal } = require("../utils/avisos");

// GET /api/notificaciones/personal → pendientes del personal según los módulos de su rol
router.get("/personal", async (req, res) => {
  try {
    if (req.usuario.rol === "Socio") return res.status(403).json({ message: "Solo para el personal" });
    res.json({ success: true, ...(await pendientesPersonal(req)) });
  } catch (error) {
    console.error("ERROR AL CALCULAR PENDIENTES:", error);
    res.status(500).json({ message: "No se pudieron cargar los pendientes" });
  }
});

// GET /api/notificaciones  → las últimas 30 y cuántas faltan por leer
router.get("/", async (req, res) => {
  try {
    const id = req.usuario.id_usuario;
    // Recordatorios de cuotas y plazos fijos (se generan una sola vez por cuota)
    if (req.usuario.rol === "Socio") await recordatoriosSocio(id);
    const [rows] = await pool.query(
      `SELECT id_notificacion, tipo, titulo, mensaje, id_recibo, leida, creada_en
       FROM notificaciones WHERE id_usuario = ? ORDER BY id_notificacion DESC LIMIT 30`,
      [id]
    );
    const [[c]] = await pool.query(
      "SELECT COUNT(*) AS n FROM notificaciones WHERE id_usuario = ? AND leida = 0",
      [id]
    );
    res.json({ success: true, data: rows.map((r) => ({ ...r, leida: !!r.leida })), sin_leer: c.n });
  } catch (error) {
    console.error("ERROR AL LISTAR NOTIFICACIONES:", error);
    res.status(500).json({ message: "No se pudieron cargar las notificaciones" });
  }
});

// POST /api/notificaciones/leer  { id? }  → marca una (o todas si no se indica) como leída
router.post("/leer", async (req, res) => {
  try {
    const id = parseInt(req.body?.id);
    if (id) {
      await pool.query("UPDATE notificaciones SET leida = 1 WHERE id_notificacion = ? AND id_usuario = ?", [
        id,
        req.usuario.id_usuario,
      ]);
    } else {
      await pool.query("UPDATE notificaciones SET leida = 1 WHERE id_usuario = ? AND leida = 0", [req.usuario.id_usuario]);
    }
    res.json({ success: true });
  } catch (error) {
    console.error("ERROR AL MARCAR NOTIFICACIONES:", error);
    res.status(500).json({ message: "No se pudo actualizar la notificación" });
  }
});

module.exports = router;
