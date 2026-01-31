import 'dotenv/config';
import './runtime/appInfo.js'; // Inicializa APP_STARTED_AT al arranque
import express from 'express';
import { getDriveAuth } from './auth.js';
import { createDriveClient, uploadStreamToDrive } from './drive.js';
import {
  createTelegramBot,
  extractTelegramFileInfo,
  getFileDownloadStream,
} from './telegram.js';
import {
  isAuthorizedTelegramUser,
  verifyTelegramWebhookSecret,
} from './security.js';
import { initializePropertyHandlers } from './controllers/telegramController.js';
import { initializeBulkUploadHandlers } from './controllers/bulkUploadController.js';
import { initializeIndividualUploadHandlers } from './controllers/individualUploadController.js';
import { initializeSelfTestHandlers } from './controllers/selfTestController.js';
import { clearBulkSession } from './repositories/bulkSessionRepository.js';
import { clearIndividualUploadSession } from './repositories/individualUploadSessionRepository.js';
import { handleTelegramMessage } from './messageHandler.js';

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Falta la variable de entorno ${name}`);
  return v;
}

const BOT_TOKEN = requireEnv('BOT_TOKEN');
const DRIVE_FOLDER_ID = requireEnv('DRIVE_FOLDER_ID');

const auth = getDriveAuth();
const bot = createTelegramBot(BOT_TOKEN);
const drive = createDriveClient(auth);

const defaultCommands = [
  { command: 'start', description: 'Mensaje de bienvenida' },
  { command: 'help', description: 'Mostrar ayuda' },
  { command: 'add_property', description: 'Añadir nueva vivienda' },
  { command: 'list_properties', description: 'Listar viviendas activas' },
  { command: 'delete_property', description: 'Eliminar vivienda' },
  { command: 'archive', description: 'Menú de archivo' },
  { command: 'archive_property', description: 'Archivar vivienda' },
  { command: 'list_archived', description: 'Ver viviendas archivadas' },
  { command: 'unarchive_property', description: 'Reactivar vivienda' },
  { command: 'bulk', description: 'Subir varios archivos a la vez' },
  { command: 'self_test', description: 'Ejecutar self-test del sistema (admin only)' },
  { command: 'version', description: 'Ver información de versión' },
  { command: 'status', description: 'Ver estado del sistema' },
  { command: 'cancel', description: 'Cancelar operación actual' },
];

const bulkModeCommands = [
  { command: 'bulk_done', description: 'Finalizar subida bulk' },
  { command: 'cancel', description: 'Cancelar operación actual' },
];

await bot.setMyCommands(defaultCommands);

const propertyController = initializePropertyHandlers({
  bot,
  drive,
  baseFolderId: DRIVE_FOLDER_ID,
});

const bulkUploadController = initializeBulkUploadHandlers({
  bot,
  drive,
  baseFolderId: DRIVE_FOLDER_ID,
  botToken: BOT_TOKEN,
  defaultCommands,
  bulkModeCommands,
});

const individualUploadController = initializeIndividualUploadHandlers({
  bot,
  drive,
  baseFolderId: DRIVE_FOLDER_ID,
  botToken: BOT_TOKEN,
});

const selfTestController = initializeSelfTestHandlers({
  bot,
  drive,
  baseFolderId: DRIVE_FOLDER_ID,
});

const app = express();
app.use(express.json({ limit: '20mb' }));

// Procesamiento de mensajes (misma lógica que en polling, pero ahora
// se disparará cuando lleguen updates vía webhook)
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const isDev = process.env.NODE_ENV === 'development';

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

const port = process.env.PORT || 8080;
const isDev = process.env.NODE_ENV === 'development';

app.listen(port, () => {
  console.log(`🚀 Webhook server escuchando en :${port}`);
  if (isDev) {
    console.log('🔧 Modo DEV activado');
    console.log('   Ejecuta: npm run tunnel (en otra terminal)');
    console.log('   Luego: npm run webhook:dev (en otra terminal)');
  }
});
