// Registro público de nuevos socios mediante un enlace que comparte la cooperativa.
// Quien llega por el enlace puede pedir su préstamo en el mismo formulario: la cuenta y la
// solicitud se crean juntas y quedan "pendientes" hasta que el personal las apruebe.
const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const pool = require("../db");
const { validarPassword } = require("../utils/passwordPolicy");
const { leerRegistro } = require("../utils/registroConfig");
const { notificarAdministradores, escaparHtml } = require("../utils/notificaciones");
const { parametrosSolicitud, validarSolicitud, insertarSolicitud } = require("../utils/solicitudPrestamo");
const { subidaIdentidad, mensajeErrorSubida, guardarLado } = require("../utils/identidad");
const { formatearNombre } = require("../utils/nombres");

const validarDNI = (v) => /^\d{13}$/.test(v);
const validarTelefono = (v) => /^\d{8}$/.test(v);
const validarEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const mayorDeEdad = (fecha) => {
  const f = new Date(fecha);
  if (isNaN(f)) return false;
  const hoy = new Date();
  let edad = hoy.getFullYear() - f.getFullYear();
  const m = hoy.getMonth() - f.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < f.getDate())) edad--;
  return edad >= 18 && edad < 110;
};

const nombreCooperativa = async () => {
  try {
    const [rows] = await pool.query("SELECT valor FROM configuracion_sitio WHERE clave = 'site_name'");
    return rows.length ? rows[0].valor : "SmartCoop";
  } catch {
    return "SmartCoop";
  }
};

// GET /api/registro/estado?c=CODIGO  → la pantalla de registro decide qué mostrar
router.get("/estado", async (req, res) => {
  try {
    const cfg = await leerRegistro();
    const valido = cfg.habilitado && (!cfg.codigo || req.query.c === cfg.codigo);
    res.json({
      success: true,
      cooperativa: await nombreCooperativa(),
      habilitado: cfg.habilitado,
      valido,
      // Para calcular la cuota estimada en el formulario (solo con un enlace válido)
      parametros: valido ? parametrosSolicitud() : null,
    });
  } catch (error) {
    res.status(500).json({ message: "No se pudo verificar el enlace de registro" });
  }
});

// Recibe el formulario como multipart: los datos en el campo "datos" (JSON) y las fotos
// de la identidad en "dni_frente" y "dni_reverso"
const recibirFormulario = (req, res, next) =>
  subidaIdentidad.fields([
    { name: "dni_frente", maxCount: 1 },
    { name: "dni_reverso", maxCount: 1 },
  ])(req, res, (err) => {
    if (err) return res.status(400).json({ message: mensajeErrorSubida(err) });
    if (typeof req.body?.datos === "string") {
      try {
        req.body = JSON.parse(req.body.datos);
      } catch {
        return res.status(400).json({ message: "No se pudo leer el formulario." });
      }
    }
    next();
  });

