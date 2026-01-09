import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  findCatalogFile,
  readCatalog,
  writeCatalog,
  propertyExists,
  addProperty,
  listProperties,
  deleteProperty,
  archiveProperty,
  listArchivedProperties,
  unarchiveProperty,
} from '../src/repositories/propertyCatalogRepository.js';

describe('findCatalogFile', () => {
  it('devuelve archivo si existe', async () => {
    const mockDrive = {
      files: {
        list: vi.fn().mockResolvedValue({
          data: {
            files: [{ id: 'catalog-id', name: '.properties.json' }],
          },
        }),
      },
    };

    const result = await findCatalogFile({ drive: mockDrive, folderId: 'folder-id' });

    expect(result).toEqual({ id: 'catalog-id', name: '.properties.json' });
    expect(mockDrive.files.list).toHaveBeenCalledWith({
      q: "name='.properties.json' and 'folder-id' in parents and trashed=false",
      fields: 'files(id, name)',
      spaces: 'drive',
    });
  });

  it('devuelve null si no existe', async () => {
    const mockDrive = {
      files: {
        list: vi.fn().mockResolvedValue({
          data: {
            files: [],
          },
        }),
      },
    };

    const result = await findCatalogFile({ drive: mockDrive, folderId: 'folder-id' });

    expect(result).toBeNull();
  });
});

describe('readCatalog', () => {
  it('crea catálogo vacío si no existe archivo', async () => {
    const mockDrive = {
      files: {
        list: vi.fn().mockResolvedValue({
          data: { files: [] },
        }),
      },
    };

    const result = await readCatalog({ drive: mockDrive, folderId: 'folder-id' });

    expect(result).toHaveProperty('version', 1);
    expect(result).toHaveProperty('updatedAt');
    expect(result).toHaveProperty('properties');
    expect(result.properties).toEqual([]);
  });

  it('lee catálogo existente correctamente', async () => {
    const catalogData = {
      version: 1,
      updatedAt: '2024-01-01T00:00:00.000Z',
      properties: [
        {
          address: 'Calle Mayor 123',
          normalizedAddress: 'Calle Mayor 123',
          propertyFolderId: 'folder-123',
          createdAt: '2024-01-01T00:00:00.000Z',
        },
      ],
    };

    const mockDrive = {
      files: {
        list: vi.fn().mockResolvedValue({
          data: {
            files: [{ id: 'catalog-id', name: '.properties.json' }],
          },
        }),
        get: vi.fn().mockResolvedValue({
          data: JSON.stringify(catalogData),
        }),
      },
    };

    const result = await readCatalog({ drive: mockDrive, folderId: 'folder-id' });

    expect(result).toEqual(catalogData);
    expect(mockDrive.files.get).toHaveBeenCalledWith(
      { fileId: 'catalog-id', alt: 'media' },
      { responseType: 'text' }
    );
  });

  it('lanza error si el JSON está corrupto', async () => {
    const mockDrive = {
      files: {
        list: vi.fn().mockResolvedValue({
          data: {
            files: [{ id: 'catalog-id', name: '.properties.json' }],
          },
        }),
        get: vi.fn().mockResolvedValue({
          data: 'invalid json {{{',
        }),
      },
    };

    await expect(
      readCatalog({ drive: mockDrive, folderId: 'folder-id' })
    ).rejects.toThrow('Catalog JSON is corrupted');
  });

  it('lanza error si falta version en el JSON', async () => {
    const mockDrive = {
      files: {
        list: vi.fn().mockResolvedValue({
          data: {
            files: [{ id: 'catalog-id', name: '.properties.json' }],
          },
        }),
        get: vi.fn().mockResolvedValue({
          data: JSON.stringify({ properties: [] }),
        }),
      },
    };

    await expect(
      readCatalog({ drive: mockDrive, folderId: 'folder-id' })
    ).rejects.toThrow('Catalog JSON has invalid structure');
  });

  it('lanza error si properties no es un array', async () => {
    const mockDrive = {
      files: {
        list: vi.fn().mockResolvedValue({
          data: {
            files: [{ id: 'catalog-id', name: '.properties.json' }],
          },
        }),
        get: vi.fn().mockResolvedValue({
          data: JSON.stringify({ version: 1, properties: 'not-an-array' }),
        }),
      },
    };

    await expect(
      readCatalog({ drive: mockDrive, folderId: 'folder-id' })
    ).rejects.toThrow('Catalog JSON has invalid structure');
  });
});

