const express = require("express");
const router = express.Router();
const pool = require("../db");

// Obtener todos los movimientos (con nombre de usuario y tipo de cuenta)
router.get("/", async (req, res) => {
  try {
    const [movimientos] = await pool.query(
      `SELECT m.*, c.tipo_cuenta, u.nombre_completo
       FROM movimientos_cuenta m
       INNER JOIN cuentas c ON m.id_cuenta = c.id_cuenta
       INNER JOIN usuarios u ON c.id_usuario = u.id_usuario`
    );
    res.json(movimientos);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error al obtener los movimientos", error });
  }
});

// Obtener todos los movimientos de una cuenta específica
router.get("/cuenta/:id_cuenta", async (req, res) => {
  try {
    const [movimientos] = await pool.query(
      `SELECT * FROM movimientos_cuenta WHERE id_cuenta = ?`,
      [req.params.id_cuenta]
    );
    res.json(movimientos);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error al obtener movimientos de la cuenta", error });
  }
});

// Obtener todos los movimientos de un usuario específico
router.get("/usuario/:id_usuario", async (req, res) => {
  try {
    const [movimientos] = await pool.query(
      `SELECT m.*, c.tipo_cuenta
       FROM movimientos_cuenta m
       INNER JOIN cuentas c ON m.id_cuenta = c.id_cuenta
       WHERE c.id_usuario = ?`,
      [req.params.id_usuario]
    );
    res.json(movimientos);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error al obtener movimientos del usuario", error });
  }
});

// Obtener un movimiento por ID
router.get("/:id", async (req, res) => {
  try {
    const [movimiento] = await pool.query(
      `SELECT m.*, c.tipo_cuenta, u.nombre_completo
       FROM movimientos_cuenta m
       INNER JOIN cuentas c ON m.id_cuenta = c.id_cuenta
       INNER JOIN usuarios u ON c.id_usuario = u.id_usuario
       WHERE m.id_movimiento = ?`,
      [req.params.id]
    );
    if (movimiento.length === 0)
      return res.status(404).json({ message: "Movimiento no encontrado" });
    res.json(movimiento[0]);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener el movimiento", error });
  }
});

// Registrar un nuevo movimiento
router.post("/", async (req, res) => {
  try {
    const { id_cuenta, tipo, monto, descripcion } = req.body;
    if (!id_cuenta || !tipo || !monto) {
      return res
        .status(400)
        .json({ message: "Cuenta, tipo y monto son requeridos." });
    }
    const [result] = await pool.query(
      `INSERT INTO movimientos_cuenta (id_cuenta, tipo, monto, descripcion)
       VALUES (?, ?, ?, ?)`,
      [id_cuenta, tipo, monto, descripcion || null]
    );
    res
      .status(201)
      .json({
        message: "Movimiento registrado correctamente",
        id_movimiento: result.insertId,
      });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error al registrar el movimiento", error });
  }
});

// Actualizar un movimiento
router.put("/:id", async (req, res) => {
  try {
    const { tipo, monto, descripcion } = req.body;
    const [result] = await pool.query(
      `UPDATE movimientos_cuenta SET
        tipo = IFNULL(?, tipo),
        monto = IFNULL(?, monto),
        descripcion = IFNULL(?, descripcion)
      WHERE id_movimiento = ?`,
      [tipo, monto, descripcion, req.params.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Movimiento no encontrado" });
    }
    res.json({ message: "Movimiento actualizado correctamente" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error al actualizar el movimiento", error });
  }
});

// Eliminar (borrado físico) un movimiento
router.delete("/:id", async (req, res) => {
  try {
    const [result] = await pool.query(
      `DELETE FROM movimientos_cuenta WHERE id_movimiento = ?`,
      [req.params.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Movimiento no encontrado" });
    }
    res.json({ message: "Movimiento eliminado correctamente" });
  } catch (error) {
    res.status(500).json({ message: "Error al eliminar el movimiento", error });
  }
});

module.exports = router;
