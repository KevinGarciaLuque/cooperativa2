// Arranque del servidor: migraciones, procesos programados y escucha de peticiones.
const app = require("./app");
const logger = require("./utils/logger");
const { aplicarMigraciones } = require("./utils/migraciones");
const configFinanciera = require("./utils/configFinanciera");
const { iniciarScheduler } = require("./utils/backupScheduler");
const { iniciarMoraScheduler } = require("./utils/moraScheduler");

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
  .finally(() => {
    configFinanciera.iniciar();
    iniciarScheduler(); // respaldos automáticos
    iniciarMoraScheduler(); // verificación diaria de mora

    app.listen(PORT, () => {
      logger.info("servidor_iniciado", { puerto: PORT });
      console.log(`Servidor backend de Cooperativa escuchando en el puerto ${PORT}`);
    });
  });
