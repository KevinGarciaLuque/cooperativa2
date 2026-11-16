// Productos de crédito. Los consulta el personal (para otorgar préstamos); solo el Super
// Administrador los crea o cambia. No se borran: se desactivan, porque los préstamos que ya
// se otorgaron con ellos siguen apuntándoles.
const express = require("express");
const router = express.Router();
const pool = require("../db");
const { GARANTIAS, listarProductos, obtenerProducto, validarProducto } = require("../utils/productos");

const soloSuperAdmin = (req, res, next) =>
  req.usuario?.rol === "Super Administrador"
    ? next()
    : res.status(403).json({ message: "Solo el Super Administrador puede cambiar los productos de crédito." });

router.get("/", async (req, res) => {
  try {
    const productos = await listarProductos({ soloActivos: req.query.activos === "1" });
    // Cuántos préstamos vigentes tiene cada uno (para saber qué se afecta al cambiarlo)
    const [uso] = await pool.query(
      `SELECT id_producto, COUNT(*) AS n FROM prestamos
       WHERE id_producto IS NOT NULL AND estado IN ('pendiente','aprobado','activo','mora') GROUP BY id_producto`
    );
    const vigentes = Object.fromEntries(uso.map((u) => [u.id_producto, u.n]));
    res.json({
      success: true,
      garantias: GARANTIAS,
      data: productos.map((p) => ({ ...p, prestamos_vigentes: vigentes[p.id_producto] || 0 })),
    });
  } catch (error) {
    console.error("ERROR AL LISTAR PRODUCTOS:", error);
    res.status(500).json({ message: "No se pudieron cargar los productos de crédito" });
  }
});

router.post("/", soloSuperAdmin, async (req, res) => {
  try {
    const { error, datos } = validarProducto(req.body);
    if (error) return res.status(400).json({ message: error });
    const [r] = await pool.query("INSERT INTO productos_credito SET ?", [datos]);
    await pool.query(`INSERT INTO bitacora (id_usuario, accion, detalle, fecha) VALUES (?, ?, ?, NOW())`, [
      req.usuario.id_usuario,
      "Producto de crédito creado",
      `${datos.nombre}: ${datos.tasa_mensual}% mensual, ${datos.plazo_min}-${datos.plazo_max} meses`,
    ]);
    res.status(201).json({ success: true, data: await obtenerProducto(r.insertId) });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") return res.status(409).json({ message: "Ya existe un producto con ese nombre." });
    console.error("ERROR AL CREAR PRODUCTO:", error);
    res.status(500).json({ message: "No se pudo crear el producto" });
  }
});

// Cambiar un producto solo afecta a los préstamos nuevos: los ya otorgados guardan su tasa y plazo
router.put("/:id", soloSuperAdmin, async (req, res) => {
  try {
    const actual = await obtenerProducto(req.params.id);
    if (!actual) return res.status(404).json({ message: "Producto no encontrado" });
    const { error, datos } = validarProducto({ ...actual, ...req.body });
    if (error) return res.status(400).json({ message: error });
    await pool.query("UPDATE productos_credito SET ?, actualizado_en = NOW() WHERE id_producto = ?", [datos, req.params.id]);
    await pool.query(`INSERT INTO bitacora (id_usuario, accion, detalle, fecha) VALUES (?, ?, ?, NOW())`, [
      req.usuario.id_usuario,
      "Producto de crédito modificado",
      `${datos.nombre}${datos.activo ? "" : " (desactivado)"}: ${datos.tasa_mensual}% mensual, ${datos.plazo_min}-${datos.plazo_max} meses`,
    ]);
    res.json({ success: true, data: await obtenerProducto(req.params.id) });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") return res.status(409).json({ message: "Ya existe un producto con ese nombre." });
    console.error("ERROR AL MODIFICAR PRODUCTO:", error);
    res.status(500).json({ message: "No se pudo modificar el producto" });
  }
});

module.exports = router;
