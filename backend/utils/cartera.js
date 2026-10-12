// Cartera de préstamos vigentes clasificada por antigüedad de atraso.
// La usan Cobranza y Contabilidad para que ambas muestren las mismas cifras.
const pool = require("../db");
const config = require("./configFinanciera");
const {
  soloFecha,
  hoyISO,
  diasEntre,
  calcularCuotaMensual,
  calcularDiasMora,
  calcularInteresMoratorio,
} = require("./calculosPrestamo");

const sumarMeses = (fecha, meses) => {
  const [y, m, d] = fecha.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + meses, d)).toISOString().substring(0, 10);
};

const CATEGORIAS = ["al_dia", "por_vencer", "mora_1_30", "mora_31_60", "mora_61_90", "mora_90_mas"];

const clasificar = (diasMora, diasParaVencer) => {
  if (diasMora > 90) return "mora_90_mas";
  if (diasMora > 60) return "mora_61_90";
  if (diasMora > 30) return "mora_31_60";
  if (diasMora > 0) return "mora_1_30";
  if (diasParaVencer <= 7) return "por_vencer";
  return "al_dia";
};

const obtenerCartera = async () => {
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
  return filas;
};

// Resumen por categoría con la provisión sugerida según los porcentajes configurados
const resumirCartera = (filas) => {
  const cfg = config.obtener();
  const pct = {
    al_dia: cfg.prov_al_dia,
    por_vencer: cfg.prov_al_dia,
    mora_1_30: cfg.prov_1_30,
    mora_31_60: cfg.prov_31_60,
    mora_61_90: cfg.prov_61_90,
    mora_90_mas: cfg.prov_90_mas,
  };

  const resumen = {};
  CATEGORIAS.forEach((c) => {
    resumen[c] = { cantidad: 0, saldo: 0, mora: 0, porcentaje_provision: pct[c], provision: 0 };
  });
  filas.forEach((f) => {
    const r = resumen[f.categoria];
    r.cantidad += 1;
    r.saldo += f.saldo;
    r.mora += f.mora_generada;
  });
  CATEGORIAS.forEach((c) => {
    resumen[c].saldo = parseFloat(resumen[c].saldo.toFixed(2));
    resumen[c].mora = parseFloat(resumen[c].mora.toFixed(2));
    resumen[c].provision = parseFloat(((resumen[c].saldo * pct[c]) / 100).toFixed(2));
  });

  const totales = CATEGORIAS.reduce(
    (t, c) => ({
      cantidad: t.cantidad + resumen[c].cantidad,
      saldo: t.saldo + resumen[c].saldo,
      mora: t.mora + resumen[c].mora,
      provision: t.provision + resumen[c].provision,
    }),
    { cantidad: 0, saldo: 0, mora: 0, provision: 0 }
  );
  totales.saldo = parseFloat(totales.saldo.toFixed(2));
  totales.mora = parseFloat(totales.mora.toFixed(2));
  totales.provision = parseFloat(totales.provision.toFixed(2));

  return { resumen, totales };
};

module.exports = { obtenerCartera, resumirCartera, CATEGORIAS };
