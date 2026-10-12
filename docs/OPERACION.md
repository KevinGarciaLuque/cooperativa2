# Operación del sistema

Guía para quien administra el servidor: variables, despliegue, respaldos y recuperación.

## Variables de entorno (backend)

| Variable | Obligatoria | Descripción |
|---|---|---|
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | Sí | Conexión a MySQL |
| `JWT_SECRET` | Sí | Clave de firma de sesiones. Sin ella el servidor no arranca. Usa una cadena larga y aleatoria |
| `FRONTEND_URL` | Sí | URL del sitio (CORS y enlaces de los correos) |
| `CORS_ORIGINS` | No | Orígenes extra permitidos, separados por coma |
| `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASS` | No | Correo de recuperación y avisos al administrador |
| `APP_TIMEZONE` | No | Zona de la cooperativa. Por defecto `America/Tegucigalpa` |
| `DB_TIMEZONE` | No | Fija la zona de cada sesión MySQL (ej. `-06:00`). Ver "Zona horaria" |
| `LOG_LEVEL` | No | `debug`, `info`, `warn` o `error` |

Frontend: `VITE_API_URL` (URL de la API terminada en `/api`). Se define en Railway al compilar.

**Los secretos viven en las variables de Railway, no en el repositorio.**

## Despliegue

1. Cada `push` a `master` ejecuta la integración continua (pruebas del backend y compilación del frontend).
2. Railway despliega al recibir el cambio. Al arrancar, el servidor aplica solo las **migraciones** pendientes
   (`utils/migraciones.js`); quedan registradas en la tabla `schema_migraciones`.
3. Verifica el estado en `GET /api/salud`: debe responder `{"estado":"ok", "bd":"ok", ...}`.
   Úsalo también como chequeo de salud en Railway o en un monitor externo (UptimeRobot, etc.).

### Cambios de base de datos

- Agrega una migración nueva **al final** de la lista en `backend/utils/migraciones.js` con un `id` único.
  Deben ser idempotentes y aditivas (crear tablas o columnas; no borrar datos).
- Si cambia el esquema base, regenera `backend/sql/esquema_base.sql` con `npm run db:exportar`.

## Respaldos

- **Automáticos y manuales:** pantalla Base de Datos (Super Administrador). Se guardan en `backend/backups/`.
- **Importante:** el disco de Railway es temporal. Un redespliegue puede borrar `backend/backups/`.
  Descarga respaldos periódicamente desde la pantalla Base de Datos y guárdalos fuera del servidor
  (Google Drive, correo, disco externo).
- **Prueba de restauración (hazla cada mes):**

  ```bash
  cd backend
  npm run backup:verificar                  # usa el respaldo guardado más reciente
  npm run backup:verificar -- ruta/al/archivo.sql
  ```

  Restaura el respaldo en una base temporal, compara los registros de cada tabla con la base real y
  la elimina. También está disponible en la API: `POST /api/basedatos/verificar-backup/:archivo`.

### Recuperación ante un desastre

1. Crea una base vacía en MySQL.
2. Carga el último respaldo: `mysql -u USUARIO -p BASE < respaldo.sql`.
3. Apunta las variables `DB_*` del backend a esa base y reinicia el servicio.
4. Entra como Super Administrador, revisa Caja y el último cierre mensual para confirmar los saldos.

## Zona horaria

El servidor trabaja en UTC; la cooperativa en Honduras (UTC-6). La aplicación calcula "hoy" y los
meses con `APP_TIMEZONE`, así que los cierres, la mora y las fechas por defecto usan el día de Honduras.

Las fechas **guardadas** por MySQL (`NOW()`) dependen de la zona del servidor de base de datos. Si
la base está en UTC, un registro hecho a las 8 p. m. queda con la fecha del día siguiente. Para
corregirlo en una instalación nueva, define `DB_TIMEZONE=-06:00`. **No lo actives en una base con
datos sin revisar antes**, porque mezclaría horas guardadas con criterios distintos.

## Registros y monitoreo

- El backend escribe **una línea JSON por evento** (petición, error, arranque). En Railway → Logs puedes
  buscar por `"nivel":"error"` o por el `id` de petición, que también llega al cliente en el
  encabezado `X-Request-Id`.
- Las respuestas 500 incluyen un `id` para localizar el error en los logs sin exponer detalles internos.
- Para alertas por correo o móvil, conecta `GET /api/salud` a un monitor externo.

## Ambientes

Se recomienda un ambiente de ensayo separado del de producción:

1. Crea otro servicio en Railway apuntando a una **base distinta**.
2. Crea la base con `npm run db:crear nombre_ensayo` (esquema + migraciones, sin datos).
3. Prueba allí los cambios antes de pasarlos a producción. Nunca uses los datos reales para ensayar.

## Seguridad: lista de verificación

- [ ] `JWT_SECRET` largo y único; contraseñas de base y correo rotadas si estuvieron en el repositorio.
- [ ] `backend/.env` fuera del repositorio (solo `.env.example`).
- [ ] Respaldo descargado fuera del servidor esta semana.
- [ ] Prueba de restauración hecha este mes.
- [ ] Usuarios que ya no trabajan en la cooperativa, desactivados.
