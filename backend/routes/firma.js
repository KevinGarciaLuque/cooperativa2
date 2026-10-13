// Firma digital de quien tiene la sesión. El personal la usa en los documentos que emite
// o aprueba; el socio, para firmar sus recibos y comprobantes desde la app.
const express = require("express");
const router = express.Router();
const multer = require("multer");
const pool = require("../db");
const { firmaDataUrl } = require("../utils/firmas");

const subida = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 1024 * 1024 },
  fileFilter: (req, file, cb) => (file.mimetype === "image/png" ? cb(null, true) : cb(new Error("FORMATO"))),
});

// GET /api/firma/mia → { imagen: dataURL | null }
router.get("/mia", async (req, res) => {
  try {
    res.json({ success: true, imagen: await firmaDataUrl(req.usuario.id_usuario) });
  } catch (error) {
    console.error("ERROR AL LEER FIRMA:", error);
    res.status(500).json({ message: "No se pudo cargar la firma" });
  }
});

// PUT /api/firma/mia  (campo "firma", PNG)
router.put("/mia", (req, res) => {
  subida.single("firma")(req, res, async (err) => {
    if (err) {
      const mensaje =
        err.message === "FORMATO"
          ? "La firma debe ser una imagen PNG."
          : err.code === "LIMIT_FILE_SIZE"
          ? "La imagen de la firma es muy grande."
          : "No se pudo recibir la firma.";
      return res.status(400).json({ message: mensaje });
    }
    try {
      if (!req.file) return res.status(400).json({ message: "Dibuja tu firma antes de guardarla." });
      await pool.query(
        `INSERT INTO firmas_usuario (id_usuario, mime, contenido) VALUES (?, 'image/png', ?)
         ON DUPLICATE KEY UPDATE contenido = VALUES(contenido), mime = VALUES(mime)`,
        [req.usuario.id_usuario, req.file.buffer]
      );
      await pool.query(
        `INSERT INTO bitacora (id_usuario, accion, detalle, fecha) VALUES (?, ?, ?, NOW())`,
        [req.usuario.id_usuario, "Firma digital", "Se guardó la firma digital del usuario"]
      );
      res.json({ success: true, message: "Firma guardada.", imagen: await firmaDataUrl(req.usuario.id_usuario) });
    } catch (error) {
      console.error("ERROR AL GUARDAR FIRMA:", error);
      res.status(500).json({ message: "No se pudo guardar la firma" });
    }
  });
});

router.delete("/mia", async (req, res) => {
  try {
    await pool.query("DELETE FROM firmas_usuario WHERE id_usuario = ?", [req.usuario.id_usuario]);
    await pool.query(
      `INSERT INTO bitacora (id_usuario, accion, detalle, fecha) VALUES (?, ?, ?, NOW())`,
      [req.usuario.id_usuario, "Firma digital", "Se eliminó la firma digital del usuario"]
    );
    res.json({ success: true, message: "Firma eliminada." });
  } catch (error) {
    console.error("ERROR AL ELIMINAR FIRMA:", error);
    res.status(500).json({ message: "No se pudo eliminar la firma" });
  }
});

module.exports = router;
