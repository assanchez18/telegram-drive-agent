import 'dotenv/config';
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
import { clearBulkSession } from './repositories/bulkSessionRepository.js';
import { clearIndividualUploadSession } from './repositories/individualUploadSessionRepository.js';

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

const app = express();
app.use(express.json({ limit: '20mb' }));

// Procesamiento de mensajes (misma lógica que en polling, pero ahora
// se disparará cuando lleguen updates vía webhook)
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const isDev = process.env.NODE_ENV === 'development';

  try {
    if (!isAuthorizedTelegramUser(msg)) {
      await bot.sendMessage(chatId, `${isDev ? 'DEV:: ' : ''}⛔ No autorizado.`);
      return;
    }

    if (msg.text?.startsWith('/cancel')) {
      clearBulkSession(chatId);
      clearIndividualUploadSession(chatId);
      await bot.setMyCommands(defaultCommands, {
        scope: { type: 'chat', chat_id: chatId },
      });
      await bot.sendMessage(chatId, `${isDev ? 'DEV:: ' : ''}❌ Operación cancelada.`);
      return;
    }

    const isBulkHandled = await bulkUploadController.handleBulkMessage(msg);
    if (isBulkHandled) {
      return;
    }

    const isIndividualHandled = await individualUploadController.handleIndividualUploadMessage(msg);
    if (isIndividualHandled) {
      return;
    }

    const isHandled = await propertyController.handleTextMessage(msg);
    if (isHandled) {
      return;
    }

    const fileInfo = extractTelegramFileInfo(msg);

    if (!fileInfo) {
      const helpMessage = `${isDev ? 'DEV:: ' : ''}📋 Todos los comandos disponibles:

Gestión de viviendas:
/add_property - Añadir nueva vivienda
/list_properties - Listar viviendas activas
/delete_property - Eliminar vivienda permanentemente

Archivo:
/archive - Menú de gestión de archivo

Subida de documentos:
/bulk - Subir varios archivos a la vez

Ayuda:
/start - Mensaje de bienvenida
/help - Mostrar esta ayuda`;

      if (msg.text?.startsWith('/start')) {
        await bot.sendMessage(chatId, helpMessage);
        return;
      }
      
      if (msg.text?.startsWith('/archive') && msg.text === '/archive') {
        await bot.sendMessage(
          chatId,
          `${isDev ? 'DEV:: ' : ''}📦 Gestión de archivo:\n\n/archive_property - Archivar vivienda activa\n/list_archived - Ver viviendas archivadas\n/unarchive_property - Reactivar vivienda archivada`
        );
        return;
      }

      if (msg.text?.startsWith('/help')) {
        await bot.sendMessage(chatId, helpMessage);
        return;
      }

      await bot.sendMessage(
        chatId,
        `${isDev ? 'DEV:: ' : ''}❓ Comando no reconocido. Usa /help para ver todos los comandos disponibles.`
      );
      return;
    }

    await individualUploadController.startIndividualUpload(msg, fileInfo);
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
