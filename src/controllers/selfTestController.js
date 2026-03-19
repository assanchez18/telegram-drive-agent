import { executeSelfTest } from '../services/selfTestService.js';
import { startSelfTestSession, getSelfTestSession, endSelfTestSession } from '../repositories/selfTestSessionRepository.js';

const userStates = new Map();

/**
 * Formatea el reporte del self-test para el usuario
 */
function formatSelfTestReport(report) {
  const isDev = process.env.NODE_ENV === 'development';
  let message = `${isDev ? 'DEV:: ' : ''}🔍 **Self-Test Completo**\n\n`;

  for (const step of report.steps) {
    const statusIcon = step.status === 'success' ? '✅' : step.status === 'failed' ? '❌' : '⏳';
    message += `Paso ${step.step}/${step.total}: ${step.name}\n`;
    message += `${statusIcon} ${step.status === 'success' ? 'OK' : step.status === 'failed' ? `FAIL: ${step.error}` : 'Running...'}\n`;

    if (step.result) {
      message += `   ${step.result}\n`;
    }

    message += '\n';
  }

  if (report.success) {
    message += '✅ **Self-Test exitoso - Todos los sistemas funcionando correctamente**';
  } else {
    message += `❌ **Self-Test fallido**\n\n`;
    message += `Error: ${report.error}\n\n`;

    if (report.cleanupPerformed) {
      message += '🧹 Cleanup realizado (propiedad de prueba eliminada)\n';
    } else if (report.cleanupFailed) {
      message += `⚠️ Cleanup falló: ${report.cleanupError}\n`;
      message += `   Propiedad de prueba: "${report.testPropertyAddress}"\n`;
      message += `   Elimínala manualmente si es necesario.\n`;
    }
  }

  return message;
}

export function initializeSelfTestHandlers({ bot, drive, baseFolderId }) {
  // Comando /self_test
  bot.onText(/\/self_test/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const isDev = process.env.NODE_ENV === 'development';

    // Verificar si ya hay una sesión activa
    const existingSession = getSelfTestSession(chatId);
    if (existingSession) {
      await bot.sendMessage(
        chatId,
        `${isDev ? 'DEV:: ' : ''}⚠️ Ya hay un self-test en ejecución. Espera a que termine.`
      );
      return;
    }

    // Guardar estado de confirmación
    userStates.set(userId, {
      state: 'await_confirm',
      chatId,
    });

    // Solicitar confirmación con inline keyboard
    await bot.sendMessage(
      chatId,
      `${isDev ? 'DEV:: ' : ''}🔍 **Self-Test del Sistema**\n\n` +
      `Este comando ejecutará un test end-to-end que:\n` +
      `1. Verificará el listado de propiedades\n` +
      `2. Creará una propiedad de prueba\n` +
      `3. Verificará la estructura de carpetas\n` +
      `4. Subirá archivos de prueba\n` +
      `5. Archivará la propiedad\n` +
      `6. Reactivará la propiedad\n` +
      `7. Eliminará la propiedad de prueba\n\n` +
      `⏱️ Duración estimada: 30-60 segundos\n\n` +
      `¿Confirmas ejecutar el self-test?`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '✅ Confirmar', callback_data: 'selftest_confirm' },
              { text: '❌ Cancelar', callback_data: 'selftest_cancel' },
            ],
          ],
        },
      }
    );
  });

  // Callback query para confirmación
  bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const userId = query.from.id;
    const data = query.data;
    const isDev = process.env.NODE_ENV === 'development';

    const userState = userStates.get(userId);

    if (!userState || userState.state !== 'await_confirm') {
      // No es para nosotros o estado inválido
      return;
    }

    if (data === 'selftest_cancel') {
      userStates.delete(userId);
      await bot.answerCallbackQuery(query.id);
      await bot.editMessageText(
        `${isDev ? 'DEV:: ' : ''}❌ Self-test cancelado.`,
        {
          chat_id: chatId,
          message_id: query.message.message_id,
        }
      );
      return;
    }

    if (data === 'selftest_confirm') {
      await bot.answerCallbackQuery(query.id);

      // Intentar iniciar sesión (prevenir concurrencia)
      if (!startSelfTestSession(chatId)) {
        userStates.delete(userId);
        await bot.editMessageText(
          `${isDev ? 'DEV:: ' : ''}⚠️ Ya hay un self-test en ejecución. Espera a que termine.`,
          {
            chat_id: chatId,
            message_id: query.message.message_id,
          }
        );
        return;
      }

      userStates.delete(userId);

      // Notificar inicio
      await bot.editMessageText(
        `${isDev ? 'DEV:: ' : ''}🔍 Ejecutando self-test...\n\n` +
        `⏳ Por favor espera mientras se completan todos los pasos.`,
        {
          chat_id: chatId,
          message_id: query.message.message_id,
        }
      );

      try {
        // Ejecutar self-test
        const report = await executeSelfTest({ drive, baseFolderId });

        // Enviar reporte
        const reportMessage = formatSelfTestReport(report);
        await bot.sendMessage(chatId, reportMessage, { parse_mode: 'Markdown' });
      } catch (error) {
        console.error('Error ejecutando self-test:', error);
        await bot.sendMessage(
          chatId,
          `${isDev ? 'DEV:: ' : ''}❌ Error ejecutando self-test: ${error.message}`
        );
      } finally {
        // Siempre terminar la sesión
        endSelfTestSession(chatId);
      }
    }
  });

  return {
    // No necesitamos handleTextMessage para self-test
  };
}
