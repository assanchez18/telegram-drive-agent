import { describe, it, expect } from 'vitest';
import { BulkFile } from '../src/domain/BulkFile.js';

describe('BulkFile', () => {
  it('crea archivo con nombre original', () => {
    const file = new BulkFile({
      fileId: 'file-123',
      fileUniqueId: 'unique-123',
      fileName: 'documento.pdf',
      mimeType: 'application/pdf',
    });

    expect(file.fileId).toBe('file-123');
    expect(file.fileUniqueId).toBe('unique-123');
    expect(file.fileName).toBe('documento.pdf');
    expect(file.mimeType).toBe('application/pdf');
  });

  it('genera nombre de foto si fileName es null', () => {
    const file = new BulkFile({
      fileId: 'file-456',
      fileUniqueId: 'unique-456',
      fileName: null,
      mimeType: 'image/jpeg',
    });

    expect(file.fileName).toBe('photo_unique-456.jpg');
  });

  it('lanza error si falta fileId', () => {
    expect(() => new BulkFile({
      fileUniqueId: 'unique-123',
      fileName: 'test.pdf',
      mimeType: 'application/pdf',
    })).toThrow('File ID is required');
  });

  it('lanza error si falta fileUniqueId', () => {
    expect(() => new BulkFile({
      fileId: 'file-123',
      fileName: 'test.pdf',
      mimeType: 'application/pdf',
    })).toThrow('File unique ID is required');
  });

  it('lanza error si falta mimeType', () => {
    expect(() => new BulkFile({
      fileId: 'file-123',
      fileUniqueId: 'unique-123',
      fileName: 'test.pdf',
    })).toThrow('MIME type is required');
  });
});