describe('writeCatalog', () => {
  it('actualiza archivo existente', async () => {
    const mockDrive = {
      files: {
        list: vi.fn().mockResolvedValue({
          data: {
            files: [{ id: 'catalog-id', name: '.properties.json' }],
          },
        }),
        update: vi.fn().mockResolvedValue({}),
      },
    };

    const catalog = {
      version: 1,
      updatedAt: '2024-01-01T00:00:00.000Z',
      properties: [],
    };

    await writeCatalog({ drive: mockDrive, folderId: 'folder-id', catalog });

    expect(mockDrive.files.update).toHaveBeenCalledWith({
      fileId: 'catalog-id',
      media: {
        mimeType: 'application/json',
        body: expect.any(Object),
      },
    });
  });

  it('crea archivo nuevo si no existe', async () => {
    const mockUploadStreamToDrive = vi.fn().mockResolvedValue({});

    const mockDrive = {
      files: {
        list: vi.fn().mockResolvedValue({
          data: { files: [] },
        }),
        create: mockUploadStreamToDrive,
      },
    };

    const catalog = {
      version: 1,
      updatedAt: '2024-01-01T00:00:00.000Z',
      properties: [],
    };

    await writeCatalog({ drive: mockDrive, folderId: 'folder-id', catalog });

    expect(mockDrive.files.create).toHaveBeenCalled();
  });

  it('actualiza el campo updatedAt automáticamente', async () => {
    const mockDrive = {
      files: {
        list: vi.fn().mockResolvedValue({
          data: {
            files: [{ id: 'catalog-id', name: '.properties.json' }],
          },
        }),
        update: vi.fn().mockResolvedValue({}),
      },
    };

    const catalog = {
      version: 1,
      updatedAt: '2020-01-01T00:00:00.000Z',
      properties: [],
    };

    await writeCatalog({ drive: mockDrive, folderId: 'folder-id', catalog });

    expect(catalog.updatedAt).not.toBe('2020-01-01T00:00:00.000Z');
    expect(new Date(catalog.updatedAt).getTime()).toBeGreaterThan(
      new Date('2020-01-01T00:00:00.000Z').getTime()
    );
  });
});

describe('propertyExists', () => {
  it('devuelve true si la vivienda existe por normalizedAddress', async () => {
    const catalogData = {
      version: 1,
      updatedAt: '2024-01-01T00:00:00.000Z',
      properties: [
        {
          address: 'Calle Mayor 123',
          normalizedAddress: 'calle mayor 123',
          propertyFolderId: 'folder-123',
          createdAt: '2024-01-01T00:00:00.000Z',
        },
      ],
    };

    const mockDrive = {
      files: {
        list: vi.fn().mockResolvedValue({
          data: {
            files: [{ id: 'catalog-id', name: '.properties.json' }],
          },
        }),
        get: vi.fn().mockResolvedValue({
          data: JSON.stringify(catalogData),
        }),
      },
    };

    const result = await propertyExists({
      drive: mockDrive,
      folderId: 'folder-id',
      normalizedAddress: 'calle mayor 123',
    });

    expect(result).toBe(true);
  });

  it('devuelve false si la vivienda no existe', async () => {
    const catalogData = {
      version: 1,
      updatedAt: '2024-01-01T00:00:00.000Z',
      properties: [],
    };

    const mockDrive = {
      files: {
        list: vi.fn().mockResolvedValue({
          data: {
            files: [{ id: 'catalog-id', name: '.properties.json' }],
          },
        }),
        get: vi.fn().mockResolvedValue({
          data: JSON.stringify(catalogData),
        }),
      },
    };

    const result = await propertyExists({
      drive: mockDrive,
      folderId: 'folder-id',
      normalizedAddress: 'calle inexistente',
    });

    expect(result).toBe(false);
  });
});

