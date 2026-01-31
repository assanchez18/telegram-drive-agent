import { describe, it, expect, vi } from 'vitest';
import {
  findOrCreateFolder,
  createFolderStructure,
  deleteFolder,
  moveFolder,
  uploadBufferToDrive,
  resolveCategoryFolderId,
  checkFileExists,
  checkMultipleFilesExist,
} from '../src/adapters/driveAdapter.js';

describe('findOrCreateFolder', () => {
  it('devuelve carpeta existente si se encuentra', async () => {
    const mockDrive = {
      files: {
        list: vi.fn().mockResolvedValue({
          data: {
            files: [{ id: 'existing-folder-id', name: 'TestFolder' }],
          },
        }),
      },
    };

    const result = await findOrCreateFolder({
      drive: mockDrive,
      name: 'TestFolder',
      parentId: 'parent-id',
    });

    expect(result).toEqual({ id: 'existing-folder-id', name: 'TestFolder' });
    expect(mockDrive.files.list).toHaveBeenCalledWith({
      q: "name='TestFolder' and 'parent-id' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false",
      fields: 'files(id, name)',
      spaces: 'drive',
    });
  });

  it('crea carpeta nueva si no existe', async () => {
    const mockDrive = {
      files: {
        list: vi.fn().mockResolvedValue({
          data: {
            files: [],
          },
        }),
        create: vi.fn().mockResolvedValue({
          data: { id: 'new-folder-id', name: 'NewFolder' },
        }),
      },
    };

    const result = await findOrCreateFolder({
      drive: mockDrive,
      name: 'NewFolder',
      parentId: 'parent-id',
    });

    expect(result).toEqual({ id: 'new-folder-id', name: 'NewFolder' });
    expect(mockDrive.files.create).toHaveBeenCalledWith({
      requestBody: {
        name: 'NewFolder',
        mimeType: 'application/vnd.google-apps.folder',
        parents: ['parent-id'],
      },
      fields: 'id, name',
    });
  });

  it('escapa comillas simples en el nombre de la carpeta', async () => {
    const mockDrive = {
      files: {
        list: vi.fn().mockResolvedValue({
          data: {
            files: [],
          },
        }),
        create: vi.fn().mockResolvedValue({
          data: { id: 'new-id', name: "Folder's Name" },
        }),
      },
    };

    await findOrCreateFolder({
      drive: mockDrive,
      name: "Folder's Name",
      parentId: 'parent-id',
    });

    expect(mockDrive.files.list).toHaveBeenCalledWith({
      q: "name='Folder\\'s Name' and 'parent-id' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false",
      fields: 'files(id, name)',
      spaces: 'drive',
    });
  });

  it('lanza error si falta el nombre', async () => {
    const mockDrive = { files: {} };

    await expect(
      findOrCreateFolder({ drive: mockDrive, name: '', parentId: 'parent-id' })
    ).rejects.toThrow('Folder name is required');
  });

  it('lanza error si falta parentId', async () => {
    const mockDrive = { files: {} };

    await expect(
      findOrCreateFolder({ drive: mockDrive, name: 'TestFolder', parentId: '' })
    ).rejects.toThrow('Parent folder ID is required');
  });

  it('devuelve primera carpeta si hay múltiples resultados', async () => {
    const mockDrive = {
      files: {
        list: vi.fn().mockResolvedValue({
          data: {
            files: [
              { id: 'folder-1', name: 'Duplicate' },
              { id: 'folder-2', name: 'Duplicate' },
            ],
          },
        }),
      },
    };

    const result = await findOrCreateFolder({
      drive: mockDrive,
      name: 'Duplicate',
      parentId: 'parent-id',
    });

    expect(result).toEqual({ id: 'folder-1', name: 'Duplicate' });
  });
});

