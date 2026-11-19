// Control por acción (después de la sesión y los permisos de módulo):
//  - Permisos por acción y solo lectura (función "permisos_por_accion")
//  - Segregación de funciones (función "segregacion_funciones")
// El Super Administrador y los socios no pasan por aquí (los socios ya tienen sus reglas).
const pool = require("../db");
const funciones = require("../utils/funciones");
const { accionDe, nombreDe, datosDelRol, PERMITIDO_SOLO_LECTURA } = require("../utils/acciones");
const { dinero } = require("../utils/pais");

const num = (v) => parseFloat(v || 0);

// Monto de la operación, para comparar con el límite del rol (null si no aplica)
const montoDe = async (accion, metodo, ruta, b = {}) => {
  let m;
  const deDb = async (sql, id) => {
    const [[f]] = await pool.query(sql, [id]);
    return f ? num(f.m) : null;
  };
  if ((m = ruta.match(/^\/prestamos\/(\d+)\/(aprobar|desembolsar)$/))) return deDb("SELECT monto AS m FROM prestamos WHERE id_prestamo = ?", m[1]);
  if ((m = ruta.match(/^\/solicitudes\/prestamos\/(\d+)\/aprobar$/))) {
    return b.monto !== undefined ? num(b.monto) : deDb("SELECT monto AS m FROM prestamos WHERE id_prestamo = ?", m[1]);
  }
  if (metodo === "POST" && ruta === "/prestamos") return num(b.monto);
  if (metodo === "POST" && ruta === "/pagos") return num(b.monto_pagado);
  if (ruta === "/pagos-ampliados/rapido") {
    return (b.detalle || []).reduce((t, d) => t + num(d.monto_pagado), 0) + (b.depositos || []).reduce((t, d) => t + num(d.monto), 0);
  }
  if ((m = ruta.match(/^\/planillas\/lotes\/(\d+)\/aplicar$/))) return deDb("SELECT total_esperado AS m FROM planilla_lotes WHERE id_lote = ?", m[1]);
  if ((m = ruta.match(/^\/pagos\/(\d+)$/)) && metodo === "DELETE") return deDb("SELECT monto_pagado AS m FROM pagos_prestamo WHERE id_pago = ?", m[1]);
  if ((m = ruta.match(/^\/ahorro\/plazos\/(\d+)\/pagar$/))) return deDb("SELECT monto AS m FROM depositos_plazo WHERE id_deposito = ?", m[1]);
  if (["/movimientos", "/aportaciones", "/ahorro/plazos", "/caja/gasto", "/caja/ingreso"].includes(ruta) && metodo === "POST") return num(b.monto);
  return null;
};

// Descripción corta de la operación para la bandeja de autorizaciones
const describir = async (accion, monto, ruta, b) => {
  let m;
  let que = accion ? nombreDe(accion) : "Operación";
  if ((m = ruta.match(/^\/(?:solicitudes\/)?prestamos\/(\d+)/))) que += ` · préstamo #${m[1]}`;
  if (b?.id_prestamo) que += ` · préstamo #${b.id_prestamo}`;
  if ((m = ruta.match(/^\/pagos\/(\d+)$/))) que += ` · pago #${m[1]}`;
  if (b?.condonar_mora) que += " · sin cobrar la mora";
  if (monto) que += ` · ${dinero(monto)}`;
  return que.substring(0, 300);
};

// Una operación que un superior ya autorizó vuelve con la cabecera X-Autorizacion: se acepta
// una sola vez, solo para quien la pidió y para la misma operación.
const usarAutorizacion = async (req) => {
  const id = parseInt(req.header("X-Autorizacion"));
  if (!id) return false;
  const [r] = await pool.query(
    `UPDATE autorizaciones SET estado = 'ejecutando'
     WHERE id_autorizacion = ? AND estado = 'aprobada' AND solicitado_por = ? AND metodo = ? AND ruta = ?`,
    [id, req.usuario.id_usuario, req.method, req.path]
  );
  return r.affectedRows === 1;
};

const pedirAutorizacion = async (req, res, accion, motivo, monto) => {
  const [r] = await pool.query(
    `INSERT INTO autorizaciones (accion, motivo, descripcion, metodo, ruta, cuerpo, monto, solicitado_por, justificacion)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      accion, motivo.substring(0, 300), await describir(accion, monto, req.path, req.body), req.method, req.path,
      JSON.stringify(req.body || {}), monto || null, req.usuario.id_usuario,
      String(req.body?.justificacion_autorizacion || "").trim().substring(0, 300) || null,
    ]
  );
  return res.status(202).json({
    success: true,
    pendiente_autorizacion: true,
    id_autorizacion: r.insertId,
    message: `${motivo} Se envió a autorización de un superior (solicitud #${r.insertId}); se aplicará cuando la autorice.`,
  });
};

