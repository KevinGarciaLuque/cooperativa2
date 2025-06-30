const express = require("express");
const router = express.Router();
const pool = require("../db");

// Listar liquidaciones
router.get("/", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT l.*, a.nombre AS actividad
       FROM liquidaciones l
       INNER JOIN actividades a ON l.id_actividad = a.id_actividad
       ORDER BY l.fecha DESC`
    );
    res.json(rows);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error al obtener las liquidaciones", error });
  }
});

// Ver liquidación por socio
router.get("/socio/:id_usuario", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT l.*, ls.monto_recibido, a.nombre AS actividad
       FROM liquidaciones l
       INNER JOIN liquidacion_socios ls ON l.id_liquidacion = ls.id_liquidacion
       INNER JOIN actividades a ON l.id_actividad = a.id_actividad
       WHERE ls.id_usuario = ?`,
      [req.params.id_usuario]
    );
    res.json(rows);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error al obtener liquidaciones del socio", error });
  }
});

// Registrar una nueva liquidación (reparto)
router.post("/", async (req, res) => {
  try {
    const { id_actividad, descripcion } = req.body;

    // Obtener monto total de la actividad
    const [actividadRows] = await pool.query(
      "SELECT monto FROM actividades WHERE id_actividad = ?",
      [id_actividad]
    );
    if (actividadRows.length === 0)
      return res.status(404).json({ message: "Actividad no encontrada." });

    const monto_total = actividadRows[0].monto;

    // Buscar todos los socios activos
    const [socios] = await pool.query(
      'SELECT id_usuario FROM usuarios WHERE estado = "activo"'
    );
    if (socios.length === 0)
      return res.status(400).json({ message: "No hay socios activos." });

    // Calcular el reparto igualitario
    const monto_por_socio = parseFloat(
      (monto_total / socios.length).toFixed(2)
    );

    // Crear la liquidación
    const [liqResult] = await pool.query(
      "INSERT INTO liquidaciones (id_actividad, monto_total, descripcion) VALUES (?, ?, ?)",
      [id_actividad, monto_total, descripcion || null]
    );
    const id_liquidacion = liqResult.insertId;

    // Insertar el monto para cada socio
    for (let socio of socios) {
      await pool.query(
        "INSERT INTO liquidacion_socios (id_liquidacion, id_usuario, monto_recibido) VALUES (?, ?, ?)",
        [id_liquidacion, socio.id_usuario, monto_por_socio]
      );
    }

    res
      .status(201)
      .json({
        message: "Liquidación registrada y montos repartidos",
        id_liquidacion,
      });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error al registrar la liquidación", error });
  }
});

module.exports = router;
