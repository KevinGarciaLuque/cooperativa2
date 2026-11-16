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
| `APP_TIMEZONE` | No | Fija la zona horaria. Sin ella se usa la del país elegido en Configuración (Honduras: `America/Tegucigalpa`) |
| `RESPALDO_S3_BUCKET`, `RESPALDO_S3_ACCESS_KEY`, `RESPALDO_S3_SECRET_KEY` | Recomendadas | Copia de cada respaldo fuera del servidor. Ver "Respaldos" |
| `RESPALDO_S3_ENDPOINT`, `RESPALDO_S3_REGION`, `RESPALDO_S3_PREFIJO` | No | Servicio, región (`auto` en R2) y carpeta (`respaldos/`) de esa copia |
| `BACKUPS_DIR` | No | Carpeta de los respaldos en el servidor. Por defecto `backend/backups` |
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

## Fotos, logo y comprobantes firmados

Las imágenes (fotos de perfil, logo) y las copias firmadas de los comprobantes de desembolso se guardan
**dentro de la base de datos** (tablas `archivos` y `comprobantes_firmados`), no en el disco del servidor.
Así sobreviven a los despliegues de Railway, que borran el disco, y viajan con los respaldos.

- Las URL siguen siendo `/uploads/...`; el servidor las sirve desde la base de datos.
- Al arrancar, el sistema copia a la base de datos cualquier imagen que exista en `backend/uploads/`
  (por ejemplo, las que estén en el repositorio).
- Las fotos que se suben desde el navegador se reducen antes de enviarse para no inflar la base.

## Respaldos

- **Automáticos:** vienen activados (todos los días a las 2:00 a. m., hora de la cooperativa). Se cambian en la
  pantalla Base de Datos (Super Administrador); la configuración se guarda en la base de datos, así que ya no
  se pierde con cada despliegue.
- **Manuales:** "Ejecutar backup ahora" o "Descargar Backup Ahora" en la misma pantalla.
- **Copia fuera del servidor (muy recomendada):** el disco de Railway es temporal y un redespliegue puede borrar
  `backend/backups/`. Con un almacenamiento compatible con S3, cada respaldo se sube además comprimido
  (`.sql.gz`). La pantalla Base de Datos muestra si la copia externa está activa y avisa si falla.

  Con **Cloudflare R2** (incluye 10 GB gratis):
  1. En Cloudflare → R2, crea un bucket (por ejemplo `cooperativa-respaldos`).
  2. En R2 → *Manage API tokens*, crea un token con permiso **Object Read & Write** solo para ese bucket.
     Anota el *Access Key ID*, el *Secret Access Key* y el *endpoint* (`https://<cuenta>.r2.cloudflarestorage.com`).
  3. En Railway, en las variables del backend: `RESPALDO_S3_BUCKET`, `RESPALDO_S3_ACCESS_KEY`,
     `RESPALDO_S3_SECRET_KEY`, `RESPALDO_S3_ENDPOINT` y `RESPALDO_S3_REGION=auto`.
  4. En la pantalla Base de Datos, pulsa "Ejecutar backup ahora": debe decir "Copia externa: respaldos/...".
  5. (Opcional) En el bucket, una regla de ciclo de vida que borre los archivos de más de 90 días.

  Con **Amazon S3** es igual, sin `RESPALDO_S3_ENDPOINT` y con la región del bucket (`RESPALDO_S3_REGION=us-east-1`).
- **Carpeta persistente (opcional):** crea un *Volume* en Railway (Settings → Volumes), móntalo en
  `/data` y define `BACKUPS_DIR=/data/backups`. Así los respaldos guardados en el servidor no se borran al desplegar.
- Para restaurar una copia externa, descárgala y descomprímela primero: `gunzip DBcooperativa_....sql.gz`.
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

## País de la cooperativa

Cada cooperativa tiene su propia instalación (su servicio en Railway y su propia base de datos). El país se
elige en **Configuración → País de la cooperativa** (Super Administrador) y define:

- la moneda y el formato de los montos (L. 1,234.50 en Honduras, Q en Guatemala, $ en El Salvador,
  C$ en Nicaragua, ₡ 1 234,50 en Costa Rica, B/. en Panamá, BZ$ en Belice);
- el documento de identidad que se pide y se valida (DNI, DPI, DUI, cédula...);
- el código telefónico de los números locales (para WhatsApp) y cuántos dígitos tienen;
- la zona horaria de los procesos diarios (respaldos, mora, recordatorios), salvo que `APP_TIMEZONE` la fije.

Sin elegir, es Honduras. **Cambiar el país no convierte los montos ya registrados**: se elige al instalar.
Después de cambiarlo, reinicia el servicio para que los procesos programados tomen la zona horaria nueva.
El catálogo de países está en `backend/utils/pais.js`.

### Instalar para otra cooperativa

1. En Railway, crea un proyecto nuevo con una base MySQL y los servicios del backend y del frontend
   (mismo repositorio, mismas raíces que la instalación actual).
2. Variables del backend: las de la tabla de arriba (con un `JWT_SECRET` nuevo) y las de `RESPALDO_S3_*`
   apuntando a un bucket o carpeta propia de esa cooperativa (`RESPALDO_S3_PREFIJO=nombre-coop/`).
3. Al primer arranque se crean las tablas. Crea el primer usuario (Super Administrador) directamente en la base.
4. Entra, elige el país en Configuración y sube el logo y el nombre de la cooperativa.

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