describe('createFolderStructure', () => {
  it('crea estructura completa de carpetas para una vivienda', async () => {
    const createdFolders = {};
    let folderIdCounter = 1;

    const mockDrive = {
      files: {
        list: vi.fn().mockImplementation(async ({ q }) => {
          const nameMatch = q.match(/name='([^']+)'/);
          const name = nameMatch ? nameMatch[1] : '';
          const parentMatch = q.match(/'([^']+)' in parents/);
          const parentId = parentMatch ? parentMatch[1] : '';

          const key = `${parentId}/${name}`;
          if (createdFolders[key]) {
            return { data: { files: [createdFolders[key]] } };
          }
          return { data: { files: [] } };
        }),
        create: vi.fn().mockImplementation(async ({ requestBody }) => {
          const folderId = `folder-${folderIdCounter++}`;
          const folder = { id: folderId, name: requestBody.name };
          const parentId = requestBody.parents[0];
          const key = `${parentId}/${requestBody.name}`;
          createdFolders[key] = folder;
          return { data: folder };
        }),
      },
    };

    const result = await createFolderStructure({
      drive: mockDrive,
      baseFolderId: 'base-folder-id',
      propertyAddress: 'Calle Mayor 123',
      year: '2024',
    });

    expect(result.name).toBe('Calle Mayor 123');
    expect(mockDrive.files.create).toHaveBeenCalled();

    const createdNames = Object.values(createdFolders).map((f) => f.name);
    expect(createdNames).toContain('Viviendas');
    expect(createdNames).toContain('Calle Mayor 123');
    expect(createdNames).toContain('01_Contratos');
    expect(createdNames).toContain('2024');
    expect(createdNames).toContain('02_Inquilinos_Sensible');
    expect(createdNames).toContain('03_Seguros');
    expect(createdNames).toContain('04_Suministros');
    expect(createdNames).toContain('05_Comunidad_Impuestos');
    expect(createdNames).toContain('06_Facturas_Reformas');
    expect(createdNames).toContain('07_Fotos_Estado');
    expect(createdNames).toContain('99_Otros');
  });

  it('es idempotente - no recrea carpetas existentes', async () => {
    const mockDrive = {
      files: {
        list: vi.fn().mockResolvedValue({
          data: {
            files: [{ id: 'existing-id', name: 'ExistingFolder' }],
          },
        }),
        create: vi.fn(),
      },
    };

    await createFolderStructure({
      drive: mockDrive,
      baseFolderId: 'base-folder-id',
      propertyAddress: 'Calle Test',
      year: '2024',
    });

    expect(mockDrive.files.create).not.toHaveBeenCalled();
  });

  it('lanza error si falta baseFolderId', async () => {
    const mockDrive = { files: {} };

    await expect(
      createFolderStructure({
        drive: mockDrive,
        baseFolderId: '',
        propertyAddress: 'Calle Test',
        year: '2024',
      })
    ).rejects.toThrow('Base folder ID is required');
  });

  it('lanza error si falta propertyAddress', async () => {
    const mockDrive = { files: {} };

    await expect(
      createFolderStructure({
        drive: mockDrive,
        baseFolderId: 'base-id',
        propertyAddress: '',
        year: '2024',
      })
    ).rejects.toThrow('Property address is required');
  });

  it('lanza error si falta year', async () => {
    const mockDrive = { files: {} };

    await expect(
      createFolderStructure({
        drive: mockDrive,
        baseFolderId: 'base-id',
        propertyAddress: 'Calle Test',
        year: '',
      })
    ).rejects.toThrow('Year is required');
  });

  it('crea subcarpetas anidadas correctamente', async () => {
    const createdFolders = [];
    const mockDrive = {
      files: {
        list: vi.fn().mockResolvedValue({ data: { files: [] } }),
        create: vi.fn().mockImplementation(async ({ requestBody }) => {
          const folder = {
            id: `folder-${createdFolders.length + 1}`,
            name: requestBody.name,
            parents: requestBody.parents,
          };
          createdFolders.push(folder);
          return { data: folder };
        }),
      },
    };

    await createFolderStructure({
      drive: mockDrive,
      baseFolderId: 'base-folder-id',
      propertyAddress: 'Calle Test',
      year: '2024',
    });

    const facturasReformas = createdFolders.find((f) => f.name === '06_Facturas_Reformas');
    expect(facturasReformas).toBeDefined();

    const year2024InFacturas = createdFolders.find(
      (f) => f.name === '2024' && f.parents[0] === facturasReformas.id
    );
    expect(year2024InFacturas).toBeDefined();
  });
});

