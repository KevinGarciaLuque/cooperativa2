const express = require("express");
const router = express.Router();
const pool = require("../db");
const {
  DIAS_MES,
  soloFecha,
  hoyISO,
  diasEntre,
  calcularCuotaMensual,
  calcularDiasMora,
  calcularInteresMoratorio,
} = require("../utils/calculosPrestamo");

const sumarMeses = (fecha, meses) => {
  const [y, m, d] = fecha.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + meses, d)).toISOString().substring(0, 10);
};

const clasificar = (diasMora, diasParaVencer) => {
  if (diasMora > 90) return "mora_90_mas";
  if (diasMora > 60) return "mora_61_90";
  if (diasMora > 30) return "mora_31_60";
  if (diasMora > 0) return "mora_1_30";
  if (diasParaVencer <= 7) return "por_vencer";
  return "al_dia";
};

// ============================================
// CARTERA: préstamos vigentes clasificados por antigüedad
// GET /api/cobranza/cartera
// ============================================
router.get("/cartera", async (req, res) => {
  try {
    const [prestamos] = await pool.query(
      `SELECT p.id_prestamo, p.id_usuario, p.monto, p.saldo_restante, p.tasa_interes, p.plazo_meses,
              p.estado, p.fecha_otorgado,
              u.nombre_completo, u.dni, u.telefono, u.correo,
              (SELECT MAX(fecha_pago) FROM pagos_prestamo WHERE id_prestamo = p.id_prestamo) AS ultimo_pago,
              (SELECT nota FROM gestiones_cobro g WHERE g.id_prestamo = p.id_prestamo ORDER BY g.fecha DESC, g.id_gestion DESC LIMIT 1) AS ultima_nota,
              (SELECT fecha FROM gestiones_cobro g WHERE g.id_prestamo = p.id_prestamo ORDER BY g.fecha DESC, g.id_gestion DESC LIMIT 1) AS ultima_gestion,
              (SELECT promesa_fecha FROM gestiones_cobro g WHERE g.id_prestamo = p.id_prestamo AND g.promesa_fecha IS NOT NULL ORDER BY g.fecha DESC, g.id_gestion DESC LIMIT 1) AS promesa_fecha
       FROM prestamos p
       INNER JOIN usuarios u ON p.id_usuario = u.id_usuario
       WHERE p.estado IN ('activo', 'mora')`
    );

    const hoy = hoyISO();
    const filas = prestamos.map((p) => {
      const base = soloFecha(p.ultimo_pago) || soloFecha(p.fecha_otorgado) || hoy;
      const vencimiento = sumarMeses(base, 1);
      const diasParaVencer = diasEntre(hoy, vencimiento);
      const diasMora = calcularDiasMora(p.fecha_otorgado, p.ultimo_pago);
      const saldo = parseFloat(p.saldo_restante);
      const cuota = calcularCuotaMensual(
        parseFloat(p.monto),
        parseFloat(p.tasa_interes),
        parseInt(p.plazo_meses)
      );
      return {
        id_prestamo: p.id_prestamo,
        id_usuario: p.id_usuario,
        socio: p.nombre_completo,
        dni: p.dni,
        telefono: p.telefono,
        correo: p.correo,
        monto: parseFloat(p.monto),
        saldo,
        cuota: parseFloat(cuota.toFixed(2)),
        vencimiento,
        dias_para_vencer: diasParaVencer,
        dias_mora: diasMora,
        mora_generada: parseFloat(calcularInteresMoratorio(saldo, diasMora).toFixed(2)),
        categoria: clasificar(diasMora, diasParaVencer),
        ultima_gestion: p.ultima_gestion,
        ultima_nota: p.ultima_nota,
        promesa_fecha: soloFecha(p.promesa_fecha),
        promesa_vencida: p.promesa_fecha ? soloFecha(p.promesa_fecha) < hoy && diasMora > 0 : false,
      };
    });

    filas.sort((a, b) => b.dias_mora - a.dias_mora || a.dias_para_vencer - b.dias_para_vencer);

    const resumen = {};
    filas.forEach((f) => {
      if (!resumen[f.categoria]) resumen[f.categoria] = { cantidad: 0, saldo: 0, mora: 0 };
      resumen[f.categoria].cantidad += 1;
      resumen[f.categoria].saldo += f.saldo;
      resumen[f.categoria].mora += f.mora_generada;
    });

    res.json({ success: true, dias_mes: DIAS_MES, resumen, data: filas });
  } catch (error) {
    console.error("ERROR AL OBTENER CARTERA:", error);
    res.status(500).json({ message: "Error al obtener la cartera" });
  }
});

// ============================================
// GESTIONES (llamadas, visitas, promesas)
// ============================================
router.get("/gestiones/:id_prestamo", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT g.*, u.nombre_completo AS registrado_por
       FROM gestiones_cobro g LEFT JOIN usuarios u ON g.id_usuario = u.id_usuario
       WHERE g.id_prestamo = ? ORDER BY g.fecha DESC, g.id_gestion DESC LIMIT 50`,
      [req.params.id_prestamo]
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error("ERROR AL LISTAR GESTIONES:", error);
    res.status(500).json({ message: "Error al obtener las gestiones" });
  }
});

router.post("/gestiones", async (req, res) => {
  try {
    const { id_prestamo, medio, nota, promesa_fecha, promesa_monto } = req.body;
    if (!id_prestamo || !String(nota || "").trim()) {
      return res.status(400).json({ message: "Indica el préstamo y una nota de la gestión." });
    }
    const medios = ["llamada", "visita", "mensaje", "correo", "otro"];
    const medioFinal = medios.includes(medio) ? medio : "llamada";
    const fechaPromesa = /^\d{4}-\d{2}-\d{2}$/.test(promesa_fecha || "") ? promesa_fecha : null;
    const montoPromesa = promesa_monto ? parseFloat(promesa_monto) : null;

    const [existe] = await pool.query("SELECT id_prestamo, id_usuario FROM prestamos WHERE id_prestamo = ?", [id_prestamo]);
    if (!existe.length) return res.status(404).json({ message: "Préstamo no encontrado" });

    await pool.query(
      `INSERT INTO gestiones_cobro (id_prestamo, medio, nota, promesa_fecha, promesa_monto, id_usuario)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id_prestamo, medioFinal, String(nota).trim().substring(0, 500), fechaPromesa, montoPromesa, req.usuario?.id_usuario || null]
    );
    await pool.query(
      `INSERT INTO bitacora (id_usuario, accion, detalle, fecha) VALUES (?, ?, ?, NOW())`,
      [existe[0].id_usuario, "Gestión de cobranza", `Préstamo #${id_prestamo}: ${medioFinal}. ${String(nota).trim().substring(0, 150)}`]
    );
    res.status(201).json({ success: true, message: "Gestión registrada" });
  } catch (error) {
    console.error("ERROR AL REGISTRAR GESTIÓN:", error);
    res.status(500).json({ message: "Error al registrar la gestión" });
  }
});

module.exports = router;
