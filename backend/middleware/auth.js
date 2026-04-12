const jwt = require("jsonwebtoken");

const verificarToken = (req, res, next) => {
  const token = req.header("Authorization")?.replace("Bearer ", "");

  if (!token) {
    return res.status(401).json({ message: "Token no proporcionado" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.usuario = decoded;
    next();
  } catch (error) {
    res.status(401).json({ message: "Token inválido o expirado" });
  }
};

// Middleware extra para proteger rutas solo para admin
const soloAdmin = (req, res, next) => {
  if (
    !req.usuario ||
    (req.usuario.rol !== "Administrador" && req.usuario.rol !== "Super Administrador")
  ) {
    return res
      .status(403)
      .json({ message: "Acceso denegado, solo administradores." });
  }
  next();
};

// Middleware para proteger rutas solo para Super Administrador
const soloSuperAdmin = (req, res, next) => {
  if (!req.usuario || req.usuario.rol !== "Super Administrador") {
    return res
      .status(403)
      .json({ message: "Acceso denegado, solo el Super Administrador." });
  }
  next();
};

module.exports = { verificarToken, soloAdmin, soloSuperAdmin };
