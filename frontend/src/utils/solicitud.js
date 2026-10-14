// Datos y cálculos de la solicitud de préstamo (panel del socio y enlace de registro).

export const fmt = (n) =>
  `L. ${parseFloat(n || 0).toLocaleString("es-HN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const PROPOSITOS = {
  negocio: "Negocio o capital de trabajo",
  vivienda: "Vivienda o mejoras del hogar",
  educacion: "Educación",
  salud: "Salud o emergencia",
  agricultura: "Agricultura o ganadería",
  consumo: "Consumo personal",
  otro: "Otro",
};

export const OCUPACIONES = {
  empleado: "Empleado",
  negocio_propio: "Negocio propio",
  agricultor: "Agricultor / ganadero",
  independiente: "Trabajador independiente",
  jubilado: "Jubilado o pensionado",
  otro: "Otro",
};

export const SOLICITUD_VACIA = {
  monto: "",
  plazo_meses: "",
  proposito: "",
  descripcion: "",
  ocupacion: "",
  lugar_trabajo: "",
  ingreso_mensual: "",
  ref1_nombre: "",
  ref1_telefono: "",
  ref1_parentesco: "",
  ref2_nombre: "",
  ref2_telefono: "",
  ref2_parentesco: "",
};

// Cuerpo que espera el servidor
export const solicitudDesde = (form, acepta) => ({
  monto: parseFloat(form.monto) || 0,
  plazo_meses: parseInt(form.plazo_meses) || 0,
  proposito: form.proposito,
  descripcion: form.descripcion,
  ocupacion: form.ocupacion,
  lugar_trabajo: form.lugar_trabajo,
  ingreso_mensual: parseFloat(form.ingreso_mensual) || 0,
  // ref1 = aval (obligatorio), ref2 = referencia personal (opcional)
  referencias: [
    ["aval", 1],
    ["referencia", 2],
  ]
    .map(([tipo, n]) => ({
      tipo,
      nombre: form[`ref${n}_nombre`],
      telefono: form[`ref${n}_telefono`],
      parentesco: form[`ref${n}_parentesco`],
    }))
    .filter((r) => r.nombre && r.telefono),
  acepta,
});

// Cuota con la tasa referencial (sistema francés)
const cuotaDe = (monto, plazo, tasaMensual) => {
  const i = tasaMensual / 100;
  if (i === 0) return monto / plazo;
  return (monto * i * Math.pow(1 + i, plazo)) / (Math.pow(1 + i, plazo) - 1);
};

export const simular = (param, form) => {
  const monto = parseFloat(form.monto) || 0;
  const plazo = parseInt(form.plazo_meses) || 0;
  const ingreso = parseFloat(form.ingreso_mensual) || 0;
  const cuotaEstimada = param && monto > 0 && plazo > 0 ? cuotaDe(monto, plazo, param.tasa_mensual) : 0;


  const relacion = ingreso > 0 && cuotaEstimada > 0 ? (cuotaEstimada / ingreso) * 100 : null;
  return {
    plazo,
    cuotaEstimada,
    relacion,
    relacionAlta: relacion !== null && relacion > (param?.pct_ingreso_max || 40),
  };
};
