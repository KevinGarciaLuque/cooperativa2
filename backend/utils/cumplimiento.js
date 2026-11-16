// Prevención de lavado de dinero: alertas para que el oficial de cumplimiento las revise.
// Nunca bloquean la operación del socio.
//   - efectivo_umbral: un movimiento en efectivo igual o mayor al umbral
//   - fraccionamiento: depósitos en efectivo menores al umbral que en 30 días lo superan
//   - pep: operación de una persona expuesta políticamente por encima del 10% del umbral
// El umbral es el de Parámetros o, si está en 0, el del país (≈ US$10,000).
const config = require("./configFinanciera");
const pais = require("./pais");
const { dinero } = require("./pais");

const num = (v) => parseFloat(v || 0);

const umbral = () => num(config.obtener().aml_umbral) || num(pais.obtener().umbral_efectivo) || 10000;

const alertar = (conn, a) =>
  conn.query(
    `INSERT INTO alertas_cumplimiento (id_socio, tipo, monto, detalle, id_movimiento_caja) VALUES (?, ?, ?, ?, ?)`,
    [a.id_socio, a.tipo, a.monto, String(a.detalle).substring(0, 500), a.id_movimiento || null]
  );

// Se llama al registrar cada movimiento de caja con socio. Devuelve las alertas creadas.
const evaluarMovimiento = async (conn, mov, idMovimiento) => {
  if (!mov.id_socio) return [];
  const monto = Math.abs(num(mov.monto));
  const efectivo = String(mov.metodo || "efectivo").toLowerCase() === "efectivo";
  const limite = umbral();
  const creadas = [];
  const sentido = mov.tipo === "egreso" ? "salida" : "entrada";

  if (efectivo && monto >= limite) {
    await alertar(conn, {
      id_socio: mov.id_socio, tipo: "efectivo_umbral", monto, id_movimiento: idMovimiento,
      detalle: `${sentido === "entrada" ? "Ingreso" : "Salida"} en efectivo de ${dinero(monto)} (umbral ${dinero(limite)}): ${mov.descripcion || mov.categoria}`,
    });
    creadas.push("efectivo_umbral");
  } else if (efectivo && mov.tipo === "ingreso") {
    // Fraccionamiento: suma de ingresos en efectivo del socio en 30 días (una alerta por período)
    const [[s]] = await conn.query(
      `SELECT IFNULL(SUM(monto), 0) AS total, COUNT(*) AS n FROM caja_movimientos
       WHERE id_socio = ? AND tipo = 'ingreso' AND metodo = 'efectivo' AND fecha >= DATE_SUB(NOW(), INTERVAL 30 DAY)`,
      [mov.id_socio]
    );
    const [[ya]] = await conn.query(
      `SELECT COUNT(*) AS n FROM alertas_cumplimiento WHERE id_socio = ? AND tipo = 'fraccionamiento' AND fecha >= DATE_SUB(NOW(), INTERVAL 30 DAY)`,
      [mov.id_socio]
    );
    if (num(s.total) >= limite && s.n > 1 && !ya.n) {
      await alertar(conn, {
        id_socio: mov.id_socio, tipo: "fraccionamiento", monto: num(s.total), id_movimiento: idMovimiento,
        detalle: `${s.n} ingresos en efectivo en 30 días suman ${dinero(s.total)}, cada uno menor al umbral de ${dinero(limite)}`,
      });
      creadas.push("fraccionamiento");
    }
  }

  if (monto >= limite * 0.1) {
    const [[u]] = await conn.query("SELECT es_pep FROM usuarios WHERE id_usuario = ?", [mov.id_socio]);
    if (u?.es_pep) {
      await alertar(conn, {
        id_socio: mov.id_socio, tipo: "pep", monto, id_movimiento: idMovimiento,
        detalle: `Operación de persona expuesta políticamente: ${mov.descripcion || mov.categoria} (${dinero(monto)})`,
      });
      creadas.push("pep");
    }
  }
  return creadas;
};

module.exports = { umbral, evaluarMovimiento };
