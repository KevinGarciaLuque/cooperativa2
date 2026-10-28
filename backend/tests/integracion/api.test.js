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

test("monitoreo: el estado del servicio responde", async () => {
  const r = await api("GET", "/salud");
  assert.equal(r.s, 200);
  assert.equal(r.b.estado, "ok");
  assert.ok(r.b.migraciones.aplicadas >= 7);
});
