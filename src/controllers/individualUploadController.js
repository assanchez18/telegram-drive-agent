import { getCategoryFolderPath, CATEGORY_FOLDER_MAPPING, buildCategoryButtons } from '../domain/DocumentCategory.js';
import { getCurrentYear, getPreviousYear } from '../domain/Year.js';
import {
  startIndividualUploadSession,
  getIndividualUploadSession,
  updateIndividualUploadSessionState,
  clearIndividualUploadSession,
} from '../repositories/individualUploadSessionRepository.js';
import { listProperties } from '../services/propertyService.js';
import { downloadTelegramFile } from '../adapters/telegramFileAdapter.js';
import { uploadBufferToDrive, resolveCategoryFolderId } from '../adapters/driveAdapter.js';
import { applySnakeCaseToFileName, needsUserProvidedName } from '../utils/fileNaming.js';

export function initializeIndividualUploadHandlers({ bot, drive, baseFolderId, botToken }) {
  bot.on('callback_query', async (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const data = callbackQuery.data;
    const isDev = process.env.NODE_ENV === 'development';
    const session = getIndividualUploadSession(chatId);

    if (!session) return;

    if (data === 'individual_cancel') return await onCancelled({ callbackQuery, chatId, bot, isDev });
    if (data.startsWith('individual_property_')) return await onPropertySelected({ callbackQuery, chatId, data, session, bot, isDev });
    if (data.startsWith('individual_category_')) return await onCategorySelected({ callbackQuery, chatId, data, session, bot, drive, botToken, isDev });
    if (data.startsWith('individual_year_')) return await onYearSelected({ callbackQuery, chatId, data, session, bot, drive, botToken, isDev });

    await bot.answerCallbackQuery(callbackQuery.id);
  });

  return {
    onFileReceived: async (msg, fileInfo) => await beginUploadWizard({ msg, fileInfo, bot, drive, baseFolderId }),
    onTextMessage: async (msg) => await onTextMessage({ msg, bot, drive, botToken }),
  };
}

// ─── Paso 1: Inicio ──────────────────────────────────────────────────────────

async function beginUploadWizard({ msg, fileInfo, bot, drive, baseFolderId }) {
  const chatId = msg.chat.id;
  const isDev = process.env.NODE_ENV === 'development';
  const prefix = isDev ? 'DEV:: ' : '';

  try {
    const result = await listProperties({ drive, baseFolderId });

    if (result.message) {
      await bot.sendMessage(chatId, `${prefix}${result.message}`);
      return;
    }

    const { properties } = result;
    startIndividualUploadSession(chatId, fileInfo);
    updateIndividualUploadSessionState(chatId, 'waiting_for_property', { properties });

    const buttons = properties.map((p, idx) => [
      { text: p.address, callback_data: `individual_property_${idx}` },
    ]);
    buttons.push([{ text: '❌ Cancelar', callback_data: 'individual_cancel' }]);

    await bot.sendMessage(chatId, `${prefix}¿A qué vivienda pertenece?`, {
      reply_markup: { inline_keyboard: buttons },
    });
  } catch (err) {
    console.error('Error iniciando subida individual:', err);
    await bot.sendMessage(chatId, `${prefix}❌ Error al listar viviendas. Revisa los logs.`);
  }
}

// ─── Paso 2: Selección de vivienda ───────────────────────────────────────────

async function onPropertySelected({ callbackQuery, chatId, data, session, bot, isDev }) {
  const propertyIndex = parseInt(data.replace('individual_property_', ''), 10);
  const selectedProperty = session.properties[propertyIndex];

  updateIndividualUploadSessionState(chatId, 'waiting_for_category', { selectedProperty });

  const categoryButtons = [
    ...buildCategoryButtons('individual_category_'),
    [{ text: '❌ Cancelar', callback_data: 'individual_cancel' }],
  ];

  await bot.answerCallbackQuery(callbackQuery.id);
  await bot.sendMessage(chatId, `${isDev ? 'DEV:: ' : ''}¿En qué categoría?`, {
    reply_markup: { inline_keyboard: categoryButtons },
  });
}

// ─── Paso 3: Selección de categoría ──────────────────────────────────────────

async function onCategorySelected({ callbackQuery, chatId, data, session, bot, drive, botToken, isDev }) {
  const category = data.replace('individual_category_', '');
  const mapping = CATEGORY_FOLDER_MAPPING[category];

  await bot.answerCallbackQuery(callbackQuery.id);

  if (mapping && !mapping.requiresYear) {
    updateIndividualUploadSessionState(chatId, 'waiting_for_filename', { category, year: null });
    const updatedSession = getIndividualUploadSession(chatId);

    if (needsUserProvidedName(session.fileInfo.originalName)) {
      await bot.sendMessage(
        chatId,
        `${isDev ? 'DEV:: ' : ''}¿Qué nombre quieres darle al archivo?\n\nEnvía el nombre (sin extensión) o "skip" para usar nombre automático:`
      );
    } else {
      await uploadFileToDrive({ bot, drive, botToken, chatId, session: updatedSession, fileName: session.fileInfo.originalName, isDev });
    }
    return;
  }

  updateIndividualUploadSessionState(chatId, 'waiting_for_year', { category });

  const currentYear = getCurrentYear();
  const previousYear = getPreviousYear();
  const yearButtons = [
    [{ text: `${currentYear} ✅`, callback_data: `individual_year_${currentYear}` }],
    [{ text: previousYear, callback_data: `individual_year_${previousYear}` }],
    [{ text: 'Otro año', callback_data: 'individual_year_custom' }],
    [{ text: '❌ Cancelar', callback_data: 'individual_cancel' }],
  ];

  await bot.sendMessage(chatId, `${isDev ? 'DEV:: ' : ''}¿Año?`, {
    reply_markup: { inline_keyboard: yearButtons },
  });
}

