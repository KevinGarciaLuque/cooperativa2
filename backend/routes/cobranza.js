const express = require("express");
const router = express.Router();
const pool = require("../db");
const { DIAS_MES } = require("../utils/calculosPrestamo");
const { obtenerCartera, resumirCartera } = require("../utils/cartera");

// ============================================
// CARTERA: préstamos vigentes clasificados por antigüedad
// GET /api/cobranza/cartera
// ============================================
router.get("/cartera", async (req, res) => {
  try {
    const filas = await obtenerCartera();
    const { resumen } = resumirCartera(filas);
    res.json({ success: true, dias_mes: DIAS_MES, resumen, data: filas });
  } catch (error) {
    console.error("ERROR AL OBTENER CARTERA:", error);
    res.status(500).json({ message: "Error al obtener la cartera" });
  }
});

// ============================================
// GESTIONES (llamadas, visitas, promesas)
// ============================================
router.get("/gestiones/:id_prestamo", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT g.*, u.nombre_completo AS registrado_por
       FROM gestiones_cobro g LEFT JOIN usuarios u ON g.id_usuario = u.id_usuario
       WHERE g.id_prestamo = ? ORDER BY g.fecha DESC, g.id_gestion DESC LIMIT 50`,
      [req.params.id_prestamo]
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error("ERROR AL LISTAR GESTIONES:", error);
    res.status(500).json({ message: "Error al obtener las gestiones" });
  }
});

router.post("/gestiones", async (req, res) => {
  try {
    const { id_prestamo, medio, nota, promesa_fecha, promesa_monto } = req.body;
    if (!id_prestamo || !String(nota || "").trim()) {
      return res.status(400).json({ message: "Indica el préstamo y una nota de la gestión." });
    }
    const medios = ["llamada", "visita", "mensaje", "correo", "otro"];
    const medioFinal = medios.includes(medio) ? medio : "llamada";
    const fechaPromesa = /^\d{4}-\d{2}-\d{2}$/.test(promesa_fecha || "") ? promesa_fecha : null;
    const montoPromesa = promesa_monto ? parseFloat(promesa_monto) : null;

    const [existe] = await pool.query("SELECT id_prestamo, id_usuario FROM prestamos WHERE id_prestamo = ?", [id_prestamo]);
    if (!existe.length) return res.status(404).json({ message: "Préstamo no encontrado" });

    await pool.query(
      `INSERT INTO gestiones_cobro (id_prestamo, medio, nota, promesa_fecha, promesa_monto, id_usuario)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id_prestamo, medioFinal, String(nota).trim().substring(0, 500), fechaPromesa, montoPromesa, req.usuario?.id_usuario || null]
    );
    await pool.query(
      `INSERT INTO bitacora (id_usuario, accion, detalle, fecha) VALUES (?, ?, ?, NOW())`,
      [existe[0].id_usuario, "Gestión de cobranza", `Préstamo #${id_prestamo}: ${medioFinal}. ${String(nota).trim().substring(0, 150)}`]
    );
    res.status(201).json({ success: true, message: "Gestión registrada" });
  } catch (error) {
    console.error("ERROR AL REGISTRAR GESTIÓN:", error);
    res.status(500).json({ message: "Error al registrar la gestión" });
  }
});

module.exports = router;
