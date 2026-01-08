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

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Falta la variable de entorno ${name}`);
  return v;
}

const BOT_TOKEN = requireEnv('BOT_TOKEN');
const DRIVE_FOLDER_ID = requireEnv('DRIVE_FOLDER_ID');

const auth = getDriveAuth();
const bot = createTelegramBot(BOT_TOKEN);

const app = express();
app.use(express.json({ limit: '20mb' }));

// Procesamiento de mensajes (misma lógica que en polling, pero ahora
// se disparará cuando lleguen updates vía webhook)
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const isDev = process.env.NODE_ENV === 'development';

  try {
    // 1) Allowlist por usuario
    if (!isAuthorizedTelegramUser(msg)) {
      await bot.sendMessage(chatId, `${isDev ? 'DEV:: ' : ''}⛔ No autorizado.`);
      return;
    }

    // 2) Extraer archivo (documento o foto)
    const fileInfo = extractTelegramFileInfo(msg);

    // Mensajes sin archivo: ayuda básica
    if (!fileInfo) {
      if (msg.text?.startsWith('/start')) {
        await bot.sendMessage(
          chatId,
          `${isDev ? 'DEV:: ' : ''}👋 Envíame un documento (PDF/docx/etc.) o una foto y lo subiré a Google Drive.`
        );
      }
      return;
    }

    await bot.sendMessage(chatId, `${isDev ? 'DEV:: ' : ''}📥 Recibido. Subiendo a Google Drive…`);

    // 3) Cliente Drive API (con oAuth)
    const drive = createDriveClient(auth);

    // 4) Descargar stream desde Telegram
    const { stream, fallbackName } = await getFileDownloadStream(
      bot,
      BOT_TOKEN,
      fileInfo.fileId
    );

    const finalName = fileInfo.originalName || fallbackName;

    // 5) Subir a Drive
    const uploaded = await uploadStreamToDrive({
      drive,
      filename: finalName,
      mimeType: fileInfo.mimeType,
      inputStream: stream,
      parentFolderId: DRIVE_FOLDER_ID,
    });

    await bot.sendMessage(chatId, `${isDev ? 'DEV:: ' : ''}✅ Subido a Drive: ${uploaded.name} (${uploaded.id})`);
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
