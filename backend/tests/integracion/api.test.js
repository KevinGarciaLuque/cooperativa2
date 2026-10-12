// Pruebas de integración: la API completa contra una base aparte (siempre *_test).
const { baseDePruebas } = require("../helpers/entorno");
const test = require("node:test");
const assert = require("node:assert/strict");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const { crearBaseDeDatos } = require("../../scripts/crear_bd");

let app;
let servidor;
let base;
let pool;
const ids = {};

const api = async (metodo, ruta, cuerpo, token) => {
  const r = await fetch(`${base}/api${ruta}`, {
    method: metodo,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  let b = null;
  try {
    b = await r.json();
  } catch {
    b = null;
  }
  return { s: r.status, b };
};

const tokenDe = (u, rol, rolId) =>
  jwt.sign({ id_usuario: u, rol, rol_id: rolId, nombre_completo: `Usuario ${u}` }, process.env.JWT_SECRET, {
    expiresIn: "10m",
  });

const cerca = (a, b, tol = 0.01) => assert.ok(Math.abs(a - b) <= tol, `${a} no está cerca de ${b}`);

test.before(async () => {
  await crearBaseDeDatos(baseDePruebas, { reiniciar: true });
  pool = require("../../db");
  const { aplicarMigraciones } = require("../../utils/migraciones");
  await aplicarMigraciones();
  const hash = await bcrypt.hash("Clave1234", 4);

  const crear = async (nombre, dni, rolId, estado = "activo") => {
    const [r] = await pool.query(
      `INSERT INTO usuarios (nombre_completo, dni, telefono, correo, password, rol_id, estado, fecha_registro)
       VALUES (?, ?, '98765432', ?, ?, ?, ?, NOW())`,
      [nombre, dni, `${dni}@prueba.hn`, hash, rolId, estado]
    );
    return r.insertId;
  };
  ids.super = await crear("Super Prueba", "0801000000001", 5);
  ids.admin = await crear("Admin Prueba", "0801000000002", 1);
  ids.socio = await crear("Socio Uno Prueba", "0801000000003", 2);
  ids.socio2 = await crear("Socio Dos Prueba", "0801000000004", 2);
  for (const id of [ids.socio, ids.socio2]) {
    for (const tipo of ["Aportaciones", "Vivienda", "Pensiones"]) {
      await pool.query(
        `INSERT INTO cuentas (id_usuario, tipo_cuenta, saldo_actual, estado, fecha_apertura) VALUES (?, ?, 0, 'activa', NOW())`,
        [id, tipo]
      );
    }
  }
  ids.tSuper = tokenDe(ids.super, "Super Administrador", 5);
  ids.tAdmin = tokenDe(ids.admin, "Administrador", 1);
  ids.tSocio = tokenDe(ids.socio, "Socio", 2);
  ids.tSocio2 = tokenDe(ids.socio2, "Socio", 2);

  app = require("../../app");
  await new Promise((ok) => {
    servidor = app.listen(0, ok);
  });
  base = `http://127.0.0.1:${servidor.address().port}`;
});

test.after(async () => {
  if (servidor) await new Promise((ok) => servidor.close(ok));
  if (pool) await pool.end();
});

// ─────────────────────────────────────────────────────────────
test("seguridad: sin sesión no hay acceso", async () => {
  assert.equal((await api("GET", "/usuarios")).s, 401);
  assert.equal((await api("GET", "/prestamos")).s, 401);
  assert.equal((await api("POST", "/pagos", { id_prestamo: 1, monto_pagado: 1 })).s, 401);
  assert.equal((await api("GET", "/configuracion")).s, 200); // pública (pantalla de login)
});

test("seguridad: un token de recuperación no es una sesión", async () => {
  const reset = jwt.sign({ id_usuario: ids.super }, process.env.JWT_SECRET, { expiresIn: "5m" });
  assert.equal((await api("GET", "/usuarios", null, reset)).s, 401);
});

test("seguridad: las respuestas nunca incluyen la contraseña", async () => {
  const r = await api("GET", "/usuarios?limit=5", null, ids.tSuper);
  assert.equal(r.s, 200);
  assert.ok(r.b.data.length >= 4);
  assert.ok(!JSON.stringify(r.b).includes('"password"'));
});

test("seguridad: el socio solo ve lo suyo", async () => {
  assert.equal((await api("GET", "/usuarios", null, ids.tSocio)).s, 403);
  assert.equal((await api("GET", `/usuarios/${ids.socio}`, null, ids.tSocio)).s, 200);
  assert.equal((await api("GET", `/usuarios/${ids.socio2}`, null, ids.tSocio)).s, 403);
  assert.equal((await api("GET", "/dashboard/kpis", null, ids.tSocio)).s, 403);
  // aunque pida los préstamos de otro, el servidor fuerza los suyos
  const r = await api("GET", `/prestamos?id_usuario=${ids.socio2}`, null, ids.tSocio);
  assert.equal(r.s, 200);
  assert.ok(r.b.data.every((p) => p.id_usuario === ids.socio));
});

test("seguridad: solo el Super Administrador crea Super Administradores", async () => {
  const datos = {
    nombre_completo: "Intruso Prueba", dni: "0801000000099", password: "Clave1234", rol_id: 5,
    telefono: "98765432", fecha_nacimiento: "1990-01-01",
  };
  const r = await api("POST", "/usuarios", datos, ids.tAdmin);
  assert.equal(r.s, 403);
});

// ─────────────────────────────────────────────────────────────
test("registro por enlace: el socio queda pendiente y limitado", async () => {
  const enlace = await api("GET", "/solicitudes/enlace", null, ids.tSuper);
  assert.equal(enlace.s, 200);
  const codigo = enlace.b.codigo;
  const datos = {
    nombre_completo: "Nuevo Socio Prueba", dni: "0801000000010", telefono: "98761234",
    correo: "nuevo.prueba@prueba.hn", fecha_nacimiento: "1992-03-04", password: "Clave1234",
  };

  assert.equal((await api("POST", "/registro", datos)).s, 403); // sin código
  assert.equal((await api("POST", "/registro", { ...datos, codigo, password: "abc" })).s, 400);
  // el correo es obligatorio: ahí recibirá sus recibos
  assert.equal((await api("POST", "/registro", { ...datos, codigo, correo: "" })).s, 400);
  assert.equal((await api("POST", "/registro", { ...datos, codigo, fecha_nacimiento: "2015-01-01" })).s, 400);

  const ok = await api("POST", "/registro", { ...datos, codigo });
  assert.equal(ok.s, 201);
  ids.nuevo = ok.b.id_usuario;
  assert.equal((await api("POST", "/registro", { ...datos, codigo })).s, 409); // duplicado

  const login = await api("POST", "/usuarios/login", { dni: datos.dni, password: datos.password });
  assert.equal(login.s, 200);
  assert.equal(login.b.usuario.estado, "pendiente");
  ids.tNuevo = login.b.token;

  assert.equal((await api("GET", "/cuentas", null, ids.tNuevo)).s, 403);
  assert.equal((await api("GET", "/solicitudes/parametros", null, ids.tNuevo)).s, 200);
});

test("solicitud de préstamo: validaciones y una sola en trámite", async () => {
  const sol = {
    monto: 5000, plazo_meses: 6, cuota_posible: 1100, proposito: "negocio", ocupacion: "negocio_propio",
    ingreso_mensual: 9000, acepta: true,
  };
  assert.equal((await api("POST", "/solicitudes/prestamo", { ...sol, monto: 99999999 }, ids.tNuevo)).s, 400);
  assert.equal((await api("POST", "/solicitudes/prestamo", { ...sol, acepta: false }, ids.tNuevo)).s, 400);

  const ok = await api("POST", "/solicitudes/prestamo", sol, ids.tNuevo);
  assert.equal(ok.s, 201);
  cerca(ok.b.cuota_estimada, 1148.04);
  ids.prestamoNuevo = ok.b.id_prestamo;

  assert.equal((await api("POST", "/solicitudes/prestamo", sol, ids.tNuevo)).s, 409);
});

test("aprobación: el socio y el préstamo se aprueban juntos", async () => {
  const resumen = await api("GET", "/solicitudes/resumen", null, ids.tSuper);
  assert.equal(resumen.b.socios_pendientes, 1);
  assert.equal(resumen.b.prestamos_pendientes, 1);

  // no se puede aprobar el préstamo si el socio sigue pendiente y no se aprueba también
  const sin = await api("POST", `/solicitudes/prestamos/${ids.prestamoNuevo}/aprobar`, {}, ids.tSuper);
  assert.equal(sin.s, 400);

  const ok = await api(
    "POST", `/solicitudes/prestamos/${ids.prestamoNuevo}/aprobar`,
    { aprobar_socio: true, tasa_mensual: 10 }, ids.tSuper
  );
  assert.equal(ok.s, 200);

  const [[u]] = await pool.query("SELECT estado FROM usuarios WHERE id_usuario = ?", [ids.nuevo]);
  assert.equal(u.estado, "activo");
  const [cuentas] = await pool.query("SELECT tipo_cuenta FROM cuentas WHERE id_usuario = ?", [ids.nuevo]);
  assert.equal(cuentas.length, 3);
});

test("carta de aprobación: PDF para el personal y para el socio dueño", async () => {
  const pdf = async (ruta, token) => {
    const r = await fetch(`${base}/api${ruta}`, { headers: { Authorization: `Bearer ${token}` } });
    return { s: r.status, tipo: r.headers.get("content-type") || "", cuerpo: Buffer.from(await r.arrayBuffer()) };
  };
  const ruta = `/solicitudes/prestamos/${ids.prestamoNuevo}/carta`;

  const personal = await pdf(ruta, ids.tSuper);
  assert.equal(personal.s, 200);
  assert.match(personal.tipo, /application\/pdf/);
  assert.equal(personal.cuerpo.subarray(0, 4).toString(), "%PDF");

  const dueno = (await api("POST", "/usuarios/login", { dni: "0801000000010", password: "Clave1234" })).b.token;
  assert.equal((await pdf(ruta, dueno)).s, 200);
  assert.equal((await pdf(ruta, ids.tSocio)).s, 403); // la de otro socio, no

  // una solicitud sin aprobar no tiene carta
  const [[pend]] = await pool.query(
    "SELECT id_prestamo FROM prestamos WHERE estado <> 'aprobado' OR fecha_aprobacion IS NULL LIMIT 1"
  );
  if (pend) assert.equal((await pdf(`/solicitudes/prestamos/${pend.id_prestamo}/carta`, ids.tSuper)).s, 404);

  // sin servidor de correo configurado, el reenvío lo dice en vez de fallar en silencio
  const reenvio = await api("POST", `${ruta.replace("/carta", "/carta/enviar")}`, {}, ids.tSuper);
  assert.equal(reenvio.s, 400);
  assert.ok(reenvio.b.message);
  assert.equal((await api("POST", `${ruta}/enviar`, {}, dueno)).s, 403);

  // aprobar desde la pantalla de Préstamos también deja la carta lista y lo avisa
  const sol = await api(
    "POST", "/solicitudes/prestamo",
    { monto: 1000, plazo_meses: 2, cuota_posible: 600, proposito: "otro", ocupacion: "empleado", ingreso_mensual: 8000, acepta: true },
    ids.tSocio
  );
  assert.equal(sol.s, 201);
  const ap = await api("PATCH", `/prestamos/${sol.b.id_prestamo}/aprobar`, {}, ids.tSuper);
  assert.equal(ap.s, 200);
  assert.match(ap.b.message, /carta de aprobación/);
  assert.equal((await pdf(`/solicitudes/prestamos/${sol.b.id_prestamo}/carta`, ids.tSocio)).s, 200);
  await pool.query("DELETE FROM solicitudes_prestamo WHERE id_prestamo = ?", [sol.b.id_prestamo]);
  await pool.query("DELETE FROM prestamos WHERE id_prestamo = ?", [sol.b.id_prestamo]);

  // un préstamo registrado directamente (activo, sin fecha de aprobación) también tiene carta
  const [directo] = await pool.query(
    `INSERT INTO prestamos (id_usuario, monto, tasa_interes, plazo_meses, saldo_restante, estado, fecha_otorgado)
     VALUES (?, 3000, 24, 6, 3000, 'activo', NOW())`,
    [ids.socio]
  );
  assert.equal((await pdf(`/solicitudes/prestamos/${directo.insertId}/carta`, ids.tSuper)).s, 200);
  await pool.query("DELETE FROM prestamos WHERE id_prestamo = ?", [directo.insertId]);
});

test("tras la aprobación el socio ve su tasa y puede pedir otro préstamo", async () => {
  const login = await api("POST", "/usuarios/login", { dni: "0801000000010", password: "Clave1234" });
  const t = login.b.token;
  assert.equal(login.b.usuario.estado, "activo");

  // ve la tasa mensual con la que se aprobó, pero no el detalle de intereses
  const lista = await api("GET", "/prestamos", null, t);
  const p = lista.b.data.find((x) => x.id_prestamo === ids.prestamoNuevo);
  assert.equal(p.estado, "aprobado");
  assert.equal(p.tasa_mensual, 10);
  assert.equal(p.tasa_interes, undefined);
  assert.equal(p.tasa_original, undefined);

  // una solicitud ya aprobada no bloquea una nueva
  const otra = await api(
    "POST", "/solicitudes/prestamo",
    {
      monto: 2000, plazo_meses: 4, cuota_posible: 700, proposito: "salud", ocupacion: "empleado",
      ingreso_mensual: 8000, acepta: true,
    },
    t
  );
  assert.equal(otra.s, 201);
  // pero dos en revisión a la vez, no
  const tercera = await api(
    "POST", "/solicitudes/prestamo",
    {
      monto: 1000, plazo_meses: 2, cuota_posible: 600, proposito: "otro", ocupacion: "empleado",
      ingreso_mensual: 8000, acepta: true,
    },
    t
  );
  assert.equal(tercera.s, 409);
  // se retira para no alterar el resto de las pruebas
  await pool.query("DELETE FROM solicitudes_prestamo WHERE id_prestamo = ?", [otra.b.id_prestamo]);
  await pool.query("DELETE FROM prestamos WHERE id_prestamo = ?", [otra.b.id_prestamo]);
});

test("desembolso → pago total → finiquito", async () => {
  const id = ids.prestamoNuevo;

  // no se desembolsa sin aprobar ni se emite finiquito antes de pagar
  const ds = await api("POST", `/prestamos/${id}/desembolsar`, { metodo: "efectivo" }, ids.tSuper);
  assert.equal(ds.s, 200);
  assert.ok(ds.b.id_recibo);

  const nuevoToken = (await api("POST", "/usuarios/login", { dni: "0801000000010", password: "Clave1234" })).b.token;
  assert.equal((await api("GET", `/recibos/finiquito/${id}`, null, nuevoToken)).s, 400);

  const cot = await api("GET", `/prestamos/${id}/cotizar-liquidacion`, null, ids.tSuper);
  const total = cot.b.data.total_a_pagar;
  cerca(total, 5500); // 5,000 al 10% mensual, mes completo

  // sobrepago rechazado
  const sobre = await api("POST", "/pagos", { id_prestamo: id, monto_pagado: total + 50, tipo_pago: "desglose" }, ids.tSuper);
  assert.equal(sobre.s, 400);

  const pago = await api("POST", "/pagos", { id_prestamo: id, monto_pagado: total, metodo_pago: "Efectivo", tipo_pago: "desglose" }, ids.tSuper);
  assert.equal(pago.s, 201);
  assert.equal(pago.b.detalles.prestamo_liquidado, true);
  assert.ok(pago.b.id_finiquito);
  ids.pagoFinal = pago.b.id_pago;

  // el pago repetido no se acepta
  assert.equal((await api("POST", "/pagos", { id_prestamo: id, monto_pagado: total }, ids.tSuper)).s, 400);

  // el socio ve su propia constancia, pero no la de otros
  const fin = await api("GET", `/recibos/finiquito/${id}`, null, nuevoToken);
  assert.equal(fin.s, 200);
  assert.equal(fin.b.data.tipo, "finiquito");
  assert.match(fin.b.data.numero, /^F-\d{6}$/);
  const [[otro]] = await pool.query("SELECT id_prestamo FROM prestamos WHERE id_usuario <> ? LIMIT 1", [ids.nuevo]);
  if (otro) assert.equal((await api("GET", `/recibos/finiquito/${otro.id_prestamo}`, null, nuevoToken)).s, 403);
});

test("comprobante de entrega firmado: lo sube el socio y lo ve el personal", async () => {
  const login = await api("POST", "/usuarios/login", { dni: "0801000000010", password: "Clave1234" });
  const t = login.b.token;

  // el socio localiza su comprobante de desembolso
  const buscar = await api("GET", `/recibos/buscar?referencia_tipo=prestamo&referencia_id=${ids.prestamoNuevo}`, null, t);
  assert.equal(buscar.s, 200);
  assert.equal(buscar.b.data.tipo, "desembolso");
  assert.equal(buscar.b.data.comprobante_firmado, null);
  const idRecibo = buscar.b.data.id_recibo;

  const enviar = async (token, nombre, mime, contenido, id = idRecibo) => {
    const fd = new FormData();
    fd.append("archivo", new Blob([contenido], { type: mime }), nombre);
    const r = await fetch(`${base}/api/recibos/${id}/comprobante-firmado`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: fd,
    });
    return { s: r.status, b: await r.json().catch(() => null) };
  };

  // formato no permitido
  assert.equal((await enviar(t, "virus.exe", "application/x-msdownload", "MZ")).s, 400);
  // otro socio no puede subir en un recibo ajeno
  assert.equal((await enviar(ids.tSocio2, "foto.jpg", "image/jpeg", "abc")).s, 403);

  const ok = await enviar(t, "firmado.jpg", "image/jpeg", Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]));
  assert.equal(ok.s, 201);

  // el Super Administrador recibe el aviso: aparece en el contador y en la lista
  const resumen = await api("GET", "/solicitudes/resumen", null, ids.tSuper);
  assert.equal(resumen.b.comprobantes_por_revisar, 1);
  const lista = await api("GET", "/solicitudes/comprobantes-recibidos", null, ids.tSuper);
  assert.ok(lista.b.data.some((d) => d.id_recibo === idRecibo));

  // el personal ve el estado y descarga el archivo
  const recibo = await api("GET", `/recibos/${idRecibo}`, null, ids.tSuper);
  assert.ok(recibo.b.data.comprobante_firmado);
  const archivo = await fetch(`${base}/api/recibos/${idRecibo}/comprobante-firmado`, {
    headers: { Authorization: `Bearer ${ids.tSuper}` },
  });
  assert.equal(archivo.status, 200);
  assert.equal(archivo.headers.get("content-type"), "image/jpeg");
  assert.equal((await archivo.arrayBuffer()).byteLength, 7);

  // al abrirlo, el comprobante queda revisado y deja de contar como novedad
  const despues = await api("GET", "/solicitudes/resumen", null, ids.tSuper);
  assert.equal(despues.b.comprobantes_por_revisar, 0);

  // revisado por la cooperativa: el socio ya no puede reemplazarlo, el personal sí
  assert.equal((await enviar(t, "otro.jpg", "image/jpeg", Buffer.from([0xff, 0xd8, 1]))).s, 403);
  assert.equal((await enviar(ids.tSuper, "corregido.jpg", "image/jpeg", Buffer.from([0xff, 0xd8, 2]))).s, 201);

  // ya no aparece entre los desembolsos pendientes de firma
  const pend = await api("GET", "/solicitudes/desembolsos-sin-firma", null, ids.tSuper);
  assert.ok(!pend.b.data.some((d) => d.id_recibo === idRecibo));
  // el socio no puede ver la lista del personal
  assert.equal((await api("GET", "/solicitudes/desembolsos-sin-firma", null, t)).s, 403);
});

