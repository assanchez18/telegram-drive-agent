# Telegram Drive Agent

Bot de Telegram para la gestión automatizada de documentos de viviendas en alquiler. Recibe documentos e imágenes vía Telegram y los almacena automáticamente en Google Drive.

## Descripción

Este proyecto implementa un bot de Telegram desplegado en Google Cloud Run que actúa como agente de almacenamiento. Cuando un usuario autorizado envía un documento o imagen al bot, este lo descarga y lo sube automáticamente a una carpeta específica de Google Drive usando la API de Google Drive con OAuth 2.0.

### Arquitectura

```
Usuario → Telegram → Webhook → Cloud Run (Express) → Google Drive API
```

**Flujo de datos:**

1. Usuario autorizado envía un documento/imagen al bot de Telegram
2. Telegram envía un webhook HTTP POST al servidor (Cloud Run o local)
3. El servidor valida:
   - El secret token del webhook (seguridad)
   - Que el usuario está en la allowlist
4. Descarga el archivo desde los servidores de Telegram
5. Sube el archivo a Google Drive usando OAuth offline (refresh token)
6. Confirma al usuario que el archivo se subió correctamente

## Características

- **Seguridad robusta**: 
  - Allowlist de usuarios de Telegram por ID
  - Verificación de webhook con `secret_token`
  - Validación del header `X-Telegram-Bot-Api-Secret-Token`
- **OAuth offline**: Usa refresh tokens de Google para autenticación persistente sin intervención manual
- **Gestión de viviendas**: Creación automática de estructura de carpetas en Drive para cada vivienda con catálogo persistente
- **Desarrollo ágil**: Modo dev con Cloudflare Tunnel para probar sin redeploy
- **Tests obligatorios**: Coverage 100% enforced con Vitest
- **Modo DEV visual**: Los mensajes del bot empiezan con `DEV::` en desarrollo

## Requisitos

- Node.js >= 20
- Cuenta de Google Cloud (para Cloud Run y Secret Manager)
- Bot de Telegram (token de @BotFather)
- Credenciales de Google OAuth 2.0
- `cloudflared` (solo para desarrollo local)

## Variables de entorno

### Producción (Cloud Run)

Las siguientes variables deben configurarse en Secret Manager o como variables de entorno en Cloud Run:

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `BOT_TOKEN` | Token del bot de Telegram (de @BotFather) | `123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11` |
| `TELEGRAM_WEBHOOK_SECRET` | Secret para validar webhooks de Telegram | `my-secret-token-xyz` |
| `ALLOWED_TELEGRAM_USER_IDS` | Lista de IDs de usuarios autorizados (separados por coma) | `123456789,987654321` |
| `DRIVE_FOLDER_ID` | ID de la carpeta de Google Drive donde se subirán archivos | `1a2b3c4d5e6f7g8h9i0j` |
| `GOOGLE_OAUTH_CLIENT_JSON` | JSON con credenciales OAuth de Google Cloud Console | `{"installed":{"client_id":"...","client_secret":"..."}}` |
| `GOOGLE_OAUTH_TOKEN_JSON` | JSON con el refresh token de OAuth | `{"access_token":"...","refresh_token":"..."}` |
| `PORT` | Puerto del servidor (auto-asignado por Cloud Run) | `8080` |

### Desarrollo local

En desarrollo, puedes usar un archivo `.env` en la raíz del proyecto o pasar las variables directamente en la línea de comandos:

```bash
BOT_TOKEN=your_bot_token
TELEGRAM_WEBHOOK_SECRET=your_secret
ALLOWED_TELEGRAM_USER_IDS=123456789,987654321
DRIVE_FOLDER_ID=your_folder_id
NODE_ENV=development
PORT=8080
```

**Nota:** El archivo `.env` NO debe subirse al repositorio (está en `.gitignore`).

## Instalación

```bash
npm install
```

## Desarrollo local

Para desarrollar sin necesidad de redeploy en Cloud Run, se usa un Cloudflare Quick Tunnel que expone el servidor local a internet.

### Setup: 3 terminales en orden

#### Terminal 1: Servidor local
```bash
PORT=8080 NODE_ENV=development npm run dev
```

