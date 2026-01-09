import { describe, it, expect, vi } from 'vitest';
import { addProperty, listProperties, deleteProperty, archiveProperty, listArchivedProperties, unarchiveProperty } from '../src/services/propertyService.js';

describe('addProperty', () => {
  it('crea vivienda nueva exitosamente', async () => {
    const mockDrive = {
      files: {
        list: vi.fn().mockResolvedValue({ data: { files: [] } }),
        create: vi.fn().mockResolvedValue({
          data: { id: 'new-folder-id', name: 'Calle Test 123' },
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

    const result = await addProperty({
      drive: mockDrive,
      baseFolderId: 'base-folder-id',
      address: 'Calle Test 123',
    });

    expect(result.success).toBe(true);
    expect(result.message).toContain('Calle Test 123');
    expect(result.message).toContain('creada con éxito');
  });

  it('devuelve error si la vivienda ya existe', async () => {
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
              },
            ],
          }),
        }),
      },
    };

    const result = await addProperty({
      drive: mockDrive,
      baseFolderId: 'base-folder-id',
      address: 'Calle Test 123',
    });

    expect(result.success).toBe(false);
    expect(result.message).toBe('La vivienda ya existe');
  });

  it('normaliza la dirección antes de verificar duplicados', async () => {
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
              },
            ],
          }),
        }),
      },
    };

    const result = await addProperty({
      drive: mockDrive,
      baseFolderId: 'base-folder-id',
      address: '  Calle   Test    123  ',
    });

    expect(result.success).toBe(false);
    expect(result.message).toBe('La vivienda ya existe');
  });

  it('usa el año actual para crear las carpetas', async () => {
    const mockDrive = {
      files: {
        list: vi.fn().mockResolvedValue({ data: { files: [] } }),
        create: vi.fn().mockResolvedValue({
          data: { id: 'new-folder-id', name: 'Test' },
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

    const currentYear = String(new Date().getFullYear());

    await addProperty({
      drive: mockDrive,
      baseFolderId: 'base-folder-id',
      address: 'Calle Test',
    });

    const createCalls = mockDrive.files.create.mock.calls;
    const yearFolders = createCalls.filter(
      (call) => call[0].requestBody.name === currentYear
    );
    expect(yearFolders.length).toBeGreaterThan(0);
  });

  it('lanza error si falta drive', async () => {
    await expect(
      addProperty({
        drive: null,
        baseFolderId: 'base-folder-id',
        address: 'Calle Test',
      })
    ).rejects.toThrow('Drive client is required');
  });

  it('lanza error si falta baseFolderId', async () => {
    const mockDrive = { files: {} };

    await expect(
      addProperty({
        drive: mockDrive,
        baseFolderId: '',
        address: 'Calle Test',
      })
    ).rejects.toThrow('Base folder ID is required');
  });

  it('lanza error si falta address', async () => {
    const mockDrive = { files: {} };

    await expect(
      addProperty({
        drive: mockDrive,
        baseFolderId: 'base-folder-id',
        address: '',
      })
    ).rejects.toThrow('Address is required');
  });

  it('lanza error si la dirección queda vacía tras normalización', async () => {
    const mockDrive = { files: {} };

    await expect(
      addProperty({
        drive: mockDrive,
        baseFolderId: 'base-folder-id',
        address: '     ',
      })
    ).rejects.toThrow('Address cannot be empty after normalization');
  });
});

describe('listProperties', () => {
  it('devuelve lista de viviendas ordenadas', async () => {
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
                address: 'Calle Zeta 789',
                normalizedAddress: 'Calle Zeta 789',
                propertyFolderId: 'folder-789',
                createdAt: '2024-01-01T00:00:00.000Z',
              },
              {
                address: 'Avenida Alpha 123',
                normalizedAddress: 'Avenida Alpha 123',
                propertyFolderId: 'folder-123',
                createdAt: '2024-01-01T00:00:00.000Z',
              },
            ],
          }),
        }),
      },
    };

    const result = await listProperties({
      drive: mockDrive,
      baseFolderId: 'base-folder-id',
    });

    expect(result.properties).toHaveLength(2);
    expect(result.properties[0].address).toBe('Avenida Alpha 123');
    expect(result.properties[1].address).toBe('Calle Zeta 789');
    expect(result.message).toBeNull();
  });

  it('devuelve mensaje apropiado si no hay viviendas', async () => {
    const mockDrive = {
      files: {
        list: vi.fn().mockResolvedValue({
          data: { files: [] },
        }),
      },
    };

    const result = await listProperties({
      drive: mockDrive,
      baseFolderId: 'base-folder-id',
    });

    expect(result.properties).toEqual([]);
    expect(result.message).toContain('/add_property');
  });

  it('lanza error si falta drive', async () => {
    await expect(
      listProperties({
        drive: null,
        baseFolderId: 'base-folder-id',
      })
    ).rejects.toThrow('Drive client is required');
  });

  it('lanza error si falta baseFolderId', async () => {
    const mockDrive = { files: {} };

    await expect(
      listProperties({
        drive: mockDrive,
        baseFolderId: '',
      })
    ).rejects.toThrow('Base folder ID is required');
  });
});

