import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getDriveAuth,
  refreshDriveAuthCredentials,
  _resetDriveAuthForTesting,
} from '../src/auth.js';
import * as tokenStorageAdapter from '../src/adapters/tokenStorageAdapter.js';
import { google } from 'googleapis';

vi.mock('../src/adapters/tokenStorageAdapter.js');
vi.mock('googleapis');

describe('auth', () => {
  const mockClientJson = JSON.stringify({
    web: {
      client_id: 'test-client-id',
      client_secret: 'test-client-secret',
      redirect_uris: ['http://localhost:3000/oauth2callback'],
    },
  });

  const mockTokenJson = JSON.stringify({
    access_token: 'test-access-token',
    refresh_token: 'test-refresh-token',
    expiry_date: Date.now() + 3600000,
    token_type: 'Bearer',
  });

  let mockOAuth2Client;
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    _resetDriveAuthForTesting();

    process.env = { ...originalEnv };
    process.env.GOOGLE_OAUTH_CLIENT_JSON = mockClientJson;
    process.env.GOOGLE_OAUTH_TOKEN_JSON = mockTokenJson;
    delete process.env.USE_SECRET_MANAGER;
    delete process.env.NODE_ENV;

    mockOAuth2Client = {
      setCredentials: vi.fn(),
    };

    google.auth.OAuth2 = vi.fn(function () {
      this.setCredentials = mockOAuth2Client.setCredentials;
    });

    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = originalEnv;
    _resetDriveAuthForTesting();
    console.log.mockRestore?.();
    console.warn.mockRestore?.();
  });

  describe('getDriveAuth', () => {
    it('lanza error si GOOGLE_OAUTH_CLIENT_JSON no está configurado', async () => {
      delete process.env.GOOGLE_OAUTH_CLIENT_JSON;

      await expect(getDriveAuth()).rejects.toThrow('Falta GOOGLE_OAUTH_CLIENT_JSON');
    });

    it('lanza error si GOOGLE_OAUTH_CLIENT_JSON no es JSON válido', async () => {
      process.env.GOOGLE_OAUTH_CLIENT_JSON = 'no-es-json';

      await expect(getDriveAuth()).rejects.toThrow('GOOGLE_OAUTH_CLIENT_JSON no es JSON válido');
    });

    it('lanza error si falta client_id o client_secret', async () => {
      process.env.GOOGLE_OAUTH_CLIENT_JSON = JSON.stringify({ web: {} });

      await expect(getDriveAuth()).rejects.toThrow(
        'GOOGLE_OAUTH_CLIENT_JSON debe contener client_id y client_secret'
      );
    });

    describe('en desarrollo (sin USE_SECRET_MANAGER)', () => {
      it('lee el token desde GOOGLE_OAUTH_TOKEN_JSON env var', async () => {
        const auth = await getDriveAuth();

        expect(auth).toBeDefined();
        expect(tokenStorageAdapter.getGoogleToken).not.toHaveBeenCalled();
        expect(mockOAuth2Client.setCredentials).toHaveBeenCalledWith(
          expect.objectContaining({
            access_token: 'test-access-token',
            refresh_token: 'test-refresh-token',
          })
        );
      });

      it('lanza error si GOOGLE_OAUTH_TOKEN_JSON no está configurado', async () => {
        delete process.env.GOOGLE_OAUTH_TOKEN_JSON;

        await expect(getDriveAuth()).rejects.toThrow('Falta GOOGLE_OAUTH_TOKEN_JSON');
      });

      it('lanza error si GOOGLE_OAUTH_TOKEN_JSON no es JSON válido', async () => {
        process.env.GOOGLE_OAUTH_TOKEN_JSON = 'no-es-json';

        await expect(getDriveAuth()).rejects.toThrow('GOOGLE_OAUTH_TOKEN_JSON no es JSON válido');
      });

      it('devuelve el mismo singleton en llamadas sucesivas', async () => {
        const auth1 = await getDriveAuth();
        const auth2 = await getDriveAuth();

        expect(auth1).toBe(auth2);
        // setCredentials solo se llama una vez (al crear el singleton)
        expect(mockOAuth2Client.setCredentials).toHaveBeenCalledTimes(1);
      });

      it('usa redirect_uri del JSON si existe', async () => {
        const auth = await getDriveAuth();

        expect(google.auth.OAuth2).toHaveBeenCalledWith(
          'test-client-id',
          'test-client-secret',
          'http://localhost:3000/oauth2callback'
        );
        expect(auth).toBeDefined();
      });

      it('usa redirect_uri por defecto si no hay en JSON', async () => {
        process.env.GOOGLE_OAUTH_CLIENT_JSON = JSON.stringify({
          web: {
            client_id: 'test-client-id',
            client_secret: 'test-client-secret',
          },
        });

        await getDriveAuth();

        expect(google.auth.OAuth2).toHaveBeenCalledWith(
          'test-client-id',
          'test-client-secret',
          'http://localhost:3000/oauth2callback'
        );
      });

      it('usa primera redirect_uri si no hay localhost', async () => {
        process.env.GOOGLE_OAUTH_CLIENT_JSON = JSON.stringify({
          web: {
            client_id: 'test-client-id',
            client_secret: 'test-client-secret',
            redirect_uris: ['https://myapp.run.app/oauth2callback'],
          },
        });

        await getDriveAuth();

        expect(google.auth.OAuth2).toHaveBeenCalledWith(
          'test-client-id',
          'test-client-secret',
          'https://myapp.run.app/oauth2callback'
        );
      });

      it('admite credenciales con clave installed (en lugar de web)', async () => {
        process.env.GOOGLE_OAUTH_CLIENT_JSON = JSON.stringify({
          installed: {
            client_id: 'installed-client-id',
            client_secret: 'installed-client-secret',
            redirect_uris: ['http://localhost:3000/oauth2callback'],
          },
        });

        const auth = await getDriveAuth();

        expect(google.auth.OAuth2).toHaveBeenCalledWith(
          'installed-client-id',
          'installed-client-secret',
          'http://localhost:3000/oauth2callback'
        );
        expect(auth).toBeDefined();
      });
    });

    describe('en producción (USE_SECRET_MANAGER=true)', () => {
      beforeEach(() => {
        process.env.USE_SECRET_MANAGER = 'true';
        vi.mocked(tokenStorageAdapter.shouldUseSecretManager).mockReturnValue(true);
        vi.mocked(tokenStorageAdapter.getGoogleToken).mockResolvedValue(mockTokenJson);
      });

      it('lee el token desde Secret Manager vía getGoogleToken()', async () => {
        const auth = await getDriveAuth('GOOGLE_OAUTH_TOKEN_JSON');

        expect(tokenStorageAdapter.getGoogleToken).toHaveBeenCalledWith('GOOGLE_OAUTH_TOKEN_JSON');
        expect(mockOAuth2Client.setCredentials).toHaveBeenCalledWith(
          expect.objectContaining({
            access_token: 'test-access-token',
            refresh_token: 'test-refresh-token',
          })
        );
        expect(auth).toBeDefined();
      });

      it('cae en env var si no se pasa secretName', async () => {
        // Sin secretName, aunque shouldUseSecretManager sea true, usa env var
        const auth = await getDriveAuth();

        expect(tokenStorageAdapter.getGoogleToken).not.toHaveBeenCalled();
        expect(auth).toBeDefined();
      });

      it('propaga error de getGoogleToken', async () => {
        vi.mocked(tokenStorageAdapter.getGoogleToken).mockRejectedValue(
          new Error('Secret Manager unavailable')
        );

        await expect(getDriveAuth('GOOGLE_OAUTH_TOKEN_JSON')).rejects.toThrow(
          'Secret Manager unavailable'
        );
      });
    });
  });

  describe('refreshDriveAuthCredentials', () => {
    it('lanza error si falta secretName', async () => {
      await expect(refreshDriveAuthCredentials(null)).rejects.toThrow('Secret name is required');
    });

    it('lanza error si el token JSON no es válido', async () => {
      vi.mocked(tokenStorageAdapter.getGoogleToken).mockResolvedValue('no-es-json');

      await expect(refreshDriveAuthCredentials('test-secret')).rejects.toThrow(
        'Token JSON from storage is not valid JSON'
      );
    });

    it('actualiza las credenciales del cliente existente', async () => {
      // Inicializar el singleton primero
      await getDriveAuth();

      const newTokenJson = JSON.stringify({
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        expiry_date: Date.now() + 7200000,
      });
      vi.mocked(tokenStorageAdapter.getGoogleToken).mockResolvedValue(newTokenJson);

      await refreshDriveAuthCredentials('test-secret');

      expect(mockOAuth2Client.setCredentials).toHaveBeenLastCalledWith(
        expect.objectContaining({
          access_token: 'new-access-token',
          refresh_token: 'new-refresh-token',
        })
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('[Auth] Credenciales de Drive actualizadas')
      );
    });

    it('emite warning si el token nuevo no tiene refresh_token', async () => {
      await getDriveAuth();

      const tokenSinRefresh = JSON.stringify({
        access_token: 'new-access-token',
        expiry_date: Date.now() + 7200000,
      });
      vi.mocked(tokenStorageAdapter.getGoogleToken).mockResolvedValue(tokenSinRefresh);

      await refreshDriveAuthCredentials('test-secret');

      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('sin refresh_token')
      );
    });

    it('inicializa el cliente si aún no existe (singleton nulo)', async () => {
      // No llamar getDriveAuth() antes
      vi.mocked(tokenStorageAdapter.getGoogleToken).mockResolvedValue(mockTokenJson);
      vi.mocked(tokenStorageAdapter.shouldUseSecretManager).mockReturnValue(false);

      // Con singleton nulo, debe inicializarlo vía getDriveAuth interno
      await refreshDriveAuthCredentials('test-secret');

      // El cliente debe estar inicializado ahora
      const auth = await getDriveAuth('test-secret');
      expect(auth).toBeDefined();
    });

    it('propaga error de getGoogleToken', async () => {
      await getDriveAuth();

      vi.mocked(tokenStorageAdapter.getGoogleToken).mockRejectedValue(
        new Error('Secret Manager error')
      );

      await expect(refreshDriveAuthCredentials('test-secret')).rejects.toThrow(
        'Secret Manager error'
      );
    });
  });
});
