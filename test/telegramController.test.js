import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { initializePropertyHandlers } from '../src/controllers/telegramController.js';
import * as diagnosticsService from '../src/services/diagnosticsService.js';

vi.mock('../src/services/diagnosticsService.js');

describe('initializePropertyHandlers', () => {
  let mockBot;
  let mockDrive;
  let commandHandlers;
  let textHandlers;
  let originalEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    commandHandlers = {};
    textHandlers = [];

    mockBot = {
      onText: vi.fn((pattern, handler) => {
        const patternStr = pattern.toString();
        if (patternStr.includes('unarchive_property')) {
          commandHandlers.unarchive_property = handler;
        } else if (patternStr.includes('archive_property')) {
          commandHandlers.archive_property = handler;
        } else if (patternStr.includes('add_property')) {
          commandHandlers.add_property = handler;
        } else if (patternStr.includes('list_archived')) {
          commandHandlers.list_archived = handler;
        } else if (patternStr.includes('list_properties')) {
          commandHandlers.list_properties = handler;
        } else if (patternStr.includes('delete_property')) {
          commandHandlers.delete_property = handler;
        } else if (patternStr.includes('version')) {
          commandHandlers.version = handler;
        } else if (patternStr.includes('status')) {
          commandHandlers.status = handler;
        }
      }),
      sendMessage: vi.fn().mockResolvedValue({}),
    };

    mockDrive = {
      files: {
        list: vi.fn().mockResolvedValue({ data: { files: [] } }),
        get: vi.fn().mockResolvedValue({
          data: JSON.stringify({
            version: 1,
            updatedAt: '2024-01-01T00:00:00.000Z',
            properties: [],
          }),
        }),
        create: vi.fn().mockResolvedValue({
          data: { id: 'new-folder-id', name: 'Test' },
        }),
        update: vi.fn().mockResolvedValue({}),
        delete: vi.fn().mockResolvedValue({}),
      },
    };
  });

  it('lanza error si falta bot', () => {
    expect(() =>
      initializePropertyHandlers({
        bot: null,
        drive: mockDrive,
        baseFolderId: 'base-id',
      })
    ).toThrow('Bot is required');
  });

  it('lanza error si falta drive', () => {
    expect(() =>
      initializePropertyHandlers({
        bot: mockBot,
        drive: null,
        baseFolderId: 'base-id',
      })
    ).toThrow('Drive client is required');
  });

  it('lanza error si falta baseFolderId', () => {
    expect(() =>
      initializePropertyHandlers({
        bot: mockBot,
        drive: mockDrive,
        baseFolderId: '',
      })
    ).toThrow('Base folder ID is required');
  });

  it('registra el handler de /add_property', () => {
    initializePropertyHandlers({
      bot: mockBot,
      drive: mockDrive,
      baseFolderId: 'base-id',
    });

    expect(mockBot.onText).toHaveBeenCalledWith(
      expect.objectContaining({ source: expect.stringContaining('add_property') }),
      expect.any(Function)
    );
  });

  it('registra el handler de /list_properties', () => {
    initializePropertyHandlers({
      bot: mockBot,
      drive: mockDrive,
      baseFolderId: 'base-id',
    });

    expect(mockBot.onText).toHaveBeenCalledWith(
      expect.objectContaining({ source: expect.stringContaining('list_properties') }),
      expect.any(Function)
    );
  });

  it('/add_property pide la dirección al usuario', async () => {
    initializePropertyHandlers({
      bot: mockBot,
      drive: mockDrive,
      baseFolderId: 'base-id',
    });

    const msg = {
      chat: { id: 123 },
      from: { id: 456 },
      text: '/add_property',
    };

    await commandHandlers.add_property(msg);

    expect(mockBot.sendMessage).toHaveBeenCalledWith(
      123,
      expect.stringContaining('dirección')
    );
  });

  it('/list_properties muestra mensaje si no hay viviendas', async () => {
    initializePropertyHandlers({
      bot: mockBot,
      drive: mockDrive,
      baseFolderId: 'base-id',
    });

    const msg = {
      chat: { id: 123 },
      from: { id: 456 },
      text: '/list_properties',
    };

    await commandHandlers.list_properties(msg);

    expect(mockBot.sendMessage).toHaveBeenCalledWith(
      123,
      expect.stringContaining('/add_property')
    );
  });

  it('/list_properties muestra lista de viviendas', async () => {
    mockDrive.files.get.mockResolvedValue({
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
          {
            address: 'Avenida Principal 456',
            normalizedAddress: 'Avenida Principal 456',
            propertyFolderId: 'folder-456',
            createdAt: '2024-01-01T00:00:00.000Z',
          },
        ],
      }),
    });

    mockDrive.files.list.mockResolvedValue({
      data: {
        files: [{ id: 'catalog-id', name: '.properties.json' }],
      },
    });

    initializePropertyHandlers({
      bot: mockBot,
      drive: mockDrive,
      baseFolderId: 'base-id',
    });

    const msg = {
      chat: { id: 123 },
      from: { id: 456 },
      text: '/list_properties',
    };

    await commandHandlers.list_properties(msg);

    const call = mockBot.sendMessage.mock.calls[0];
    expect(call[1]).toContain('Avenida Principal 456');
    expect(call[1]).toContain('Calle Test 123');
  });

  it('handleTextMessage procesa dirección tras /add_property', async () => {
    const controller = initializePropertyHandlers({
      bot: mockBot,
      drive: mockDrive,
      baseFolderId: 'base-id',
    });

    const addPropertyMsg = {
      chat: { id: 123 },
      from: { id: 456 },
      text: '/add_property',
    };

    await commandHandlers.add_property(addPropertyMsg);

    mockBot.sendMessage.mockClear();

    const addressMsg = {
      chat: { id: 123 },
      from: { id: 456 },
      text: 'Calle Nueva 789',
    };

    const handled = await controller.handleTextMessage(addressMsg);

    expect(handled).toBe(true);
    expect(mockBot.sendMessage).toHaveBeenCalledWith(
      123,
      expect.stringContaining('creada con éxito')
    );
  });

  it('handleTextMessage devuelve false si no hay estado pendiente', async () => {
    const controller = initializePropertyHandlers({
      bot: mockBot,
      drive: mockDrive,
      baseFolderId: 'base-id',
    });

    const msg = {
      chat: { id: 123 },
      from: { id: 456 },
      text: 'Texto cualquiera',
    };

    const handled = await controller.handleTextMessage(msg);

    expect(handled).toBe(false);
  });

  it('handleTextMessage muestra error si la vivienda ya existe', async () => {
    mockDrive.files.list.mockResolvedValue({
      data: {
        files: [{ id: 'catalog-id', name: '.properties.json' }],
      },
    });

    mockDrive.files.get.mockResolvedValue({
      data: JSON.stringify({
        version: 1,
        updatedAt: '2024-01-01T00:00:00.000Z',
        properties: [
          {
            address: 'Calle Duplicada',
            normalizedAddress: 'Calle Duplicada',
            propertyFolderId: 'folder-123',
            createdAt: '2024-01-01T00:00:00.000Z',
          },
        ],
      }),
    });

    const controller = initializePropertyHandlers({
      bot: mockBot,
      drive: mockDrive,
      baseFolderId: 'base-id',
    });

    const addPropertyMsg = {
      chat: { id: 123 },
      from: { id: 456 },
      text: '/add_property',
    };

    await commandHandlers.add_property(addPropertyMsg);

    mockBot.sendMessage.mockClear();

    const addressMsg = {
      chat: { id: 123 },
      from: { id: 456 },
      text: 'Calle Duplicada',
    };

    await controller.handleTextMessage(addressMsg);

    expect(mockBot.sendMessage).toHaveBeenCalledWith(
      123,
      expect.stringContaining('ya existe')
    );
  });

  it('/list_properties maneja errores correctamente', async () => {
    mockDrive.files.list.mockRejectedValue(new Error('Drive API error'));

    initializePropertyHandlers({
      bot: mockBot,
      drive: mockDrive,
      baseFolderId: 'base-id',
    });

    const msg = {
      chat: { id: 123 },
      from: { id: 456 },
      text: '/list_properties',
    };

    await commandHandlers.list_properties(msg);

    expect(mockBot.sendMessage).toHaveBeenCalledWith(
      123,
      expect.stringContaining('Error')
    );
  });

  it('handleTextMessage maneja errores al añadir vivienda', async () => {
    mockDrive.files.list.mockRejectedValue(new Error('Drive API error'));

    const controller = initializePropertyHandlers({
      bot: mockBot,
      drive: mockDrive,
      baseFolderId: 'base-id',
    });

    const addPropertyMsg = {
      chat: { id: 123 },
      from: { id: 456 },
      text: '/add_property',
    };

    await commandHandlers.add_property(addPropertyMsg);

    mockBot.sendMessage.mockClear();

    const addressMsg = {
      chat: { id: 123 },
      from: { id: 456 },
      text: 'Calle Test',
    };

    await controller.handleTextMessage(addressMsg);

    expect(mockBot.sendMessage).toHaveBeenCalledWith(
      123,
      expect.stringContaining('Error')
    );
  });

  it('handleTextMessage rechaza dirección vacía', async () => {
    const controller = initializePropertyHandlers({
      bot: mockBot,
      drive: mockDrive,
      baseFolderId: 'base-id',
    });

    const addPropertyMsg = {
      chat: { id: 123 },
      from: { id: 456 },
      text: '/add_property',
    };

    await commandHandlers.add_property(addPropertyMsg);

    mockBot.sendMessage.mockClear();

    const emptyMsg = {
      chat: { id: 123 },
      from: { id: 456 },
      text: '   ',
    };

    const handled = await controller.handleTextMessage(emptyMsg);

    expect(handled).toBe(true);
    expect(mockBot.sendMessage).toHaveBeenCalledWith(
      123,
      expect.stringContaining('no puede estar vacía')
    );
  });

  it('handleTextMessage devuelve false si el estado no es waiting_for_address', async () => {
    const controller = initializePropertyHandlers({
      bot: mockBot,
      drive: mockDrive,
      baseFolderId: 'base-id',
    });

    const msg = {
      chat: { id: 123 },
      from: { id: 789 },
      text: 'Some text',
    };

    const handled = await controller.handleTextMessage(msg);

    expect(handled).toBe(false);
  });

  it('handleTextMessage con text null no lanza error', async () => {
    const controller = initializePropertyHandlers({
      bot: mockBot,
      drive: mockDrive,
      baseFolderId: 'base-id',
    });

    const addPropertyMsg = {
      chat: { id: 123 },
      from: { id: 456 },
      text: '/add_property',
    };

    await commandHandlers.add_property(addPropertyMsg);

    mockBot.sendMessage.mockClear();

    const msgWithNullText = {
      chat: { id: 123 },
      from: { id: 456 },
      text: null,
    };

    const handled = await controller.handleTextMessage(msgWithNullText);

    expect(handled).toBe(true);
    expect(mockBot.sendMessage).toHaveBeenCalledWith(
      123,
      expect.stringContaining('no puede estar vacía')
    );
  });

  it('/add_property cubre modo production', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    initializePropertyHandlers({
      bot: mockBot,
      drive: mockDrive,
      baseFolderId: 'base-id',
    });

    const msg = {
      chat: { id: 123 },
      from: { id: 456 },
      text: '/add_property',
    };

    await commandHandlers.add_property(msg);

    const call = mockBot.sendMessage.mock.calls[mockBot.sendMessage.mock.calls.length - 1];
    expect(call[1]).not.toContain('DEV::');

    process.env.NODE_ENV = originalEnv;
  });

  it('/list_properties cubre rama success en modo production', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    mockDrive.files.get.mockResolvedValue({
      data: JSON.stringify({
        version: 1,
        updatedAt: '2024-01-01T00:00:00.000Z',
        properties: [
          {
            address: 'Calle Test',
            normalizedAddress: 'Calle Test',
            propertyFolderId: 'folder-123',
            createdAt: '2024-01-01T00:00:00.000Z',
          },
        ],
      }),
    });

    mockDrive.files.list.mockResolvedValue({
      data: {
        files: [{ id: 'catalog-id', name: '.properties.json' }],
      },
    });

    initializePropertyHandlers({
      bot: mockBot,
      drive: mockDrive,
      baseFolderId: 'base-id',
    });

    const msg = {
      chat: { id: 123 },
      from: { id: 456 },
      text: '/list_properties',
    };

    await commandHandlers.list_properties(msg);

    const call = mockBot.sendMessage.mock.calls[mockBot.sendMessage.mock.calls.length - 1];
    expect(call[1]).not.toContain('DEV::');
    expect(call[1]).toContain('Calle Test');

    process.env.NODE_ENV = originalEnv;
  });

  it('handleTextMessage success branch en modo production', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const controller = initializePropertyHandlers({
      bot: mockBot,
      drive: mockDrive,
      baseFolderId: 'base-id',
    });

    const addPropertyMsg = {
      chat: { id: 123 },
      from: { id: 456 },
      text: '/add_property',
    };

    await commandHandlers.add_property(addPropertyMsg);

    mockBot.sendMessage.mockClear();

    const addressMsg = {
      chat: { id: 123 },
      from: { id: 456 },
      text: 'Calle Producción',
    };

    await controller.handleTextMessage(addressMsg);

    const call = mockBot.sendMessage.mock.calls[mockBot.sendMessage.mock.calls.length - 1];
    expect(call[1]).not.toContain('DEV::');
    expect(call[1]).toContain('creada con éxito');

    process.env.NODE_ENV = originalEnv;
  });

  it('handleTextMessage con text vacío en modo production', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const controller = initializePropertyHandlers({
      bot: mockBot,
      drive: mockDrive,
      baseFolderId: 'base-id',
    });

    const addPropertyMsg = {
      chat: { id: 123 },
      from: { id: 999 },
      text: '/add_property',
    };

    await commandHandlers.add_property(addPropertyMsg);

    mockBot.sendMessage.mockClear();

    const emptyMsg = {
      chat: { id: 123 },
      from: { id: 999 },
      text: '',
    };

    await controller.handleTextMessage(emptyMsg);

    const call = mockBot.sendMessage.mock.calls[mockBot.sendMessage.mock.calls.length - 1];
    expect(call[1]).not.toContain('DEV::');
    expect(call[1]).toContain('no puede estar vacía');

    process.env.NODE_ENV = originalEnv;
  });

  it('handleTextMessage error branch en modo production', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    mockDrive.files.list.mockRejectedValue(new Error('Drive error'));

    const controller = initializePropertyHandlers({
      bot: mockBot,
      drive: mockDrive,
      baseFolderId: 'base-id',
    });

    const addPropertyMsg = {
      chat: { id: 123 },
      from: { id: 888 },
      text: '/add_property',
    };

    await commandHandlers.add_property(addPropertyMsg);

    mockBot.sendMessage.mockClear();

    const addressMsg = {
      chat: { id: 123 },
      from: { id: 888 },
      text: 'Calle Error',
    };

    await controller.handleTextMessage(addressMsg);

    const call = mockBot.sendMessage.mock.calls[mockBot.sendMessage.mock.calls.length - 1];
    expect(call[1]).not.toContain('DEV::');
    expect(call[1]).toContain('Error');

    process.env.NODE_ENV = originalEnv;
  });

  it('handleTextMessage con vivienda duplicada en modo production', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    mockDrive.files.list.mockResolvedValue({
      data: {
        files: [{ id: 'catalog-id', name: '.properties.json' }],
      },
    });

    mockDrive.files.get.mockResolvedValue({
      data: JSON.stringify({
        version: 1,
        updatedAt: '2024-01-01T00:00:00.000Z',
        properties: [
          {
            address: 'Calle Duplicada',
            normalizedAddress: 'Calle Duplicada',
            propertyFolderId: 'folder-123',
            createdAt: '2024-01-01T00:00:00.000Z',
          },
        ],
      }),
    });

    const controller = initializePropertyHandlers({
      bot: mockBot,
      drive: mockDrive,
      baseFolderId: 'base-id',
    });

    const addPropertyMsg = {
      chat: { id: 123 },
      from: { id: 777 },
      text: '/add_property',
    };

    await commandHandlers.add_property(addPropertyMsg);

    mockBot.sendMessage.mockClear();

    const addressMsg = {
      chat: { id: 123 },
      from: { id: 777 },
      text: 'Calle Duplicada',
    };

    await controller.handleTextMessage(addressMsg);

    const call = mockBot.sendMessage.mock.calls[mockBot.sendMessage.mock.calls.length - 1];
    expect(call[1]).not.toContain('DEV::');
    expect(call[1]).toContain('ya existe');

    process.env.NODE_ENV = originalEnv;
  });

  it('/list_properties error en modo production', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    mockDrive.files.list.mockRejectedValue(new Error('Drive API error'));

    initializePropertyHandlers({
      bot: mockBot,
      drive: mockDrive,
      baseFolderId: 'base-id',
    });

    const msg = {
      chat: { id: 123 },
      from: { id: 456 },
      text: '/list_properties',
    };

    await commandHandlers.list_properties(msg);

    const call = mockBot.sendMessage.mock.calls[mockBot.sendMessage.mock.calls.length - 1];
    expect(call[1]).not.toContain('DEV::');
    expect(call[1]).toContain('Error');

    process.env.NODE_ENV = originalEnv;
  });

  it('/list_properties sin viviendas en modo production', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    mockDrive.files.list.mockResolvedValue({
      data: { files: [] },
    });

    initializePropertyHandlers({
      bot: mockBot,
      drive: mockDrive,
      baseFolderId: 'base-id',
    });

    const msg = {
      chat: { id: 123 },
      from: { id: 456 },
      text: '/list_properties',
    };

    await commandHandlers.list_properties(msg);

    const call = mockBot.sendMessage.mock.calls[mockBot.sendMessage.mock.calls.length - 1];
    expect(call[1]).not.toContain('DEV::');
    expect(call[1]).toContain('/add_property');

    process.env.NODE_ENV = originalEnv;
  });

  it('/delete_property sin viviendas', async () => {
    mockDrive.files.list.mockResolvedValue({
      data: { files: [] },
    });

    initializePropertyHandlers({
      bot: mockBot,
      drive: mockDrive,
      baseFolderId: 'base-id',
    });

    const msg = {
      chat: { id: 123 },
      from: { id: 456 },
      text: '/delete_property',
    };

    await commandHandlers.delete_property(msg);

    expect(mockBot.sendMessage).toHaveBeenCalledWith(
      123,
      expect.stringContaining('/add_property')
    );
  });

  it('/delete_property muestra lista de viviendas', async () => {
    mockDrive.files.list.mockResolvedValue({
      data: {
        files: [{ id: 'catalog-id', name: '.properties.json' }],
      },
    });

    mockDrive.files.get.mockResolvedValue({
      data: JSON.stringify({
        version: 1,
        updatedAt: '2024-01-01T00:00:00.000Z',
        properties: [
          {
            address: 'Calle Test 1',
            normalizedAddress: 'Calle Test 1',
            propertyFolderId: 'folder-1',
            createdAt: '2024-01-01T00:00:00.000Z',
          },
          {
            address: 'Calle Test 2',
            normalizedAddress: 'Calle Test 2',
            propertyFolderId: 'folder-2',
            createdAt: '2024-01-01T00:00:00.000Z',
          },
        ],
      }),
    });

    initializePropertyHandlers({
      bot: mockBot,
      drive: mockDrive,
      baseFolderId: 'base-id',
    });

    const msg = {
      chat: { id: 123 },
      from: { id: 456 },
      text: '/delete_property',
    };

    await commandHandlers.delete_property(msg);

    const call = mockBot.sendMessage.mock.calls[mockBot.sendMessage.mock.calls.length - 1];
    expect(call[1]).toContain('Calle Test 1');
    expect(call[1]).toContain('Calle Test 2');
    expect(call[1]).toContain('1-2');
  });

  it('handleTextMessage procesa selección de vivienda a eliminar', async () => {
    mockDrive.files.list.mockResolvedValue({
      data: {
        files: [{ id: 'catalog-id', name: '.properties.json' }],
      },
    });

    mockDrive.files.get.mockResolvedValue({
      data: JSON.stringify({
        version: 1,
        updatedAt: '2024-01-01T00:00:00.000Z',
        properties: [
          {
            address: 'Calle Test 1',
            normalizedAddress: 'Calle Test 1',
            propertyFolderId: 'folder-1',
            createdAt: '2024-01-01T00:00:00.000Z',
          },
        ],
      }),
    });

    const controller = initializePropertyHandlers({
      bot: mockBot,
      drive: mockDrive,
      baseFolderId: 'base-id',
    });

    const deleteMsg = {
      chat: { id: 123 },
      from: { id: 456 },
      text: '/delete_property',
    };

    await commandHandlers.delete_property(deleteMsg);

    mockBot.sendMessage.mockClear();

    const selectionMsg = {
      chat: { id: 123 },
      from: { id: 456 },
      text: '1',
    };

    const handled = await controller.handleTextMessage(selectionMsg);

    expect(handled).toBe(true);
    expect(mockBot.sendMessage).toHaveBeenCalledWith(
      123,
      expect.stringContaining('¿Estás seguro de eliminar')
    );
    expect(mockBot.sendMessage).toHaveBeenCalledWith(
      123,
      expect.stringContaining('Calle Test 1')
    );
  });

  it('handleTextMessage cancela selección con "cancelar"', async () => {
    mockDrive.files.list.mockResolvedValue({
      data: {
        files: [{ id: 'catalog-id', name: '.properties.json' }],
      },
    });

    mockDrive.files.get.mockResolvedValue({
      data: JSON.stringify({
        version: 1,
        updatedAt: '2024-01-01T00:00:00.000Z',
        properties: [
          {
            address: 'Calle Test 1',
            normalizedAddress: 'Calle Test 1',
            propertyFolderId: 'folder-1',
            createdAt: '2024-01-01T00:00:00.000Z',
          },
        ],
      }),
    });

    const controller = initializePropertyHandlers({
      bot: mockBot,
      drive: mockDrive,
      baseFolderId: 'base-id',
    });

    const deleteMsg = {
      chat: { id: 123 },
      from: { id: 456 },
      text: '/delete_property',
    };

    await commandHandlers.delete_property(deleteMsg);

    mockBot.sendMessage.mockClear();

    const cancelMsg = {
      chat: { id: 123 },
      from: { id: 456 },
      text: 'cancelar',
    };

    await controller.handleTextMessage(cancelMsg);

    expect(mockBot.sendMessage).toHaveBeenCalledWith(
      123,
      expect.stringContaining('cancelada')
    );
  });

  it('handleTextMessage rechaza número inválido', async () => {
    mockDrive.files.list.mockResolvedValue({
      data: {
        files: [{ id: 'catalog-id', name: '.properties.json' }],
      },
    });

    mockDrive.files.get.mockResolvedValue({
      data: JSON.stringify({
        version: 1,
        updatedAt: '2024-01-01T00:00:00.000Z',
        properties: [
          {
            address: 'Calle Test 1',
            normalizedAddress: 'Calle Test 1',
            propertyFolderId: 'folder-1',
            createdAt: '2024-01-01T00:00:00.000Z',
          },
        ],
      }),
    });

    const controller = initializePropertyHandlers({
      bot: mockBot,
      drive: mockDrive,
      baseFolderId: 'base-id',
    });

    const deleteMsg = {
      chat: { id: 123 },
      from: { id: 456 },
      text: '/delete_property',
    };

    await commandHandlers.delete_property(deleteMsg);

    mockBot.sendMessage.mockClear();

    const invalidMsg = {
      chat: { id: 123 },
      from: { id: 456 },
      text: '999',
    };

    await controller.handleTextMessage(invalidMsg);

    expect(mockBot.sendMessage).toHaveBeenCalledWith(
      123,
      expect.stringContaining('inválido')
    );
  });

  it('handleTextMessage confirma y elimina vivienda', async () => {
    mockDrive.files.list.mockResolvedValue({
      data: {
        files: [{ id: 'catalog-id', name: '.properties.json' }],
      },
    });

    mockDrive.files.get.mockResolvedValue({
      data: JSON.stringify({
        version: 1,
        updatedAt: '2024-01-01T00:00:00.000Z',
        properties: [
          {
            address: 'Calle Test 1',
            normalizedAddress: 'Calle Test 1',
            propertyFolderId: 'folder-1',
            createdAt: '2024-01-01T00:00:00.000Z',
            status: 'active',
          },
        ],
      }),
    });

    mockDrive.files.update.mockResolvedValue({});

    const controller = initializePropertyHandlers({
      bot: mockBot,
      drive: mockDrive,
      baseFolderId: 'base-id',
    });

    const deleteMsg = {
      chat: { id: 123 },
      from: { id: 456 },
      text: '/delete_property',
    };

    await commandHandlers.delete_property(deleteMsg);

    const selectionMsg = {
      chat: { id: 123 },
      from: { id: 456 },
      text: '1',
    };

    await controller.handleTextMessage(selectionMsg);

    mockBot.sendMessage.mockClear();

    const confirmMsg = {
      chat: { id: 123 },
      from: { id: 456 },
      text: 'confirmar',
    };

    await controller.handleTextMessage(confirmMsg);

    expect(mockBot.sendMessage).toHaveBeenCalledWith(
      123,
      expect.stringContaining('eliminada del catálogo')
    );
  });

  it('handleTextMessage cancela en confirmación', async () => {
    mockDrive.files.list.mockResolvedValue({
      data: {
        files: [{ id: 'catalog-id', name: '.properties.json' }],
      },
    });

    mockDrive.files.get.mockResolvedValue({
      data: JSON.stringify({
        version: 1,
        updatedAt: '2024-01-01T00:00:00.000Z',
        properties: [
          {
            address: 'Calle Test 1',
            normalizedAddress: 'Calle Test 1',
            propertyFolderId: 'folder-1',
            createdAt: '2024-01-01T00:00:00.000Z',
          },
        ],
      }),
    });

    const controller = initializePropertyHandlers({
      bot: mockBot,
      drive: mockDrive,
      baseFolderId: 'base-id',
    });

    const deleteMsg = {
      chat: { id: 123 },
      from: { id: 456 },
      text: '/delete_property',
    };

    await commandHandlers.delete_property(deleteMsg);

    const selectionMsg = {
      chat: { id: 123 },
      from: { id: 456 },
      text: '1',
    };

    await controller.handleTextMessage(selectionMsg);

    mockBot.sendMessage.mockClear();

    const cancelMsg = {
      chat: { id: 123 },
      from: { id: 456 },
      text: 'cancelar',
    };

    await controller.handleTextMessage(cancelMsg);

    expect(mockBot.sendMessage).toHaveBeenCalledWith(
      123,
      expect.stringContaining('cancelada')
    );
  });

  it('handleTextMessage rechaza respuesta inválida en confirmación', async () => {
    mockDrive.files.list.mockResolvedValue({
      data: {
        files: [{ id: 'catalog-id', name: '.properties.json' }],
      },
    });

    mockDrive.files.get.mockResolvedValue({
      data: JSON.stringify({
        version: 1,
        updatedAt: '2024-01-01T00:00:00.000Z',
        properties: [
          {
            address: 'Calle Test 1',
            normalizedAddress: 'Calle Test 1',
            propertyFolderId: 'folder-1',
            createdAt: '2024-01-01T00:00:00.000Z',
          },
        ],
      }),
    });

    const controller = initializePropertyHandlers({
      bot: mockBot,
      drive: mockDrive,
      baseFolderId: 'base-id',
    });

    const deleteMsg = {
      chat: { id: 123 },
      from: { id: 456 },
      text: '/delete_property',
    };

    await commandHandlers.delete_property(deleteMsg);

    const selectionMsg = {
      chat: { id: 123 },
      from: { id: 456 },
      text: '1',
    };

    await controller.handleTextMessage(selectionMsg);

    mockBot.sendMessage.mockClear();

    const invalidMsg = {
      chat: { id: 123 },
      from: { id: 456 },
      text: 'tal vez',
    };

    await controller.handleTextMessage(invalidMsg);

    expect(mockBot.sendMessage).toHaveBeenCalledWith(
      123,
      expect.stringContaining('no reconocida')
    );
  });

  it('handleTextMessage maneja error al eliminar', async () => {
    mockDrive.files.list.mockResolvedValue({
      data: {
        files: [{ id: 'catalog-id', name: '.properties.json' }],
      },
    });

    mockDrive.files.get.mockResolvedValue({
      data: JSON.stringify({
        version: 1,
        updatedAt: '2024-01-01T00:00:00.000Z',
        properties: [
          {
            address: 'Calle Test 1',
            normalizedAddress: 'Calle Test 1',
            propertyFolderId: 'folder-1',
            createdAt: '2024-01-01T00:00:00.000Z',
          },
        ],
      }),
    });

    mockDrive.files.update.mockRejectedValue(new Error('Drive error'));

    const controller = initializePropertyHandlers({
      bot: mockBot,
      drive: mockDrive,
      baseFolderId: 'base-id',
    });

    const deleteMsg = {
      chat: { id: 123 },
      from: { id: 456 },
      text: '/delete_property',
    };

    await commandHandlers.delete_property(deleteMsg);

    const selectionMsg = {
      chat: { id: 123 },
      from: { id: 456 },
      text: '1',
    };

    await controller.handleTextMessage(selectionMsg);

    mockBot.sendMessage.mockClear();

    const confirmMsg = {
      chat: { id: 123 },
      from: { id: 456 },
      text: 'confirmar',
    };

    await controller.handleTextMessage(confirmMsg);

    expect(mockBot.sendMessage).toHaveBeenCalledWith(
      123,
      expect.stringContaining('Error')
    );
  });

  it('/delete_property maneja error al listar', async () => {
    mockDrive.files.list.mockRejectedValue(new Error('Drive error'));

    initializePropertyHandlers({
      bot: mockBot,
      drive: mockDrive,
      baseFolderId: 'base-id',
    });

    const msg = {
      chat: { id: 123 },
      from: { id: 456 },
      text: '/delete_property',
    };

    await commandHandlers.delete_property(msg);

    expect(mockBot.sendMessage).toHaveBeenCalledWith(
      123,
      expect.stringContaining('Error')
    );
  });

  it('/archive_property muestra lista de viviendas', async () => {
    mockDrive.files.list.mockResolvedValue({
      data: {
        files: [{ id: 'catalog-id', name: '.properties.json' }],
      },
    });

    mockDrive.files.get.mockResolvedValue({
      data: JSON.stringify({
        version: 1,
        updatedAt: '2024-01-01T00:00:00.000Z',
        properties: [
          {
            address: 'Calle Test 1',
            normalizedAddress: 'Calle Test 1',
            propertyFolderId: 'folder-1',
            createdAt: '2024-01-01T00:00:00.000Z',
            status: 'active',
          },
        ],
      }),
    });

    initializePropertyHandlers({
      bot: mockBot,
      drive: mockDrive,
      baseFolderId: 'base-id',
    });

    const msg = {
      chat: { id: 123 },
      from: { id: 456 },
      text: '/archive_property',
    };

    await commandHandlers.archive_property(msg);

    expect(mockBot.sendMessage).toHaveBeenCalledWith(
      123,
      expect.stringContaining('Selecciona el número de la vivienda a archivar')
    );
  });

  it('handleTextMessage archiva vivienda correctamente', async () => {
    mockDrive.files.list.mockResolvedValue({
      data: {
        files: [{ id: 'catalog-id', name: '.properties.json' }],
      },
    });

    mockDrive.files.get.mockImplementation(async ({ fileId }) => {
      if (fileId === 'catalog-id') {
        return {
          data: JSON.stringify({
            version: 1,
            updatedAt: '2024-01-01T00:00:00.000Z',
            properties: [
              {
                address: 'Calle Test 1',
                normalizedAddress: 'Calle Test 1',
                propertyFolderId: 'folder-1',
                createdAt: '2024-01-01T00:00:00.000Z',
                status: 'active',
              },
            ],
          }),
        };
      }
      return { data: { parents: ['old-parent'] } };
    });

    mockDrive.files.update.mockResolvedValue({});
    mockDrive.files.create.mockResolvedValue({
      data: { id: 'archivo-folder-id', name: 'Archivo' },
    });

    const controller = initializePropertyHandlers({
      bot: mockBot,
      drive: mockDrive,
      baseFolderId: 'base-id',
    });

    await commandHandlers.archive_property({
      chat: { id: 123 },
      from: { id: 456 },
      text: '/archive_property',
    });

    const handled = await controller.handleTextMessage({
      chat: { id: 123 },
      from: { id: 456 },
      text: '1',
    });

    expect(handled).toBe(true);
    expect(mockBot.sendMessage).toHaveBeenCalledWith(
      123,
      expect.stringContaining('archivada correctamente')
    );
  });

  it('/list_archived muestra viviendas archivadas', async () => {
    mockDrive.files.list.mockResolvedValue({
      data: {
        files: [{ id: 'catalog-id', name: '.properties.json' }],
      },
    });

    mockDrive.files.get.mockResolvedValue({
      data: JSON.stringify({
        version: 1,
        updatedAt: '2024-01-01T00:00:00.000Z',
        properties: [
          {
            address: 'Calle Archived 1',
            normalizedAddress: 'Calle Archived 1',
            propertyFolderId: 'folder-1',
            createdAt: '2024-01-01T00:00:00.000Z',
            status: 'archived',
            archivedAt: '2024-01-02T00:00:00.000Z',
          },
        ],
      }),
    });

    initializePropertyHandlers({
      bot: mockBot,
      drive: mockDrive,
      baseFolderId: 'base-id',
    });

    const msg = {
      chat: { id: 123 },
      from: { id: 456 },
      text: '/list_archived',
    };

    await commandHandlers.list_archived(msg);

    expect(mockBot.sendMessage).toHaveBeenCalledWith(
      123,
      expect.stringContaining('Viviendas archivadas')
    );
    expect(mockBot.sendMessage).toHaveBeenCalledWith(
      123,
      expect.stringContaining('Calle Archived 1')
    );
  });

  it('/list_archived sin viviendas archivadas', async () => {
    mockDrive.files.list.mockResolvedValue({
      data: { files: [] },
    });

    initializePropertyHandlers({
      bot: mockBot,
      drive: mockDrive,
      baseFolderId: 'base-id',
    });

    const msg = {
      chat: { id: 123 },
      from: { id: 456 },
      text: '/list_archived',
    };

    await commandHandlers.list_archived(msg);

    expect(mockBot.sendMessage).toHaveBeenCalledWith(
      123,
      expect.stringContaining('No hay viviendas archivadas')
    );
  });

  it('/unarchive_property muestra lista de viviendas archivadas', async () => {
    mockDrive.files.list.mockResolvedValue({
      data: {
        files: [{ id: 'catalog-id', name: '.properties.json' }],
      },
    });

    mockDrive.files.get.mockResolvedValue({
      data: JSON.stringify({
        version: 1,
        updatedAt: '2024-01-01T00:00:00.000Z',
        properties: [
          {
            address: 'Calle Archived 1',
            normalizedAddress: 'Calle Archived 1',
            propertyFolderId: 'folder-1',
            createdAt: '2024-01-01T00:00:00.000Z',
            status: 'archived',
            archivedAt: '2024-01-02T00:00:00.000Z',
          },
        ],
      }),
    });

    initializePropertyHandlers({
      bot: mockBot,
      drive: mockDrive,
      baseFolderId: 'base-id',
    });

    const msg = {
      chat: { id: 123 },
      from: { id: 456 },
      text: '/unarchive_property',
    };

    await commandHandlers.unarchive_property(msg);

    expect(mockBot.sendMessage).toHaveBeenCalledWith(
      123,
      expect.stringContaining('Selecciona el número de la vivienda a reactivar')
    );
  });

  it('/archive_property maneja error al listar', async () => {
    mockDrive.files.list.mockRejectedValue(new Error('Drive error'));

    initializePropertyHandlers({
      bot: mockBot,
      drive: mockDrive,
      baseFolderId: 'base-id',
    });

    const msg = {
      chat: { id: 123 },
      from: { id: 456 },
      text: '/archive_property',
    };

    await commandHandlers.archive_property(msg);

    expect(mockBot.sendMessage).toHaveBeenCalledWith(
      123,
      expect.stringContaining('Error')
    );
  });

  it('handleTextMessage maneja error al archivar', async () => {
    let callCount = 0;
    mockDrive.files.list.mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return {
          data: {
            files: [{ id: 'catalog-id', name: '.properties.json' }],
          },
        };
      }
      return { data: { files: [] } };
    });

    let getCallCount = 0;
    mockDrive.files.get.mockImplementation(async () => {
      getCallCount++;
      if (getCallCount === 1) {
        return {
          data: JSON.stringify({
            version: 1,
            updatedAt: '2024-01-01T00:00:00.000Z',
            properties: [
              {
                address: 'Calle Test 1',
                normalizedAddress: 'Calle Test 1',
                propertyFolderId: 'folder-1',
                createdAt: '2024-01-01T00:00:00.000Z',
                status: 'active',
              },
            ],
          }),
        };
      }
      throw new Error('Drive error during update');
    });

    mockDrive.files.update.mockRejectedValue(new Error('Update failed'));

    const controller = initializePropertyHandlers({
      bot: mockBot,
      drive: mockDrive,
      baseFolderId: 'base-id',
    });

    await commandHandlers.archive_property({
      chat: { id: 123 },
      from: { id: 456 },
      text: '/archive_property',
    });

    const handled = await controller.handleTextMessage({
      chat: { id: 123 },
      from: { id: 456 },
      text: '1',
    });

    expect(handled).toBe(true);
    const lastCall = mockBot.sendMessage.mock.calls[mockBot.sendMessage.mock.calls.length - 1];
    expect(lastCall[1]).toContain('Error al archivar');
  });

  it('/list_archived maneja error al listar', async () => {
    mockDrive.files.list.mockRejectedValue(new Error('Drive error'));

    initializePropertyHandlers({
      bot: mockBot,
      drive: mockDrive,
      baseFolderId: 'base-id',
    });

    const msg = {
      chat: { id: 123 },
      from: { id: 456 },
      text: '/list_archived',
    };

    await commandHandlers.list_archived(msg);

    expect(mockBot.sendMessage).toHaveBeenCalledWith(
      123,
      expect.stringContaining('Error')
    );
  });

  it('/unarchive_property maneja error al listar', async () => {
    mockDrive.files.list.mockRejectedValue(new Error('Drive error'));

    initializePropertyHandlers({
      bot: mockBot,
      drive: mockDrive,
      baseFolderId: 'base-id',
    });

    const msg = {
      chat: { id: 123 },
      from: { id: 456 },
      text: '/unarchive_property',
    };

    await commandHandlers.unarchive_property(msg);

    expect(mockBot.sendMessage).toHaveBeenCalledWith(
      123,
      expect.stringContaining('Error')
    );
  });

  it('handleTextMessage maneja error al reactivar', async () => {
    let callCount = 0;
    mockDrive.files.list.mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return {
          data: {
            files: [{ id: 'catalog-id', name: '.properties.json' }],
          },
        };
      }
      return { data: { files: [] } };
    });

    mockDrive.files.get.mockImplementation(async () => {
      return {
        data: JSON.stringify({
          version: 1,
          updatedAt: '2024-01-01T00:00:00.000Z',
          properties: [
            {
              address: 'Calle Test 1',
              normalizedAddress: 'Calle Test 1',
              propertyFolderId: 'folder-1',
              createdAt: '2024-01-01T00:00:00.000Z',
              status: 'archived',
              archivedAt: '2024-01-02T00:00:00.000Z',
            },
          ],
        }),
      };
    });

    mockDrive.files.create.mockRejectedValue(new Error('Drive error'));

    const controller = initializePropertyHandlers({
      bot: mockBot,
      drive: mockDrive,
      baseFolderId: 'base-id',
    });

    await commandHandlers.unarchive_property({
      chat: { id: 123 },
      from: { id: 456 },
      text: '/unarchive_property',
    });

    const handled = await controller.handleTextMessage({
      chat: { id: 123 },
      from: { id: 456 },
      text: '1',
    });

    expect(handled).toBe(true);
    expect(mockBot.sendMessage).toHaveBeenCalledWith(
      123,
      expect.stringContaining('Error')
    );
  });

  it('handleTextMessage reactiva vivienda correctamente', async () => {
    mockDrive.files.list.mockResolvedValue({
      data: {
        files: [{ id: 'catalog-id', name: '.properties.json' }],
      },
    });

    mockDrive.files.get.mockImplementation(async ({ fileId }) => {
      if (fileId === 'catalog-id') {
        return {
          data: JSON.stringify({
            version: 1,
            updatedAt: '2024-01-01T00:00:00.000Z',
            properties: [
              {
                address: 'Calle Test 1',
                normalizedAddress: 'Calle Test 1',
                propertyFolderId: 'folder-1',
                createdAt: '2024-01-01T00:00:00.000Z',
                status: 'archived',
                archivedAt: '2024-01-02T00:00:00.000Z',
              },
            ],
          }),
        };
      }
      return { data: { parents: ['archivo-parent'] } };
    });

    mockDrive.files.update.mockResolvedValue({});
    mockDrive.files.create.mockResolvedValue({
      data: { id: 'viviendas-folder-id', name: 'Viviendas' },
    });

    const controller = initializePropertyHandlers({
      bot: mockBot,
      drive: mockDrive,
      baseFolderId: 'base-id',
    });

    await commandHandlers.unarchive_property({
      chat: { id: 123 },
      from: { id: 456 },
      text: '/unarchive_property',
    });

    const handled = await controller.handleTextMessage({
      chat: { id: 123 },
      from: { id: 456 },
      text: '1',
    });

    expect(handled).toBe(true);
    expect(mockBot.sendMessage).toHaveBeenCalledWith(
      123,
      expect.stringContaining('reactivada correctamente')
    );
  });

  it('/unarchive_property muestra mensaje cuando no hay viviendas archivadas', async () => {
    mockDrive.files.list.mockResolvedValue({
      data: {
        files: [{ id: 'catalog-id', name: '.properties.json' }],
      },
    });

    mockDrive.files.get.mockResolvedValue({
      data: JSON.stringify({
        version: 1,
        updatedAt: '2024-01-01T00:00:00.000Z',
        properties: [],
      }),
    });

    initializePropertyHandlers({
      bot: mockBot,
      drive: mockDrive,
      baseFolderId: 'base-id',
    });

    const msg = {
      chat: { id: 123 },
      from: { id: 456 },
      text: '/unarchive_property',
    };

    await commandHandlers.unarchive_property(msg);

    expect(mockBot.sendMessage).toHaveBeenCalledWith(
      123,
      expect.stringContaining('No hay viviendas archivadas')
    );
  });

  it('handleTextMessage devuelve false cuando no hay estado de usuario', async () => {
    const controller = initializePropertyHandlers({
      bot: mockBot,
      drive: mockDrive,
      baseFolderId: 'base-id',
    });

    const handled = await controller.handleTextMessage({
      chat: { id: 123 },
      from: { id: 999 },
      text: 'random text',
    });

    expect(handled).toBe(false);
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.clearAllMocks();
  });

  describe('/version command', () => {
    it('registra el handler de /version', () => {
      initializePropertyHandlers({
        bot: mockBot,
        drive: mockDrive,
        baseFolderId: 'base-id',
      });

      expect(mockBot.onText).toHaveBeenCalledWith(
        expect.objectContaining({ source: expect.stringContaining('version') }),
        expect.any(Function)
      );
    });

    it('devuelve información de versión completa', async () => {
      vi.mocked(diagnosticsService.getVersionInfo).mockReturnValue({
        name: 'telegram-drive-agent',
        version: '1.0.0',
        nodeEnv: 'development',
        cloudRun: {
          service: 'local',
          revision: 'N/A',
        },
        startedAt: '2024-01-01T00:00:00.000Z',
        gitSha: 'abc123',
      });

      initializePropertyHandlers({
        bot: mockBot,
        drive: mockDrive,
        baseFolderId: 'base-id',
      });

      const msg = {
        chat: { id: 123 },
        from: { id: 456 },
        text: '/version',
      };

      await commandHandlers.version(msg);

      expect(diagnosticsService.getVersionInfo).toHaveBeenCalled();
      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        123,
        expect.stringMatching(/telegram-drive-agent.*v1\.0\.0/s),
        { parse_mode: 'Markdown' }
      );
    });

    it('muestra información de Cloud Run cuando está disponible', async () => {
      vi.mocked(diagnosticsService.getVersionInfo).mockReturnValue({
        name: 'telegram-drive-agent',
        version: '1.0.0',
        nodeEnv: 'production',
        cloudRun: {
          service: 'my-service',
          revision: 'my-service-00001-abc',
        },
        startedAt: '2024-01-01T00:00:00.000Z',
        gitSha: 'def456',
      });

      initializePropertyHandlers({
        bot: mockBot,
        drive: mockDrive,
        baseFolderId: 'base-id',
      });

      const msg = {
        chat: { id: 123 },
        from: { id: 456 },
        text: '/version',
      };

      await commandHandlers.version(msg);

      const call = mockBot.sendMessage.mock.calls[0];
      expect(call[1]).toContain('my-service');
      expect(call[1]).toContain('my-service-00001-abc');
    });

    it('muestra "local" cuando no está en Cloud Run', async () => {
      vi.mocked(diagnosticsService.getVersionInfo).mockReturnValue({
        name: 'telegram-drive-agent',
        version: '1.0.0',
        nodeEnv: 'development',
        cloudRun: {
          service: 'local',
          revision: 'N/A',
        },
        startedAt: '2024-01-01T00:00:00.000Z',
        gitSha: 'N/A',
      });

      initializePropertyHandlers({
        bot: mockBot,
        drive: mockDrive,
        baseFolderId: 'base-id',
      });

      const msg = {
        chat: { id: 123 },
        from: { id: 456 },
        text: '/version',
      };

      await commandHandlers.version(msg);

      const call = mockBot.sendMessage.mock.calls[0];
      expect(call[1]).toContain('local');
      expect(call[1]).not.toContain('(N/A)');
    });

    it('maneja error al obtener información de versión', async () => {
      vi.mocked(diagnosticsService.getVersionInfo).mockImplementation(() => {
        throw new Error('File system error');
      });

      initializePropertyHandlers({
        bot: mockBot,
        drive: mockDrive,
        baseFolderId: 'base-id',
      });

      const msg = {
        chat: { id: 123 },
        from: { id: 456 },
        text: '/version',
      };

      await commandHandlers.version(msg);

      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        123,
        expect.stringContaining('Error obteniendo información')
      );
    });

    it('incluye prefijo DEV:: en modo desarrollo', async () => {
      process.env.NODE_ENV = 'development';

      vi.mocked(diagnosticsService.getVersionInfo).mockReturnValue({
        name: 'telegram-drive-agent',
        version: '1.0.0',
        nodeEnv: 'development',
        cloudRun: { service: 'local', revision: 'N/A' },
        startedAt: '2024-01-01T00:00:00.000Z',
        gitSha: 'N/A',
      });

      initializePropertyHandlers({
        bot: mockBot,
        drive: mockDrive,
        baseFolderId: 'base-id',
      });

      const msg = {
        chat: { id: 123 },
        from: { id: 456 },
        text: '/version',
      };

      await commandHandlers.version(msg);

      const call = mockBot.sendMessage.mock.calls[0];
      expect(call[1]).toContain('DEV::');
    });

    it('no incluye prefijo DEV:: en modo producción', async () => {
      process.env.NODE_ENV = 'production';

      vi.mocked(diagnosticsService.getVersionInfo).mockReturnValue({
        name: 'telegram-drive-agent',
        version: '1.0.0',
        nodeEnv: 'production',
        cloudRun: { service: 'my-service', revision: 'rev-123' },
        startedAt: '2024-01-01T00:00:00.000Z',
        gitSha: 'abc123',
      });

      initializePropertyHandlers({
        bot: mockBot,
        drive: mockDrive,
        baseFolderId: 'base-id',
      });

      const msg = {
        chat: { id: 123 },
        from: { id: 456 },
        text: '/version',
      };

      await commandHandlers.version(msg);

      const call = mockBot.sendMessage.mock.calls[0];
      expect(call[1]).not.toContain('DEV::');
    });
  });

  describe('/status command', () => {
    it('registra el handler de /status', () => {
      initializePropertyHandlers({
        bot: mockBot,
        drive: mockDrive,
        baseFolderId: 'base-id',
      });

      expect(mockBot.onText).toHaveBeenCalledWith(
        expect.objectContaining({ source: expect.stringContaining('status') }),
        expect.any(Function)
      );
    });

    it('muestra todos los checks exitosos', async () => {
      vi.mocked(diagnosticsService.getStatusReport).mockResolvedValue({
        config: { status: 'success', message: 'Todas las variables requeridas están configuradas' },
        oauth: { status: 'success', message: 'Auth client válido y token actualizado' },
        driveAccess: { status: 'success', message: 'Carpeta raíz accesible: "Test Folder"' },
        catalog: { status: 'success', message: 'Catálogo accesible (2 propiedades activas)' },
      });

      initializePropertyHandlers({
        bot: mockBot,
        drive: mockDrive,
        baseFolderId: 'base-id',
      });

      const msg = {
        chat: { id: 123 },
        from: { id: 456 },
        text: '/status',
      };

      await commandHandlers.status(msg);

      expect(diagnosticsService.getStatusReport).toHaveBeenCalledWith({
        drive: mockDrive,
        baseFolderId: 'base-id',
      });

      const calls = mockBot.sendMessage.mock.calls;
      const statusMessage = calls[calls.length - 1];
      expect(statusMessage[1]).toContain('✅');
      expect(statusMessage[1]).toContain('Config');
      expect(statusMessage[1]).toContain('Google OAuth');
      expect(statusMessage[1]).toContain('Drive (carpeta raíz)');
      expect(statusMessage[1]).toContain('Catálogo');
    });

    it('muestra errores de configuración', async () => {
      vi.mocked(diagnosticsService.getStatusReport).mockResolvedValue({
        config: { status: 'failed', message: 'Faltan variables: BOT_TOKEN, DRIVE_FOLDER_ID' },
        oauth: { status: 'success', message: 'Auth client válido' },
        driveAccess: { status: 'success', message: 'Carpeta raíz accesible' },
        catalog: { status: 'success', message: 'Catálogo accesible (0 propiedades activas)' },
      });

      initializePropertyHandlers({
        bot: mockBot,
        drive: mockDrive,
        baseFolderId: 'base-id',
      });

      const msg = {
        chat: { id: 123 },
        from: { id: 456 },
        text: '/status',
      };

      await commandHandlers.status(msg);

      const calls = mockBot.sendMessage.mock.calls;
      const statusMessage = calls[calls.length - 1];
      expect(statusMessage[1]).toContain('❌');
      expect(statusMessage[1]).toContain('BOT_TOKEN');
      expect(statusMessage[1]).toContain('DRIVE_FOLDER_ID');
    });

    it('muestra error de OAuth invalid_grant', async () => {
      vi.mocked(diagnosticsService.getStatusReport).mockResolvedValue({
        config: { status: 'success', message: 'Config OK' },
        oauth: { status: 'failed', message: 'Error: invalid_grant - Token expirado o revocado' },
        driveAccess: { status: 'success', message: 'Drive OK' },
        catalog: { status: 'success', message: 'Catalog OK' },
      });

      initializePropertyHandlers({
        bot: mockBot,
        drive: mockDrive,
        baseFolderId: 'base-id',
      });

      const msg = {
        chat: { id: 123 },
        from: { id: 456 },
        text: '/status',
      };

      await commandHandlers.status(msg);

      const calls = mockBot.sendMessage.mock.calls;
      const statusMessage = calls[calls.length - 1];
      expect(statusMessage[1]).toContain('❌');
      expect(statusMessage[1]).toContain('invalid_grant');
    });

    it('continúa mostrando todos los checks aunque algunos fallen', async () => {
      vi.mocked(diagnosticsService.getStatusReport).mockResolvedValue({
        config: { status: 'success', message: 'Config OK' },
        oauth: { status: 'failed', message: 'Error de OAuth' },
        driveAccess: { status: 'failed', message: 'Error: Carpeta no encontrada (404)' },
        catalog: { status: 'success', message: 'Catalog OK' },
      });

      initializePropertyHandlers({
        bot: mockBot,
        drive: mockDrive,
        baseFolderId: 'base-id',
      });

      const msg = {
        chat: { id: 123 },
        from: { id: 456 },
        text: '/status',
      };

      await commandHandlers.status(msg);

      const calls = mockBot.sendMessage.mock.calls;
      const statusMessage = calls[calls.length - 1];
      expect(statusMessage[1]).toContain('✅');
      expect(statusMessage[1]).toContain('❌');
      expect(statusMessage[1]).toContain('Config');
      expect(statusMessage[1]).toContain('Google OAuth');
      expect(statusMessage[1]).toContain('Drive');
      expect(statusMessage[1]).toContain('Catálogo');
    });

    it('maneja error al ejecutar diagnóstico', async () => {
      vi.mocked(diagnosticsService.getStatusReport).mockRejectedValue(
        new Error('Drive client error')
      );

      initializePropertyHandlers({
        bot: mockBot,
        drive: mockDrive,
        baseFolderId: 'base-id',
      });

      const msg = {
        chat: { id: 123 },
        from: { id: 456 },
        text: '/status',
      };

      await commandHandlers.status(msg);

      const calls = mockBot.sendMessage.mock.calls;
      const lastMessage = calls[calls.length - 1];
      expect(lastMessage[1]).toContain('Error ejecutando diagnóstico');
    });

    it('envía mensaje inicial antes de ejecutar checks', async () => {
      vi.mocked(diagnosticsService.getStatusReport).mockResolvedValue({
        config: { status: 'success', message: 'OK' },
        oauth: { status: 'success', message: 'OK' },
        driveAccess: { status: 'success', message: 'OK' },
        catalog: { status: 'success', message: 'OK' },
      });

      initializePropertyHandlers({
        bot: mockBot,
        drive: mockDrive,
        baseFolderId: 'base-id',
      });

      const msg = {
        chat: { id: 123 },
        from: { id: 456 },
        text: '/status',
      };

      await commandHandlers.status(msg);

      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        123,
        expect.stringContaining('Ejecutando diagnóstico')
      );
    });

    it('incluye prefijo DEV:: en modo desarrollo', async () => {
      process.env.NODE_ENV = 'development';

      vi.mocked(diagnosticsService.getStatusReport).mockResolvedValue({
        config: { status: 'success', message: 'OK' },
        oauth: { status: 'success', message: 'OK' },
        driveAccess: { status: 'success', message: 'OK' },
        catalog: { status: 'success', message: 'OK' },
      });

      initializePropertyHandlers({
        bot: mockBot,
        drive: mockDrive,
        baseFolderId: 'base-id',
      });

      const msg = {
        chat: { id: 123 },
        from: { id: 456 },
        text: '/status',
      };

      await commandHandlers.status(msg);

      const calls = mockBot.sendMessage.mock.calls;
      expect(calls[0][1]).toContain('DEV::');
      expect(calls[1][1]).toContain('DEV::');
    });

    it('no incluye prefijo DEV:: en modo producción', async () => {
      process.env.NODE_ENV = 'production';

      vi.mocked(diagnosticsService.getStatusReport).mockResolvedValue({
        config: { status: 'success', message: 'OK' },
        oauth: { status: 'success', message: 'OK' },
        driveAccess: { status: 'success', message: 'OK' },
        catalog: { status: 'success', message: 'OK' },
      });

      initializePropertyHandlers({
        bot: mockBot,
        drive: mockDrive,
        baseFolderId: 'base-id',
      });

      const msg = {
        chat: { id: 123 },
        from: { id: 456 },
        text: '/status',
      };

      await commandHandlers.status(msg);

      const calls = mockBot.sendMessage.mock.calls;
      expect(calls[0][1]).not.toContain('DEV::');
      expect(calls[1][1]).not.toContain('DEV::');
    });
  });
});
