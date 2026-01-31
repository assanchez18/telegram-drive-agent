import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleTelegramMessage } from '../src/messageHandler.js';

describe('handleTelegramMessage - Bug Fix: No Double Response', () => {
  let mockBot;
  let mockControllers;
  let mockHelpers;

  beforeEach(() => {
    vi.clearAllMocks();

    mockBot = {
      sendMessage: vi.fn().mockResolvedValue({}),
      setMyCommands: vi.fn().mockResolvedValue({}),
    };

    mockControllers = {
      bulkUploadController: {
        handleBulkMessage: vi.fn().mockResolvedValue(false),
      },
      individualUploadController: {
        handleIndividualUploadMessage: vi.fn().mockResolvedValue(false),
        startIndividualUpload: vi.fn().mockResolvedValue({}),
      },
      propertyController: {
        handleTextMessage: vi.fn().mockResolvedValue(false),
      },
    };

    mockHelpers = {
      isAuthorizedTelegramUser: vi.fn().mockReturnValue(true),
      clearBulkSession: vi.fn(),
      clearIndividualUploadSession: vi.fn(),
      extractTelegramFileInfo: vi.fn().mockReturnValue(null),
      defaultCommands: [
        { command: 'start', description: 'Start' },
        { command: 'help', description: 'Help' },
      ],
    };
  });

  describe('Comandos conocidos manejados por bot.onText()', () => {
    it('/list_properties - NO debe ejecutar fallback (ya manejado por bot.onText)', async () => {
      const msg = {
        chat: { id: 123 },
        from: { id: 456 },
        text: '/list_properties',
      };

      await handleTelegramMessage({
        msg,
        bot: mockBot,
        ...mockHelpers,
        ...mockControllers,
      });

      // NO debe enviar mensaje de fallback "comando no reconocido"
      expect(mockBot.sendMessage).not.toHaveBeenCalled();
    });

    it('/add_property - NO debe ejecutar fallback', async () => {
      const msg = {
        chat: { id: 123 },
        from: { id: 456 },
        text: '/add_property',
      };

      await handleTelegramMessage({
        msg,
        bot: mockBot,
        ...mockHelpers,
        ...mockControllers,
      });

      expect(mockBot.sendMessage).not.toHaveBeenCalled();
    });

    it('/delete_property - NO debe ejecutar fallback', async () => {
      const msg = {
        chat: { id: 123 },
        from: { id: 456 },
        text: '/delete_property',
      };

      await handleTelegramMessage({
        msg,
        bot: mockBot,
        ...mockHelpers,
        ...mockControllers,
      });

      expect(mockBot.sendMessage).not.toHaveBeenCalled();
    });

    it('/archive_property - NO debe ejecutar fallback', async () => {
      const msg = {
        chat: { id: 123 },
        from: { id: 456 },
        text: '/archive_property',
      };

      await handleTelegramMessage({
        msg,
        bot: mockBot,
        ...mockHelpers,
        ...mockControllers,
      });

      expect(mockBot.sendMessage).not.toHaveBeenCalled();
    });

    it('/list_archived - NO debe ejecutar fallback', async () => {
      const msg = {
        chat: { id: 123 },
        from: { id: 456 },
        text: '/list_archived',
      };

      await handleTelegramMessage({
        msg,
        bot: mockBot,
        ...mockHelpers,
        ...mockControllers,
      });

      expect(mockBot.sendMessage).not.toHaveBeenCalled();
    });

    it('/unarchive_property - NO debe ejecutar fallback', async () => {
      const msg = {
        chat: { id: 123 },
        from: { id: 456 },
        text: '/unarchive_property',
      };

      await handleTelegramMessage({
        msg,
        bot: mockBot,
        ...mockHelpers,
        ...mockControllers,
      });

      expect(mockBot.sendMessage).not.toHaveBeenCalled();
    });

    it('/bulk - NO debe ejecutar fallback', async () => {
      const msg = {
        chat: { id: 123 },
        from: { id: 456 },
        text: '/bulk',
      };

      await handleTelegramMessage({
        msg,
        bot: mockBot,
        ...mockHelpers,
        ...mockControllers,
      });

      expect(mockBot.sendMessage).not.toHaveBeenCalled();
    });

    it('/bulk_done - NO debe ejecutar fallback', async () => {
      const msg = {
        chat: { id: 123 },
        from: { id: 456 },
        text: '/bulk_done',
      };

      await handleTelegramMessage({
        msg,
        bot: mockBot,
        ...mockHelpers,
        ...mockControllers,
      });

      expect(mockBot.sendMessage).not.toHaveBeenCalled();
    });

    it('/self_test - NO debe ejecutar fallback', async () => {
      const msg = {
        chat: { id: 123 },
        from: { id: 456 },
        text: '/self_test',
      };

      await handleTelegramMessage({
        msg,
        bot: mockBot,
        ...mockHelpers,
        ...mockControllers,
      });

      expect(mockBot.sendMessage).not.toHaveBeenCalled();
    });

    it('/version - NO debe ejecutar fallback', async () => {
      const msg = {
        chat: { id: 123 },
        from: { id: 456 },
        text: '/version',
      };

      await handleTelegramMessage({
        msg,
        bot: mockBot,
        ...mockHelpers,
        ...mockControllers,
      });

      expect(mockBot.sendMessage).not.toHaveBeenCalled();
    });

    it('/status - NO debe ejecutar fallback', async () => {
      const msg = {
        chat: { id: 123 },
        from: { id: 456 },
        text: '/status',
      };

      await handleTelegramMessage({
        msg,
        bot: mockBot,
        ...mockHelpers,
        ...mockControllers,
      });

      expect(mockBot.sendMessage).not.toHaveBeenCalled();
    });

    it('/google_login - NO debe ejecutar fallback', async () => {
      const msg = {
        chat: { id: 123 },
        from: { id: 456 },
        text: '/google_login',
      };

      await handleTelegramMessage({
        msg,
        bot: mockBot,
        ...mockHelpers,
        ...mockControllers,
      });

      expect(mockBot.sendMessage).not.toHaveBeenCalled();
    });
  });

  describe('Comandos manejados en messageHandler', () => {
    it('/help - debe responder UNA VEZ con mensaje de ayuda', async () => {
      const msg = {
        chat: { id: 123 },
        from: { id: 456 },
        text: '/help',
      };

      await handleTelegramMessage({
        msg,
        bot: mockBot,
        ...mockHelpers,
        ...mockControllers,
      });

      expect(mockBot.sendMessage).toHaveBeenCalledTimes(1);
      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        123,
        expect.stringContaining('Todos los comandos disponibles')
      );

      const helpMessage = mockBot.sendMessage.mock.calls[0][1];
      expect(helpMessage).toContain('/version');
      expect(helpMessage).toContain('/status');
      expect(helpMessage).toContain('/google_login');
    });

    it('/start - debe responder UNA VEZ con mensaje de ayuda', async () => {
      const msg = {
        chat: { id: 123 },
        from: { id: 456 },
        text: '/start',
      };

      await handleTelegramMessage({
        msg,
        bot: mockBot,
        ...mockHelpers,
        ...mockControllers,
      });

      expect(mockBot.sendMessage).toHaveBeenCalledTimes(1);
      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        123,
        expect.stringContaining('Todos los comandos disponibles')
      );
    });

    it('/archive - debe responder UNA VEZ con menú de archivo', async () => {
      const msg = {
        chat: { id: 123 },
        from: { id: 456 },
        text: '/archive',
      };

      await handleTelegramMessage({
        msg,
        bot: mockBot,
        ...mockHelpers,
        ...mockControllers,
      });

      expect(mockBot.sendMessage).toHaveBeenCalledTimes(1);
      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        123,
        expect.stringContaining('Gestión de archivo')
      );
    });

    it('/cancel - debe limpiar sesiones y responder UNA VEZ', async () => {
      const msg = {
        chat: { id: 123 },
        from: { id: 456 },
        text: '/cancel',
      };

      await handleTelegramMessage({
        msg,
        bot: mockBot,
        ...mockHelpers,
        ...mockControllers,
      });

      expect(mockHelpers.clearBulkSession).toHaveBeenCalledWith(123);
      expect(mockHelpers.clearIndividualUploadSession).toHaveBeenCalledWith(123);
      expect(mockBot.sendMessage).toHaveBeenCalledTimes(1);
      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        123,
        expect.stringContaining('Operación cancelada')
      );
    });
  });

  describe('Comandos inválidos', () => {
    it('texto random - debe responder UNA VEZ con fallback', async () => {
      const msg = {
        chat: { id: 123 },
        from: { id: 456 },
        text: 'asdf random text',
      };

      await handleTelegramMessage({
        msg,
        bot: mockBot,
        ...mockHelpers,
        ...mockControllers,
      });

      expect(mockBot.sendMessage).toHaveBeenCalledTimes(1);
      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        123,
        expect.stringContaining('Comando no reconocido')
      );
    });

    it('comando inexistente /foobar - debe responder UNA VEZ con fallback', async () => {
      const msg = {
        chat: { id: 123 },
        from: { id: 456 },
        text: '/foobar',
      };

      await handleTelegramMessage({
        msg,
        bot: mockBot,
        ...mockHelpers,
        ...mockControllers,
      });

      expect(mockBot.sendMessage).toHaveBeenCalledTimes(1);
      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        123,
        expect.stringContaining('Comando no reconocido')
      );
    });
  });

  describe('Flujos conversacionales', () => {
    it('mensaje en flujo conversacional - NO debe ejecutar fallback', async () => {
      const msg = {
        chat: { id: 123 },
        from: { id: 456 },
        text: 'Calle Mayor 123',
      };

      // Simular que el propertyController está esperando una dirección
      mockControllers.propertyController.handleTextMessage.mockResolvedValue(true);

      await handleTelegramMessage({
        msg,
        bot: mockBot,
        ...mockHelpers,
        ...mockControllers,
      });

      expect(mockBot.sendMessage).not.toHaveBeenCalled();
    });

    it('mensaje en sesión bulk - NO debe ejecutar fallback', async () => {
      const msg = {
        chat: { id: 123 },
        from: { id: 456 },
        document: {
          file_id: 'file-123',
          file_unique_id: 'unique-123',
          file_name: 'test.pdf',
          mime_type: 'application/pdf',
        },
      };

      // Simular que el bulkController está manejando el archivo
      mockControllers.bulkUploadController.handleBulkMessage.mockResolvedValue(true);

      await handleTelegramMessage({
        msg,
        bot: mockBot,
        ...mockHelpers,
        ...mockControllers,
      });

      expect(mockBot.sendMessage).not.toHaveBeenCalled();
    });

    it('archivo en sesión individual - NO debe ejecutar fallback', async () => {
      const msg = {
        chat: { id: 123 },
        from: { id: 456 },
        document: {
          file_id: 'file-123',
          file_unique_id: 'unique-123',
          file_name: 'test.pdf',
          mime_type: 'application/pdf',
        },
      };

      // Simular que el individualController está manejando el archivo
      mockControllers.individualUploadController.handleIndividualUploadMessage.mockResolvedValue(true);

      await handleTelegramMessage({
        msg,
        bot: mockBot,
        ...mockHelpers,
        ...mockControllers,
      });

      expect(mockBot.sendMessage).not.toHaveBeenCalled();
    });
  });

  describe('Autorización', () => {
    it('usuario no autorizado - debe responder UNA VEZ con mensaje de error', async () => {
      const msg = {
        chat: { id: 123 },
        from: { id: 999 },
        text: '/help',
      };

      mockHelpers.isAuthorizedTelegramUser.mockReturnValue(false);

      await handleTelegramMessage({
        msg,
        bot: mockBot,
        ...mockHelpers,
        ...mockControllers,
      });

      expect(mockBot.sendMessage).toHaveBeenCalledTimes(1);
      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        123,
        expect.stringContaining('No autorizado')
      );
    });
  });

  describe('Subida de archivos', () => {
    it('archivo sin sesión activa - debe iniciar subida individual', async () => {
      const msg = {
        chat: { id: 123 },
        from: { id: 456 },
        document: {
          file_id: 'file-123',
          file_unique_id: 'unique-123',
          file_name: 'test.pdf',
          mime_type: 'application/pdf',
        },
      };

      const fileInfo = {
        fileId: 'file-123',
        fileUniqueId: 'unique-123',
        fileName: 'test.pdf',
        mimeType: 'application/pdf',
      };

      mockHelpers.extractTelegramFileInfo.mockReturnValue(fileInfo);

      await handleTelegramMessage({
        msg,
        bot: mockBot,
        ...mockHelpers,
        ...mockControllers,
      });

      expect(mockControllers.individualUploadController.startIndividualUpload).toHaveBeenCalledWith(
        msg,
        fileInfo
      );
      expect(mockBot.sendMessage).not.toHaveBeenCalled();
    });
  });

  describe('Modo development (cobertura isDev)', () => {
    let originalEnv;

    beforeEach(() => {
      originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
    });

    afterEach(() => {
      process.env.NODE_ENV = originalEnv;
    });

    it('usuario no autorizado - debe incluir prefijo DEV::', async () => {
      const msg = {
        chat: { id: 123 },
        from: { id: 999 },
        text: '/help',
      };

      mockHelpers.isAuthorizedTelegramUser.mockReturnValue(false);

      await handleTelegramMessage({
        msg,
        bot: mockBot,
        ...mockHelpers,
        ...mockControllers,
      });

      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        123,
        expect.stringContaining('DEV::')
      );
    });

    it('/cancel - debe incluir prefijo DEV::', async () => {
      const msg = {
        chat: { id: 123 },
        from: { id: 456 },
        text: '/cancel',
      };

      await handleTelegramMessage({
        msg,
        bot: mockBot,
        ...mockHelpers,
        ...mockControllers,
      });

      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        123,
        expect.stringContaining('DEV::')
      );
    });

    it('/help - debe incluir prefijo DEV::', async () => {
      const msg = {
        chat: { id: 123 },
        from: { id: 456 },
        text: '/help',
      };

      await handleTelegramMessage({
        msg,
        bot: mockBot,
        ...mockHelpers,
        ...mockControllers,
      });

      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        123,
        expect.stringContaining('DEV::')
      );
    });

    it('/archive - debe incluir prefijo DEV::', async () => {
      const msg = {
        chat: { id: 123 },
        from: { id: 456 },
        text: '/archive',
      };

      await handleTelegramMessage({
        msg,
        bot: mockBot,
        ...mockHelpers,
        ...mockControllers,
      });

      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        123,
        expect.stringContaining('DEV::')
      );
    });

    it('comando inválido - debe incluir prefijo DEV::', async () => {
      const msg = {
        chat: { id: 123 },
        from: { id: 456 },
        text: 'random text',
      };

      await handleTelegramMessage({
        msg,
        bot: mockBot,
        ...mockHelpers,
        ...mockControllers,
      });

      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        123,
        expect.stringContaining('DEV::')
      );
    });
  });
});
