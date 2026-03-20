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

| Variable | Descripción |
|----------|-------------|
| `BOT_TOKEN` | Token del bot de Telegram (de @BotFather) |
| `TELEGRAM_WEBHOOK_SECRET` | Secret aleatorio para validar webhooks de Telegram |
| `ALLOWED_TELEGRAM_USER_IDS` | Lista de IDs de usuarios autorizados (separados por coma) |
| `DRIVE_FOLDER_ID` | ID de la carpeta raíz de Google Drive |
| `GOOGLE_OAUTH_CLIENT_JSON` | JSON con credenciales OAuth descargado de Google Cloud Console |
| `GOOGLE_OAUTH_TOKEN_JSON` | JSON con el refresh token de OAuth (gestionado automáticamente) |
| `USE_SECRET_MANAGER` | Si debe usar Secret Manager para guardar tokens (default: `true` en prod, `false` en dev) |
| `PORT` | Puerto del servidor (auto-asignado por Cloud Run) |

### Desarrollo local

En desarrollo, puedes usar un archivo `.env` en la raíz del proyecto o pasar las variables directamente en la línea de comandos:

```bash
BOT_TOKEN=your_bot_token
TELEGRAM_WEBHOOK_SECRET=your_secret
ALLOWED_TELEGRAM_USER_IDS=your_telegram_user_id
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
2. **Autocompletado de comandos**: Al escribir `/`, Telegram mostrará todos los comandos disponibles con sus descripciones
3. Prueba los comandos de gestión de viviendas:
   - `/add_property` - El bot te pedirá la dirección de la vivienda
   - `/list_properties` - Lista todas las viviendas registradas
   - `/bulk` - Inicia modo de subida en bulk de múltiples archivos
4. **Subida individual**: Envía un documento, foto o video directamente y el bot te preguntará dónde guardarlo
5. Los logs aparecerán en la Terminal 1
6. Los mensajes del bot empezarán con `DEV::` para indicar que estás en modo desarrollo

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
        ├── Renta/
        │   └── 2026/
        │       ├── Ingresos/
        │       └── Gastos/
        ├── Gestión/
        └── Archivo/
            └── Fotos/
```

#### Ejemplo: Eliminar una vivienda

```
Usuario: /delete_property
Bot: DEV:: 🗑️ Selecciona el número de la vivienda a eliminar:

1. Calle Mayor 123, Madrid
2. Avenida Principal 456

Envía el número (1-2) o "cancelar"

Usuario: 1
Bot: DEV:: ⚠️ ¿Estás seguro de eliminar "Calle Mayor 123, Madrid"?

⚠️ NOTA: Se eliminará del catálogo Y todas las carpetas en Drive.

Responde "confirmar" para continuar o "cancelar" para abortar.

Usuario: confirmar
Bot: DEV:: 🗑️ Vivienda "Calle Mayor 123, Madrid" eliminada del catálogo y de Drive
```

#### Ejemplo: Archivar una vivienda

```
Usuario: /archive_property
Bot: DEV:: 📦 Selecciona el número de la vivienda a archivar:

1. Calle Mayor 123, Madrid
2. Avenida Principal 456

Envía el número (1-2) o "cancelar"

Usuario: 1
Bot: DEV:: ⚠️ ¿Estás seguro de archivar "Calle Mayor 123, Madrid"?

⚠️ NOTA: Se moverá a la carpeta "Archivo" en Drive.

Responde "confirmar" para continuar o "cancelar" para abortar.

Usuario: confirmar
Bot: DEV:: 📦 Vivienda "Calle Mayor 123, Madrid" archivada correctamente
```

Las viviendas se almacenan en un catálogo persistente (`.properties.json`) en Drive, sin necesidad de base de datos externa.

#### Ejemplo: Subir múltiples archivos en bulk

