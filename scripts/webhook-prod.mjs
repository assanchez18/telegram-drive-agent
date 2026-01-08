import 'dotenv/config';
import axios from 'axios';

const BOT_TOKEN = process.env.BOT_TOKEN;
const TELEGRAM_WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;
const PROD_BASE_URL = process.env.PROD_BASE_URL;

if (!BOT_TOKEN) {
  console.error('❌ Falta BOT_TOKEN');
  process.exit(1);
}

if (!TELEGRAM_WEBHOOK_SECRET) {
  console.error('❌ Falta TELEGRAM_WEBHOOK_SECRET');
  process.exit(1);
}

if (!PROD_BASE_URL) {
  console.error('❌ Falta PROD_BASE_URL (ej: https://your-service-xyz.a.run.app)');
  process.exit(1);
}

const webhookUrl = `${PROD_BASE_URL}/telegram/webhook`;

console.log(`🚀 Configurando webhook PROD: ${webhookUrl}`);

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
    console.log(`✅ Webhook PROD configurado correctamente: ${webhookUrl}`);
  } else {
    console.error('❌ Error configurando webhook:', response.data);
    process.exit(1);
  }
} catch (err) {
  console.error('❌ Error llamando a Telegram API:', err.message);
  process.exit(1);
}
