export const DOCUMENT_CATEGORIES = {
  CONTRATOS: 'Contratos',
  INQUILINOS_SENSIBLE: 'Inquilinos_Sensible',
  SEGUROS: 'Seguros',
  SUMINISTROS: 'Suministros',
  COMUNIDAD_IMPUESTOS: 'Comunidad_Impuestos',
  FACTURAS_REFORMAS: 'Facturas_Reformas',
  FOTOS_ESTADO: 'Fotos_Estado',
  OTROS: 'Otros',
};

export const CATEGORY_FOLDER_MAPPING = {
  [DOCUMENT_CATEGORIES.CONTRATOS]: { base: '01_Contratos', requiresYear: true },
  [DOCUMENT_CATEGORIES.INQUILINOS_SENSIBLE]: { base: '02_Inquilinos_Sensible', requiresYear: false },
  [DOCUMENT_CATEGORIES.SEGUROS]: { base: '03_Seguros', requiresYear: true },
  [DOCUMENT_CATEGORIES.SUMINISTROS]: { base: '04_Suministros', requiresYear: true },
  [DOCUMENT_CATEGORIES.COMUNIDAD_IMPUESTOS]: { base: '05_Comunidad_Impuestos', requiresYear: true },
  [DOCUMENT_CATEGORIES.FACTURAS_REFORMAS]: { base: '06_Facturas_Reformas', requiresYear: true },
  [DOCUMENT_CATEGORIES.FOTOS_ESTADO]: { base: '07_Fotos_Estado', requiresYear: false },
  [DOCUMENT_CATEGORIES.OTROS]: { base: '99_Otros', requiresYear: false },
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
    return [...baseParts, year];
  }

  return mapping.base.split('/');
}
