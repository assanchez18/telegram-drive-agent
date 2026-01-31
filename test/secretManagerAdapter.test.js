import { describe, it, expect, vi, beforeEach } from 'vitest';
import { addSecretVersion, getProjectId } from '../src/adapters/secretManagerAdapter.js';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

vi.mock('@google-cloud/secret-manager');

describe('secretManagerAdapter', () => {
  let mockClient;

  beforeEach(() => {
    vi.clearAllMocks();

    mockClient = {
      addSecretVersion: vi.fn(),
      getProjectId: vi.fn(),
    };

    // Mock del constructor
    SecretManagerServiceClient.prototype.addSecretVersion = mockClient.addSecretVersion;
    SecretManagerServiceClient.prototype.getProjectId = mockClient.getProjectId;
  });

  describe('addSecretVersion', () => {
    it('lanza error si falta projectId', async () => {
      await expect(
        addSecretVersion({ projectId: '', secretId: 'test-secret', payload: 'test-payload' })
      ).rejects.toThrow('Project ID is required');
    });

    it('lanza error si falta secretId', async () => {
      await expect(
        addSecretVersion({ projectId: 'test-project', secretId: '', payload: 'test-payload' })
      ).rejects.toThrow('Secret ID is required');
    });

    it('lanza error si falta payload', async () => {
      await expect(
        addSecretVersion({ projectId: 'test-project', secretId: 'test-secret', payload: '' })
      ).rejects.toThrow('Payload is required');
    });

    it('añade una nueva versión del secreto correctamente', async () => {
      mockClient.addSecretVersion.mockResolvedValue([
        {
          name: 'projects/test-project/secrets/test-secret/versions/2',
          state: 'ENABLED',
        },
      ]);

      const result = await addSecretVersion({
        projectId: 'test-project',
        secretId: 'test-secret',
        payload: '{"test":"data"}',
      });

      expect(mockClient.addSecretVersion).toHaveBeenCalledWith({
        parent: 'projects/test-project/secrets/test-secret',
        payload: {
          data: Buffer.from('{"test":"data"}', 'utf8'),
        },
      });

      expect(result).toEqual({
        name: 'projects/test-project/secrets/test-secret/versions/2',
        state: 'ENABLED',
      });
    });
  });

  describe('getProjectId', () => {
    it('obtiene el project ID correctamente', async () => {
      mockClient.getProjectId.mockResolvedValue('my-project-123');

      const projectId = await getProjectId();

      expect(projectId).toBe('my-project-123');
      expect(mockClient.getProjectId).toHaveBeenCalled();
    });
  });
});
