import 'dotenv/config';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';

const __dirname = dirname(fileURLToPath(import.meta.url));

const BOT_TOKEN = process.env.BOT_TOKEN;
const TELEGRAM_WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;

if (!BOT_TOKEN) {
  console.error('❌ Falta BOT_TOKEN en .env');
  process.exit(1);
}

if (!TELEGRAM_WEBHOOK_SECRET) {
  console.error('❌ Falta TELEGRAM_WEBHOOK_SECRET en .env');
  process.exit(1);
}

const tunnelFile = join(__dirname, '..', '.tunnel-url');
let tunnelUrl;
try {
  tunnelUrl = readFileSync(tunnelFile, 'utf8').trim();
} catch (err) {
  console.error('❌ No se pudo leer .tunnel-url. Asegúrate de que el tunnel esté corriendo.');
  process.exit(1);
}

const webhookUrl = `${tunnelUrl}/telegram/webhook`;

console.log(`🔧 Configurando webhook DEV: ${webhookUrl}`);

const baseUrl = `https://api.telegram.org/bot${BOT_TOKEN}`;

try {
  console.log('🗑️  Eliminando webhook anterior...');
  await axios.post(`${baseUrl}/deleteWebhook`);

  console.log('✅ Configurando nuevo webhook...');
  const response = await axios.post(`${baseUrl}/setWebhook`, {
    url: webhookUrl,
    secret_token: TELEGRAM_WEBHOOK_SECRET,
  });

  if (response.data.ok) {
    console.log(`✅ Webhook DEV configurado correctamente: ${webhookUrl}`);
  } else {
    console.error('❌ Error configurando webhook:', response.data);
    process.exit(1);
  }
} catch (err) {
  console.error('❌ Error llamando a Telegram API:', err.message);
  process.exit(1);
}
