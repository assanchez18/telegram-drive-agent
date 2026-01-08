export function parseAllowedUserIds(allowedListString) {
  if (!allowedListString) return new Set();
  return new Set(
    allowedListString
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
  );
}

const ALLOWED_USER_IDS = parseAllowedUserIds(process.env.ALLOWED_TELEGRAM_USER_IDS);

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
