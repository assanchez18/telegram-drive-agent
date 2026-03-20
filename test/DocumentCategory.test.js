import { describe, it, expect } from 'vitest';
import {
  getCategoryFolderPath,
  buildCategoryButtons,
  DOCUMENT_CATEGORIES,
  FOLDER_NAMES,
} from '../src/domain/DocumentCategory.js';

describe('getCategoryFolderPath', () => {
  it('devuelve path con año y sufijo Ingresos', () => {
    const result = getCategoryFolderPath(DOCUMENT_CATEGORIES.INGRESOS, '2025');
    expect(result).toEqual([FOLDER_NAMES.RENTA, '2025', 'Ingresos']);
  });

  it('devuelve path con año y sufijo Gastos', () => {
    const result = getCategoryFolderPath(DOCUMENT_CATEGORIES.GASTOS, '2024');
    expect(result).toEqual([FOLDER_NAMES.RENTA, '2024', 'Gastos']);
  });

  it('devuelve path sin año para Gestion', () => {
    const result = getCategoryFolderPath(DOCUMENT_CATEGORIES.GESTION);
    expect(result).toEqual([FOLDER_NAMES.GESTION]);
  });

  it('devuelve path sin año para Archivo', () => {
    const result = getCategoryFolderPath(DOCUMENT_CATEGORIES.ARCHIVO);
    expect(result).toEqual([FOLDER_NAMES.ARCHIVO]);
  });

  it('devuelve path sin año para Fotos (ruta anidada)', () => {
    const result = getCategoryFolderPath(DOCUMENT_CATEGORIES.FOTOS);
    expect(result).toEqual([FOLDER_NAMES.ARCHIVO, 'Fotos']);
  });

  it('lanza error si categoría inválida', () => {
    expect(() => getCategoryFolderPath('InvalidCategory', '2024')).toThrow('Invalid category');
  });

  it('lanza error si falta año para categoría que lo requiere (Ingresos)', () => {
    expect(() => getCategoryFolderPath(DOCUMENT_CATEGORIES.INGRESOS)).toThrow('Year is required for category');
  });

  it('lanza error si falta año para categoría que lo requiere (Gastos)', () => {
    expect(() => getCategoryFolderPath(DOCUMENT_CATEGORIES.GASTOS)).toThrow('Year is required for category');
  });
});

describe('buildCategoryButtons', () => {
  it('devuelve 5 filas de botones con el prefijo correcto', () => {
    const buttons = buildCategoryButtons('individual_category_');
    expect(buttons).toHaveLength(5);
    expect(buttons[0][0].callback_data).toBe(`individual_category_${DOCUMENT_CATEGORIES.INGRESOS}`);
    expect(buttons[1][0].callback_data).toBe(`individual_category_${DOCUMENT_CATEGORIES.GASTOS}`);
    expect(buttons[2][0].callback_data).toBe(`individual_category_${DOCUMENT_CATEGORIES.GESTION}`);
    expect(buttons[3][0].callback_data).toBe(`individual_category_${DOCUMENT_CATEGORIES.ARCHIVO}`);
    expect(buttons[4][0].callback_data).toBe(`individual_category_${DOCUMENT_CATEGORIES.FOTOS}`);
  });

  it('usa el prefijo especificado en callback_data', () => {
    const buttons = buildCategoryButtons('bulk_category_');
    for (const row of buttons) {
      expect(row[0].callback_data).toMatch(/^bulk_category_/);
    }
  });

  it('cada fila tiene exactamente un botón', () => {
    const buttons = buildCategoryButtons('test_');
    for (const row of buttons) {
      expect(row).toHaveLength(1);
    }
  });
});

describe('FOLDER_NAMES', () => {
  it('contiene los tres nombres de carpeta esperados', () => {
    expect(FOLDER_NAMES.RENTA).toBe('01_Renta_(ingresos_gastos_cuotas_e_impuestos)');
    expect(FOLDER_NAMES.GESTION).toBe('02_Gestión_(seguros_contratos_y_mantenimiento)');
    expect(FOLDER_NAMES.ARCHIVO).toBe('03_Archivo_(compra_hipoteca_y_fotos)');
  });
});
