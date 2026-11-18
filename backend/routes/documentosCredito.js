// Contrato y pagaré en Word (función "contratos_word", la enciende el Super Administrador).
const express = require("express");
const router = express.Router();
const multer = require("multer");
const pool = require("../db");
const { habilitada } = require("../utils/funciones");
const { guardarArchivo, eliminarArchivo } = require("../utils/archivos");
const docs = require("../utils/documentosCredito");

const subida = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

router.use(async (req, res, next) => {
  if (await habilitada("contratos_word", req.usuario)) return next();
  res.status(403).json({ message: "El contrato y pagaré en Word no están habilitados." });
});

const enviar = (res, nombre, buffer) => {
  res.setHeader("Content-Type", DOCX);
  res.setHeader("Content-Disposition", `attachment; filename="${nombre}"`);
  res.send(buffer);
};

// GET /api/documentos-credito/prestamos/:id/:tipo  (tipo: contrato | pagare)
router.get("/prestamos/:id(\\d+)/:tipo(contrato|pagare)", async (req, res) => {
  try {
    const datos = await docs.datosDocumento(parseInt(req.params.id), req.usuario);
    if (!datos) return res.status(404).json({ message: "Préstamo no encontrado" });
    const { buffer } = await docs.plantilla(req.params.tipo);
    const archivo = docs.llenar(buffer, datos);
    await pool.query("INSERT INTO bitacora (id_usuario, accion, detalle, fecha) VALUES (?, ?, ?, NOW())", [
      req.usuario.id_usuario,
      "Documento de crédito",
      `${docs.TIPOS[req.params.tipo]} del préstamo #${req.params.id}`,
    ]);
    enviar(res, `${req.params.tipo}_prestamo_${req.params.id}.docx`, archivo);
  } catch (e) {
    if (e.codigo) return res.status(e.codigo).json({ message: e.message });
    console.error("ERROR AL GENERAR DOCUMENTO:", e);
    res.status(500).json({ message: "No se pudo generar el documento" });
  }
});

// GET /api/documentos-credito/socios/:id/ficha → ficha de inscripción del socio
router.get("/socios/:id(\\d+)/ficha", async (req, res) => {
  try {
    const datos = await docs.datosFicha(parseInt(req.params.id));
    if (!datos) return res.status(404).json({ message: "Socio no encontrado" });
    const { buffer } = await docs.plantilla("ficha_socio");
    enviar(res, `ficha_socio_${req.params.id}.docx`, docs.llenar(buffer, datos));
  } catch (e) {
    if (e.codigo) return res.status(e.codigo).json({ message: e.message });
    console.error("ERROR AL GENERAR FICHA:", e);
    res.status(500).json({ message: "No se pudo generar la ficha" });
  }
});

// GET /api/documentos-credito/plantillas → cuáles hay y los marcadores disponibles
router.get("/plantillas", async (req, res) => {
  const lista = [];
  for (const tipo of Object.keys(docs.TIPOS)) {
    const { personalizada } = await docs.plantilla(tipo);
    lista.push({ tipo, nombre: docs.TIPOS[tipo], personalizada });
  }
  res.json({ success: true, data: lista, campos: docs.CAMPOS, campos_ficha: docs.CAMPOS_FICHA });
});

// GET /api/documentos-credito/plantillas/:tipo → la plantilla actual (para editarla en Word)
router.get("/plantillas/:tipo(contrato|pagare|ficha_socio)", async (req, res) => {
  const { buffer } = await docs.plantilla(req.params.tipo);
  enviar(res, `plantilla_${req.params.tipo}.docx`, buffer);
});

const soloSuper = (req, res, next) =>
  req.usuario?.rol === "Super Administrador" ? next() : res.status(403).json({ message: "Solo el Super Administrador cambia las plantillas." });

// PUT /api/documentos-credito/plantillas/:tipo  (archivo .docx en "plantilla")
router.put("/plantillas/:tipo(contrato|pagare|ficha_socio)", soloSuper, subida.single("plantilla"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "Sube el archivo de Word (.docx)." });
    if (!/\.docx$/i.test(req.file.originalname || "")) return res.status(400).json({ message: "La plantilla debe ser un archivo .docx." });
    // Se prueba con datos de ejemplo antes de guardarla
    let ejemplo;
    if (req.params.tipo === "ficha_socio") {
      const [[s]] = await pool.query("SELECT id_usuario FROM usuarios ORDER BY id_usuario DESC LIMIT 1");
      ejemplo = (s && (await docs.datosFicha(s.id_usuario))) || { beneficiarios: [] };
    } else {
      const [[uno]] = await pool.query("SELECT id_prestamo FROM prestamos ORDER BY id_prestamo DESC LIMIT 1");
      ejemplo = uno ? await docs.datosDocumento(uno.id_prestamo, req.usuario) : { cuotas: [], garantias: [] };
    }
    docs.llenar(req.file.buffer, ejemplo);
    await guardarArchivo(docs.rutaPersonalizada(req.params.tipo), DOCX, req.file.buffer);
    await pool.query("INSERT INTO bitacora (id_usuario, accion, detalle, fecha) VALUES (?, ?, ?, NOW())", [
      req.usuario.id_usuario,
      "Plantilla de documento",
      `Nueva plantilla de ${docs.TIPOS[req.params.tipo]}`,
    ]);
    res.json({ success: true, message: "Plantilla guardada." });
  } catch (e) {
    if (e.codigo) return res.status(e.codigo).json({ message: e.message });
    console.error("ERROR AL GUARDAR PLANTILLA:", e);
    res.status(500).json({ message: "No se pudo guardar la plantilla" });
  }
});

// DELETE /api/documentos-credito/plantillas/:tipo → vuelve a la plantilla original
router.delete("/plantillas/:tipo(contrato|pagare|ficha_socio)", soloSuper, async (req, res) => {
  await eliminarArchivo(docs.rutaPersonalizada(req.params.tipo));
  res.json({ success: true, message: "Se usará la plantilla original." });
});

module.exports = router;
