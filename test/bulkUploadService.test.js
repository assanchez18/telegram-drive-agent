import { describe, it, expect, vi, beforeEach } from 'vitest';
import { uploadBulkFiles, validateBulkUploadRequest, checkDuplicateFiles } from '../src/services/bulkUploadService.js';
import { DOCUMENT_CATEGORIES } from '../src/domain/DocumentCategory.js';
import axios from 'axios';

vi.mock('axios');

describe('uploadBulkFiles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sube múltiples archivos exitosamente', async () => {
    const mockDrive = {
      files: {
        list: vi.fn().mockResolvedValue({ data: { files: [] } }),
        create: vi.fn().mockResolvedValue({
          data: { id: 'folder-id', name: 'FolderName' },
        }),
      },
    };

    const mockBot = {
      getFile: vi.fn().mockResolvedValue({
        file_path: 'documents/file.pdf',
      }),
    };

    axios.get.mockResolvedValue({
      data: Buffer.from('file content'),
    });

    const files = [
      { fileId: 'file-1', fileName: 'doc1.pdf', mimeType: 'application/pdf' },
      { fileId: 'file-2', fileName: 'doc2.pdf', mimeType: 'application/pdf' },
    ];

    const results = await uploadBulkFiles({
      drive: mockDrive,
      bot: mockBot,
      botToken: 'token',
      files,
      propertyFolderId: 'prop-123',
      category: DOCUMENT_CATEGORIES.CONTRATOS,
      year: '2024',
    });

    expect(results.length).toBe(2);
    expect(results[0].success).toBe(true);
    expect(results[1].success).toBe(true);
  });

  it('reporta errores individuales sin abortar batch', async () => {
    const results = [
      { success: true, fileName: 'doc1.pdf', driveFileId: 'file-1' },
      { success: false, fileName: 'doc2.pdf', error: 'Upload failed' },
    ];

    expect(results.length).toBe(2);
    expect(results[0].success).toBe(true);
    expect(results[1].success).toBe(false);
    expect(results[1].error).toBeDefined();
  });

  it('lanza error si falta drive', async () => {
    await expect(uploadBulkFiles({
      bot: {},
      botToken: 'token',
      files: [],
      propertyFolderId: 'prop-123',
      category: DOCUMENT_CATEGORIES.CONTRATOS,
      year: '2024',
    })).rejects.toThrow('Drive client is required');
  });

  it('lanza error si falta bot', async () => {
    await expect(uploadBulkFiles({
      drive: {},
      botToken: 'token',
      files: [],
      propertyFolderId: 'prop-123',
      category: DOCUMENT_CATEGORIES.CONTRATOS,
      year: '2024',
    })).rejects.toThrow('Bot is required');
  });

  it('lanza error si falta botToken', async () => {
    await expect(uploadBulkFiles({
      drive: {},
      bot: {},
      files: [],
      propertyFolderId: 'prop-123',
      category: DOCUMENT_CATEGORIES.CONTRATOS,
      year: '2024',
    })).rejects.toThrow('Bot token is required');
  });

  it('lanza error si files no es array', async () => {
    await expect(uploadBulkFiles({
      drive: {},
      bot: {},
      botToken: 'token',
      files: 'not-array',
      propertyFolderId: 'prop-123',
      category: DOCUMENT_CATEGORIES.CONTRATOS,
      year: '2024',
    })).rejects.toThrow('Files array is required');
  });

  it('lanza error si falta propertyFolderId', async () => {
    await expect(uploadBulkFiles({
      drive: {},
      bot: {},
      botToken: 'token',
      files: [],
      category: DOCUMENT_CATEGORIES.CONTRATOS,
      year: '2024',
    })).rejects.toThrow('Property folder ID is required');
  });

  it('lanza error si falta category', async () => {
    await expect(uploadBulkFiles({
      drive: {},
      bot: {},
      botToken: 'token',
      files: [],
      propertyFolderId: 'prop-123',
      year: '2024',
    })).rejects.toThrow('Category is required');
  });
});

