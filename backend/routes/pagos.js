const express = require("express");
const router = express.Router();
const pool = require("../db");

// Obtener todos los pagos (incluyendo usuario y préstamo)
router.get("/", async (req, res) => {
  try {
    const [pagos] = await pool.query(
      `SELECT p.*, pre.monto AS monto_prestamo, u.nombre_completo
       FROM pagos_prestamo p
       INNER JOIN prestamos pre ON p.id_prestamo = pre.id_prestamo
       INNER JOIN usuarios u ON pre.id_usuario = u.id_usuario`
    );
    res.json(pagos);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener los pagos", error });
  }
});

// Obtener pagos de un préstamo específico
router.get("/prestamo/:id_prestamo", async (req, res) => {
  try {
    const [pagos] = await pool.query(
      `SELECT * FROM pagos_prestamo WHERE id_prestamo = ?`,
      [req.params.id_prestamo]
    );
    res.json(pagos);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error al obtener los pagos del préstamo", error });
  }
});

// Obtener un pago por ID
router.get("/:id", async (req, res) => {
  try {
    const [pago] = await pool.query(
      `SELECT p.*, pre.monto AS monto_prestamo, u.nombre_completo
       FROM pagos_prestamo p
       INNER JOIN prestamos pre ON p.id_prestamo = pre.id_prestamo
       INNER JOIN usuarios u ON pre.id_usuario = u.id_usuario
       WHERE p.id_pago = ?`,
      [req.params.id]
    );
    if (pago.length === 0)
      return res.status(404).json({ message: "Pago no encontrado" });
    res.json(pago[0]);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener el pago", error });
  }
});

// Registrar un nuevo pago
router.post("/", async (req, res) => {
  try {
    const { id_prestamo, monto_pagado, metodo_pago, saldo_restante } = req.body;

    if (!id_prestamo || !monto_pagado) {
      return res
        .status(400)
        .json({ message: "Préstamo y monto pagado son requeridos." });
    }

    const [result] = await pool.query(
      `INSERT INTO pagos_prestamo (id_prestamo, monto_pagado, metodo_pago, saldo_restante)
       VALUES (?, ?, ?, ?)`,
      [id_prestamo, monto_pagado, metodo_pago || null, saldo_restante || null]
    );
    res
      .status(201)
      .json({
        message: "Pago registrado correctamente",
        id_pago: result.insertId,
      });
  } catch (error) {
    res.status(500).json({ message: "Error al registrar el pago", error });
  }
});

// Actualizar un pago
router.put("/:id", async (req, res) => {
  try {
    const { monto_pagado, metodo_pago, saldo_restante } = req.body;
    const [result] = await pool.query(
      `UPDATE pagos_prestamo SET
        monto_pagado = IFNULL(?, monto_pagado),
        metodo_pago = IFNULL(?, metodo_pago),
        saldo_restante = IFNULL(?, saldo_restante)
      WHERE id_pago = ?`,
      [monto_pagado, metodo_pago, saldo_restante, req.params.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Pago no encontrado" });
    }
    res.json({ message: "Pago actualizado correctamente" });
  } catch (error) {
    res.status(500).json({ message: "Error al actualizar el pago", error });
  }
});

// Eliminar (borrado físico) un pago
router.delete("/:id", async (req, res) => {
  try {
    const [result] = await pool.query(
      `DELETE FROM pagos_prestamo WHERE id_pago = ?`,
      [req.params.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Pago no encontrado" });
    }
    res.json({ message: "Pago eliminado correctamente" });
  } catch (error) {
    res.status(500).json({ message: "Error al eliminar el pago", error });
  }
});

module.exports = router;
