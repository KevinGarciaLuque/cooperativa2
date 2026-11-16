// Arranque del servidor: migraciones, procesos programados y escucha de peticiones.
const app = require("./app");
const logger = require("./utils/logger");
const { aplicarMigraciones } = require("./utils/migraciones");
const configFinanciera = require("./utils/configFinanciera");
const pais = require("./utils/pais");
const { iniciarScheduler } = require("./utils/backupScheduler");
const { iniciarMoraScheduler } = require("./utils/moraScheduler");
const { iniciarRecordatoriosScheduler } = require("./utils/recordatorios");
const { iniciarAhorroScheduler } = require("./utils/ahorro");

const PORT = process.env.PORT || 5000;

// Errores fuera de una petición: se registran para poder diagnosticarlos
process.on("unhandledRejection", (motivo) => logger.error("promesa_rechazada", motivo));
process.on("uncaughtException", (error) => {
  logger.error("excepcion_no_capturada", error);
  process.exit(1);
});

aplicarMigraciones()
  .catch((error) => {
    // Un fallo de migración no debe impedir que el sistema siga funcionando
    logger.error("migraciones_fallidas", error);
  })
  // El país se lee antes de programar tareas: define la zona horaria de los procesos diarios
  .then(() => pais.iniciar())
  .finally(() => {
    // Copia a la base de datos las fotos y logos que existan en disco
    require("./utils/archivos")
      .importarArchivosExistentes()
      .then((n) => n && logger.info("archivos_importados", { cantidad: n }))
      .catch((e) => logger.error("archivos_importacion_fallida", e));

    configFinanciera.iniciar();
    iniciarScheduler().catch((e) => logger.error("respaldos_no_programados", e)); // respaldos automáticos
    iniciarMoraScheduler(); // verificación diaria de mora
    iniciarRecordatoriosScheduler(); // recordatorios de pago a los socios (8:00)
    iniciarAhorroScheduler(); // saldos de cada noche e intereses de ahorro el día 1

    app.listen(PORT, () => {
      logger.info("servidor_iniciado", { puerto: PORT });
      console.log(`Servidor backend de Cooperativa escuchando en el puerto ${PORT}`);
    });
  });