describe('addProperty', () => {
  let mockDrive;

  beforeEach(() => {
    mockDrive = {
      files: {
        list: vi.fn().mockResolvedValue({
          data: {
            files: [{ id: 'catalog-id', name: '.properties.json' }],
          },
        }),
        get: vi.fn().mockResolvedValue({
          data: JSON.stringify({
            version: 1,
            updatedAt: '2024-01-01T00:00:00.000Z',
            properties: [],
          }),
        }),
        update: vi.fn().mockResolvedValue({}),
      },
    };
  });

  it('añade vivienda nueva al catálogo', async () => {
    const property = {
      address: 'Calle Nueva 456',
      normalizedAddress: 'calle nueva 456',
      propertyFolderId: 'folder-456',
      createdAt: '2024-01-01T00:00:00.000Z',
    };

    await addProperty({ drive: mockDrive, folderId: 'folder-id', property });

    expect(mockDrive.files.update).toHaveBeenCalled();
  });

  it('lanza error si la vivienda ya existe', async () => {
    mockDrive.files.get.mockResolvedValue({
      data: JSON.stringify({
        version: 1,
        updatedAt: '2024-01-01T00:00:00.000Z',
        properties: [
          {
            address: 'Calle Mayor 123',
            normalizedAddress: 'calle mayor 123',
            propertyFolderId: 'folder-123',
            createdAt: '2024-01-01T00:00:00.000Z',
          },
        ],
      }),
    });

    const property = {
      address: 'Calle Mayor 123',
      normalizedAddress: 'calle mayor 123',
      propertyFolderId: 'folder-123',
    };

    await expect(
      addProperty({ drive: mockDrive, folderId: 'folder-id', property })
    ).rejects.toThrow('Property already exists');
  });

  it('añade createdAt automáticamente si no se proporciona', async () => {
    const property = {
      address: 'Calle Sin Fecha',
      normalizedAddress: 'calle sin fecha',
      propertyFolderId: 'folder-999',
    };

    await addProperty({ drive: mockDrive, folderId: 'folder-id', property });

    const updateCall = mockDrive.files.update.mock.calls[0][0];
    expect(updateCall.media.body).toBeDefined();
  });
});

describe('listProperties', () => {
  it('devuelve lista ordenada alfabéticamente por dirección', async () => {
    const catalogData = {
      version: 1,
      updatedAt: '2024-01-01T00:00:00.000Z',
      properties: [
        {
          address: 'Calle Zeta 789',
          normalizedAddress: 'calle zeta 789',
          propertyFolderId: 'folder-789',
          createdAt: '2024-01-01T00:00:00.000Z',
        },
        {
          address: 'Avenida Alpha 123',
          normalizedAddress: 'avenida alpha 123',
          propertyFolderId: 'folder-123',
          createdAt: '2024-01-01T00:00:00.000Z',
        },
        {
          address: 'Boulevard Beta 456',
          normalizedAddress: 'boulevard beta 456',
          propertyFolderId: 'folder-456',
          createdAt: '2024-01-01T00:00:00.000Z',
        },
      ],
    };

    const mockDrive = {
      files: {
        list: vi.fn().mockResolvedValue({
          data: {
            files: [{ id: 'catalog-id', name: '.properties.json' }],
          },
        }),
        get: vi.fn().mockResolvedValue({
          data: JSON.stringify(catalogData),
        }),
      },
    };

    const result = await listProperties({ drive: mockDrive, folderId: 'folder-id' });

    expect(result).toHaveLength(3);
    expect(result[0].address).toBe('Avenida Alpha 123');
    expect(result[1].address).toBe('Boulevard Beta 456');
    expect(result[2].address).toBe('Calle Zeta 789');
  });

  it('devuelve lista vacía si no hay viviendas', async () => {
    const mockDrive = {
      files: {
        list: vi.fn().mockResolvedValue({
          data: { files: [] },
        }),
      },
    };

    const result = await listProperties({ drive: mockDrive, folderId: 'folder-id' });

    expect(result).toEqual([]);
  });
});

