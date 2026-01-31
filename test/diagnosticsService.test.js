import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getVersionInfo, getStatusReport } from '../src/services/diagnosticsService.js';
import * as appInfo from '../src/runtime/appInfo.js';
import * as auth from '../src/auth.js';
import * as propertyService from '../src/services/propertyService.js';

vi.mock('../src/runtime/appInfo.js');
vi.mock('../src/auth.js');
vi.mock('../src/services/propertyService.js');

describe('getVersionInfo', () => {
  let originalEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    vi.mocked(appInfo.getRuntimeInfo).mockReturnValue({
      startedAt: '2024-01-01T00:00:00.000Z',
      nodeEnv: 'development',
      cloudRun: {
        service: 'local',
        revision: 'N/A',
      },
      gitSha: 'abc123',
    });
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.clearAllMocks();
  });

  it('devuelve información de versión completa con todos los campos', () => {
    const versionInfo = getVersionInfo();

    expect(versionInfo).toMatchObject({
      name: 'telegram-drive-agent',
      version: expect.any(String),
      nodeEnv: 'development',
      cloudRun: {
        service: 'local',
        revision: 'N/A',
      },
      startedAt: '2024-01-01T00:00:00.000Z',
      gitSha: 'abc123',
    });
  });

  it('muestra "local" cuando no está en Cloud Run', () => {
    vi.mocked(appInfo.getRuntimeInfo).mockReturnValue({
      startedAt: '2024-01-01T00:00:00.000Z',
      nodeEnv: 'production',
      cloudRun: {
        service: 'local',
        revision: 'N/A',
      },
      gitSha: 'N/A',
    });

    const versionInfo = getVersionInfo();

    expect(versionInfo.cloudRun.service).toBe('local');
    expect(versionInfo.cloudRun.revision).toBe('N/A');
  });

  it('devuelve N/A cuando no hay GIT_SHA', () => {
    vi.mocked(appInfo.getRuntimeInfo).mockReturnValue({
      startedAt: '2024-01-01T00:00:00.000Z',
      nodeEnv: 'development',
      cloudRun: {
        service: 'local',
        revision: 'N/A',
      },
      gitSha: 'N/A',
    });

    const versionInfo = getVersionInfo();

    expect(versionInfo.gitSha).toBe('N/A');
  });

  it('incluye información de Cloud Run cuando está disponible', () => {
    vi.mocked(appInfo.getRuntimeInfo).mockReturnValue({
      startedAt: '2024-01-01T00:00:00.000Z',
      nodeEnv: 'production',
      cloudRun: {
        service: 'telegram-drive-agent',
        revision: 'telegram-drive-agent-00001-abc',
      },
      gitSha: 'def456',
    });

    const versionInfo = getVersionInfo();

    expect(versionInfo.cloudRun.service).toBe('telegram-drive-agent');
    expect(versionInfo.cloudRun.revision).toBe('telegram-drive-agent-00001-abc');
  });
});

