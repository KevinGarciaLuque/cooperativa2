// Pruebas de integración: la API completa contra una base aparte (siempre *_test).
const { baseDePruebas } = require("../helpers/entorno");
const test = require("node:test");
const assert = require("node:assert/strict");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const { crearBaseDeDatos } = require("../../scripts/crear_bd");

// Los respaldos de las pruebas van a una carpeta temporal, nunca a backend/backups
process.env.BACKUPS_DIR = require("path").join(require("os").tmpdir(), `coop_respaldos_${process.pid}`);

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

// Registro por enlace: los datos van en "datos" y las fotos de la identidad como archivos
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==",
  "base64"
);
const registrar = async (datos, { frente = true, reverso = true } = {}) => {
  const f = new FormData();
  f.append("datos", JSON.stringify(datos));
  if (frente) f.append("dni_frente", new Blob([PNG], { type: "image/png" }), "frente.png");
  if (reverso) f.append("dni_reverso", new Blob([PNG], { type: "image/png" }), "reverso.png");
  const r = await fetch(`${base}/api/registro`, { method: "POST", body: f });
  return { s: r.status, b: await r.json().catch(() => null) };
};

// Toda solicitud de préstamo lleva un aval
const AVAL = [{ tipo: "aval", nombre: "aval prueba", telefono: "99990000", parentesco: "Hermano" }];

const subirFoto = async (id, lado, token, tipo = "image/png") => {
  const f = new FormData();
  f.append("foto", new Blob([PNG], { type: tipo }), `${lado}.png`);
  const r = await fetch(`${base}/api/socios/${id}/identidad/${lado}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: f,
  });
  return { s: r.status, b: await r.json().catch(() => null) };
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

test("lista de socios (Ventanilla): solo socios, con filtros y paginación", async () => {
  const todos = await api("GET", "/usuarios?rol=Socio&orden=nombre&limit=1&page=1", null, ids.tSuper);
  assert.equal(todos.s, 200);
  assert.equal(todos.b.data.length, 1);
  assert.equal(todos.b.data[0].rol, "Socio");
  assert.ok(todos.b.pagination.total >= 2);
  assert.ok(todos.b.pagination.totalPages >= 2);
  assert.ok("prestamos_vigentes" in todos.b.data[0] && "saldo_prestamos" in todos.b.data[0]);

  // ordenados por nombre
  const dos = await api("GET", "/usuarios?rol=Socio&orden=nombre&limit=50", null, ids.tSuper);
  const nombres = dos.b.data.map((u) => u.nombre_completo);
  assert.deepEqual(nombres, [...nombres].sort((a, b) => a.localeCompare(b, "es")));
  assert.ok(dos.b.data.every((u) => u.rol === "Socio"));

  // filtros rápidos
  for (const f of ["con_prestamo", "en_mora", "sin_prestamo"]) {
    assert.equal((await api("GET", `/usuarios?rol=Socio&filtro=${f}`, null, ids.tSuper)).s, 200);
  }
  // búsqueda por nombre
  const buscar = await api("GET", "/usuarios?rol=Socio&search=Uno%20Prueba", null, ids.tSuper);
  assert.equal(buscar.b.data.length, 1);
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

  assert.equal((await registrar(datos)).s, 403); // sin código
  assert.equal((await registrar({ ...datos, codigo, password: "abc" })).s, 400);
  // el correo es obligatorio: ahí recibirá sus recibos
  assert.equal((await registrar({ ...datos, codigo, correo: "" })).s, 400);
  assert.equal((await registrar({ ...datos, codigo, fecha_nacimiento: "2015-01-01" })).s, 400);
  // las dos fotos de la identidad son obligatorias
  assert.equal((await registrar({ ...datos, codigo }, { reverso: false })).s, 400);
  assert.equal((await api("POST", "/registro", { ...datos, codigo })).s, 400);

  const ok = await registrar({ ...datos, codigo });
  assert.equal(ok.s, 201);
  ids.nuevo = ok.b.id_usuario;
  assert.equal((await registrar({ ...datos, codigo })).s, 409); // duplicado

  const login = await api("POST", "/usuarios/login", { dni: datos.dni, password: datos.password });
  assert.equal(login.s, 200);
  assert.equal(login.b.usuario.estado, "pendiente");
  ids.tNuevo = login.b.token;

  assert.equal((await api("GET", "/cuentas", null, ids.tNuevo)).s, 403);
  assert.equal((await api("GET", "/solicitudes/parametros", null, ids.tNuevo)).s, 200);
});

test("identidad: fotos privadas, el socio sube las suyas y el personal las ve", async () => {
  const foto = async (id, lado, token) => {
    const r = await fetch(`${base}/api/socios/${id}/identidad/${lado}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    return { s: r.status, tipo: r.headers.get("content-type") || "" };
  };

  // las del registro llegaron y el personal las ve
  const estado = await api("GET", `/socios/${ids.nuevo}/identidad`, null, ids.tSuper);
  assert.equal(estado.s, 200);
  assert.ok(estado.b.data.frente && estado.b.data.reverso);
  const vista = await foto(ids.nuevo, "frente", ids.tSuper);
  assert.equal(vista.s, 200);
  assert.match(vista.tipo, /image\/png/);

  // nunca son públicas, ni las de otro socio
  assert.equal((await foto(ids.nuevo, "frente")).s, 401);
  assert.equal((await foto(ids.nuevo, "frente", ids.tSocio)).s, 403);
  assert.equal((await subirFoto(ids.nuevo, "frente", ids.tSocio)).s, 403);

  // el socio pendiente puede cambiarlas; solo se aceptan imágenes
  assert.equal((await subirFoto(ids.nuevo, "reverso", ids.tNuevo)).s, 201);
  assert.equal((await subirFoto(ids.nuevo, "reverso", ids.tNuevo, "application/pdf")).s, 400);

  // un socio activo sin fotos las sube desde su perfil, pero no puede reemplazarlas después
  assert.equal((await subirFoto(ids.socio, "frente", ids.tSocio)).s, 201);
  assert.equal((await subirFoto(ids.socio, "frente", ids.tSocio)).s, 403);
  assert.equal((await subirFoto(ids.socio, "frente", ids.tSuper)).s, 201); // el personal sí
  await pool.query("DELETE FROM documentos_identidad WHERE id_usuario = ?", [ids.socio]);
});

