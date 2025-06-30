const express = require("express");
const router = express.Router();
const pool = require("../db");

// Obtener todas las cuentas
router.get("/", async (req, res) => {
  try {
    const [cuentas] = await pool.query(
      `SELECT cuentas.*, usuarios.nombre_completo 
       FROM cuentas 
       INNER JOIN usuarios ON cuentas.id_usuario = usuarios.id_usuario`
    );
    res.json(cuentas);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener las cuentas", error });
  }
});

// Obtener una cuenta por ID
router.get("/:id", async (req, res) => {
  try {
    const [cuenta] = await pool.query(
      `SELECT cuentas.*, usuarios.nombre_completo 
       FROM cuentas 
       INNER JOIN usuarios ON cuentas.id_usuario = usuarios.id_usuario
       WHERE cuentas.id_cuenta = ?`,
      [req.params.id]
    );
    if (cuenta.length === 0)
      return res.status(404).json({ message: "Cuenta no encontrada" });
    res.json(cuenta[0]);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener la cuenta", error });
  }
});

// Obtener todas las cuentas de un usuario (por id_usuario)
router.get("/usuario/:id_usuario", async (req, res) => {
  try {
    const [cuentas] = await pool.query(
      `SELECT * FROM cuentas WHERE id_usuario = ?`,
      [req.params.id_usuario]
    );
    res.json(cuentas);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error al obtener las cuentas del usuario", error });
  }
});

// Crear una nueva cuenta
router.post("/", async (req, res) => {
  try {
    const { id_usuario, tipo_cuenta, saldo_actual } = req.body;

    if (!id_usuario || !tipo_cuenta) {
      return res
        .status(400)
        .json({ message: "Usuario y tipo de cuenta son requeridos." });
    }

    const [result] = await pool.query(
      `INSERT INTO cuentas (id_usuario, tipo_cuenta, saldo_actual) VALUES (?, ?, ?)`,
      [id_usuario, tipo_cuenta, saldo_actual || 0]
    );

    res
      .status(201)
      .json({
        message: "Cuenta creada correctamente",
        id_cuenta: result.insertId,
      });
  } catch (error) {
    res.status(500).json({ message: "Error al crear la cuenta", error });
  }
});

// Actualizar una cuenta
router.put("/:id", async (req, res) => {
  try {
    const { tipo_cuenta, saldo_actual, estado } = req.body;

    const [result] = await pool.query(
      `UPDATE cuentas SET
        tipo_cuenta = IFNULL(?, tipo_cuenta),
        saldo_actual = IFNULL(?, saldo_actual),
        estado = IFNULL(?, estado)
      WHERE id_cuenta = ?`,
      [tipo_cuenta, saldo_actual, estado, req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Cuenta no encontrada" });
    }

    res.json({ message: "Cuenta actualizada correctamente" });
  } catch (error) {
    res.status(500).json({ message: "Error al actualizar la cuenta", error });
  }
});

// Eliminar (borrado lógico) una cuenta
router.delete("/:id", async (req, res) => {
  try {
    const [result] = await pool.query(
      `UPDATE cuentas SET estado = 'cerrada' WHERE id_cuenta = ?`,
      [req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Cuenta no encontrada" });
    }

    res.json({ message: "Cuenta cerrada correctamente (borrado lógico)" });
  } catch (error) {
    res.status(500).json({ message: "Error al cerrar la cuenta", error });
  }
});

module.exports = router;