test("integridad: anular exige motivo, archiva y revierte el finiquito", async () => {
  const id = ids.prestamoNuevo;
  assert.equal((await api("DELETE", `/pagos/${ids.pagoFinal}`, null, ids.tSuper)).s, 400); // sin motivo

  // un préstamo con pagos no se puede eliminar
  assert.equal((await api("DELETE", `/prestamos/${id}`, null, ids.tSuper)).s, 409);

  const an = await api("DELETE", `/pagos/${ids.pagoFinal}?motivo=prueba%20automatica`, null, ids.tSuper);
  assert.equal(an.s, 200);

  const [[pr]] = await pool.query("SELECT estado, saldo_restante FROM prestamos WHERE id_prestamo = ?", [id]);
  assert.equal(pr.estado, "activo");
  cerca(parseFloat(pr.saldo_restante), 5000);

  const [arch] = await pool.query("SELECT motivo FROM pagos_anulados WHERE id_prestamo = ?", [id]);
  assert.equal(arch.length, 1);
  const [[fq]] = await pool.query(
    "SELECT anulado FROM recibos WHERE tipo = 'finiquito' AND referencia_id = ? ORDER BY id_recibo DESC LIMIT 1", [id]
  );
  assert.equal(fq.anulado, 1);

  // no se marca como pagado un préstamo con saldo
  assert.equal((await api("PUT", `/prestamos/${id}`, { estado: "pagado" }, ids.tSuper)).s, 409);
});

