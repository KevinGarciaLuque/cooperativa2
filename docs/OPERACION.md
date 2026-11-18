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
| `AMBIENTE` | No | `pruebas` en el ambiente de pruebas: no envía correos a los socios y muestra el aviso. Ver "Ambiente de pruebas" |
| `CORREO_PRUEBAS` | No | Solo en pruebas: todos los correos se desvían a esta dirección (sin ella, no se envían) |
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

### Ambiente de pruebas

Un segundo ambiente en Railway, con su propia base, para probar cada cambio con datos parecidos a los reales
antes de que llegue a los socios.

1. En el proyecto de Railway, crea un ambiente nuevo (por ejemplo `pruebas`) duplicando el de producción.
   Revisa que la base de datos de ese ambiente sea **otra** (nunca la de producción).
2. En el backend de ese ambiente: `AMBIENTE=pruebas`, otro `JWT_SECRET`, `FRONTEND_URL` del frontend de
   pruebas y, si quieres ver los correos, `CORREO_PRUEBAS=tu-correo@...`. En el frontend: `VITE_API_URL`
   apuntando al backend de pruebas.
3. Conecta los servicios de ese ambiente a la rama `pruebas` del repositorio (producción sigue en `master`).
4. Para tener datos parecidos a los reales: descarga un respaldo de producción (pantalla Base de Datos) y
   cárgalo en la pantalla Base de Datos del ambiente de pruebas ("Importar SQL").

Con `AMBIENTE=pruebas`:

- **ningún correo llega a los socios** (recordatorios, recibos, avisos): se desvían a `CORREO_PRUEBAS` con el
  destinatario original en el asunto, o no se envían;
- los respaldos externos van a la carpeta `pruebas/respaldos/` del bucket;
- todas las pantallas muestran "AMBIENTE DE PRUEBAS" y la pestaña del navegador empieza con `[PRUEBAS]`;
- `GET /api/salud` responde `"ambiente": "pruebas"`.

Los enlaces de WhatsApp los abre una persona, así que en pruebas no los envíes a socios reales.

Flujo de trabajo: los cambios se suben primero a `pruebas`, se revisan ahí y luego se pasan a `master`.

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

## Contabilidad de partida doble

Pantalla **Libros contables** (permiso de Contabilidad; la apertura y el catálogo, solo el Super Administrador).

1. **Apertura (una sola vez):** el sistema propone los saldos de hoy (caja según el último cierre de caja,
   bancos, cartera vigente, cuentas de los socios) y la diferencia queda en resultados acumulados. Revísalos con
   el contador (caja contra el efectivo contado, bancos contra el estado de cuenta) y abre la contabilidad,
   idealmente el primer día del mes.
2. Desde ahí **cada operación registra su partida sola**, en la misma transacción: pagos (capital, interés, mora),
   desembolsos, aportaciones (capital social), depósitos y retiros de ahorro (Vivienda y Pensiones son pasivo),
   gastos e ingresos de caja, transferencias, consolidaciones, actividades y repartos. El efectivo va a Caja; las
   transferencias, cheques y depósitos bancarios, a Bancos.
3. Las ediciones y anulaciones registran una partida por la diferencia: **nunca se borran partidas**.
4. **Partidas manuales** del contador (depósitos de caja al banco, estimación de incobrables, reclasificaciones):
   deben cuadrar, no pueden caer en un mes con cierre mensual y se anulan con su partida inversa.
5. Si una partida no se puede registrar (por ejemplo, una cuenta del sistema mal configurada), la operación igual
   se guarda y el caso aparece en Inicio para que el contador la registre a mano.

Reportes con Excel: libro diario, libro mayor, balanza de comprobación, balance general y estado de resultados.
El catálogo base está en `backend/utils/contabilidad.js`; el contador puede agregar cuentas y renombrarlas.

## Ahorro, plazo fijo y excedentes

- **Productos de ahorro** (pantalla Ahorro): Aportaciones, Vivienda y Pensiones vienen con tasa 0%. Cada producto
  define su tasa anual, saldo mínimo, si permite retiros y si se abre solo a cada socio nuevo. Se pueden crear otros.
- **Intereses**: cada noche se guarda el saldo de cada cuenta; el día 1 de cada mes se acredita el interés del mes
  anterior sobre el saldo promedio diario (saldo promedio × tasa × días ÷ 365), una sola vez por cuenta y mes, con
  su movimiento y su partida. La retención de impuesto, si aplica, se configura en Parámetros.
- **Plazo fijo**: productos de clase plazo fijo con tasa, montos, plazos y penalización por retiro anticipado (% del
  interés). El interés se paga con el capital al vencer, en efectivo, por banco o a una cuenta del socio.
- **Excedentes** (Libros contables → Excedentes): al cerrar un año se separan las reservas y el resto se reparte entre
  los socios por aportaciones y por intereses pagados; se acredita en su cuenta de aportaciones, con la partida de
  cierre del ejercicio. Solo años terminados y una vez por año.

