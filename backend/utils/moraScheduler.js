// Mantiene al día el estado "mora" de los préstamos con la misma regla que se
// usa al cobrar: pasados los días de gracia desde el último pago.
const cron = require("node-cron");
const pool = require("../db");
const { calcularDiasMora } = require("./calculosPrestamo");

const actualizarEstadosMora = async () => {
  const [prestamos] = await pool.query(
    `SELECT p.id_prestamo, p.id_usuario, p.estado, p.fecha_otorgado,
            (SELECT MAX(fecha_pago) FROM pagos_prestamo WHERE id_prestamo = p.id_prestamo) AS ultimo_pago
     FROM prestamos p
     WHERE p.estado IN ('activo', 'mora')`
  );

  const entraron = [];
  const salieron = [];

  for (const p of prestamos) {
    const dias = calcularDiasMora(p.fecha_otorgado, p.ultimo_pago);
    if (dias > 0 && p.estado === "activo") {
      await pool.query(`UPDATE prestamos SET estado = 'mora' WHERE id_prestamo = ?`, [p.id_prestamo]);
      await pool.query(
        `INSERT INTO bitacora (id_usuario, accion, detalle, fecha) VALUES (?, ?, ?, NOW())`,
        [p.id_usuario, "Préstamo en mora", `Préstamo #${p.id_prestamo} pasó a mora (${dias} días de atraso)`]
      );
      entraron.push({ id_prestamo: p.id_prestamo, id_usuario: p.id_usuario, dias_mora: dias });
    } else if (dias === 0 && p.estado === "mora") {
      await pool.query(`UPDATE prestamos SET estado = 'activo' WHERE id_prestamo = ?`, [p.id_prestamo]);
      salieron.push({ id_prestamo: p.id_prestamo });
    }
  }

  return { entraron, salieron };
};

const iniciarMoraScheduler = () => {
  // Todos los días a las 01:00
  cron.schedule("0 1 * * *", async () => {
    try {
      const r = await actualizarEstadosMora();
      console.log(`⏰ Verificación de mora: ${r.entraron.length} nuevos en mora, ${r.salieron.length} regularizados`);
    } catch (error) {
      console.error("Error en la verificación automática de mora:", error.message);
    }
  });

  // También al arrancar el servidor
  setTimeout(() => {
    actualizarEstadosMora().catch((e) => console.error("Error en verificación inicial de mora:", e.message));
  }, 15 * 1000).unref();
};

module.exports = { actualizarEstadosMora, iniciarMoraScheduler };