describe('deleteFolder', () => {
  it('elimina una carpeta por su ID', async () => {
    const mockDrive = {
      files: {
        delete: vi.fn().mockResolvedValue({}),
      },
    };

    await deleteFolder({ drive: mockDrive, folderId: 'folder-to-delete' });

    expect(mockDrive.files.delete).toHaveBeenCalledWith({
      fileId: 'folder-to-delete',
    });
  });

  it('lanza error si falta folderId', async () => {
    const mockDrive = { files: {} };

    await expect(
      deleteFolder({ drive: mockDrive, folderId: '' })
    ).rejects.toThrow('Folder ID is required');
  });
});

describe('moveFolder', () => {
  it('mueve una carpeta a un nuevo padre', async () => {
    const mockDrive = {
      files: {
        get: vi.fn().mockResolvedValue({
          data: { parents: ['old-parent-id'] },
        }),
        update: vi.fn().mockResolvedValue({
          data: { id: 'folder-id', parents: ['new-parent-id'] },
        }),
      },
    };

    await moveFolder({
      drive: mockDrive,
      folderId: 'folder-id',
      newParentId: 'new-parent-id',
    });

    expect(mockDrive.files.get).toHaveBeenCalledWith({
      fileId: 'folder-id',
      fields: 'parents',
    });
    expect(mockDrive.files.update).toHaveBeenCalledWith({
      fileId: 'folder-id',
      addParents: 'new-parent-id',
      removeParents: 'old-parent-id',
      fields: 'id, parents',
    });
  });

  it('maneja carpetas sin padres previos', async () => {
    const mockDrive = {
      files: {
        get: vi.fn().mockResolvedValue({
          data: {},
        }),
        update: vi.fn().mockResolvedValue({
          data: { id: 'folder-id', parents: ['new-parent-id'] },
        }),
      },
    };

    await moveFolder({
      drive: mockDrive,
      folderId: 'folder-id',
      newParentId: 'new-parent-id',
    });

    expect(mockDrive.files.update).toHaveBeenCalledWith({
      fileId: 'folder-id',
      addParents: 'new-parent-id',
      removeParents: '',
      fields: 'id, parents',
    });
  });

  it('lanza error si falta folderId', async () => {
    const mockDrive = { files: {} };

    await expect(
      moveFolder({ drive: mockDrive, folderId: '', newParentId: 'new-parent-id' })
    ).rejects.toThrow('Folder ID is required');
  });

  it('lanza error si falta newParentId', async () => {
    const mockDrive = { files: {} };

    await expect(
      moveFolder({ drive: mockDrive, folderId: 'folder-id', newParentId: '' })
    ).rejects.toThrow('New parent ID is required');
  });
});

