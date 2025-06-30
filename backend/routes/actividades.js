const express = require("express");
const router = express.Router();
const pool = require("../db");

// Listar actividades
router.get("/", async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT * FROM actividades ORDER BY fecha DESC"
    );
    res.json(rows);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error al obtener las actividades", error });
  }
});

// Crear actividad
router.post("/", async (req, res) => {
  try {
    const { nombre, tipo, monto, descripcion } = req.body;
    if (!nombre || !tipo || !monto) {
      return res
        .status(400)
        .json({ message: "Nombre, tipo y monto son requeridos." });
    }
    const [result] = await pool.query(
      `INSERT INTO actividades (nombre, tipo, monto, descripcion) VALUES (?, ?, ?, ?)`,
      [nombre, tipo, monto, descripcion || null]
    );
    res
      .status(201)
      .json({ message: "Actividad registrada", id_actividad: result.insertId });
  } catch (error) {
    res.status(500).json({ message: "Error al registrar la actividad", error });
  }
});

module.exports = router;