describe('deleteProperty', () => {
  it('elimina vivienda del catálogo y de Drive', async () => {
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
        delete: vi.fn().mockResolvedValue({}),
      },
    };

    const result = await deleteProperty({
      drive: mockDrive,
      baseFolderId: 'base-folder-id',
      normalizedAddress: 'Calle Test 123',
    });

    expect(result.success).toBe(true);
    expect(result.message).toContain('eliminada del catálogo y de Drive');
    expect(result.property.address).toBe('Calle Test 123');
    expect(mockDrive.files.delete).toHaveBeenCalledWith({
      fileId: 'folder-123',
    });
  });

  it('lanza error si falta drive', async () => {
    await expect(
      deleteProperty({
        drive: null,
        baseFolderId: 'base-id',
        normalizedAddress: 'Test',
      })
    ).rejects.toThrow('Drive client is required');
  });

  it('lanza error si falta baseFolderId', async () => {
    const mockDrive = { files: {} };

    await expect(
      deleteProperty({
        drive: mockDrive,
        baseFolderId: '',
        normalizedAddress: 'Test',
      })
    ).rejects.toThrow('Base folder ID is required');
  });

  it('lanza error si falta normalizedAddress', async () => {
    const mockDrive = { files: {} };

    await expect(
      deleteProperty({
        drive: mockDrive,
        baseFolderId: 'base-id',
        normalizedAddress: '',
      })
    ).rejects.toThrow('Normalized address is required');
  });

  it('propaga error del repository si la vivienda no existe', async () => {
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
        baseFolderId: 'base-id',
        normalizedAddress: 'No Existe',
      })
    ).rejects.toThrow('Property not found');
  });
});

describe('archiveProperty', () => {
  it('archiva vivienda creando carpeta Archivo y moviendo la vivienda', async () => {
    const mockDrive = {
      files: {
        list: vi.fn().mockResolvedValue({
          data: {
            files: [{ id: 'catalog-id', name: '.properties.json' }],
          },
        }),
        get: vi.fn().mockImplementation(async ({ fileId }) => {
          if (fileId === 'catalog-id') {
            return {
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
            };
          }
          return { data: { parents: ['old-parent'] } };
        }),
        update: vi.fn().mockResolvedValue({}),
        create: vi.fn().mockResolvedValue({
          data: { id: 'archivo-folder-id', name: 'Archivo' },
        }),
      },
    };

    const result = await archiveProperty({
      drive: mockDrive,
      baseFolderId: 'base-folder-id',
      normalizedAddress: 'Calle Test 123',
    });

    expect(result.success).toBe(true);
    expect(result.message).toContain('archivada correctamente');
    expect(result.property.address).toBe('Calle Test 123');
  });

  it('lanza error si falta drive', async () => {
    await expect(
      archiveProperty({
        drive: null,
        baseFolderId: 'base-id',
        normalizedAddress: 'Test',
      })
    ).rejects.toThrow('Drive client is required');
  });

  it('lanza error si falta baseFolderId', async () => {
    const mockDrive = { files: {} };

    await expect(
      archiveProperty({
        drive: mockDrive,
        baseFolderId: '',
        normalizedAddress: 'Test',
      })
    ).rejects.toThrow('Base folder ID is required');
  });

  it('lanza error si falta normalizedAddress', async () => {
    const mockDrive = { files: {} };

    await expect(
      archiveProperty({
        drive: mockDrive,
        baseFolderId: 'base-id',
        normalizedAddress: '',
      })
    ).rejects.toThrow('Normalized address is required');
  });
});