describe('deleteProperty', () => {
  it('marca vivienda como deleted en el catálogo', async () => {
    const mockDrive = {
      files: {
        list: vi.fn().mockResolvedValue({
          data: {
            files: [{ id: 'catalog-id', name: '.properties.json' }],
          },
        }),
        get: vi.fn().mockResolvedValue({
          data: JSON.stringify({
            version: 1,
            updatedAt: '2024-01-01T00:00:00.000Z',
            properties: [
              {
                address: 'Calle Test 123',
                normalizedAddress: 'Calle Test 123',
                propertyFolderId: 'folder-123',
                createdAt: '2024-01-01T00:00:00.000Z',
                status: 'active',
              },
              {
                address: 'Calle Test 456',
                normalizedAddress: 'Calle Test 456',
                propertyFolderId: 'folder-456',
                createdAt: '2024-01-01T00:00:00.000Z',
                status: 'active',
              },
            ],
          }),
        }),
        update: vi.fn().mockResolvedValue({}),
      },
    };

    const result = await deleteProperty({
      drive: mockDrive,
      folderId: 'folder-id',
      normalizedAddress: 'Calle Test 123',
    });

    expect(result.address).toBe('Calle Test 123');
    expect(result.status).toBe('deleted');
    expect(result.deletedAt).toBeDefined();
    expect(mockDrive.files.update).toHaveBeenCalled();
  });

  it('lanza error si la vivienda no existe', async () => {
    const mockDrive = {
      files: {
        list: vi.fn().mockResolvedValue({
          data: {
            files: [{ id: 'catalog-id', name: '.properties.json' }],
          },
        }),
        get: vi.fn().mockResolvedValue({
          data: JSON.stringify({
            version: 1,
            updatedAt: '2024-01-01T00:00:00.000Z',
            properties: [],
          }),
        }),
      },
    };

    await expect(
      deleteProperty({
        drive: mockDrive,
        folderId: 'folder-id',
        normalizedAddress: 'No Existe',
      })
    ).rejects.toThrow('Property not found');
  });

  it('no permite eliminar una vivienda ya marcada como deleted', async () => {
    const mockDrive = {
      files: {
        list: vi.fn().mockResolvedValue({
          data: {
            files: [{ id: 'catalog-id', name: '.properties.json' }],
          },
        }),
        get: vi.fn().mockResolvedValue({
          data: JSON.stringify({
            version: 1,
            updatedAt: '2024-01-01T00:00:00.000Z',
            properties: [
              {
                address: 'Calle Test 123',
                normalizedAddress: 'Calle Test 123',
                propertyFolderId: 'folder-123',
                status: 'deleted',
                deletedAt: '2024-01-01T00:00:00.000Z',
              },
            ],
          }),
        }),
      },
    };

    await expect(
      deleteProperty({
        drive: mockDrive,
        folderId: 'folder-id',
        normalizedAddress: 'Calle Test 123',
      })
    ).rejects.toThrow('Property not found');
  });
});

describe('archiveProperty', () => {
  it('marca vivienda como archived en el catálogo', async () => {
    const mockDrive = {
      files: {
        list: vi.fn().mockResolvedValue({
          data: {
            files: [{ id: 'catalog-id', name: '.properties.json' }],
          },
        }),
        get: vi.fn().mockResolvedValue({
          data: JSON.stringify({
            version: 1,
            updatedAt: '2024-01-01T00:00:00.000Z',
            properties: [
              {
                address: 'Calle Test 123',
                normalizedAddress: 'Calle Test 123',
                propertyFolderId: 'folder-123',
                createdAt: '2024-01-01T00:00:00.000Z',
                status: 'active',
              },
            ],
          }),
        }),
        update: vi.fn().mockResolvedValue({}),
      },
    };

    const result = await archiveProperty({
      drive: mockDrive,
      folderId: 'folder-id',
      normalizedAddress: 'Calle Test 123',
    });

    expect(result.address).toBe('Calle Test 123');
    expect(result.status).toBe('archived');
    expect(result.archivedAt).toBeDefined();
    expect(mockDrive.files.update).toHaveBeenCalled();
  });

  it('lanza error si la vivienda no está activa', async () => {
    const mockDrive = {
      files: {
        list: vi.fn().mockResolvedValue({
          data: {
            files: [{ id: 'catalog-id', name: '.properties.json' }],
          },
        }),
        get: vi.fn().mockResolvedValue({
          data: JSON.stringify({
            version: 1,
            updatedAt: '2024-01-01T00:00:00.000Z',
            properties: [],
          }),
        }),
      },
    };

    await expect(
      archiveProperty({
        drive: mockDrive,
        folderId: 'folder-id',
        normalizedAddress: 'No Existe',
      })
    ).rejects.toThrow('Property not found');
  });
});