// ─────────────────────────────────────────────────────────────
test("mora: se cobra, y solo el Super Administrador puede omitirla", async () => {
  const [r] = await pool.query(
    `INSERT INTO prestamos (id_usuario, monto, tasa_interes, tipo_tasa, tasa_original, plazo_meses, saldo_restante, estado, fecha_otorgado)
     VALUES (?, 1000, 120, 'nominal_mensual', 10, 6, 1000, 'activo', DATE_SUB(NOW(), INTERVAL 70 DAY))`,
    [ids.socio]
  );
  const id = r.insertId;

  const prox = await api("GET", `/pagos/prestamo/${id}/proximo-pago`, null, ids.tSuper);
  assert.equal(prox.s, 200);
  assert.ok(prox.b.proximo_pago.dias_mora >= 39 && prox.b.proximo_pago.dias_mora <= 41);
  assert.ok(prox.b.proximo_pago.interes_moratorio > 25);

  // el socio ve su mora (pero no los intereses ordinarios)
  const vista = await api("GET", `/pagos/prestamo/${id}/proximo-pago`, null, ids.tSocio);
  assert.equal(vista.s, 200);
  assert.ok(vista.b.proximo_pago.interes_moratorio > 25);
  assert.equal(vista.b.proximo_pago.interes_para_saldar, undefined);

  // un administrador común no puede omitir la mora
  const noPuede = await api("POST", "/pagos", { id_prestamo: id, monto_pagado: 300, condonar_mora: true }, ids.tAdmin);
  assert.equal(noPuede.s, 403);

  // un pago menor a la mora no se acepta
  const corto = await api("POST", "/pagos", { id_prestamo: id, monto_pagado: 10 }, ids.tSuper);
  assert.equal(corto.s, 400);

  const conMora = await api("POST", "/pagos", { id_prestamo: id, monto_pagado: 300 }, ids.tSuper);
  assert.equal(conMora.s, 201);
  assert.ok(conMora.b.detalles.interes_moratorio > 25);
});