```
Usuario: /bulk
Bot: DEV:: 📦 Modo bulk activado.
Envía ahora varios documentos o fotos.
Cuando termines, escribe /bulk_done.
Para cancelar: /cancel.

Usuario: [envía contrato.pdf]
Bot: DEV:: ➕ Añadido (1 archivo en cola)

Usuario: [envía recibo_luz.pdf]
Bot: DEV:: ➕ Añadido (2 archivos en cola)

Usuario: [envía foto_estado.jpg]
Bot: DEV:: ➕ Añadido (3 archivos en cola)

Usuario: /bulk_done
Bot: DEV:: ¿A qué vivienda pertenecen?
[Botones: Calle Mayor 123, Madrid | Avenida Principal 456 | Cancelar]

Usuario: [selecciona "Calle Mayor 123, Madrid"]
Bot: DEV:: ¿En qué categoría?
[Botones: Ingresos | Gastos | Gestión | Archivo | Fotos | Cancelar]

Usuario: [selecciona "Ingresos"]
Bot: DEV:: ¿Año?
[Botones: 2026 ✅ | Otro año | Cancelar]

Usuario: [selecciona "2026 ✅"]
Bot: DEV:: 📸 Tienes 1 foto/video sin nombre.

¿Qué nombre base quieres usar?
(Se numerarán automáticamente: nombre_1, nombre_2, etc.)

Envía el nombre o "skip" para usar nombres automáticos:

Usuario: Estado Inicial
Bot: DEV:: Vas a guardar 3 archivos en:

📍 Vivienda: Calle Mayor 123, Madrid
📂 Categoría: Ingresos
📅 Año: 2026
📝 Nombre base: estado_inicial (1 archivo)

¿Confirmar?
[Botones: Confirmar | Cancelar]

Usuario: [selecciona "Confirmar"]
Bot: DEV:: ⏳ Subiendo archivos...
Bot: DEV:: ✅ Subidos 3 archivos
```

**Características clave del modo bulk:**
- **Renombrado inteligente**: 
  - **Caption como nombre**: Si el archivo tiene un caption (texto añadido a la imagen/video/documento), se usa automáticamente como nombre
  - Documentos con nombre: Se convierten a `snake_case` (ej. "Contrato Alquiler.pdf" → "contrato_alquiler.pdf")
  - Fotos/videos sin nombre ni caption: Pide nombre base y numera automáticamente (ej. "estado_inicial_1.jpg", "estado_inicial_2.jpg")
  - Opción "skip": Usa nombres automáticos basados en IDs de Telegram
- **Snake case automático**: Todos los nombres se convierten a minúsculas con guiones bajos, preservando caracteres españoles (ñ, á, é, í, ó, ú, ü)
- **Detección de duplicados**: Antes de subir, el bot verifica si algún archivo ya existe y pide confirmación para reemplazar
- **Errores parciales**: Si falla la subida de un archivo, se reporta pero continúa con los demás
- **Confirmación obligatoria**: No se sube nada hasta que el usuario confirme el destino
- **Cancelación en cualquier momento**: El comando `/cancel` limpia la sesión activa
- **Comandos contextuales**: Al activar `/bulk`, solo se muestran `/bulk_done` y `/cancel` en el autocomplete

#### Ejemplo: Subir un archivo individual

```
Usuario: [envía foto.jpg]
Bot: DEV:: ¿A qué vivienda pertenece?
[Botones: Calle Mayor 123, Madrid | Avenida Principal 456 | Cancelar]

Usuario: [selecciona "Calle Mayor 123, Madrid"]
Bot: DEV:: ¿En qué categoría?
[Botones: Ingresos | Gastos | Gestión | Archivo | Fotos | Cancelar]

Usuario: [selecciona "Fotos"]
Bot: DEV:: ¿Qué nombre quieres darle al archivo?

Envía el nombre (sin extensión) o "skip" para usar nombre automático:

Usuario: Estado Inicial Vivienda
Bot: DEV:: ⏳ Subiendo archivo...
Bot: DEV:: ✅ Archivo "estado_inicial_vivienda.jpg" subido correctamente en:
📍 Calle Mayor 123, Madrid
📂 Fotos
📅 N/A
```

