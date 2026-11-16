require("../helpers/entorno");
const test = require("node:test");
const assert = require("node:assert/strict");

const {
  calcularCuotaMensual,
  generarTablaAmortizacion,
  calcularInteresPeriodo,
  diasDeInteres,
  diasEntre,
  soloFecha,
  esFechaISO,
  calcularInteresMoratorio,
  liquidacionAlDia,
} = require("../../utils/calculosPrestamo");
const { validarPassword } = require("../../utils/passwordPolicy");
const { hoyISO } = require("../../utils/fechas");
const { numeroRecibo } = require("../../utils/recibos");

const cerca = (a, b, tol = 0.01) => assert.ok(Math.abs(a - b) <= tol, `${a} no está cerca de ${b}`);

test("cuota mensual: sistema francés", () => {
  // 5,000 al 120% anual (10% mensual) a 6 meses
  cerca(calcularCuotaMensual(5000, 120, 6), 1148.04);
  // un solo mes: capital + interés del mes
  cerca(calcularCuotaMensual(5000, 120, 1), 5500);
});

test("cuota mensual: tasa cero reparte el capital por igual", () => {
  cerca(calcularCuotaMensual(1200, 0, 12), 100);
});

test("cuota mensual: plazo indefinido paga solo el interés", () => {
  cerca(calcularCuotaMensual(10000, 24, 0), 200);
});

test("tabla de amortización: termina en cero y suma el capital", () => {
  const tabla = generarTablaAmortizacion(10000, 36, 12, "2026-01-15");
  assert.equal(tabla.length, 12);
  cerca(tabla[tabla.length - 1].saldo_restante, 0, 0.05);
  const capital = tabla.reduce((s, f) => s + f.capital, 0);
  cerca(capital, 10000, 0.1);
});

test("interés del período: mes completo y por días", () => {
  // 10% mensual sobre 5,000
  cerca(calcularInteresPeriodo(5000, 120, 30), 500);
  cerca(calcularInteresPeriodo(5000, 120, 15), 250);
  // 10% anual: interés de un mes
  cerca(calcularInteresPeriodo(5000, 10, 30), 41.67);
});

test("mes completo siempre: nunca se cobra menos de 30 días", () => {
  assert.equal(diasDeInteres("cuota_fija", "2026-10-01", "2026-10-06"), 30);
  assert.equal(diasDeInteres("desglose", "2026-10-01", "2026-10-06"), 30);
  // pasado el mes, se cobra por días reales
  assert.equal(diasDeInteres("desglose", "2026-10-01", "2026-11-15"), 45);
  // en cuota fija siempre es un mes
  assert.equal(diasDeInteres("cuota_fija", "2026-01-01", "2026-12-01"), 30);
});

test("pagar a los 5 días un préstamo de 5,000 al 10% mensual cuesta 5,500", () => {
  const dias = diasDeInteres("desglose", "2026-10-01", "2026-10-06");
  const interes = calcularInteresPeriodo(5000, 120, dias);
  cerca(5000 + interes, 5500);
});

test("mora: tasa anual por día de atraso", () => {
  // 24% anual sobre 1,000 por 40 días
  cerca(calcularInteresMoratorio(1000, 40), 26.3, 0.05);
  assert.equal(calcularInteresMoratorio(1000, 0), 0);
});

test("fechas: utilidades", () => {
  assert.equal(diasEntre("2026-10-01", "2026-10-31"), 30);
  assert.equal(soloFecha("2026-10-05T12:30:00.000Z"), "2026-10-05");
  assert.ok(esFechaISO("2026-02-28"));
  assert.ok(!esFechaISO("28/02/2026"));
  assert.match(hoyISO(), /^\d{4}-\d{2}-\d{2}$/);
});

test("fechas: usa la zona horaria de Honduras, no UTC", () => {
  // 02:30 UTC del 12 es todavía el 11 a las 20:30 en Honduras (UTC-6)
  assert.equal(hoyISO(new Date("2026-10-12T02:30:00Z")), "2026-10-11");
  assert.equal(hoyISO(new Date("2026-10-12T07:00:00Z")), "2026-10-12");
});

