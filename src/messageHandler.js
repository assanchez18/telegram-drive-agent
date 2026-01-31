/**
 * Handler principal de mensajes de Telegram.
 * Procesa mensajes, delega a controllers, y maneja fallback.
 */
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

  if (msg.text?.startsWith('/cancel')) {
    clearBulkSession(chatId);
    clearIndividualUploadSession(chatId);
    await bot.setMyCommands(defaultCommands, {
      scope: { type: 'chat', chat_id: chatId },
    });
    await bot.sendMessage(chatId, `${isDev ? 'DEV:: ' : ''}❌ Operación cancelada.`);
    return;
  }

  const isBulkHandled = await bulkUploadController.handleBulkMessage(msg);
  if (isBulkHandled) {
    return;
  }

  const isIndividualHandled = await individualUploadController.handleIndividualUploadMessage(msg);
  if (isIndividualHandled) {
    return;
  }

  const isHandled = await propertyController.handleTextMessage(msg);
  if (isHandled) {
    return;
  }

  const fileInfo = extractTelegramFileInfo(msg);

  if (!fileInfo) {
    const helpMessage = `${isDev ? 'DEV:: ' : ''}📋 Todos los comandos disponibles:

Gestión de viviendas:
/add_property - Añadir nueva vivienda
/list_properties - Listar viviendas activas
/delete_property - Eliminar vivienda permanentemente

Archivo:
/archive - Menú de gestión de archivo

Subida de documentos:
/bulk - Subir varios archivos a la vez

Sistema:
/self_test - Verificar sistema completo (test end-to-end)
/version - Ver información de versión
/status - Ver estado del sistema

Ayuda:
/start - Mensaje de bienvenida
/help - Mostrar esta ayuda`;

    if (msg.text?.startsWith('/start')) {
      await bot.sendMessage(chatId, helpMessage);
      return;
    }

    if (msg.text?.startsWith('/archive') && msg.text === '/archive') {
      await bot.sendMessage(
        chatId,
        `${isDev ? 'DEV:: ' : ''}📦 Gestión de archivo:\n\n/archive_property - Archivar vivienda activa\n/list_archived - Ver viviendas archivadas\n/unarchive_property - Reactivar vivienda archivada`
      );
      return;
    }

    if (msg.text?.startsWith('/help')) {
      await bot.sendMessage(chatId, helpMessage);
      return;
    }

    // Lista de comandos ya manejados por bot.onText() en los controllers
    // No debemos ejecutar el fallback para estos comandos
    const knownCommands = [
      '/add_property',
      '/list_properties',
      '/delete_property',
      '/archive_property',
      '/list_archived',
      '/unarchive_property',
      '/bulk',
      '/bulk_done',
      '/self_test',
      '/version',
      '/status',
    ];

    if (knownCommands.some(cmd => msg.text?.startsWith(cmd))) {
      // Comando conocido ya procesado por bot.onText(), no ejecutar fallback
      return;
    }

    await bot.sendMessage(
      chatId,
      `${isDev ? 'DEV:: ' : ''}❓ Comando no reconocido. Usa /help para ver todos los comandos disponibles.`
    );
    return;
  }

  await individualUploadController.startIndividualUpload(msg, fileInfo);
}
