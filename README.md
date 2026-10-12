# Sistema de Cooperativa

Aplicación web para administrar una cooperativa de ahorro y crédito: socios, aportaciones, préstamos,
pagos, caja, cobranza, contabilidad y panel del socio.

- **Backend:** Node.js + Express + MySQL (`backend/`)
- **Frontend:** React + Vite (`frontend/`)
- **Producción:** Railway (<https://smartcoop.up.railway.app/>)

## Puesta en marcha local

Requisitos: Node.js 20 o superior y MySQL 8.

```bash
# 1. Backend
cd backend
cp .env.example .env          # completa las credenciales y JWT_SECRET
npm install
npm run db:crear cooperativa  # crea la base con el esquema y las migraciones
npm start                     # http://localhost:5000

# 2. Frontend
cd ../frontend
cp .env.example .env          # VITE_API_URL=http://localhost:5000/api
npm install
npm run dev                   # http://localhost:5173
```

El primer usuario se crea directamente en la base (rol Super Administrador); después se gestionan
usuarios y permisos desde la aplicación.

## Pruebas

```bash
cd backend
npm run test:unit   # cálculos de préstamos, mora, fechas (sin base de datos)
npm test            # además, pruebas de integración de la API
```

Las pruebas de integración usan una base **aparte** (`<DB_NAME>_test`); se crea y se reinicia sola.
Por seguridad, el sistema se niega a ejecutarlas si el nombre de la base no termina en `_test`.

El flujo de integración continua (`.github/workflows/ci.yml`) corre las pruebas del backend y compila
el frontend en cada cambio.

## Estructura

```
backend/
  app.js                  Aplicación Express (rutas, seguridad, registro de peticiones)
  server.js               Arranque: migraciones, procesos programados y escucha
  routes/                 Una ruta por módulo (pagos, préstamos, caja, contabilidad...)
  middleware/seguridad.js Sesión, permisos por rol y limpieza de respuestas
  utils/                  Cálculos de préstamos, caja, recibos, fechas, migraciones
  sql/esquema_base.sql    Esquema para crear una base nueva
  scripts/                Crear base, exportar esquema, verificar respaldos
  tests/                  Pruebas unitarias y de integración
frontend/
  src/pages/              Pantallas (cada módulo)
  src/ui/                 Sistema de diseño: tokens y componentes comunes
  src/components/         Componentes compartidos (recibos, modales)
```

## Reglas de negocio importantes

- **Interés:** mes completo siempre; pasado el mes, por días reales (tasa mensual ÷ 30).
- **Mora:** tasa anual y días de gracia configurables (Parámetros). Solo el Super Administrador puede omitirla.
- **Anulaciones:** nunca se borra un pago; se archiva con su motivo y se revierte en caja.
- **Socio:** no ve intereses ni tasas; sí ve su mora y su cuota.

Para operación, respaldos y despliegue, ver [docs/OPERACION.md](docs/OPERACION.md).