describe('listArchivedProperties', () => {
  it('devuelve lista de viviendas archivadas', async () => {
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
                address: 'Calle Archived 789',
                normalizedAddress: 'Calle Archived 789',
                propertyFolderId: 'folder-789',
                createdAt: '2024-01-01T00:00:00.000Z',
                status: 'archived',
                archivedAt: '2024-01-02T00:00:00.000Z',
              },
              {
                address: 'Avenida Active 123',
                normalizedAddress: 'Avenida Active 123',
                propertyFolderId: 'folder-123',
                createdAt: '2024-01-01T00:00:00.000Z',
                status: 'active',
              },
            ],
          }),
        }),
      },
    };

    const result = await listArchivedProperties({
      drive: mockDrive,
      baseFolderId: 'base-folder-id',
    });

    expect(result.properties).toHaveLength(1);
    expect(result.properties[0].address).toBe('Calle Archived 789');
    expect(result.message).toBeNull();
  });

  it('devuelve mensaje apropiado si no hay viviendas archivadas', async () => {
    const mockDrive = {
      files: {
        list: vi.fn().mockResolvedValue({
          data: { files: [] },
        }),
      },
    };

    const result = await listArchivedProperties({
      drive: mockDrive,
      baseFolderId: 'base-folder-id',
    });

    expect(result.properties).toEqual([]);
    expect(result.message).toContain('No hay viviendas archivadas');
  });

  it('lanza error si falta drive', async () => {
    await expect(
      listArchivedProperties({
        drive: null,
        baseFolderId: 'base-folder-id',
      })
    ).rejects.toThrow('Drive client is required');
  });

  it('lanza error si falta baseFolderId', async () => {
    const mockDrive = { files: {} };

    await expect(
      listArchivedProperties({
        drive: mockDrive,
        baseFolderId: '',
      })
    ).rejects.toThrow('Base folder ID is required');
  });
});

describe('unarchiveProperty', () => {
  it('reactiva vivienda archivada moviéndola a Viviendas', async () => {
    const mockDrive = {
      files: {
        list: vi.fn().mockResolvedValue({
          data: {
            files: [{ id: 'catalog-id', name: '.properties.json' }],
          },
        }),
        get: vi.fn().mockImplementation(async ({ fileId }) => {
          if (fileId === 'catalog-id') {
            return {
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
            };
          }
          return { data: { parents: ['archivo-folder'] } };
        }),
        update: vi.fn().mockResolvedValue({}),
        create: vi.fn().mockResolvedValue({
          data: { id: 'viviendas-folder-id', name: 'Viviendas' },
        }),
      },
    };

    const result = await unarchiveProperty({
      drive: mockDrive,
      baseFolderId: 'base-folder-id',
      normalizedAddress: 'Calle Test 123',
    });

    expect(result.success).toBe(true);
    expect(result.message).toContain('reactivada correctamente');
    expect(result.property.address).toBe('Calle Test 123');
  });

  it('lanza error si falta drive', async () => {
    await expect(
      unarchiveProperty({
        drive: null,
        baseFolderId: 'base-id',
        normalizedAddress: 'Test',
      })
    ).rejects.toThrow('Drive client is required');
  });

  it('lanza error si falta baseFolderId', async () => {
    const mockDrive = { files: {} };

    await expect(
      unarchiveProperty({
        drive: mockDrive,
        baseFolderId: '',
        normalizedAddress: 'Test',
      })
    ).rejects.toThrow('Base folder ID is required');
  });

  it('lanza error si falta normalizedAddress', async () => {
    const mockDrive = { files: {} };

    await expect(
      unarchiveProperty({
        drive: mockDrive,
        baseFolderId: 'base-id',
        normalizedAddress: '',
      })
    ).rejects.toThrow('Normalized address is required');
  });
});
