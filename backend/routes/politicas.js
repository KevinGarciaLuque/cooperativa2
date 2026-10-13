// Políticas de la cooperativa: el Super Administrador las redacta y publica; el socio las lee
// y las acepta. Cada publicación es una versión; si el cambio es importante se pide aceptarla de nuevo.
const express = require("express");
const router = express.Router();
const pool = require("../db");
const { publicadas, estadoDe, aceptar, completarTexto } = require("../utils/politicas");

const SUPER_ADMIN = "Super Administrador";
const esSocio = (req) => req.usuario?.rol === "Socio";
const texto = (v, max) => String(v ?? "").trim().substring(0, max);

const soloSuperAdmin = (req, res, next) =>
  req.usuario?.rol === SUPER_ADMIN
    ? next()
    : res.status(403).json({ message: "Solo el Super Administrador administra las políticas." });

const soloPersonal = (req, res, next) =>
  esSocio(req) ? res.status(403).json({ message: "No tienes permiso para realizar esta acción." }) : next();

const bitacora = (idUsuario, detalle) =>
  pool
    .query("INSERT INTO bitacora (id_usuario, accion, detalle, fecha) VALUES (?, 'Políticas', ?, NOW())", [idUsuario, detalle])
    .catch(() => {});

// GET /api/politicas/publicas  → lo publicado (sin sesión: para el formulario de registro)
router.get("/publicas", async (req, res) => {
  try {
    const lista = await publicadas();
    res.json({ success: true, data: lista.map(({ id_politica, titulo, contenido, version, publicada_en, obligatoria }) => ({ id_politica, titulo, contenido, version, publicada_en, obligatoria })) });
  } catch (error) {
    console.error("ERROR AL LISTAR POLÍTICAS PUBLICADAS:", error);
    res.status(500).json({ message: "No se pudieron cargar las políticas" });
  }
});

// GET /api/politicas/mias  → lo publicado y qué le falta aceptar a quien tiene la sesión
router.get("/mias", async (req, res) => {
  try {
    const lista = await estadoDe(req.usuario.id_usuario);
    res.json({ success: true, data: lista, pendientes: lista.filter((p) => p.pendiente).length });
  } catch (error) {
    console.error("ERROR AL LEER POLÍTICAS DEL USUARIO:", error);
    res.status(500).json({ message: "No se pudieron cargar las políticas" });
  }
});

// POST /api/politicas/aceptar  { ids? }  → acepta la versión vigente (de todas si no se indican)
router.post("/aceptar", async (req, res) => {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.map((n) => parseInt(n)).filter(Boolean) : null;
    const n = await aceptar(req.usuario.id_usuario, req.ip, ids);
    if (n) bitacora(req.usuario.id_usuario, `Aceptó ${n} política(s) de la cooperativa`);
    const lista = await estadoDe(req.usuario.id_usuario);
    res.json({ success: true, data: lista, pendientes: lista.filter((p) => p.pendiente).length });
  } catch (error) {
    console.error("ERROR AL ACEPTAR POLÍTICAS:", error);
    res.status(500).json({ message: "No se pudo registrar la aceptación" });
  }
});

// GET /api/politicas/socio/:id  → qué aceptó un socio y cuándo (expediente en Ventanilla)
router.get("/socio/:id(\\d+)", soloPersonal, async (req, res) => {
  try {
    res.json({ success: true, data: await estadoDe(parseInt(req.params.id)) });
  } catch (error) {
    res.status(500).json({ message: "No se pudieron cargar las políticas del socio" });
  }
});

// ── Administración (Super Administrador) ─────────────────────────────────

// Socios activos que ya aceptaron la versión vigente de cada política
const conteoAceptaciones = async () => {
  const [[t]] = await pool.query(
    `SELECT COUNT(*) AS n FROM usuarios u INNER JOIN roles r ON u.rol_id = r.id_rol
     WHERE r.nombre = 'Socio' AND u.estado = 'activo'`
  );
  const [rows] = await pool.query(
    `SELECT p.id_politica, COUNT(DISTINCT a.id_usuario) AS n
     FROM politicas p
     INNER JOIN politicas_aceptaciones a ON a.id_politica = p.id_politica AND a.version >= p.version_requerida
     INNER JOIN usuarios u ON a.id_usuario = u.id_usuario AND u.estado = 'activo'
     INNER JOIN roles r ON u.rol_id = r.id_rol AND r.nombre = 'Socio'
     GROUP BY p.id_politica`
  );
  return { total: t.n, porPolitica: Object.fromEntries(rows.map((r) => [r.id_politica, r.n])) };
};