test("mora omitida por el Super Administrador queda registrada", async () => {
  const [r] = await pool.query(
    `INSERT INTO prestamos (id_usuario, monto, tasa_interes, tipo_tasa, tasa_original, plazo_meses, saldo_restante, estado, fecha_otorgado)
     VALUES (?, 2000, 120, 'nominal_mensual', 10, 6, 2000, 'mora', DATE_SUB(NOW(), INTERVAL 90 DAY))`,
    [ids.socio2]
  );
  const ok = await api("POST", "/pagos", { id_prestamo: r.insertId, monto_pagado: 400, condonar_mora: true }, ids.tSuper);
  assert.equal(ok.s, 201);
  assert.equal(ok.b.detalles.interes_moratorio, 0);
  assert.ok(ok.b.detalles.mora_condonada > 0);
  const [[b]] = await pool.query("SELECT COUNT(*) AS n FROM bitacora WHERE detalle LIKE '%MORA OMITIDA%'");
  assert.ok(b.n >= 1);
});

// ─────────────────────────────────────────────────────────────
test("caja: movimientos, gasto y cierre con diferencia", async () => {
  const hoy = require("../../utils/fechas").hoyISO();

  const ing = await api("POST", "/caja/ingreso", { categoria: "saldo_inicial", monto: 10000, metodo: "efectivo" }, ids.tSuper);
  assert.equal(ing.s, 201);
  const gas = await api("POST", "/caja/gasto", { categoria: "servicios", monto: 250.5, concepto: "Energía eléctrica" }, ids.tSuper);
  assert.equal(gas.s, 201);
  assert.equal((await api("POST", "/caja/gasto", { categoria: "servicios", monto: 0, concepto: "x" }, ids.tSuper)).s, 400);

  const res = await api("GET", `/caja/resumen?fecha=${hoy}`, null, ids.tSuper);
  assert.equal(res.s, 200);
  assert.ok(res.b.totales.ingresos >= 10000);
  const esperado = res.b.efectivo.efectivo_esperado;

  // con diferencia exige explicación
  const sin = await api("POST", "/caja/cierre", { fecha: hoy, efectivo_contado: esperado - 100 }, ids.tSuper);
  assert.equal(sin.s, 400);

  const ok = await api(
    "POST", "/caja/cierre",
    { fecha: hoy, efectivo_contado: esperado - 100, observacion: "Faltante por cambio" }, ids.tSuper
  );
  assert.equal(ok.s, 201);
  cerca(ok.b.diferencia, -100);

  assert.equal((await api("POST", "/caja/cierre", { fecha: hoy, efectivo_contado: esperado }, ids.tSuper)).s, 409);
});

