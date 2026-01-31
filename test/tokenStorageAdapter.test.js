import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import {
  shouldUseSecretManager,
  saveGoogleToken,
} from '../src/adapters/tokenStorageAdapter.js';
import * as secretManagerAdapter from '../src/adapters/secretManagerAdapter.js';

vi.mock('../src/adapters/secretManagerAdapter.js');
vi.mock('fs/promises');

describe('tokenStorageAdapter', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset environment
    process.env = { ...originalEnv };
    delete process.env.USE_SECRET_MANAGER;
    delete process.env.NODE_ENV;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('shouldUseSecretManager', () => {
    it('retorna true cuando USE_SECRET_MANAGER=true (explícito)', () => {
      process.env.USE_SECRET_MANAGER = 'true';
      process.env.NODE_ENV = 'development';

      const result = shouldUseSecretManager();

      expect(result).toBe(true);
    });

    it('retorna false cuando USE_SECRET_MANAGER=false (explícito)', () => {
      process.env.USE_SECRET_MANAGER = 'false';
      process.env.NODE_ENV = 'production';

      const result = shouldUseSecretManager();

      expect(result).toBe(false);
    });

    it('retorna true en producción cuando USE_SECRET_MANAGER no está configurado', () => {
      process.env.NODE_ENV = 'production';

      const result = shouldUseSecretManager();

      expect(result).toBe(true);
    });

    it('retorna false en development cuando USE_SECRET_MANAGER no está configurado', () => {
      process.env.NODE_ENV = 'development';

      const result = shouldUseSecretManager();

      expect(result).toBe(false);
    });

    it('retorna false cuando NODE_ENV no está configurado', () => {
      const result = shouldUseSecretManager();

      expect(result).toBe(false);
    });

    it('retorna false en test environment', () => {
      process.env.NODE_ENV = 'test';

      const result = shouldUseSecretManager();

      expect(result).toBe(false);
    });
  });

  describe('saveGoogleToken', () => {
    const mockTokenJson = JSON.stringify({
      type: 'authorized_user',
      refresh_token: 'test-refresh-token',
      access_token: 'test-access-token',
      expiry_date: 1234567890,
    });
    const mockSecretName = 'GOOGLE_OAUTH_TOKEN_JSON';

    beforeEach(() => {
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);
      vi.mocked(secretManagerAdapter.getProjectId).mockResolvedValue('test-project');
      vi.mocked(secretManagerAdapter.addSecretVersion).mockResolvedValue({
        name: 'projects/test-project/secrets/test-secret/versions/1',
        state: 'ENABLED',
      });
      // Mock console.log para verificar que no loguea tokens
      vi.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
      console.log.mockRestore?.();
    });

    it('lanza error si falta secretName', async () => {
      await expect(saveGoogleToken(null, mockTokenJson)).rejects.toThrow(
        'Secret name is required'
      );
    });

    it('lanza error si falta tokenJson', async () => {
      await expect(saveGoogleToken(mockSecretName, null)).rejects.toThrow(
        'Token JSON is required'
      );
    });

    describe('cuando USE_SECRET_MANAGER=true (producción)', () => {
      beforeEach(() => {
        process.env.USE_SECRET_MANAGER = 'true';
      });

      it('guarda en Secret Manager', async () => {
        await saveGoogleToken(mockSecretName, mockTokenJson);

        expect(secretManagerAdapter.getProjectId).toHaveBeenCalled();
        expect(secretManagerAdapter.addSecretVersion).toHaveBeenCalledWith({
          projectId: 'test-project',
          secretId: mockSecretName,
          payload: mockTokenJson,
        });
        expect(fs.writeFile).not.toHaveBeenCalled();
      });

      it('NO loguea el token (seguridad)', async () => {
        await saveGoogleToken(mockSecretName, mockTokenJson);

        // Verificar que console.log fue llamado pero NO con el token
        expect(console.log).toHaveBeenCalled();
        const allLogs = console.log.mock.calls.map((call) => call.join(' '));
        const logsContainToken = allLogs.some((log) =>
          log.includes('test-refresh-token')
        );
        expect(logsContainToken).toBe(false);
      });
    });

    describe('cuando USE_SECRET_MANAGER=false (desarrollo local)', () => {
      beforeEach(() => {
        process.env.USE_SECRET_MANAGER = 'false';
      });

      it('guarda en archivo local', async () => {
        await saveGoogleToken(mockSecretName, mockTokenJson);

        const expectedDir = path.join(process.cwd(), 'secrets');
        const expectedPath = path.join(expectedDir, `${mockSecretName}.local.json`);

        expect(fs.mkdir).toHaveBeenCalledWith(expectedDir, { recursive: true });
        expect(fs.writeFile).toHaveBeenCalledWith(
          expectedPath,
          mockTokenJson,
          'utf8'
        );
        expect(secretManagerAdapter.addSecretVersion).not.toHaveBeenCalled();
      });

      it('NO loguea el token (seguridad)', async () => {
        await saveGoogleToken(mockSecretName, mockTokenJson);

        // Verificar que console.log fue llamado pero NO con el token
        expect(console.log).toHaveBeenCalled();
        const allLogs = console.log.mock.calls.map((call) => call.join(' '));
        const logsContainToken = allLogs.some((log) =>
          log.includes('test-refresh-token')
        );
        expect(logsContainToken).toBe(false);
      });

      it('loguea la ruta del archivo (sin contenido)', async () => {
        await saveGoogleToken(mockSecretName, mockTokenJson);

        const expectedPath = path.join(
          process.cwd(),
          'secrets',
          `${mockSecretName}.local.json`
        );
        expect(console.log).toHaveBeenCalledWith(
          expect.stringContaining(expectedPath)
        );
      });
    });

    describe('cuando NODE_ENV=production (implícito)', () => {
      beforeEach(() => {
        process.env.NODE_ENV = 'production';
        delete process.env.USE_SECRET_MANAGER;
      });

      it('usa Secret Manager por defecto', async () => {
        await saveGoogleToken(mockSecretName, mockTokenJson);

        expect(secretManagerAdapter.addSecretVersion).toHaveBeenCalled();
        expect(fs.writeFile).not.toHaveBeenCalled();
      });
    });

    describe('cuando NODE_ENV=development (implícito)', () => {
      beforeEach(() => {
        process.env.NODE_ENV = 'development';
        delete process.env.USE_SECRET_MANAGER;
      });

      it('usa archivo local por defecto', async () => {
        await saveGoogleToken(mockSecretName, mockTokenJson);

        expect(fs.writeFile).toHaveBeenCalled();
        expect(secretManagerAdapter.addSecretVersion).not.toHaveBeenCalled();
      });
    });

    describe('manejo de errores', () => {
      it('propaga error de Secret Manager', async () => {
        process.env.USE_SECRET_MANAGER = 'true';
        vi.mocked(secretManagerAdapter.addSecretVersion).mockRejectedValue(
          new Error('Secret Manager API error')
        );

        await expect(saveGoogleToken(mockSecretName, mockTokenJson)).rejects.toThrow(
          'Secret Manager API error'
        );
      });

      it('propaga error de escritura de archivo', async () => {
        process.env.USE_SECRET_MANAGER = 'false';
        vi.mocked(fs.writeFile).mockRejectedValue(
          new Error('Permission denied')
        );

        await expect(saveGoogleToken(mockSecretName, mockTokenJson)).rejects.toThrow(
          'Permission denied'
        );
      });
    });
  });
});