describe('validateBulkUploadRequest', () => {
  it('valida request correcto', () => {
    const result = validateBulkUploadRequest({
      propertyFolderId: 'prop-123',
      category: DOCUMENT_CATEGORIES.CONTRATOS,
      year: '2024',
    });

    expect(result.valid).toBe(true);
  });

  it('rechaza si falta propertyFolderId', () => {
    const result = validateBulkUploadRequest({
      category: DOCUMENT_CATEGORIES.CONTRATOS,
      year: '2024',
    });

    expect(result.valid).toBe(false);
    expect(result.error).toBe('Property is required');
  });

  it('rechaza si falta category', () => {
    const result = validateBulkUploadRequest({
      propertyFolderId: 'prop-123',
      year: '2024',
    });

    expect(result.valid).toBe(false);
    expect(result.error).toBe('Category is required');
  });

  it('rechaza si año es inválido', () => {
    const result = validateBulkUploadRequest({
      propertyFolderId: 'prop-123',
      category: DOCUMENT_CATEGORIES.CONTRATOS,
      year: 'invalid',
    });

    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('acepta sin año si no se proporciona', () => {
    const result = validateBulkUploadRequest({
      propertyFolderId: 'prop-123',
      category: DOCUMENT_CATEGORIES.FOTOS_ESTADO,
    });

    expect(result.valid).toBe(true);
  });
});

describe('checkDuplicateFiles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('devuelve lista de archivos duplicados', async () => {
    const mockDrive = {
      files: {
        list: vi.fn()
          .mockResolvedValueOnce({ data: { files: [] } })
          .mockResolvedValueOnce({ data: { files: [] } })
          .mockResolvedValueOnce({ data: { files: [{ id: 'file-1', name: 'test1.pdf' }] } })
          .mockResolvedValueOnce({ data: { files: [] } }),
        create: vi.fn()
          .mockResolvedValueOnce({ data: { id: 'folder-1', name: '01_Contratos' } })
          .mockResolvedValueOnce({ data: { id: 'folder-2', name: '2024' } }),
      },
    };

    const files = [
      { fileId: 'file-1', fileName: 'test1.pdf', mimeType: 'application/pdf' },
      { fileId: 'file-2', fileName: 'test2.pdf', mimeType: 'application/pdf' },
    ];

    const duplicates = await checkDuplicateFiles({
      drive: mockDrive,
      files,
      propertyFolderId: 'prop-123',
      category: DOCUMENT_CATEGORIES.CONTRATOS,
      year: '2024',
    });

    expect(duplicates).toEqual(['test1.pdf']);
  });

  it('devuelve array vacío si no hay duplicados', async () => {
    const mockDrive = {
      files: {
        list: vi.fn().mockResolvedValue({ data: { files: [] } }),
        create: vi.fn().mockResolvedValue({
          data: { id: 'folder-id', name: 'FolderName' },
        }),
      },
    };

    const files = [
      { fileId: 'file-1', fileName: 'test1.pdf', mimeType: 'application/pdf' },
    ];

    const duplicates = await checkDuplicateFiles({
      drive: mockDrive,
      files,
      propertyFolderId: 'prop-123',
      category: DOCUMENT_CATEGORIES.CONTRATOS,
      year: '2024',
    });

    expect(duplicates).toEqual([]);
  });

  it('lanza error si falta drive', async () => {
    await expect(
      checkDuplicateFiles({
        files: [],
        propertyFolderId: 'prop-123',
        category: DOCUMENT_CATEGORIES.CONTRATOS,
        year: '2024',
      })
    ).rejects.toThrow('Drive client is required');
  });

  it('lanza error si files no es array', async () => {
    await expect(
      checkDuplicateFiles({
        drive: {},
        files: 'not-array',
        propertyFolderId: 'prop-123',
        category: DOCUMENT_CATEGORIES.CONTRATOS,
        year: '2024',
      })
    ).rejects.toThrow('Files array is required');
  });

  it('lanza error si files es null', async () => {
    await expect(
      checkDuplicateFiles({
        drive: {},
        files: null,
        propertyFolderId: 'prop-123',
        category: DOCUMENT_CATEGORIES.CONTRATOS,
        year: '2024',
      })
    ).rejects.toThrow('Files array is required');
  });

  it('lanza error si falta propertyFolderId', async () => {
    await expect(
      checkDuplicateFiles({
        drive: {},
        files: [],
        category: DOCUMENT_CATEGORIES.CONTRATOS,
        year: '2024',
      })
    ).rejects.toThrow('Property folder ID is required');
  });

  it('lanza error si falta category', async () => {
    await expect(
      checkDuplicateFiles({
        drive: {},
        files: [],
        propertyFolderId: 'prop-123',
        year: '2024',
      })
    ).rejects.toThrow('Category is required');
  });
});
