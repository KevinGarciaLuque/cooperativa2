// Avisos de la campanita.
// - Socio: recordatorios de su próxima cuota, cuotas atrasadas y depósitos a plazo que vencen.
//   Se guardan como notificaciones (una sola vez por cuota) para que también queden en su historial.
// - Personal: lista de pendientes calculada al momento según los módulos de su rol
//   (solicitudes, pagos reportados, comité, cobranza, plazos fijos, cumplimiento, caja).
const pool = require("../db");
const { obtenerCartera } = require("./cartera");
const { hoyISO, diasEntre, soloFecha } = require("./calculosPrestamo");
const { dinero } = require("./pais");
const { filtroSocio } = require("./sucursal");
const comite = require("./comite");
const { contarSolicitudes } = require("./pendientesSolicitudes");

const DIAS_AVISO_CUOTA = 3; // días antes del vencimiento en que se recuerda la cuota
const DIAS_AVISO_PLAZO = 7;

// "2026-12-15" → "15/12/2026" (sin pasar por Date para no correr el día por la zona horaria)
const fechaCorta = (iso) => {
  const f = soloFecha(iso);
  if (!f) return "";
  const [a, m, d] = f.split("-");
  return `${d}/${m}/${a}`;
};

const cuandoVence = (dias) => (dias === 0 ? "hoy" : dias === 1 ? "mañana" : `en ${dias} días`);

// ── Socio ────────────────────────────────────────────────────────────────
const revisadoSocio = new Map(); // id_usuario -> momento de la última revisión
const ESPERA_SOCIO = 10 * 60 * 1000;

// Inserta la notificación solo si no existe ya una con el mismo título para el socio
const avisarUnaVez = async (idUsuario, tipo, titulo, mensaje) => {
  const [[ya]] = await pool.query(
    "SELECT id_notificacion FROM notificaciones WHERE id_usuario = ? AND titulo = ? LIMIT 1",
    [idUsuario, titulo]
  );
  if (ya) return false;
  await pool.query("INSERT INTO notificaciones (id_usuario, tipo, titulo, mensaje) VALUES (?, ?, ?, ?)", [
    idUsuario,
    tipo,
    titulo.substring(0, 150),
    mensaje ? mensaje.substring(0, 600) : null,
  ]);
  require("./push").enviarPush(idUsuario, { titulo, cuerpo: mensaje, etiqueta: tipo }).catch(() => {});
  return true;
};

const recordatoriosSocio = async (idUsuario, { forzar = false } = {}) => {
  const ultima = revisadoSocio.get(idUsuario);
  if (!forzar && ultima && Date.now() - ultima < ESPERA_SOCIO) return;
  revisadoSocio.set(idUsuario, Date.now());
  try {
    const cartera = await obtenerCartera({ sql: " AND p.id_usuario = ?", params: [idUsuario] });
    for (const c of cartera) {
      const venc = fechaCorta(c.vencimiento);
      const atrasado = c.dias_atraso > 0 || c.dias_mora > 0;
      if (atrasado) {
        await avisarUnaVez(
          idUsuario,
          "mora",
          `Préstamo #${c.id_prestamo}: tienes una cuota atrasada (vencía el ${venc})`,
          `Págala cuanto antes: cada día de atraso genera cargos por mora. Cuota: ${dinero(c.cuota)}.`
        );
      } else if (c.dias_para_vencer >= 0 && c.dias_para_vencer <= DIAS_AVISO_CUOTA) {
        await avisarUnaVez(
          idUsuario,
          "recordatorio",
          `Préstamo #${c.id_prestamo}: tu cuota vence el ${venc}`,
          `Recuerda pagar tu cuota de ${dinero(c.cuota)} ${cuandoVence(c.dias_para_vencer)} para evitar cargos por mora.`
        );
      }
    }

    const [plazos] = await pool.query(
      `SELECT id_deposito, monto, fecha_vencimiento FROM depositos_plazo
       WHERE id_usuario = ? AND estado = 'vigente' AND fecha_vencimiento <= DATE_ADD(CURDATE(), INTERVAL ? DAY)`,
      [idUsuario, DIAS_AVISO_PLAZO]
    );
    for (const d of plazos) {
      await avisarUnaVez(
        idUsuario,
        "aviso",
        `Tu depósito a plazo #${d.id_deposito} vence el ${fechaCorta(d.fecha_vencimiento)}`,
        `Depósito de ${dinero(d.monto)}. Acércate a la cooperativa para retirarlo o renovarlo.`
      );
    }
  } catch (error) {
    console.error("No se pudieron generar los recordatorios del socio:", error.message);
  }
};

