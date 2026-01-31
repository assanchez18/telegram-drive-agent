import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { initializeSelfTestHandlers } from '../src/controllers/selfTestController.js';
import * as selfTestService from '../src/services/selfTestService.js';
import * as selfTestSessionRepository from '../src/repositories/selfTestSessionRepository.js';

vi.mock('../src/services/selfTestService.js');
vi.mock('../src/repositories/selfTestSessionRepository.js');

describe('initializeSelfTestHandlers', () => {
  let mockBot;
  let mockDrive;
  let commandHandlers;
  let callbackQueryHandlers;
  let originalEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    commandHandlers = {};
    callbackQueryHandlers = [];

    mockBot = {
      onText: vi.fn((pattern, handler) => {
        const patternStr = pattern.toString();
        if (patternStr.includes('self_test')) {
          commandHandlers.self_test = handler;
        }
      }),
      on: vi.fn((event, handler) => {
        if (event === 'callback_query') {
          callbackQueryHandlers.push(handler);
        }
      }),
      sendMessage: vi.fn().mockResolvedValue({}),
      answerCallbackQuery: vi.fn().mockResolvedValue({}),
      editMessageText: vi.fn().mockResolvedValue({}),
    };

    mockDrive = {
      files: {
        list: vi.fn(),
        get: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
    };

    vi.mocked(selfTestSessionRepository.getSelfTestSession).mockReturnValue(undefined);
    vi.mocked(selfTestSessionRepository.startSelfTestSession).mockReturnValue(true);
    vi.mocked(selfTestSessionRepository.endSelfTestSession).mockReturnValue(undefined);
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('lanza error si falta bot', () => {
      expect(() =>
        initializeSelfTestHandlers({
          bot: null,
          drive: mockDrive,
          baseFolderId: 'base-id',
        })
      ).toThrow('Bot is required');
    });

    it('lanza error si falta drive', () => {
      expect(() =>
        initializeSelfTestHandlers({
          bot: mockBot,
          drive: null,
          baseFolderId: 'base-id',
        })
      ).toThrow('Drive client is required');
    });

    it('lanza error si falta baseFolderId', () => {
      expect(() =>
        initializeSelfTestHandlers({
          bot: mockBot,
          drive: mockDrive,
          baseFolderId: '',
        })
      ).toThrow('Base folder ID is required');
    });

    it('registra el handler de /self_test', () => {
      initializeSelfTestHandlers({
        bot: mockBot,
        drive: mockDrive,
        baseFolderId: 'base-id',
      });

      expect(mockBot.onText).toHaveBeenCalledWith(
        expect.objectContaining({ source: expect.stringContaining('self_test') }),
        expect.any(Function)
      );
    });

    it('registra el handler de callback_query', () => {
      initializeSelfTestHandlers({
        bot: mockBot,
        drive: mockDrive,
        baseFolderId: 'base-id',
      });

      expect(mockBot.on).toHaveBeenCalledWith('callback_query', expect.any(Function));
    });
  });

  describe('/self_test command', () => {
    it('muestra mensaje de confirmación para usuarios autorizados', async () => {
      initializeSelfTestHandlers({
        bot: mockBot,
        drive: mockDrive,
        baseFolderId: 'base-id',
      });

      const msg = {
        chat: { id: 123 },
        from: { id: 456 },
        text: '/self_test',
      };

      await commandHandlers.self_test(msg);

      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        123,
        expect.stringContaining('Self-Test del Sistema'),
        expect.objectContaining({
          reply_markup: expect.objectContaining({
            inline_keyboard: expect.any(Array),
          }),
        })
      );
    });

    it('rechaza si ya hay una sesión activa', async () => {
      vi.mocked(selfTestSessionRepository.getSelfTestSession).mockReturnValue({
        status: 'running',
        startedAt: '2024-01-01T00:00:00.000Z',
      });

      initializeSelfTestHandlers({
        bot: mockBot,
        drive: mockDrive,
        baseFolderId: 'base-id',
      });

      const msg = {
        chat: { id: 123 },
        from: { id: 456 },
        text: '/self_test',
      };

      await commandHandlers.self_test(msg);

      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        123,
        expect.stringContaining('Ya hay un self-test en ejecución')
      );
    });

    it('muestra mensaje de confirmación con botones inline', async () => {

      initializeSelfTestHandlers({
        bot: mockBot,
        drive: mockDrive,
        baseFolderId: 'base-id',
      });

      const msg = {
        chat: { id: 123 },
        from: { id: 456 },
        text: '/self_test',
      };

      await commandHandlers.self_test(msg);

      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        123,
        expect.stringContaining('7. Eliminará la propiedad de prueba'),
        {
          reply_markup: {
            inline_keyboard: [
              [
                { text: '✅ Confirmar', callback_data: 'selftest_confirm' },
                { text: '❌ Cancelar', callback_data: 'selftest_cancel' },
              ],
            ],
          },
        }
      );
    });
  });

  describe('callback_query handling', () => {
    it('cancela self-test cuando el usuario presiona Cancelar', async () => {

      initializeSelfTestHandlers({
        bot: mockBot,
        drive: mockDrive,
        baseFolderId: 'base-id',
      });

      // Primero ejecutar el comando para establecer el estado
      const msg = {
        chat: { id: 123 },
        from: { id: 456 },
        text: '/self_test',
      };
      await commandHandlers.self_test(msg);

      // Luego manejar el callback de cancelar
      const query = {
        id: 'query-123',
        from: { id: 456 },
        message: {
          chat: { id: 123 },
          message_id: 999,
        },
        data: 'selftest_cancel',
      };

      await callbackQueryHandlers[0](query);

      expect(mockBot.answerCallbackQuery).toHaveBeenCalledWith('query-123');
      expect(mockBot.editMessageText).toHaveBeenCalledWith(
        expect.stringContaining('cancelado'),
        {
          chat_id: 123,
          message_id: 999,
        }
      );
    });

    it('ejecuta self-test cuando el usuario confirma', async () => {

      const mockReport = {
        success: true,
        steps: [
          {
            step: 1,
            total: 7,
            name: 'Verificar listado de propiedades',
            status: 'success',
            result: '0 propiedades encontradas',
          },
          {
            step: 2,
            total: 7,
            name: 'Crear propiedad de prueba',
            status: 'success',
            result: 'Propiedad "Self-Test-123" creada',
          },
          {
            step: 3,
            total: 7,
            name: 'Verificar estructura de carpetas',
            status: 'success',
            result: '8 carpetas verificadas correctamente',
          },
          {
            step: 4,
            total: 7,
            name: 'Subir archivos de prueba',
            status: 'success',
            result: '2 archivos subidos correctamente',
          },
          {
            step: 5,
            total: 7,
            name: 'Archivar propiedad',
            status: 'success',
            result: 'Propiedad archivada correctamente',
          },
          {
            step: 6,
            total: 7,
            name: 'Reactivar propiedad',
            status: 'success',
            result: 'Propiedad reactivada correctamente',
          },
          {
            step: 7,
            total: 7,
            name: 'Eliminar propiedad de prueba (cleanup)',
            status: 'success',
            result: 'Propiedad eliminada correctamente',
          },
        ],
        testPropertyAddress: 'Self-Test-123',
      };

      vi.mocked(selfTestService.executeSelfTest).mockResolvedValue(mockReport);

      initializeSelfTestHandlers({
        bot: mockBot,
        drive: mockDrive,
        baseFolderId: 'base-id',
      });

      // Ejecutar comando
      const msg = {
        chat: { id: 123 },
        from: { id: 456 },
        text: '/self_test',
      };
      await commandHandlers.self_test(msg);

      // Confirmar
      const query = {
        id: 'query-123',
        from: { id: 456 },
        message: {
          chat: { id: 123 },
          message_id: 999,
        },
        data: 'selftest_confirm',
      };

      await callbackQueryHandlers[0](query);

      expect(mockBot.answerCallbackQuery).toHaveBeenCalledWith('query-123');
      expect(mockBot.editMessageText).toHaveBeenCalledWith(
        expect.stringContaining('Ejecutando self-test'),
        expect.any(Object)
      );
      expect(selfTestService.executeSelfTest).toHaveBeenCalledWith({
        drive: mockDrive,
        baseFolderId: 'base-id',
      });
      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        123,
        expect.stringContaining('Self-Test exitoso'),
        { parse_mode: 'Markdown' }
      );
      expect(selfTestSessionRepository.endSelfTestSession).toHaveBeenCalledWith(123);
    });

    it('muestra reporte con todos los pasos y sus resultados', async () => {

      const mockReport = {
        success: true,
        steps: [
          {
            step: 1,
            total: 7,
            name: 'Paso 1',
            status: 'success',
            result: 'Resultado 1',
          },
          {
            step: 2,
            total: 7,
            name: 'Paso 2',
            status: 'success',
            result: 'Resultado 2',
          },
        ],
      };

      vi.mocked(selfTestService.executeSelfTest).mockResolvedValue(mockReport);

      initializeSelfTestHandlers({
        bot: mockBot,
        drive: mockDrive,
        baseFolderId: 'base-id',
      });

      const msg = {
        chat: { id: 123 },
        from: { id: 456 },
        text: '/self_test',
      };
      await commandHandlers.self_test(msg);

      const query = {
        id: 'query-123',
        from: { id: 456 },
        message: {
          chat: { id: 123 },
          message_id: 999,
        },
        data: 'selftest_confirm',
      };

      await callbackQueryHandlers[0](query);

      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        123,
        expect.stringMatching(/Paso 1\/7: Paso 1.*✅ OK.*Resultado 1/s),
        { parse_mode: 'Markdown' }
      );
    });

    it('muestra error y cleanup cuando el self-test falla', async () => {

      const mockReport = {
        success: false,
        error: 'Test error',
        steps: [
          {
            step: 1,
            total: 7,
            name: 'Paso 1',
            status: 'success',
          },
          {
            step: 2,
            total: 7,
            name: 'Paso 2',
            status: 'failed',
            error: 'Test error',
          },
        ],
        testPropertyAddress: 'Self-Test-123',
        cleanupPerformed: true,
      };

      vi.mocked(selfTestService.executeSelfTest).mockResolvedValue(mockReport);

      initializeSelfTestHandlers({
        bot: mockBot,
        drive: mockDrive,
        baseFolderId: 'base-id',
      });

      const msg = {
        chat: { id: 123 },
        from: { id: 456 },
        text: '/self_test',
      };
      await commandHandlers.self_test(msg);

      const query = {
        id: 'query-123',
        from: { id: 456 },
        message: {
          chat: { id: 123 },
          message_id: 999,
        },
        data: 'selftest_confirm',
      };

      await callbackQueryHandlers[0](query);

      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        123,
        expect.stringMatching(/Self-Test fallido.*Test error.*Cleanup realizado/s),
        { parse_mode: 'Markdown' }
      );
    });

    it('termina sesión incluso si executeSelfTest lanza excepción', async () => {

      vi.mocked(selfTestService.executeSelfTest).mockRejectedValue(
        new Error('Unexpected error')
      );

      initializeSelfTestHandlers({
        bot: mockBot,
        drive: mockDrive,
        baseFolderId: 'base-id',
      });

      const msg = {
        chat: { id: 123 },
        from: { id: 456 },
        text: '/self_test',
      };
      await commandHandlers.self_test(msg);

      const query = {
        id: 'query-123',
        from: { id: 456 },
        message: {
          chat: { id: 123 },
          message_id: 999,
        },
        data: 'selftest_confirm',
      };

      await callbackQueryHandlers[0](query);

      expect(selfTestSessionRepository.endSelfTestSession).toHaveBeenCalledWith(123);
      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        123,
        expect.stringContaining('Error ejecutando self-test')
      );
    });

    it('rechaza ejecución si ya hay sesión activa (race condition)', async () => {
      vi.mocked(selfTestSessionRepository.startSelfTestSession).mockReturnValue(false);

      initializeSelfTestHandlers({
        bot: mockBot,
        drive: mockDrive,
        baseFolderId: 'base-id',
      });

      const msg = {
        chat: { id: 123 },
        from: { id: 456 },
        text: '/self_test',
      };
      await commandHandlers.self_test(msg);

      const query = {
        id: 'query-123',
        from: { id: 456 },
        message: {
          chat: { id: 123 },
          message_id: 999,
        },
        data: 'selftest_confirm',
      };

      await callbackQueryHandlers[0](query);

      expect(mockBot.editMessageText).toHaveBeenCalledWith(
        expect.stringContaining('Ya hay un self-test en ejecución'),
        expect.any(Object)
      );
      expect(selfTestService.executeSelfTest).not.toHaveBeenCalled();
    });

    it('ignora callbacks que no son de self-test', async () => {

      initializeSelfTestHandlers({
        bot: mockBot,
        drive: mockDrive,
        baseFolderId: 'base-id',
      });

      const query = {
        id: 'query-123',
        from: { id: 456 },
        message: {
          chat: { id: 123 },
          message_id: 999,
        },
        data: 'other_callback',
      };

      await callbackQueryHandlers[0](query);

      expect(mockBot.answerCallbackQuery).not.toHaveBeenCalled();
      expect(mockBot.editMessageText).not.toHaveBeenCalled();
    });
  });

  describe('development mode', () => {
    it('incluye prefijo DEV:: en mensajes cuando NODE_ENV=development', async () => {
      process.env.NODE_ENV = 'development';

      initializeSelfTestHandlers({
        bot: mockBot,
        drive: mockDrive,
        baseFolderId: 'base-id',
      });

      const msg = {
        chat: { id: 123 },
        from: { id: 456 },
        text: '/self_test',
      };

      await commandHandlers.self_test(msg);

      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        123,
        expect.stringContaining('DEV::'),
        expect.any(Object)
      );
    });
  });
});
