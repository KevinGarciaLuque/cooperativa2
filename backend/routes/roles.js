const express = require("express");
const router = express.Router();
const pool = require("../db");

// Obtener todos los roles
router.get("/", async (req, res) => {
  try {
    const [roles] = await pool.query("SELECT * FROM roles");
    res.json(roles);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener los roles", error });
  }
});

// Obtener un rol por ID
router.get("/:id", async (req, res) => {
  try {
    const [rol] = await pool.query("SELECT * FROM roles WHERE id_rol = ?", [
      req.params.id,
    ]);
    if (rol.length === 0)
      return res.status(404).json({ message: "Rol no encontrado" });
    res.json(rol[0]);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener el rol", error });
  }
});

// Crear un nuevo rol
router.post("/", async (req, res) => {
  try {
    const { nombre } = req.body;
    if (!nombre)
      return res
        .status(400)
        .json({ message: "El nombre del rol es requerido." });
    const [result] = await pool.query("INSERT INTO roles (nombre) VALUES (?)", [
      nombre,
    ]);
    res
      .status(201)
      .json({ message: "Rol creado correctamente", id_rol: result.insertId });
  } catch (error) {
    res.status(500).json({ message: "Error al crear el rol", error });
  }
});

// Actualizar un rol por ID
router.put("/:id", async (req, res) => {
  try {
    const { nombre } = req.body;
    const [result] = await pool.query(
      "UPDATE roles SET nombre = IFNULL(?, nombre) WHERE id_rol = ?",
      [nombre, req.params.id]
    );
    if (result.affectedRows === 0)
      return res.status(404).json({ message: "Rol no encontrado" });
    res.json({ message: "Rol actualizado correctamente" });
  } catch (error) {
    res.status(500).json({ message: "Error al actualizar el rol", error });
  }
});

// Eliminar un rol por ID (borrado físico)
router.delete("/:id", async (req, res) => {
  try {
    const [result] = await pool.query("DELETE FROM roles WHERE id_rol = ?", [
      req.params.id,
    ]);
    if (result.affectedRows === 0)
      return res.status(404).json({ message: "Rol no encontrado" });
    res.json({ message: "Rol eliminado correctamente" });
  } catch (error) {
    res.status(500).json({ message: "Error al eliminar el rol", error });
  }
});

module.exports = router;