Esto inicia el servidor Express en modo desarrollo en el puerto 8080.

#### Terminal 2: Cloudflare Tunnel
```bash
npm run tunnel
```

Espera hasta ver la URL `https://....trycloudflare.com`. Esta URL se guarda automáticamente en `.tunnel-url`.

#### Terminal 3: Configurar webhook DEV
```bash
BOT_TOKEN=your_bot_token TELEGRAM_WEBHOOK_SECRET=your_secret npm run webhook:dev
```

Este script lee la URL del tunnel y configura el webhook de Telegram para apuntar a tu servidor local.

### Probar en desarrollo

1. Envía `/start` al bot en Telegram para ver los comandos disponibles
2. Prueba los comandos de gestión de viviendas:
   - `/add_property` - El bot te pedirá la dirección de la vivienda
   - `/list_properties` - Lista todas las viviendas registradas
3. Envía un documento o una foto para subirlo a Drive
4. Los logs aparecerán en la Terminal 1
5. Los mensajes del bot empezarán con `DEV::` para indicar que estás en modo desarrollo

#### Ejemplo: Añadir una vivienda

```
Usuario: /add_property
Bot: DEV:: 📍 Por favor, envía la dirección de la vivienda.
Usuario: Calle Mayor 123, Madrid
Bot: DEV:: ✅ Vivienda "Calle Mayor 123, Madrid" creada con éxito
```

El bot creará automáticamente en Google Drive la siguiente estructura:

```
DRIVE_FOLDER_ID/
└── Viviendas/
    └── Calle Mayor 123, Madrid/
        ├── 01_Contratos/2026/
        ├── 02_Inquilinos_Sensible/
        ├── 03_Seguros/2026/
        ├── 04_Suministros/2026/
        ├── 05_Comunidad_Impuestos/2026/
        ├── 06_Incidencias_Reformas/Facturas/2026/
        ├── 07_Fotos_Estado/
        └── 99_Otros/
```

Las viviendas se almacenan en un catálogo persistente (`.properties.json`) en Drive, sin necesidad de base de datos externa.

## Despliegue en producción

### 1. Build y deploy en Cloud Run

```bash
gcloud run deploy telegram-drive-agent \
  --source . \
  --region europe-west1 \
  --allow-unauthenticated
```

### 2. Configurar secretos

Configura las variables de entorno en Cloud Run usando Secret Manager o variables de entorno directas.

### 3. Configurar webhook de producción

Una vez desplegado, configura el webhook de Telegram para apuntar a la URL de Cloud Run:

```bash
BOT_TOKEN=your_bot_token \
TELEGRAM_WEBHOOK_SECRET=your_secret \
PROD_BASE_URL=https://your-service-xyz.a.run.app \
npm run webhook:prod
```

Este script configurará el webhook de Telegram en:
```
https://your-service-xyz.a.run.app/telegram/webhook
```

## Scripts disponibles

| Script | Descripción |
|--------|-------------|
| `npm start` | Inicia el servidor en producción |
| `npm run dev` | Inicia el servidor en modo desarrollo (puerto 8080) |
| `npm run tunnel` | Inicia un Cloudflare Quick Tunnel hacia localhost:8080 |
| `npm run webhook:dev` | Configura el webhook de Telegram en modo DEV (usa `.tunnel-url`) |
| `npm run webhook:prod` | Configura el webhook de Telegram en modo PROD (requiere `PROD_BASE_URL`) |
| `npm test` | Ejecuta tests con coverage (falla si coverage < 100%) |
| `npm run test:watch` | Ejecuta tests en modo watch (desarrollo) |

## Testing

Este proyecto sigue una filosofía de **desarrollo orientado a pruebas** con **coverage obligatorio al 100%**.

### Ejecutar tests

```bash
npm test
```

Este comando ejecuta todos los tests con Vitest y verifica que el coverage sea del 100% en:
- Statements
- Branches
- Functions
- Lines

**Si el coverage baja del 100%, el comando falla.**

### Modo watch (desarrollo)

```bash
npm run test:watch
```

Ejecuta los tests en modo watch para desarrollo iterativo.

### Archivos de test

