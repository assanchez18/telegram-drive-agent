import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

/**
 * Adaptador para Google Cloud Secret Manager
 * Permite añadir nuevas versiones de secretos
 */

export async function addSecretVersion({ projectId, secretId, payload }) {
  if (!projectId) {
    throw new Error('Project ID is required');
  }
  if (!secretId) {
    throw new Error('Secret ID is required');
  }
  if (!payload) {
    throw new Error('Payload is required');
  }

  const client = new SecretManagerServiceClient();
  const parent = `projects/${projectId}/secrets/${secretId}`;

  const [version] = await client.addSecretVersion({
    parent,
    payload: {
      data: Buffer.from(payload, 'utf8'),
    },
  });

  return {
    name: version.name,
    state: version.state,
  };
}

/**
 * Obtiene el ID del proyecto desde las credenciales de Google Cloud
 * Si no está en las credenciales, intenta obtenerlo de metadata
 */
export async function getProjectId() {
  const client = new SecretManagerServiceClient();
  return await client.getProjectId();
}