// POST /api/registro
router.post("/", recibirFormulario, async (req, res) => {
  let connection;
  try {
    const {
      nombre_completo,
      dni,
      telefono,
      correo,
      direccion,
      fecha_nacimiento,
      password,
      codigo,
      prestamo, // opcional: la solicitud de préstamo que llena en el mismo formulario
      website, // campo trampa: un humano no lo llena
    } = req.body;

    if (website) return res.status(201).json({ success: true });

    const cfg = await leerRegistro();
    if (!cfg.habilitado) {
      return res.status(403).json({ message: "El registro de nuevos socios no está disponible por el momento." });
    }
    if (cfg.codigo && codigo !== cfg.codigo) {
      return res.status(403).json({ message: "Este enlace de registro no es válido o ya venció. Pide uno nuevo a la cooperativa." });
    }

    const nombre = formatearNombre(nombre_completo);
    if (nombre.length < 5 || nombre.split(/\s+/).length < 2) {
      return res.status(400).json({ message: "Escribe tu nombre completo (nombre y apellido)." });
    }
    if (!validarDNI(String(dni || ""))) {
      return res.status(400).json({ message: "La identidad debe tener 13 dígitos, sin guiones." });
    }
    if (!validarTelefono(String(telefono || ""))) {
      return res.status(400).json({ message: "El teléfono debe tener 8 dígitos." });
    }
    if (!correo || !validarEmail(String(correo).trim())) {
      return res.status(400).json({ message: "Escribe un correo electrónico válido: ahí recibirás tus recibos." });
    }
    if (!fecha_nacimiento || !mayorDeEdad(fecha_nacimiento)) {
      return res.status(400).json({ message: "Debes ser mayor de 18 años para registrarte." });
    }
    const errorPassword = validarPassword(password);
    if (errorPassword) return res.status(400).json({ message: errorPassword });

    const dniFrente = req.files?.dni_frente?.[0];
    const dniReverso = req.files?.dni_reverso?.[0];
    if (!dniFrente || !dniReverso) {
      return res.status(400).json({ message: "Adjunta las fotos del frente y del reverso de tu identidad." });
    }

    let solicitud = null;
    if (prestamo) {
      const { error, datos } = validarSolicitud(prestamo);
      if (error) return res.status(400).json({ message: error });
      solicitud = datos;
    }

    const [existe] = await pool.query("SELECT id_usuario, estado FROM usuarios WHERE dni = ?", [dni]);
    if (existe.length) {
      const msg =
        existe[0].estado === "rechazado"
          ? "Tu solicitud anterior no fue aprobada. Comunícate con la cooperativa."
          : "Ya existe una cuenta con esta identidad. Inicia sesión o comunícate con la cooperativa.";
      return res.status(409).json({ message: msg });
    }

    const [rol] = await pool.query("SELECT id_rol FROM roles WHERE nombre = 'Socio' LIMIT 1");
    if (!rol.length) return res.status(500).json({ message: "No se pudo completar el registro." });

    const hash = await bcrypt.hash(password, 10);

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [r] = await connection.query(
      `INSERT INTO usuarios
         (nombre_completo, dni, telefono, correo, direccion, fecha_nacimiento, password, rol_id, estado, fecha_registro)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pendiente', NOW())`,
      [
        nombre,
        dni,
        telefono,
        correo ? String(correo).trim() : null,
        direccion ? String(direccion).trim().substring(0, 200) : null,
        fecha_nacimiento,
        hash,
        rol[0].id_rol,
      ]
    );

    await guardarLado(connection, r.insertId, "frente", dniFrente, r.insertId);
    await guardarLado(connection, r.insertId, "reverso", dniReverso, r.insertId);

    let creada = null;
    if (solicitud) creada = await insertarSolicitud(connection, r.insertId, solicitud);

    await connection.query(
      `INSERT INTO bitacora (id_usuario, accion, detalle, fecha) VALUES (?, ?, ?, NOW())`,
      [
        r.insertId,
        "Registro por enlace",
        `Nueva solicitud de socio: ${nombre} (DNI ${dni}). Pendiente de aprobación.` +
          (creada
            ? ` Solicita L. ${solicitud.monto.toFixed(2)} a ${solicitud.plazo} meses (cuota estimada L. ${creada.cuota_estimada.toFixed(2)}). Préstamo #${creada.id_prestamo}`
            : " Sin solicitud de préstamo."),
      ]
    );

    await connection.commit();

    notificarAdministradores(
      creada ? "Nueva solicitud de socio y préstamo" : "Nueva solicitud de socio",
      `<p><strong>${escaparHtml(nombre)}</strong> (identidad ${dni}) se registró por el enlace de la cooperativa y espera aprobación.</p>` +
        (creada
          ? `<p>Solicita un préstamo de <strong>L. ${solicitud.monto.toLocaleString("es-HN", { minimumFractionDigits: 2 })}</strong> a ${solicitud.plazo} meses.</p>`
          : "")
    );

    res.status(201).json({
      success: true,
      message: creada
        ? "Registro y solicitud de préstamo recibidos. La cooperativa los revisará y te responderá pronto."
        : "Registro recibido. La cooperativa revisará tus datos y activará tu cuenta.",
      id_usuario: r.insertId,
      id_prestamo: creada ? creada.id_prestamo : null,
      cuota_estimada: creada ? creada.cuota_estimada : null,
    });
  } catch (error) {
    if (connection) await connection.rollback().catch(() => {});
    if (error.code === "ER_DUP_ENTRY") {
      const campo = String(error.sqlMessage || "").includes("correo") ? "este correo electrónico" : "estos datos";
      return res.status(409).json({
        message: `Ya existe una cuenta registrada con ${campo}. Inicia sesión o comunícate con la cooperativa.`,
      });
    }
    console.error("ERROR EN REGISTRO PÚBLICO:", error);
    res.status(500).json({ message: "No se pudo completar el registro. Intenta de nuevo." });
  } finally {
    if (connection) connection.release();
  }
});

module.exports = router;
