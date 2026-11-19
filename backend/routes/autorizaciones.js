// Autorizaciones de un superior (con "Permisos por acción"): operaciones que un rol hace por
// encima de su límite de monto, acciones marcadas "con autorización" y omitir la mora.
// Quedan pendientes hasta que un superior las autoriza; al autorizar, la operación se ejecuta
// tal como se pidió, a nombre de quien la pidió, y queda registrado quién autorizó.
//
// Pueden autorizar: el Super Administrador, el Administrador (salvo que se le quite) y los roles
// con la acción "Autorizar operaciones de otros". Nadie autoriza lo suyo.
const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const pool = require("../db");
const { datosDelRol } = require("../utils/acciones");

const ESTADOS = ["pendiente", "ejecutada", "fallida", "rechazada", "cancelada"];

const puedeResolver = async (u) => {
  if (u.rol === "Super Administrador") return true;
  const rol = await datosDelRol(u.rol_id);
  if (rol.solo_lectura) return false;
  const v = rol.acciones["autorizaciones.resolver"];
  return v === true || (u.rol === "Administrador" && v !== false);
};

router.use((req, res, next) => {
  if (!req.usuario || req.usuario.rol === "Socio") return res.status(403).json({ message: "Solo para el personal." });
  next();
});

// GET /api/autorizaciones?estado=pendiente → quien autoriza ve todas; los demás, las suyas
router.get("/", async (req, res) => {
  try {
    const resolver = await puedeResolver(req.usuario);
    const w = [];
    const p = [];
    if (ESTADOS.includes(req.query.estado)) {
      w.push(req.query.estado === "pendiente" ? "a.estado IN ('pendiente','aprobada','ejecutando')" : "a.estado = ?");
      if (req.query.estado !== "pendiente") p.push(req.query.estado);
    }
    if (!resolver || req.query.mias === "1") {
      w.push("a.solicitado_por = ?");
      p.push(req.usuario.id_usuario);
    }
    const [filas] = await pool.query(
      `SELECT a.id_autorizacion, a.accion, a.motivo, a.descripcion, a.monto, a.estado, a.justificacion, a.nota, a.resultado,
              a.creada_en, a.resuelto_en, a.solicitado_por, s.nombre_completo AS solicitante, r.nombre_completo AS resolvio
       FROM autorizaciones a
       JOIN usuarios s ON s.id_usuario = a.solicitado_por
       LEFT JOIN usuarios r ON r.id_usuario = a.resuelto_por
       ${w.length ? `WHERE ${w.join(" AND ")}` : ""}
       ORDER BY a.estado = 'pendiente' DESC, a.creada_en DESC LIMIT 200`,
      p
    );
    res.json({
      success: true,
      puede_resolver: resolver,
      data: filas.map((f) => ({ ...f, monto: f.monto === null ? null : parseFloat(f.monto), propia: f.solicitado_por === req.usuario.id_usuario })),
    });
  } catch (error) {
    console.error("ERROR AL LISTAR AUTORIZACIONES:", error);
    res.status(500).json({ message: "No se pudieron cargar las autorizaciones" });
  }
});