## Verificación en dos pasos

- En **Parámetros → Verificación en dos pasos** (desactivada por defecto). Activada, el personal recibe al
  iniciar sesión un código de 6 dígitos en su correo: vence en 10 minutos, admite 5 intentos y se puede
  pedir otro una vez por minuto. Los socios entran como siempre.
- Necesita el envío de correos configurado (EMAIL_HOST, EMAIL_USER, EMAIL_PASS). Sin eso, o para un
  usuario sin correo registrado, se entra solo con la contraseña (Parámetros lo advierte).
- Si el correo falla al enviar, no se abre la sesión: revisa el servidor de correo antes de activarla.
- En el ambiente de pruebas solo se pide si existe CORREO_PRUEBAS (los códigos llegan a esa dirección).

## Varias sucursales

- Las sucursales se crean en **Caja → Mi turno → Sucursales** (Super Administrador). Con una sola, el
  sistema se ve y funciona como siempre: todo lo existente quedó en la sucursal principal.
- **Cada socio pertenece a una sucursal** (se elige al registrarse o en Usuarios). Su cartera
  (préstamos, cuentas, aportaciones, solicitudes, cobranza) aparece en las listas de esa sucursal,
  pero **puede pagar y depositar en cualquiera**: buscándolo por nombre, DNI o número se le atiende.
- **El personal** elige arriba qué sucursal ver ("Todas las sucursales" o una). Listas, dashboard,
  cobranza, caja y reportes en Excel muestran solo esa sucursal.
- **"Solo ve su sucursal"** (Usuarios, lo marca el Administrador): ese usuario ve siempre su sucursal en
  las listas, aunque puede buscar y atender a socios de otras.
- **Caja:** cada movimiento queda en la sucursal donde se hizo (la del turno del cajero, o la sucursal del
  usuario). El cierre diario es de toda la cooperativa (con "Todas"); cada cajero cierra su turno.
- La contabilidad es una sola para toda la cooperativa.

## Sucursales y turnos de caja

- Se crea una sucursal "Oficina principal"; el Super Administrador agrega más en **Caja → Mi turno → Sucursales**.
- Cada cajero abre **su turno** con el fondo inicial que recibe. Todo lo que registra mientras está abierto
  queda en su turno y su sucursal. Al cerrar cuenta el efectivo: si no cuadra con lo esperado
  (fondo + entradas − salidas en efectivo), debe explicar la diferencia.
- "Turnos del día" muestra los de todos los cajeros. El cierre diario general de la caja sigue igual.
- En **Parámetros → Turnos de caja** se puede exigir el turno abierto para recibir o entregar efectivo
  (desactivado por defecto). Transferencias, cheques y depósitos no lo necesitan.

## Comité de crédito (aprobación por niveles de monto)

- En **Parámetros → Aprobación de préstamos** se indica el monto máximo que aprueba el personal y cuántos
  votos a favor necesita el comité. Con 0 (lo predeterminado) no hay comité y todo funciona como antes.
- Los miembros los elige el Super Administrador en **Comité de crédito** (solo personal activo).
- Por encima del límite, "Aprobar" (en Préstamos o en Solicitudes) cuenta como el voto a favor de quien lo
  pulsa; quien no es miembro recibe un aviso. Con los votos necesarios el préstamo pasa a *aprobado*; con el
  mismo número de votos en contra (cada uno con su motivo) queda *rechazado* y se avisa al socio.
- Los votos valen para el monto votado: si se cambia el monto, hay que volver a votar.
- Un préstamo que requiere comité no se puede crear ya aprobado ni cambiar a aprobado a mano (salvo el
  Super Administrador, para registrar préstamos históricos).

## Cumplimiento (prevención de lavado de dinero)

- **Expediente del socio** (Ventanilla → expediente): actividad económica, ingreso mensual, origen de los
  fondos, si es persona expuesta políticamente (PEP) y sus beneficiarios (deben sumar 100%). El módulo
  Cumplimiento cuenta cuántos socios activos tienen el expediente incompleto.
- **Alertas automáticas** al registrar en caja un movimiento de un socio (nunca detienen la operación):
  efectivo igual o mayor al umbral; varios ingresos en efectivo menores que en 30 días lo superan
  (posible fraccionamiento, una alerta por período); y cualquier operación de un PEP desde el 10% del umbral.
- **Umbral**: Parámetros → "Umbral de efectivo". Con 0 se usa el del país (≈ US$10,000 en su moneda);
  confirma el monto vigente con el regulador (UIF/IVE/UAF…).
- **Revisión**: el oficial marca cada alerta como *revisada* o *reportada*, con una nota obligatoria, y
  exporta el listado a Excel. Es información reservada: la ven el Super Administrador, el Administrador
  (salvo que se le quite el módulo) y los roles a los que se les active "Cumplimiento" en Control de Accesos.
- **Estados de baja**: un socio puede marcarse como *retirado* o *fallecido*; ya no puede iniciar sesión.

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
