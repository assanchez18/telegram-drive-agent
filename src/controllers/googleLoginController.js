import { createAuthUrl, cancelSession, hasActiveSession } from '../services/googleReauthService.js';

export function initializeGoogleLoginHandlers({ bot, oauthClientJson, stateSecret, baseUrl, port }) {
  if (!oauthClientJson) {
    throw new Error('OAuth client JSON is required');
  }
  if (!stateSecret) {
    throw new Error('State secret is required');
  }

  /**
   * Callback query handler para los botones inline de google_login
   */
  bot.on('callback_query', async (callbackQuery) => {
    const { data, message, from } = callbackQuery;
    const chatId = message.chat.id;
    const userId = from.id;
    const isDev = process.env.NODE_ENV === 'development';

    // Solo procesar callbacks de google_login
    if (!data || !data.startsWith('google_login_')) {
      return;
    }

    if (data === 'google_login_cancel') {
      try {
        // Cancelar sesión si existe
        cancelSession(chatId);

        await bot.answerCallbackQuery(callbackQuery.id);
        await bot.editMessageText(
          `${isDev ? 'DEV:: ' : ''}❌ Autorización cancelada.`,
          {
            chat_id: chatId,
            message_id: message.message_id,
          }
        );
      } catch (err) {
        console.error('Error cancelando google_login:', err);
        await bot.answerCallbackQuery(callbackQuery.id, {
          text: 'Error cancelando',
          show_alert: true,
        });
      }
      return;
    }

    if (data === 'google_login_confirm') {
      try {
        // Verificar si ya hay una sesión activa
        if (hasActiveSession(chatId)) {
          await bot.answerCallbackQuery(callbackQuery.id, {
            text: 'Ya hay una sesión activa. Complétala o espera a que expire.',
            show_alert: true,
          });
          return;
        }

        // Crear URL de autorización
        const { url, expiresAt } = createAuthUrl({
          chatId,
          userId,
          oauthClientJson,
          stateSecret,
          baseUrl,
          port,
        });

        const expiresIn = Math.round((expiresAt - Date.now()) / 1000 / 60);

        await bot.answerCallbackQuery(callbackQuery.id);
        // IMPORTANTE: NO usar parse_mode aquí porque la URL OAuth contiene caracteres
        // como '_' (ej: select_account) que rompen el parsing de Markdown en Telegram
        await bot.editMessageText(
          `${isDev ? 'DEV:: ' : ''}🔗 Link de Autorización Generado

Abre este link en tu navegador para autorizar:

${url}

⏱️ Expira en ${expiresIn} minutos

Una vez autorizado, recibirás una confirmación aquí.`,
          {
            chat_id: chatId,
            message_id: message.message_id,
            disable_web_page_preview: true,
          }
        );
      } catch (err) {
        console.error('Error generando link de google_login:', err);
        await bot.answerCallbackQuery(callbackQuery.id, {
          text: `Error: ${err.message}`,
          show_alert: true,
        });

        try {
          await bot.editMessageText(
            `${isDev ? 'DEV:: ' : ''}❌ Error generando link: ${err.message}`,
            {
              chat_id: chatId,
              message_id: message.message_id,
            }
          );
        } catch (editErr) {
          console.error('Error editando mensaje:', editErr);
        }
      }
    }
  });
}
