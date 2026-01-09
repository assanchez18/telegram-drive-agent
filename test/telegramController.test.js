import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initializePropertyHandlers } from '../src/controllers/telegramController.js';

describe('initializePropertyHandlers', () => {
  let mockBot;
  let mockDrive;
  let commandHandlers;
  let textHandlers;

  beforeEach(() => {
    commandHandlers = {};
    textHandlers = [];

    mockBot = {
      onText: vi.fn((pattern, handler) => {
        if (pattern.toString().includes('add_property')) {
          commandHandlers.add_property = handler;
        } else if (pattern.toString().includes('list_properties')) {
          commandHandlers.list_properties = handler;
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

});
