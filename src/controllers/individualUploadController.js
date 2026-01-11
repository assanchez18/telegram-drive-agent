import { DOCUMENT_CATEGORIES, getCategoryFolderPath } from '../domain/DocumentCategory.js';
import { getCurrentYear } from '../domain/Year.js';
import {
  startIndividualUploadSession,
  getIndividualUploadSession,
  updateIndividualUploadSessionState,
  clearIndividualUploadSession,
} from '../repositories/individualUploadSessionRepository.js';
import { listProperties } from '../services/propertyService.js';
import { downloadTelegramFile } from '../adapters/telegramFileAdapter.js';
import { uploadBufferToDrive, resolveCategoryFolderId } from '../adapters/driveAdapter.js';

export function initializeIndividualUploadHandlers({ bot, drive, baseFolderId, botToken }) {
  if (!bot) {
    throw new Error('Bot is required');
  }
  if (!drive) {
    throw new Error('Drive client is required');
  }
  if (!baseFolderId) {
    throw new Error('Base folder ID is required');
  }
  if (!botToken) {
    throw new Error('Bot token is required');
  }

  bot.on('callback_query', async (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const data = callbackQuery.data;
    const isDev = process.env.NODE_ENV === 'development';

    const session = getIndividualUploadSession(chatId);

    if (!session) {
      return;
    }

    if (data === 'individual_cancel') {
      clearIndividualUploadSession(chatId);
      await bot.answerCallbackQuery(callbackQuery.id);
      await bot.sendMessage(chatId, `${isDev ? 'DEV:: ' : ''}❌ Operación cancelada.`);
      return;
    }

    if (data.startsWith('individual_property_')) {
      const propertyIndex = parseInt(data.replace('individual_property_', ''), 10);
      const selectedProperty = session.properties[propertyIndex];

      updateIndividualUploadSessionState(chatId, 'waiting_for_category', {
        selectedProperty,
      });

      const categoryButtons = [
        [{ text: 'Contratos', callback_data: 'individual_category_Contratos' }],
        [{ text: 'Inquilinos (Sensible)', callback_data: 'individual_category_Inquilinos_Sensible' }],
        [{ text: 'Seguros', callback_data: 'individual_category_Seguros' }],
        [{ text: 'Suministros', callback_data: 'individual_category_Suministros' }],
        [{ text: 'Comunidad/Impuestos', callback_data: 'individual_category_Comunidad_Impuestos' }],
        [{ text: 'Facturas/Reformas', callback_data: 'individual_category_Facturas_Reformas' }],
        [{ text: 'Fotos Estado', callback_data: 'individual_category_Fotos_Estado' }],
        [{ text: 'Otros', callback_data: 'individual_category_Otros' }],
        [{ text: '❌ Cancelar', callback_data: 'individual_cancel' }],
      ];

      await bot.answerCallbackQuery(callbackQuery.id);
      await bot.sendMessage(chatId, `${isDev ? 'DEV:: ' : ''}¿En qué categoría?`, {
        reply_markup: { inline_keyboard: categoryButtons },
      });
      return;
    }

    if (data.startsWith('individual_category_')) {
      const category = data.replace('individual_category_', '');

      updateIndividualUploadSessionState(chatId, 'waiting_for_year', { category });

      const currentYear = getCurrentYear();
      const yearButtons = [
        [{ text: `${currentYear} ✅`, callback_data: `individual_year_${currentYear}` }],
        [{ text: 'Otro año', callback_data: 'individual_year_custom' }],
        [{ text: '❌ Cancelar', callback_data: 'individual_cancel' }],
      ];

      await bot.answerCallbackQuery(callbackQuery.id);
      await bot.sendMessage(chatId, `${isDev ? 'DEV:: ' : ''}¿Año?`, {
        reply_markup: { inline_keyboard: yearButtons },
      });
      return;
    }

    if (data.startsWith('individual_year_')) {
      const yearValue = data.replace('individual_year_', '');

      if (yearValue === 'custom') {
        updateIndividualUploadSessionState(chatId, 'waiting_for_custom_year');
        await bot.answerCallbackQuery(callbackQuery.id);
        await bot.sendMessage(chatId, `${isDev ? 'DEV:: ' : ''}Envía el año en formato YYYY (ej. 2025):`);
        return;
      }

      updateIndividualUploadSessionState(chatId, 'waiting_for_filename', { year: yearValue });
      await bot.answerCallbackQuery(callbackQuery.id);

      if (!session.fileInfo.originalName || session.fileInfo.originalName === 'foto.jpg' || session.fileInfo.originalName === 'video.mp4') {
        await bot.sendMessage(
          chatId,
          `${isDev ? 'DEV:: ' : ''}¿Qué nombre quieres darle al archivo?\n\nEnvía el nombre (sin extensión) o "skip" para usar nombre automático:`
        );
      } else {
        await executeIndividualUpload({ bot, drive, botToken, chatId, session, fileName: session.fileInfo.originalName, isDev });
      }
      return;
    }

    await bot.answerCallbackQuery(callbackQuery.id);
  });

  return {
    startIndividualUpload: async (msg, fileInfo) => {
      const chatId = msg.chat.id;
      const isDev = process.env.NODE_ENV === 'development';

      try {
        const result = await listProperties({ drive, baseFolderId });

        if (result.message) {
          await bot.sendMessage(chatId, `${isDev ? 'DEV:: ' : ''}${result.message}`);
          return;
        }

        const properties = result.properties;
        startIndividualUploadSession(chatId, fileInfo);
        updateIndividualUploadSessionState(chatId, 'waiting_for_property', { properties });

        const buttons = properties.map((p, idx) => [
          { text: p.address, callback_data: `individual_property_${idx}` },
        ]);
        buttons.push([{ text: '❌ Cancelar', callback_data: 'individual_cancel' }]);

        await bot.sendMessage(chatId, `${isDev ? 'DEV:: ' : ''}¿A qué vivienda pertenece?`, {
          reply_markup: { inline_keyboard: buttons },
        });
      } catch (err) {
        console.error('Error iniciando subida individual:', err);
        await bot.sendMessage(
          chatId,
          `${isDev ? 'DEV:: ' : ''}❌ Error al listar viviendas. Revisa los logs.`
        );
      }
    },

    handleIndividualUploadMessage: async (msg) => {
      const chatId = msg.chat.id;
      const isDev = process.env.NODE_ENV === 'development';

      const session = getIndividualUploadSession(chatId);

      if (!session) {
        return false;
      }

      if (session.state === 'waiting_for_filename') {
        const text = msg.text?.trim();
        
        if (!text) {
          await bot.sendMessage(
            chatId,
            `${isDev ? 'DEV:: ' : ''}⚠️ Envía un nombre válido o "skip":`
          );
          return true;
        }

        const fileExtension = session.fileInfo.mimeType.startsWith('image/') ? '.jpg' : 
                             session.fileInfo.mimeType.startsWith('video/') ? '.mp4' : '';
        let fileName;
        
        if (text.toLowerCase() === 'skip') {
          fileName = session.fileInfo.originalName;
        } else {
          const snakeName = toSnakeCase(text);
          fileName = snakeName + fileExtension;
        }

        await executeIndividualUpload({ bot, drive, botToken, chatId, session, fileName, isDev });
        return true;
      }

      if (session.state === 'waiting_for_custom_year') {
        const yearText = msg.text?.trim();
        const yearPattern = /^\d{4}$/;
        
        if (!yearPattern.test(yearText)) {
          await bot.sendMessage(
            chatId,
            `${isDev ? 'DEV:: ' : ''}⚠️ Año inválido. Envía un año en formato YYYY:`
          );
          return true;
        }

        updateIndividualUploadSessionState(chatId, 'waiting_for_filename', { year: yearText });

        if (!session.fileInfo.originalName || session.fileInfo.originalName === 'foto.jpg' || session.fileInfo.originalName === 'video.mp4') {
          await bot.sendMessage(
            chatId,
            `${isDev ? 'DEV:: ' : ''}¿Qué nombre quieres darle al archivo?\n\nEnvía el nombre (sin extensión) o "skip" para usar nombre automático:`
          );
        } else {
          await executeIndividualUpload({ bot, drive, botToken, chatId, session, fileName: session.fileInfo.originalName, isDev });
        }
        return true;
      }

      return false;
    },
  };
}