describe('uploadBufferToDrive', () => {
  it('sube archivo exitosamente', async () => {
    const mockDrive = {
      files: {
        create: vi.fn().mockResolvedValue({
          data: { id: 'uploaded-file-id', name: 'test.pdf' },
        }),
      },
    };

    const buffer = Buffer.from('file content');
    const result = await uploadBufferToDrive({
      drive: mockDrive,
      buffer,
      fileName: 'test.pdf',
      mimeType: 'application/pdf',
      folderId: 'folder-123',
    });

    expect(result).toEqual({ id: 'uploaded-file-id', name: 'test.pdf' });
    expect(mockDrive.files.create).toHaveBeenCalledWith({
      requestBody: {
        name: 'test.pdf',
        parents: ['folder-123'],
      },
      media: {
        mimeType: 'application/pdf',
        body: expect.any(Object),
      },
      fields: 'id, name',
    });
  });

  it('lanza error si falta drive', async () => {
    await expect(
      uploadBufferToDrive({
        buffer: Buffer.from('test'),
        fileName: 'test.pdf',
        mimeType: 'application/pdf',
        folderId: 'folder-123',
      })
    ).rejects.toThrow('Drive client is required');
  });

  it('lanza error si falta buffer', async () => {
    await expect(
      uploadBufferToDrive({
        drive: {},
        fileName: 'test.pdf',
        mimeType: 'application/pdf',
        folderId: 'folder-123',
      })
    ).rejects.toThrow('Buffer is required');
  });

  it('lanza error si falta fileName', async () => {
    await expect(
      uploadBufferToDrive({
        drive: {},
        buffer: Buffer.from('test'),
        mimeType: 'application/pdf',
        folderId: 'folder-123',
      })
    ).rejects.toThrow('File name is required');
  });

  it('lanza error si falta mimeType', async () => {
    await expect(
      uploadBufferToDrive({
        drive: {},
        buffer: Buffer.from('test'),
        fileName: 'test.pdf',
        folderId: 'folder-123',
      })
    ).rejects.toThrow('MIME type is required');
  });

  it('lanza error si falta folderId', async () => {
    await expect(
      uploadBufferToDrive({
        drive: {},
        buffer: Buffer.from('test'),
        fileName: 'test.pdf',
        mimeType: 'application/pdf',
      })
    ).rejects.toThrow('Folder ID is required');
  });
});

describe('resolveCategoryFolderId', () => {
  it('resuelve ruta de carpetas anidadas', async () => {
    const mockDrive = {
      files: {
        list: vi.fn().mockResolvedValue({ data: { files: [] } }),
        create: vi.fn()
          .mockResolvedValueOnce({ data: { id: 'folder-1', name: '01_Contratos' } })
          .mockResolvedValueOnce({ data: { id: 'folder-2', name: '2025' } }),
      },
    };

    const result = await resolveCategoryFolderId({
      drive: mockDrive,
      propertyFolderId: 'property-123',
      categoryPath: ['01_Contratos', '2025'],
    });

    expect(result).toBe('folder-2');
    expect(mockDrive.files.create).toHaveBeenCalledTimes(2);
  });

  it('reutiliza carpetas existentes', async () => {
    const mockDrive = {
      files: {
        list: vi.fn()
          .mockResolvedValueOnce({ data: { files: [{ id: 'existing-1', name: '01_Contratos' }] } })
          .mockResolvedValueOnce({ data: { files: [{ id: 'existing-2', name: '2025' }] } }),
        create: vi.fn(),
      },
    };

    const result = await resolveCategoryFolderId({
      drive: mockDrive,
      propertyFolderId: 'property-123',
      categoryPath: ['01_Contratos', '2025'],
    });

    expect(result).toBe('existing-2');
    expect(mockDrive.files.create).not.toHaveBeenCalled();
  });

  it('lanza error si falta drive', async () => {
    await expect(
      resolveCategoryFolderId({
        propertyFolderId: 'property-123',
        categoryPath: ['01_Contratos'],
      })
    ).rejects.toThrow('Drive client is required');
  });

  it('lanza error si falta propertyFolderId', async () => {
    await expect(
      resolveCategoryFolderId({
        drive: {},
        categoryPath: ['01_Contratos'],
      })
    ).rejects.toThrow('Property folder ID is required');
  });

  it('lanza error si categoryPath no es array', async () => {
    await expect(
      resolveCategoryFolderId({
        drive: {},
        propertyFolderId: 'property-123',
        categoryPath: 'not-an-array',
      })
    ).rejects.toThrow('Category path must be an array');
  });

  it('lanza error si categoryPath es null', async () => {
    await expect(
      resolveCategoryFolderId({
        drive: {},
        propertyFolderId: 'property-123',
        categoryPath: null,
      })
    ).rejects.toThrow('Category path must be an array');
  });
});

