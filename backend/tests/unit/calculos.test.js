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