function toSnakeCase(str) {
  return str
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^\wñáéíóúü]/gu, '')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

async function executeIndividualUpload({ bot, drive, botToken, chatId, session, fileName, isDev }) {
  try {
    await bot.sendMessage(chatId, `${isDev ? 'DEV:: ' : ''}⏳ Subiendo archivo...`);

    const buffer = await downloadTelegramFile(bot, botToken, session.fileInfo.fileId);

    const categoryPath = getCategoryFolderPath(session.category, session.year);
    const targetFolderId = await resolveCategoryFolderId({
      drive,
      propertyFolderId: session.selectedProperty.propertyFolderId,
      categoryPath,
    });

    const lastDotIndex = fileName.lastIndexOf('.');
    const nameWithoutExt = lastDotIndex > 0 ? fileName.substring(0, lastDotIndex) : fileName;
    const extension = lastDotIndex > 0 ? fileName.substring(lastDotIndex) : '';
    const finalFileName = toSnakeCase(nameWithoutExt) + extension;

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
      `${isDev ? 'DEV:: ' : ''}✅ Archivo "${finalFileName}" subido correctamente en:\n📍 ${session.selectedProperty.address}\n📂 ${session.category}\n📅 ${session.year || 'N/A'}`
    );
  } catch (err) {
    console.error('Error ejecutando subida individual:', err);
    clearIndividualUploadSession(chatId);
    await bot.sendMessage(
      chatId,
      `${isDev ? 'DEV:: ' : ''}❌ Error al subir el archivo. Revisa los logs.`
    );
  }
}