describe('checkFileExists', () => {
  it('devuelve true si el archivo existe', async () => {
    const mockDrive = {
      files: {
        list: vi.fn().mockResolvedValue({
          data: { files: [{ id: 'file-123', name: 'test.pdf' }] },
        }),
      },
    };

    const result = await checkFileExists({
      drive: mockDrive,
      folderId: 'folder-123',
      fileName: 'test.pdf',
    });

    expect(result).toBe(true);
    expect(mockDrive.files.list).toHaveBeenCalledWith({
      q: "name='test.pdf' and 'folder-123' in parents and trashed=false",
      fields: 'files(id, name)',
      spaces: 'drive',
    });
  });

  it('devuelve false si el archivo no existe', async () => {
    const mockDrive = {
      files: {
        list: vi.fn().mockResolvedValue({
          data: { files: [] },
        }),
      },
    };

    const result = await checkFileExists({
      drive: mockDrive,
      folderId: 'folder-123',
      fileName: 'test.pdf',
    });

    expect(result).toBe(false);
  });

  it('escapa comillas simples en nombre de archivo', async () => {
    const mockDrive = {
      files: {
        list: vi.fn().mockResolvedValue({
          data: { files: [] },
        }),
      },
    };

    await checkFileExists({
      drive: mockDrive,
      folderId: 'folder-123',
      fileName: "file's name.pdf",
    });

    expect(mockDrive.files.list).toHaveBeenCalledWith({
      q: "name='file\\'s name.pdf' and 'folder-123' in parents and trashed=false",
      fields: 'files(id, name)',
      spaces: 'drive',
    });
  });

  it('lanza error si falta drive', async () => {
    await expect(
      checkFileExists({
        folderId: 'folder-123',
        fileName: 'test.pdf',
      })
    ).rejects.toThrow('Drive client is required');
  });

  it('lanza error si falta folderId', async () => {
    await expect(
      checkFileExists({
        drive: {},
        fileName: 'test.pdf',
      })
    ).rejects.toThrow('Folder ID is required');
  });

  it('lanza error si falta fileName', async () => {
    await expect(
      checkFileExists({
        drive: {},
        folderId: 'folder-123',
      })
    ).rejects.toThrow('File name is required');
  });
});

describe('checkMultipleFilesExist', () => {
  it('devuelve lista de archivos existentes', async () => {
    const mockDrive = {
      files: {
        list: vi.fn()
          .mockResolvedValueOnce({ data: { files: [{ id: 'file-1', name: 'test1.pdf' }] } })
          .mockResolvedValueOnce({ data: { files: [] } })
          .mockResolvedValueOnce({ data: { files: [{ id: 'file-3', name: 'test3.pdf' }] } }),
      },
    };

    const result = await checkMultipleFilesExist({
      drive: mockDrive,
      folderId: 'folder-123',
      fileNames: ['test1.pdf', 'test2.pdf', 'test3.pdf'],
    });

    expect(result).toEqual(['test1.pdf', 'test3.pdf']);
    expect(mockDrive.files.list).toHaveBeenCalledTimes(3);
  });

  it('devuelve array vacío si ningún archivo existe', async () => {
    const mockDrive = {
      files: {
        list: vi.fn().mockResolvedValue({ data: { files: [] } }),
      },
    };

    const result = await checkMultipleFilesExist({
      drive: mockDrive,
      folderId: 'folder-123',
      fileNames: ['test1.pdf', 'test2.pdf'],
    });

    expect(result).toEqual([]);
  });

  it('lanza error si falta drive', async () => {
    await expect(
      checkMultipleFilesExist({
        folderId: 'folder-123',
        fileNames: ['test.pdf'],
      })
    ).rejects.toThrow('Drive client is required');
  });

  it('lanza error si falta folderId', async () => {
    await expect(
      checkMultipleFilesExist({
        drive: {},
        fileNames: ['test.pdf'],
      })
    ).rejects.toThrow('Folder ID is required');
  });

  it('lanza error si fileNames no es array', async () => {
    await expect(
      checkMultipleFilesExist({
        drive: {},
        folderId: 'folder-123',
        fileNames: 'not-an-array',
      })
    ).rejects.toThrow('File names array is required');
  });

  it('lanza error si fileNames es null', async () => {
    await expect(
      checkMultipleFilesExist({
        drive: {},
        folderId: 'folder-123',
        fileNames: null,
      })
    ).rejects.toThrow('File names array is required');
  });
});
