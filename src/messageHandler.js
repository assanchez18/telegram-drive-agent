/**
 * Handler principal de mensajes de Telegram.
 * Procesa mensajes, delega a controllers, y maneja fallback.
 */
import { knownCommands, getHelpMessage, getArchiveMenuMessage, isStart, isHelp, isArchive, isCancel } from './domain/commands.js';

async function handleCancelCommand({ chatId, bot, isDev, clearBulkSession, clearIndividualUploadSession, defaultCommands }) {
  clearBulkSession(chatId);
  clearIndividualUploadSession(chatId);
  await bot.setMyCommands(defaultCommands, {
    scope: { type: 'chat', chat_id: chatId },
  });
  await bot.sendMessage(chatId, `${isDev ? 'DEV:: ' : ''}❌ Operación cancelada.`);
}

async function handleFallbackMessage({ msg, bot, isDev }) {
  const chatId = msg.chat.id;
  const prefix = isDev ? 'DEV:: ' : '';

  if (isStart(msg) || isHelp(msg)) {
    await bot.sendMessage(chatId, `${prefix}${getHelpMessage()}`);
    return;
  }

  if (isArchive(msg)) {
    await bot.sendMessage(chatId, `${prefix}${getArchiveMenuMessage()}`);
    return;
  }

  if (knownCommands.some(cmd => msg.text?.startsWith(cmd))) {
    return;
  }

  await bot.sendMessage(
    chatId,
    `${prefix}❓ Comando no reconocido. Usa /help para ver todos los comandos disponibles.`
  );
}

export async function handleTelegramMessage({
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
}) {
  const chatId = msg.chat.id;
  const isDev = process.env.NODE_ENV === 'development';

  if (!isAuthorizedTelegramUser(msg)) {
    await bot.sendMessage(chatId, `${isDev ? 'DEV:: ' : ''}⛔ No autorizado.`);
    return;
  }

  if (isCancel(msg)) return await handleCancelCommand({ chatId, bot, isDev, clearBulkSession, clearIndividualUploadSession, defaultCommands });

  if (await bulkUploadController.handleBulkMessage(msg)) return;
  if (await individualUploadController.handleIndividualUploadMessage(msg)) return;
  if (await propertyController.handleTextMessage(msg)) return;

  const fileInfo = extractTelegramFileInfo(msg);
  if (!fileInfo) return await handleFallbackMessage({ msg, bot, isDev });

  await individualUploadController.startIndividualUpload(msg, fileInfo);
}
