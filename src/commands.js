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