**Características de subida individual:**
- **Caption como nombre**: Si añades un caption al archivo, se usará automáticamente como nombre (sin preguntar)
- **Renombrado opcional**: Para fotos y videos sin nombre ni caption, el bot pide un nombre personalizado
- **Snake case automático**: Todos los nombres se convierten a `snake_case`, preservando ñ y acentos (ej. "Baño Principal" → "baño_principal.jpg")
- **Documentos**: Si tienen nombre, se suben directamente con conversión a snake_case
- **Cancelación**: `/cancel` en cualquier momento
- **Automático**: Si el archivo ya tiene nombre (documentos) o caption, se sube directamente sin preguntar

### Autocompletado de comandos

El bot utiliza el sistema de comandos de Telegram para mostrar autocomplete contextual:

- **Comandos generales**: `/start`, `/help`, `/add_property`, `/list_properties`, `/delete_property`, `/archive`, `/archive_property`, `/list_archived`, `/unarchive_property`, `/bulk`, `/cancel`
- **Modo bulk activo**: Cuando activas `/bulk`, el autocomplete cambia automáticamente a mostrar solo:
  - `/bulk_done` - Finalizar la subida en lote
  - `/cancel` - Cancelar la operación

Al completar o cancelar una operación, los comandos vuelven a la lista completa automáticamente.

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
| `/list_properties` | Muestra la lista de todas las viviendas activas registradas, ordenadas alfabéticamente |
| `/delete_property` | **Elimina permanentemente** una vivienda del catálogo y **borra todas sus carpetas en Drive**. Muestra lista numerada y solicita confirmación. ⚠️ **ATENCIÓN:** Esta acción es irreversible |
| `/archive_property` | Archiva una vivienda activa. La mueve del catálogo principal a la carpeta "Archivo" en Drive. La vivienda se puede reactivar más tarde |
| `/list_archived` | Muestra la lista de todas las viviendas archivadas, ordenadas alfabéticamente |
| `/unarchive_property` | Reactiva una vivienda archivada. La mueve de vuelta a la carpeta "Viviendas" en Drive y la añade al catálogo activo |
| `/bulk` | Inicia modo de subida en bulk. Permite enviar múltiples archivos seguidos y luego confirmar con `/bulk_done` para procesarlos todos a la vez |
| `/self_test` | Ejecuta un test end-to-end del sistema completo. Verifica todas las operaciones críticas: crear propiedad, verificar estructura de carpetas, subir archivos, archivar, reactivar y eliminar. Requiere confirmación previa. Disponible para todos los usuarios autorizados |
| `/version` | Muestra información de versión de la aplicación, entorno, Cloud Run y tiempo de arranque |
| `/status` | Ejecuta diagnóstico del sistema verificando configuración, OAuth, acceso a Drive y catálogo |
| `/cancel` | Cancela la operación actual en curso |

### Self-Test

El comando `/self_test` está diseñado para verificar que todos los sistemas funcionan correctamente en producción. Cualquier usuario autorizado puede ejecutarlo.

**Qué hace el self-test:**

1. Verifica el listado de propiedades
2. Crea una propiedad de prueba única (nombre: `Self-Test-{timestamp}`)
3. Verifica que se crearon las carpetas de la estructura correctamente
4. Sube 2 archivos de prueba (foto + PDF) a diferentes categorías
5. Archiva la propiedad de prueba
6. Reactiva la propiedad de prueba
7. Elimina la propiedad de prueba (cleanup)

**Duración estimada:** 30-60 segundos

El comando requiere confirmación antes de ejecutarse y muestra el progreso paso a paso con indicadores de éxito (✅) o fallo (❌).