const prohibido = (res, message) => res.status(403).json({ message });

// ¿Quién registró la operación que se quiere aprobar, desembolsar, anular o corregir?
const registradoPor = async (accion, metodo, ruta) => {
  let m;
  if ((m = ruta.match(/^\/prestamos\/(\d+)\/(aprobar|desembolsar)$/)) || (m = ruta.match(/^\/solicitudes\/prestamos\/(\d+)\/aprobar$/))) {
    const [[p]] = await pool.query("SELECT creado_por FROM prestamos WHERE id_prestamo = ?", [m[1]]);
    return { quien: p?.creado_por, que: "este crédito", verbo: ruta.endsWith("desembolsar") ? "desembolsarlo" : "aprobarlo" };
  }
  const porCaja = async (tipoRef, id, que) => {
    const [[c]] = await pool.query(
      "SELECT id_registrado_por FROM caja_movimientos WHERE referencia_tipo = ? AND referencia_id = ? ORDER BY id_movimiento LIMIT 1",
      [tipoRef, id]
    );
    return { quien: c?.id_registrado_por, que, verbo: metodo === "DELETE" ? "anularlo" : "corregirlo" };
  };
  if ((m = ruta.match(/^\/pagos\/(\d+)$/)) && ["PUT", "DELETE"].includes(metodo)) return porCaja("pago", m[1], "este pago");
  if ((m = ruta.match(/^\/movimientos\/(\d+)$/)) && ["PUT", "DELETE"].includes(metodo)) return porCaja("movimiento_cuenta", m[1], "este movimiento");
  if ((m = ruta.match(/^\/aportaciones\/(\d+)$/)) && ["PUT", "DELETE"].includes(metodo)) return porCaja("aportacion", m[1], "esta aportación");
  return null;
};

const controlAcciones = async (req, res, next) => {
  try {
    const u = req.usuario;
    if (!u || u.rol === "Super Administrador" || u.rol === "Socio" || req.method === "GET" || req.method === "OPTIONS") return next();
    const estado = await funciones.leer();
    if (!estado.permisos_por_accion && !estado.segregacion_funciones) return next();
    const ruta = req.path;

    // Operación ya autorizada por un superior: pasa sin volver a pedirla
    if (req.header("X-Autorizacion")) {
      if (!(await usarAutorizacion(req))) return prohibido(res, "La autorización no es válida o ya se usó.");
      req.usuario = { ...u, autorizado: true };
      return next();
    }

    if (estado.permisos_por_accion) {
      const rol = await datosDelRol(u.rol_id);
      // Solo lectura (auditor, junta de vigilancia): nada que cambie datos, salvo su propia sesión
      if (rol.solo_lectura && !PERMITIDO_SOLO_LECTURA.some((re) => re.test(ruta))) {
        return prohibido(res, "Tu rol es de solo lectura: puedes consultar, pero no hacer cambios.");
      }
      const accion = accionDe(req.method, ruta, req.body);
      // Sin configurar = permitido (encender la función no le quita nada a nadie)
      if (accion && rol.acciones[accion] === false) {
        return prohibido(res, `Tu rol no tiene permiso para: ${nombreDe(accion).toLowerCase()}.`);
      }
      // Omitir la mora: directo si el rol la tiene expresamente; si no, con autorización
      if (ruta === "/pagos" && req.method === "POST" && req.body?.condonar_mora) {
        if (rol.acciones["pagos.condonar"] === true) req.usuario = { ...u, condonar_directo: true };
        else if (rol.acciones["pagos.condonar"] === false) return prohibido(res, "Tu rol no puede omitir la mora.");
        else return pedirAutorizacion(req, res, "pagos.condonar", "Omitir la mora necesita autorización.", num(req.body.monto_pagado));
      }
      // Acción marcada "con autorización" o por encima del límite de monto del rol
      if (accion && rol.acciones[accion] === "autorizar") {
        return pedirAutorizacion(req, res, accion, `Tu rol necesita autorización para: ${nombreDe(accion).toLowerCase()}.`, await montoDe(accion, req.method, ruta, req.body));
      }
      const limite = accion ? rol.limites?.[accion] : undefined;
      if (limite !== undefined && limite !== null) {
        const monto = await montoDe(accion, req.method, ruta, req.body);
        if (monto !== null && monto > limite + 0.001) {
          return pedirAutorizacion(req, res, accion, `${dinero(monto)} supera tu límite de ${dinero(limite)} para ${nombreDe(accion).toLowerCase()}.`, monto);
        }
      }
    }

    if (estado.segregacion_funciones) {
      const r = await registradoPor(accionDe(req.method, ruta, req.body), req.method, ruta);
      if (r && r.quien && r.quien === u.id_usuario) {
        return prohibido(res, `Registraste ${r.que}: otra persona debe ${r.verbo} (segregación de funciones).`);
      }
    }
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = { controlAcciones };
