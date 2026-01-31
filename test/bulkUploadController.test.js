import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initializeBulkUploadHandlers } from '../src/controllers/bulkUploadController.js';
import { clearAllBulkSessions, getBulkSession } from '../src/repositories/bulkSessionRepository.js';

describe('bulkUploadController', () => {
  let mockBot;
  let mockDrive;
  let controller;

  beforeEach(() => {
    clearAllBulkSessions();
    vi.clearAllMocks();

    mockBot = {
      onText: vi.fn(),
      on: vi.fn(),
      sendMessage: vi.fn().mockResolvedValue({}),
      answerCallbackQuery: vi.fn().mockResolvedValue({}),
      setMyCommands: vi.fn().mockResolvedValue({}),
    };

    mockDrive = {
      files: {
        list: vi.fn().mockResolvedValue({ data: { files: [] } }),
        get: vi.fn().mockResolvedValue({
          data: JSON.stringify({
            version: 1,
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
        create: vi.fn().mockResolvedValue({
          data: { id: 'new-folder-id', name: 'FolderName' },
        }),
      },
    };

    const defaultCommands = [
      { command: 'start', description: 'Mensaje de bienvenida' },
      { command: 'bulk', description: 'Subir varios archivos a la vez' },
      { command: 'cancel', description: 'Cancelar operación actual' },
    ];

    const bulkModeCommands = [
      { command: 'bulk_done', description: 'Finalizar subida bulk' },
      { command: 'cancel', description: 'Cancelar operación actual' },
    ];

    controller = initializeBulkUploadHandlers({
      bot: mockBot,
      drive: mockDrive,
      baseFolderId: 'base-folder-id',
      botToken: 'bot-token-123',
      defaultCommands,
      bulkModeCommands,
    });
  });

  it('lanza error si falta bot', () => {
    expect(() => initializeBulkUploadHandlers({
      drive: mockDrive,
      baseFolderId: 'base-folder-id',
      botToken: 'bot-token-123',
    })).toThrow('Bot is required');
  });

  it('lanza error si falta drive', () => {
    expect(() => initializeBulkUploadHandlers({
      bot: mockBot,
      baseFolderId: 'base-folder-id',
      botToken: 'bot-token-123',
    })).toThrow('Drive client is required');
  });

  it('lanza error si falta baseFolderId', () => {
    expect(() => initializeBulkUploadHandlers({
      bot: mockBot,
      drive: mockDrive,
      botToken: 'bot-token-123',
    })).toThrow('Base folder ID is required');
  });

  it('lanza error si falta botToken', () => {
    expect(() => initializeBulkUploadHandlers({
      bot: mockBot,
      drive: mockDrive,
      baseFolderId: 'base-folder-id',
    })).toThrow('Bot token is required');
  });

  it('registra handler para /bulk', () => {
    expect(mockBot.onText).toHaveBeenCalledWith(/\/bulk$/, expect.any(Function));
  });

  it('registra handler para /bulk_done', () => {
    expect(mockBot.onText).toHaveBeenCalledWith(/\/bulk_done/, expect.any(Function));
  });

  it('registra handler para callback_query', () => {
    expect(mockBot.on).toHaveBeenCalledWith('callback_query', expect.any(Function));
  });

  describe('handleBulkMessage', () => {
    it('devuelve false si no hay sesión activa', async () => {
      const msg = {
        chat: { id: 12345 },
        document: {
          file_id: 'file-123',
          file_unique_id: 'unique-123',
          file_name: 'test.pdf',
          mime_type: 'application/pdf',
        },
      };

      const handled = await controller.handleBulkMessage(msg);
      expect(handled).toBe(false);
    });

    it('añade documento durante collecting_files', async () => {
      const bulkHandler = mockBot.onText.mock.calls.find(call => 
        call[0].toString() === '/\\/bulk$/'
      )[1];

      await bulkHandler({ chat: { id: 12345 } });

      const msg = {
        chat: { id: 12345 },
        document: {
          file_id: 'file-123',
          file_unique_id: 'unique-123',
          file_name: 'test.pdf',
          mime_type: 'application/pdf',
        },
      };

      const handled = await controller.handleBulkMessage(msg);

      expect(handled).toBe(true);
      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        12345,
        expect.stringContaining('Añadido')
      );

      const session = getBulkSession(12345);
      expect(session.files.length).toBe(1);
    });

    it('añade foto durante collecting_files', async () => {
      const bulkHandler = mockBot.onText.mock.calls.find(call => 
        call[0].toString() === '/\\/bulk$/'
      )[1];

      await bulkHandler({ chat: { id: 12345 } });

      const msg = {
        chat: { id: 12345 },
        photo: [
          { file_id: 'photo-1', file_unique_id: 'unique-1' },
          { file_id: 'photo-2', file_unique_id: 'unique-2' },
        ],
      };

      const handled = await controller.handleBulkMessage(msg);

      expect(handled).toBe(true);
      const session = getBulkSession(12345);
      expect(session.files.length).toBe(1);
      expect(session.files[0].fileName).toContain('photo_');
    });

    it('rechaza texto durante collecting_files', async () => {
      const bulkHandler = mockBot.onText.mock.calls.find(call => 
        call[0].toString() === '/\\/bulk$/'
      )[1];

      await bulkHandler({ chat: { id: 12345 } });

      const msg = {
        chat: { id: 12345 },
        text: 'Hello',
      };

      const handled = await controller.handleBulkMessage(msg);

      expect(handled).toBe(true);
      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        12345,
        expect.stringContaining('Solo envía documentos')
      );
    });

    it('valida año custom correcto', async () => {
      const bulkHandler = mockBot.onText.mock.calls.find(call => 
        call[0].toString() === '/\\/bulk$/'
      )[1];

      await bulkHandler({ chat: { id: 12345 } });

      const session = getBulkSession(12345);
      session.state = 'waiting_for_custom_year';
      session.selectedProperty = { address: 'Test', propertyFolderId: 'folder-123' };
      session.category = 'Contratos';
      session.files = [];

      const msg = {
        chat: { id: 12345 },
        text: '2025',
      };

      const handled = await controller.handleBulkMessage(msg);

      expect(handled).toBe(true);
      const lastCall = mockBot.sendMessage.mock.calls[mockBot.sendMessage.mock.calls.length - 1];
      expect(lastCall[1]).toContain('Confirmar');
    });

    it('rechaza año custom inválido', async () => {
      const bulkHandler = mockBot.onText.mock.calls.find(call => 
        call[0].toString() === '/\\/bulk$/'
      )[1];

      await bulkHandler({ chat: { id: 12345 } });

      const session = getBulkSession(12345);
      session.state = 'waiting_for_custom_year';

      const msg = {
        chat: { id: 12345 },
        text: 'invalid',
      };

      const handled = await controller.handleBulkMessage(msg);

      expect(handled).toBe(true);
      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        12345,
        expect.stringContaining('formato YYYY')
      );
    });

    it('preserva caracteres españoles en basename', async () => {
      const bulkHandler = mockBot.onText.mock.calls.find(call => 
        call[0].toString() === '/\\/bulk$/'
      )[1];

      await bulkHandler({ chat: { id: 12345 } });

      const session = getBulkSession(12345);
      session.state = 'waiting_for_basename';
      session.selectedProperty = { address: 'Test', propertyFolderId: 'folder-123' };
      session.category = 'Contratos';
      session.year = '2025';
      session.files = [
        {
          fileId: 'photo-1',
          fileName: null,
          mimeType: 'image/jpeg',
        },
      ];

      const msg = {
        chat: { id: 12345 },
        text: 'Baño Principal',
      };

      const handled = await controller.handleBulkMessage(msg);

      expect(handled).toBe(true);
      const updatedSession = getBulkSession(12345);
      expect(updatedSession.baseName).toBe('Baño Principal');
    });

    it('preserva ñ y acentos en basename', async () => {
      const bulkHandler = mockBot.onText.mock.calls.find(call =>
        call[0].toString() === '/\\/bulk$/'
      )[1];

      await bulkHandler({ chat: { id: 12345 } });

      const session = getBulkSession(12345);
      session.state = 'waiting_for_basename';
      session.selectedProperty = { address: 'Test', propertyFolderId: 'folder-123' };
      session.category = 'Contratos';
      session.year = '2025';
      session.files = [
        {
          fileId: 'photo-1',
          fileName: null,
          mimeType: 'image/jpeg',
        },
      ];

      const msg = {
        chat: { id: 12345 },
        text: 'Año Renovación',
      };

      const handled = await controller.handleBulkMessage(msg);

      expect(handled).toBe(true);
      const updatedSession = getBulkSession(12345);
      expect(updatedSession.baseName).toBe('Año Renovación');
    });

    it('rechaza basename vacío', async () => {
      const bulkHandler = mockBot.onText.mock.calls.find(call =>
        call[0].toString() === '/\\/bulk$/'
      )[1];

      await bulkHandler({ chat: { id: 12345 } });

      const session = getBulkSession(12345);
      session.state = 'waiting_for_basename';
      session.files = [{ fileId: 'photo-1', fileName: null, mimeType: 'image/jpeg' }];

      const msg = {
        chat: { id: 12345 },
        text: '   ',
      };

      const handled = await controller.handleBulkMessage(msg);

      expect(handled).toBe(true);
      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        12345,
        expect.stringContaining('nombre válido')
      );
    });

    it('acepta "skip" como basename para usar nombres automáticos', async () => {
      const bulkHandler = mockBot.onText.mock.calls.find(call =>
        call[0].toString() === '/\\/bulk$/'
      )[1];

      await bulkHandler({ chat: { id: 12345 } });

      const session = getBulkSession(12345);
      session.state = 'waiting_for_basename';
      session.selectedProperty = { address: 'Test', propertyFolderId: 'folder-123' };
      session.category = 'Contratos';
      session.year = '2025';
      session.files = [{ fileId: 'photo-1', fileName: null, mimeType: 'image/jpeg' }];

      const msg = {
        chat: { id: 12345 },
        text: 'skip',
      };

      const handled = await controller.handleBulkMessage(msg);

      expect(handled).toBe(true);
      const updatedSession = getBulkSession(12345);
      expect(updatedSession.baseName).toBe(null);
      const lastCall = mockBot.sendMessage.mock.calls[mockBot.sendMessage.mock.calls.length - 1];
      expect(lastCall[1]).toContain('Confirmar');
    });

    it('devuelve true para /bulk durante sesión activa', async () => {
      const msg = {
        chat: { id: 12345 },
        text: '/bulk',
      };

      const handled = await controller.handleBulkMessage(msg);
      expect(handled).toBe(true);
    });

    it('devuelve true para /bulk_done durante sesión activa', async () => {
      const msg = {
        chat: { id: 12345 },
        text: '/bulk_done',
      };

      const handled = await controller.handleBulkMessage(msg);
      expect(handled).toBe(true);
    });

    it('devuelve false cuando hay sesión pero estado no coincide', async () => {
      const bulkHandler = mockBot.onText.mock.calls.find(call =>
        call[0].toString() === '/\\/bulk$/'
      )[1];

      await bulkHandler({ chat: { id: 12345 } });

      const session = getBulkSession(12345);
      session.state = 'unknown_state';

      const msg = {
        chat: { id: 12345 },
        text: 'random text',
      };

      const handled = await controller.handleBulkMessage(msg);
      expect(handled).toBe(false);
    });
  });

  describe('/bulk_done handler', () => {
    it('muestra error si no hay sesión activa', async () => {
      const bulkDoneHandler = mockBot.onText.mock.calls.find(call =>
        call[0].toString() === '/\\/bulk_done/'
      )[1];

      await bulkDoneHandler({ chat: { id: 12345 } });

      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        12345,
        expect.stringContaining('No hay sesión bulk activa')
      );
    });

    it('muestra error si no se enviaron archivos', async () => {
      const bulkHandler = mockBot.onText.mock.calls.find(call =>
        call[0].toString() === '/\\/bulk$/'
      )[1];
      const bulkDoneHandler = mockBot.onText.mock.calls.find(call =>
        call[0].toString() === '/\\/bulk_done/'
      )[1];

      await bulkHandler({ chat: { id: 12345 } });
      await bulkDoneHandler({ chat: { id: 12345 } });

      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        12345,
        expect.stringContaining('No has enviado ningún archivo')
      );
    });

    it('muestra error y limpia sesión si listProperties falla', async () => {
      const bulkHandler = mockBot.onText.mock.calls.find(call =>
        call[0].toString() === '/\\/bulk$/'
      )[1];
      const bulkDoneHandler = mockBot.onText.mock.calls.find(call =>
        call[0].toString() === '/\\/bulk_done/'
      )[1];

      mockDrive.files.list.mockResolvedValue({
        data: {
          files: [{ id: 'catalog-id', name: '.properties.json' }],
        },
      });

      mockDrive.files.get.mockResolvedValue({
        data: JSON.stringify({
          version: 1,
          properties: [],
        }),
      });

      await bulkHandler({ chat: { id: 12345 } });

      const session = getBulkSession(12345);
      session.files = [{ fileId: 'file-1', fileName: 'test.pdf', mimeType: 'application/pdf' }];

      await bulkDoneHandler({ chat: { id: 12345 } });

      const lastCall = mockBot.sendMessage.mock.calls[mockBot.sendMessage.mock.calls.length - 1];
      expect(lastCall[1]).toContain('No hay viviendas');
      const clearedSession = getBulkSession(12345);
      expect(clearedSession === null || clearedSession === undefined).toBe(true);
    });

    it('muestra propiedades disponibles', async () => {
      clearAllBulkSessions();
      vi.clearAllMocks();

      const freshMockDrive = {
        files: {
          list: vi.fn().mockResolvedValue({ data: { files: [{ id: 'catalog-id', name: '.properties.json' }] } }),
          get: vi.fn().mockResolvedValue({
            data: JSON.stringify({
              version: 1,
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
          create: vi.fn().mockResolvedValue({
            data: { id: 'new-folder-id', name: 'FolderName' },
          }),
        },
      };

      const freshController = initializeBulkUploadHandlers({
        bot: mockBot,
        drive: freshMockDrive,
        baseFolderId: 'base-folder-id',
        botToken: 'bot-token-123',
        defaultCommands: [
          { command: 'start', description: 'Mensaje de bienvenida' },
          { command: 'bulk', description: 'Subir varios archivos a la vez' },
          { command: 'cancel', description: 'Cancelar operación actual' },
        ],
        bulkModeCommands: [
          { command: 'bulk_done', description: 'Finalizar subida bulk' },
          { command: 'cancel', description: 'Cancelar operación actual' },
        ],
      });

      const bulkHandler = mockBot.onText.mock.calls.find(call =>
        call[0].toString() === '/\\/bulk$/'
      )[1];
      const bulkDoneHandler = mockBot.onText.mock.calls.find(call =>
        call[0].toString() === '/\\/bulk_done/'
      )[1];

      await bulkHandler({ chat: { id: 12345 } });

      const session = getBulkSession(12345);
      session.files = [{ fileId: 'file-1', fileName: 'test.pdf', mimeType: 'application/pdf' }];

      await bulkDoneHandler({ chat: { id: 12345 } });

      const lastCall = mockBot.sendMessage.mock.calls[mockBot.sendMessage.mock.calls.length - 1];
      expect(lastCall[0]).toBe(12345);
      expect(lastCall[1]).toContain('¿A qué vivienda pertenecen?');
      expect(lastCall[2]).toMatchObject({
        reply_markup: {
          inline_keyboard: expect.arrayContaining([
            expect.arrayContaining([
              expect.objectContaining({
                text: 'Calle Test 123',
                callback_data: 'bulk_property_0',
              }),
            ]),
          ]),
        },
      });
    });

    it('maneja error al listar propiedades', async () => {
      const bulkHandler = mockBot.onText.mock.calls.find(call =>
        call[0].toString() === '/\\/bulk$/'
      )[1];
      const bulkDoneHandler = mockBot.onText.mock.calls.find(call =>
        call[0].toString() === '/\\/bulk_done/'
      )[1];

      mockDrive.files.list.mockRejectedValue(new Error('Drive API error'));

      await bulkHandler({ chat: { id: 12345 } });

      const session = getBulkSession(12345);
      session.files = [{ fileId: 'file-1', fileName: 'test.pdf', mimeType: 'application/pdf' }];

      await bulkDoneHandler({ chat: { id: 12345 } });

      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        12345,
        expect.stringContaining('Error al listar viviendas')
      );
    });
  });

  describe('callback_query handlers', () => {
    let callbackHandler;

    beforeEach(() => {
      callbackHandler = mockBot.on.mock.calls.find(call => call[0] === 'callback_query')[1];
    });

    it('ignora callback si no hay sesión', async () => {
      const callbackQuery = {
        id: 'callback-1',
        message: { chat: { id: 12345 } },
        data: 'bulk_property_0',
      };

      await callbackHandler(callbackQuery);

      expect(mockBot.answerCallbackQuery).toHaveBeenCalledWith('callback-1');
      expect(mockBot.sendMessage).not.toHaveBeenCalled();
    });

    it('maneja bulk_cancel correctamente', async () => {
      const bulkHandler = mockBot.onText.mock.calls.find(call =>
        call[0].toString() === '/\\/bulk$/'
      )[1];

      await bulkHandler({ chat: { id: 12345 } });

      const callbackQuery = {
        id: 'callback-1',
        message: { chat: { id: 12345 } },
        data: 'bulk_cancel',
      };

      await callbackHandler(callbackQuery);

      expect(mockBot.answerCallbackQuery).toHaveBeenCalledWith('callback-1');
      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        12345,
        expect.stringContaining('Operación cancelada')
      );
      const session = getBulkSession(12345);
      expect(session === null || session === undefined).toBe(true);
    });

    it('maneja selección de propiedad', async () => {
      const bulkHandler = mockBot.onText.mock.calls.find(call =>
        call[0].toString() === '/\\/bulk$/'
      )[1];

      await bulkHandler({ chat: { id: 12345 } });

      const session = getBulkSession(12345);
      session.state = 'waiting_for_property';
      session.properties = [
        { address: 'Calle Test 123', propertyFolderId: 'folder-123' },
        { address: 'Calle Test 456', propertyFolderId: 'folder-456' },
      ];

      const callbackQuery = {
        id: 'callback-1',
        message: { chat: { id: 12345 } },
        data: 'bulk_property_1',
      };

      await callbackHandler(callbackQuery);

      expect(mockBot.answerCallbackQuery).toHaveBeenCalledWith('callback-1');
      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        12345,
        expect.stringContaining('¿En qué categoría?'),
        expect.objectContaining({
          reply_markup: expect.objectContaining({
            inline_keyboard: expect.arrayContaining([
              expect.arrayContaining([
                expect.objectContaining({ text: 'Contratos' }),
              ]),
            ]),
          }),
        })
      );

      const updatedSession = getBulkSession(12345);
      expect(updatedSession.selectedProperty.address).toBe('Calle Test 456');
    });

    it('maneja selección de categoría', async () => {
      const bulkHandler = mockBot.onText.mock.calls.find(call =>
        call[0].toString() === '/\\/bulk$/'
      )[1];

      await bulkHandler({ chat: { id: 12345 } });

      const session = getBulkSession(12345);
      session.state = 'waiting_for_category';
      session.selectedProperty = { address: 'Calle Test 123', propertyFolderId: 'folder-123' };

      const callbackQuery = {
        id: 'callback-1',
        message: { chat: { id: 12345 } },
        data: 'bulk_category_Seguros',
      };

      await callbackHandler(callbackQuery);

      expect(mockBot.answerCallbackQuery).toHaveBeenCalledWith('callback-1');
      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        12345,
        expect.stringContaining('¿Año?'),
        expect.objectContaining({
          reply_markup: expect.objectContaining({
            inline_keyboard: expect.any(Array),
          }),
        })
      );

      const updatedSession = getBulkSession(12345);
      expect(updatedSession.category).toBe('Seguros');
      expect(updatedSession.state).toBe('waiting_for_year');
    });

    it('maneja selección de año actual', async () => {
      const bulkHandler = mockBot.onText.mock.calls.find(call =>
        call[0].toString() === '/\\/bulk$/'
      )[1];

      await bulkHandler({ chat: { id: 12345 } });

      const session = getBulkSession(12345);
      session.state = 'waiting_for_year';
      session.selectedProperty = { address: 'Calle Test 123', propertyFolderId: 'folder-123' };
      session.category = 'Contratos';
      session.files = [{ fileId: 'file-1', fileName: 'test.pdf', mimeType: 'application/pdf' }];

      const callbackQuery = {
        id: 'callback-1',
        message: { chat: { id: 12345 } },
        data: 'bulk_year_2025',
      };

      await callbackHandler(callbackQuery);

      expect(mockBot.answerCallbackQuery).toHaveBeenCalledWith('callback-1');
      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        12345,
        expect.stringContaining('Confirmar'),
        expect.any(Object)
      );
    });

    it('pide nombre base cuando hay archivos sin nombre al seleccionar año', async () => {
      const bulkHandler = mockBot.onText.mock.calls.find(call =>
        call[0].toString() === '/\\/bulk$/'
      )[1];

      await bulkHandler({ chat: { id: 12345 } });

      const session = getBulkSession(12345);
      session.state = 'waiting_for_year';
      session.selectedProperty = { address: 'Calle Test 123', propertyFolderId: 'folder-123' };
      session.category = 'Contratos';
      session.files = [
        { fileId: 'photo-1', fileName: 'photo_unique123.jpg', mimeType: 'image/jpeg' },
        { fileId: 'photo-2', fileName: null, mimeType: 'image/jpeg' },
      ];

      const callbackQuery = {
        id: 'callback-1',
        message: { chat: { id: 12345 } },
        data: 'bulk_year_2025',
      };

      await callbackHandler(callbackQuery);

      expect(mockBot.answerCallbackQuery).toHaveBeenCalledWith('callback-1');
      const lastCall = mockBot.sendMessage.mock.calls[mockBot.sendMessage.mock.calls.length - 1];
      expect(lastCall[1]).toContain('sin nombre');
      expect(lastCall[1]).toContain('nombre base');

      const updatedSession = getBulkSession(12345);
      expect(updatedSession.state).toBe('waiting_for_basename');
      expect(updatedSession.year).toBe('2025');
    });

    it('maneja selección de año custom', async () => {
      const bulkHandler = mockBot.onText.mock.calls.find(call =>
        call[0].toString() === '/\\/bulk$/'
      )[1];

      await bulkHandler({ chat: { id: 12345 } });

      const session = getBulkSession(12345);
      session.state = 'waiting_for_year';

      const callbackQuery = {
        id: 'callback-1',
        message: { chat: { id: 12345 } },
        data: 'bulk_year_custom',
      };

      await callbackHandler(callbackQuery);

      expect(mockBot.answerCallbackQuery).toHaveBeenCalledWith('callback-1');
      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        12345,
        expect.stringContaining('Envía el año en formato YYYY')
      );

      const updatedSession = getBulkSession(12345);
      expect(updatedSession.state).toBe('waiting_for_custom_year');
    });

    it('maneja bulk_confirm para verificar duplicados', async () => {
      mockBot.getFile = vi.fn().mockResolvedValue({ file_path: 'documents/file.pdf' });
      const axios = await import('axios');
      vi.spyOn(axios.default, 'get').mockResolvedValue({ data: Buffer.from('file content') });

      const bulkHandler = mockBot.onText.mock.calls.find(call =>
        call[0].toString() === '/\\/bulk$/'
      )[1];

      await bulkHandler({ chat: { id: 12345 } });

      const session = getBulkSession(12345);
      session.state = 'waiting_for_confirmation';
      session.selectedProperty = { address: 'Calle Test 123', propertyFolderId: 'folder-123' };
      session.category = 'Contratos';
      session.year = '2025';
      session.files = [{ fileId: 'file-1', fileName: 'test.pdf', mimeType: 'application/pdf' }];
      session.botToken = 'bot-token-123';

      const callbackQuery = {
        id: 'callback-1',
        message: { chat: { id: 12345 } },
        data: 'bulk_confirm',
      };

      await callbackHandler(callbackQuery);

      expect(mockBot.answerCallbackQuery).toHaveBeenCalledWith('callback-1');
      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        12345,
        expect.stringContaining('Subiendo archivos')
      );
    });

    it('maneja bulk_confirm_replace para ejecutar subida', async () => {
      mockBot.getFile = vi.fn().mockResolvedValue({ file_path: 'documents/file.pdf' });
      const axios = await import('axios');
      vi.spyOn(axios.default, 'get').mockResolvedValue({ data: Buffer.from('file content') });

      const bulkHandler = mockBot.onText.mock.calls.find(call =>
        call[0].toString() === '/\\/bulk$/'
      )[1];

      await bulkHandler({ chat: { id: 12345 } });

      const session = getBulkSession(12345);
      session.state = 'waiting_for_confirmation';
      session.selectedProperty = { address: 'Calle Test 123', propertyFolderId: 'folder-123' };
      session.category = 'Contratos';
      session.year = '2025';
      session.files = [{ fileId: 'file-1', fileName: 'test.pdf', mimeType: 'application/pdf' }];
      session.botToken = 'bot-token-123';

      const callbackQuery = {
        id: 'callback-1',
        message: { chat: { id: 12345 } },
        data: 'bulk_confirm_replace',
      };

      await callbackHandler(callbackQuery);

      expect(mockBot.answerCallbackQuery).toHaveBeenCalledWith('callback-1');
      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        12345,
        expect.stringContaining('Subiendo archivos')
      );
    });

    it('responde a callback desconocido', async () => {
      const bulkHandler = mockBot.onText.mock.calls.find(call =>
        call[0].toString() === '/\\/bulk$/'
      )[1];

      await bulkHandler({ chat: { id: 12345 } });

      const callbackQuery = {
        id: 'callback-1',
        message: { chat: { id: 12345 } },
        data: 'unknown_callback',
      };

      await callbackHandler(callbackQuery);

      expect(mockBot.answerCallbackQuery).toHaveBeenCalledWith('callback-1');
    });
  });

  describe('checkAndConfirmBulkUpload', () => {
    let callbackHandler;

    beforeEach(() => {
      callbackHandler = mockBot.on.mock.calls.find(call => call[0] === 'callback_query')[1];
      mockBot.getFile = vi.fn().mockResolvedValue({ file_path: 'documents/file.pdf' });
    });

    it('muestra advertencia si hay duplicados', async () => {
      mockDrive.files.list.mockResolvedValue({
        data: { files: [{ id: 'existing-file', name: 'test.pdf' }] },
      });

      const bulkHandler = mockBot.onText.mock.calls.find(call =>
        call[0].toString() === '/\\/bulk$/'
      )[1];

      await bulkHandler({ chat: { id: 12345 } });

      const session = getBulkSession(12345);
      session.state = 'waiting_for_confirmation';
      session.selectedProperty = { address: 'Calle Test 123', propertyFolderId: 'folder-123' };
      session.category = 'Contratos';
      session.year = '2025';
      session.files = [{ fileId: 'file-1', fileName: 'test.pdf', mimeType: 'application/pdf' }];
      session.botToken = 'bot-token-123';

      const callbackQuery = {
        id: 'callback-1',
        message: { chat: { id: 12345 } },
        data: 'bulk_confirm',
      };

      await callbackHandler(callbackQuery);

      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        12345,
        expect.stringContaining('ya existen'),
        expect.objectContaining({
          reply_markup: expect.objectContaining({
            inline_keyboard: expect.arrayContaining([
              expect.arrayContaining([
                expect.objectContaining({ text: '✅ Sí, reemplazar' }),
              ]),
            ]),
          }),
        })
      );
    });

    it('ejecuta subida directamente si no hay duplicados', async () => {
      const axios = await import('axios');
      vi.spyOn(axios.default, 'get').mockResolvedValue({ data: Buffer.from('file content') });

      const bulkHandler = mockBot.onText.mock.calls.find(call =>
        call[0].toString() === '/\\/bulk$/'
      )[1];

      await bulkHandler({ chat: { id: 12345 } });

      const session = getBulkSession(12345);
      session.state = 'waiting_for_confirmation';
      session.selectedProperty = { address: 'Calle Test 123', propertyFolderId: 'folder-123' };
      session.category = 'Contratos';
      session.year = '2025';
      session.files = [{ fileId: 'file-1', fileName: 'test.pdf', mimeType: 'application/pdf' }];
      session.botToken = 'bot-token-123';

      const callbackQuery = {
        id: 'callback-1',
        message: { chat: { id: 12345 } },
        data: 'bulk_confirm',
      };

      await callbackHandler(callbackQuery);

      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        12345,
        expect.stringContaining('Subiendo archivos')
      );
    });

    it('maneja error al verificar duplicados', async () => {
      mockDrive.files.list.mockRejectedValue(new Error('Drive API error'));

      const bulkHandler = mockBot.onText.mock.calls.find(call =>
        call[0].toString() === '/\\/bulk$/'
      )[1];

      await bulkHandler({ chat: { id: 12345 } });

      const session = getBulkSession(12345);
      session.state = 'waiting_for_confirmation';
      session.selectedProperty = { address: 'Calle Test 123', propertyFolderId: 'folder-123' };
      session.category = 'Contratos';
      session.year = '2025';
      session.files = [{ fileId: 'file-1', fileName: 'test.pdf', mimeType: 'application/pdf' }];
      session.botToken = 'bot-token-123';

      const callbackQuery = {
        id: 'callback-1',
        message: { chat: { id: 12345 } },
        data: 'bulk_confirm',
      };

      await callbackHandler(callbackQuery);

      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        12345,
        expect.stringContaining('Error al verificar duplicados')
      );
    });
  });

  describe('executeBulkUpload', () => {
    let callbackHandler;

    beforeEach(() => {
      callbackHandler = mockBot.on.mock.calls.find(call => call[0] === 'callback_query')[1];
      mockBot.getFile = vi.fn().mockResolvedValue({ file_path: 'documents/file.pdf' });
    });

    it('muestra mensaje de éxito para subidas exitosas', async () => {
      const axios = await import('axios');
      vi.spyOn(axios.default, 'get').mockResolvedValue({ data: Buffer.from('file content') });

      const bulkHandler = mockBot.onText.mock.calls.find(call =>
        call[0].toString() === '/\\/bulk$/'
      )[1];

      await bulkHandler({ chat: { id: 12345 } });

      const session = getBulkSession(12345);
      session.state = 'waiting_for_confirmation';
      session.selectedProperty = { address: 'Calle Test 123', propertyFolderId: 'folder-123' };
      session.category = 'Contratos';
      session.year = '2025';
      session.files = [
        { fileId: 'file-1', fileName: 'test1.pdf', mimeType: 'application/pdf' },
        { fileId: 'file-2', fileName: 'test2.pdf', mimeType: 'application/pdf' },
      ];
      session.botToken = 'bot-token-123';
      session.defaultCommands = [{ command: 'start', description: 'Start' }];

      const callbackQuery = {
        id: 'callback-1',
        message: { chat: { id: 12345 } },
        data: 'bulk_confirm_replace',
      };

      await callbackHandler(callbackQuery);

      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        12345,
        expect.stringContaining('Subidos 2 archivos')
      );
      const clearedSession = getBulkSession(12345);
      expect(clearedSession === null || clearedSession === undefined).toBe(true);
    });

    it('muestra mensaje de error para fallos parciales', async () => {
      const axios = await import('axios');
      vi.spyOn(axios.default, 'get')
        .mockResolvedValueOnce({ data: Buffer.from('file content') })
        .mockRejectedValueOnce(new Error('Download failed'));

      const bulkHandler = mockBot.onText.mock.calls.find(call =>
        call[0].toString() === '/\\/bulk$/'
      )[1];

      await bulkHandler({ chat: { id: 12345 } });

      const session = getBulkSession(12345);
      session.state = 'waiting_for_confirmation';
      session.selectedProperty = { address: 'Calle Test 123', propertyFolderId: 'folder-123' };
      session.category = 'Contratos';
      session.year = '2025';
      session.files = [
        { fileId: 'file-1', fileName: 'test1.pdf', mimeType: 'application/pdf' },
        { fileId: 'file-2', fileName: 'test2.pdf', mimeType: 'application/pdf' },
      ];
      session.botToken = 'bot-token-123';
      session.defaultCommands = [{ command: 'start', description: 'Start' }];

      const callbackQuery = {
        id: 'callback-1',
        message: { chat: { id: 12345 } },
        data: 'bulk_confirm_replace',
      };

      await callbackHandler(callbackQuery);

      const lastCall = mockBot.sendMessage.mock.calls[mockBot.sendMessage.mock.calls.length - 1];
      expect(lastCall[1]).toContain('Subidos 1 archivo');
      expect(lastCall[1]).toContain('Fallaron 1 archivo');
    });

    it('limpia sesión y restaura comandos en caso de error parcial', async () => {
      mockBot.getFile.mockRejectedValue(new Error('Download error'));

      const bulkHandler = mockBot.onText.mock.calls.find(call =>
        call[0].toString() === '/\\/bulk$/'
      )[1];

      await bulkHandler({ chat: { id: 12345 } });

      const session = getBulkSession(12345);
      session.state = 'waiting_for_confirmation';
      session.selectedProperty = { address: 'Calle Test 123', propertyFolderId: 'folder-123' };
      session.category = 'Contratos';
      session.year = '2025';
      session.files = [{ fileId: 'file-1', fileName: 'test.pdf', mimeType: 'application/pdf' }];
      session.botToken = 'bot-token-123';
      session.defaultCommands = [{ command: 'start', description: 'Start' }];

      const callbackQuery = {
        id: 'callback-1',
        message: { chat: { id: 12345 } },
        data: 'bulk_confirm_replace',
      };

      await callbackHandler(callbackQuery);

      const lastCall = mockBot.sendMessage.mock.calls[mockBot.sendMessage.mock.calls.length - 1];
      expect(lastCall[1]).toContain('Fallaron 1 archivo');
      const clearedSession = getBulkSession(12345);
      expect(clearedSession === null || clearedSession === undefined).toBe(true);
      expect(mockBot.setMyCommands).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({ scope: { type: 'chat', chat_id: 12345 } })
      );
    });

    it('maneja error catastrófico durante upload y restaura estado', async () => {
      const axios = await import('axios');
      vi.spyOn(axios.default, 'get').mockResolvedValue({ data: Buffer.from('content') });
      mockBot.getFile.mockResolvedValue({ file_path: 'documents/file.pdf' });

      let setMyCommandsCallCount = 0;
      mockBot.setMyCommands.mockImplementation(async () => {
        setMyCommandsCallCount++;
        if (setMyCommandsCallCount === 2) {
          throw new Error('Telegram API error');
        }
        return Promise.resolve({});
      });

      const bulkHandler = mockBot.onText.mock.calls.find(call =>
        call[0].toString() === '/\\/bulk$/'
      )[1];

      await bulkHandler({ chat: { id: 12345 } });

      const session = getBulkSession(12345);
      session.state = 'waiting_for_confirmation';
      session.selectedProperty = { address: 'Calle Test 123', propertyFolderId: 'folder-123' };
      session.category = 'Contratos';
      session.year = '2025';
      session.files = [{ fileId: 'file-1', fileName: 'test.pdf', mimeType: 'application/pdf' }];
      session.botToken = 'bot-token-123';
      session.defaultCommands = [{ command: 'start', description: 'Start' }];

      const callbackQuery = {
        id: 'callback-1',
        message: { chat: { id: 12345 } },
        data: 'bulk_confirm_replace',
      };

      await callbackHandler(callbackQuery);

      const lastCall = mockBot.sendMessage.mock.calls[mockBot.sendMessage.mock.calls.length - 1];
      expect(lastCall[1]).toContain('Error al subir archivos');
      const clearedSession = getBulkSession(12345);
      expect(clearedSession === null || clearedSession === undefined).toBe(true);
    });
  });
});