// GET /api/politicas  → todas, con su borrador, versión publicada y cuántos socios la aceptaron
router.get("/", soloSuperAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT p.*, v.titulo AS titulo_publicado, v.contenido AS contenido_publicado, v.publicada_en
       FROM politicas p
       LEFT JOIN politicas_versiones v ON v.id_politica = p.id_politica AND v.version = p.version
       WHERE p.activa = 1
       ORDER BY p.orden, p.id_politica`
    );
    const conteo = await conteoAceptaciones();
    res.json({
      success: true,
      socios_activos: conteo.total,
      data: rows.map((p) => ({
        id_politica: p.id_politica,
        titulo: p.titulo,
        contenido: p.contenido,
        obligatoria: !!p.obligatoria,
        orden: p.orden,
        version: p.version,
        version_requerida: p.version_requerida,
        publicada_en: p.publicada_en,
        cambios_sin_publicar: p.version === 0 || p.titulo !== p.titulo_publicado || p.contenido !== p.contenido_publicado,
        aceptaron: p.version > 0 ? conteo.porPolitica[p.id_politica] || 0 : 0,
        actualizado_en: p.actualizado_en,
      })),
    });
  } catch (error) {
    console.error("ERROR AL LISTAR POLÍTICAS:", error);
    res.status(500).json({ message: "No se pudieron cargar las políticas" });
  }
});

// POST /api/politicas/vista-previa { contenido }  → el texto con las variables llenas
router.post("/vista-previa", soloSuperAdmin, async (req, res) => {
  res.json({ success: true, contenido: await completarTexto(texto(req.body?.contenido, 200000)) });
});

// POST /api/politicas  { titulo, contenido }  → nueva política (queda como borrador)
router.post("/", soloSuperAdmin, async (req, res) => {
  try {
    const titulo = texto(req.body?.titulo, 150);
    const contenido = texto(req.body?.contenido, 200000);
    if (titulo.length < 3) return res.status(400).json({ message: "Escribe el título de la política." });
    const [[o]] = await pool.query("SELECT COALESCE(MAX(orden), 0) + 1 AS n FROM politicas");
    const [r] = await pool.query(
      "INSERT INTO politicas (titulo, contenido, obligatoria, orden, actualizado_por) VALUES (?, ?, ?, ?, ?)",
      [titulo, contenido, req.body?.obligatoria === false ? 0 : 1, o.n, req.usuario.id_usuario]
    );
    bitacora(req.usuario.id_usuario, `Creó la política "${titulo}" (borrador)`);
    res.status(201).json({ success: true, id_politica: r.insertId });
  } catch (error) {
    console.error("ERROR AL CREAR POLÍTICA:", error);
    res.status(500).json({ message: "No se pudo crear la política" });
  }
});

// PUT /api/politicas/:id  { titulo, contenido, obligatoria }  → guarda el borrador (no cambia lo publicado)
router.put("/:id(\\d+)", soloSuperAdmin, async (req, res) => {
  try {
    const titulo = texto(req.body?.titulo, 150);
    const contenido = texto(req.body?.contenido, 200000);
    if (titulo.length < 3) return res.status(400).json({ message: "Escribe el título de la política." });
    const [r] = await pool.query(
      `UPDATE politicas SET titulo = ?, contenido = ?, obligatoria = ?, actualizado_por = ?
       WHERE id_politica = ? AND activa = 1`,
      [titulo, contenido, req.body?.obligatoria === false ? 0 : 1, req.usuario.id_usuario, req.params.id]
    );
    if (!r.affectedRows) return res.status(404).json({ message: "Política no encontrada" });
    res.json({ success: true, message: "Borrador guardado." });
  } catch (error) {
    console.error("ERROR AL GUARDAR POLÍTICA:", error);
    res.status(500).json({ message: "No se pudo guardar la política" });
  }
});

// POST /api/politicas/:id/publicar  { pedir_aceptacion }  → publica el borrador como nueva versión.
// La primera publicación siempre pide aceptación; después, solo si el cambio es importante.
router.post("/:id(\\d+)/publicar", soloSuperAdmin, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [[p]] = await conn.query("SELECT * FROM politicas WHERE id_politica = ? AND activa = 1 FOR UPDATE", [req.params.id]);
    if (!p) {
      await conn.rollback();
      return res.status(404).json({ message: "Política no encontrada" });
    }
    if (String(p.contenido).trim().length < 20) {
      await conn.rollback();
      return res.status(400).json({ message: "El texto de la política está vacío o es muy corto." });
    }
    const version = p.version + 1;
    const pedir = p.version === 0 || req.body?.pedir_aceptacion !== false;
    await conn.query(
      "INSERT INTO politicas_versiones (id_politica, version, titulo, contenido, publicada_por) VALUES (?, ?, ?, ?, ?)",
      [p.id_politica, version, p.titulo, p.contenido, req.usuario.id_usuario]
    );
    await conn.query("UPDATE politicas SET version = ?, version_requerida = ? WHERE id_politica = ?", [
      version,
      pedir ? version : p.version_requerida,
      p.id_politica,
    ]);

    // Aviso en la campanita de los socios activos cuando deben leerla y aceptarla
    if (pedir && p.obligatoria) {
      await conn.query(
        `INSERT INTO notificaciones (id_usuario, tipo, titulo, mensaje)
         SELECT u.id_usuario, 'aviso', ?, ?
         FROM usuarios u INNER JOIN roles r ON u.rol_id = r.id_rol
         WHERE r.nombre = 'Socio' AND u.estado = 'activo'`,
        [
          (p.version === 0 ? "Nueva política: " : "Actualizamos: ").concat(p.titulo).substring(0, 150),
          "Léela y acéptala en la pestaña Políticas de tu perfil.",
        ]
      );
    }
    await conn.commit();
    bitacora(
      req.usuario.id_usuario,
      `Publicó la versión ${version} de "${p.titulo}"${pedir ? " (los socios deben aceptarla)" : " (cambio menor)"}`
    );
    res.json({ success: true, version, pide_aceptacion: pedir, message: `Versión ${version} publicada.` });
  } catch (error) {
    await conn.rollback().catch(() => {});
    console.error("ERROR AL PUBLICAR POLÍTICA:", error);
    res.status(500).json({ message: "No se pudo publicar la política" });
  } finally {
    conn.release();
  }
});

// DELETE /api/politicas/:id  → la retira (deja de mostrarse; se conserva su historial)
router.delete("/:id(\\d+)", soloSuperAdmin, async (req, res) => {
  try {
    const [r] = await pool.query("UPDATE politicas SET activa = 0 WHERE id_politica = ?", [req.params.id]);
    if (!r.affectedRows) return res.status(404).json({ message: "Política no encontrada" });
    bitacora(req.usuario.id_usuario, `Retiró la política #${req.params.id}`);
    res.json({ success: true, message: "Política retirada." });
  } catch (error) {
    res.status(500).json({ message: "No se pudo retirar la política" });
  }
});

