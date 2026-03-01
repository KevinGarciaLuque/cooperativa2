const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");

// Cargar variables de entorno
dotenv.config();

const app = express();

// Middlewares
const allowedOrigins = [
  "http://localhost:5173",
  "https://mellow-delight-production.up.railway.app",
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Permitir peticiones sin origin (Postman, mobile, etc.)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error("CORS no permitido para: " + origin));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Responder preflight OPTIONS en todas las rutas
app.options("*", cors());

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Ruta para archivos subidos (si usas uploads)
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Rutas principales
app.use("/api/usuarios", require("./routes/usuarios"));
app.use("/api/cuentas", require("./routes/cuentas"));
app.use("/api/prestamos", require("./routes/prestamos"));
app.use("/api/aportaciones", require("./routes/aportaciones"));
app.use("/api/pagos", require("./routes/pagos"));
app.use("/api/movimientos", require("./routes/movimientos"));
app.use("/api/bitacora", require("./routes/bitacora"));
app.use("/api/actividades", require("./routes/actividades"));
app.use("/api/liquidaciones", require("./routes/liquidaciones"));
app.use("/api/reportes", require("./routes/reportes"));
app.use("/api/dashboard", require("./routes/dashboard"));
app.use("/api/roles", require("./routes/roles"));
app.use("/api/recuperar", require("./routes/recuperar"));




// Ruta de prueba
app.get("/", (req, res) => {
  res.send("API Cooperativa funcionando correctamente 🚀");
});

// Puerto
const PORT = process.env.PORT || 5000;

// Iniciar servidor
app.listen(PORT, () => {
  console.log(
    `Servidor backend de Cooperativa escuchando en el puerto ${PORT}`
  );
});