test("política de contraseñas", () => {
  assert.ok(validarPassword("abc"));
  assert.ok(validarPassword("soloLetrasAqui"));
  assert.ok(validarPassword("12345678"));
  assert.equal(validarPassword("Clave1234"), null);
});

test("numeración de recibos y finiquitos", () => {
  assert.equal(numeroRecibo(12, "pago_prestamo"), "R-000012");
  assert.equal(numeroRecibo(5, "finiquito"), "F-000005");
});

test("nombres con mayúscula inicial", () => {
  const { formatearNombre } = require("../../utils/nombres");
  assert.equal(formatearNombre("maría josé HERNÁNDEZ"), "María José Hernández");
  assert.equal(formatearNombre("  juan   carlos  pérez "), "Juan Carlos Pérez");
  assert.equal(formatearNombre("MARÍA DE LOS ÁNGELES díaz"), "María de los Ángeles Díaz");
  assert.equal(formatearNombre("De la Cruz pedro"), "De la Cruz Pedro");
  assert.equal(formatearNombre("ana-lucía o'neil"), "Ana-Lucía O'Neil");
  assert.equal(formatearNombre(""), "");
});

test("recordatorios de pago: cuándo toca cada uno", () => {
  const { recordatorioDelDia, mensajeRecordatorio } = require("../../utils/recordatorios");
  const c = { rec_dias_antes: 3, rec_mora_cada: 7 };
  const fila = (dias_para_vencer, dias_mora) => ({
    id_prestamo: 5, socio: "Ana López", cuota: 1000, mora_generada: dias_mora ? 20 : 0,
    vencimiento: "2026-11-12", dias_para_vencer, dias_mora,
  });

  assert.equal(recordatorioDelDia(fila(10, 0), c), null); // falta mucho
  assert.equal(recordatorioDelDia(fila(3, 0), c).tipo, "previo");
  assert.equal(recordatorioDelDia(fila(1, 0), c).clave, recordatorioDelDia(fila(3, 0), c).clave); // uno solo por vencimiento
  assert.equal(recordatorioDelDia(fila(0, 0), c), null); // vence hoy, aún sin mora

  // en mora: el primer día y luego una vez por semana
  const d1 = recordatorioDelDia(fila(-1, 1), c).clave;
  assert.equal(recordatorioDelDia(fila(-5, 7), c).clave, d1);
  assert.notEqual(recordatorioDelDia(fila(-6, 8), c).clave, d1);
  assert.equal(recordatorioDelDia(fila(-6, 8), { ...c, rec_mora_cada: 0 }).clave, d1); // 0 = solo una vez
  assert.equal(recordatorioDelDia(fila(3, 0), { ...c, rec_dias_antes: 0 }), null); // aviso previo apagado

  const previo = mensajeRecordatorio(fila(3, 0), "SmartCoop");
  assert.match(previo.texto, /Hola Ana/);
  assert.match(previo.texto, /L\.\s1,000\.00/);
  assert.match(mensajeRecordatorio(fila(-2, 4), "SmartCoop").texto, /4 día\(s\) de atraso/);
});

test("cancelar antes del plazo: solo se cobra el interés del tiempo usado", () => {
  const haceDias = (n) => {
    const d = new Date(`${hoyISO()}T12:00:00`);
    d.setDate(d.getDate() - n);
    return d.toISOString().substring(0, 10);
  };
  // 5,000 al 120% anual (10% mensual), último pago hace 10 días: se cobra un mes completo
  const pronto = liquidacionAlDia({ saldo: 5000, tasaAnual: 120, fechaOtorgado: haceDias(40), fechaUltimoPago: haceDias(10) });
  assert.equal(pronto.dias, 30);
  cerca(pronto.interes, 500);
  assert.equal(pronto.mora, 0);
  cerca(pronto.total, 5500);
  // a los 45 días: interés por días reales y, pasados los días de gracia, también mora
  const tarde = liquidacionAlDia({ saldo: 5000, tasaAnual: 120, fechaOtorgado: haceDias(45), fechaUltimoPago: null });
  assert.equal(tarde.dias, 45);
  cerca(tarde.interes, 750);
  assert.ok(tarde.mora > 0);
  cerca(tarde.total, 5750 + tarde.mora);
});