// ─── Paso 4: Selección de año ─────────────────────────────────────────────────

async function onYearSelected({ callbackQuery, chatId, data, session, bot, drive, botToken, isDev }) {
  const yearValue = data.replace('individual_year_', '');
  const prefix = isDev ? 'DEV:: ' : '';

  if (yearValue === 'custom') {
    updateIndividualUploadSessionState(chatId, 'waiting_for_custom_year');
    await bot.answerCallbackQuery(callbackQuery.id);
    await bot.sendMessage(chatId, `${prefix}Envía el año en formato YYYY (ej. 2025):`);
    return;
  }

  updateIndividualUploadSessionState(chatId, 'waiting_for_filename', { year: yearValue });
  await bot.answerCallbackQuery(callbackQuery.id);

  if (needsUserProvidedName(session.fileInfo.originalName)) {
    await bot.sendMessage(chatId, `${prefix}¿Qué nombre quieres darle al archivo?\n\nEnvía el nombre (sin extensión) o "skip" para usar nombre automático:`);
  } else {
    await uploadFileToDrive({ bot, drive, botToken, chatId, session, fileName: session.fileInfo.originalName, isDev });
  }
}

async function onCustomYearReceived({ msg, chatId, session, bot, drive, botToken, isDev }) {
  const yearText = msg.text?.trim();
  const prefix = isDev ? 'DEV:: ' : '';
  const yearPattern = /^\d{4}$/;

  if (!yearPattern.test(yearText)) {
    await bot.sendMessage(chatId, `${prefix}⚠️ Año inválido. Envía un año en formato YYYY:`);
    return true;
  }

  updateIndividualUploadSessionState(chatId, 'waiting_for_filename', { year: yearText });

  if (needsUserProvidedName(session.fileInfo.originalName)) {
    await bot.sendMessage(chatId, `${prefix}¿Qué nombre quieres darle al archivo?\n\nEnvía el nombre (sin extensión) o "skip" para usar nombre automático:`);
  } else {
    await uploadFileToDrive({ bot, drive, botToken, chatId, session, fileName: session.fileInfo.originalName, isDev });
  }
  return true;
}

// ─── Paso 5: Nombre de archivo ────────────────────────────────────────────────

async function onFilenameReceived({ msg, chatId, session, bot, drive, botToken, isDev }) {
  const text = msg.text?.trim();
  const prefix = isDev ? 'DEV:: ' : '';

  if (!text) {
    await bot.sendMessage(chatId, `${prefix}⚠️ Envía un nombre válido o "skip":`);
    return true;
  }

  const fileExtension = session.fileInfo.mimeType.startsWith('image/') ? '.jpg'
    : session.fileInfo.mimeType.startsWith('video/') ? '.mp4' : '';

  const fileName = text.toLowerCase() === 'skip'
    ? session.fileInfo.originalName
    : applySnakeCaseToFileName(text) + fileExtension;

  await uploadFileToDrive({ bot, drive, botToken, chatId, session, fileName, isDev });
  return true;
}

// ─── Dispatch de mensajes de texto libre ─────────────────────────────────────

async function onTextMessage({ msg, bot, drive, botToken }) {
  const chatId = msg.chat.id;
  const isDev = process.env.NODE_ENV === 'development';
  const session = getIndividualUploadSession(chatId);

  if (!session) return false;

  if (session.state === 'waiting_for_filename') return await onFilenameReceived({ msg, chatId, session, bot, drive, botToken, isDev });
  if (session.state === 'waiting_for_custom_year') return await onCustomYearReceived({ msg, chatId, session, bot, drive, botToken, isDev });

  return false;
}

// ─── Ejecución de la subida ───────────────────────────────────────────────────

async function uploadFileToDrive({ bot, drive, botToken, chatId, session, fileName, isDev }) {
  const prefix = isDev ? 'DEV:: ' : '';

  try {
    await bot.sendMessage(chatId, `${prefix}⏳ Subiendo archivo...`);

    const buffer = await downloadTelegramFile(bot, botToken, session.fileInfo.fileId);
    const categoryPath = getCategoryFolderPath(session.category, session.year);
    const targetFolderId = await resolveCategoryFolderId({
      drive,
      propertyFolderId: session.selectedProperty.propertyFolderId,
      categoryPath,
    });

    const finalFileName = applySnakeCaseToFileName(fileName);

    await uploadBufferToDrive({
      drive,
      buffer,
      fileName: finalFileName,
      mimeType: session.fileInfo.mimeType,
      folderId: targetFolderId,
    });

    clearIndividualUploadSession(chatId);
    await bot.sendMessage(
      chatId,
      `${prefix}✅ Archivo "${finalFileName}" subido correctamente en:\n📍 ${session.selectedProperty.address}\n📂 ${session.category}\n📅 ${session.year || 'N/A'}`
    );
  } catch (err) {
    console.error('Error ejecutando subida individual:', err);
    clearIndividualUploadSession(chatId);
    await bot.sendMessage(chatId, `${prefix}❌ Error al subir el archivo. Revisa los logs.`);
  }
}

// ─── Cancelación ─────────────────────────────────────────────────────────────

async function onCancelled({ callbackQuery, chatId, bot, isDev }) {
  clearIndividualUploadSession(chatId);
  await bot.answerCallbackQuery(callbackQuery.id);
  await bot.sendMessage(chatId, `${isDev ? 'DEV:: ' : ''}❌ Operación cancelada.`);
}
