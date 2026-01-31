import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initializeGoogleLoginHandlers } from '../src/controllers/googleLoginController.js';
import * as googleReauthService from '../src/services/googleReauthService.js';

vi.mock('../src/services/googleReauthService.js');

describe('googleLoginController', () => {
  let mockBot;
  const mockOAuthClientJson = JSON.stringify({
    web: {
      client_id: 'test-client-id',
      client_secret: 'test-client-secret',
    },
  });
  const mockStateSecret = 'test-secret-minimum-32-characters-long';
  const mockBaseUrl = 'https://example.com';
  const mockPort = 8080;

  beforeEach(() => {
    vi.clearAllMocks();

    mockBot = {
      on: vi.fn(),
      answerCallbackQuery: vi.fn().mockResolvedValue({}),
      editMessageText: vi.fn().mockResolvedValue({}),
    };
  });

  it('lanza error si falta bot', () => {
    expect(() =>
      initializeGoogleLoginHandlers({
        bot: null,
        oauthClientJson: mockOAuthClientJson,
        stateSecret: mockStateSecret,
        baseUrl: mockBaseUrl,
      })
    ).toThrow('Bot is required');
  });

  it('lanza error si falta oauthClientJson', () => {
    expect(() =>
      initializeGoogleLoginHandlers({
        bot: mockBot,
        oauthClientJson: null,
        stateSecret: mockStateSecret,
        baseUrl: mockBaseUrl,
      })
    ).toThrow('OAuth client JSON is required');
  });

  it('lanza error si falta stateSecret', () => {
    expect(() =>
      initializeGoogleLoginHandlers({
        bot: mockBot,
        oauthClientJson: mockOAuthClientJson,
        stateSecret: null,
        baseUrl: mockBaseUrl,
        port: mockPort,
      })
    ).toThrow('State secret is required');
  });

  it('registra handler para callback_query', () => {
    initializeGoogleLoginHandlers({
      bot: mockBot,
      oauthClientJson: mockOAuthClientJson,
      stateSecret: mockStateSecret,
      baseUrl: mockBaseUrl,
      port: mockPort,
    });

    expect(mockBot.on).toHaveBeenCalledWith('callback_query', expect.any(Function));
  });

  describe('callback_query handler', () => {
    let callbackQueryHandler;

    beforeEach(() => {
      initializeGoogleLoginHandlers({
        bot: mockBot,
        oauthClientJson: mockOAuthClientJson,
        stateSecret: mockStateSecret,
        baseUrl: mockBaseUrl,
        port: mockPort,
      });

      callbackQueryHandler = mockBot.on.mock.calls.find(
        (call) => call[0] === 'callback_query'
      )[1];
    });

    it('ignora callbacks que no son de google_login', async () => {
      const callbackQuery = {
        id: 'callback-123',
        data: 'other_callback',
        message: { chat: { id: 123 }, message_id: 456 },
        from: { id: 789 },
      };

      await callbackQueryHandler(callbackQuery);

      expect(mockBot.answerCallbackQuery).not.toHaveBeenCalled();
    });

    it('cancela sesión al hacer click en Cancelar', async () => {
      vi.mocked(googleReauthService.cancelSession).mockReturnValue(true);

      const callbackQuery = {
        id: 'callback-123',
        data: 'google_login_cancel',
        message: { chat: { id: 123 }, message_id: 456 },
        from: { id: 789 },
      };

      await callbackQueryHandler(callbackQuery);

      expect(googleReauthService.cancelSession).toHaveBeenCalledWith(123);
      expect(mockBot.answerCallbackQuery).toHaveBeenCalledWith('callback-123');
      expect(mockBot.editMessageText).toHaveBeenCalledWith(
        expect.stringContaining('❌ Autorización cancelada'),
        {
          chat_id: 123,
          message_id: 456,
        }
      );
    });

    it('genera link al hacer click en Continuar', async () => {
      vi.mocked(googleReauthService.hasActiveSession).mockReturnValue(false);
      vi.mocked(googleReauthService.createAuthUrl).mockReturnValue({
        url: 'https://accounts.google.com/oauth/test',
        expiresAt: Date.now() + 10 * 60 * 1000,
      });

      const callbackQuery = {
        id: 'callback-123',
        data: 'google_login_confirm',
        message: { chat: { id: 123 }, message_id: 456 },
        from: { id: 789 },
      };

      await callbackQueryHandler(callbackQuery);

      expect(googleReauthService.createAuthUrl).toHaveBeenCalledWith({
        chatId: 123,
        userId: 789,
        oauthClientJson: mockOAuthClientJson,
        stateSecret: mockStateSecret,
        baseUrl: mockBaseUrl,
        port: mockPort,
      });

      expect(mockBot.answerCallbackQuery).toHaveBeenCalledWith('callback-123');
      expect(mockBot.editMessageText).toHaveBeenCalledWith(
        expect.stringContaining('https://accounts.google.com/oauth/test'),
        expect.objectContaining({
          chat_id: 123,
          message_id: 456,
          disable_web_page_preview: true,
        })
      );
    });

    it('NO usa parse_mode al enviar URL con caracteres problemáticos para Markdown', async () => {
      vi.mocked(googleReauthService.hasActiveSession).mockReturnValue(false);
      // URL OAuth realista con caracteres problemáticos: '_' en select_account
      const urlWithUnderscore = 'https://accounts.google.com/o/oauth2/v2/auth?prompt=consent+select_account&state=test_state';
      vi.mocked(googleReauthService.createAuthUrl).mockReturnValue({
        url: urlWithUnderscore,
        expiresAt: Date.now() + 10 * 60 * 1000,
      });

      const callbackQuery = {
        id: 'callback-123',
        data: 'google_login_confirm',
        message: { chat: { id: 123 }, message_id: 456 },
        from: { id: 789 },
      };

      await callbackQueryHandler(callbackQuery);

      // Verificar que se llama editMessageText
      expect(mockBot.editMessageText).toHaveBeenCalled();
      const editCall = mockBot.editMessageText.mock.calls[0];
      const [messageText, options] = editCall;

      // CRÍTICO: NO debe tener parse_mode para evitar error de parsing con '_'
      expect(options.parse_mode).toBeUndefined();

      // DEBE tener disable_web_page_preview
      expect(options.disable_web_page_preview).toBe(true);

      // DEBE contener la URL con los caracteres problemáticos
      expect(messageText).toContain(urlWithUnderscore);
    });

    it('muestra alerta si ya hay sesión activa', async () => {
      vi.mocked(googleReauthService.hasActiveSession).mockReturnValue(true);

      const callbackQuery = {
        id: 'callback-123',
        data: 'google_login_confirm',
        message: { chat: { id: 123 }, message_id: 456 },
        from: { id: 789 },
      };

      await callbackQueryHandler(callbackQuery);

      expect(mockBot.answerCallbackQuery).toHaveBeenCalledWith('callback-123', {
        text: expect.stringContaining('Ya hay una sesión activa'),
        show_alert: true,
      });

      expect(googleReauthService.createAuthUrl).not.toHaveBeenCalled();
    });

    it('muestra error si falla la generación del link', async () => {
      vi.mocked(googleReauthService.hasActiveSession).mockReturnValue(false);
      vi.mocked(googleReauthService.createAuthUrl).mockImplementation(() => {
        throw new Error('OAuth error');
      });

      const callbackQuery = {
        id: 'callback-123',
        data: 'google_login_confirm',
        message: { chat: { id: 123 }, message_id: 456 },
        from: { id: 789 },
      };

      await callbackQueryHandler(callbackQuery);

      expect(mockBot.answerCallbackQuery).toHaveBeenCalledWith('callback-123', {
        text: 'Error: OAuth error',
        show_alert: true,
      });

      expect(mockBot.editMessageText).toHaveBeenCalledWith(
        expect.stringContaining('❌ Error generando link'),
        {
          chat_id: 123,
          message_id: 456,
        }
      );
    });

    it('maneja error en editMessageText cuando falla la generación del link', async () => {
      vi.mocked(googleReauthService.hasActiveSession).mockReturnValue(false);
      vi.mocked(googleReauthService.createAuthUrl).mockImplementation(() => {
        throw new Error('OAuth error');
      });

      // editMessageText también falla
      mockBot.editMessageText.mockRejectedValueOnce(new Error('Telegram API error'));

      const callbackQuery = {
        id: 'callback-123',
        data: 'google_login_confirm',
        message: { chat: { id: 123 }, message_id: 456 },
        from: { id: 789 },
      };

      // No debe lanzar error, debe manejar la excepción silenciosamente
      await expect(callbackQueryHandler(callbackQuery)).resolves.not.toThrow();

      expect(mockBot.answerCallbackQuery).toHaveBeenCalledWith('callback-123', {
        text: 'Error: OAuth error',
        show_alert: true,
      });

      expect(mockBot.editMessageText).toHaveBeenCalled();
    });

    it('maneja error en editMessageText cuando se cancela', async () => {
      vi.mocked(googleReauthService.cancelSession).mockReturnValue(true);
      mockBot.editMessageText.mockRejectedValueOnce(new Error('Telegram API error'));

      const callbackQuery = {
        id: 'callback-123',
        data: 'google_login_cancel',
        message: { chat: { id: 123 }, message_id: 456 },
        from: { id: 789 },
      };

      // No debe lanzar error, debe mostrar alerta de error
      await callbackQueryHandler(callbackQuery);

      expect(googleReauthService.cancelSession).toHaveBeenCalledWith(123);
      expect(mockBot.answerCallbackQuery).toHaveBeenCalledWith('callback-123', {
        text: 'Error cancelando',
        show_alert: true,
      });
    });
  });
});