// ── Personal ─────────────────────────────────────────────────────────────
const permisosModulos = async (rolId) => {
  const [rows] = await pool.query("SELECT modulo, activo FROM permisos_modulos WHERE rol_id = ?", [rolId]);
  const mapa = {};
  rows.forEach((r) => (mapa[r.modulo] = r.activo === 1));
  return mapa;
};

// Cartera por sucursal en caché corto: varios usuarios revisan la campanita cada minuto
const cacheCartera = new Map();
const carteraCacheada = async (filtro) => {
  const clave = JSON.stringify(filtro);
  const c = cacheCartera.get(clave);
  if (c && Date.now() - c.t < 2 * 60 * 1000) return c.filas;
  const filas = await obtenerCartera(filtro);
  cacheCartera.set(clave, { t: Date.now(), filas });
  return filas;
};

const pendientesPersonal = async (req) => {
  const u = req.usuario;
  const esSuper = u.rol === "Super Administrador";
  const permisos = esSuper ? {} : await permisosModulos(u.rol_id);
  const tiene = (m) => esSuper || permisos[m] !== false;
  // Cumplimiento es reservado: solo si se le activó expresamente (o Administrador sin quitárselo)
  const veCumplimiento =
    esSuper || permisos.cumplimiento === true || (u.rol === "Administrador" && permisos.cumplimiento !== false);
  const filtro = await filtroSocio(req, "u");
  const items = [];
  const agregar = (cantidad, item) => {
    if (cantidad > 0) items.push({ cantidad, ...item });
  };

  if (tiene("prestamos")) {
    const cs = await contarSolicitudes(req);
    agregar(cs.socios_pendientes, {
      clave: "socios_pendientes",
      titulo: "Nuevos socios por aprobar",
      detalle: "Se registraron con el enlace y esperan tu revisión.",
      ruta: "/solicitudes",
      nivel: "media",
    });

    agregar(cs.prestamos_pendientes, {
      clave: "solicitudes_prestamo",
      titulo: "Solicitudes de préstamo",
      detalle: "Socios que pidieron un préstamo desde su cuenta.",
      ruta: "/solicitudes",
      nivel: "media",
    });

    agregar(cs.pagos_reportados, {
      clave: "pagos_reportados",
      titulo: "Pagos reportados por socios",
      detalle: "Transferencias o depósitos que hay que confirmar o rechazar.",
      ruta: "/solicitudes",
      nivel: "alta",
    });

    agregar(cs.comprobantes_por_revisar, {
      clave: "comprobantes_firmados",
      titulo: "Comprobantes firmados por revisar",
      detalle: "Socios que subieron su comprobante de entrega firmado.",
      ruta: "/solicitudes",
      nivel: "info",
    });

    const [[ap]] = await pool.query(
      `SELECT COUNT(*) AS n FROM prestamos p INNER JOIN usuarios u ON u.id_usuario = p.id_usuario
       WHERE p.estado = 'aprobado'${filtro.sql}`,
      filtro.params
    );
    agregar(ap.n, {
      clave: "por_desembolsar",
      titulo: "Préstamos aprobados por desembolsar",
      detalle: "Ya están aprobados; falta entregar el dinero al socio.",
      ruta: "/prestamos",
      nivel: "media",
    });

    // Comité: préstamos que esperan el voto de este usuario
    if (comite.limite() > 0 && (await comite.esMiembro(pool, u.id_usuario))) {
      const [[cv]] = await pool.query(
        `SELECT COUNT(*) AS n FROM prestamos p
         WHERE p.estado = 'pendiente' AND p.monto > ?
           AND NOT EXISTS (SELECT 1 FROM prestamo_votos v WHERE v.id_prestamo = p.id_prestamo AND v.id_usuario = ?)`,
        [comite.limite(), u.id_usuario]
      );
      agregar(cv.n, {
        clave: "comite_voto",
        titulo: "Préstamos esperando tu voto",
        detalle: "Como miembro del comité de crédito.",
        ruta: "/comite-credito",
        nivel: "alta",
      });
    }
  }

  if (tiene("cobranza")) {
    const cartera = await carteraCacheada(filtro);
    const enMora = cartera.filter((c) => c.dias_atraso > 0 || c.dias_mora > 0);
    const alDia = cartera.filter((c) => !(c.dias_atraso > 0 || c.dias_mora > 0));
    const hoy = alDia.filter((c) => c.dias_para_vencer === 0);
    const pronto = alDia.filter((c) => c.dias_para_vencer > 0 && c.dias_para_vencer <= DIAS_AVISO_CUOTA);
    const promesas = cartera.filter((c) => c.promesa_vencida);
    const suma = (l) => l.reduce((t, c) => t + c.cuota, 0);
    agregar(hoy.length, {
      clave: "cuotas_hoy",
      titulo: "Cuotas que vencen hoy",
      detalle: `Por cobrar: ${dinero(suma(hoy))}.`,
      ruta: "/cobranza",
      nivel: "media",
    });
    agregar(pronto.length, {
      clave: "cuotas_pronto",
      titulo: `Cuotas que vencen en ${DIAS_AVISO_CUOTA} días`,
      detalle: `Buen momento para recordarles. Por cobrar: ${dinero(suma(pronto))}.`,
      ruta: "/cobranza",
      nivel: "info",
    });
    agregar(enMora.length, {
      clave: "prestamos_mora",
      titulo: "Préstamos con cuotas atrasadas",
      detalle: `Saldo en riesgo: ${dinero(enMora.reduce((t, c) => t + c.saldo, 0))}.`,
      ruta: "/cobranza",
      nivel: "alta",
    });
    agregar(promesas.length, {
      clave: "promesas_vencidas",
      titulo: "Promesas de pago incumplidas",
      detalle: "La fecha que prometió el socio ya pasó y sigue atrasado.",
      ruta: "/cobranza",
      nivel: "alta",
    });
  }

  if (tiene("cuentas")) {
    const [[dp]] = await pool.query(
      `SELECT COUNT(*) AS n FROM depositos_plazo d INNER JOIN usuarios u ON u.id_usuario = d.id_usuario
       WHERE d.estado = 'vigente' AND d.fecha_vencimiento <= DATE_ADD(CURDATE(), INTERVAL ? DAY)${filtro.sql}`,
      [DIAS_AVISO_PLAZO, ...filtro.params]
    );
    agregar(dp.n, {
      clave: "plazos_vencen",
      titulo: "Depósitos a plazo por vencer",
      detalle: `Vencen en los próximos ${DIAS_AVISO_PLAZO} días o ya vencieron.`,
      ruta: "/ahorro",
      nivel: "info",
    });
  }

  if (veCumplimiento) {
    const [[al]] = await pool.query("SELECT COUNT(*) AS n FROM alertas_cumplimiento WHERE estado = 'pendiente'");
    agregar(al.n, {
      clave: "alertas_cumplimiento",
      titulo: "Alertas de cumplimiento",
      detalle: "Operaciones que debe revisar el oficial de cumplimiento.",
      ruta: "/cumplimiento",
      nivel: "alta",
    });
  }

  if (tiene("pagos") && (await require("./funciones").habilitada("descuento_planilla", u))) {
    try {
      const [[pl]] = await pool.query("SELECT COUNT(*) AS n FROM planilla_lotes WHERE estado = 'generada'");
      agregar(pl.n, {
        clave: "planillas_por_aplicar",
        titulo: "Planillas por aplicar",
        detalle: "Planillas de empresas con convenio que todavía no se han cobrado.",
        ruta: "/planillas",
        nivel: "media",
      });
    } catch {
      // la tabla aún no existe
    }
  }

  if (tiene("caja")) {
    // Turno propio que quedó abierto desde un día anterior
    const [[t]] = await pool.query(
      "SELECT COUNT(*) AS n FROM cajas_turnos WHERE id_cajero = ? AND cerrado_en IS NULL AND DATE(abierto_en) < CURDATE()",
      [u.id_usuario]
    );
    agregar(t.n, {
      clave: "turno_abierto",
      titulo: "Tienes un turno de caja sin cerrar",
      detalle: "Quedó abierto desde un día anterior. Haz el arqueo y ciérralo.",
      ruta: "/caja",
      nivel: "alta",
    });
  }

  const orden = { alta: 0, media: 1, info: 2 };
  items.sort((a, b) => orden[a.nivel] - orden[b.nivel]);
  return { items, total: items.reduce((t, i) => t + i.cantidad, 0), hoy: hoyISO() };
};

module.exports = { recordatoriosSocio, pendientesPersonal, fechaCorta, diasEntre };