test("solicitud de préstamo: validaciones y una sola en trámite", async () => {
  const sol = {
    monto: 5000, plazo_meses: 6, cuota_posible: 1100, proposito: "negocio", ocupacion: "negocio_propio",
    ingreso_mensual: 9000, acepta: true, referencias: AVAL,
  };
  assert.equal((await api("POST", "/solicitudes/prestamo", { ...sol, monto: 99999999 }, ids.tNuevo)).s, 400);
  assert.equal((await api("POST", "/solicitudes/prestamo", { ...sol, acepta: false }, ids.tNuevo)).s, 400);
  // el aval es obligatorio; la referencia, opcional
  assert.equal((await api("POST", "/solicitudes/prestamo", { ...sol, referencias: [] }, ids.tNuevo)).s, 400);
  assert.equal(
    (await api("POST", "/solicitudes/prestamo", { ...sol, referencias: [{ tipo: "referencia", nombre: "Ana", telefono: "1" }] }, ids.tNuevo)).s,
    400
  );

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

  const [[u]] = await pool.query("SELECT estado, numero_socio FROM usuarios WHERE id_usuario = ?", [ids.nuevo]);
  assert.equal(u.estado, "activo");
  assert.ok(u.numero_socio > 0, "al aprobarlo recibe su número de socio");
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
    { monto: 1000, plazo_meses: 2, cuota_posible: 600, proposito: "otro", ocupacion: "empleado", ingreso_mensual: 8000, acepta: true, referencias: AVAL },
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

  // una solicitud ya aprobada no bloquea una nueva (y "cuánto puede pagar" ya no es obligatorio)
  const otra = await api(
    "POST", "/solicitudes/prestamo",
    {
      monto: 2000, plazo_meses: 4, proposito: "salud", ocupacion: "empleado",
      ingreso_mensual: 8000, acepta: true, referencias: AVAL,
    },
    t
  );
  assert.equal(otra.s, 201);
  // pero dos en revisión a la vez, no
  const tercera = await api(
    "POST", "/solicitudes/prestamo",
    {
      monto: 1000, plazo_meses: 2, cuota_posible: 600, proposito: "otro", ocupacion: "empleado",
      ingreso_mensual: 8000, acepta: true, referencias: AVAL,
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
  const mal = await registrar({ ...datos, prestamo: { ...prestamo, proposito: "" } });
  assert.equal(mal.s, 400);
  const [[nadie]] = await pool.query("SELECT COUNT(*) AS n FROM usuarios WHERE dni = ?", [datos.dni]);
  assert.equal(nadie.n, 0);

  const ok = await registrar({ ...datos, prestamo });
  assert.equal(ok.s, 201);
  assert.ok(ok.b.id_prestamo);
  cerca(ok.b.cuota_estimada, 1148.04);

  const lista = await api("GET", "/solicitudes", null, ids.tSuper);
  const sol = lista.b.prestamos.find((x) => x.id_prestamo === ok.b.id_prestamo);
  assert.ok(sol);
  assert.equal(sol.estado_socio, "pendiente");
  assert.equal(sol.referencias.length, 1);
  assert.equal(sol.referencias[0].tipo, "aval"); // sin "tipo", el primero es el aval
  assert.equal(sol.referencias[0].nombre, "Ana Prueba");

  // la ficha del socio muestra su aval; un socio no puede consultarla
  const ficha = await api("GET", `/solicitudes/socio/${ok.b.id_usuario}`, null, ids.tSuper);
  assert.equal(ficha.s, 200);
  assert.equal(ficha.b.data[0].referencias[0].tipo, "aval");
  assert.equal((await api("GET", `/solicitudes/socio/${ok.b.id_usuario}`, null, ids.tSocio)).s, 403);

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

test("firma digital: el personal guarda la suya y sale en sus documentos", async () => {
  const subir = async (token, tipo = "image/png") => {
    const f = new FormData();
    f.append("firma", new Blob([PNG], { type: tipo }), "firma.png");
    const r = await fetch(`${base}/api/firma/mia`, { method: "PUT", headers: { Authorization: `Bearer ${token}` }, body: f });
    return { s: r.status, b: await r.json().catch(() => null) };
  };

  assert.equal((await subir(ids.tSuper, "image/jpeg")).s, 400);

  assert.equal((await api("GET", "/firma/mia", null, ids.tSuper)).b.imagen, null);
  const ok = await subir(ids.tSuper);
  assert.equal(ok.s, 200);
  assert.match(ok.b.imagen, /^data:image\/png;base64,/);

  // los recibos que emitió el Super Administrador traen su firma
  const [[rec]] = await pool.query("SELECT id_recibo FROM recibos WHERE emitido_por = ? LIMIT 1", [ids.super]);
  const recibo = await api("GET", `/recibos/${rec.id_recibo}`, null, ids.tSuper);
  assert.match(recibo.b.data.firma_emisor, /^data:image\/png;base64,/);

  // la carta de aprobación se sigue generando con la firma
  const carta = await fetch(`${base}/api/solicitudes/prestamos/${ids.prestamoNuevo}/carta`, {
    headers: { Authorization: `Bearer ${ids.tSuper}` },
  });
  assert.equal(carta.status, 200);

  assert.equal((await api("DELETE", "/firma/mia", null, ids.tSuper)).s, 200);
  const sin = await api("GET", `/recibos/${rec.id_recibo}`, null, ids.tSuper);
  assert.equal(sin.b.data.firma_emisor, null);
});

test("firma del socio: firma digitalmente sus recibos o sube la copia firmada", async () => {
  const subirFirma = async (token) => {
    const f = new FormData();
    f.append("firma", new Blob([PNG], { type: "image/png" }), "firma.png");
    const r = await fetch(`${base}/api/firma/mia`, { method: "PUT", headers: { Authorization: `Bearer ${token}` }, body: f });
    return { s: r.status, b: await r.json().catch(() => null) };
  };
  const [ap] = await pool.query(
    `INSERT INTO recibos (tipo, referencia_tipo, referencia_id, id_socio, monto, metodo, concepto, emitido_por)
     VALUES ('aportacion', 'aportacion', 0, ?, 100, 'efectivo', 'Aportación', ?)`,
    [ids.socio, ids.super]
  );
  const idRecibo = ap.insertId;

  // sin firma guardada no puede firmar
  assert.equal((await api("GET", "/firma/mia", null, ids.tSocio)).b.imagen, null);
  const sinFirma = await api("POST", `/recibos/${idRecibo}/firmar`, {}, ids.tSocio);
  assert.equal(sinFirma.s, 400);
  assert.equal(sinFirma.b.sin_firma, true);

  assert.equal((await subirFirma(ids.tSocio)).s, 200);
  // nadie más firma por él: ni otro socio ni el personal
  assert.equal((await api("POST", `/recibos/${idRecibo}/firmar`, {}, ids.tSocio2)).s, 403);
  assert.equal((await api("POST", `/recibos/${idRecibo}/firmar`, {}, ids.tSuper)).s, 403);

  const firmado = await api("POST", `/recibos/${idRecibo}/firmar`, {}, ids.tSocio);
  assert.equal(firmado.s, 201);
  assert.match(firmado.b.data.firma_socio, /^data:image\/png;base64,/);
  assert.ok(firmado.b.data.firma_digital.firmado_en);
  assert.equal((await api("POST", `/recibos/${idRecibo}/firmar`, {}, ids.tSocio)).s, 409);

  // el documento conserva la firma aunque el socio la borre después
  assert.equal((await api("DELETE", "/firma/mia", null, ids.tSocio)).s, 200);
  const visto = await api("GET", `/recibos/${idRecibo}`, null, ids.tSuper);
  assert.match(visto.b.data.firma_socio, /^data:image\/png;base64,/);
  const lista = await api("GET", `/recibos/socio/${ids.socio}`, null, ids.tSocio);
  assert.ok(lista.b.data.find((r) => r.id_recibo === idRecibo).firma_digital);

  // también puede subir la copia firmada a mano de cualquier recibo
  const fd = new FormData();
  fd.append("archivo", new Blob([Buffer.from([0xff, 0xd8, 0xff, 0xe0, 9])], { type: "image/jpeg" }), "firmado.jpg");
  const subida = await fetch(`${base}/api/recibos/${idRecibo}/comprobante-firmado`, {
    method: "POST", headers: { Authorization: `Bearer ${ids.tSocio}` }, body: fd,
  });
  assert.equal(subida.status, 201);

  // un recibo anulado ya no se firma
  await pool.query("UPDATE recibos SET anulado = 1 WHERE id_recibo = ?", [idRecibo]);
  await subirFirma(ids.tSocio);
  await pool.query("DELETE FROM firmas_documento WHERE id_recibo = ?", [idRecibo]);
  assert.equal((await api("POST", `/recibos/${idRecibo}/firmar`, {}, ids.tSocio)).s, 400);
  await pool.query("DELETE FROM comprobantes_firmados WHERE id_recibo = ?", [idRecibo]);
  await pool.query("DELETE FROM recibos WHERE id_recibo = ?", [idRecibo]);
});

test("recordatorios de pago: texto para WhatsApp, envío manual y automático", async () => {
  // un préstamo vigente con 40 días desde que se otorgó (en mora)
  const [nuevo] = await pool.query(
    `INSERT INTO prestamos (id_usuario, monto, tasa_interes, plazo_meses, saldo_restante, estado, fecha_otorgado)
     VALUES (?, 4000, 24, 6, 4000, 'activo', DATE_SUB(NOW(), INTERVAL 70 DAY))`,
    [ids.socio2]
  );
  const id = nuevo.insertId;

  const txt = await api("GET", `/cobranza/recordatorio/${id}`, null, ids.tSuper);
  assert.equal(txt.s, 200);
  assert.equal(txt.b.data.tipo, "mora");
  assert.match(txt.b.data.texto, /atraso/);
  assert.equal((await api("GET", `/cobranza/recordatorio/${id}`, null, ids.tSocio)).s, 403);

  // sin servidor de correo lo dice claramente
  const manual = await api("POST", `/cobranza/recordatorio/${id}`, {}, ids.tSuper);
  assert.equal(manual.s, 400);
  assert.match(manual.b.message, /correo/i);

  assert.equal((await api("POST", "/cobranza/recordatorios/ejecutar", {}, ids.tAdmin)).s, 403);
  assert.equal((await api("POST", "/cobranza/recordatorios/ejecutar", {}, ids.tSuper)).s, 400);

  await pool.query("DELETE FROM prestamos WHERE id_prestamo = ?", [id]);
});

test("pagos reportados por el socio: reportar, confirmar en Pagos y rechazar", async () => {
  const [pr] = await pool.query(
    `INSERT INTO prestamos (id_usuario, monto, tasa_interes, plazo_meses, saldo_restante, estado, fecha_otorgado)
     VALUES (?, 5000, 24, 6, 5000, 'activo', DATE_SUB(NOW(), INTERVAL 10 DAY))`,
    [ids.socio]
  );
  const idPrestamo = pr.insertId;
  const hoy = require("../../utils/fechas").hoyISO(); // la fecha de hoy según la zona de la cooperativa
  const reportar = async (token, datos, conArchivo = true) => {
    const f = new FormData();
    Object.entries(datos).forEach(([k, v]) => f.append(k, String(v)));
    if (conArchivo) f.append("comprobante", new Blob([PNG], { type: "image/png" }), "comprobante.png");
    const r = await fetch(`${base}/api/pagos-reportados`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: f });
    return { s: r.status, b: await r.json().catch(() => null) };
  };
  const datos = { id_prestamo: idPrestamo, monto: 900, metodo: "Transferencia", banco: "Banco Atlántida", referencia: "TRX-123", fecha_pago: hoy };

  assert.equal((await reportar(ids.tSocio, datos, false)).s, 400); // sin comprobante
  assert.equal((await reportar(ids.tSocio, { ...datos, fecha_pago: "2999-01-01" })).s, 400); // fecha futura
  assert.equal((await reportar(ids.tSocio2, datos)).s, 404); // préstamo ajeno
  assert.equal((await reportar(ids.tSuper, datos)).s, 403); // solo el socio reporta
  const demas = await reportar(ids.tSocio, { ...datos, monto: 999999 }); // más de lo que debe
  assert.equal(demas.s, 400);
  assert.ok(demas.b.total_para_saldar > 5000 && demas.b.total_para_saldar < 5200);
  const ok = await reportar(ids.tSocio, datos);
  assert.equal(ok.s, 201);
  const idReporte = ok.b.id_reporte;
  assert.equal((await reportar(ids.tSocio, datos)).s, 409); // uno en revisión por préstamo

  // el comprobante solo lo ven el dueño y el personal
  const ver = async (token) =>
    (await fetch(`${base}/api/pagos-reportados/${idReporte}/comprobante`, { headers: { Authorization: `Bearer ${token}` } })).status;
  assert.equal(await ver(ids.tSocio), 200);
  assert.equal(await ver(ids.tSuper), 200);
  assert.equal(await ver(ids.tSocio2), 403);

  const resumen = await api("GET", "/solicitudes/resumen", null, ids.tSuper);
  assert.ok(resumen.b.pagos_reportados >= 1);
  const lista = await api("GET", "/pagos-reportados?estado=pendiente", null, ids.tSuper);
  assert.ok(lista.b.data.some((r) => r.id_reporte === idReporte));
  assert.equal((await api("GET", "/pagos-reportados?estado=pendiente", null, ids.tSocio)).s, 403);

  // al registrar el pago en Pagos se confirma el reporte
  const otro = await api("POST", "/pagos", { id_prestamo: ids.prestamoNuevo, monto_pagado: 900, id_reporte: idReporte }, ids.tSuper);
  assert.equal(otro.s, 400); // reporte de otro préstamo
  const pago = await api(
    "POST", "/pagos",
    { id_prestamo: idPrestamo, monto_pagado: 900, metodo_pago: "Transferencia", fecha_pago: hoy, id_reporte: idReporte },
    ids.tSuper
  );
  assert.equal(pago.s, 201);
  const [[conf]] = await pool.query("SELECT estado, id_pago FROM pagos_reportados WHERE id_reporte = ?", [idReporte]);
  assert.equal(conf.estado, "confirmado");
  assert.equal(conf.id_pago, pago.b.id_pago);

  // rechazar otro reporte
  const segundo = await reportar(ids.tSocio, { ...datos, referencia: "TRX-999" });
  assert.equal(segundo.s, 201);
  assert.equal((await api("POST", `/pagos-reportados/${segundo.b.id_reporte}/rechazar`, {}, ids.tSuper)).s, 400);
  assert.equal(
    (await api("POST", `/pagos-reportados/${segundo.b.id_reporte}/rechazar`, { motivo: "No aparece en el banco" }, ids.tSuper)).s,
    200
  );
  const mios = await api("GET", "/pagos-reportados/mios", null, ids.tSocio);
  assert.equal(mios.b.data.find((r) => r.id_reporte === segundo.b.id_reporte).estado, "rechazado");
  assert.equal(mios.b.data.find((r) => r.id_reporte === idReporte).estado, "confirmado");

  // el socio recibe en su campanita el pago confirmado (con su recibo) y el rechazo
  let avisos;
  for (let i = 0; i < 20; i++) {
    avisos = await api("GET", "/notificaciones", null, ids.tSocio);
    if (avisos.b.data.some((n) => n.tipo === "pago_rechazado")) break;
    await new Promise((r) => setTimeout(r, 50));
  }
  assert.equal(avisos.s, 200);
  const confirmado = avisos.b.data.find((n) => n.titulo === "Tu pago fue confirmado");
  assert.ok(confirmado);
  assert.equal(confirmado.id_recibo, pago.b.id_recibo);
  assert.equal(confirmado.leida, false);
  assert.ok(avisos.b.data.some((n) => n.tipo === "pago_rechazado" && /No aparece en el banco/.test(n.mensaje)));
  assert.ok(avisos.b.sin_leer >= 2);
  const recibo = await api("GET", `/recibos/${confirmado.id_recibo}`, null, ids.tSocio);
  assert.equal(recibo.s, 200);

  // cada uno solo ve y marca las suyas
  const ajenas = await api("GET", "/notificaciones", null, ids.tSocio2);
  assert.ok(!ajenas.b.data.some((n) => n.id_notificacion === confirmado.id_notificacion));
  await api("POST", "/notificaciones/leer", { id: confirmado.id_notificacion }, ids.tSocio2);
  const [[sigue]] = await pool.query("SELECT leida FROM notificaciones WHERE id_notificacion = ?", [confirmado.id_notificacion]);
  assert.equal(sigue.leida, 0);
  assert.equal((await api("POST", "/notificaciones/leer", { id: confirmado.id_notificacion }, ids.tSocio)).s, 200);
  assert.equal((await api("POST", "/notificaciones/leer", {}, ids.tSocio)).s, 200);
  assert.equal((await api("GET", "/notificaciones", null, ids.tSocio)).b.sin_leer, 0);
});

test("políticas: borrador, publicación, aceptación del socio y nuevas versiones", async () => {
  // los borradores iniciales no se muestran hasta publicarlos
  assert.equal((await api("GET", "/politicas/publicas")).b.data.length, 0);
  const lista = await api("GET", "/politicas", null, ids.tSuper);
  assert.equal(lista.s, 200);
  assert.ok(lista.b.data.length >= 3);
  assert.equal((await api("GET", "/politicas", null, ids.tAdmin)).s, 403);
  assert.equal((await api("GET", "/politicas", null, ids.tSocio)).s, 403);
  const reglamento = lista.b.data.find((p) => /Reglamento/.test(p.titulo));
  assert.equal(reglamento.version, 0);

  // solo el Super Administrador edita y publica
  assert.equal((await api("POST", `/politicas/${reglamento.id_politica}/publicar`, {}, ids.tAdmin)).s, 403);
  const pub = await api("POST", `/politicas/${reglamento.id_politica}/publicar`, {}, ids.tSuper);
  assert.equal(pub.s, 200);
  assert.equal(pub.b.version, 1);
  assert.equal(pub.b.pide_aceptacion, true);

  // publicada: se ve sin sesión, con los parámetros llenos
  const publicas = await api("GET", "/politicas/publicas");
  assert.equal(publicas.b.data.length, 1);
  assert.match(publicas.b.data[0].contenido, /\d+% anual/);
  assert.ok(!/\{mora_tasa_anual\}/.test(publicas.b.data[0].contenido));

  // el socio la tiene pendiente y le llega el aviso
  const mias = await api("GET", "/politicas/mias", null, ids.tSocio);
  assert.equal(mias.b.pendientes, 1);
  const avisos = await api("GET", "/notificaciones", null, ids.tSocio);
  assert.ok(avisos.b.data.some((n) => /Nueva política/.test(n.titulo)));
  const acepto = await api("POST", "/politicas/aceptar", {}, ids.tSocio);
  assert.equal(acepto.s, 200);
  assert.equal(acepto.b.pendientes, 0);

  // un cambio menor no pide aceptarla otra vez; uno importante sí
  const editar = await api("PUT", `/politicas/${reglamento.id_politica}`, { titulo: reglamento.titulo, contenido: reglamento.contenido + "\n- Nuevo punto." }, ids.tSuper);
  assert.equal(editar.s, 200);
  assert.equal((await api("GET", "/politicas/publicas")).b.data[0].contenido.includes("Nuevo punto"), false); // el borrador no se publica solo
  await api("POST", `/politicas/${reglamento.id_politica}/publicar`, { pedir_aceptacion: false }, ids.tSuper);
  assert.equal((await api("GET", "/politicas/mias", null, ids.tSocio)).b.pendientes, 0);
  await api("POST", `/politicas/${reglamento.id_politica}/publicar`, { pedir_aceptacion: true }, ids.tSuper);
  assert.equal((await api("GET", "/politicas/mias", null, ids.tSocio)).b.pendientes, 1);

  // el personal ve qué aceptó el socio; la lista de aceptaciones es del Super Administrador
  const ficha = await api("GET", `/politicas/socio/${ids.socio}`, null, ids.tAdmin);
  assert.equal(ficha.s, 200);
  assert.equal(ficha.b.data[0].version_aceptada, 1);
  assert.equal((await api("GET", `/politicas/socio/${ids.socio}`, null, ids.tSocio2)).s, 403);
  const acep = await api("GET", `/politicas/${reglamento.id_politica}/aceptaciones`, null, ids.tSuper);
  assert.equal(acep.s, 200);
  assert.ok(acep.b.data.some((r) => r.id_usuario === ids.socio && !r.aceptada));

  // retirarla la oculta
  assert.equal((await api("DELETE", `/politicas/${reglamento.id_politica}`, null, ids.tSuper)).s, 200);
  assert.equal((await api("GET", "/politicas/publicas")).b.data.length, 0);
});

test("consolidación: junta préstamos vigentes en uno nuevo, solo el Super Administrador", async () => {
  const hash = await bcrypt.hash("Clave1234", 4);
  const [u] = await pool.query(
    `INSERT INTO usuarios (nombre_completo, dni, telefono, correo, password, rol_id, estado, fecha_registro)
     VALUES ('Socio Consolida Prueba', '0801000000077', '98765432', 'consolida@prueba.hn', ?, 2, 'activo', NOW())`,
    [hash]
  );
  const idSocio = u.insertId;
  const prestamo = async (monto, plazo, dias) =>
    (
      await pool.query(
        `INSERT INTO prestamos (id_usuario, monto, tasa_interes, tipo_tasa, tasa_original, plazo_meses, saldo_restante, estado, fecha_otorgado)
         VALUES (?, ?, 120, 'nominal_mensual', 10, ?, ?, 'activo', DATE_SUB(NOW(), INTERVAL ? DAY))`,
        [idSocio, monto, plazo, monto, dias]
      )
    )[0].insertId;
  const l1 = await prestamo(5000, 6, 10); // un mes de interés (500), sin mora
  const l2 = await prestamo(3000, 3, 50); // 50 días de interés (500) y 20 días de mora

  const q = `id_usuario=${idSocio}&ids=${l1},${l2}&tasa_mensual=12&plazo_meses=12&adicional=1000`;

  // permisos: solo el Super Administrador
  assert.equal((await api("GET", `/consolidaciones/simular?${q}`, null, ids.tAdmin)).s, 403);
  assert.equal((await api("GET", `/consolidaciones/simular?${q}`, null, ids.tSocio)).s, 403);

  // validaciones
  assert.equal((await api("GET", `/consolidaciones/simular?id_usuario=${idSocio}&ids=${l1}&tasa_mensual=12&plazo_meses=12`, null, ids.tSuper)).s, 400);
  const ajeno = await prestamo(1000, 2, 5);
  await pool.query("UPDATE prestamos SET id_usuario = ? WHERE id_prestamo = ?", [ids.socio2, ajeno]);
  assert.equal((await api("GET", `/consolidaciones/simular?id_usuario=${idSocio}&ids=${l1},${ajeno}&tasa_mensual=12&plazo_meses=12`, null, ids.tSuper)).s, 400);

  // simulación: capital + interés + mora + adicional
  const sim = await api("GET", `/consolidaciones/simular?${q}`, null, ids.tSuper);
  assert.equal(sim.s, 200);
  cerca(sim.b.data.capital, 8000);
  cerca(sim.b.data.interes_capitalizado, 1000, 0.5);
  assert.ok(sim.b.data.mora_capitalizada > 35 && sim.b.data.mora_capitalizada < 45);
  cerca(sim.b.data.monto_nuevo, 8000 + 1000 + sim.b.data.mora_capitalizada + 1000, 0.5);
  assert.ok(sim.b.data.cuota_nueva > 0 && sim.b.data.total_a_pagar > sim.b.data.monto_nuevo);

  // omitir la mora la saca del monto nuevo
  const sinMora = await api("GET", `/consolidaciones/simular?${q}&omitir_mora=1`, null, ids.tSuper);
  assert.equal(sinMora.b.data.mora_capitalizada, 0);
  assert.ok(sinMora.b.data.mora_condonada > 35);

  // confirmar exige motivo
  const cuerpo = { id_usuario: idSocio, ids: [l1, l2], tasa_mensual: 12, plazo_meses: 12, adicional: 1000, metodo_adicional: "efectivo" };
  assert.equal((await api("POST", "/consolidaciones", { ...cuerpo, motivo: "x" }, ids.tSuper)).s, 400);
  assert.equal((await api("POST", "/consolidaciones", { ...cuerpo, motivo: "Prueba automática" }, ids.tAdmin)).s, 403);

  const ok = await api("POST", "/consolidaciones", { ...cuerpo, motivo: "Prueba automática de consolidación" }, ids.tSuper);
  assert.equal(ok.s, 201);
  const nuevoId = ok.b.id_prestamo_nuevo;

  const [[n]] = await pool.query("SELECT * FROM prestamos WHERE id_prestamo = ?", [nuevoId]);
  assert.equal(n.estado, "activo");
  assert.equal(parseFloat(n.tasa_original), 12);
  assert.equal(n.plazo_meses, 12);
  cerca(parseFloat(n.monto), ok.b.data.monto_nuevo);
  cerca(parseFloat(n.saldo_restante), ok.b.data.monto_nuevo);

  // los anteriores quedan consolidados, con saldo 0 y apuntando al nuevo
  const [viejos] = await pool.query("SELECT estado, saldo_restante, consolidado_en_prestamo FROM prestamos WHERE id_prestamo IN (?, ?)", [l1, l2]);
  assert.ok(viejos.every((v) => v.estado === "consolidado" && parseFloat(v.saldo_restante) === 0 && v.consolidado_en_prestamo === nuevoId));

  // caja: solo sale el monto adicional
  const [caja] = await pool.query("SELECT tipo, monto FROM caja_movimientos WHERE referencia_tipo = 'prestamo' AND referencia_id = ?", [nuevoId]);
  assert.equal(caja.length, 1);
  assert.equal(caja[0].tipo, "egreso");
  cerca(parseFloat(caja[0].monto), 1000);

  // convenio con numeración propia
  const [[rec]] = await pool.query("SELECT id_recibo, tipo FROM recibos WHERE referencia_tipo = 'prestamo' AND referencia_id = ?", [nuevoId]);
  assert.equal(rec.tipo, "consolidacion");
  const convenio = await api("GET", `/recibos/${rec.id_recibo}`, null, ids.tSuper);
  assert.match(convenio.b.data.numero, /^C-\d{6}$/);
  assert.equal(convenio.b.data.detalle.prestamos.length, 2);

  // un préstamo consolidado ya no se paga, edita ni elimina; no se vuelve a consolidar
  assert.equal((await api("POST", "/pagos", { id_prestamo: l1, monto_pagado: 100 }, ids.tSuper)).s, 400);
  assert.equal((await api("PUT", `/prestamos/${l1}`, { estado: "activo" }, ids.tSuper)).s, 409);
  assert.equal((await api("DELETE", `/prestamos/${l1}`, null, ids.tSuper)).s, 409);
  assert.equal((await api("GET", `/consolidaciones/simular?id_usuario=${idSocio}&ids=${l1},${l2}&tasa_mensual=12&plazo_meses=12`, null, ids.tSuper)).s, 400);

  // el préstamo nuevo sí se paga con normalidad
  assert.equal((await api("POST", "/pagos", { id_prestamo: nuevoId, monto_pagado: 500, tipo_pago: "libre" }, ids.tSuper)).s, 201);

  // el interés y la mora capitalizados cuentan como ingreso del mes
  const { anioMesActual } = require("../../utils/fechas");
  const { anio, mes } = anioMesActual();
  const res = await api("GET", `/contabilidad/estado-resultados?anio=${anio}&mes=${mes}`, null, ids.tSuper);
  assert.ok(res.b.data.ingresos.intereses_capitalizados > 1000);
});

test("número de socio: correlativo, sin tocar al personal ni a los pendientes", async () => {
  // Como en una base que ya tenía socios: se borran los números y se vuelve a aplicar la migración
  await pool.query("UPDATE usuarios SET numero_socio = NULL");
  await pool.query("DELETE FROM schema_migraciones WHERE id = '2026_11_001_numero_socio'");
  const { aplicarMigraciones } = require("../../utils/migraciones");
  await aplicarMigraciones();

  const [filas] = await pool.query(
    `SELECT u.id_usuario, u.numero_socio, u.estado, r.nombre AS rol FROM usuarios u
       JOIN roles r ON r.id_rol = u.rol_id ORDER BY u.fecha_registro, u.id_usuario`
  );
  const socios = filas.filter((f) => f.rol === "Socio" && ["activo", "inactivo"].includes(f.estado));
  assert.deepEqual(socios.map((f) => f.numero_socio), socios.map((_, i) => i + 1), "1, 2, 3... por antigüedad");
  for (const f of filas.filter((f) => !socios.includes(f))) {
    assert.equal(f.numero_socio, null, `${f.rol} ${f.estado} no lleva número`);
  }

  // un socio nuevo creado por el personal recibe el siguiente número
  const nuevo = await api(
    "POST", "/usuarios",
    {
      nombre_completo: "Socio Numerado Prueba", dni: "0801000000452", password: "Clave1234", rol_id: 2,
      telefono: "98765432", correo: "numerado@prueba.hn", fecha_nacimiento: "1990-01-01",
    },
    ids.tSuper
  );
  assert.equal(nuevo.s, 201, nuevo.b?.message);
  const [[n]] = await pool.query("SELECT numero_socio FROM usuarios WHERE id_usuario = ?", [nuevo.b.id_usuario]);
  assert.equal(n.numero_socio, socios.length + 1);

  // se ve al iniciar sesión y sirve para buscar
  const login = await api("POST", "/usuarios/login", { dni: "0801000000452", password: "Clave1234" });
  assert.equal(login.b.usuario.numero_socio, n.numero_socio);
  const busca = await api("GET", `/usuarios?search=%23${n.numero_socio}`, null, ids.tSuper);
  assert.ok(busca.b.data.some((u) => u.id_usuario === nuevo.b.id_usuario));

  // desactivarlo y reactivarlo no le cambia el número
  await api("PATCH", `/usuarios/${nuevo.b.id_usuario}/estado`, { estado: "inactivo" }, ids.tSuper);
  await api("PATCH", `/usuarios/${nuevo.b.id_usuario}/estado`, { estado: "activo" }, ids.tSuper);
  const [[otra]] = await pool.query("SELECT numero_socio FROM usuarios WHERE id_usuario = ?", [nuevo.b.id_usuario]);
  assert.equal(otra.numero_socio, n.numero_socio);
});

test("país: Honduras por defecto; el Super Administrador lo cambia y valida el documento del país", async () => {
  const cfg = await api("GET", "/configuracion");
  assert.equal(cfg.b.data.pais, "HN");
  assert.equal(cfg.b.data.pais_datos.moneda.simbolo, "L.");
  assert.ok(cfg.b.data.paises.some((p) => p.codigo === "GT"));

  assert.equal((await api("PUT", "/configuracion", { pais: "GT" }, ids.tAdmin)).s, 403);
  assert.equal((await api("PUT", "/configuracion", { pais: "XX" }, ids.tSuper)).s, 400);
  try {
    assert.equal((await api("PUT", "/configuracion", { pais: "GT" }, ids.tSuper)).s, 200);
    const gt = await api("GET", "/configuracion");
    assert.equal(gt.b.data.pais_datos.identidad.nombre, "DPI");

    const datos = {
      nombre_completo: "Socia Guatemala Prueba", password: "Clave1234", rol_id: 2,
      telefono: "55551234", correo: "guate@prueba.hn", fecha_nacimiento: "1990-01-01",
    };
    const malo = await api("POST", "/usuarios", { ...datos, dni: "12345" }, ids.tSuper);
    assert.equal(malo.s, 400);
    assert.match(malo.b.message, /DPI/);
    // el DPI se acepta con espacios y se guarda limpio
    const ok = await api("POST", "/usuarios", { ...datos, dni: "2547 89632 0101" }, ids.tSuper);
    assert.equal(ok.s, 201, ok.b?.message);
    const [[u]] = await pool.query("SELECT dni FROM usuarios WHERE id_usuario = ?", [ok.b.id_usuario]);
    assert.equal(u.dni, "2547896320101");
    // y se puede entrar escribiéndolo con espacios
    const login = await api("POST", "/usuarios/login", { dni: "2547 89632 0101", password: "Clave1234" });
    assert.equal(login.s, 200);
  } finally {
    assert.equal((await api("PUT", "/configuracion", { pais: "HN" }, ids.tSuper)).s, 200);
  }
  const hn = await api("GET", "/configuracion");
  assert.equal(hn.b.data.pais, "HN");
});

test("respaldos: activados por defecto, configuración en la base y copia externa", async () => {
  const http = require("http");
  const zlib = require("zlib");

  // Por defecto: activados, diario, y la configuración queda guardada en la base
  const cfg = await api("GET", "/basedatos/config-backup", null, ids.tSuper);
  assert.equal(cfg.s, 200);
  assert.equal(cfg.b.config.activo, true);
  assert.equal(cfg.b.externo.configurado, false);
  const cambio = await api("POST", "/basedatos/config-backup", { hora: "03:30", max_backups: 5 }, ids.tSuper);
  assert.equal(cambio.s, 200);
  const [[fila]] = await pool.query("SELECT valor FROM configuracion_sitio WHERE clave = 'respaldo_config'");
  assert.equal(JSON.parse(fila.valor).hora, "03:30", "sobrevive a un redespliegue: está en la base");

  // Almacenamiento externo de mentira: recibe la subida y la revisa
  const recibidos = [];
  let responder = 200;
  const s3 = http.createServer((req, res) => {
    const partes = [];
    req.on("data", (c) => partes.push(c));
    req.on("end", () => {
      recibidos.push({ metodo: req.method, url: req.url, auth: req.headers.authorization, cuerpo: Buffer.concat(partes) });
      res.statusCode = responder;
      res.end(responder === 200 ? "" : "<Error><Code>AccessDenied</Code></Error>");
    });
  });
  await new Promise((ok) => s3.listen(0, "127.0.0.1", ok));
  const anteriores = { ...process.env };
  Object.assign(process.env, {
    RESPALDO_S3_ENDPOINT: `http://127.0.0.1:${s3.address().port}`,
    RESPALDO_S3_BUCKET: "coop-respaldos",
    RESPALDO_S3_ACCESS_KEY: "CLAVEPRUEBA",
    RESPALDO_S3_SECRET_KEY: "secreto-de-prueba",
    RESPALDO_S3_REGION: "auto",
  });
  try {
    const ok = await api("POST", "/basedatos/ejecutar-backup", null, ids.tSuper);
    assert.equal(ok.s, 200, ok.b?.message);
    assert.equal(ok.b.externo_ok, true);
    assert.equal(recibidos.length, 1);
    const r = recibidos[0];
    assert.equal(r.metodo, "PUT");
    assert.match(r.url, /^\/coop-respaldos\/respaldos\/DBcooperativa_.*\.sql\.gz$/);
    assert.match(r.auth, /^AWS4-HMAC-SHA256 Credential=CLAVEPRUEBA\/\d{8}\/auto\/s3\/aws4_request/);
    const sql = zlib.gunzipSync(r.cuerpo).toString("utf8");
    assert.match(sql, /CREATE TABLE `usuarios`/);
    assert.match(sql, /INSERT INTO `usuarios`/);
    const estado = await api("GET", "/basedatos/config-backup", null, ids.tSuper);
    assert.equal(estado.b.externo.configurado, true);
    assert.equal(estado.b.externo.error, null);
    assert.ok(estado.b.externo.ultimo);

    // si el almacenamiento falla, el respaldo igual queda en el servidor y se avisa
    responder = 403;
    const falla = await api("POST", "/basedatos/ejecutar-backup", null, ids.tSuper);
    assert.equal(falla.s, 200);
    assert.equal(falla.b.externo_ok, false);
    assert.match(falla.b.message, /No se pudo subir la copia externa/);
    const tras = await api("GET", "/basedatos/config-backup", null, ids.tSuper);
    assert.match(tras.b.externo.error, /403/);
  } finally {
    for (const k of Object.keys(process.env)) if (k.startsWith("RESPALDO_S3_") && !(k in anteriores)) delete process.env[k];
    await new Promise((ok) => s3.close(ok));
  }
});

test("plan de pagos: vencimientos y atraso; el socio ve el suyo sin intereses", async () => {
  const { generarPlan, sumarMeses } = require("../../utils/planPagos");
  const { hoyISO } = require("../../utils/fechas");
  // Préstamo desembolsado hace 3 meses y 10 días a 6 meses; pagó solo la 1.ª cuota
  const inicio = sumarMeses(hoyISO(), -3).replace(/-(\d\d)$/, (m, d) => `-${String(Math.max(1, Number(d) - 10)).padStart(2, "0")}`);
  const plan = generarPlan({ monto: 6000, tasaAnual: 24, plazo: 6, fechaInicio: inicio });
  const [r] = await pool.query(
    `INSERT INTO prestamos (id_usuario, monto, tasa_interes, plazo_meses, saldo_restante, estado, fecha_otorgado)
     VALUES (?, 6000, 24, 6, ?, 'activo', ?)`,
    [ids.socio, plan[0].saldo, `${inicio} 12:00:00`]
  );
  try {
    const personal = await api("GET", `/prestamos/${r.insertId}/plan`, null, ids.tSuper);
    assert.equal(personal.s, 200);
    assert.equal(personal.b.plan.length, 6);
    assert.equal(personal.b.plan[0].estado, "pagada");
    assert.equal(personal.b.plan[1].estado, "vencida");
    assert.ok(personal.b.resumen.cuotas_vencidas >= 1);
    assert.ok(personal.b.resumen.dias_atraso > 30);
    assert.ok(personal.b.plan[0].interes > 0, "el personal ve el desglose");

    const socio = await api("GET", `/prestamos/${r.insertId}/plan`, null, ids.tSocio);
    assert.equal(socio.s, 200);
    assert.equal(socio.b.plan[1].estado, "vencida");
    assert.ok(socio.b.plan[1].cuota > 0, "ve su cuota");
    assert.equal(socio.b.plan[0].interes, undefined, "sin intereses");
    assert.equal(socio.b.plan[0].capital, undefined, "sin desglose de capital");
    assert.equal(socio.b.resumen.capital_vencido, undefined);

    assert.equal((await api("GET", `/prestamos/${r.insertId}/plan`, null, ids.tSocio2)).s, 403, "otro socio no lo ve");

    // Cobranza clasifica por el atraso de la cuota más antigua sin pagar
    const cartera = await api("GET", "/cobranza/cartera", null, ids.tSuper);
    const fila = cartera.b.data.find((f) => f.id_prestamo === r.insertId);
    assert.equal(fila.dias_atraso, personal.b.resumen.dias_atraso);
    assert.equal(fila.cuotas_vencidas, personal.b.resumen.cuotas_vencidas);
    assert.equal(fila.vencimiento, personal.b.plan[1].fecha_vencimiento, "vence la cuota que debe");
    const esperada = fila.dias_atraso > 90 ? "mora_90_mas" : fila.dias_atraso > 60 ? "mora_61_90" : "mora_31_60";
    assert.equal(fila.categoria, esperada);
  } finally {
    await pool.query("DELETE FROM prestamos WHERE id_prestamo = ?", [r.insertId]);
  }
});

test("productos de crédito: los crea el Super Administrador y mandan en las solicitudes", async () => {
  const producto = {
    nombre: "Consumo Prueba", tasa_mensual: 2.5, monto_min: 1000, monto_max: 20000,
    plazo_min: 3, plazo_max: 24, garantia_requerida: "aval",
  };
  assert.equal((await api("POST", "/productos", producto, ids.tAdmin)).s, 403);
  assert.equal((await api("POST", "/productos", { ...producto, monto_min: 50000 }, ids.tSuper)).s, 400);
  const creado = await api("POST", "/productos", producto, ids.tSuper);
  assert.equal(creado.s, 201, creado.b?.message);
  const idProd = creado.b.data.id_producto;
  assert.equal((await api("POST", "/productos", producto, ids.tSuper)).s, 409, "nombre repetido");
  assert.equal((await api("GET", "/productos", null, ids.tAdmin)).s, 200, "el personal los consulta");
  assert.equal((await api("GET", "/productos", null, ids.tSocio)).s, 403, "el socio no entra a la lista");

  // Un socio nuevo, sin solicitudes en trámite
  const [u] = await pool.query(
    `INSERT INTO usuarios (nombre_completo, dni, telefono, correo, password, rol_id, estado, fecha_registro)
     VALUES ('Socio Productos Prueba', '0801000000611', '98765432', 'productos@prueba.hn', 'x', 2, 'activo', NOW())`
  );
  const t = tokenDe(u.insertId, "Socio", 2);
  const base = { monto: 5000, plazo_meses: 12, proposito: "consumo", ocupacion: "empleado", ingreso_mensual: 9000, acepta: true, referencias: AVAL };
  try {
    const params = await api("GET", "/solicitudes/parametros", null, t);
    const visto = params.b.data.productos.find((p) => p.id_producto === idProd);
    assert.ok(visto, "el socio ve el producto al solicitar");
    assert.equal(visto.tasa_mensual, 2.5);

    const sin = await api("POST", "/solicitudes/prestamo", base, t);
    assert.equal(sin.s, 400);
    assert.match(sin.b.message, /tipo de préstamo/);
    const fuera = await api("POST", "/solicitudes/prestamo", { ...base, id_producto: idProd, plazo_meses: 36 }, t);
    assert.equal(fuera.s, 400);
    assert.match(fuera.b.message, /de 3 a 24 meses/);

    const ok = await api("POST", "/solicitudes/prestamo", { ...base, id_producto: idProd }, t);
    assert.equal(ok.s, 201, ok.b?.message);
    const [avales] = await pool.query("SELECT aval_nombre FROM garantias WHERE id_prestamo = ? AND tipo = 'aval'", [ok.b.id_prestamo]);
    assert.equal(avales.length, 1, "el aval de la solicitud queda como garantía");
    const [[pr]] = await pool.query("SELECT id_producto, tasa_interes FROM prestamos WHERE id_prestamo = ?", [ok.b.id_prestamo]);
    assert.equal(pr.id_producto, idProd);
    cerca(parseFloat(pr.tasa_interes), 30); // 2.5% mensual = 30% anual

    // Desactivado: deja de ofrecerse y las solicitudes vuelven a los parámetros generales
    assert.equal((await api("PUT", `/productos/${idProd}`, { activo: false }, ids.tSuper)).s, 200);
    const despues = await api("GET", "/solicitudes/parametros", null, t);
    assert.ok(!despues.b.data.productos.some((p) => p.id_producto === idProd));
  } finally {
    await pool.query("UPDATE productos_credito SET activo = 0 WHERE id_producto = ?", [idProd]);
    await pool.query("DELETE g FROM garantias g JOIN prestamos p ON p.id_prestamo = g.id_prestamo WHERE p.id_usuario = ?", [u.insertId]);
    await pool.query("DELETE s FROM solicitudes_prestamo s JOIN prestamos p ON p.id_prestamo = s.id_prestamo WHERE p.id_usuario = ?", [u.insertId]);
    await pool.query("DELETE FROM prestamos WHERE id_usuario = ?", [u.insertId]);
    await pool.query("DELETE FROM notificaciones WHERE id_usuario = ?", [u.insertId]).catch(() => {});
    await pool.query("DELETE FROM bitacora WHERE id_usuario = ?", [u.insertId]);
    await pool.query("DELETE FROM usuarios WHERE id_usuario = ?", [u.insertId]);
  }
});

test("garantías: el producto las exige al desembolsar; se registran, se liberan y el socio las ve", async () => {
  const prod = await api("POST", "/productos", {
    nombre: "Vehículo Prueba", tasa_mensual: 1.8, monto_min: 10000, monto_max: 300000,
    plazo_min: 6, plazo_max: 60, garantia_requerida: "real", visible_socios: false,
  }, ids.tSuper);
  assert.equal(prod.s, 201, prod.b?.message);
  const idProd = prod.b.data.id_producto;
  const nuevo = await api("POST", "/prestamos", {
    id_usuario: ids.socio, monto: 50000, tasa_interes: 21.6, plazo_meses: 24, estado: "aprobado", id_producto: idProd,
  }, ids.tSuper);
  assert.equal(nuevo.s, 201, nuevo.b?.message);
  const idPr = nuevo.b.id_prestamo || nuevo.b.data?.id_prestamo || nuevo.b.prestamo?.id_prestamo;
  assert.ok(idPr, "id del préstamo nuevo");
  try {
    // Sin la garantía que exige el producto no se desembolsa
    const sin = await api("POST", `/prestamos/${idPr}/desembolsar`, { metodo: "efectivo" }, ids.tSuper);
    assert.equal(sin.s, 400);
    assert.match(sin.b.message, /prendaria o hipotecaria/);

    // Un aval no basta para este producto
    const aval = await api("POST", `/garantias/prestamo/${idPr}`, { tipo: "aval", aval_nombre: "Pedro Aval", aval_telefono: "99887766" }, ids.tSuper);
    assert.equal(aval.s, 201, aval.b?.message);
    assert.equal((await api("POST", `/prestamos/${idPr}/desembolsar`, { metodo: "efectivo" }, ids.tSuper)).s, 400);

    assert.equal((await api("POST", `/garantias/prestamo/${idPr}`, { tipo: "prendaria", descripcion: "Pick-up 2019" }, ids.tSuper)).s, 400, "pide el valor");
    assert.equal((await api("POST", `/garantias/prestamo/${idPr}`, { tipo: "prendaria", descripcion: "Pick-up", valor_estimado: 60000 }, ids.tSocio)).s, 403, "el socio no registra");
    const real = await api("POST", `/garantias/prestamo/${idPr}`, {
      tipo: "prendaria", descripcion: "Pick-up Toyota Hilux 2019, placa HAA-1234", valor_estimado: 60000,
    }, ids.tSuper);
    assert.equal(real.s, 201, real.b?.message);
    assert.equal(real.b.resumen.cobertura_real_pct, 120);

    const ok = await api("POST", `/prestamos/${idPr}/desembolsar`, { metodo: "efectivo" }, ids.tSuper);
    assert.equal(ok.s, 200, ok.b?.message);

    // El socio dueño las ve; otro socio no
    const suyo = await api("GET", `/garantias/prestamo/${idPr}`, null, ids.tSocio);
    assert.equal(suyo.s, 200);
    assert.equal(suyo.b.garantias.length, 2);
    assert.equal((await api("GET", `/garantias/prestamo/${idPr}`, null, ids.tSocio2)).s, 403);

    // Liberar exige motivo
    const idAval = suyo.b.garantias.find((g) => g.tipo === "aval").id_garantia;
    assert.equal((await api("POST", `/garantias/${idAval}/liberar`, {}, ids.tSuper)).s, 400);
    const lib = await api("POST", `/garantias/${idAval}/liberar`, { motivo: "Se cambia por otro aval" }, ids.tSuper);
    assert.equal(lib.s, 200);
    assert.equal(lib.b.garantias.find((g) => g.id_garantia === idAval).estado_efectivo, "liberada");

    // Préstamo cancelado: todas quedan liberadas
    await pool.query("UPDATE prestamos SET estado = 'pagado', saldo_restante = 0 WHERE id_prestamo = ?", [idPr]);
    const fin = await api("GET", `/garantias/prestamo/${idPr}`, null, ids.tSuper);
    assert.ok(fin.b.garantias.every((g) => g.estado_efectivo === "liberada"));
    assert.equal(fin.b.resumen.vigentes, 0);
  } finally {
    await pool.query("DELETE FROM garantias WHERE id_prestamo = ?", [idPr]);
    await pool.query("DELETE FROM caja_movimientos WHERE referencia_tipo = 'prestamo' AND referencia_id = ?", [idPr]);
    await pool.query("DELETE FROM recibos WHERE referencia_tipo = 'prestamo' AND referencia_id = ?", [idPr]);
    await pool.query("DELETE FROM prestamos WHERE id_prestamo = ?", [idPr]);
    await pool.query("UPDATE productos_credito SET activo = 0 WHERE id_producto = ?", [idProd]);
  }
});

test("garantías: la migración copia el aval de las solicitudes existentes sin duplicar", async () => {
  const [[s]] = await pool.query(
    `SELECT s.id_prestamo FROM solicitudes_prestamo s JOIN prestamos p ON p.id_prestamo = s.id_prestamo
     WHERE p.estado <> 'rechazado' AND s.referencias LIKE '%aval%' LIMIT 1`
  );
  assert.ok(s, "hay una solicitud con aval de las pruebas anteriores");
  await pool.query("DELETE FROM garantias WHERE id_prestamo = ?", [s.id_prestamo]);
  await pool.query("DELETE FROM schema_migraciones WHERE id = '2026_11_003_garantias'");
  const { aplicarMigraciones } = require("../../utils/migraciones");
  await aplicarMigraciones();
  await pool.query("DELETE FROM schema_migraciones WHERE id = '2026_11_003_garantias'");
  await aplicarMigraciones(); // otra vez: no duplica
  const [g] = await pool.query("SELECT tipo FROM garantias WHERE id_prestamo = ?", [s.id_prestamo]);
  assert.deepEqual(g.map((x) => x.tipo), ["aval"]);
});

test("contabilidad: apertura, partidas automáticas que cuadran, partidas manuales y estados", async () => {
  const sumaPartidas = async () => {
    const [[t]] = await pool.query("SELECT IFNULL(SUM(debe),0) AS d, IFNULL(SUM(haber),0) AS h, COUNT(DISTINCT id_partida) AS n FROM partida_lineas");
    return { d: parseFloat(t.d), h: parseFloat(t.h), n: t.n };
  };
  const ultima = async (origen) => {
    const [[p]] = await pool.query("SELECT * FROM partidas WHERE origen = ? ORDER BY id_partida DESC LIMIT 1", [origen]);
    if (!p) return null;
    const [l] = await pool.query(
      `SELECT c.clave, l.debe, l.haber FROM partida_lineas l JOIN cuentas_contables c ON c.id_cuenta_contable = l.id_cuenta_contable WHERE l.id_partida = ?`,
      [p.id_partida]
    );
    return { ...p, lineas: Object.fromEntries(l.map((x) => [x.clave, parseFloat(x.debe) - parseFloat(x.haber)])) };
  };

  // Antes de abrir: las operaciones no generan partidas
  assert.equal((await api("GET", "/libros/estado", null, ids.tSuper)).b.iniciada, false);
  assert.equal((await sumaPartidas()).n, 0);
  assert.equal((await api("GET", "/libros/estado", null, ids.tSocio)).s, 403, "el socio no ve la contabilidad");

  // Apertura con los saldos que propone el sistema
  const prop = await api("GET", "/libros/apertura/propuesta", null, ids.tSuper);
  assert.equal(prop.s, 200);
  assert.ok(prop.b.lineas.some((l) => l.clave === "cartera" && l.debe > 0), "propone la cartera vigente");
  assert.equal((await api("POST", "/libros/apertura", { lineas: prop.b.lineas }, ids.tAdmin)).s, 403);
  const descuadrada = prop.b.lineas.map((l) => (l.clave === "caja" ? { ...l, debe: l.debe + 100 } : l));
  assert.equal((await api("POST", "/libros/apertura", { lineas: descuadrada }, ids.tSuper)).s, 400, "no cuadra");
  const ap = await api("POST", "/libros/apertura", { lineas: prop.b.lineas }, ids.tSuper);
  assert.equal(ap.s, 201, ap.b?.message);
  assert.equal((await api("POST", "/libros/apertura", { lineas: prop.b.lineas }, ids.tSuper)).s, 409, "una sola vez");

  // Un pago en efectivo: caja contra cartera, intereses y mora
  const [[pr]] = await pool.query("SELECT id_prestamo FROM prestamos WHERE id_usuario = ? AND estado IN ('activo','mora') LIMIT 1", [ids.socio]);
  let idPrestamo = pr?.id_prestamo;
  if (!idPrestamo) {
    const [r] = await pool.query(
      `INSERT INTO prestamos (id_usuario, monto, tasa_interes, plazo_meses, saldo_restante, estado, fecha_otorgado) VALUES (?, 3000, 24, 6, 3000, 'activo', NOW())`,
      [ids.socio]
    );
    idPrestamo = r.insertId;
  }
  const pago = await api("POST", "/pagos", { id_prestamo: idPrestamo, monto_pagado: 200, metodo_pago: "efectivo", condonar_mora: true }, ids.tSuper);
  assert.equal(pago.s, 201, pago.b?.message);
  const pPago = await ultima("pago");
  const [[pg]] = await pool.query("SELECT * FROM pagos_prestamo WHERE id_pago = ?", [pago.b.id_pago]);
  cerca(pPago.lineas.caja, 200);
  cerca(-pPago.lineas.cartera, parseFloat(pg.monto_capital));
  cerca(-(pPago.lineas.ingreso_intereses || 0), parseFloat(pg.monto_interes));

  // Aportación por transferencia: bancos contra capital social
  const apo = await api("POST", "/aportaciones", { id_usuario: ids.socio, monto: 150, metodo_pago: "transferencia" }, ids.tSuper);
  assert.equal(apo.s, 201, apo.b?.message);
  const pApo = await ultima("aportacion");
  cerca(pApo.lineas.bancos, 150);
  cerca(pApo.lineas.aportaciones, -150);

  // Gasto de caja
  assert.equal((await api("POST", "/caja/gasto", { categoria: "papeleria", monto: 35, concepto: "Resmas de papel" }, ids.tSuper)).s, 201);
  const pGasto = await ultima("gasto");
  cerca(pGasto.lineas.gasto_papeleria, 35);
  cerca(pGasto.lineas.caja, -35);

  // Depósito de ahorro desde Movimientos: pasa por caja y genera su partida
  const [[vivienda]] = await pool.query("SELECT id_cuenta FROM cuentas WHERE id_usuario = ? AND tipo_cuenta = 'Vivienda'", [ids.socio]);
  const dep = await api("POST", "/movimientos", { id_cuenta: vivienda.id_cuenta, tipo: "abono", monto: 80, metodo: "efectivo", descripcion: "Ahorro" }, ids.tSuper);
  assert.equal(dep.s, 200, dep.b?.message);
  const [[cajaDep]] = await pool.query("SELECT * FROM caja_movimientos WHERE referencia_tipo = 'movimiento_cuenta' AND referencia_id = ?", [dep.b.id_movimiento]);
  assert.equal(cajaDep.categoria, "deposito_ahorro");
  const pDep = await ultima("movimiento_cuenta");
  cerca(pDep.lineas.ahorro_vivienda, -80);
  // Editarlo deja solo la diferencia; borrarlo lo revierte
  assert.equal((await api("PUT", `/movimientos/${dep.b.id_movimiento}`, { monto: 100 }, ids.tSuper)).s, 200);
  cerca((await ultima("movimiento_cuenta")).lineas.ahorro_vivienda, -20);
  assert.equal((await api("DELETE", `/movimientos/${dep.b.id_movimiento}`, null, ids.tSuper)).s, 200);
  cerca((await ultima("movimiento_cuenta")).lineas.ahorro_vivienda, 100);
  // Un movimiento que viene de una aportación no se edita desde Movimientos
  const [[movApo]] = await pool.query("SELECT id_movimiento FROM movimientos_cuenta WHERE tipo_movimiento = 'aporte' ORDER BY id_movimiento DESC LIMIT 1");
  assert.equal((await api("DELETE", `/movimientos/${movApo.id_movimiento}`, null, ids.tSuper)).s, 400);

  // Anular el pago: se revierte exactamente su partida
  const anula = await api("DELETE", `/pagos/${pago.b.id_pago}`, { motivo: "Prueba de reversión contable" }, ids.tSuper);
  assert.equal(anula.s, 200, anula.b?.message);
  const pAnula = await ultima("pago");
  cerca(pAnula.lineas.caja, -200);

  // Todo cuadra y no hubo partidas fallidas
  const t = await sumaPartidas();
  cerca(t.d, t.h);
  assert.equal((await api("GET", "/libros/estado", null, ids.tSuper)).b.errores_pendientes, 0);
  const bal = await api("GET", "/libros/balanza", null, ids.tSuper);
  assert.equal(bal.b.cuadra, true);
  const est = await api("GET", "/libros/estados", null, ids.tSuper);
  assert.equal(est.b.balance.cuadra, true, "activo = pasivo + patrimonio");
  cerca(est.b.resultados.total_gastos, 35);

  // Partidas manuales: deben cuadrar; se anulan con la partida inversa
  const cat = (await api("GET", "/libros/catalogo", null, ids.tSuper)).b.data;
  const idDe = (clave) => cat.find((c) => c.clave === clave).id_cuenta_contable;
  const mala = await api("POST", "/libros/partidas", {
    concepto: "Partida que no cuadra",
    lineas: [{ id_cuenta_contable: idDe("bancos"), debe: 10 }, { id_cuenta_contable: idDe("caja"), haber: 9 }],
  }, ids.tSuper);
  assert.equal(mala.s, 400);
  const man = await api("POST", "/libros/partidas", {
    concepto: "Depósito del efectivo de caja en el banco",
    lineas: [{ id_cuenta_contable: idDe("bancos"), debe: 50 }, { id_cuenta_contable: idDe("caja"), haber: 50 }],
  }, ids.tSuper);
  assert.equal(man.s, 201, man.b?.message);
  assert.equal((await api("POST", `/libros/partidas/${man.b.id_partida}/anular`, { motivo: "Se registró dos veces" }, ids.tSuper)).s, 200);
  assert.equal((await api("POST", `/libros/partidas/${man.b.id_partida}/anular`, { motivo: "Otra vez" }, ids.tSuper)).s, 400);
  assert.equal((await api("POST", `/libros/partidas/${pAnula.id_partida}/anular`, { motivo: "No se puede" }, ids.tSuper)).s, 400, "las automáticas no");

  // Libro mayor de caja: saldo final = saldo de la balanza
  const mayor = await api("GET", `/libros/mayor/${idDe("caja")}`, null, ids.tSuper);
  const enBalanza = (await api("GET", "/libros/balanza", null, ids.tSuper)).b.filas.find((f) => f.codigo === mayor.b.cuenta.codigo);
  cerca(mayor.b.saldo_final, enBalanza.saldo_final);
});

test("ahorro: productos, intereses del mes, plazo fijo y reglas de retiro", async () => {
  const prods = (await api("GET", "/ahorro/productos", null, ids.tSuper)).b.data;
  const viv = prods.find((p) => p.nombre === "Vivienda");
  assert.equal(parseFloat(viv.tasa_anual), 0, "sin interés hasta configurarlo");
  assert.equal((await api("PUT", `/ahorro/productos/${viv.id_producto_ahorro}`, { tasa_anual: 6 }, ids.tAdmin)).s, 403);
  assert.equal((await api("PUT", `/ahorro/productos/${viv.id_producto_ahorro}`, { tasa_anual: 6 }, ids.tSuper)).s, 200);

  // Intereses del mes pasado sobre el saldo promedio diario
  const [[cv]] = await pool.query("SELECT id_cuenta, saldo_actual FROM cuentas WHERE id_usuario = ? AND tipo_cuenta = 'Vivienda'", [ids.socio]);
  const { hoyISO } = require("../../utils/fechas");
  const [y, m] = hoyISO().split("-").map(Number);
  const anio = m === 1 ? y - 1 : y;
  const mes = m === 1 ? 12 : m - 1;
  const p2 = (n) => String(n).padStart(2, "0");
  await pool.query("DELETE FROM saldos_diarios WHERE id_cuenta = ?", [cv.id_cuenta]);
  await pool.query("INSERT INTO saldos_diarios (id_cuenta, fecha, saldo) VALUES (?, ?, 3000)", [cv.id_cuenta, `${anio}-${p2(mes)}-01`]);
  const previa = await api("GET", `/ahorro/intereses/previa?anio=${anio}&mes=${mes}`, null, ids.tSuper);
  const fila = previa.b.data.find((f) => f.id_cuenta === cv.id_cuenta);
  assert.equal(fila.saldo_promedio, 3000);
  const dias = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  cerca(fila.interes_bruto, Math.round(3000 * 0.06 * dias / 365 * 100) / 100);
  assert.equal((await api("POST", "/ahorro/intereses/liquidar", { anio, mes }, ids.tAdmin)).s, 403);
  const liq = await api("POST", "/ahorro/intereses/liquidar", { anio, mes }, ids.tSuper);
  assert.equal(liq.s, 200, liq.b?.message);
  assert.ok(liq.b.cuentas >= 1);
  const [[despues]] = await pool.query("SELECT saldo_actual FROM cuentas WHERE id_cuenta = ?", [cv.id_cuenta]);
  cerca(parseFloat(despues.saldo_actual), parseFloat(cv.saldo_actual) + fila.interes_neto);
  const [[pi]] = await pool.query("SELECT COUNT(*) AS n FROM partidas WHERE origen = 'interes_ahorro' AND origen_id = ?", [cv.id_cuenta]);
  assert.equal(pi.n, 1, "con su partida contable");
  assert.equal((await api("POST", "/ahorro/intereses/liquidar", { anio, mes }, ids.tSuper)).b.cuentas, 0, "una sola vez por mes");
  assert.equal((await api("POST", "/ahorro/intereses/liquidar", { anio: y, mes: m }, ids.tSuper)).s, 400, "el mes en curso no");

  // Plazo fijo
  const nuevo = await api("POST", "/ahorro/productos", {
    nombre: "Plazo fijo Prueba", clase: "plazo_fijo", tasa_anual: 8, monto_min: 1000, plazo_min_dias: 30, plazo_max_dias: 365, penalizacion_pct: 50,
  }, ids.tSuper);
  assert.equal(nuevo.s, 201, nuevo.b?.message);
  const idProd = nuevo.b.id_producto_ahorro;
  assert.equal((await api("POST", "/ahorro/plazos", { id_usuario: ids.socio, id_producto_ahorro: idProd, monto: 500, plazo_dias: 90, origen: "efectivo" }, ids.tSuper)).s, 400, "monto mínimo");
  const dep = await api("POST", "/ahorro/plazos", { id_usuario: ids.socio, id_producto_ahorro: idProd, monto: 10000, plazo_dias: 90, origen: "efectivo" }, ids.tSuper);
  assert.equal(dep.s, 201, dep.b?.message);
  const [[cajaDep]] = await pool.query("SELECT categoria, monto FROM caja_movimientos WHERE referencia_tipo = 'plazo_fijo' AND referencia_id = ?", [dep.b.id_deposito]);
  assert.equal(cajaDep.categoria, "apertura_plazo");
  // Retiro anticipado: hay que confirmarlo; el mismo día no genera interés
  assert.equal((await api("POST", `/ahorro/plazos/${dep.b.id_deposito}/pagar`, { destino: "efectivo" }, ids.tSuper)).s, 409);
  const ant = await api("POST", `/ahorro/plazos/${dep.b.id_deposito}/pagar`, { destino: "efectivo", confirmar_anticipado: true }, ids.tSuper);
  assert.equal(ant.s, 200, ant.b?.message);
  assert.equal(ant.b.anticipado, true);
  assert.equal(ant.b.total, 10000);
  assert.equal((await api("POST", `/ahorro/plazos/${dep.b.id_deposito}/pagar`, { destino: "efectivo", confirmar_anticipado: true }, ids.tSuper)).s, 400, "ya pagado");

  // Desde la cuenta de ahorro y pagado al vencer, a la misma cuenta, con el interés completo
  assert.equal((await api("POST", "/movimientos", { id_cuenta: cv.id_cuenta, tipo: "abono", monto: 1500, descripcion: "Para el plazo fijo" }, ids.tSuper)).s, 200);
  const [[antesCta]] = await pool.query("SELECT saldo_actual FROM cuentas WHERE id_cuenta = ?", [cv.id_cuenta]);
  const dep2 = await api("POST", "/ahorro/plazos", { id_usuario: ids.socio, id_producto_ahorro: idProd, monto: 1000, plazo_dias: 180, origen: "cuenta", id_cuenta: cv.id_cuenta }, ids.tSuper);
  assert.equal(dep2.s, 201, dep2.b?.message);
  await pool.query("UPDATE depositos_plazo SET fecha_inicio = DATE_SUB(CURDATE(), INTERVAL 181 DAY), fecha_vencimiento = DATE_SUB(CURDATE(), INTERVAL 1 DAY) WHERE id_deposito = ?", [dep2.b.id_deposito]);
  const alVencer = await api("POST", `/ahorro/plazos/${dep2.b.id_deposito}/pagar`, { destino: "cuenta", id_cuenta: cv.id_cuenta }, ids.tSuper);
  assert.equal(alVencer.s, 200, alVencer.b?.message);
  cerca(alVencer.b.interes, 39.45); // 1,000 × 8% × 180 / 365
  const [[finCta]] = await pool.query("SELECT saldo_actual FROM cuentas WHERE id_cuenta = ?", [cv.id_cuenta]);
  cerca(parseFloat(finCta.saldo_actual), parseFloat(antesCta.saldo_actual) + 39.45, 0.011); // sale 1,000 y vuelve 1,039.45
  const mios = await api("GET", "/ahorro/plazos/mios", null, ids.tSocio);
  assert.equal(mios.s, 200);
  assert.ok(mios.b.data.length >= 2);

  // Reglas de retiro del producto
  const apo = prods.find((p) => p.nombre === "Aportaciones");
  await api("PUT", `/ahorro/productos/${apo.id_producto_ahorro}`, { permite_retiros: false }, ids.tSuper);
  const [[ca]] = await pool.query("SELECT id_cuenta FROM cuentas WHERE id_usuario = ? AND tipo_cuenta = 'Aportaciones'", [ids.socio]);
  const ret = await api("POST", "/movimientos", { id_cuenta: ca.id_cuenta, tipo: "retiro", monto: 1, descripcion: "x" }, ids.tSuper);
  assert.equal(ret.s, 400);
  assert.match(ret.b.message, /no permite retiros/);
  await api("PUT", `/ahorro/productos/${apo.id_producto_ahorro}`, { permite_retiros: true }, ids.tSuper);

  // Todo sigue cuadrando
  const bal = await api("GET", "/libros/balanza", null, ids.tSuper);
  assert.equal(bal.b.cuadra, true);
  assert.equal((await api("GET", "/libros/estado", null, ids.tSuper)).b.errores_pendientes, 0);
});

test("excedentes: reservas, reparto por aportaciones e intereses, una vez por año y su cierre contable", async () => {
  const anioActual = new Date().getFullYear();
  const anio = anioActual - 1;
  const base = { anio, pct_aportaciones: 50, reservas: [{ clave: "reserva_legal", nombre: "Reserva legal", pct: 10 }, { clave: "fondo_educacion", nombre: "Educación", pct: 10 }] };

  // La contabilidad no estaba abierta el año pasado: hay que escribir el excedente
  assert.equal((await api("POST", "/libros/excedentes/simular", base, ids.tSuper)).s, 400);
  const sim = await api("POST", "/libros/excedentes/simular", { ...base, monto_manual: 1000 }, ids.tSuper);
  assert.equal(sim.s, 200, sim.b?.message);
  assert.equal(sim.b.distribuible, 800); // 1,000 − 20% de reservas
  assert.equal(sim.b.por_aportaciones, 400);
  cerca(sim.b.socios.reduce((t, f) => t + f.total, 0), sim.b.repartido);
  assert.ok(sim.b.socios.length > 0);

  const quien = sim.b.socios[0];
  const [[antes]] = await pool.query("SELECT saldo_actual FROM cuentas WHERE id_usuario = ? AND tipo_cuenta = 'Aportaciones'", [quien.id_usuario]);
  assert.equal((await api("POST", "/libros/excedentes/aplicar", { ...base, monto_manual: 1000 }, ids.tAdmin)).s, 403);
  assert.equal((await api("POST", "/libros/excedentes/aplicar", { anio: anioActual, monto_manual: 1000 }, ids.tSuper)).s, 400, "el año en curso no");
  const ap = await api("POST", "/libros/excedentes/aplicar", { ...base, monto_manual: 1000 }, ids.tSuper);
  assert.equal(ap.s, 200, ap.b?.message);
  const [[despues]] = await pool.query("SELECT saldo_actual FROM cuentas WHERE id_usuario = ? AND tipo_cuenta = 'Aportaciones'", [quien.id_usuario]);
  cerca(parseFloat(despues.saldo_actual), parseFloat(antes.saldo_actual) + quien.total);
  assert.equal((await api("POST", "/libros/excedentes/aplicar", { ...base, monto_manual: 1000 }, ids.tSuper)).s, 409, "una sola vez por año");

  // Con contabilidad: el excedente sale de los libros y queda la partida de cierre
  const anio2 = anioActual - 2;
  const [[ini]] = await pool.query("SELECT valor FROM configuracion_sitio WHERE clave = 'cont_inicio'");
  await pool.query("UPDATE configuracion_sitio SET valor = ? WHERE clave = 'cont_inicio'", [`${anio2}-01-01`]);
  try {
    const cat = (await api("GET", "/libros/catalogo", null, ids.tSuper)).b.data;
    const idDe = (clave) => cat.find((c) => c.clave === clave).id_cuenta_contable;
    const ing = await api("POST", "/libros/partidas", {
      fecha: `${anio2}-06-15`,
      concepto: "Ingreso de prueba del ejercicio anterior",
      lineas: [{ id_cuenta_contable: idDe("caja"), debe: 500 }, { id_cuenta_contable: idDe("otros_ingresos"), haber: 500 }],
    }, ids.tSuper);
    assert.equal(ing.s, 201, ing.b?.message);
    const s2 = await api("POST", "/libros/excedentes/simular", { ...base, anio: anio2 }, ids.tSuper);
    assert.equal(s2.b.origen, "contabilidad");
    assert.equal(s2.b.excedente, 500);
    const a2 = await api("POST", "/libros/excedentes/aplicar", { ...base, anio: anio2 }, ids.tSuper);
    assert.equal(a2.s, 200, a2.b?.message);
    const [[cierre]] = await pool.query("SELECT COUNT(*) AS n FROM partidas WHERE origen IN ('cierre_ejercicio','excedentes') AND origen_id = ?", [anio2]);
    assert.equal(cierre.n, 2);
    // Al cierre de ese año los ingresos quedan en cero y el excedente distribuido
    const bal = await api("GET", `/libros/balanza?hasta=${anio2}-12-31`, null, ids.tSuper);
    const fila = (clave) => bal.b.filas.find((f) => f.id_cuenta_contable === idDe(clave));
    cerca(fila("otros_ingresos").saldo_final, 0);
    cerca(fila("resultado_ejercicio").saldo_final, 500 - s2.b.repartido - s2.b.reservas.reduce((t, r) => t + r.monto, 0));
    cerca(fila("reserva_legal").saldo_final, 50);
    assert.equal(bal.b.cuadra, true);
  } finally {
    await pool.query("UPDATE configuracion_sitio SET valor = ? WHERE clave = 'cont_inicio'", [ini.valor]);
  }
});

test("cumplimiento: expediente del socio, alertas de efectivo, fraccionamiento y PEP", async () => {
  // Expediente: validaciones y guardado
  const exp0 = await api("GET", `/socios/${ids.socio2}/expediente`, null, ids.tAdmin);
  assert.equal(exp0.s, 200, exp0.b?.message);
  assert.ok(exp0.b.data.faltantes.includes("beneficiarios"));
  const perfil = { actividad_economica: "Comerciante", ingreso_mensual: "15000", origen_fondos: "Venta de ropa" };
  const malos = await api("PUT", `/socios/${ids.socio2}/expediente`, { ...perfil, beneficiarios: [{ nombre: "Ana", porcentaje: 60 }] }, ids.tAdmin);
  assert.equal(malos.s, 400, "los porcentajes deben sumar 100");
  assert.equal((await api("PUT", `/socios/${ids.socio2}/expediente`, { ...perfil, es_pep: true }, ids.tAdmin)).s, 400, "PEP sin detalle");
  const ok = await api(
    "PUT",
    `/socios/${ids.socio2}/expediente`,
    { ...perfil, beneficiarios: [{ nombre: "Ana Pérez", parentesco: "Hija", porcentaje: 60 }, { nombre: "Luis Pérez", porcentaje: 40 }] },
    ids.tAdmin
  );
  assert.equal(ok.s, 200, ok.b?.message);
  assert.equal(ok.b.data.beneficiarios.length, 2);
  assert.deepEqual(ok.b.data.faltantes, []);
  assert.equal((await api("PUT", `/socios/${ids.socio2}/expediente`, perfil, ids.tSocio2)).s, 403, "el socio no edita su expediente");

  // Umbral bajo para la prueba
  const fin = (await api("GET", "/configuracion/financiera", null, ids.tSuper)).b.data;
  const guardarUmbral = (v) => api("PUT", "/configuracion/financiera", { mora_tasa_anual: fin.mora_tasa_anual, mora_dias_gracia: fin.mora_dias_gracia, aml_umbral: v }, ids.tSuper);
  assert.equal((await guardarUmbral(1000)).s, 200);
  const resumen = await api("GET", "/cumplimiento/resumen", null, ids.tAdmin);
  assert.equal(resumen.s, 200);
  assert.equal(resumen.b.data.umbral, 1000);

  const [[cta]] = await pool.query("SELECT id_cuenta FROM cuentas WHERE id_usuario = ? ORDER BY id_cuenta LIMIT 1", [ids.socio2]);
  const depositar = (monto, metodo = "efectivo") =>
    api("POST", "/movimientos", { id_cuenta: cta.id_cuenta, tipo: "abono", monto, metodo, descripcion: "Prueba cumplimiento" }, ids.tSuper);
  const alertas = async () =>
    (await pool.query("SELECT tipo, monto FROM alertas_cumplimiento WHERE id_socio = ? ORDER BY id_alerta", [ids.socio2]))[0];

  // Un depósito grande en efectivo genera alerta; por transferencia no
  assert.equal((await depositar(1500, "transferencia")).s, 200);
  assert.equal((await alertas()).length, 0);
  assert.equal((await depositar(1200)).s, 200);
  let a = await alertas();
  assert.equal(a.length, 1);
  assert.equal(a[0].tipo, "efectivo_umbral");

  // Fraccionamiento: varios depósitos pequeños que en 30 días suman el umbral (una sola alerta)
  // (se apartan los ingresos en efectivo anteriores del socio para empezar el período de cero)
  await pool.query("UPDATE caja_movimientos SET fecha = DATE_SUB(fecha, INTERVAL 60 DAY) WHERE id_socio = ? AND tipo = 'ingreso'", [ids.socio2]);
  assert.equal((await depositar(400)).s, 200);
  assert.equal((await depositar(400)).s, 200);
  assert.equal((await alertas()).length, 1, "aún no llega al umbral");
  assert.equal((await depositar(300)).s, 200);
  assert.equal((await depositar(300)).s, 200);
  a = await alertas();
  assert.deepEqual(a.map((x) => x.tipo), ["efectivo_umbral", "fraccionamiento"]);

  // PEP: cualquier operación desde el 10% del umbral
  assert.equal((await api("PUT", `/socios/${ids.socio2}/expediente`, { ...perfil, es_pep: true, pep_detalle: "Regidor municipal" }, ids.tAdmin)).s, 200);
  assert.equal((await depositar(150, "transferencia")).s, 200);
  a = await alertas();
  assert.equal(a.at(-1).tipo, "pep");

  // Revisión: el socio y un cajero sin el módulo no las ven; la nota es obligatoria
  assert.equal((await api("GET", "/cumplimiento/alertas", null, ids.tSocio2)).s, 403);
  const lista = await api("GET", "/cumplimiento/alertas?estado=pendiente", null, ids.tAdmin);
  assert.equal(lista.s, 200);
  const [[una]] = await pool.query("SELECT id_alerta FROM alertas_cumplimiento WHERE id_socio = ? LIMIT 1", [ids.socio2]);
  assert.equal((await api("PUT", `/cumplimiento/alertas/${una.id_alerta}`, { estado: "revisada" }, ids.tAdmin)).s, 400);
  assert.equal((await api("PUT", `/cumplimiento/alertas/${una.id_alerta}`, { estado: "reportada", nota: "ROS enviado a la UIF" }, ids.tAdmin)).s, 200);
  const [[rev]] = await pool.query("SELECT estado, revisado_por FROM alertas_cumplimiento WHERE id_alerta = ?", [una.id_alerta]);
  assert.equal(rev.estado, "reportada");
  assert.equal(rev.revisado_por, ids.admin);

  // Excel
  const r = await fetch(`${base}/api/cumplimiento/exportar`, { headers: { Authorization: `Bearer ${ids.tAdmin}` } });
  assert.equal(r.status, 200);
  assert.match(r.headers.get("content-type"), /spreadsheet/);

  // Estados de baja: no pueden entrar
  assert.equal((await api("PATCH", `/usuarios/${ids.socio2}/estado`, { estado: "fallecido" }, ids.tSuper)).s, 200);
  const [[u]] = await pool.query("SELECT estado FROM usuarios WHERE id_usuario = ?", [ids.socio2]);
  assert.equal(u.estado, "fallecido");
  await pool.query("UPDATE usuarios SET estado = 'activo', es_pep = 0 WHERE id_usuario = ?", [ids.socio2]);
  await pool.query("UPDATE cuentas SET estado = 'activa' WHERE id_usuario = ?", [ids.socio2]);
  assert.equal((await guardarUmbral(0)).s, 200);
});

test("comité de crédito: por encima del límite se aprueba por votos", async () => {
  const fin = (await api("GET", "/configuracion/financiera", null, ids.tSuper)).b.data;
  const parametros = (extra) => api("PUT", "/configuracion/financiera", { mora_tasa_anual: fin.mora_tasa_anual, mora_dias_gracia: fin.mora_dias_gracia, ...extra }, ids.tSuper);
  const nuevo = async (monto, estado = "pendiente", token = ids.tAdmin) =>
    api("POST", "/prestamos", { id_usuario: ids.socio, monto, tasa_interes: 24, plazo_meses: 12, estado }, token);
  const idDe = (r) => r.b.id_prestamo || r.b.data?.id_prestamo || r.b.prestamo?.id_prestamo;
  const estadoDe = async (id) => (await pool.query("SELECT estado FROM prestamos WHERE id_prestamo = ?", [id]))[0][0].estado;

  // Sin límite (lo predeterminado) todo sigue igual
  const libre = await nuevo(9000);
  assert.equal((await api("PATCH", `/prestamos/${idDe(libre)}/aprobar`, {}, ids.tAdmin)).s, 200);

  assert.equal((await parametros({ aprob_monto_admin: 5000, aprob_votos_comite: 2 })).s, 200);
  const info = await api("GET", "/comite", null, ids.tAdmin);
  assert.equal(info.s, 200);
  assert.equal(info.b.data.activo, true);

  // Hasta el límite aprueba el personal
  const chico = await nuevo(3000);
  assert.equal((await api("PATCH", `/prestamos/${idDe(chico)}/aprobar`, {}, ids.tAdmin)).s, 200);

  // Por encima: no se crea ya aprobado ni se cambia el estado a mano
  assert.equal((await nuevo(10000, "aprobado")).s, 409);
  const grande = await nuevo(10000);
  const idG = idDe(grande);
  assert.equal((await api("PATCH", `/prestamos/${idG}/estado`, { estado: "aprobado" }, ids.tAdmin)).s, 409);
  assert.equal((await api("PATCH", `/prestamos/${idG}/aprobar`, {}, ids.tAdmin)).s, 409, "aún no es miembro");

  // Solo el Super Administrador define el comité, y solo con personal
  assert.equal((await api("PUT", "/comite/miembros", { miembros: [{ id_usuario: ids.admin }] }, ids.tAdmin)).s, 403);
  assert.equal((await api("PUT", "/comite/miembros", { miembros: [{ id_usuario: ids.socio }] }, ids.tSuper)).s, 400);
  const def = await api("PUT", "/comite/miembros", { miembros: [{ id_usuario: ids.super, cargo: "Presidente" }, { id_usuario: ids.admin }] }, ids.tSuper);
  assert.equal(def.s, 200, def.b?.message);
  assert.equal(def.b.data.length, 2);

  // Primer voto: queda pendiente
  const v1 = await api("PATCH", `/prestamos/${idG}/aprobar`, {}, ids.tAdmin);
  assert.equal(v1.s, 202);
  assert.equal(v1.b.comite.a_favor, 1);
  assert.equal(await estadoDe(idG), "pendiente");
  const pend = await api("GET", "/comite/pendientes", null, ids.tSuper);
  assert.ok(pend.b.data.some((p) => p.id_prestamo === idG));
  assert.equal((await api("GET", "/comite/pendientes", null, ids.tSocio)).s, 403);

  // Segundo voto: aprobado
  const v2 = await api("POST", `/comite/prestamos/${idG}/votar`, { voto: "aprobar" }, ids.tSuper);
  assert.equal(v2.s, 200, v2.b?.message);
  assert.equal(v2.b.resultado, "aprobado");
  assert.equal(await estadoDe(idG), "aprobado");

  // Si cambia el monto, los votos anteriores no cuentan
  const otro = await nuevo(8000);
  const idO = idDe(otro);
  assert.equal((await api("POST", `/comite/prestamos/${idO}/votar`, { voto: "aprobar" }, ids.tAdmin)).s, 200);
  await pool.query("UPDATE prestamos SET monto = 8500 WHERE id_prestamo = ?", [idO]);
  const tras = await api("POST", `/comite/prestamos/${idO}/votar`, { voto: "aprobar" }, ids.tSuper);
  assert.equal(tras.b.resultado, "pendiente");
  assert.equal(tras.b.comite.a_favor, 1);

  // Rechazo: el voto en contra necesita motivo
  assert.equal((await api("POST", `/comite/prestamos/${idO}/votar`, { voto: "rechazar" }, ids.tAdmin)).s, 400);
  assert.equal((await api("POST", `/comite/prestamos/${idO}/votar`, { voto: "rechazar", comentario: "Capacidad de pago insuficiente" }, ids.tAdmin)).s, 200);
  const r2 = await api("POST", `/comite/prestamos/${idO}/votar`, { voto: "rechazar", comentario: "Sin garantía suficiente" }, ids.tSuper);
  assert.equal(r2.b.resultado, "rechazado");
  assert.equal(await estadoDe(idO), "rechazado");

  // Limpieza
  await pool.query("UPDATE prestamos SET estado = 'rechazado' WHERE id_prestamo IN (?)", [[idDe(libre), idDe(chico), idG]]);
  assert.equal((await parametros({ aprob_monto_admin: 0 })).s, 200);
  assert.equal((await api("PUT", "/comite/miembros", { miembros: [] }, ids.tSuper)).s, 200);
});

test("turnos de caja: abrir, registrar en el turno, exigir turno y cerrar con arqueo", async () => {
  const sucs = await api("GET", "/caja/sucursales", null, ids.tAdmin);
  assert.equal(sucs.s, 200);
  const principal = sucs.b.data[0];
  assert.equal(principal.nombre, "Oficina principal");
  assert.equal((await api("POST", "/caja/sucursales", { nombre: "Agencia Norte" }, ids.tAdmin)).s, 403);
  const norte = await api("POST", "/caja/sucursales", { nombre: "Agencia Norte", direccion: "Barrio El Centro" }, ids.tSuper);
  assert.equal(norte.s, 201);

  const fin = (await api("GET", "/configuracion/financiera", null, ids.tSuper)).b.data;
  const exigir = (v) => api("PUT", "/configuracion/financiera", { mora_tasa_anual: fin.mora_tasa_anual, mora_dias_gracia: fin.mora_dias_gracia, caja_exigir_turno: v }, ids.tSuper);
  const [[cta]] = await pool.query("SELECT id_cuenta FROM cuentas WHERE id_usuario = ? ORDER BY id_cuenta LIMIT 1", [ids.socio]);
  const depositar = (monto, metodo = "efectivo") =>
    api("POST", "/movimientos", { id_cuenta: cta.id_cuenta, tipo: "abono", monto, metodo, descripcion: "Turno" }, ids.tAdmin);

  // Sin exigir turno, todo sigue igual
  assert.equal((await api("GET", "/caja/turno", null, ids.tAdmin)).b.data, null);
  assert.equal((await depositar(10)).s, 200);

  // Exigiendo turno: el efectivo necesita turno abierto; la transferencia no
  assert.equal((await exigir(1)).s, 200);
  const sin = await depositar(10);
  assert.equal(sin.s, 409);
  assert.equal(sin.b.requiere_turno, true);
  assert.equal((await depositar(10, "transferencia")).s, 200);

  // Abrir turno
  assert.equal((await api("POST", "/caja/turno/abrir", { id_sucursal: 99999, fondo_inicial: 500 }, ids.tAdmin)).s, 400);
  const ab = await api("POST", "/caja/turno/abrir", { id_sucursal: norte.b.id_sucursal, fondo_inicial: 500 }, ids.tAdmin);
  assert.equal(ab.s, 201, ab.b?.message);
  assert.equal((await api("POST", "/caja/turno/abrir", { id_sucursal: norte.b.id_sucursal, fondo_inicial: 0 }, ids.tAdmin)).s, 409);

  // Lo que registra queda en su turno y su sucursal
  assert.equal((await depositar(200)).s, 200);
  const gasto = await api("POST", "/caja/gasto", { categoria: "servicios", monto: 50, metodo: "efectivo", concepto: "Agua" }, ids.tAdmin);
  assert.equal(gasto.s, 201, gasto.b?.message);
  const [enTurno] = await pool.query("SELECT id_sucursal FROM caja_movimientos WHERE id_turno = ?", [ab.b.id_turno]);
  assert.equal(enTurno.length, 2);
  assert.ok(enTurno.every((m) => m.id_sucursal === norte.b.id_sucursal));
  const t = await api("GET", "/caja/turno", null, ids.tAdmin);
  assert.equal(t.b.data.efectivo_esperado, 650);
  assert.equal(t.b.data.sucursal, "Agencia Norte");
  const lista = await api("GET", "/caja/turnos", null, ids.tSuper);
  assert.ok(lista.b.data.some((x) => x.id_turno === ab.b.id_turno && x.efectivo_esperado === 650));

  // Cierre: la diferencia exige explicación
  assert.equal((await api("POST", "/caja/turno/cerrar", { efectivo_contado: 640 }, ids.tAdmin)).s, 400);
  const cierre = await api("POST", "/caja/turno/cerrar", { efectivo_contado: 640, observacion: "Faltante de cambio" }, ids.tAdmin);
  assert.equal(cierre.s, 200, cierre.b?.message);
  assert.equal(cierre.b.diferencia, -10);
  assert.equal((await api("POST", "/caja/turno/cerrar", { efectivo_contado: 0 }, ids.tAdmin)).s, 400, "ya no hay turno abierto");
  assert.equal((await depositar(10)).s, 409);

  assert.equal((await exigir(0)).s, 200);
});

test("verificación en dos pasos: el personal confirma con el código del correo", async () => {
  const sendEmail = require("../../utils/sendEmail");
  const original = sendEmail.transporter;
  const enviados = [];
  sendEmail.transporter = { sendMail: async (m) => enviados.push(m) };
  process.env.EMAIL_HOST = "smtp.prueba.hn";
  process.env.EMAIL_USER = "sistema@prueba.hn";
  const fin = (await api("GET", "/configuracion/financiera", null, ids.tSuper)).b.data;
  const activar = (v) => api("PUT", "/configuracion/financiera", { mora_tasa_anual: fin.mora_tasa_anual, mora_dias_gracia: fin.mora_dias_gracia, seg_2fa_personal: v }, ids.tSuper);
  const entrar = (dni) => api("POST", "/usuarios/login", { dni, password: "Clave1234" });
  try {
    // Desactivada (lo predeterminado): entra directo
    assert.ok((await entrar("0801000000002")).b.token);

    assert.equal((await activar(1)).s, 200);
    const paso1 = await entrar("0801000000002");
    assert.equal(paso1.s, 200);
    assert.equal(paso1.b.requiere_codigo, true);
    assert.equal(paso1.b.token, undefined, "sin sesión todavía");
    assert.match(paso1.b.correo, /@prueba\.hn$/);
    const codigo = enviados.at(-1).subject.match(/(\d{6})/)[1];

    // El token temporal no sirve como sesión
    assert.equal((await api("GET", "/dashboard", null, paso1.b.token_temporal)).s, 401);

    // Código equivocado, luego el correcto; no se puede usar dos veces
    const malo = codigo === "000000" ? "111111" : "000000";
    assert.equal((await api("POST", "/usuarios/login/verificar", { token_temporal: paso1.b.token_temporal, codigo: malo })).s, 400);
    const ok = await api("POST", "/usuarios/login/verificar", { token_temporal: paso1.b.token_temporal, codigo });
    assert.equal(ok.s, 200, ok.b?.message);
    assert.ok(ok.b.token);
    assert.equal(ok.b.usuario.rol, "Administrador");
    assert.equal((await api("POST", "/usuarios/login/verificar", { token_temporal: paso1.b.token_temporal, codigo })).s, 401);

    // Cinco intentos fallidos bloquean el código
    const paso2 = await entrar("0801000000002");
    const codigo2 = enviados.at(-1).subject.match(/(\d{6})/)[1];
    const otro = codigo2 === "000000" ? "111111" : "000000";
    for (let i = 0; i < 4; i++) {
      assert.equal((await api("POST", "/usuarios/login/verificar", { token_temporal: paso2.b.token_temporal, codigo: otro })).s, 400);
    }
    assert.equal((await api("POST", "/usuarios/login/verificar", { token_temporal: paso2.b.token_temporal, codigo: otro })).s, 429);
    assert.equal((await api("POST", "/usuarios/login/verificar", { token_temporal: paso2.b.token_temporal, codigo: codigo2 })).s, 429);

    // Reenviar: una vez por minuto
    const paso3 = await entrar("0801000000002");
    assert.equal((await api("POST", "/usuarios/login/reenviar", { token_temporal: paso3.b.token_temporal })).s, 429);

    // Los socios entran como siempre
    const socio = await entrar("0801000000003");
    assert.ok(socio.b.token);
    assert.equal(socio.b.requiere_codigo, undefined);

    // Si el correo falla, no se abre la sesión
    sendEmail.transporter = { sendMail: async () => { throw new Error("SMTP caído"); } };
    assert.equal((await entrar("0801000000002")).s, 503);
  } finally {
    sendEmail.transporter = original;
    process.env.EMAIL_HOST = "";
    process.env.EMAIL_USER = "";
    await activar(0);
  }
});

test("restablecer contraseña: solo el Super Administrador, con la política de contraseñas", async () => {
  const ruta = `/usuarios/${ids.socio2}/restablecer-password`;
  assert.equal((await api("POST", ruta, { password_nuevo: "Nueva12345" }, ids.tAdmin)).s, 403);
  assert.equal((await api("POST", ruta, { password_nuevo: "corta" }, ids.tSuper)).s, 400);
  assert.equal((await api("POST", ruta, { password_nuevo: "sololetras" }, ids.tSuper)).s, 400);
  const ok = await api("POST", ruta, { password_nuevo: "Nueva12345" }, ids.tSuper);
  assert.equal(ok.s, 200, ok.b?.message);
  assert.ok((await api("POST", "/usuarios/login", { dni: "0801000000004", password: "Nueva12345" })).b.token);
  assert.equal((await api("POST", "/usuarios/login", { dni: "0801000000004", password: "Clave1234" })).s, 401);
  const [[bit]] = await pool.query("SELECT detalle FROM bitacora WHERE id_usuario = ? AND accion = 'Contraseña restablecida' ORDER BY id_bitacora DESC LIMIT 1", [ids.socio2]);
  assert.match(bit.detalle, /restableció la contraseña de Socio Dos Prueba/);
  // Se deja como estaba para las demás pruebas
  assert.equal((await api("POST", ruta, { password_nuevo: "Clave1234" }, ids.tSuper)).s, 200);
});

test("sucursales: cada socio en la suya, el personal elige qué ver y el restringido ve solo la suya", async () => {
  const conSucursal = async (ruta, token, idSucursal) => {
    const r = await fetch(`${base}/api${ruta}`, {
      headers: { Authorization: `Bearer ${token}`, ...(idSucursal ? { "X-Sucursal": String(idSucursal) } : {}) },
    });
    return { s: r.status, b: await r.json() };
  };
  const [[principal]] = await pool.query("SELECT id_sucursal FROM sucursales ORDER BY id_sucursal LIMIT 1");
  const nueva = await api("POST", "/caja/sucursales", { nombre: "Sucursal Sur" }, ids.tSuper);
  assert.equal(nueva.s, 201);
  const sur = nueva.b.id_sucursal;

  // El socio 2 pasa a la sucursal Sur
  assert.equal((await api("PUT", `/usuarios/${ids.socio2}`, { id_sucursal: 99999 }, ids.tAdmin)).s, 400);
  assert.equal((await api("PUT", `/usuarios/${ids.socio2}`, { id_sucursal: sur }, ids.tAdmin)).s, 200);

  // Listas: con "Todas" se ven los dos; con Sur, solo el socio 2
  const socios = async (idS) => (await conSucursal("/usuarios?rol=Socio&limit=100", ids.tAdmin, idS)).b.data.map((u) => u.id_usuario);
  assert.ok((await socios()).includes(ids.socio) && (await socios()).includes(ids.socio2));
  assert.deepEqual((await socios(sur)).filter((x) => [ids.socio, ids.socio2].includes(x)), [ids.socio2]);
  const cuentasSur = (await conSucursal("/cuentas", ids.tAdmin, sur)).b.data;
  assert.ok(cuentasSur.length > 0 && cuentasSur.every((c) => c.id_usuario === ids.socio2));
  // Buscar un socio concreto funciona desde cualquier sucursal
  const buscado = (await conSucursal("/usuarios?search=0801000000003", ids.tAdmin, sur)).b.data;
  assert.equal(buscado[0]?.id_usuario, ids.socio);

  // Personal que solo ve su sucursal (la principal): aunque pida Sur, ve la principal
  const [r] = await pool.query(
    `INSERT INTO usuarios (nombre_completo, dni, telefono, correo, password, rol_id, estado, fecha_registro, id_sucursal, sucursal_restringida)
     VALUES ('Cajera Principal', '0801000000088', '98765432', 'cajera@prueba.hn', 'x', 3, 'activo', NOW(), ?, 1)`,
    [principal.id_sucursal]
  );
  const tCajera = tokenDe(r.insertId, "Contador", 3);
  const info = await conSucursal("/configuracion/sucursales", tCajera);
  assert.equal(info.b.restringida, true);
  const vistaCajera = (await conSucursal("/cuentas", tCajera, sur)).b.data;
  assert.ok(!vistaCajera.some((c) => c.id_usuario === ids.socio2), "no ve la cartera de Sur");
  // ...pero atiende al socio de Sur si lo pide: un depósito queda en la sucursal donde se hizo
  const cuentasSocio2 = (await conSucursal(`/cuentas?id_usuario=${ids.socio2}`, tCajera)).b.data;
  assert.ok(cuentasSocio2.length > 0);
  const dep = await api("POST", "/movimientos", { id_cuenta: cuentasSocio2[0].id_cuenta, tipo: "abono", monto: 20, metodo: "efectivo", descripcion: "En la principal" }, tCajera);
  assert.equal(dep.s, 200, dep.b?.message);
  const [[mov]] = await pool.query("SELECT id_sucursal FROM caja_movimientos WHERE id_socio = ? ORDER BY id_movimiento DESC LIMIT 1", [ids.socio2]);
  assert.equal(mov.id_sucursal, principal.id_sucursal);

  // Caja por sucursal: en Sur no aparece ese depósito; el cierre general es con "Todas"
  const cajaSur = (await conSucursal("/caja/resumen", ids.tAdmin, sur)).b;
  assert.equal(cajaSur.por_sucursal, true);
  assert.ok(!cajaSur.movimientos.some((m) => m.descripcion === "En la principal"));
  assert.equal((await conSucursal("/caja/resumen", ids.tAdmin)).b.por_sucursal, false);

  // Indicadores del dashboard por sucursal
  const kTodas = (await conSucursal("/dashboard/kpis", ids.tAdmin)).b;
  const kSur = (await conSucursal("/dashboard/kpis", ids.tAdmin, sur)).b;
  assert.ok(kSur.socios.total < kTodas.socios.total);

  // El resto del dashboard también se filtra (y sus consultas siguen siendo válidas)
  for (const ruta of ["/dashboard/series-tiempo", "/dashboard/alertas", "/dashboard/distribuciones", "/dashboard/resumen-ejecutivo", "/dashboard/rankings", "/dashboard/cierre-mensual"]) {
    const r2 = await conSucursal(ruta, ids.tAdmin, sur);
    assert.equal(r2.s, 200, `${ruta}: ${r2.b?.message} ${r2.b?.error || ""}`);
  }
  const rankTodas = (await conSucursal("/dashboard/rankings", ids.tAdmin)).b;
  const rankSur = (await conSucursal("/dashboard/rankings", ids.tAdmin, sur)).b;
  assert.notDeepEqual(rankSur, rankTodas);

  // Flujo de caja en Excel por sucursal
  const flujo = await fetch(`${base}/api/reportes/flujo-caja`, { headers: { Authorization: `Bearer ${ids.tAdmin}`, "X-Sucursal": String(sur) } });
  assert.equal(flujo.status, 200);

  // El recibo de una aportación del socio de Sur, cobrada en la principal, dice la sucursal donde se emitió
  const apo = await api("POST", "/aportaciones", { id_usuario: ids.socio2, monto: 15, metodo_pago: "efectivo" }, tCajera);
  assert.equal(apo.s, 201, apo.b?.message);
  const [[rec]] = await pool.query("SELECT id_recibo, id_sucursal FROM recibos WHERE id_socio = ? ORDER BY id_recibo DESC LIMIT 1", [ids.socio2]);
  assert.equal(rec.id_sucursal, principal.id_sucursal);
  const verRec = await api("GET", `/recibos/${rec.id_recibo}`, null, ids.tAdmin);
  assert.equal(verRec.s, 200);
  assert.equal((verRec.b.data || verRec.b).sucursal, "Oficina principal");

  // Limpieza
  await pool.query("UPDATE usuarios SET id_sucursal = ? WHERE id_usuario = ?", [principal.id_sucursal, ids.socio2]);
  await pool.query("DELETE FROM usuarios WHERE id_usuario = ?", [r.insertId]);
  await pool.query("UPDATE sucursales SET activa = 0 WHERE id_sucursal = ?", [sur]);
});

test("funciones nuevas: apagadas solo las ve el Super Administrador; datos ampliados de socio y crédito", async () => {
  const f0 = await api("GET", "/configuracion/funciones", null, ids.tAdmin);
  assert.equal(f0.s, 200);
  assert.equal(f0.b.estado.datos_ampliados, false, "apagada por defecto");
  assert.equal(f0.b.efectivas.datos_ampliados, false);
  assert.equal((await api("GET", "/configuracion/funciones", null, ids.tSuper)).b.efectivas.datos_ampliados, true, "el Super Administrador la ve para probarla");
  assert.equal((await api("PUT", "/configuracion/funciones", { datos_ampliados: true }, ids.tAdmin)).s, 403);

  const nuevo = await api("POST", "/prestamos", { id_usuario: ids.socio, monto: 1000, tasa_interes: 24, plazo_meses: 6, linea_credito: "Comercio" }, ids.tAdmin);
  const idP = nuevo.b.id_prestamo || nuevo.b.data?.id_prestamo || nuevo.b.prestamo?.id_prestamo;
  let [[pr]] = await pool.query("SELECT linea_credito FROM prestamos WHERE id_prestamo = ?", [idP]);
  assert.equal(pr.linea_credito, null, "apagada: no se guarda");
  assert.equal((await api("PUT", `/prestamos/${idP}/datos-credito`, { linea_credito: "Comercio" }, ids.tAdmin)).s, 403);

  // Encendida para todos
  assert.equal((await api("PUT", "/configuracion/funciones", { datos_ampliados: true }, ids.tSuper)).s, 200);
  require("../../utils/funciones").leer; // (la caché se actualiza al guardar)
  const cat = await api("GET", "/prestamos/catalogos", null, ids.tAdmin);
  assert.ok(cat.b.lineas.includes("Agricultura"));
  assert.equal((await api("PUT", `/prestamos/${idP}/datos-credito`, { linea_credito: "Inventada" }, ids.tAdmin)).s, 400);
  assert.equal((await api("PUT", `/prestamos/${idP}/datos-credito`, { id_promotor: ids.socio }, ids.tAdmin)).s, 400, "el promotor es personal");
  const ok = await api("PUT", `/prestamos/${idP}/datos-credito`, { linea_credito: "Agricultura", destino: "Compra de terreno", id_promotor: ids.admin, numero_pagare: "P-19" }, ids.tAdmin);
  assert.equal(ok.s, 200, ok.b?.message);
  const lista = (await api("GET", "/prestamos?linea_credito=Agricultura", null, ids.tAdmin)).b.data;
  assert.ok(lista.some((p) => p.id_prestamo === idP && p.promotor_nombre === "Admin Prueba"));

  // Socio: escolaridad, cónyuge y ubicación
  const exp = await api("PUT", `/socios/${ids.socio}/expediente`, {
    actividad_economica: "Agricultor", ingreso_mensual: 9000, origen_fondos: "Cosecha",
    escolaridad: "Secundaria", conyuge_nombre: "María Pérez", departamento: "Chimaltenango", municipio: "Patzún", comunidad: "Aldea El Sitio", fecha_ingreso: "2015-03-01",
  }, ids.tAdmin);
  assert.equal(exp.s, 200, exp.b?.message);
  assert.equal(exp.b.data.municipio, "Patzún");
  assert.equal(exp.b.data.escolaridad, "Secundaria");

  // Limpieza
  await pool.query("UPDATE prestamos SET estado = 'rechazado' WHERE id_prestamo = ?", [idP]);
  assert.equal((await api("PUT", "/configuracion/funciones", { datos_ampliados: false }, ids.tSuper)).s, 200);
});

test("créditos grupales: grupo con cargos, crédito por integrante, desembolso y pago grupal todo o nada", async () => {
  // Apagada: el personal no entra; el Super Administrador sí
  assert.equal((await api("GET", "/grupos", null, ids.tAdmin)).s, 403);
  assert.equal((await api("GET", "/grupos", null, ids.tSuper)).s, 200);
  assert.equal((await api("PUT", "/configuracion/funciones", { creditos_grupales: true }, ids.tSuper)).s, 200);

  const integrantes = [{ id_usuario: ids.socio, cargo: "presidente" }, { id_usuario: ids.socio2, cargo: "tesorero" }];
  assert.equal((await api("POST", "/grupos", { nombre: "Solo uno", integrantes: [integrantes[0]] }, ids.tAdmin)).s, 400);
  assert.equal((await api("POST", "/grupos", { nombre: "Dos presidentes", integrantes: integrantes.map((i) => ({ ...i, cargo: "presidente" })) }, ids.tAdmin)).s, 400);
  assert.equal((await api("POST", "/grupos", { nombre: "Con personal", integrantes: [...integrantes, { id_usuario: ids.admin }] }, ids.tAdmin)).s, 400);
  const g = await api("POST", "/grupos", { nombre: "Mujeres Emprendedoras", comunidad: "Aldea El Sitio", id_promotor: ids.admin, integrantes }, ids.tAdmin);
  assert.equal(g.s, 201, g.b?.message);
  const idG = g.b.id_grupo;
  const det = await api("GET", `/grupos/${idG}`, null, ids.tAdmin);
  assert.equal(det.b.data.integrantes[0].cargo, "presidente");

  // Crédito grupal: un préstamo pendiente por integrante
  assert.equal((await api("POST", `/grupos/${idG}/creditos`, { tasa_mensual: 2, plazo_meses: 6, montos: [{ id_usuario: ids.admin, monto: 100 }] }, ids.tAdmin)).s, 400);
  const cr = await api("POST", `/grupos/${idG}/creditos`, {
    tasa_mensual: 2, plazo_meses: 6, linea_credito: "Comercio",
    montos: [{ id_usuario: ids.socio, monto: 3000 }, { id_usuario: ids.socio2, monto: 2000 }],
  }, ids.tAdmin);
  assert.equal(cr.s, 201, cr.b?.message);
  const idC = cr.b.id_credito_grupal;
  let c = (await api("GET", `/grupos/creditos/${idC}`, null, ids.tAdmin)).b.data;
  assert.equal(c.monto_total, 5000);
  assert.equal(c.estado, "pendiente");
  assert.equal(c.prestamos.length, 2);

  // Aprobar y desembolsar cada integrante con lo que ya existe
  for (const p of c.prestamos) {
    assert.equal((await api("PATCH", `/prestamos/${p.id_prestamo}/aprobar`, {}, ids.tSuper)).s, 200);
    const d = await api("POST", `/prestamos/${p.id_prestamo}/desembolsar`, { metodo: "efectivo" }, ids.tSuper);
    assert.equal(d.s, 200, d.b?.message);
  }
  c = (await api("GET", `/grupos/creditos/${idC}`, null, ids.tAdmin)).b.data;
  assert.equal(c.estado, "activo");
  const lista = (await api("GET", "/prestamos?tipo=grupal", null, ids.tAdmin)).b.data;
  assert.ok(lista.some((p) => p.grupo_nombre === "Mujeres Emprendedoras"));

  // Pago grupal: si uno no es válido, no se registra ninguno
  const [pA, pB] = c.prestamos;
  const [[antes]] = await pool.query("SELECT COUNT(*) AS n FROM pagos_prestamo WHERE id_prestamo IN (?, ?)", [pA.id_prestamo, pB.id_prestamo]);
  const malo = await api("POST", `/grupos/creditos/${idC}/pagar`, {
    metodo_pago: "efectivo", detalles: [{ id_prestamo: pA.id_prestamo, monto_pagado: 300 }, { id_prestamo: pB.id_prestamo, monto_pagado: 999999 }],
  }, ids.tAdmin);
  assert.equal(malo.s, 400);
  assert.match(malo.b.message, new RegExp(pB.nombre_completo));
  const [[igual]] = await pool.query("SELECT COUNT(*) AS n FROM pagos_prestamo WHERE id_prestamo IN (?, ?)", [pA.id_prestamo, pB.id_prestamo]);
  assert.equal(igual.n, antes.n, "todo o nada");

  const ok = await api("POST", `/grupos/creditos/${idC}/pagar`, {
    metodo_pago: "efectivo", detalles: [{ id_prestamo: pA.id_prestamo, monto_pagado: 600 }, { id_prestamo: pB.id_prestamo, monto_pagado: 400 }],
  }, ids.tAdmin);
  assert.equal(ok.s, 201, ok.b?.message);
  assert.equal(ok.b.total, 1000);
  assert.equal(ok.b.detalles.length, 2);
  assert.ok(ok.b.detalles.every((d) => d.id_recibo && d.saldo_nuevo < (d.id_prestamo === pA.id_prestamo ? 3000 : 2000)));
  const [[caja]] = await pool.query("SELECT COUNT(*) AS n FROM caja_movimientos WHERE categoria = 'pago_prestamo' AND referencia_id IN (SELECT id_pago FROM pagos_prestamo WHERE id_prestamo IN (?, ?))", [pA.id_prestamo, pB.id_prestamo]);
  assert.equal(caja.n, 2, "cada pago entra a caja");

  // No se saca del grupo a quien tiene un crédito vigente
  const [nuevoSocio] = await pool.query(
    `INSERT INTO usuarios (nombre_completo, dni, telefono, correo, password, rol_id, estado, fecha_registro)
     VALUES ('Socio Tres Grupo', '0801000000111', '98765432', 'tres@prueba.hn', 'x', 2, 'activo', NOW())`
  );
  const sinSocio2 = await api("PUT", `/grupos/${idG}`, { nombre: "Mujeres Emprendedoras", integrantes: [integrantes[0], { id_usuario: nuevoSocio.insertId }] }, ids.tAdmin);
  assert.equal(sinSocio2.s, 409);
  assert.match(sinSocio2.b.message, /crédito grupal vigente/);
  const conTres = await api("PUT", `/grupos/${idG}`, { nombre: "Mujeres Emprendedoras", integrantes: [...integrantes, { id_usuario: nuevoSocio.insertId, cargo: "vocal" }] }, ids.tAdmin);
  assert.equal(conTres.s, 200, conTres.b?.message);

  // Limpieza
  await pool.query("UPDATE prestamos SET estado = 'pagado', saldo_restante = 0 WHERE id_credito_grupal = ?", [idC]);
  await pool.query("DELETE FROM grupo_integrantes WHERE id_usuario = ?", [nuevoSocio.insertId]);
  await pool.query("DELETE FROM usuarios WHERE id_usuario = ?", [nuevoSocio.insertId]);
  assert.equal((await api("PUT", "/configuracion/funciones", { creditos_grupales: false }, ids.tSuper)).s, 200);
});

test("pagos ampliados: boleta, otros cargos que entran a caja, pago rápido y conciliación", async () => {
  assert.equal((await api("GET", "/pagos-ampliados/conciliacion", null, ids.tAdmin)).s, 403, "apagada para el personal");
  assert.equal((await api("PUT", "/configuracion/funciones", { pagos_ampliados: true }, ids.tSuper)).s, 200);

  // Dos préstamos activos del socio 2
  const crear = async (monto) => {
    const r = await api("POST", "/prestamos", { id_usuario: ids.socio2, monto, tasa_interes: 24, plazo_meses: 12, estado: "aprobado" }, ids.tSuper);
    const id = r.b.id_prestamo || r.b.data?.id_prestamo || r.b.prestamo?.id_prestamo;
    assert.equal((await api("POST", `/prestamos/${id}/desembolsar`, { metodo: "efectivo" }, ids.tSuper)).s, 200);
    return id;
  };
  const p1 = await crear(1200);
  const p2 = await crear(800);

  // Pago individual con boleta y otros cargos: los cargos no rebajan el préstamo y entran a caja aparte
  const pago = await api("POST", "/pagos", {
    id_prestamo: p1, monto_pagado: 150, metodo_pago: "deposito", numero_boleta: "B-7781", lugar_pago: "Banrural Patzún",
    otros_cargos: 25, otros_cargos_detalle: "Seguro de deuda",
  }, ids.tAdmin);
  assert.equal(pago.s, 201, pago.b?.message);
  const [[pg]] = await pool.query("SELECT numero_boleta, lugar_pago, otros_cargos FROM pagos_prestamo WHERE id_pago = ?", [pago.b.id_pago]);
  assert.equal(pg.numero_boleta, "B-7781");
  assert.equal(parseFloat(pg.otros_cargos), 25);
  const [[cg]] = await pool.query("SELECT monto FROM caja_movimientos WHERE categoria = 'ingreso_cargos_credito' AND referencia_id = ?", [pago.b.id_pago]);
  assert.equal(parseFloat(cg.monto), 25);
  assert.equal((await api("POST", "/pagos", { id_prestamo: p1, monto_pagado: 50, otros_cargos: 10 }, ids.tAdmin)).s, 400, "cargos sin concepto");

  // Anular un pago con otros cargos también los devuelve
  const otro = await api("POST", "/pagos", { id_prestamo: p2, monto_pagado: 60, metodo_pago: "efectivo", otros_cargos: 12, otros_cargos_detalle: "Gastos administrativos" }, ids.tAdmin);
  assert.equal(otro.s, 201, otro.b?.message);
  const anula = await api("DELETE", `/pagos/${otro.b.id_pago}`, { motivo: "Prueba de anulación" }, ids.tSuper);
  assert.equal(anula.s, 200, anula.b?.message);
  const [[dev]] = await pool.query("SELECT monto FROM caja_movimientos WHERE categoria = 'anulacion_cargos_credito' AND referencia_id = ?", [otro.b.id_pago]);
  assert.equal(parseFloat(dev.monto), 12);

  // Pago rápido de los dos préstamos: todo o nada
  const malo = await api("POST", "/pagos-ampliados/rapido", { metodo_pago: "efectivo", detalles: [{ id_prestamo: p1, monto_pagado: 100 }, { id_prestamo: p2, monto_pagado: 999999 }] }, ids.tAdmin);
  assert.equal(malo.s, 400);
  assert.equal((await api("POST", "/pagos-ampliados/rapido", { detalles: [{ id_prestamo: p1, monto_pagado: 10 }, { id_prestamo: ids.prestamoNuevo || 1, monto_pagado: 10 }] }, ids.tAdmin)).s >= 400, true);
  const rapido = await api("POST", "/pagos-ampliados/rapido", {
    metodo_pago: "transferencia", numero_boleta: "TR-55", detalles: [{ id_prestamo: p1, monto_pagado: 100 }, { id_prestamo: p2, monto_pagado: 80 }],
  }, ids.tAdmin);
  assert.equal(rapido.s, 201, rapido.b?.message);
  assert.equal(rapido.b.detalles.length, 2);

  // Conciliación de boletas
  const pend = await api("GET", "/pagos-ampliados/conciliacion?search=B-7781", null, ids.tAdmin);
  assert.equal(pend.s, 200);
  assert.ok(pend.b.data.some((f) => f.id_pago === pago.b.id_pago && !f.conciliado));
  assert.equal((await api("PUT", "/pagos-ampliados/conciliacion", { ids: [pago.b.id_pago] }, ids.tAdmin)).s, 200);
  const conc = await api("GET", "/pagos-ampliados/conciliacion?estado=conciliado&search=B-7781", null, ids.tAdmin);
  assert.ok(conc.b.data[0].conciliado);

  // Limpieza
  await pool.query("UPDATE prestamos SET estado = 'pagado', saldo_restante = 0 WHERE id_prestamo IN (?, ?)", [p1, p2]);
  assert.equal((await api("PUT", "/configuracion/funciones", { pagos_ampliados: false }, ids.tSuper)).s, 200);
});

test("contrato y pagaré en Word: plantilla llena con los datos del préstamo y plantilla propia", async () => {
  const PizZip = require("pizzip");
  const bajar = (ruta, token) => fetch(`${base}/api${ruta}`, { headers: { Authorization: `Bearer ${token}` } });
  const [[pr]] = await pool.query("SELECT id_prestamo FROM prestamos WHERE estado IN ('activo','mora') ORDER BY id_prestamo DESC LIMIT 1");
  assert.equal((await bajar(`/documentos-credito/prestamos/${pr.id_prestamo}/contrato`, ids.tAdmin)).status, 403, "apagada");
  assert.equal((await api("PUT", "/configuracion/funciones", { contratos_word: true }, ids.tSuper)).s, 200);

  const r = await bajar(`/documentos-credito/prestamos/${pr.id_prestamo}/contrato`, ids.tAdmin);
  assert.equal(r.status, 200);
  assert.match(r.headers.get("content-type"), /wordprocessingml/);
  const xml = new PizZip(Buffer.from(await r.arrayBuffer())).file("word/document.xml").asText();
  assert.match(xml, /CONTRATO DE PRÉSTAMO N.º \d+/);
  assert.ok(!/\{socio_nombre\}/.test(xml), "sin marcadores sin llenar");
  assert.match(xml, /con \d{2}\/100/, "monto en letras");
  const pag = await bajar(`/documentos-credito/prestamos/${pr.id_prestamo}/pagare`, ids.tAdmin);
  assert.equal(pag.status, 200);

  // Plantilla propia: una mal escrita se rechaza; una buena se usa; borrarla vuelve a la original
  const docx = (texto) => {
    const z = new PizZip(require("fs").readFileSync(require("path").join(__dirname, "../../plantillas/pagare.docx")));
    z.file("word/document.xml", z.file("word/document.xml").asText().replace(/PAGARÉ N.º \{numero_pagare\}/, texto));
    return z.generate({ type: "nodebuffer" });
  };
  const subir = (buffer, token = ids.tSuper) => {
    const f = new FormData();
    f.append("plantilla", new Blob([buffer]), "pagare.docx");
    return fetch(`${base}/api/documentos-credito/plantillas/pagare`, { method: "PUT", headers: { Authorization: `Bearer ${token}` }, body: f });
  };
  assert.equal((await subir(docx("PAGARÉ PROPIO {socio_nombre}"), ids.tAdmin)).status, 403);
  assert.equal((await subir(docx("PAGARÉ {socio_nombre"))).status, 400);
  assert.equal((await subir(docx("PAGARÉ PROPIO {socio_nombre}"))).status, 200);
  const propio = new PizZip(Buffer.from(await (await bajar(`/documentos-credito/prestamos/${pr.id_prestamo}/pagare`, ids.tAdmin)).arrayBuffer())).file("word/document.xml").asText();
  assert.match(propio, /PAGARÉ PROPIO/);
  const pl = await api("GET", "/documentos-credito/plantillas", null, ids.tAdmin);
  assert.equal(pl.b.data.find((x) => x.tipo === "pagare").personalizada, true);
  assert.equal((await api("DELETE", "/documentos-credito/plantillas/pagare", null, ids.tSuper)).s, 200);
  assert.equal((await api("GET", "/documentos-credito/plantillas", null, ids.tAdmin)).b.data.find((x) => x.tipo === "pagare").personalizada, false);

  assert.equal((await api("PUT", "/configuracion/funciones", { contratos_word: false }, ids.tSuper)).s, 200);
});

test("monitoreo: el estado del servicio responde", async () => {
  const r = await api("GET", "/salud");
  assert.equal(r.s, 200);
  assert.equal(r.b.estado, "ok");
  assert.ok(r.b.migraciones.aplicadas >= 7);
});