describe('listArchivedProperties', () => {
  it('devuelve solo viviendas archivadas ordenadas alfabéticamente', async () => {
    const catalogData = {
      version: 1,
      updatedAt: '2024-01-01T00:00:00.000Z',
      properties: [
        {
          address: 'Calle Zeta 789',
          normalizedAddress: 'calle zeta 789',
          propertyFolderId: 'folder-789',
          createdAt: '2024-01-01T00:00:00.000Z',
          status: 'archived',
          archivedAt: '2024-01-02T00:00:00.000Z',
        },
        {
          address: 'Avenida Alpha 123',
          normalizedAddress: 'avenida alpha 123',
          propertyFolderId: 'folder-123',
          createdAt: '2024-01-01T00:00:00.000Z',
          status: 'active',
        },
        {
          address: 'Boulevard Beta 456',
          normalizedAddress: 'boulevard beta 456',
          propertyFolderId: 'folder-456',
          createdAt: '2024-01-01T00:00:00.000Z',
          status: 'archived',
          archivedAt: '2024-01-03T00:00:00.000Z',
        },
      ],
    };

    const mockDrive = {
      files: {
        list: vi.fn().mockResolvedValue({
          data: {
            files: [{ id: 'catalog-id', name: '.properties.json' }],
          },
        }),
        get: vi.fn().mockResolvedValue({
          data: JSON.stringify(catalogData),
        }),
      },
    };

    const result = await listArchivedProperties({ drive: mockDrive, folderId: 'folder-id' });

    expect(result).toHaveLength(2);
    expect(result[0].address).toBe('Boulevard Beta 456');
    expect(result[1].address).toBe('Calle Zeta 789');
  });

  it('devuelve lista vacía si no hay viviendas archivadas', async () => {
    const mockDrive = {
      files: {
        list: vi.fn().mockResolvedValue({
          data: { files: [] },
        }),
      },
    };

    const result = await listArchivedProperties({ drive: mockDrive, folderId: 'folder-id' });

    expect(result).toEqual([]);
  });
});

describe('unarchiveProperty', () => {
  it('marca vivienda archivada como active', async () => {
    const mockDrive = {
      files: {
        list: vi.fn().mockResolvedValue({
          data: {
            files: [{ id: 'catalog-id', name: '.properties.json' }],
          },
        }),
        get: vi.fn().mockResolvedValue({
          data: JSON.stringify({
            version: 1,
            updatedAt: '2024-01-01T00:00:00.000Z',
            properties: [
              {
                address: 'Calle Test 123',
                normalizedAddress: 'Calle Test 123',
                propertyFolderId: 'folder-123',
                createdAt: '2024-01-01T00:00:00.000Z',
                status: 'archived',
                archivedAt: '2024-01-02T00:00:00.000Z',
              },
            ],
          }),
        }),
        update: vi.fn().mockResolvedValue({}),
      },
    };

    const result = await unarchiveProperty({
      drive: mockDrive,
      folderId: 'folder-id',
      normalizedAddress: 'Calle Test 123',
    });

    expect(result.address).toBe('Calle Test 123');
    expect(result.status).toBe('active');
    expect(result.unarchivedAt).toBeDefined();
    expect(mockDrive.files.update).toHaveBeenCalled();
  });

  it('lanza error si la vivienda no está archivada', async () => {
    const mockDrive = {
      files: {
        list: vi.fn().mockResolvedValue({
          data: {
            files: [{ id: 'catalog-id', name: '.properties.json' }],
          },
        }),
        get: vi.fn().mockResolvedValue({
          data: JSON.stringify({
            version: 1,
            updatedAt: '2024-01-01T00:00:00.000Z',
            properties: [
              {
                address: 'Calle Test 123',
                normalizedAddress: 'Calle Test 123',
                propertyFolderId: 'folder-123',
                status: 'active',
              },
            ],
          }),
        }),
      },
    };

    await expect(
      unarchiveProperty({
        drive: mockDrive,
        folderId: 'folder-id',
        normalizedAddress: 'Calle Test 123',
      })
    ).rejects.toThrow('Archived property not found');
  });
});
