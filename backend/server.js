const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

// Cargar variables de entorno (antes de cargar módulos que las usan)
dotenv.config();

const { ocultarInteresSocio } = require("./middleware/ocultarInteres");
const { guardiaApi, limpiarRespuestas } = require("./middleware/seguridad");

// Sin clave de firma no se arranca: evita sesiones firmadas con un valor conocido
if (!process.env.JWT_SECRET) {
  console.error("FATAL: la variable de entorno JWT_SECRET no está definida.");
  process.exit(1);
}

const app = express();

// Detrás del proxy de Railway: necesario para ver la IP real del cliente
app.set("trust proxy", 1);

// Cabeceras de seguridad (las imágenes de /uploads se cargan desde el frontend)
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: false,
  })
);

// Middlewares
const allowedOrigins = [
  "http://localhost:5173",
  "https://smartcoop.up.railway.app",
  process.env.FRONTEND_URL,
].filter(Boolean);

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

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Ruta para archivos subidos (si usas uploads)
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Límite de intentos de inicio de sesión (por IP y DNI)
const limiteLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `${req.ip}|${String(req.body?.dni || "").trim()}`,
  message: { message: "Demasiados intentos de inicio de sesión. Intenta de nuevo en 15 minutos." },
});
app.use("/api/usuarios/login", limiteLogin);

// Límite para recuperación de contraseña (evita envío masivo de correos)
const limiteRecuperar = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Demasiadas solicitudes. Intenta de nuevo más tarde." },
});
app.use("/api/recuperar", limiteRecuperar);

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
app.use("/api/socios", ocultarInteresSocio, require("./routes/socios"));

// Iniciar el scheduler de backups automáticos
const { iniciarScheduler } = require("./utils/backupScheduler");
iniciarScheduler();

// Verificación diaria de préstamos en mora
const { iniciarMoraScheduler } = require("./utils/moraScheduler");
iniciarMoraScheduler();




// Ruta de prueba
app.get("/", (req, res) => {
  res.send("API Cooperativa funcionando correctamente 🚀");
});

// Puerto
const PORT = process.env.PORT || 5000;

// Aplicar migraciones pendientes y luego iniciar el servidor
const { aplicarMigraciones } = require("./utils/migraciones");

aplicarMigraciones()
  .catch((error) => {
    // Un fallo de migración no debe impedir que el sistema siga funcionando
    console.error("ERROR AL APLICAR MIGRACIONES:", error.message);
  })
  .finally(() => {
    app.listen(PORT, () => {
      console.log(
        `Servidor backend de Cooperativa escuchando en el puerto ${PORT}`
      );
    });
  });
