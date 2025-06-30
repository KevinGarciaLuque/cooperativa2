const express = require("express");
const router = express.Router();
const pool = require("../db");

// Obtener todos los registros de la bitácora (con nombre del usuario)
router.get("/", async (req, res) => {
  try {
    const [bitacora] = await pool.query(
      `SELECT b.*, u.nombre_completo 
       FROM bitacora b
       INNER JOIN usuarios u ON b.id_usuario = u.id_usuario
       ORDER BY b.fecha DESC`
    );
    res.json(bitacora);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener la bitácora", error });
  }
});

// Obtener los registros de la bitácora por usuario
router.get("/usuario/:id_usuario", async (req, res) => {
  try {
    const [registros] = await pool.query(
      `SELECT * FROM bitacora WHERE id_usuario = ? ORDER BY fecha DESC`,
      [req.params.id_usuario]
    );
    res.json(registros);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error al obtener la bitácora del usuario", error });
  }
});

// Obtener un registro de bitácora por ID
router.get("/:id", async (req, res) => {
  try {
    const [registro] = await pool.query(
      `SELECT b.*, u.nombre_completo 
       FROM bitacora b
       INNER JOIN usuarios u ON b.id_usuario = u.id_usuario
       WHERE b.id_bitacora = ?`,
      [req.params.id]
    );
    if (registro.length === 0)
      return res.status(404).json({ message: "Registro no encontrado" });
    res.json(registro[0]);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener el registro", error });
  }
});

// Registrar una acción en la bitácora
router.post("/", async (req, res) => {
  try {
    const { id_usuario, accion, detalle } = req.body;
    if (!id_usuario || !accion) {
      return res
        .status(400)
        .json({ message: "Usuario y acción son requeridos." });
    }
    const [result] = await pool.query(
      `INSERT INTO bitacora (id_usuario, accion, detalle) VALUES (?, ?, ?)`,
      [id_usuario, accion, detalle || null]
    );
    res
      .status(201)
      .json({
        message: "Registro agregado a la bitácora",
        id_bitacora: result.insertId,
      });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error al registrar en la bitácora", error });
  }
});

// Eliminar (borrado físico) un registro de bitácora
router.delete("/:id", async (req, res) => {
  try {
    const [result] = await pool.query(
      `DELETE FROM bitacora WHERE id_bitacora = ?`,
      [req.params.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Registro no encontrado" });
    }
    res.json({ message: "Registro de bitácora eliminado correctamente" });
  } catch (error) {
    res.status(500).json({ message: "Error al eliminar el registro", error });
  }
});

module.exports = router;
