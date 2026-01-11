import { DOCUMENT_CATEGORIES } from '../domain/DocumentCategory.js';
import { getCurrentYear, validateYear } from '../domain/Year.js';
import { BulkFile } from '../domain/BulkFile.js';
import {
  startBulkSession,
  getBulkSession,
  addFileToBulkSession,
  updateBulkSessionState,
  clearBulkSession,
} from '../repositories/bulkSessionRepository.js';
import { extractBulkFileInfo } from '../adapters/telegramFileAdapter.js';
import { uploadBulkFiles, checkDuplicateFiles } from '../services/bulkUploadService.js';
import { listProperties } from '../services/propertyService.js';
import { renameFilesForUpload, needsUserProvidedName } from '../utils/fileNaming.js';

export function initializeBulkUploadHandlers({ bot, drive, baseFolderId, botToken, defaultCommands, bulkModeCommands }) {
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

  bot.onText(/\/bulk$/, async (msg) => {
    const chatId = msg.chat.id;
    const isDev = process.env.NODE_ENV === 'development';

    startBulkSession(chatId);
    updateBulkSessionState(chatId, 'collecting_files', { defaultCommands });

    if (bulkModeCommands) {
      await bot.setMyCommands(bulkModeCommands, {
        scope: { type: 'chat', chat_id: chatId },
      });
    }

    await bot.sendMessage(
      chatId,
      `${isDev ? 'DEV:: ' : ''}📦 Modo bulk activado.
Envía ahora varios documentos, fotos o videos.
Cuando termines, escribe /bulk_done.
Para cancelar: /cancel.`
    );
  });

  bot.onText(/\/bulk_done/, async (msg) => {
    const chatId = msg.chat.id;
    const isDev = process.env.NODE_ENV === 'development';

    const session = getBulkSession(chatId);

    if (!session) {
      await bot.sendMessage(
        chatId,
        `${isDev ? 'DEV:: ' : ''}⚠️ No hay sesión bulk activa. Usa /bulk para iniciar.`
      );
      return;
    }

    if (session.files.length === 0) {
      await bot.sendMessage(
        chatId,
        `${isDev ? 'DEV:: ' : ''}⚠️ No has enviado ningún archivo. Envía documentos o fotos primero.`
      );
      return;
    }

    try {
      const result = await listProperties({ drive, baseFolderId });

      if (result.message) {
        const session = getBulkSession(chatId);
        clearBulkSession(chatId);
        if (session?.defaultCommands) {
          await bot.setMyCommands(session.defaultCommands, {
            scope: { type: 'chat', chat_id: chatId },
          });
        }
        await bot.sendMessage(chatId, `${isDev ? 'DEV:: ' : ''}${result.message}`);
        return;
      }

      const properties = result.properties;
      updateBulkSessionState(chatId, 'waiting_for_property', { properties });

      const buttons = properties.map((p, idx) => [
        { text: p.address, callback_data: `bulk_property_${idx}` },
      ]);
      buttons.push([{ text: '❌ Cancelar', callback_data: 'bulk_cancel' }]);

      await bot.sendMessage(chatId, `${isDev ? 'DEV:: ' : ''}¿A qué vivienda pertenecen?`, {
        reply_markup: { inline_keyboard: buttons },
      });
    } catch (err) {
      console.error('Error en bulk_done:', err);
      await bot.sendMessage(
        chatId,
        `${isDev ? 'DEV:: ' : ''}❌ Error al listar viviendas. Revisa los logs.`
      );
    }
  });

  bot.on('callback_query', async (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const data = callbackQuery.data;
    const isDev = process.env.NODE_ENV === 'development';

    const session = getBulkSession(chatId);

    if (!session) {
      await bot.answerCallbackQuery(callbackQuery.id);
      return;
    }

    if (data === 'bulk_cancel') {
      clearBulkSession(chatId);
      if (defaultCommands) {
        await bot.setMyCommands(defaultCommands, {
          scope: { type: 'chat', chat_id: chatId },
        });
      }
      await bot.answerCallbackQuery(callbackQuery.id);
      await bot.sendMessage(chatId, `${isDev ? 'DEV:: ' : ''}❌ Operación cancelada.`);
      return;
    }

    if (data.startsWith('bulk_property_')) {
      const propertyIndex = parseInt(data.replace('bulk_property_', ''), 10);
      const selectedProperty = session.properties[propertyIndex];

      updateBulkSessionState(chatId, 'waiting_for_category', {
        selectedProperty,
      });

      const categoryButtons = [
        [{ text: 'Contratos', callback_data: 'bulk_category_Contratos' }],
        [{ text: 'Inquilinos (Sensible)', callback_data: 'bulk_category_Inquilinos_Sensible' }],
        [{ text: 'Seguros', callback_data: 'bulk_category_Seguros' }],
        [{ text: 'Suministros', callback_data: 'bulk_category_Suministros' }],
        [{ text: 'Comunidad/Impuestos', callback_data: 'bulk_category_Comunidad_Impuestos' }],
        [{ text: 'Facturas/Reformas', callback_data: 'bulk_category_Facturas_Reformas' }],
        [{ text: 'Fotos Estado', callback_data: 'bulk_category_Fotos_Estado' }],
        [{ text: 'Otros', callback_data: 'bulk_category_Otros' }],
        [{ text: '❌ Cancelar', callback_data: 'bulk_cancel' }],
      ];

      await bot.answerCallbackQuery(callbackQuery.id);
      await bot.sendMessage(chatId, `${isDev ? 'DEV:: ' : ''}¿En qué categoría?`, {
        reply_markup: { inline_keyboard: categoryButtons },
      });
      return;
    }

    if (data.startsWith('bulk_category_')) {
      const category = data.replace('bulk_category_', '');

      updateBulkSessionState(chatId, 'waiting_for_year', { category });

      const currentYear = getCurrentYear();
      const yearButtons = [
        [{ text: `${currentYear} ✅`, callback_data: `bulk_year_${currentYear}` }],
        [{ text: 'Otro año', callback_data: 'bulk_year_custom' }],
        [{ text: '❌ Cancelar', callback_data: 'bulk_cancel' }],
      ];

      await bot.answerCallbackQuery(callbackQuery.id);
      await bot.sendMessage(chatId, `${isDev ? 'DEV:: ' : ''}¿Año?`, {
        reply_markup: { inline_keyboard: yearButtons },
      });
      return;
    }

    if (data.startsWith('bulk_year_')) {
      const yearValue = data.replace('bulk_year_', '');

      if (yearValue === 'custom') {
        updateBulkSessionState(chatId, 'waiting_for_custom_year');
        await bot.answerCallbackQuery(callbackQuery.id);
        await bot.sendMessage(chatId, `${isDev ? 'DEV:: ' : ''}Envía el año en formato YYYY (ej. 2025):`);
        return;
      }

      await checkIfNeedBaseNameAndConfirm(bot, chatId, session, yearValue, isDev);
      await bot.answerCallbackQuery(callbackQuery.id);
      return;
    }

    if (data === 'bulk_confirm') {
      await bot.answerCallbackQuery(callbackQuery.id);
      updateBulkSessionState(chatId, 'checking_duplicates', { botToken });
      await checkAndConfirmBulkUpload({
        bot,
        drive,
        chatId,
        session,
        isDev,
      });
      return;
    }

    if (data === 'bulk_confirm_replace') {
      await bot.answerCallbackQuery(callbackQuery.id);
      await executeBulkUpload({
        bot,
        drive,
        botToken,
        chatId,
        session,
        isDev,
      });
      return;
    }

    await bot.answerCallbackQuery(callbackQuery.id);
  });

  return {
    handleBulkMessage: async (msg) => {
      const chatId = msg.chat.id;
      const isDev = process.env.NODE_ENV === 'development';

      if (msg.text === '/bulk' || msg.text === '/bulk_done') {
        return true;
      }

      const session = getBulkSession(chatId);

      if (!session) {
        return false;
      }

      if (session.state === 'collecting_files') {
        const fileInfo = extractBulkFileInfo(msg);

        if (!fileInfo) {
          await bot.sendMessage(
            chatId,
            `${isDev ? 'DEV:: ' : ''}⚠️ Solo envía documentos, fotos o videos durante el modo bulk.`
          );
          return true;
        }

        const bulkFile = new BulkFile(fileInfo);
        addFileToBulkSession(chatId, bulkFile);

        await bot.sendMessage(
          chatId,
          `${isDev ? 'DEV:: ' : ''}➕ Añadido (${session.files.length} archivo${session.files.length > 1 ? 's' : ''} en cola)`
        );
        return true;
      }

      if (session.state === 'waiting_for_custom_year') {
        const yearText = msg.text?.trim();
        const validation = validateYear(yearText);

        if (!validation.valid) {
          await bot.sendMessage(
            chatId,
            `${isDev ? 'DEV:: ' : ''}⚠️ ${validation.error}. Envía un año válido en formato YYYY:`
          );
          return true;
        }

        await checkIfNeedBaseNameAndConfirm(bot, chatId, session, yearText, isDev);
        return true;
      }

      if (session.state === 'waiting_for_basename') {
        const baseName = msg.text?.trim();

        if (!baseName) {
          await bot.sendMessage(
            chatId,
            `${isDev ? 'DEV:: ' : ''}⚠️ Envía un nombre válido o "skip" para usar nombres automáticos:`
          );
          return true;
        }

        if (baseName.toLowerCase() === 'skip') {
          updateBulkSessionState(chatId, 'waiting_for_confirmation', { baseName: null });
        } else {
          updateBulkSessionState(chatId, 'waiting_for_confirmation', { baseName });
        }

        await confirmBulkUpload(bot, chatId, session, session.year, isDev);
        return true;
      }

      return false;
    },
  };
}

