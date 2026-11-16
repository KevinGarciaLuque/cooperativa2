// Garantías de los préstamos. El personal las registra y las libera; el socio ve las del suyo.
const express = require("express");
const router = express.Router();
const pool = require("../db");
const { TIPOS, listarGarantias, validarGarantia, describir } = require("../utils/garantias");

const esSocio = (req) => req.usuario?.rol === "Socio";
const soloPersonal = (req, res, next) =>
  esSocio(req) ? res.status(403).json({ message: "No tienes permiso para realizar esta acción." }) : next();

const bitacora = (conn, idUsuario, accion, detalle) =>
  conn.query(`INSERT INTO bitacora (id_usuario, accion, detalle, fecha) VALUES (?, ?, ?, NOW())`, [idUsuario, accion, detalle]);

router.get("/prestamo/:id", async (req, res) => {
  try {
    const datos = await listarGarantias(pool, req.params.id);
    if (!datos) return res.status(404).json({ message: "Préstamo no encontrado" });
    res.json({ success: true, tipos: TIPOS, ...datos });
  } catch (error) {
    console.error("ERROR AL LISTAR GARANTÍAS:", error);
    res.status(500).json({ message: "No se pudieron cargar las garantías" });
  }
});

router.post("/prestamo/:id", soloPersonal, async (req, res) => {
  try {
    const [[p]] = await pool.query("SELECT id_prestamo, id_usuario, estado FROM prestamos WHERE id_prestamo = ?", [req.params.id]);
    if (!p) return res.status(404).json({ message: "Préstamo no encontrado" });
    if (["rechazado", "pagado", "consolidado"].includes(p.estado)) {
      return res.status(400).json({ message: `El préstamo está ${p.estado}: no se le agregan garantías.` });
    }
    const { error, datos } = validarGarantia(req.body);
    if (error) return res.status(400).json({ message: error });
    const [r] = await pool.query("INSERT INTO garantias SET ?", [
      { ...datos, id_prestamo: p.id_prestamo, registrada_por: req.usuario.id_usuario },
    ]);
    await bitacora(pool, p.id_usuario, "Garantía registrada", `Préstamo #${p.id_prestamo}: ${describir(datos)}`);
    res.status(201).json({ success: true, id_garantia: r.insertId, ...(await listarGarantias(pool, p.id_prestamo)) });
  } catch (error) {
    console.error("ERROR AL REGISTRAR GARANTÍA:", error);
    res.status(500).json({ message: "No se pudo registrar la garantía" });
  }
});

// Liberar una garantía (devolver el documento, cambiar de aval...). Queda el motivo.
router.post("/:id/liberar", soloPersonal, async (req, res) => {
  try {
    const motivo = String(req.body.motivo || "").trim().substring(0, 255);
    if (motivo.length < 5) return res.status(400).json({ message: "Escribe el motivo para liberar la garantía." });
    const [[g]] = await pool.query(
      `SELECT g.*, p.id_usuario FROM garantias g INNER JOIN prestamos p ON p.id_prestamo = g.id_prestamo WHERE g.id_garantia = ?`,
      [req.params.id]
    );
    if (!g) return res.status(404).json({ message: "Garantía no encontrada" });
    if (g.estado === "liberada") return res.status(400).json({ message: "Esa garantía ya está liberada." });
    await pool.query(
      `UPDATE garantias SET estado = 'liberada', motivo_liberacion = ?, liberada_en = NOW(), liberada_por = ? WHERE id_garantia = ?`,
      [motivo, req.usuario.id_usuario, g.id_garantia]
    );
    await bitacora(pool, g.id_usuario, "Garantía liberada", `Préstamo #${g.id_prestamo}: ${describir(g)}. Motivo: ${motivo}`);
    res.json({ success: true, ...(await listarGarantias(pool, g.id_prestamo)) });
  } catch (error) {
    console.error("ERROR AL LIBERAR GARANTÍA:", error);
    res.status(500).json({ message: "No se pudo liberar la garantía" });
  }
});

module.exports = router;