**Ejemplo de uso:**

```
Usuario: /self_test
Bot: 🔍 Self-Test del Sistema

Este comando ejecutará un test end-to-end que:
1. Verificará el listado de propiedades
2. Creará una propiedad de prueba
...

⏱️ Duración estimada: 30-60 segundos

¿Confirmas ejecutar el self-test?

[✅ Confirmar] [❌ Cancelar]

Usuario: (presiona Confirmar)
Bot: 🔍 Ejecutando self-test...

Paso 1/7: Verificar listado de propiedades
✅ OK
   0 propiedades encontradas

Paso 2/7: Crear propiedad de prueba
✅ OK
   Propiedad "Self-Test-1234567890" creada
...

✅ Self-Test exitoso - Todos los sistemas funcionando correctamente
```

Si algo falla durante el test, el sistema intenta hacer cleanup automáticamente (eliminar la propiedad de prueba).

## Diagnóstico

El bot incluye dos comandos para verificar el estado del sistema:

### `/version`

Muestra información sobre la versión y el entorno de ejecución:
- Nombre y versión de la aplicación (desde `package.json`)
- Entorno (`NODE_ENV`)
- Información de Cloud Run (service y revision) o "local" si se ejecuta localmente
- Timestamp de inicio del proceso
- Git SHA (si está disponible)

**Ejemplo de uso:**

```
Usuario: /version
Bot: 📦 telegram-drive-agent v1.0.0

🌍 Entorno: production
☁️ Cloud Run: telegram-drive-agent (telegram-drive-agent-00001-abc)
🚀 Iniciado: 2024-01-15T10:30:00.000Z
🔖 Git SHA: abc123def
```

Este comando nunca falla. Si alguna información no está disponible, muestra "N/A".

### `/status`

Ejecuta un diagnóstico completo del sistema verificando:

1. **Config**: Verifica que todas las variables de entorno requeridas estén configuradas
   - `BOT_TOKEN`
   - `TELEGRAM_WEBHOOK_SECRET`
   - `ALLOWED_TELEGRAM_USER_IDS`
   - `DRIVE_FOLDER_ID`
   - `GOOGLE_OAUTH_CLIENT_JSON`
   - `GOOGLE_OAUTH_TOKEN_JSON`

2. **Google OAuth**: Intenta construir el cliente de autenticación y refrescar el token de acceso

3. **Drive (carpeta raíz)**: Verifica que la carpeta raíz (`DRIVE_FOLDER_ID`) existe y es accesible

4. **Catálogo**: Intenta leer el catálogo de propiedades y muestra el número de propiedades activas

**Ejemplo de uso (todo OK):**

```
Usuario: /status
Bot: 🔍 Ejecutando diagnóstico del sistema...

📊 Estado del Sistema

✅ Config
   Todas las variables requeridas están configuradas

✅ Google OAuth
   Auth client válido y token actualizado

✅ Drive (carpeta raíz)
   Carpeta raíz accesible: "Telegram Drive Storage"

✅ Catálogo
   Catálogo accesible (5 propiedades activas)
```

**Ejemplo de uso (con errores):**

```
Usuario: /status
Bot: 🔍 Ejecutando diagnóstico del sistema...

📊 Estado del Sistema

❌ Config
   Faltan variables: BOT_TOKEN

✅ Google OAuth
   Auth client válido y token actualizado

❌ Drive (carpeta raíz)
   Error: Carpeta no encontrada (404)

✅ Catálogo
   Catálogo accesible (5 propiedades activas)
```

**Características:**
- Cada check tiene un timeout de 5 segundos para evitar bloqueos
- Si un check falla, el comando continúa con los demás checks
- Solo lectura: no modifica ningún dato
- Útil para verificar configuración en producción

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

## Configuración de Google OAuth 2.0

### 1. Crear credenciales OAuth en Google Cloud Console