async function checkIfNeedBaseNameAndConfirm(bot, chatId, session, year, isDev) {
  const filesWithoutName = session.files.filter(f => needsUserProvidedName(f.fileName));

  if (filesWithoutName.length > 0) {
    updateBulkSessionState(chatId, 'waiting_for_basename', { year });
    await bot.sendMessage(
      chatId,
      `${isDev ? 'DEV:: ' : ''}📸 Tienes ${filesWithoutName.length} foto${filesWithoutName.length > 1 ? 's' : ''}/video${filesWithoutName.length > 1 ? 's' : ''} sin nombre.\n\n¿Qué nombre base quieres usar?\n(Se numerarán automáticamente: nombre_1, nombre_2, etc.)\n\nEnvía el nombre o "skip" para usar nombres automáticos:`
    );
  } else {
    updateBulkSessionState(chatId, 'waiting_for_confirmation', { year });
    await confirmBulkUpload(bot, chatId, session, year, isDev);
  }
}

async function confirmBulkUpload(bot, chatId, session, year, isDev) {
  const fileCount = session.files.length;
  let message = `${isDev ? 'DEV:: ' : ''}Vas a guardar ${fileCount} archivo${fileCount > 1 ? 's' : ''} en:

📍 Vivienda: ${session.selectedProperty.address}
📂 Categoría: ${session.category}
📅 Año: ${year || 'N/A'}`;

  if (session.baseName) {
    const filesWithoutName = session.files.filter(f => needsUserProvidedName(f.fileName));
    message += `\n📝 Nombre base: ${session.baseName} (${filesWithoutName.length} archivo${filesWithoutName.length > 1 ? 's' : ''})`;
  }

  message += '\n\n¿Confirmar?';

  const buttons = [
    [{ text: '✅ Confirmar', callback_data: 'bulk_confirm' }],
    [{ text: '❌ Cancelar', callback_data: 'bulk_cancel' }],
  ];

  await bot.sendMessage(chatId, message, {
    reply_markup: { inline_keyboard: buttons },
  });
}

