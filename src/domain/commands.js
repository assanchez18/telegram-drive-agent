const Command = Object.freeze({
  START:              { matches: (msg) => msg.text?.startsWith('/start') },
  HELP:               { matches: (msg) => msg.text?.startsWith('/help') },
  CANCEL:             { matches: (msg) => msg.text?.startsWith('/cancel') },
  ADD_PROPERTY:       { matches: (msg) => msg.text?.startsWith('/add_property') },
  LIST_PROPERTIES:    { matches: (msg) => msg.text?.startsWith('/list_properties') },
  DELETE_PROPERTY:    { matches: (msg) => msg.text?.startsWith('/delete_property') },
  ARCHIVE:            { matches: (msg) => msg.text === '/archive' },
  ARCHIVE_PROPERTY:   { matches: (msg) => msg.text?.startsWith('/archive_property') },
  LIST_ARCHIVED:      { matches: (msg) => msg.text?.startsWith('/list_archived') },
  UNARCHIVE_PROPERTY: { matches: (msg) => msg.text?.startsWith('/unarchive_property') },
  BULK:               { matches: (msg) => msg.text === '/bulk' },
  BULK_DONE:          { matches: (msg) => msg.text?.startsWith('/bulk_done') },
  SELF_TEST:          { matches: (msg) => msg.text?.startsWith('/self_test') },
  GOOGLE_LOGIN:       { matches: (msg) => msg.text?.startsWith('/google_login') },
  VERSION:            { matches: (msg) => msg.text?.startsWith('/version') },
  STATUS:             { matches: (msg) => msg.text?.startsWith('/status') },
});

export const isStart =              (msg) => Command.START.matches(msg);
export const isHelp =               (msg) => Command.HELP.matches(msg);
export const isCancel =             (msg) => Command.CANCEL.matches(msg);
export const isAddProperty =        (msg) => Command.ADD_PROPERTY.matches(msg);
export const isListProperties =     (msg) => Command.LIST_PROPERTIES.matches(msg);
export const isDeleteProperty =     (msg) => Command.DELETE_PROPERTY.matches(msg);
export const isArchive =            (msg) => Command.ARCHIVE.matches(msg);
export const isArchiveProperty =    (msg) => Command.ARCHIVE_PROPERTY.matches(msg);
export const isListArchived =       (msg) => Command.LIST_ARCHIVED.matches(msg);
export const isUnarchiveProperty =  (msg) => Command.UNARCHIVE_PROPERTY.matches(msg);
export const isBulk =               (msg) => Command.BULK.matches(msg);
export const isBulkDone =           (msg) => Command.BULK_DONE.matches(msg);
export const isSelfTest =           (msg) => Command.SELF_TEST.matches(msg);
export const isGoogleLogin =        (msg) => Command.GOOGLE_LOGIN.matches(msg);
export const isVersion =            (msg) => Command.VERSION.matches(msg);
export const isStatus =             (msg) => Command.STATUS.matches(msg);
const generalCommands = [
  { command: 'start', description: 'Mensaje de bienvenida' },
  { command: 'help', description: 'Mostrar ayuda' },
  { command: 'version', description: 'Ver información de versión' },
  { command: 'status', description: 'Ver estado del sistema' },
  { command: 'cancel', description: 'Cancelar operación actual' },
];

const propertyManagementCommands = [
  { command: 'add_property', description: 'Añadir nueva vivienda' },
  { command: 'list_properties', description: 'Listar viviendas activas' },
  { command: 'delete_property', description: 'Eliminar vivienda' },
  { command: 'bulk', description: 'Subir varios archivos a la vez' },
];

const archiveCommands = [
  { command: 'archive', description: 'Menú de archivo' },
  { command: 'archive_property', description: 'Archivar vivienda' },
  { command: 'list_archived', description: 'Ver viviendas archivadas' },
  { command: 'unarchive_property', description: 'Reactivar vivienda' },
];

const systemCommands = [
  { command: 'self_test', description: 'Ejecutar self-test del sistema (admin only)' },
  { command: 'google_login', description: 'Re-autorizar Google Drive' },
];

export const defaultCommands = [
  ...generalCommands,
  ...propertyManagementCommands,
  ...archiveCommands,
  ...systemCommands,
];

export const bulkModeCommands = [
  { command: 'bulk_done', description: 'Finalizar subida bulk' },
  { command: 'cancel', description: 'Cancelar operación actual' },
];

export const knownCommands = [
  ...defaultCommands,
  ...bulkModeCommands,
].map(({ command }) => `/${command}`);

export function getHelpMessage() {
  return `📋 Todos los comandos disponibles:

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
/google_login - Re-autorizar Google Drive
/version - Ver información de versión
/status - Ver estado del sistema

Ayuda:
/start - Mensaje de bienvenida
/help - Mostrar esta ayuda`;
}

export function getArchiveMenuMessage() {
  return `📦 Gestión de archivo:\n\n/archive_property - Archivar vivienda activa\n/list_archived - Ver viviendas archivadas\n/unarchive_property - Reactivar vivienda archivada`;
}