1. Ve a [Google Cloud Console - Credentials](https://console.cloud.google.com/apis/credentials)
2. Selecciona o crea un proyecto
3. Haz clic en **"+ CREATE CREDENTIALS"** → **"OAuth client ID"**
4. Tipo de aplicación: **"Web application"**
5. Nombre: `Telegram Drive Agent` (o el que prefieras)

### 2. Configurar Authorized redirect URIs

**⚠️ CRÍTICO:** Debes agregar TODOS los redirect URIs que usará tu aplicación. El redirect URI debe coincidir EXACTAMENTE (scheme, host, puerto, path) con el que envía tu app.

**Agrega estos redirect URIs en Google Cloud Console:**

**Desarrollo local (sin cloudflared):**
```
http://localhost:8080/oauth/google/callback
```

**Desarrollo local con cloudflared (opcional):**
```
https://tu-tunnel-url.trycloudflare.com/oauth/google/callback
```

**Producción en Cloud Run:**
```
https://tu-servicio.run.app/oauth/google/callback
```

**Pasos:**
1. En la sección **"Authorized redirect URIs"**, haz clic en **"+ ADD URI"**
2. Agrega TODOS los URIs que usarás (local + producción)
3. Cada URI debe ser exacto: `http://localhost:8080/oauth/google/callback` (con puerto)
4. Guarda los cambios

**Nota importante sobre puertos:** Si cambias el puerto local (ej: `PORT=3000`), debes agregar el nuevo redirect URI: `http://localhost:3000/oauth/google/callback`

### 3. Descargar credenciales

1. Una vez creado el OAuth client, descarga el JSON haciendo clic en el icono de descarga
2. Ese JSON es el valor que debes configurar en `GOOGLE_OAUTH_CLIENT_JSON`

### 4. Configurar variables de entorno

#### Variable `PUBLIC_BASE_URL`

Esta variable determina qué redirect URI usará la aplicación:

- **Desarrollo local SIN cloudflared**: NO configurar (usa fallback `http://localhost:PORT`)
- **Desarrollo local CON cloudflared**: Configurar con la URL del tunnel
- **Producción**: **OBLIGATORIO** - URL pública de Cloud Run

**Desarrollo local (puerto por defecto 8080):**
```bash
# .env
GOOGLE_OAUTH_CLIENT_JSON='{"web":{"client_id":"...","client_secret":"..."}}'
# PUBLIC_BASE_URL no configurado → usa http://localhost:8080
PORT=8080  # Opcional, por defecto es 8080
OAUTH_STATE_SECRET="genera-un-secret-aleatorio-de-32-chars-o-mas"
```

**Desarrollo local con cloudflared:**
```bash
# .env
GOOGLE_OAUTH_CLIENT_JSON='{"web":{"client_id":"...","client_secret":"..."}}'
PUBLIC_BASE_URL="https://tu-tunnel-url.trycloudflare.com"
OAUTH_STATE_SECRET="genera-un-secret-aleatorio-de-32-chars-o-mas"
```

**Producción (Cloud Run):**
```bash
# Variables de entorno en Cloud Run o Secret Manager
GOOGLE_OAUTH_CLIENT_JSON='{"web":{"client_id":"...","client_secret":"..."}}'
PUBLIC_BASE_URL="https://tu-servicio.run.app"  # OBLIGATORIO
OAUTH_STATE_SECRET="secret-aleatorio-seguro"
GOOGLE_TOKEN_SECRET_NAME="GOOGLE_OAUTH_TOKEN_JSON"
PORT=8080  # Auto-asignado por Cloud Run
```

### 5. Autorizar la aplicación (primera vez o re-autorizar)

Una vez configurado todo:

1. Inicia el bot (desarrollo: `npm run dev`, producción: está corriendo en Cloud Run)
2. Envía `/google_login` al bot en Telegram
3. El bot te mostrará el redirect URI que usará
4. **Verifica que coincida exactamente** con el configurado en Google Cloud Console
5. Haz clic en **"✅ Continuar"**
6. Haz clic en el link de autorización
7. Selecciona tu cuenta de Google
8. Autoriza el acceso a Google Drive
9. Serás redirigido de vuelta y el bot confirmará que el token se actualizó

#### Almacenamiento del Token

El token OAuth se guarda de forma diferente según el entorno:

**Desarrollo local (`NODE_ENV=development` o `USE_SECRET_MANAGER=false`):**
- Se guarda en un archivo local dentro de `./secrets/` (excluido de git)
- **Seguridad:** No compartas ni subas este directorio, contiene credenciales de acceso

**Producción (`NODE_ENV=production` o `USE_SECRET_MANAGER=true`):**
- Se guarda en Google Secret Manager, automáticamente versionado y cifrado
- Requiere el permiso `secretmanager.versions.add` en el proyecto de GCP

**Configuración manual (override):**
```bash
# Forzar uso de archivo local incluso en producción (NO recomendado)
USE_SECRET_MANAGER=false

# Forzar uso de Secret Manager en desarrollo (requiere permisos)
USE_SECRET_MANAGER=true
```

**Nota:** El comando `/google_login` permite re-autorizar en cualquier momento sin necesidad de acceso al servidor. El token se guarda automáticamente según la configuración del entorno.

### Solución de problemas OAuth

#### Error: "redirect_uri_mismatch" o "Error 400: invalid_request"

**Causa:** El redirect URI enviado por la app NO coincide EXACTAMENTE con los configurados en Google Cloud Console.

**Diagnóstico:**
Revisa los logs del servidor para ver qué redirect URI está usando la aplicación.

**Solución:**
1. **Identifica el redirect URI usado** en los logs del servidor al arrancar
2. **Verifica** que ese URI coincide EXACTAMENTE con el registrado en Google Cloud Console
3. **Agrega el URI** en Google Cloud Console → Credentials → tu OAuth client → Authorized redirect URIs
4. **Reinicia el servidor**

#### Error: "Required parameter is missing: response_type"

**Causa:** Problema con la generación de la URL de autorización o configuración incorrecta del OAuth client.

**Solución:**
1. Verifica que `GOOGLE_OAUTH_CLIENT_JSON` tenga la estructura correcta con las claves `client_id` y `client_secret`
2. Asegúrate de que `PUBLIC_BASE_URL` esté configurado correctamente (sin barra al final)
3. Revisa los logs del servidor para ver la URL generada

#### El bot no muestra el comando /google_login

**Causa:** `GOOGLE_OAUTH_CLIENT_JSON` no está configurado.

**Solución:**
1. Configura la variable de entorno `GOOGLE_OAUTH_CLIENT_JSON` con el JSON de credenciales
2. Reinicia el servidor
3. Verifica en los logs que veas: `✅ Google Login habilitado`

## Seguridad

### Allowlist de usuarios

Solo los usuarios cuyo ID de Telegram esté en `ALLOWED_TELEGRAM_USER_IDS` pueden usar el bot. Los demás recibirán un mensaje de "No autorizado".

Para obtener tu ID de Telegram, consulta la documentación oficial de la API de Telegram o usa cualquier bot de diagnóstico de tu preferencia.

### Validación de webhook

Cada petición al webhook es validada mediante un secret token que Telegram incluye en la cabecera HTTP de cada llamada. El servidor rechaza cualquier petición que no incluya el token correcto, previniendo llamadas falsas al endpoint.

### Gestión de secretos

- **Producción**: Usa Google Secret Manager para almacenar secretos de forma segura
- **Desarrollo**: Usa un archivo `.env` local (nunca lo subas al repositorio)

## Licencia

Este proyecto es privado y no tiene licencia pública.

## Contribución

Este es un proyecto personal. No se aceptan contribuciones externas en este momento.