async function checkAndConfirmBulkUpload({ bot, drive, chatId, session, isDev }) {
  try {
    const filesWithNames = renameFilesForUpload(session.files, session.baseName);

    const duplicates = await checkDuplicateFiles({
      drive,
      files: filesWithNames,
      propertyFolderId: session.selectedProperty.propertyFolderId,
      category: session.category,
      year: session.year,
    });

    if (duplicates.length > 0) {
      const duplicateList = duplicates.map(name => `• ${name}`).join('\n');
      const message = `${isDev ? 'DEV:: ' : ''}⚠️ Los siguientes archivos ya existen en la carpeta destino:\n\n${duplicateList}\n\n¿Quieres reemplazarlos?`;

      const buttons = [
        [{ text: '✅ Sí, reemplazar', callback_data: 'bulk_confirm_replace' }],
        [{ text: '❌ No, cancelar', callback_data: 'bulk_cancel' }],
      ];

      await bot.sendMessage(chatId, message, {
        reply_markup: { inline_keyboard: buttons },
      });
    } else {
      await executeBulkUpload({ bot, drive, botToken: session.botToken, chatId, session, isDev });
    }
  } catch (err) {
    console.error('Error verificando duplicados:', err);
    await bot.sendMessage(
      chatId,
      `${isDev ? 'DEV:: ' : ''}❌ Error al verificar duplicados. Revisa los logs.`
    );
  }
}

async function executeBulkUpload({ bot, drive, botToken, chatId, session, isDev }) {
  try {
    await bot.sendMessage(chatId, `${isDev ? 'DEV:: ' : ''}⏳ Subiendo archivos...`);

    const filesWithNames = renameFilesForUpload(session.files, session.baseName);

    const results = await uploadBulkFiles({
      drive,
      bot,
      botToken,
      files: filesWithNames,
      propertyFolderId: session.selectedProperty.propertyFolderId,
      category: session.category,
      year: session.year,
    });

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    let message = `${isDev ? 'DEV:: ' : ''}✅ Subidos ${successCount} archivo${successCount > 1 ? 's' : ''}`;

    if (failCount > 0) {
      const failedFiles = results
        .filter((r) => !r.success)
        .map((r) => `• ${r.fileName}: ${r.error}`)
        .join('\n');

      message += `\n\n⚠️ Fallaron ${failCount} archivo${failCount > 1 ? 's' : ''}:\n${failedFiles}`;
    }

    clearBulkSession(chatId);
    if (session.defaultCommands) {
      await bot.setMyCommands(session.defaultCommands, {
        scope: { type: 'chat', chat_id: chatId },
      });
    }
    await bot.sendMessage(chatId, message);
  } catch (err) {
    console.error('Error ejecutando bulk upload:', err);
    clearBulkSession(chatId);
    if (session?.defaultCommands) {
      await bot.setMyCommands(session.defaultCommands, {
        scope: { type: 'chat', chat_id: chatId },
      });
    }
    await bot.sendMessage(
      chatId,
      `${isDev ? 'DEV:: ' : ''}❌ Error al subir archivos. Revisa los logs.`
    );
  }
}

