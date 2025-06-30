const express = require("express");
const router = express.Router();
const pool = require("../db");

// Obtener todas las aportaciones (con nombre del usuario)
router.get("/", async (req, res) => {
  try {
    const [aportaciones] = await pool.query(
      `SELECT a.*, u.nombre_completo 
       FROM aportaciones a
       INNER JOIN usuarios u ON a.id_usuario = u.id_usuario`
    );
    res.json(aportaciones);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error al obtener las aportaciones", error });
  }
});

// Obtener aportaciones por usuario
router.get("/usuario/:id_usuario", async (req, res) => {
  try {
    const [aportaciones] = await pool.query(
      `SELECT * FROM aportaciones WHERE id_usuario = ?`,
      [req.params.id_usuario]
    );
    res.json(aportaciones);
  } catch (error) {
    res
      .status(500)
      .json({
        message: "Error al obtener las aportaciones del usuario",
        error,
      });
  }
});

// Obtener una aportación por ID
router.get("/:id", async (req, res) => {
  try {
    const [aportacion] = await pool.query(
      `SELECT a.*, u.nombre_completo 
       FROM aportaciones a
       INNER JOIN usuarios u ON a.id_usuario = u.id_usuario
       WHERE a.id_aportacion = ?`,
      [req.params.id]
    );
    if (aportacion.length === 0)
      return res.status(404).json({ message: "Aportación no encontrada" });
    res.json(aportacion[0]);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener la aportación", error });
  }
});

// Crear una nueva aportación
router.post("/", async (req, res) => {
  try {
    const { id_usuario, monto, descripcion } = req.body;
    if (!id_usuario || !monto) {
      return res
        .status(400)
        .json({ message: "Usuario y monto son requeridos." });
    }
    const [result] = await pool.query(
      `INSERT INTO aportaciones (id_usuario, monto, descripcion) VALUES (?, ?, ?)`,
      [id_usuario, monto, descripcion || null]
    );
    res
      .status(201)
      .json({
        message: "Aportación registrada correctamente",
        id_aportacion: result.insertId,
      });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error al registrar la aportación", error });
  }
});

// Actualizar una aportación
router.put("/:id", async (req, res) => {
  try {
    const { monto, descripcion } = req.body;
    const [result] = await pool.query(
      `UPDATE aportaciones SET 
        monto = IFNULL(?, monto),
        descripcion = IFNULL(?, descripcion)
      WHERE id_aportacion = ?`,
      [monto, descripcion, req.params.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Aportación no encontrada" });
    }
    res.json({ message: "Aportación actualizada correctamente" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error al actualizar la aportación", error });
  }
});

// Eliminar (borrado lógico) una aportación
router.delete("/:id", async (req, res) => {
  try {
    // Puedes borrar de verdad o implementar un campo estado si quieres solo ocultar
    const [result] = await pool.query(
      `DELETE FROM aportaciones WHERE id_aportacion = ?`,
      [req.params.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Aportación no encontrada" });
    }
    res.json({ message: "Aportación eliminada correctamente" });
  } catch (error) {
    res.status(500).json({ message: "Error al eliminar la aportación", error });
  }
});

module.exports = router;
