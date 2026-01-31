import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createAuthUrl,
  handleCallback,
  cancelSession,
  hasActiveSession,
} from '../src/services/googleReauthService.js';
import * as tokenStorageAdapter from '../src/adapters/tokenStorageAdapter.js';
import { google } from 'googleapis';

vi.mock('../src/adapters/tokenStorageAdapter.js');
vi.mock('googleapis');

describe('googleReauthService', () => {
  const mockOAuthClientJson = JSON.stringify({
    web: {
      client_id: 'test-client-id',
      client_secret: 'test-client-secret',
    },
  });

  const mockStateSecret = 'test-secret-minimum-32-characters-long-string';
  const mockBaseUrl = 'https://example.com';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));
    // Suprimir console.log y console.error en los tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    // Limpiar sesiones activas
    cancelSession(123);
    cancelSession(456);
    // Restaurar console
    console.log.mockRestore?.();
    console.error.mockRestore?.();
    console.warn.mockRestore?.();
  });

  describe('createAuthUrl', () => {
    it('lanza error si falta chatId', () => {
      expect(() =>
        createAuthUrl({
          chatId: null,
          userId: 456,
          oauthClientJson: mockOAuthClientJson,
          stateSecret: mockStateSecret,
          baseUrl: mockBaseUrl,
        })
      ).toThrow('Chat ID is required');
    });

    it('lanza error si falta userId', () => {
      expect(() =>
        createAuthUrl({
          chatId: 123,
          userId: null,
          oauthClientJson: mockOAuthClientJson,
          stateSecret: mockStateSecret,
          baseUrl: mockBaseUrl,
        })
      ).toThrow('User ID is required');
    });

    it('lanza error si falta oauthClientJson', () => {
      expect(() =>
        createAuthUrl({
          chatId: 123,
          userId: 456,
          oauthClientJson: null,
          stateSecret: mockStateSecret,
          baseUrl: mockBaseUrl,
        })
      ).toThrow('OAuth client JSON is required');
    });

    it('lanza error si falta stateSecret', () => {
      expect(() =>
        createAuthUrl({
          chatId: 123,
          userId: 456,
          oauthClientJson: mockOAuthClientJson,
          stateSecret: null,
          baseUrl: mockBaseUrl,
        })
      ).toThrow('State secret is required');
    });

    it('lanza error si el OAuth JSON no tiene web ni installed', () => {
      const invalidJson = JSON.stringify({ foo: 'bar' });
      expect(() =>
        createAuthUrl({
          chatId: 123,
          userId: 456,
          oauthClientJson: invalidJson,
          stateSecret: mockStateSecret,
          baseUrl: mockBaseUrl,
        })
      ).toThrow('OAuth client JSON must have "web" or "installed" key');
    });

    it('lanza error si el OAuth JSON no tiene client_id', () => {
      const invalidJson = JSON.stringify({
        web: {
          client_secret: 'test-secret',
        },
      });
      expect(() =>
        createAuthUrl({
          chatId: 123,
          userId: 456,
          oauthClientJson: invalidJson,
          stateSecret: mockStateSecret,
          baseUrl: mockBaseUrl,
        })
      ).toThrow('OAuth client JSON must contain client_id and client_secret');
    });

    it('lanza error si el OAuth JSON no tiene client_secret', () => {
      const invalidJson = JSON.stringify({
        web: {
          client_id: 'test-client-id',
        },
      });
      expect(() =>
        createAuthUrl({
          chatId: 123,
          userId: 456,
          oauthClientJson: invalidJson,
          stateSecret: mockStateSecret,
          baseUrl: mockBaseUrl,
        })
      ).toThrow('OAuth client JSON must contain client_id and client_secret');
    });

    it('genera URL de autorización correctamente', () => {
      // Mock del constructor de OAuth2
      const mockOAuth2Constructor = vi.fn(function() {});
      google.auth.OAuth2 = mockOAuth2Constructor;

      const result = createAuthUrl({
        chatId: 123,
        userId: 456,
        oauthClientJson: mockOAuthClientJson,
        stateSecret: mockStateSecret,
        baseUrl: mockBaseUrl,
      });

      // Verificar estructura del resultado
      expect(result).toHaveProperty('url');
      expect(result).toHaveProperty('expiresAt');
      expect(result.expiresAt).toBe(Date.now() + 10 * 60 * 1000);

      // Verificar que OAuth2 se construyó correctamente
      expect(google.auth.OAuth2).toHaveBeenCalledWith(
        'test-client-id',
        'test-client-secret',
        'https://example.com/oauth/google/callback'
      );

      // Verificar que la URL contiene todos los parámetros requeridos
      expect(result.url).toContain('https://accounts.google.com/o/oauth2/v2/auth');
      expect(result.url).toContain('client_id=test-client-id');
      expect(result.url).toContain('redirect_uri=https%3A%2F%2Fexample.com%2Foauth%2Fgoogle%2Fcallback');
      expect(result.url).toContain('response_type=code');
      expect(result.url).toContain('scope=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fdrive');
      expect(result.url).toContain('access_type=offline');
      expect(result.url).toContain('prompt=consent');
      expect(result.url).toContain('state=');
    });

    it('lanza error si ya hay una sesión activa', () => {
      const mockOAuth2Constructor = vi.fn(function() {});
      google.auth.OAuth2 = mockOAuth2Constructor;

      // Crear primera sesión
      createAuthUrl({
        chatId: 123,
        userId: 456,
        oauthClientJson: mockOAuthClientJson,
        stateSecret: mockStateSecret,
        baseUrl: mockBaseUrl,
      });

      // Intentar crear segunda sesión
      expect(() =>
        createAuthUrl({
          chatId: 123,
          userId: 456,
          oauthClientJson: mockOAuthClientJson,
          stateSecret: mockStateSecret,
          baseUrl: mockBaseUrl,
        })
      ).toThrow('Ya hay una sesión de login activa');
    });

    it('permite crear nueva sesión si la anterior expiró', () => {
      const mockOAuth2Constructor = vi.fn(function() {});
      google.auth.OAuth2 = mockOAuth2Constructor;

      // Crear primera sesión
      createAuthUrl({
        chatId: 123,
        userId: 456,
        oauthClientJson: mockOAuthClientJson,
        stateSecret: mockStateSecret,
        baseUrl: mockBaseUrl,
      });

      // Avanzar tiempo más de 10 minutos
      vi.advanceTimersByTime(11 * 60 * 1000);

      // Debe permitir crear nueva sesión
      const result = createAuthUrl({
        chatId: 123,
        userId: 456,
        oauthClientJson: mockOAuthClientJson,
        stateSecret: mockStateSecret,
        baseUrl: mockBaseUrl,
      });

      // Verificar que se generó una nueva URL
      expect(result.url).toContain('https://accounts.google.com/o/oauth2/v2/auth');
      expect(result.url).toContain('response_type=code');
    });
  });

  describe('handleCallback', () => {
    const mockCode = 'test-auth-code';
    let mockState;

    beforeEach(() => {
      // Mock del constructor de OAuth2
      const mockOAuth2Constructor = vi.fn(function() {});
      google.auth.OAuth2 = mockOAuth2Constructor;

      // Generar state válido usando createAuthUrl
      const { url } = createAuthUrl({
        chatId: 123,
        userId: 456,
        oauthClientJson: mockOAuthClientJson,
        stateSecret: mockStateSecret,
        baseUrl: mockBaseUrl,
      });

      // Extraer state de la URL generada
      const urlParams = new URLSearchParams(url.split('?')[1]);
      mockState = urlParams.get('state');
    });

    it('lanza error si falta code', async () => {
      await expect(
        handleCallback({
          code: null,
          state: mockState,
          oauthClientJson: mockOAuthClientJson,
          stateSecret: mockStateSecret,
          baseUrl: mockBaseUrl,
          secretName: 'test-secret',
        })
      ).rejects.toThrow('Authorization code is required');
    });

    it('lanza error si falta state', async () => {
      await expect(
        handleCallback({
          code: mockCode,
          state: null,
          oauthClientJson: mockOAuthClientJson,
          stateSecret: mockStateSecret,
          baseUrl: mockBaseUrl,
          secretName: 'test-secret',
        })
      ).rejects.toThrow('State is required');
    });

    it('lanza error si el OAuth JSON no tiene web ni installed', async () => {
      const invalidJson = JSON.stringify({ foo: 'bar' });
      await expect(
        handleCallback({
          code: mockCode,
          state: mockState,
          oauthClientJson: invalidJson,
          stateSecret: mockStateSecret,
          baseUrl: mockBaseUrl,
          secretName: 'test-secret',
        })
      ).rejects.toThrow('OAuth client JSON must have "web" or "installed" key');
    });

    it('lanza error si el OAuth JSON no tiene client_id', async () => {
      const invalidJson = JSON.stringify({
        web: {
          client_secret: 'test-secret',
        },
      });
      await expect(
        handleCallback({
          code: mockCode,
          state: mockState,
          oauthClientJson: invalidJson,
          stateSecret: mockStateSecret,
          baseUrl: mockBaseUrl,
          secretName: 'test-secret',
        })
      ).rejects.toThrow('OAuth client JSON must contain client_id and client_secret');
    });

    it('lanza error si el state es inválido', async () => {
      await expect(
        handleCallback({
          code: mockCode,
          state: 'invalid-state',
          oauthClientJson: mockOAuthClientJson,
          stateSecret: mockStateSecret,
          baseUrl: mockBaseUrl,
          secretName: 'test-secret',
        })
      ).rejects.toThrow('Invalid state');
    });

    it('lanza error si el state expiró', async () => {
      // Avanzar tiempo más de 10 minutos
      vi.advanceTimersByTime(11 * 60 * 1000);

      await expect(
        handleCallback({
          code: mockCode,
          state: mockState,
          oauthClientJson: mockOAuthClientJson,
          stateSecret: mockStateSecret,
          baseUrl: mockBaseUrl,
          secretName: 'test-secret',
        })
      ).rejects.toThrow('State has expired');
    });

    it('maneja callback exitosamente con refresh_token', async () => {
      const mockGetToken = vi.fn().mockResolvedValue({
        tokens: {
          access_token: 'test-access-token',
          refresh_token: 'test-refresh-token',
          expiry_date: Date.now() + 3600000,
          token_type: 'Bearer',
          scope: 'https://www.googleapis.com/auth/drive',
        },
      });

      google.auth.OAuth2 = vi.fn(function() {
        this.getToken = mockGetToken;
      });

      vi.mocked(tokenStorageAdapter.saveGoogleToken).mockResolvedValue(undefined);

      const result = await handleCallback({
        code: mockCode,
        state: mockState,
        oauthClientJson: mockOAuthClientJson,
        stateSecret: mockStateSecret,
        baseUrl: mockBaseUrl,
        secretName: 'test-secret',
      });

      expect(result.success).toBe(true);
      expect(result.chatId).toBe(123);
      expect(result.hasRefreshToken).toBe(true);
      expect(result.message).toContain('✅ Token actualizado correctamente');

      expect(mockGetToken).toHaveBeenCalledWith(mockCode);
      expect(tokenStorageAdapter.saveGoogleToken).toHaveBeenCalledWith(
        'test-secret',
        expect.stringContaining('test-refresh-token')
      );
    });

    it('maneja callback sin refresh_token con warning', async () => {
      const mockGetToken = vi.fn().mockResolvedValue({
        tokens: {
          access_token: 'test-access-token',
          // Sin refresh_token
          expiry_date: Date.now() + 3600000,
          token_type: 'Bearer',
          scope: 'https://www.googleapis.com/auth/drive',
        },
      });

      google.auth.OAuth2 = vi.fn(function() {
        this.getToken = mockGetToken;
      });

      vi.mocked(tokenStorageAdapter.saveGoogleToken).mockResolvedValue(undefined);

      const result = await handleCallback({
        code: mockCode,
        state: mockState,
        oauthClientJson: mockOAuthClientJson,
        stateSecret: mockStateSecret,
        baseUrl: mockBaseUrl,
        secretName: 'test-secret',
      });

      expect(result.success).toBe(true);
      expect(result.hasRefreshToken).toBe(false);
      expect(result.message).toContain('⚠️');
      expect(result.message).toContain('sin refresh_token');
    });

    it('lanza error si no hay sesión activa', async () => {
      // Cancelar sesión
      cancelSession(123);

      await expect(
        handleCallback({
          code: mockCode,
          state: mockState,
          oauthClientJson: mockOAuthClientJson,
          stateSecret: mockStateSecret,
          baseUrl: mockBaseUrl,
          secretName: 'test-secret',
        })
      ).rejects.toThrow('No active session found');
    });

    it('lanza error si falla el intercambio de código', async () => {
      const mockGetToken = vi.fn().mockRejectedValue(new Error('Invalid authorization code'));

      google.auth.OAuth2 = vi.fn(function() {
        this.getToken = mockGetToken;
      });

      await expect(
        handleCallback({
          code: mockCode,
          state: mockState,
          oauthClientJson: mockOAuthClientJson,
          stateSecret: mockStateSecret,
          baseUrl: mockBaseUrl,
          secretName: 'test-secret',
        })
      ).rejects.toThrow('Error exchanging code: Invalid authorization code');

      // Verificar que se limpió la sesión
      expect(hasActiveSession(123)).toBe(false);
    });
  });

  describe('cancelSession', () => {
    it('cancela una sesión activa', () => {
      const mockOAuth2Constructor = vi.fn(function() {});
      google.auth.OAuth2 = mockOAuth2Constructor;

      // Crear sesión
      createAuthUrl({
        chatId: 123,
        userId: 456,
        oauthClientJson: mockOAuthClientJson,
        stateSecret: mockStateSecret,
        baseUrl: mockBaseUrl,
      });

      expect(hasActiveSession(123)).toBe(true);

      const result = cancelSession(123);

      expect(result).toBe(true);
      expect(hasActiveSession(123)).toBe(false);
    });

    it('retorna false si no hay sesión para cancelar', () => {
      const result = cancelSession(999);
      expect(result).toBe(false);
    });
  });

  describe('hasActiveSession', () => {
    it('retorna true si hay sesión activa', () => {
      const mockOAuth2Constructor = vi.fn(function() {});
      google.auth.OAuth2 = mockOAuth2Constructor;

      createAuthUrl({
        chatId: 123,
        userId: 456,
        oauthClientJson: mockOAuthClientJson,
        stateSecret: mockStateSecret,
        baseUrl: mockBaseUrl,
      });

      expect(hasActiveSession(123)).toBe(true);
    });

    it('retorna false si no hay sesión', () => {
      expect(hasActiveSession(999)).toBe(false);
    });

    it('retorna false si la sesión expiró', () => {
      const mockOAuth2Constructor = vi.fn(function() {});
      google.auth.OAuth2 = mockOAuth2Constructor;

      createAuthUrl({
        chatId: 123,
        userId: 456,
        oauthClientJson: mockOAuthClientJson,
        stateSecret: mockStateSecret,
        baseUrl: mockBaseUrl,
      });

      // Avanzar tiempo más de 10 minutos
      vi.advanceTimersByTime(11 * 60 * 1000);

      expect(hasActiveSession(123)).toBe(false);
    });
  });
});
