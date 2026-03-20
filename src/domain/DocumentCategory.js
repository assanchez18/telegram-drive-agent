export const FOLDER_NAMES = {
  RENTA:   '01_Renta_(ingresos_gastos_cuotas_e_impuestos)',
  GESTION: '02_Gestión_(seguros_contratos_y_mantenimiento)',
  ARCHIVO: '03_Archivo_(compra_hipoteca_y_fotos)',
};

export const DOCUMENT_CATEGORIES = {
  INGRESOS: 'Ingresos',
  GASTOS:   'Gastos',
  GESTION:  'Gestion',
  ARCHIVO:  'Archivo',
  FOTOS:    'Fotos',
};

export const CATEGORY_FOLDER_MAPPING = {
  [DOCUMENT_CATEGORIES.INGRESOS]: {
    base: FOLDER_NAMES.RENTA,
    requiresYear: true,
    suffix: 'Ingresos',
  },
  [DOCUMENT_CATEGORIES.GASTOS]: {
    base: FOLDER_NAMES.RENTA,
    requiresYear: true,
    suffix: 'Gastos',
  },
  [DOCUMENT_CATEGORIES.GESTION]: {
    base: FOLDER_NAMES.GESTION,
    requiresYear: false,
  },
  [DOCUMENT_CATEGORIES.ARCHIVO]: {
    base: FOLDER_NAMES.ARCHIVO,
    requiresYear: false,
  },
  [DOCUMENT_CATEGORIES.FOTOS]: {
    base: `${FOLDER_NAMES.ARCHIVO}/Fotos`,
    requiresYear: false,
  },
};

export function getCategoryFolderPath(category, year) {
  const mapping = CATEGORY_FOLDER_MAPPING[category];
  if (!mapping) {
    throw new Error(`Invalid category: ${category}`);
  }

  if (mapping.requiresYear) {
    if (!year) {
      throw new Error(`Year is required for category: ${category}`);
    }
    const baseParts = mapping.base.split('/');
    const path = [...baseParts, year];
    if (mapping.suffix) {
      path.push(mapping.suffix);
    }
    return path;
  }

  return mapping.base.split('/');
}

/**
 * Construye los botones de categoría para inline keyboard de Telegram.
 * Compartido entre individualUploadController y bulkUploadController
 * para evitar duplicación.
 * @param {string} callbackPrefix - e.g. 'individual_category_' o 'bulk_category_'
 * @returns {Array} array de filas para inline_keyboard
 */
export function buildCategoryButtons(callbackPrefix) {
  return [
    [{ text: 'Ingresos',  callback_data: `${callbackPrefix}${DOCUMENT_CATEGORIES.INGRESOS}` }],
    [{ text: 'Gastos',    callback_data: `${callbackPrefix}${DOCUMENT_CATEGORIES.GASTOS}` }],
    [{ text: 'Gestión',   callback_data: `${callbackPrefix}${DOCUMENT_CATEGORIES.GESTION}` }],
    [{ text: 'Archivo',   callback_data: `${callbackPrefix}${DOCUMENT_CATEGORIES.ARCHIVO}` }],
    [{ text: 'Fotos',     callback_data: `${callbackPrefix}${DOCUMENT_CATEGORIES.FOTOS}` }],
  ];
}