Los tests se encuentran en la carpeta `test/`:

- `test/security.test.js`: Tests de validación de webhook y seguridad
- `test/authz.test.js`: Tests de autorización de usuarios

### Exclusiones de coverage

Se excluyen de coverage:
- `node_modules/**`
- `test/**`
- `scripts/**` (scripts de túnel y configuración de webhook)
- `*.config.js`

## Comandos del bot

| Comando | Descripción |
|---------|-------------|
| `/start` | Muestra mensaje de bienvenida y comandos disponibles |
| `/add_property` | Inicia el proceso para añadir una nueva vivienda. El bot pedirá la dirección y creará automáticamente la estructura de carpetas en Drive |
| `/list_properties` | Muestra la lista de todas las viviendas registradas, ordenadas alfabéticamente |

## Estructura del proyecto

```
.
├── src/
│   ├── index.js                          # Servidor Express (solo bootstrapping)
│   ├── auth.js                           # Autenticación OAuth con Google
│   ├── drive.js                          # Cliente de Google Drive API
│   ├── telegram.js                       # Cliente de Telegram Bot API
│   ├── security.js                       # Validación de webhook y autorización
│   ├── controllers/
│   │   └── telegramController.js         # Handlers de comandos /add_property y /list_properties
│   ├── services/
│   │   └── propertyService.js            # Lógica de negocio para gestión de viviendas
│   ├── repositories/
│   │   └── propertyCatalogRepository.js  # Persistencia del catálogo en Drive (.properties.json)
│   ├── adapters/
│   │   └── driveAdapter.js               # Operaciones de Drive (crear carpetas)
│   └── domain/
│       └── normalizeAddress.js           # Normalización de direcciones
├── test/
│   ├── security.test.js                  # Tests de seguridad
│   ├── authz.test.js                     # Tests de autorización
│   ├── normalizeAddress.test.js          # Tests de normalización
│   ├── driveAdapter.test.js              # Tests de operaciones Drive
│   ├── propertyCatalogRepository.test.js # Tests de persistencia
│   ├── propertyService.test.js           # Tests de lógica de negocio
│   └── telegramController.test.js        # Tests de controladores
├── scripts/
│   ├── tunnel.mjs                        # Script para Cloudflare Tunnel
│   ├── webhook-dev.mjs                   # Configuración de webhook DEV
│   └── webhook-prod.mjs                  # Configuración de webhook PROD
├── vitest.config.js                      # Configuración de Vitest
├── package.json
├── Dockerfile                            # Imagen Docker para Cloud Run
├── CLAUDE.md                             # Reglas de trabajo para Claude Code
├── DEV.md                                # Guía rápida de desarrollo
└── README.md                             # Este archivo
```

## Flujo de autorización OAuth (primera vez)

Para obtener el refresh token de Google Drive:

1. Crea credenciales OAuth 2.0 en Google Cloud Console
2. Descarga el JSON de credenciales
3. Ejecuta el flujo de autorización (script separado, no incluido en este README)
4. Guarda el token JSON resultante en Secret Manager o como variable de entorno

Una vez configurado, el bot usará el refresh token automáticamente sin necesidad de intervención manual.

## Seguridad

### Allowlist de usuarios

Solo los usuarios cuyo ID de Telegram esté en `ALLOWED_TELEGRAM_USER_IDS` pueden usar el bot. Los demás recibirán un mensaje de "No autorizado".

Para obtener tu ID de Telegram, puedes usar bots como [@userinfobot](https://t.me/userinfobot).

### Validación de webhook

Telegram envía el header `X-Telegram-Bot-Api-Secret-Token` en cada petición al webhook. El servidor valida que este header coincida con `TELEGRAM_WEBHOOK_SECRET`. Esto previene que terceros envíen peticiones falsas al webhook.

### Gestión de secretos

- **Producción**: Usa Google Secret Manager para almacenar secretos de forma segura
- **Desarrollo**: Usa un archivo `.env` local (nunca lo subas al repositorio)

## Licencia

Este proyecto es privado y no tiene licencia pública.

## Contribución

Este es un proyecto personal. No se aceptan contribuciones externas en este momento.
