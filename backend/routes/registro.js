// Registro público de nuevos socios mediante un enlace que comparte la cooperativa.
// La cuenta queda en estado "pendiente" hasta que el personal la apruebe.
const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const pool = require("../db");
const { validarPassword } = require("../utils/passwordPolicy");
const { leerRegistro } = require("../utils/registroConfig");
const { notificarAdministradores } = require("../utils/notificaciones");

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
    return rows.length ? rows[0].valor : "Cooperativa";
  } catch {
    return "Cooperativa";
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
    });
  } catch (error) {
    res.status(500).json({ message: "No se pudo verificar el enlace de registro" });
  }
});

// POST /api/registro
router.post("/", async (req, res) => {
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

    const nombre = String(nombre_completo || "").trim();
    if (nombre.length < 5 || nombre.split(/\s+/).length < 2) {
      return res.status(400).json({ message: "Escribe tu nombre completo (nombre y apellido)." });
    }
    if (!validarDNI(String(dni || ""))) {
      return res.status(400).json({ message: "La identidad debe tener 13 dígitos, sin guiones." });
    }
    if (!validarTelefono(String(telefono || ""))) {
      return res.status(400).json({ message: "El teléfono debe tener 8 dígitos." });
    }
    if (correo && !validarEmail(String(correo))) {
      return res.status(400).json({ message: "El correo electrónico no es válido." });
    }
    if (!fecha_nacimiento || !mayorDeEdad(fecha_nacimiento)) {
      return res.status(400).json({ message: "Debes ser mayor de 18 años para registrarte." });
    }
    const errorPassword = validarPassword(password);
    if (errorPassword) return res.status(400).json({ message: errorPassword });

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
    const [r] = await pool.query(
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

    await pool.query(
      `INSERT INTO bitacora (id_usuario, accion, detalle, fecha) VALUES (?, ?, ?, NOW())`,
      [r.insertId, "Registro por enlace", `Nueva solicitud de socio: ${nombre} (DNI ${dni}). Pendiente de aprobación.`]
    );

    notificarAdministradores(
      "Nueva solicitud de socio",
      `<p><strong>${nombre}</strong> (identidad ${dni}) se registró por el enlace de la cooperativa y espera aprobación.</p>`
    );

    res.status(201).json({
      success: true,
      message: "Registro recibido. Ya puedes iniciar sesión y enviar tu solicitud de préstamo.",
      id_usuario: r.insertId,
    });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      const campo = String(error.sqlMessage || "").includes("correo") ? "este correo electrónico" : "estos datos";
      return res.status(409).json({
        message: `Ya existe una cuenta registrada con ${campo}. Inicia sesión o comunícate con la cooperativa.`,
      });
    }
    console.error("ERROR EN REGISTRO PÚBLICO:", error);
    res.status(500).json({ message: "No se pudo completar el registro. Intenta de nuevo." });
  }
});

module.exports = router;