// POST /api/autorizaciones/:id/aprobar { nota } → autoriza y ejecuta la operación
router.post("/:id/aprobar", async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    if (!(await puedeResolver(req.usuario))) return res.status(403).json({ message: "Tu rol no puede autorizar operaciones." });
    const [[a]] = await pool.query("SELECT * FROM autorizaciones WHERE id_autorizacion = ?", [id]);
    if (!a) return res.status(404).json({ message: "Solicitud no encontrada." });
    if (a.solicitado_por === req.usuario.id_usuario) return res.status(403).json({ message: "No puedes autorizar una operación que pediste tú." });
    const [cambio] = await pool.query(
      "UPDATE autorizaciones SET estado = 'aprobada', resuelto_por = ?, resuelto_en = NOW(), nota = ? WHERE id_autorizacion = ? AND estado = 'pendiente'",
      [req.usuario.id_usuario, String(req.body?.nota || "").trim().substring(0, 300) || null, id]
    );
    if (!cambio.affectedRows) return res.status(400).json({ message: `La solicitud ya está ${a.estado}.` });

    // Se ejecuta tal como se pidió, a nombre de quien la pidió (con su rol y permisos)
    const [[s]] = await pool.query(
      "SELECT u.id_usuario, u.nombre_completo, u.rol_id, r.nombre AS rol FROM usuarios u JOIN roles r ON r.id_rol = u.rol_id WHERE u.id_usuario = ?",
      [a.solicitado_por]
    );
    let estado = "fallida";
    let resultado = "Quien la pidió ya no existe.";
    let cuerpo = null;
    if (s) {
      const token = jwt.sign({ id_usuario: s.id_usuario, rol: s.rol, rol_id: s.rol_id, nombre_completo: s.nombre_completo }, process.env.JWT_SECRET, { expiresIn: "2m" });
      const r = await fetch(`http://127.0.0.1:${req.socket.localPort}/api${a.ruta}`, {
        method: a.metodo,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, "X-Autorizacion": String(id) },
        body: ["GET", "HEAD"].includes(a.metodo) ? undefined : a.cuerpo || "{}",
      });
      cuerpo = await r.json().catch(() => null);
      estado = r.status < 300 ? "ejecutada" : "fallida";
      resultado = String(cuerpo?.message || (estado === "ejecutada" ? "Operación aplicada." : `Error ${r.status}`)).substring(0, 500);
    }
    await pool.query("UPDATE autorizaciones SET estado = ?, resultado = ? WHERE id_autorizacion = ?", [estado, resultado, id]);
    await pool.query("INSERT INTO bitacora (id_usuario, accion, detalle, fecha) VALUES (?, ?, ?, NOW())", [
      req.usuario.id_usuario,
      "Autorización",
      `Autorizó la solicitud #${id} de ${s?.nombre_completo || "—"} (${a.descripcion}): ${resultado}`,
    ]);
    res.status(estado === "ejecutada" ? 200 : 409).json({
      success: estado === "ejecutada",
      estado,
      message: estado === "ejecutada" ? `Autorizada y aplicada. ${resultado}` : `Se autorizó, pero no se pudo aplicar: ${resultado}`,
      resultado: cuerpo,
    });
  } catch (error) {
    await pool.query("UPDATE autorizaciones SET estado = 'fallida', resultado = ? WHERE id_autorizacion = ? AND estado IN ('aprobada','ejecutando')", [
      String(error.message).substring(0, 500),
      id,
    ]).catch(() => {});
    console.error("ERROR AL AUTORIZAR:", error);
    res.status(500).json({ message: "No se pudo autorizar la operación" });
  }
});

// POST /api/autorizaciones/:id/rechazar { nota }
router.post("/:id/rechazar", async (req, res) => {
  try {
    if (!(await puedeResolver(req.usuario))) return res.status(403).json({ message: "Tu rol no puede resolver autorizaciones." });
    const nota = String(req.body?.nota || "").trim();
    if (!nota) return res.status(400).json({ message: "Escribe el motivo del rechazo." });
    const [r] = await pool.query(
      "UPDATE autorizaciones SET estado = 'rechazada', resuelto_por = ?, resuelto_en = NOW(), nota = ? WHERE id_autorizacion = ? AND estado = 'pendiente' AND solicitado_por <> ?",
      [req.usuario.id_usuario, nota.substring(0, 300), parseInt(req.params.id), req.usuario.id_usuario]
    );
    if (!r.affectedRows) return res.status(400).json({ message: "La solicitud ya no está pendiente o es tuya." });
    res.json({ success: true, message: "Solicitud rechazada." });
  } catch (error) {
    console.error("ERROR AL RECHAZAR AUTORIZACIÓN:", error);
    res.status(500).json({ message: "No se pudo rechazar" });
  }
});

// POST /api/autorizaciones/:id/cancelar → quien la pidió la retira
router.post("/:id/cancelar", async (req, res) => {
  try {
    const [r] = await pool.query(
      "UPDATE autorizaciones SET estado = 'cancelada', resuelto_en = NOW() WHERE id_autorizacion = ? AND estado = 'pendiente' AND solicitado_por = ?",
      [parseInt(req.params.id), req.usuario.id_usuario]
    );
    if (!r.affectedRows) return res.status(400).json({ message: "Solo puedes retirar una solicitud tuya que siga pendiente." });
    res.json({ success: true, message: "Solicitud retirada." });
  } catch (error) {
    res.status(500).json({ message: "No se pudo retirar la solicitud" });
  }
});

module.exports = { router, puedeResolver };