test("contabilidad: cierre mensual congelado y reapertura", async () => {
  // no se cierra un mes futuro
  assert.equal((await api("POST", "/contabilidad/cierre-mensual", { anio: 2099, mes: 1 }, ids.tSuper)).s, 400);

  const vivo = await api("GET", "/contabilidad/cierre-mensual?anio=2026&mes=1", null, ids.tSuper);
  assert.equal(vivo.b.cerrado, false);

  assert.equal((await api("POST", "/contabilidad/cierre-mensual", { anio: 2026, mes: 1 }, ids.tSuper)).s, 201);
  assert.equal((await api("POST", "/contabilidad/cierre-mensual", { anio: 2026, mes: 1 }, ids.tSuper)).s, 409);

  const guardado = await api("GET", "/contabilidad/cierre-mensual?anio=2026&mes=1", null, ids.tSuper);
  assert.equal(guardado.b.cerrado, true);

  // solo el Super Administrador reabre, con motivo
  assert.equal((await api("DELETE", "/contabilidad/cierre-mensual/2026/1?motivo=motivo%20valido", null, ids.tAdmin)).s, 403);
  assert.equal((await api("DELETE", "/contabilidad/cierre-mensual/2026/1?motivo=no", null, ids.tSuper)).s, 400);
  assert.equal((await api("DELETE", "/contabilidad/cierre-mensual/2026/1?motivo=correccion%20autorizada", null, ids.tSuper)).s, 200);
});

