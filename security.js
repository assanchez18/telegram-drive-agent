const ALLOWED_USER_IDS = new Set(
  (process.env.ALLOWED_TELEGRAM_USER_IDS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
);

export function isAuthorizedTelegramUser(msg) {
  const senderId = String(msg.from?.id || '');
  return ALLOWED_USER_IDS.has(senderId);
}

export function verifyTelegramWebhookSecret(req) {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!expected) throw new Error('Falta TELEGRAM_WEBHOOK_SECRET');

  const got = req.header('X-Telegram-Bot-Api-Secret-Token');

  return (got || '').trim() === expected.trim();
}
