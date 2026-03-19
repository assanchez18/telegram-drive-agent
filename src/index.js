import 'dotenv/config';
import './runtime/appInfo.js'; // Inicializa APP_STARTED_AT al arranque
import crypto from 'crypto';
import express from 'express';
import { getDriveAuth } from './auth.js';
import { createDriveClient, uploadStreamToDrive } from './drive.js';
import {
  createTelegramBot,
  extractTelegramFileInfo,
} from './telegram.js';
import {
  isAuthorizedTelegramUser,
  verifyTelegramWebhookSecret,
} from './security.js';
import { initializePropertyHandlers } from './controllers/telegramController.js';
import { initializeBulkUploadHandlers } from './controllers/bulkUploadController.js';
import { initializeIndividualUploadHandlers } from './controllers/individualUploadController.js';
import { initializeSelfTestHandlers } from './controllers/selfTestController.js';
import { initializeGoogleLoginHandlers } from './controllers/googleLoginController.js';
import { clearBulkSession } from './repositories/bulkSessionRepository.js';
import { clearIndividualUploadSession } from './repositories/individualUploadSessionRepository.js';
import { handleTelegramMessage } from './messageHandler.js';
import { createOAuthRouter } from './routes/oauthRoutes.js';
import { defaultCommands, bulkModeCommands } from './domain/commands.js';

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Falta la variable de entorno ${name}`);
  return v;
}

function loadConfig() {
  return {
    botToken: requireEnv('BOT_TOKEN'),
    driveFolderId: requireEnv('DRIVE_FOLDER_ID'),
    googleTokenSecretName: process.env.GOOGLE_TOKEN_SECRET_NAME || 'GOOGLE_OAUTH_TOKEN_JSON',
    port: process.env.PORT || 8080,
  };
}

function validateSystemDependencies({ auth, bot, drive }) {
  if (!auth) throw new Error('Google Drive auth is required');
  if (!bot) throw new Error('Telegram bot is required');
  if (!drive) throw new Error('Google Drive client is required');
}

function initializeGoogleOAuth({ app, bot, port, googleTokenSecretName }) {
  const oauthClientJson = process.env.GOOGLE_OAUTH_CLIENT_JSON;
  const oauthStateSecret = process.env.OAUTH_STATE_SECRET || crypto.randomBytes(32).toString('hex');
  const publicBaseUrl = process.env.PUBLIC_BASE_URL;

  if (!oauthStateSecret || oauthStateSecret.length < 32) {
    console.warn('⚠️  OAUTH_STATE_SECRET no configurado o demasiado corto. Usando valor temporal (no usar en producción).');
  }

  if (oauthClientJson) {
    initializeGoogleLoginHandlers({
      bot,
      oauthClientJson,
      stateSecret: oauthStateSecret,
      baseUrl: publicBaseUrl,
      port,
    });
    console.log('✅ Google Login habilitado');

    const oauthRouter = createOAuthRouter({
      oauthClientJson,
      stateSecret: oauthStateSecret,
      baseUrl: publicBaseUrl,
      port,
      secretName: googleTokenSecretName,
      bot,
    });
    app.use('/oauth', oauthRouter);
    console.log('✅ OAuth routes montadas en /oauth');
  } else {
    console.warn('⚠️  GOOGLE_OAUTH_CLIENT_JSON no configurado. /google_login no estará disponible.');
  }
}

async function main() {
  const { botToken, driveFolderId, googleTokenSecretName, port } = loadConfig();
  const isDev = process.env.NODE_ENV === 'development';

  const auth = await getDriveAuth(googleTokenSecretName);
  const bot = createTelegramBot(botToken);
  const drive = createDriveClient(auth);

  validateSystemDependencies({ auth, bot, drive });

  await bot.setMyCommands(defaultCommands);

  const propertyController = initializePropertyHandlers({
    bot,
    drive,
    baseFolderId: driveFolderId,
  });

  const bulkUploadController = initializeBulkUploadHandlers({
    bot,
    drive,
    baseFolderId: driveFolderId,
    botToken,
    defaultCommands,
    bulkModeCommands,
  });

  const individualUploadController = initializeIndividualUploadHandlers({
    bot,
    drive,
    baseFolderId: driveFolderId,
    botToken,
  });

  const selfTestController = initializeSelfTestHandlers({
    bot,
    drive,
    baseFolderId: driveFolderId,
  });

  const app = express();
  app.use(express.json({ limit: '20mb' }));

  initializeGoogleOAuth({ app, bot, port, googleTokenSecretName });

  // Procesamiento de mensajes (misma lógica que en polling, pero ahora
  // se disparará cuando lleguen updates vía webhook)
  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;

    try {
      await handleTelegramMessage({
        msg,
        bot,
        isAuthorizedTelegramUser,
        clearBulkSession,
        clearIndividualUploadSession,
        bulkUploadController,
        individualUploadController,
        propertyController,
        extractTelegramFileInfo,
        defaultCommands,
      });
    } catch (err) {
      console.error('Error procesando mensaje:', err);
      try {
        await bot.sendMessage(chatId, `${isDev ? 'DEV:: ' : ''}❌ Error subiendo el archivo. Revisa logs.`);
      } catch {
        // si no podemos enviar mensaje, no hacemos nada
      }
    }
  });

  // Endpoint webhook
  app.post('/telegram/webhook', (req, res) => {
    try {
      // Verificación de origen (production)
      if (!verifyTelegramWebhookSecret(req)) {
        return res.status(401).send('Unauthorized');
      }

      // Importante: responder rápido y procesar el update
      bot.processUpdate(req.body);
      return res.status(200).send('OK');
    } catch (err) {
      console.error('Webhook error:', err);
      return res.status(500).send('Error');
    }
  });

  app.listen(port, () => {
    console.log(`🚀 Webhook server escuchando en :${port}`);
    if (isDev) {
      console.log('🔧 Modo DEV activado');
      console.log('   Ejecuta: npm run tunnel (en otra terminal)');
      console.log('   Luego: npm run webhook:dev (en otra terminal)');
    }
  });
}

main().catch((err) => {
  console.error('Error fatal al iniciar la aplicación:', err);
  process.exit(1);
});
