// Códigos telefónicos para el registro: Honduras primero (predeterminado) y luego
// los países donde más viven hondureños. digitos = largo del número sin el código.
export const PAISES_TEL = [
  { codigo: "504", nombre: "Honduras", bandera: "🇭🇳", digitos: 8, ejemplo: "98765432" },
  { codigo: "1", nombre: "Estados Unidos", bandera: "🇺🇸", digitos: 10, ejemplo: "3055551234" },
  { codigo: "1", nombre: "Canadá", bandera: "🇨🇦", digitos: 10, ejemplo: "4165551234", clave: "CA" },
  { codigo: "34", nombre: "España", bandera: "🇪🇸", digitos: 9, ejemplo: "612345678" },
  { codigo: "52", nombre: "México", bandera: "🇲🇽", digitos: 10, ejemplo: "5512345678" },
  { codigo: "502", nombre: "Guatemala", bandera: "🇬🇹", digitos: 8, ejemplo: "51234567" },
  { codigo: "503", nombre: "El Salvador", bandera: "🇸🇻", digitos: 8, ejemplo: "71234567" },
  { codigo: "505", nombre: "Nicaragua", bandera: "🇳🇮", digitos: 8, ejemplo: "81234567" },
  { codigo: "506", nombre: "Costa Rica", bandera: "🇨🇷", digitos: 8, ejemplo: "81234567" },
  { codigo: "507", nombre: "Panamá", bandera: "🇵🇦", digitos: 8, ejemplo: "61234567" },
  { codigo: "501", nombre: "Belice", bandera: "🇧🇿", digitos: 7, ejemplo: "6221234" },
  { codigo: "39", nombre: "Italia", bandera: "🇮🇹", digitos: 10, ejemplo: "3123456789" },
  { codigo: "57", nombre: "Colombia", bandera: "🇨🇴", digitos: 10, ejemplo: "3001234567" },
].map((p) => ({ ...p, clave: p.clave || p.nombre }));

export const PAIS_PREDETERMINADO = PAISES_TEL[0];

// Número como se guarda: Honduras sin código (8 dígitos); otros países con "+código"
export const telefonoCompleto = (pais, digitos) => (pais.codigo === "504" ? digitos : `+${pais.codigo}${digitos}`);