test("teléfono: Honduras con 8 dígitos u otro país con su código", () => {
  const { validarTelefono, limpiarTelefono } = require("../../utils/telefono");
  assert.ok(validarTelefono("98765432"));
  assert.ok(validarTelefono(limpiarTelefono("+1 305-555-1234")));
  assert.equal(limpiarTelefono("+1 305-555-1234"), "+13055551234");
  assert.ok(!validarTelefono("9876543"));
  assert.ok(!validarTelefono("+12"));
  assert.ok(!validarTelefono("305555123499"));
});

test("país: moneda, montos, identidad y teléfono de cada país", () => {
  const pais = require("../../utils/pais");
  const { validarTelefono } = require("../../utils/telefono");
  const { hoyISO } = require("../../utils/fechas");
  try {
    // Honduras (por defecto): como siempre
    pais.establecer("HN");
    assert.equal(pais.dinero(1234.5), "L.\u00a01,234.50");
    assert.equal(pais.dinero(-0.001), "L.\u00a00.00");
    assert.equal(pais.dinero(-1500), "L.\u00a0-1,500.00");
    assert.equal(pais.dinero("abc"), "L.\u00a00.00");
    assert.ok(pais.validarIdentidad("0801-1990-12345"), "con guiones se limpian");
    assert.equal(pais.normalizarIdentidad(" 0801-1990-12345 "), "0801199012345");
    assert.ok(!pais.validarIdentidad("080119901234"));
    assert.ok(validarTelefono("98765432"));

    pais.establecer("GT");
    assert.equal(pais.dinero(1234.5), "Q\u00a01,234.50");
    assert.ok(pais.validarIdentidad("2547 89632 0101"));

    pais.establecer("SV");
    assert.equal(pais.dinero(10), "$\u00a010.00");
    assert.ok(pais.validarIdentidad("01234567-8"));
    assert.ok(!pais.validarIdentidad("0801199012345"));

    pais.establecer("NI");
    assert.ok(pais.validarIdentidad("001-150590-0000a"), "letra final en minúscula también");
    assert.equal(pais.normalizarIdentidad("001-150590-0000a"), "0011505900000A");

    pais.establecer("CR");
    assert.equal(pais.dinero(1234567.891), "₡\u00a01\u00a0234\u00a0567,89");
    assert.ok(pais.validarIdentidad("1-0987-0654"));

    pais.establecer("PA");
    assert.equal(pais.dinero(5), "B/.\u00a05.00");
    assert.ok(pais.validarIdentidad("8-123-4567"));
    assert.ok(pais.validarIdentidad("PE-1-1234"));
    assert.ok(!pais.validarIdentidad("81234567"));

    pais.establecer("BZ");
    assert.ok(validarTelefono("6221234"), "Belice: 7 dígitos");
    assert.ok(!validarTelefono("98765432"));
    assert.match(hoyISO(), /^\d{4}-\d{2}-\d{2}$/);

    // un código desconocido vuelve a Honduras
    assert.equal(pais.establecer("XX").codigo, "HN");
  } finally {
    pais.establecer("HN");
  }
});

test("respaldo externo: firma S3 (ejemplos oficiales de AWS)", () => {
  const { firmar } = require("../../utils/respaldoExterno");
  const base = {
    region: "us-east-1",
    accessKey: "AKIAIOSFODNN7EXAMPLE",
    secretKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
    fecha: new Date("2013-05-24T00:00:00Z"),
  };
  const firma = (h) => h.authorization.split("Signature=")[1];
  const get = firmar({
    ...base, metodo: "GET", url: "https://examplebucket.s3.amazonaws.com/test.txt",
    encabezados: { Range: "bytes=0-9" },
    hashCuerpo: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  });
  assert.equal(firma(get), "f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41");
  const put = firmar({
    ...base, metodo: "PUT", url: "https://examplebucket.s3.amazonaws.com/test$file.text",
    encabezados: { Date: "Fri, 24 May 2013 00:00:00 GMT", "x-amz-storage-class": "REDUCED_REDUNDANCY" },
    hashCuerpo: require("crypto").createHash("sha256").update("Welcome to Amazon S3.").digest("hex"),
  });
  assert.equal(firma(put), "98ad721746da40c64f1a55b78f14c238d841ea1380cd77a1b5971af0ece108bd");
});