test("fotos de perfil: se guardan en la base de datos y sobreviven al disco", async () => {
  const subir = async (token, id, nombre, mime, bytes) => {
    const fd = new FormData();
    fd.append("foto", new Blob([bytes], { type: mime }), nombre);
    const r = await fetch(`${base}/api/usuarios/${id}/foto`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}` },
      body: fd,
    });
    return { s: r.status, b: await r.json().catch(() => null) };
  };

  // formato no permitido
  assert.equal((await subir(ids.tSocio, ids.socio, "x.exe", "application/octet-stream", "MZ")).s, 400);

  // un socio no puede cambiar la foto de otro
  assert.equal((await subir(ids.tSocio2, ids.socio, "a.png", "image/png", Buffer.from([1, 2, 3]))).s, 403);

  const png = Buffer.from("89504e470d0a1a0a0000000d49484452", "hex");
  const ok = await subir(ids.tSocio, ids.socio, "yo.png", "image/png", png);
  assert.equal(ok.s, 200);
  assert.match(ok.b.foto, /^\/uploads\/usuarios\/usuario_\d+_\d+\.png$/);

  // la imagen se sirve desde la base de datos (no hay archivo en disco)
  const fs = require("fs");
  const path = require("path");
  assert.equal(fs.existsSync(path.join(__dirname, "../..", ok.b.foto)), false);
  const img = await fetch(`${base}${ok.b.foto}`);
  assert.equal(img.status, 200);
  assert.equal(img.headers.get("content-type"), "image/png");
  assert.equal((await img.arrayBuffer()).byteLength, png.length);

  // al reemplazarla, la anterior se elimina
  await new Promise((r) => setTimeout(r, 5));
  const otra = await subir(ids.tSocio, ids.socio, "yo2.png", "image/png", png);
  assert.equal(otra.s, 200);
  assert.equal((await fetch(`${base}${ok.b.foto}`)).status, 404);
  assert.equal((await fetch(`${base}${otra.b.foto}`)).status, 200);
});

test("registro por enlace con préstamo: cuenta y solicitud llegan juntas", async () => {
  const codigo = (await api("GET", "/solicitudes/enlace", null, ids.tSuper)).b.codigo;

  // el formulario recibe los parámetros para la cuota estimada solo con un enlace válido
  const estado = await api("GET", `/registro/estado?c=${codigo}`);
  assert.equal(estado.s, 200);
  assert.ok(estado.b.parametros.monto_max > 0);
  assert.equal((await api("GET", "/registro/estado?c=otro")).b.parametros, null);

  const datos = {
    nombre_completo: "Socio Con Prestamo", dni: "0801000000020", telefono: "98761111",
    correo: "con.prestamo@prueba.hn", fecha_nacimiento: "1990-05-06", password: "Clave1234", codigo,
  };
  const prestamo = {
    monto: 5000, plazo_meses: 6, cuota_posible: 1100, proposito: "negocio", ocupacion: "negocio_propio",
    ingreso_mensual: 9000, acepta: true, referencias: [{ nombre: "Ana Prueba", telefono: "99990000" }],
  };

  // si la solicitud viene mal, no se crea nada
  const mal = await api("POST", "/registro", { ...datos, prestamo: { ...prestamo, proposito: "" } });
  assert.equal(mal.s, 400);
  const [[nadie]] = await pool.query("SELECT COUNT(*) AS n FROM usuarios WHERE dni = ?", [datos.dni]);
  assert.equal(nadie.n, 0);

  const ok = await api("POST", "/registro", { ...datos, prestamo });
  assert.equal(ok.s, 201);
  assert.ok(ok.b.id_prestamo);
  cerca(ok.b.cuota_estimada, 1148.04);

  const lista = await api("GET", "/solicitudes", null, ids.tSuper);
  const sol = lista.b.prestamos.find((x) => x.id_prestamo === ok.b.id_prestamo);
  assert.ok(sol);
  assert.equal(sol.estado_socio, "pendiente");
  assert.equal(sol.referencias.length, 1);

  // el socio la ve en su panel al entrar
  const t = (await api("POST", "/usuarios/login", { dni: datos.dni, password: datos.password })).b.token;
  const mias = await api("GET", "/solicitudes/mias", null, t);
  assert.equal(mias.b.data.length, 1);
  assert.equal(mias.b.data[0].estado, "pendiente");

  // rechazar al socio también cierra su solicitud
  assert.equal((await api("POST", `/solicitudes/socios/${ok.b.id_usuario}/rechazar`, { motivo: "Prueba" }, ids.tSuper)).s, 200);
  const [[pr]] = await pool.query("SELECT estado FROM prestamos WHERE id_prestamo = ?", [ok.b.id_prestamo]);
  assert.equal(pr.estado, "rechazado");
});

test("monitoreo: el estado del servicio responde", async () => {
  const r = await api("GET", "/salud");
  assert.equal(r.s, 200);
  assert.equal(r.b.estado, "ok");
  assert.ok(r.b.migraciones.aplicadas >= 7);
});
