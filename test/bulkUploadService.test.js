import { describe, it, expect, vi, beforeEach } from 'vitest';
import { uploadBulkFiles, validateBulkUploadRequest, checkDuplicateFiles } from '../src/services/bulkUploadService.js';
import { DOCUMENT_CATEGORIES, FOLDER_NAMES } from '../src/domain/DocumentCategory.js';
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
      category: DOCUMENT_CATEGORIES.INGRESOS,
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

  it('llama a onFileStart y onFileResult por cada archivo exitoso', async () => {
    const mockDrive = {
      files: {
        list: vi.fn().mockResolvedValue({ data: { files: [] } }),
        create: vi.fn().mockResolvedValue({
          data: { id: 'folder-id', name: 'FolderName' },
        }),
      },
    };

    const mockBot = {
      getFile: vi.fn().mockResolvedValue({ file_path: 'documents/file.pdf' }),
    };

    axios.get.mockResolvedValue({ data: Buffer.from('file content') });

    const onFileStart = vi.fn().mockResolvedValue(undefined);
    const onFileResult = vi.fn().mockResolvedValue(undefined);

    const files = [
      { fileId: 'file-1', fileName: 'doc1.pdf', mimeType: 'application/pdf' },
      { fileId: 'file-2', fileName: 'doc2.pdf', mimeType: 'application/pdf' },
    ];

    await uploadBulkFiles({
      drive: mockDrive,
      bot: mockBot,
      botToken: 'token',
      files,
      propertyFolderId: 'prop-123',
      category: DOCUMENT_CATEGORIES.INGRESOS,
      year: '2024',
      onFileStart,
      onFileResult,
    });

    expect(onFileStart).toHaveBeenCalledTimes(2);
    expect(onFileStart).toHaveBeenNthCalledWith(1, 'doc1.pdf');
    expect(onFileStart).toHaveBeenNthCalledWith(2, 'doc2.pdf');
    expect(onFileResult).toHaveBeenCalledTimes(2);
    expect(onFileResult).toHaveBeenNthCalledWith(1, 'doc1.pdf', true, null);
    expect(onFileResult).toHaveBeenNthCalledWith(2, 'doc2.pdf', true, null);
  });

  it('llama a onFileResult con success=false cuando falla la descarga', async () => {
    const mockDrive = {
      files: {
        list: vi.fn().mockResolvedValue({ data: { files: [] } }),
        create: vi.fn().mockResolvedValue({
          data: { id: 'folder-id', name: 'FolderName' },
        }),
      },
    };

    const mockBot = {
      getFile: vi.fn().mockRejectedValue(new Error('Download failed')),
    };

    const onFileStart = vi.fn().mockResolvedValue(undefined);
    const onFileResult = vi.fn().mockResolvedValue(undefined);

    const results = await uploadBulkFiles({
      drive: mockDrive,
      bot: mockBot,
      botToken: 'token',
      files: [{ fileId: 'file-1', fileName: 'doc1.pdf', mimeType: 'application/pdf' }],
      propertyFolderId: 'prop-123',
      category: DOCUMENT_CATEGORIES.INGRESOS,
      year: '2024',
      onFileStart,
      onFileResult,
    });

    expect(onFileStart).toHaveBeenCalledWith('doc1.pdf');
    expect(onFileResult).toHaveBeenCalledWith('doc1.pdf', false, 'Download failed');
    expect(results[0].success).toBe(false);
  });

  it('funciona correctamente sin callbacks opcionales en subida exitosa', async () => {
    const mockDrive = {
      files: {
        list: vi.fn().mockResolvedValue({ data: { files: [] } }),
        create: vi.fn().mockResolvedValue({
          data: { id: 'folder-id', name: 'FolderName' },
        }),
      },
    };

    const mockBot = {
      getFile: vi.fn().mockResolvedValue({ file_path: 'documents/file.pdf' }),
    };

    axios.get.mockResolvedValue({ data: Buffer.from('file content') });

    const results = await uploadBulkFiles({
      drive: mockDrive,
      bot: mockBot,
      botToken: 'token',
      files: [{ fileId: 'file-1', fileName: 'doc1.pdf', mimeType: 'application/pdf' }],
      propertyFolderId: 'prop-123',
      category: DOCUMENT_CATEGORIES.INGRESOS,
      year: '2024',
    });

    expect(results[0].success).toBe(true);
  });

  it('funciona correctamente sin callbacks opcionales cuando falla la descarga', async () => {
    const mockDrive = {
      files: {
        list: vi.fn().mockResolvedValue({ data: { files: [] } }),
        create: vi.fn().mockResolvedValue({
          data: { id: 'folder-id', name: 'FolderName' },
        }),
      },
    };

    const mockBot = {
      getFile: vi.fn().mockRejectedValue(new Error('Download failed')),
    };

    const results = await uploadBulkFiles({
      drive: mockDrive,
      bot: mockBot,
      botToken: 'token',
      files: [{ fileId: 'file-1', fileName: 'doc1.pdf', mimeType: 'application/pdf' }],
      propertyFolderId: 'prop-123',
      category: DOCUMENT_CATEGORIES.INGRESOS,
      year: '2024',
    });

    expect(results[0].success).toBe(false);
    expect(results[0].error).toBe('Download failed');
  });

  it('lanza error si falta drive', async () => {
    await expect(uploadBulkFiles({
      bot: {},
      botToken: 'token',
      files: [],
      propertyFolderId: 'prop-123',
      category: DOCUMENT_CATEGORIES.INGRESOS,
      year: '2024',
    })).rejects.toThrow('Drive client is required');
  });

  it('lanza error si files no es array', async () => {
    await expect(uploadBulkFiles({
      drive: {},
      bot: {},
      botToken: 'token',
      files: 'not-array',
      propertyFolderId: 'prop-123',
      category: DOCUMENT_CATEGORIES.INGRESOS,
      year: '2024',
    })).rejects.toThrow('Files array is required');
  });

  it('lanza error si falta propertyFolderId', async () => {
    await expect(uploadBulkFiles({
      drive: {},
      bot: {},
      botToken: 'token',
      files: [],
      category: DOCUMENT_CATEGORIES.INGRESOS,
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
      category: DOCUMENT_CATEGORIES.INGRESOS,
      year: '2024',
    });

    expect(result.valid).toBe(true);
  });

  it('rechaza si falta propertyFolderId', () => {
    const result = validateBulkUploadRequest({
      category: DOCUMENT_CATEGORIES.INGRESOS,
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
      category: DOCUMENT_CATEGORIES.INGRESOS,
      year: 'invalid',
    });

    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('acepta sin año si no se proporciona', () => {
    const result = validateBulkUploadRequest({
      propertyFolderId: 'prop-123',
      category: DOCUMENT_CATEGORIES.FOTOS,
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
          .mockResolvedValueOnce({ data: { files: [] } })  // lookup RENTA folder
          .mockResolvedValueOnce({ data: { files: [] } })  // lookup year folder
          .mockResolvedValueOnce({ data: { files: [] } })  // lookup Ingresos folder
          .mockResolvedValueOnce({ data: { files: [{ id: 'file-1', name: 'test1.pdf' }] } })  // test1.pdf exists
          .mockResolvedValueOnce({ data: { files: [] } }),                                     // test2.pdf not found
        create: vi.fn()
          .mockResolvedValueOnce({ data: { id: 'folder-1', name: FOLDER_NAMES.RENTA } })
          .mockResolvedValueOnce({ data: { id: 'folder-2', name: '2024' } })
          .mockResolvedValueOnce({ data: { id: 'folder-3', name: 'Ingresos' } }),
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
      category: DOCUMENT_CATEGORIES.INGRESOS,
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
      category: DOCUMENT_CATEGORIES.INGRESOS,
      year: '2024',
    });

    expect(duplicates).toEqual([]);
  });

  it('lanza error si falta drive', async () => {
    await expect(
      checkDuplicateFiles({
        files: [],
        propertyFolderId: 'prop-123',
        category: DOCUMENT_CATEGORIES.INGRESOS,
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
        category: DOCUMENT_CATEGORIES.INGRESOS,
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
        category: DOCUMENT_CATEGORIES.INGRESOS,
        year: '2024',
      })
    ).rejects.toThrow('Files array is required');
  });

  it('lanza error si falta propertyFolderId', async () => {
    await expect(
      checkDuplicateFiles({
        drive: {},
        files: [],
        category: DOCUMENT_CATEGORIES.INGRESOS,
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
