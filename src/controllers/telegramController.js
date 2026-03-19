import { addProperty, listProperties, deleteProperty, archiveProperty, listArchivedProperties, unarchiveProperty } from '../services/propertyService.js';
import { getVersionInfo, getStatusReport } from '../services/diagnosticsService.js';

const userStates = new Map();

export function initializePropertyHandlers({ bot, drive, baseFolderId }) {
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

  bot.onText(/\/delete_property/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const isDev = process.env.NODE_ENV === 'development';

    try {
      const result = await listProperties({ drive, baseFolderId });

      if (result.message) {
        await bot.sendMessage(chatId, `${isDev ? 'DEV:: ' : ''}${result.message}`);
        return;
      }

      const properties = result.properties;
      const list = properties
        .map((p, idx) => `${idx + 1}. ${p.address}`)
        .join('\n');

      userStates.set(userId, {
        state: 'waiting_for_property_selection',
        properties,
        action: 'delete',
      });

      await bot.sendMessage(
        chatId,
        `${isDev ? 'DEV:: ' : ''}🗑️ Selecciona el número de la vivienda a eliminar:\n\n${list}\n\nEnvía el número (1-${properties.length}) o "cancelar"`
      );
    } catch (err) {
      console.error('Error en delete_property:', err);
      await bot.sendMessage(
        chatId,
        `${isDev ? 'DEV:: ' : ''}❌ Error al listar viviendas. Revisa los logs.`
      );
    }
  });

  bot.onText(/\/archive_property/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const isDev = process.env.NODE_ENV === 'development';

    try {
      const result = await listProperties({ drive, baseFolderId });

      if (result.message) {
        await bot.sendMessage(chatId, `${isDev ? 'DEV:: ' : ''}${result.message}`);
        return;
      }

      const properties = result.properties;
      const list = properties
        .map((p, idx) => `${idx + 1}. ${p.address}`)
        .join('\n');

      userStates.set(userId, {
        state: 'waiting_for_property_selection',
        properties,
        action: 'archive',
      });

      await bot.sendMessage(
        chatId,
        `${isDev ? 'DEV:: ' : ''}📦 Selecciona el número de la vivienda a archivar:\n\n${list}\n\nEnvía el número (1-${properties.length}) o "cancelar"`
      );
    } catch (err) {
      console.error('Error en archive_property:', err);
      await bot.sendMessage(
        chatId,
        `${isDev ? 'DEV:: ' : ''}❌ Error al listar viviendas. Revisa los logs.`
      );
    }
  });

  bot.onText(/\/list_archived/, async (msg) => {
    const chatId = msg.chat.id;
    const isDev = process.env.NODE_ENV === 'development';

    try {
      const result = await listArchivedProperties({ drive, baseFolderId });

      if (result.message) {
        await bot.sendMessage(chatId, `${isDev ? 'DEV:: ' : ''}${result.message}`);
        return;
      }

      const list = result.properties
        .map((p, idx) => `${idx + 1}. ${p.address}`)
        .join('\n');

      await bot.sendMessage(
        chatId,
        `${isDev ? 'DEV:: ' : ''}📦 Viviendas archivadas:\n\n${list}`
      );
    } catch (err) {
      console.error('Error listando viviendas archivadas:', err);
      await bot.sendMessage(
        chatId,
        `${isDev ? 'DEV:: ' : ''}❌ Error al listar viviendas archivadas. Revisa los logs.`
      );
    }
  });

  bot.onText(/\/unarchive_property/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const isDev = process.env.NODE_ENV === 'development';

    try {
      const result = await listArchivedProperties({ drive, baseFolderId });

      if (result.message) {
        await bot.sendMessage(chatId, `${isDev ? 'DEV:: ' : ''}${result.message}`);
        return;
      }

      const properties = result.properties;
      const list = properties
        .map((p, idx) => `${idx + 1}. ${p.address}`)
        .join('\n');

      userStates.set(userId, {
        state: 'waiting_for_property_selection',
        properties,
        action: 'unarchive',
      });

      await bot.sendMessage(
        chatId,
        `${isDev ? 'DEV:: ' : ''}♻️ Selecciona el número de la vivienda a reactivar:\n\n${list}\n\nEnvía el número (1-${properties.length}) o "cancelar"`
      );
    } catch (err) {
      console.error('Error en unarchive_property:', err);
      await bot.sendMessage(
        chatId,
        `${isDev ? 'DEV:: ' : ''}❌ Error al listar viviendas archivadas. Revisa los logs.`
      );
    }
  });

  bot.onText(/\/version/, async (msg) => {
    const chatId = msg.chat.id;
    const isDev = process.env.NODE_ENV === 'development';

    try {
      const versionInfo = getVersionInfo();

      const cloudRunInfo = versionInfo.cloudRun.service === 'local'
        ? 'local'
        : `${versionInfo.cloudRun.service} (${versionInfo.cloudRun.revision})`;

      const message = `${isDev ? 'DEV:: ' : ''}📦 *${versionInfo.name}* v${versionInfo.version}

🌍 Entorno: ${versionInfo.nodeEnv}
☁️ Cloud Run: ${cloudRunInfo}
🚀 Iniciado: ${versionInfo.startedAt}
🔖 Git SHA: ${versionInfo.gitSha}`;

      await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    } catch (err) {
      console.error('Error en /version:', err);
      await bot.sendMessage(
        chatId,
        `${isDev ? 'DEV:: ' : ''}⚠️ Error obteniendo información de versión. Revisa los logs.`
      );
    }
  });

  bot.onText(/\/status/, async (msg) => {
    const chatId = msg.chat.id;
    const isDev = process.env.NODE_ENV === 'development';

    try {
      await bot.sendMessage(
        chatId,
        `${isDev ? 'DEV:: ' : ''}🔍 Ejecutando diagnóstico del sistema...`
      );

      const checks = await getStatusReport({ drive, baseFolderId });

      const statusIcon = (status) => {
        if (status === 'success') return '✅';
        if (status === 'failed') return '❌';
        return '⏳';
      };

      const escapeMd = (text) => text.replace(/[_*`[]/g, '\\$&');

      const message = `${isDev ? 'DEV:: ' : ''}📊 *Estado del Sistema*

${statusIcon(checks.config.status)} *Config*
   ${escapeMd(checks.config.message)}

${statusIcon(checks.oauth.status)} *Google OAuth*
   ${escapeMd(checks.oauth.message)}

${statusIcon(checks.driveAccess.status)} *Drive (carpeta raíz)*
   ${escapeMd(checks.driveAccess.message)}

${statusIcon(checks.catalog.status)} *Catálogo*
   ${escapeMd(checks.catalog.message)}`;

      await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    } catch (err) {
      console.error('Error en /status:', err);
      await bot.sendMessage(
        chatId,
        `${isDev ? 'DEV:: ' : ''}❌ Error ejecutando diagnóstico. Revisa los logs.`
      );
    }
  });

  bot.onText(/\/google_login/, async (msg) => {
    const chatId = msg.chat.id;
    const isDev = process.env.NODE_ENV === 'development';

    try {
      const baseUrl = process.env.PUBLIC_BASE_URL || 'http://localhost:8080';
      const redirectUri = `${baseUrl}/oauth/google/callback`;

      // Enviar confirmación con botones inline
      await bot.sendMessage(
        chatId,
        `${isDev ? 'DEV:: ' : ''}🔐 Re-autorización de Google Drive

Este proceso renovará tu token de acceso a Google Drive.

⚠️ Importante:
• El link expirará en 10 minutos
• Podrás elegir la cuenta de Google a usar
• Se actualizará el token automáticamente

💡 Tip: Si quieres usar una cuenta diferente, abre el link en una ventana de incógnito o cierra sesión en Google primero.

📋 Redirect URI que se usará:
${redirectUri}

⚠️ IMPORTANTE: Este redirect URI debe estar configurado exactamente en Google Cloud Console:
1. Ve a: console.cloud.google.com/apis/credentials
2. Selecciona tu OAuth 2.0 Client ID
3. En "Authorized redirect URIs", agrega el URI exacto mostrado arriba

¿Deseas continuar?`,
        {
          reply_markup: {
            inline_keyboard: [
              [
                { text: '✅ Continuar', callback_data: 'google_login_confirm' },
                { text: '❌ Cancelar', callback_data: 'google_login_cancel' },
              ],
            ],
          },
        }
      );
    } catch (err) {
      console.error('Error en /google_login:', err);
      await bot.sendMessage(
        chatId,
        `${isDev ? 'DEV:: ' : ''}❌ Error iniciando proceso. Revisa los logs.`
      );
    }
  });

  return {
    handleTextMessage: async (msg) => {
      const chatId = msg.chat.id;
      const userId = msg.from.id;
      const text = msg.text;
      const isDev = process.env.NODE_ENV === 'development';

      if (text?.startsWith('/')) {
        return false;
      }

      const userState = userStates.get(userId);

      if (!userState) {
        return false;
      }

      if (userState.state === 'waiting_for_address') {
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
      }

      if (userState.state === 'waiting_for_property_selection') {
        if (text.toLowerCase() === 'cancelar') {
          userStates.delete(userId);
          await bot.sendMessage(chatId, `${isDev ? 'DEV:: ' : ''}❌ Operación cancelada.`);
          return true;
        }

        const selectedIndex = parseInt(text, 10) - 1;
        const properties = userState.properties;
        const action = userState.action;

        if (isNaN(selectedIndex) || selectedIndex < 0 || selectedIndex >= properties.length) {
          await bot.sendMessage(
            chatId,
            `${isDev ? 'DEV:: ' : ''}⚠️ Número inválido. Envía un número entre 1 y ${properties.length} o "cancelar".`
          );
          return true;
        }

        const selectedProperty = properties[selectedIndex];

        if (action === 'delete') {
          userStates.set(userId, {
            state: 'waiting_for_delete_confirmation',
            property: selectedProperty,
          });

          await bot.sendMessage(
            chatId,
            `${isDev ? 'DEV:: ' : ''}⚠️ ¿Estás seguro de eliminar "${selectedProperty.address}"?\n\n⚠️ NOTA: Se eliminará del catálogo Y todas las carpetas en Drive.\n\nResponde "confirmar" para continuar o "cancelar" para abortar.`
          );
        } else if (action === 'archive') {
          userStates.delete(userId);

          try {
            const result = await archiveProperty({
              drive,
              baseFolderId,
              normalizedAddress: selectedProperty.normalizedAddress,
            });

            await bot.sendMessage(chatId, `${isDev ? 'DEV:: ' : ''}${result.message}`);
            
            const updatedResult = await listProperties({ drive, baseFolderId });
            if (!updatedResult.message && updatedResult.properties.length > 0) {
              const updatedList = updatedResult.properties
                .map((p, idx) => `${idx + 1}. ${p.address}`)
                .join('\n');
              
              userStates.set(userId, {
                state: 'waiting_for_property_selection',
                properties: updatedResult.properties,
                action: 'archive',
              });
              
              await bot.sendMessage(
                chatId,
                `${isDev ? 'DEV:: ' : ''}📦 Selecciona el número de la vivienda a archivar:\n\n${updatedList}\n\nEnvía el número (1-${updatedResult.properties.length}) o "cancelar"`
              );
            }
          } catch (err) {
            console.error('Error archivando vivienda:', err);
            await bot.sendMessage(
              chatId,
              `${isDev ? 'DEV:: ' : ''}❌ Error al archivar la vivienda. Revisa los logs.`
            );
          }
        } else if (action === 'unarchive') {
          userStates.delete(userId);

          try {
            const result = await unarchiveProperty({
              drive,
              baseFolderId,
              normalizedAddress: selectedProperty.normalizedAddress,
            });

            await bot.sendMessage(chatId, `${isDev ? 'DEV:: ' : ''}${result.message}`);
            
            const updatedResult = await listArchivedProperties({ drive, baseFolderId });
            if (!updatedResult.message && updatedResult.properties.length > 0) {
              const updatedList = updatedResult.properties
                .map((p, idx) => `${idx + 1}. ${p.address}`)
                .join('\n');
              
              userStates.set(userId, {
                state: 'waiting_for_property_selection',
                properties: updatedResult.properties,
                action: 'unarchive',
              });
              
              await bot.sendMessage(
                chatId,
                `${isDev ? 'DEV:: ' : ''}♻️ Selecciona el número de la vivienda a reactivar:\n\n${updatedList}\n\nEnvía el número (1-${updatedResult.properties.length}) o "cancelar"`
              );
            }
          } catch (err) {
            console.error('Error reactivando vivienda:', err);
            await bot.sendMessage(
              chatId,
              `${isDev ? 'DEV:: ' : ''}❌ Error al reactivar la vivienda. Revisa los logs.`
            );
          }
        }

        return true;
      }

      if (userState.state === 'waiting_for_delete_confirmation') {
        userStates.delete(userId);

        if (text.toLowerCase() === 'cancelar') {
          await bot.sendMessage(chatId, `${isDev ? 'DEV:: ' : ''}❌ Operación cancelada.`);
          return true;
        }

        if (text.toLowerCase() !== 'confirmar') {
          await bot.sendMessage(
            chatId,
            `${isDev ? 'DEV:: ' : ''}⚠️ Respuesta no reconocida. Operación cancelada.`
          );
          return true;
        }

        try {
          const result = await deleteProperty({
            drive,
            baseFolderId,
            normalizedAddress: userState.property.normalizedAddress,
          });

          await bot.sendMessage(chatId, `${isDev ? 'DEV:: ' : ''}${result.message}`);
        } catch (err) {
          console.error('Error eliminando vivienda:', err);
          await bot.sendMessage(
            chatId,
            `${isDev ? 'DEV:: ' : ''}❌ Error al eliminar la vivienda. Revisa los logs.`
          );
        }

        return true;
      }


      return false;
    },
  };
}
