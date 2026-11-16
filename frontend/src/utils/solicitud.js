// Datos y cálculos de la solicitud de préstamo (panel del socio y enlace de registro).

import { dinero } from "./pais";

export const fmt = (n) =>
  dinero(n || 0);

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
  id_producto: "",
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
  ...(form.id_producto ? { id_producto: parseInt(form.id_producto) } : {}),
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

// Condiciones que aplican a la solicitud: las del producto elegido si la cooperativa ofrece
// productos de crédito; si no, las generales. `falta_producto` si hay productos y no eligió.
export const condiciones = (param, form) => {
  if (!param) return null;
  const productos = param.productos || [];
  if (!productos.length) return { ...param, monto_min: 0, plazo_min: 1, producto: null, falta_producto: false };
  const producto = productos.find((p) => String(p.id_producto) === String(form.id_producto)) || null;
  if (!producto) return { ...param, monto_min: 0, plazo_min: 1, producto: null, falta_producto: true };
  return {
    ...param,
    tasa_mensual: producto.tasa_mensual,
    monto_min: producto.monto_min,
    monto_max: producto.monto_max,
    plazo_min: producto.plazo_min,
    plazo_max: producto.plazo_max,
    producto,
    falta_producto: false,
  };
};

// Revisión del paso del préstamo antes de seguir: el mensaje de error o null
export const errorDelPrestamo = (param, form) => {
  const c = condiciones(param, form);
  if (!c) return null;
  if (c.falta_producto) return "Elige el tipo de préstamo.";
  const monto = parseFloat(form.monto) || 0;
  const plazo = parseInt(form.plazo_meses) || 0;
  if (monto < c.monto_min || monto > c.monto_max || monto <= 0) {
    return c.monto_min > 0 ? `El monto va de ${fmt(c.monto_min)} a ${fmt(c.monto_max)}.` : `El monto máximo es ${fmt(c.monto_max)}.`;
  }
  if (plazo < c.plazo_min || plazo > c.plazo_max) return `El plazo debe estar entre ${c.plazo_min} y ${c.plazo_max} meses.`;
  return null;
};

export const simular = (param, form) => {
  const monto = parseFloat(form.monto) || 0;
  const plazo = parseInt(form.plazo_meses) || 0;
  const ingreso = parseFloat(form.ingreso_mensual) || 0;
  const c = condiciones(param, form);
  const cuotaEstimada = c && !c.falta_producto && monto > 0 && plazo > 0 ? cuotaDe(monto, plazo, c.tasa_mensual) : 0;


  const relacion = ingreso > 0 && cuotaEstimada > 0 ? (cuotaEstimada / ingreso) * 100 : null;
  return {
    plazo,
    cuotaEstimada,
    relacion,
    relacionAlta: relacion !== null && relacion > (param?.pct_ingreso_max || 40),
  };
};
