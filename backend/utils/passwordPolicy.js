// Política mínima de contraseñas: 8+ caracteres, con letras y números.
const validarPassword = (password) => {
  if (typeof password !== "string" || password.length < 8) {
    return "La contraseña debe tener al menos 8 caracteres.";
  }
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return "La contraseña debe combinar letras y números.";
  }
  return null;
};

module.exports = { validarPassword };
