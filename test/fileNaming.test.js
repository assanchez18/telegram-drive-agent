import { describe, it, expect } from 'vitest';
import { toSnakeCase, applySnakeCaseToFileName, renameFilesForUpload, needsUserProvidedName } from '../src/utils/fileNaming.js';

describe('toSnakeCase', () => {
  it('convierte espacios a guiones bajos', () => {
    expect(toSnakeCase('Estado Inicial')).toBe('estado_inicial');
  });

  it('convierte a minúsculas', () => {
    expect(toSnakeCase('BAÑO PRINCIPAL')).toBe('baño_principal');
  });

  it('preserva caracteres españoles', () => {
    expect(toSnakeCase('Año Renovación')).toBe('año_renovación');
    expect(toSnakeCase('Señor Muñoz')).toBe('señor_muñoz');
  });

  it('elimina caracteres especiales excepto ñ y acentos', () => {
    expect(toSnakeCase('Foto #1 - Principal!')).toBe('foto_1_principal');
    expect(toSnakeCase('Baño & Cocina')).toBe('baño_cocina');
  });

  it('elimina guiones bajos duplicados', () => {
    expect(toSnakeCase('Foto   Estado    Inicial')).toBe('foto_estado_inicial');
  });

  it('elimina guiones bajos al inicio y final', () => {
    expect(toSnakeCase('  Estado Inicial  ')).toBe('estado_inicial');
  });
});

describe('applySnakeCaseToFileName', () => {
  it('aplica snake_case preservando extensión', () => {
    expect(applySnakeCaseToFileName('Estado Inicial.jpg')).toBe('estado_inicial.jpg');
  });

  it('maneja nombres sin extensión', () => {
    expect(applySnakeCaseToFileName('Estado Inicial')).toBe('estado_inicial');
  });

  it('devuelve null si el nombre es null', () => {
    expect(applySnakeCaseToFileName(null)).toBe(null);
  });

  it('maneja archivos con múltiples puntos (toma última extensión)', () => {
    expect(applySnakeCaseToFileName('Archivo.tar.gz')).toBe('archivotar.gz');
  });
});

describe('renameFilesForUpload', () => {
  it('aplica snake_case a archivos con caption', () => {
    const files = [
      { fileName: 'Estado Inicial.jpg', mimeType: 'image/jpeg' }
    ];
    const result = renameFilesForUpload(files);
    expect(result[0].fileName).toBe('estado_inicial.jpg');
  });

  it('usa baseName para archivos sin nombre', () => {
    const files = [
      { fileName: null, mimeType: 'image/jpeg' }
    ];
    const result = renameFilesForUpload(files, 'Vista General');
    expect(result[0].fileName).toBe('vista_general_1.jpg');
  });

  it('numera múltiples archivos sin nombre', () => {
    const files = [
      { fileName: null, mimeType: 'image/jpeg' },
      { fileName: 'photo_unique123.jpg', mimeType: 'image/jpeg' },
      { fileName: null, mimeType: 'image/jpeg' }
    ];
    const result = renameFilesForUpload(files, 'Estado');
    expect(result[0].fileName).toBe('estado_1.jpg');
    expect(result[1].fileName).toBe('estado_2.jpg');
    expect(result[2].fileName).toBe('estado_3.jpg');
  });

  it('mezcla archivos con caption y sin nombre', () => {
    const files = [
      { fileName: 'Baño Principal.jpg', mimeType: 'image/jpeg' },
      { fileName: null, mimeType: 'image/jpeg' },
      { fileName: 'Cocina.jpg', mimeType: 'image/jpeg' }
    ];
    const result = renameFilesForUpload(files, 'Habitación');
    expect(result[0].fileName).toBe('baño_principal.jpg');
    expect(result[1].fileName).toBe('habitación_1.jpg');
    expect(result[2].fileName).toBe('cocina.jpg');
  });

  it('maneja videos correctamente', () => {
    const files = [
      { fileName: null, mimeType: 'video/mp4' },
      { fileName: 'video_unique456.mp4', mimeType: 'video/mp4' }
    ];
    const result = renameFilesForUpload(files, 'Tour');
    expect(result[0].fileName).toBe('tour_1.mp4');
    expect(result[1].fileName).toBe('tour_2.mp4');
  });

  it('mantiene archivos con nombres autogenerados cuando no hay baseName', () => {
    const files = [
      { fileName: 'photo_unique123.jpg', mimeType: 'image/jpeg' },
      { fileName: 'video_unique456.mp4', mimeType: 'video/mp4' }
    ];
    const result = renameFilesForUpload(files, null);
    expect(result[0].fileName).toBe('photo_unique123.jpg');
    expect(result[1].fileName).toBe('video_unique456.mp4');
  });

  it('maneja archivos con mime types no estándar con baseName', () => {
    const files = [
      { fileName: null, mimeType: 'application/pdf' }
    ];
    const result = renameFilesForUpload(files, 'Documento');
    expect(result[0].fileName).toBe('documento_1');
  });
});

describe('needsUserProvidedName', () => {
  it('devuelve true para null', () => {
    expect(needsUserProvidedName(null)).toBe(true);
  });

  it('devuelve true para nombres por defecto', () => {
    expect(needsUserProvidedName('foto.jpg')).toBe(true);
    expect(needsUserProvidedName('video.mp4')).toBe(true);
  });

  it('devuelve true para nombres autogenerados', () => {
    expect(needsUserProvidedName('photo_unique123.jpg')).toBe(true);
    expect(needsUserProvidedName('video_unique456.mp4')).toBe(true);
  });

  it('devuelve false para nombres con caption', () => {
    expect(needsUserProvidedName('Estado Inicial.jpg')).toBe(false);
    expect(needsUserProvidedName('Baño Principal.jpg')).toBe(false);
  });

  it('devuelve false para nombres de documentos', () => {
    expect(needsUserProvidedName('Contrato.pdf')).toBe(false);
  });
});
