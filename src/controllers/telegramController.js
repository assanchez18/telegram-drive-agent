import { addProperty, listProperties } from '../services/propertyService.js';

const userStates = new Map();

export function initializePropertyHandlers({ bot, drive, baseFolderId }) {
  if (!bot) {
    throw new Error('Bot is required');
  }
  if (!drive) {
    throw new Error('Drive client is required');
  }
  if (!baseFolderId) {
    throw new Error('Base folder ID is required');
  }

  bot.onText(/\/add_property/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const isDev = process.env.NODE_ENV === 'development';

    userStates.set(userId, { state: 'waiting_for_address' });
    await bot.sendMessage(chatId, `${isDev ? 'DEV:: ' : ''}📍 Por favor, envía la dirección de la vivienda.`);
  });

  bot.onText(/\/list_properties/, async (msg) => {
    const chatId = msg.chat.id;
    const isDev = process.env.NODE_ENV === 'development';

    try {
      const result = await listProperties({ drive, baseFolderId });

      if (result.message) {
        await bot.sendMessage(chatId, `${isDev ? 'DEV:: ' : ''}${result.message}`);
        return;
      }

      const list = result.properties
        .map((p, idx) => `${idx + 1}. ${p.address}`)
        .join('\n');

      await bot.sendMessage(
        chatId,
        `${isDev ? 'DEV:: ' : ''}📋 Viviendas registradas:\n\n${list}`
      );
    } catch (err) {
      console.error('Error listando viviendas:', err);
      await bot.sendMessage(
        chatId,
        `${isDev ? 'DEV:: ' : ''}❌ Error al listar viviendas. Revisa los logs.`
      );
    }
  });

  return {
    handleTextMessage: async (msg) => {
      const chatId = msg.chat.id;
      const userId = msg.from.id;
      const text = msg.text;
      const isDev = process.env.NODE_ENV === 'development';

      const userState = userStates.get(userId);

      if (!userState || userState.state !== 'waiting_for_address') {
        return false;
      }

      userStates.delete(userId);

      if (!text || text.trim() === '') {
        await bot.sendMessage(
          chatId,
          `${isDev ? 'DEV:: ' : ''}⚠️ La dirección no puede estar vacía.`
        );
        return true;
      }

      try {
        const result = await addProperty({
          drive,
          baseFolderId,
          address: text,
        });

        if (result.success) {
          await bot.sendMessage(chatId, `${isDev ? 'DEV:: ' : ''}${result.message}`);
        } else {
          await bot.sendMessage(chatId, `${isDev ? 'DEV:: ' : ''}⚠️ ${result.message}`);
        }
      } catch (err) {
        console.error('Error añadiendo vivienda:', err);
        await bot.sendMessage(
          chatId,
          `${isDev ? 'DEV:: ' : ''}❌ Error al crear la vivienda. Revisa los logs.`
        );
      }

      return true;
    },
  };
}
