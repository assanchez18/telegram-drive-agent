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
  });
});
