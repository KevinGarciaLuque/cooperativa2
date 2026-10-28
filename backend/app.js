// Aplicación Express (sin arrancar el servidor): la usan server.js y las pruebas.
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");
const crypto = require("crypto");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

// Cargar variables de entorno (antes de cargar módulos que las usan)
dotenv.config();

const logger = require("./utils/logger");
const { ocultarInteresSocio } = require("./middleware/ocultarInteres");
const { guardiaApi, limpiarRespuestas } = require("./middleware/seguridad");

// Sin clave de firma no se arranca: evita sesiones firmadas con un valor conocido
if (!process.env.JWT_SECRET) {
  console.error("FATAL: la variable de entorno JWT_SECRET no está definida.");
  process.exit(1);
}

const app = express();
const enPruebas = process.env.NODE_ENV === "test";

// Detrás del proxy de Railway: necesario para ver la IP real del cliente
app.set("trust proxy", 1);

// Cabeceras de seguridad (las imágenes de /uploads se cargan desde el frontend)
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: false,
  })
);

// Orígenes permitidos: los fijos más los de CORS_ORIGINS (separados por coma)
const allowedOrigins = [
  "http://localhost:5173",
  "https://smartcoop.up.railway.app",
  process.env.FRONTEND_URL,
  ...String(process.env.CORS_ORIGINS || "").split(","),
]
  .map((o) => (o || "").trim())
  .filter(Boolean);

const corsMiddleware = cors({
  origin: (origin, callback) => {
    // Permitir peticiones sin origin (Postman, mobile, etc.)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("CORS no permitido para: " + origin));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
});
app.use(corsMiddleware);

// Responder preflight OPTIONS con la misma política de CORS
app.options("*", corsMiddleware);

// Registro de cada petición (id, método, ruta, estado y duración)
app.use((req, res, next) => {
  const inicio = process.hrtime.bigint();
  req.id = crypto.randomBytes(4).toString("hex");
  res.setHeader("X-Request-Id", req.id);
  res.on("finish", () => {
    if (req.path === "/api/salud") return;
    const ms = Number(process.hrtime.bigint() - inicio) / 1e6;
    const datos = {
      id: req.id,
      metodo: req.method,
      ruta: req.originalUrl.split("?")[0],
      estado: res.statusCode,
      ms: Math.round(ms),
      usuario: req.usuario?.id_usuario,
    };
    if (res.statusCode >= 500) logger.error("peticion", null, datos);
    else if (res.statusCode >= 400) logger.warn("peticion", datos);
    else logger.info("peticion", datos);
  });
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Imágenes subidas: primero desde la base de datos (persisten entre despliegues);
// si no están, los archivos que ya existían en disco.
app.use("/uploads", require("./utils/archivos").servirArchivos);
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Estado del servicio (para monitoreo): público y sin datos sensibles
app.get("/api/salud", async (req, res) => {
  const pool = require("./db");
  let bd = "ok";
  let migraciones = null;
  try {
    await pool.query("SELECT 1");
    const [[m]] = await pool.query("SELECT COUNT(*) AS n, MAX(id) AS ultima FROM schema_migraciones");
    migraciones = { aplicadas: m.n, ultima: m.ultima };
  } catch (error) {
    bd = "error";
  }
  res.status(bd === "ok" ? 200 : 503).json({
    estado: bd === "ok" ? "ok" : "degradado",
    bd,
    migraciones,
    uptime_s: Math.round(process.uptime()),
    version: process.env.RAILWAY_GIT_COMMIT_SHA ? process.env.RAILWAY_GIT_COMMIT_SHA.substring(0, 7) : "local",
  });
});

// Límites de uso (se desactivan al probar para no bloquear las pruebas)
if (!enPruebas) {
  // Intentos de inicio de sesión (por IP y DNI)
  app.use(
    "/api/usuarios/login",
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 10,
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: (req) => `${req.ip}|${String(req.body?.dni || "").trim()}`,
      message: { message: "Demasiados intentos de inicio de sesión. Intenta de nuevo en 15 minutos." },
    })
  );

  // Recuperación de contraseña (evita envío masivo de correos)
  app.use(
    "/api/recuperar",
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 5,
      standardHeaders: true,
      legacyHeaders: false,
      message: { message: "Demasiadas solicitudes. Intenta de nuevo más tarde." },
    })
  );

  // Registros nuevos (evita altas masivas)
  app.use(
    "/api/registro",
    rateLimit({
      windowMs: 60 * 60 * 1000,
      max: 10,
      standardHeaders: true,
      legacyHeaders: false,
      message: { message: "Demasiados registros desde esta conexión. Intenta de nuevo más tarde." },
    })
  );

  // Límite general de la API
  app.use(
    "/api",
    rateLimit({
      windowMs: 60 * 1000,
      max: 600,
      standardHeaders: true,
      legacyHeaders: false,
      message: { message: "Demasiadas peticiones. Intenta de nuevo en un momento." },
    })
  );
}

// Seguridad: limpieza de respuestas + sesión y permisos en TODA la API
app.use("/api", limpiarRespuestas);
app.use("/api", guardiaApi);

// Rutas principales
app.use("/api/usuarios", require("./routes/usuarios"));
app.use("/api/cuentas", require("./routes/cuentas"));
app.use("/api/prestamos", ocultarInteresSocio, require("./routes/prestamos"));
app.use("/api/aportaciones", require("./routes/aportaciones"));
app.use("/api/pagos", ocultarInteresSocio, require("./routes/pagos"));
app.use("/api/movimientos", require("./routes/movimientos"));
app.use("/api/bitacora", require("./routes/bitacora"));
app.use("/api/actividades", require("./routes/actividades"));
app.use("/api/liquidaciones", ocultarInteresSocio, require("./routes/liquidaciones"));
app.use("/api/reportes", require("./routes/reportes"));
app.use("/api/dashboard", require("./routes/dashboard"));
app.use("/api/roles", require("./routes/roles"));
app.use("/api/recuperar", require("./routes/recuperar"));
app.use("/api/basedatos", require("./routes/basedatos"));
app.use("/api/permisos", require("./routes/permisos"));
app.use("/api/configuracion", require("./routes/configuracion"));
app.use("/api/caja", require("./routes/caja"));
app.use("/api/recibos", require("./routes/recibos"));
app.use("/api/cobranza", require("./routes/cobranza"));
app.use("/api/consolidaciones", require("./routes/consolidaciones"));
app.use("/api/contabilidad", require("./routes/contabilidad"));
app.use("/api/registro", require("./routes/registro"));
app.use("/api/solicitudes", require("./routes/solicitudes"));
app.use("/api/firma", require("./routes/firma"));
app.use("/api/pagos-reportados", require("./routes/pagosReportados"));
app.use("/api/notificaciones", require("./routes/notificaciones"));
app.use("/api/politicas", require("./routes/politicas"));
app.use("/api/socios", ocultarInteresSocio, require("./routes/socios"));

// Ruta de prueba
app.get("/", (req, res) => {
  res.send("API Cooperativa funcionando correctamente 🚀");
});

// Errores no controlados: se registran y el cliente recibe un mensaje genérico
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const esCors = String(err.message || "").startsWith("CORS no permitido");
  if (esCors) return res.status(403).json({ message: "Origen no permitido." });
  logger.error("error_no_controlado", err, { id: req.id, ruta: req.originalUrl });
  res.status(500).json({ message: "Error interno del servidor.", id: req.id });
});

module.exports = app;