// GET /api/politicas/:id/aceptaciones  → socios activos que la aceptaron y los que faltan
router.get("/:id(\\d+)/aceptaciones", soloSuperAdmin, async (req, res) => {
  try {
    const [[p]] = await pool.query("SELECT version_requerida FROM politicas WHERE id_politica = ?", [req.params.id]);
    if (!p) return res.status(404).json({ message: "Política no encontrada" });
    const [rows] = await pool.query(
      `SELECT u.id_usuario, u.nombre_completo, u.dni,
              MAX(a.version) AS version, MAX(a.aceptada_en) AS aceptada_en
       FROM usuarios u
       INNER JOIN roles r ON u.rol_id = r.id_rol AND r.nombre = 'Socio'
       LEFT JOIN politicas_aceptaciones a ON a.id_usuario = u.id_usuario AND a.id_politica = ? AND a.version >= ?
       WHERE u.estado = 'activo'
       GROUP BY u.id_usuario, u.nombre_completo, u.dni
       ORDER BY aceptada_en IS NULL DESC, u.nombre_completo`,
      [req.params.id, p.version_requerida]
    );
    res.json({ success: true, data: rows.map((r) => ({ ...r, aceptada: !!r.aceptada_en })) });
  } catch (error) {
    console.error("ERROR AL LISTAR ACEPTACIONES:", error);
    res.status(500).json({ message: "No se pudo cargar la lista" });
  }
});

module.exports = router;
