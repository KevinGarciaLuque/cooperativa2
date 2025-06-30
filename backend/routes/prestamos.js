const express = require("express");
const router = express.Router();
const pool = require("../db");

// Obtener todos los préstamos (con nombre de usuario)
router.get("/", async (req, res) => {
  try {
    const [prestamos] = await pool.query(
      `SELECT p.*, u.nombre_completo 
       FROM prestamos p 
       INNER JOIN usuarios u ON p.id_usuario = u.id_usuario`
    );
    res.json(prestamos);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener los préstamos", error });
  }
});

// Obtener un préstamo por ID
router.get("/:id", async (req, res) => {
  try {
    const [prestamo] = await pool.query(
      `SELECT p.*, u.nombre_completo 
       FROM prestamos p 
       INNER JOIN usuarios u ON p.id_usuario = u.id_usuario
       WHERE p.id_prestamo = ?`,
      [req.params.id]
    );
    if (prestamo.length === 0)
      return res.status(404).json({ message: "Préstamo no encontrado" });
    res.json(prestamo[0]);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener el préstamo", error });
  }
});

// Obtener préstamos por usuario
router.get("/usuario/:id_usuario", async (req, res) => {
  try {
    const [prestamos] = await pool.query(
      `SELECT * FROM prestamos WHERE id_usuario = ?`,
      [req.params.id_usuario]
    );
    res.json(prestamos);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error al obtener préstamos del usuario", error });
  }
});

// Crear un nuevo préstamo
router.post("/", async (req, res) => {
  try {
    const {
      id_usuario,
      monto,
      tasa_interes,
      plazo_meses,
      saldo_restante,
      estado,
    } = req.body;

    if (!id_usuario || !monto || !tasa_interes || !plazo_meses) {
      return res
        .status(400)
        .json({ message: "Campos obligatorios faltantes." });
    }

    const [result] = await pool.query(
      `INSERT INTO prestamos (id_usuario, monto, tasa_interes, plazo_meses, saldo_restante, estado) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        id_usuario,
        monto,
        tasa_interes,
        plazo_meses,
        saldo_restante || monto,
        estado || "activo",
      ]
    );

    res
      .status(201)
      .json({
        message: "Préstamo creado correctamente",
        id_prestamo: result.insertId,
      });
  } catch (error) {
    res.status(500).json({ message: "Error al crear el préstamo", error });
  }
});

// Actualizar un préstamo por ID
router.put("/:id", async (req, res) => {
  try {
    const { monto, tasa_interes, plazo_meses, saldo_restante, estado } =
      req.body;

    const [result] = await pool.query(
      `UPDATE prestamos SET 
        monto = IFNULL(?, monto),
        tasa_interes = IFNULL(?, tasa_interes),
        plazo_meses = IFNULL(?, plazo_meses),
        saldo_restante = IFNULL(?, saldo_restante),
        estado = IFNULL(?, estado)
      WHERE id_prestamo = ?`,
      [monto, tasa_interes, plazo_meses, saldo_restante, estado, req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Préstamo no encontrado" });
    }

    res.json({ message: "Préstamo actualizado correctamente" });
  } catch (error) {
    res.status(500).json({ message: "Error al actualizar el préstamo", error });
  }
});

// Eliminar préstamo (borrado lógico)
router.delete("/:id", async (req, res) => {
  try {
    const [result] = await pool.query(
      `UPDATE prestamos SET estado = 'pagado' WHERE id_prestamo = ?`,
      [req.params.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Préstamo no encontrado" });
    }
    res.json({ message: "Préstamo marcado como pagado (borrado lógico)" });
  } catch (error) {
    res.status(500).json({ message: "Error al eliminar el préstamo", error });
  }
});

module.exports = router;
