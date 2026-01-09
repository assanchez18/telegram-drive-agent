import { describe, it, expect, vi } from 'vitest';
import { findOrCreateFolder, createFolderStructure, deleteFolder, moveFolder } from '../src/adapters/driveAdapter.js';

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
    expect(createdNames).toContain('06_Incidencias_Reformas');
    expect(createdNames).toContain('Facturas');
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

    const facturas = createdFolders.find((f) => f.name === 'Facturas');
    expect(facturas).toBeDefined();

    const year2024InFacturas = createdFolders.find(
      (f) => f.name === '2024' && f.parents[0] === facturas.id
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
