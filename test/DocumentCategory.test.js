import { describe, it, expect } from 'vitest';
import { getCategoryFolderPath, DOCUMENT_CATEGORIES } from '../src/domain/DocumentCategory.js';

describe('getCategoryFolderPath', () => {
  it('devuelve path con año para Contratos', () => {
    const result = getCategoryFolderPath(DOCUMENT_CATEGORIES.CONTRATOS, '2024');
    expect(result).toEqual(['01_Contratos', '2024']);
  });

  it('devuelve path sin año para Inquilinos_Sensible', () => {
    const result = getCategoryFolderPath(DOCUMENT_CATEGORIES.INQUILINOS_SENSIBLE);
    expect(result).toEqual(['02_Inquilinos_Sensible']);
  });

  it('devuelve path con año para Seguros', () => {
    const result = getCategoryFolderPath(DOCUMENT_CATEGORIES.SEGUROS, '2025');
    expect(result).toEqual(['03_Seguros', '2025']);
  });

  it('devuelve path con año para Suministros', () => {
    const result = getCategoryFolderPath(DOCUMENT_CATEGORIES.SUMINISTROS, '2024');
    expect(result).toEqual(['04_Suministros', '2024']);
  });

  it('devuelve path con año para Comunidad_Impuestos', () => {
    const result = getCategoryFolderPath(DOCUMENT_CATEGORIES.COMUNIDAD_IMPUESTOS, '2024');
    expect(result).toEqual(['05_Comunidad_Impuestos', '2024']);
  });

  it('devuelve path con subcarpeta y año para Facturas_Reformas', () => {
    const result = getCategoryFolderPath(DOCUMENT_CATEGORIES.FACTURAS_REFORMAS, '2024');
    expect(result).toEqual(['06_Incidencias_Reformas', 'Facturas', '2024']);
  });

  it('devuelve path sin año para Fotos_Estado', () => {
    const result = getCategoryFolderPath(DOCUMENT_CATEGORIES.FOTOS_ESTADO);
    expect(result).toEqual(['07_Fotos_Estado']);
  });

  it('devuelve path sin año para Otros', () => {
    const result = getCategoryFolderPath(DOCUMENT_CATEGORIES.OTROS);
    expect(result).toEqual(['99_Otros']);
  });

  it('lanza error si categoría inválida', () => {
    expect(() => getCategoryFolderPath('InvalidCategory', '2024')).toThrow('Invalid category');
  });

  it('lanza error si falta año para categoría que lo requiere', () => {
    expect(() => getCategoryFolderPath(DOCUMENT_CATEGORIES.CONTRATOS)).toThrow('Year is required for category');
  });
});
