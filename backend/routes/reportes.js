// routes/reportes.js
const express = require("express");
const router = express.Router();
const pool = require("../db");
const ExcelJS = require("exceljs");

router.get("/estado-cuenta/:id_usuario", async (req, res) => {
  try {
    const [movimientos] = await pool.query(
      `SELECT m.*, c.tipo_cuenta FROM movimientos_cuenta m
      INNER JOIN cuentas c ON m.id_cuenta = c.id_cuenta
      WHERE c.id_usuario = ?`,
      [req.params.id_usuario]
    );

    // Crear libro y hoja
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Estado de Cuenta");

    // Encabezados
    worksheet.columns = [
      { header: "Fecha", key: "fecha", width: 20 },
      { header: "Cuenta", key: "tipo_cuenta", width: 20 },
      { header: "Tipo", key: "tipo", width: 15 },
      { header: "Monto", key: "monto", width: 15 },
      { header: "Descripción", key: "descripcion", width: 30 },
    ];

    // Datos
    movimientos.forEach((m) => worksheet.addRow(m));

    // Exportar como archivo
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=estado_cuenta_usuario_${req.params.id_usuario}.xlsx`
    );
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    res.status(500).json({ message: "Error generando el reporte", error });
  }
});

module.exports = router;