test("ambiente de pruebas: ningún correo llega a los socios y los respaldos van aparte", async () => {
  const sendEmail = require("../../utils/sendEmail");
  const { cfg } = require("../../utils/respaldoExterno");
  const original = sendEmail.transporter;
  const enviados = [];
  sendEmail.transporter = { sendMail: async (m) => enviados.push(m) };
  const antes = { AMBIENTE: process.env.AMBIENTE, CORREO_PRUEBAS: process.env.CORREO_PRUEBAS, RESPALDO_S3_PREFIJO: process.env.RESPALDO_S3_PREFIJO };
  delete process.env.RESPALDO_S3_PREFIJO;
  try {
    process.env.AMBIENTE = "pruebas";
    delete process.env.CORREO_PRUEBAS;
    assert.deepEqual(await sendEmail({ to: "socio@real.hn", subject: "Recordatorio" }), { omitido: true });
    assert.equal(enviados.length, 0);
    assert.equal(cfg().prefijo, "pruebas/respaldos/");

    process.env.CORREO_PRUEBAS = "equipo@cooperativa.hn";
    await sendEmail({ to: "socio@real.hn", subject: "Recordatorio" });
    assert.equal(enviados[0].to, "equipo@cooperativa.hn");
    assert.equal(enviados[0].subject, "[PRUEBAS → socio@real.hn] Recordatorio");

    // en producción, normal
    process.env.AMBIENTE = "";
    await sendEmail({ to: "socio@real.hn", subject: "Recordatorio" });
    assert.equal(enviados[1].to, "socio@real.hn");
    assert.equal(cfg().prefijo, "respaldos/");
  } finally {
    sendEmail.transporter = original;
    for (const [k, v] of Object.entries(antes)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
});

test("plan de pagos: cuotas, vencimientos y estado según el saldo", () => {
  const { generarPlan, estadoDelPlan, planDePrestamo, sumarMeses } = require("../../utils/planPagos");
  const { calcularCuotaMensual } = require("../../utils/calculosPrestamo");

  // fin de mes sin desbordar
  assert.equal(sumarMeses("2026-01-31", 1), "2026-02-28");
  assert.equal(sumarMeses("2028-01-31", 1), "2028-02-29");
  assert.equal(sumarMeses("2026-11-15", 3), "2027-02-15");

  // 10,000 al 24% anual (2% mensual) a 12 meses, desembolsado el 15 de enero
  const plan = generarPlan({ monto: 10000, tasaAnual: 24, plazo: 12, fechaInicio: "2026-01-15" });
  assert.equal(plan.length, 12);
  assert.equal(plan[0].fecha_vencimiento, "2026-02-15");
  assert.equal(plan[11].fecha_vencimiento, "2027-01-15");
  cerca(plan[0].cuota, calcularCuotaMensual(10000, 24, 12));
  assert.equal(plan[0].interes, 200);
  cerca(plan.reduce((t, c) => t + c.capital, 0), 10000, 0.001); // el capital suma exacto
  assert.equal(plan[11].saldo, 0);

  // Al día: pagó las 2 primeras cuotas, hoy es antes de la 3.ª
  const saldoTras2 = plan[1].saldo;
  let e = estadoDelPlan(plan, { saldoActual: saldoTras2, monto: 10000, hoy: "2026-04-10" });
  assert.equal(e.resumen.cuotas_pagadas, 2);
  assert.equal(e.resumen.cuotas_vencidas, 0);
  assert.equal(e.resumen.dias_atraso, 0);
  assert.equal(e.resumen.proxima_cuota.numero, 3);

  // Se atrasó: el 10 de mayo ya venció la 3.ª cuota (15 de abril) y no la pagó
  e = estadoDelPlan(plan, { saldoActual: saldoTras2, monto: 10000, hoy: "2026-05-10" });
  assert.equal(e.resumen.cuotas_vencidas, 1);
  assert.equal(e.resumen.dias_atraso, 25); // desde el 15 de abril
  assert.equal(e.cuotas[2].estado, "vencida");
  cerca(e.resumen.monto_vencido, plan[2].cuota);

  // Pago parcial de la 3.ª: sigue vencida, con lo que falta
  const parcial = saldoTras2 - plan[2].capital / 2;
  e = estadoDelPlan(plan, { saldoActual: parcial, monto: 10000, hoy: "2026-05-10" });
  assert.equal(e.cuotas[2].estado, "vencida");
  cerca(e.resumen.capital_vencido, plan[2].capital / 2, 0.02);

  // Abono extra: cubre por adelantado cuotas futuras
  e = estadoDelPlan(plan, { saldoActual: plan[5].saldo, monto: 10000, hoy: "2026-03-01" });
  assert.equal(e.resumen.cuotas_pagadas, 6);
  assert.equal(e.resumen.proxima_cuota.numero, 7);

  // Unos centavos de diferencia por redondeo no dejan la cuota "vencida"
  e = estadoDelPlan(plan, { saldoActual: plan[0].saldo + 0.3, monto: 10000, hoy: "2026-03-01" });
  assert.equal(e.cuotas[0].estado, "pagada");

  // Préstamo cancelado: todas pagadas; indefinido o sin desembolsar: sin plan
  const pagado = planDePrestamo({ estado: "pagado", monto: 5000, tasa_interes: 24, plazo_meses: 6, fecha_otorgado: "2026-01-01", saldo_restante: 0 }, "2026-12-01");
  assert.equal(pagado.resumen.cuotas_pagadas, 6);
  assert.equal(planDePrestamo({ estado: "activo", monto: 5000, tasa_interes: 24, plazo_meses: 0, fecha_otorgado: "2026-01-01", saldo_restante: 5000 }), null);
  assert.equal(planDePrestamo({ estado: "aprobado", monto: 5000, tasa_interes: 24, plazo_meses: 6, fecha_otorgado: null, saldo_restante: 5000 }), null);
});

test("contabilidad: cada operación cuadra y un cambio registra solo la diferencia", () => {
  const { lineasDe, neto, medio, cuentaDeSocio } = require("../../utils/contabilidad");
  const cuadra = (lineas) => {
    const d = lineas.reduce((t, l) => t + l.debe, 0);
    const h = lineas.reduce((t, l) => t + l.haber, 0);
    cerca(d, h, 0.001);
    return d;
  };
  assert.equal(medio("efectivo"), "caja");
  assert.equal(medio("transferencia"), "bancos");
  assert.equal(cuentaDeSocio("Aportaciones"), "aportaciones");
  assert.equal(cuentaDeSocio("Vivienda"), "ahorro_vivienda");

  const pago = lineasDe("pago_prestamo", { monto: 1100, capital: 800, interes: 250, metodo: "efectivo" });
  assert.equal(cuadra(pago), 1100);
  assert.deepEqual(pago.find((l) => l.clave === "ingreso_mora"), { clave: "ingreso_mora", debe: 0, haber: 50 });
  cuadra(lineasDe("desembolso_prestamo", { monto: 5000, metodo: "cuenta", tipo_cuenta: "Aportaciones" }));
  cuadra(lineasDe("deposito_socio", { monto: 300, metodo: "deposito", tipo_cuenta: "Vivienda" }));
  cuadra(lineasDe("retiro_socio", { monto: 300, metodo: "efectivo", tipo_cuenta: "Pensiones" }));
  cuadra(lineasDe("gasto", { monto: 75.5, categoria: "papeleria", metodo: "efectivo" }));
  cuadra(lineasDe("consolidacion", { capital: 9000, interes: 400, mora: 60 }));
  cuadra(lineasDe("ajuste_socio", { monto: -20, tipo_cuenta: "Aportaciones" }));

  // Editar un pago de 1,100 en efectivo a 1,000 por transferencia: solo la diferencia
  const antes = lineasDe("pago_prestamo", { monto: 1100, capital: 800, interes: 250, metodo: "efectivo" });
  const despues = lineasDe("pago_prestamo", { monto: 1000, capital: 750, interes: 250, metodo: "transferencia" });
  const cambio = neto([...despues, ...antes.map((l) => ({ ...l, debe: l.haber, haber: l.debe }))]);
  cuadra(cambio);
  const de = (c) => cambio.find((l) => l.clave === c) || { debe: 0, haber: 0 };
  assert.equal(de("caja").haber, 1100, "sale de caja lo que había entrado");
  assert.equal(de("bancos").debe, 1000, "entra a bancos el pago corregido");
  assert.equal(de("cartera").debe, 50, "el capital abonado baja 50");
  assert.equal(de("ingreso_mora").debe, 50, "la mora baja 50");
  assert.ok(!cambio.some((l) => l.clave === "ingreso_intereses"), "el interés no cambió: no aparece");
});

test("ahorro: saldo promedio diario, interés del mes y plazo fijo", () => {
  const { saldoPromedio, interesDelMes, liquidacionPlazo, diasDelMes } = require("../../utils/ahorro");
  assert.equal(diasDelMes(2026, 2), 28);
  assert.equal(diasDelMes(2028, 2), 29);

  // Noviembre (30 días): 1,000 los primeros 10 días y 4,000 desde el 11 → promedio 3,000
  const fotos = [
    { fecha: "2026-10-31", saldo: 1000 }, // la última del mes anterior cubre los primeros días
    { fecha: "2026-11-11", saldo: 4000 },
  ];
  const p = saldoPromedio(fotos, 2026, 11, 0);
  assert.equal(p.promedio, 3000);
  assert.equal(p.dias, 30);
  // Sin fotos: se usa el saldo de respaldo
  assert.equal(saldoPromedio([], 2026, 11, 500).promedio, 500);

  // 3,000 al 6% anual por 30 días = 14.79; con 10% de retención: 1.48 y neto 13.31
  const i = interesDelMes({ promedio: 3000, tasaAnual: 6, dias: 30, retencionPct: 10 });
  assert.deepEqual(i, { bruto: 14.79, retencion: 1.48, neto: 13.31 });
  assert.equal(interesDelMes({ promedio: -50, tasaAnual: 6, dias: 30 }).bruto, 0);

  // Plazo fijo de 10,000 al 8% por 180 días
  const dep = { monto: 10000, tasa_anual: 8, plazo_dias: 180, penalizacion_pct: 50, fecha_inicio: "2026-01-01", fecha_vencimiento: "2026-06-30" };
  const alVencer = liquidacionPlazo(dep, "2026-07-02");
  assert.equal(alVencer.anticipado, false);
  assert.equal(alVencer.interes, 394.52); // 10,000 × 8% × 180 / 365
  // Retiro anticipado a los 90 días: la mitad del interés devengado
  const antes = liquidacionPlazo(dep, "2026-04-01");
  assert.equal(antes.anticipado, true);
  assert.equal(antes.dias, 90);
  assert.equal(antes.interes_devengado, 197.26);
  assert.equal(antes.interes, 98.63);
});

test("excedentes: el reparto proporcional cuadra al centavo", () => {
  const { repartir } = require("../../utils/excedentes");
  const partes = repartir(100, [1, 1, 1]);
  cerca(partes.reduce((t, p) => t + p, 0), 100, 0.0001);
  assert.deepEqual(repartir(1000, [3000, 1000, 0]), [750, 250, 0]);
  assert.deepEqual(repartir(50, [0, 0]), [0, 0], "sin base no se reparte");
  assert.deepEqual(repartir(10, [-5, 5]), [0, 10], "saldos negativos no cuentan");
});