describe('getStatusReport', () => {
  let mockDrive;
  let originalEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    process.env.BOT_TOKEN = 'test-bot-token';
    process.env.TELEGRAM_WEBHOOK_SECRET = 'test-secret';
    process.env.ALLOWED_TELEGRAM_USER_IDS = '123,456';
    process.env.DRIVE_FOLDER_ID = 'test-folder-id';
    process.env.GOOGLE_OAUTH_CLIENT_JSON = '{"web":{"client_id":"test","client_secret":"test"}}';
    process.env.GOOGLE_OAUTH_TOKEN_JSON = '{"access_token":"test","refresh_token":"test"}';

    mockDrive = {
      files: {
        get: vi.fn(),
        list: vi.fn(),
      },
    };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.clearAllMocks();
  });

  it('lanza error si falta drive', async () => {
    await expect(getStatusReport({ drive: null, baseFolderId: 'test-id' })).rejects.toThrow(
      'Drive client is required'
    );
  });

  it('lanza error si falta baseFolderId', async () => {
    await expect(getStatusReport({ drive: mockDrive, baseFolderId: '' })).rejects.toThrow(
      'Base folder ID is required'
    );
  });

  it('devuelve todos los checks exitosos cuando todo funciona', async () => {
    const mockAuthClient = {
      getAccessToken: vi.fn().mockResolvedValue({ token: 'test-token' }),
    };
    vi.mocked(auth.getDriveAuth).mockReturnValue(mockAuthClient);

    mockDrive.files.list.mockResolvedValue({
      data: { files: [{ id: 'file-1' }] },
    });

    vi.mocked(propertyService.listProperties).mockResolvedValue({
      properties: [
        { address: 'Test 1', normalizedAddress: 'test_1' },
        { address: 'Test 2', normalizedAddress: 'test_2' },
      ],
      message: null,
    });

    const checks = await getStatusReport({ drive: mockDrive, baseFolderId: 'test-folder-id' });

    expect(checks.config.status).toBe('success');
    expect(checks.config.message).toContain('Todas las variables requeridas');

    expect(checks.oauth.status).toBe('success');
    expect(checks.oauth.message).toContain('Auth client válido');

    expect(checks.driveAccess.status).toBe('success');
    expect(checks.driveAccess.message).toContain('Carpeta raíz accesible');

    expect(checks.catalog.status).toBe('success');
    expect(checks.catalog.message).toContain('2 propiedades activas');
  });

  it('detecta variables de entorno faltantes', async () => {
    delete process.env.BOT_TOKEN;
    delete process.env.TELEGRAM_WEBHOOK_SECRET;

    const mockAuthClient = {
      getAccessToken: vi.fn().mockResolvedValue({ token: 'test-token' }),
    };
    vi.mocked(auth.getDriveAuth).mockReturnValue(mockAuthClient);

    mockDrive.files.list.mockResolvedValue({
      data: { files: [] },
    });

    vi.mocked(propertyService.listProperties).mockResolvedValue({
      properties: [],
      message: null,
    });

    const checks = await getStatusReport({ drive: mockDrive, baseFolderId: 'test-folder-id' });

    expect(checks.config.status).toBe('failed');
    expect(checks.config.message).toContain('BOT_TOKEN');
    expect(checks.config.message).toContain('TELEGRAM_WEBHOOK_SECRET');
  });

  it('detecta error de OAuth invalid_grant', async () => {
    const mockAuthClient = {
      getAccessToken: vi.fn().mockRejectedValue(new Error('invalid_grant: Token has been expired or revoked')),
    };
    vi.mocked(auth.getDriveAuth).mockReturnValue(mockAuthClient);

    mockDrive.files.list.mockResolvedValue({
      data: { files: [] },
    });

    vi.mocked(propertyService.listProperties).mockResolvedValue({
      properties: [],
      message: null,
    });

    const checks = await getStatusReport({ drive: mockDrive, baseFolderId: 'test-folder-id' });

    expect(checks.oauth.status).toBe('failed');
    expect(checks.oauth.message).toContain('invalid_grant');
  });

  it('detecta timeout en OAuth', async () => {
    const mockAuthClient = {
      getAccessToken: vi.fn().mockImplementation(() => new Promise((resolve) => {
        setTimeout(() => resolve({ token: 'test' }), 6000);
      })),
    };
    vi.mocked(auth.getDriveAuth).mockReturnValue(mockAuthClient);

    mockDrive.files.get.mockResolvedValue({
      data: { id: 'test-folder-id', name: 'Test Folder' },
    });

    vi.mocked(propertyService.listProperties).mockResolvedValue({
      properties: [],
      message: null,
    });

    const checks = await getStatusReport({ drive: mockDrive, baseFolderId: 'test-folder-id' });

    expect(checks.oauth.status).toBe('failed');
    expect(checks.oauth.message).toContain('Timeout');
  }, 10000);

  it('detecta carpeta de Drive no encontrada (404)', async () => {
    const mockAuthClient = {
      getAccessToken: vi.fn().mockResolvedValue({ token: 'test-token' }),
    };
    vi.mocked(auth.getDriveAuth).mockReturnValue(mockAuthClient);

    const error = new Error('Not found');
    error.code = 404;
    mockDrive.files.list.mockRejectedValue(error);

    vi.mocked(propertyService.listProperties).mockResolvedValue({
      properties: [],
      message: null,
    });

    const checks = await getStatusReport({ drive: mockDrive, baseFolderId: 'test-folder-id' });

    expect(checks.driveAccess.status).toBe('failed');
    expect(checks.driveAccess.message).toContain('404');
  });

  it('detecta falta de permisos en Drive (403)', async () => {
    const mockAuthClient = {
      getAccessToken: vi.fn().mockResolvedValue({ token: 'test-token' }),
    };
    vi.mocked(auth.getDriveAuth).mockReturnValue(mockAuthClient);

    const error = new Error('Permission denied');
    error.code = 403;
    mockDrive.files.list.mockRejectedValue(error);

    vi.mocked(propertyService.listProperties).mockResolvedValue({
      properties: [],
      message: null,
    });

    const checks = await getStatusReport({ drive: mockDrive, baseFolderId: 'test-folder-id' });

    expect(checks.driveAccess.status).toBe('failed');
    expect(checks.driveAccess.message).toContain('403');
  });

  it('detecta timeout en Drive', async () => {
    const mockAuthClient = {
      getAccessToken: vi.fn().mockResolvedValue({ token: 'test-token' }),
    };
    vi.mocked(auth.getDriveAuth).mockReturnValue(mockAuthClient);

    mockDrive.files.list.mockImplementation(() => new Promise((resolve) => {
      setTimeout(() => resolve({ data: { files: [] } }), 6000);
    }));

    vi.mocked(propertyService.listProperties).mockResolvedValue({
      properties: [],
      message: null,
    });

    const checks = await getStatusReport({ drive: mockDrive, baseFolderId: 'test-folder-id' });

    expect(checks.driveAccess.status).toBe('failed');
    expect(checks.driveAccess.message).toContain('Timeout');
  }, 10000);

  it('detecta error en catálogo', async () => {
    const mockAuthClient = {
      getAccessToken: vi.fn().mockResolvedValue({ token: 'test-token' }),
    };
    vi.mocked(auth.getDriveAuth).mockReturnValue(mockAuthClient);

    mockDrive.files.list.mockResolvedValue({
      data: { files: [] },
    });

    vi.mocked(propertyService.listProperties).mockRejectedValue(
      new Error('Catalog file corrupted')
    );

    const checks = await getStatusReport({ drive: mockDrive, baseFolderId: 'test-folder-id' });

    expect(checks.catalog.status).toBe('failed');
    expect(checks.catalog.message).toContain('Catalog file corrupted');
  });

  it('detecta timeout en catálogo', async () => {
    const mockAuthClient = {
      getAccessToken: vi.fn().mockResolvedValue({ token: 'test-token' }),
    };
    vi.mocked(auth.getDriveAuth).mockReturnValue(mockAuthClient);

    mockDrive.files.get.mockResolvedValue({
      data: { id: 'test-folder-id', name: 'Test Folder' },
    });

    vi.mocked(propertyService.listProperties).mockImplementation(() => new Promise((resolve) => {
      setTimeout(() => resolve({ properties: [], message: null }), 6000);
    }));

    const checks = await getStatusReport({ drive: mockDrive, baseFolderId: 'test-folder-id' });

    expect(checks.catalog.status).toBe('failed');
    expect(checks.catalog.message).toContain('Timeout');
  }, 10000);

  it('continúa con otros checks aunque uno falle', async () => {
    const mockAuthClient = {
      getAccessToken: vi.fn().mockRejectedValue(new Error('Auth error')),
    };
    vi.mocked(auth.getDriveAuth).mockReturnValue(mockAuthClient);

    mockDrive.files.list.mockResolvedValue({
      data: { files: [{ id: 'file-1' }] },
    });

    vi.mocked(propertyService.listProperties).mockResolvedValue({
      properties: [{ address: 'Test', normalizedAddress: 'test' }],
      message: null,
    });

    const checks = await getStatusReport({ drive: mockDrive, baseFolderId: 'test-folder-id' });

    expect(checks.config.status).toBe('success');
    expect(checks.oauth.status).toBe('failed');
    expect(checks.driveAccess.status).toBe('success');
    expect(checks.catalog.status).toBe('success');
  });

  it('muestra "0 propiedades activas" cuando el catálogo está vacío', async () => {
    const mockAuthClient = {
      getAccessToken: vi.fn().mockResolvedValue({ token: 'test-token' }),
    };
    vi.mocked(auth.getDriveAuth).mockReturnValue(mockAuthClient);

    mockDrive.files.list.mockResolvedValue({
      data: { files: [] },
    });

    vi.mocked(propertyService.listProperties).mockResolvedValue({
      properties: [],
      message: null,
    });

    const checks = await getStatusReport({ drive: mockDrive, baseFolderId: 'test-folder-id' });

    expect(checks.catalog.status).toBe('success');
    expect(checks.catalog.message).toContain('0 propiedades activas');
  });

  it('detecta error genérico en Drive cuando no es 403/404/timeout', async () => {
    const mockAuthClient = {
      getAccessToken: vi.fn().mockResolvedValue({ token: 'test-token' }),
    };
    vi.mocked(auth.getDriveAuth).mockReturnValue(mockAuthClient);

    const error = new Error('Network error');
    error.code = 500;
    mockDrive.files.list.mockRejectedValue(error);

    vi.mocked(propertyService.listProperties).mockResolvedValue({
      properties: [],
      message: null,
    });

    const checks = await getStatusReport({ drive: mockDrive, baseFolderId: 'test-folder-id' });

    expect(checks.driveAccess.status).toBe('failed');
    expect(checks.driveAccess.message).toContain('Network error');
  });

  it('detecta error de OAuth sin mensaje', async () => {
    const mockAuthClient = {
      getAccessToken: vi.fn().mockRejectedValue(new Error()),
    };
    vi.mocked(auth.getDriveAuth).mockReturnValue(mockAuthClient);

    mockDrive.files.list.mockResolvedValue({
      data: { files: [] },
    });

    vi.mocked(propertyService.listProperties).mockResolvedValue({
      properties: [],
      message: null,
    });

    const checks = await getStatusReport({ drive: mockDrive, baseFolderId: 'test-folder-id' });

    expect(checks.oauth.status).toBe('failed');
    expect(checks.oauth.message).toContain('Desconocido');
  });

  it('detecta error de Drive sin mensaje', async () => {
    const mockAuthClient = {
      getAccessToken: vi.fn().mockResolvedValue({ token: 'test-token' }),
    };
    vi.mocked(auth.getDriveAuth).mockReturnValue(mockAuthClient);

    const error = new Error();
    mockDrive.files.list.mockRejectedValue(error);

    vi.mocked(propertyService.listProperties).mockResolvedValue({
      properties: [],
      message: null,
    });

    const checks = await getStatusReport({ drive: mockDrive, baseFolderId: 'test-folder-id' });

    expect(checks.driveAccess.status).toBe('failed');
    expect(checks.driveAccess.message).toContain('Desconocido');
  });

  it('detecta error de catálogo sin mensaje', async () => {
    const mockAuthClient = {
      getAccessToken: vi.fn().mockResolvedValue({ token: 'test-token' }),
    };
    vi.mocked(auth.getDriveAuth).mockReturnValue(mockAuthClient);

    mockDrive.files.list.mockResolvedValue({
      data: { files: [] },
    });

    vi.mocked(propertyService.listProperties).mockRejectedValue(new Error());

    const checks = await getStatusReport({ drive: mockDrive, baseFolderId: 'test-folder-id' });

    expect(checks.catalog.status).toBe('failed');
    expect(checks.catalog.message).toContain('Desconocido');
  });
});
