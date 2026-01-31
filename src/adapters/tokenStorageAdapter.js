import fs from 'fs/promises';
import path from 'path';
import { addSecretVersion, getProjectId } from './secretManagerAdapter.js';

/**
 * Determina si debe usar Secret Manager basado en configuración.
 *
 * Usa Secret Manager si:
 * - USE_SECRET_MANAGER=true (explícitamente configurado), O
 * - NODE_ENV=production (implícito)
 *
 * @returns {boolean} true si debe usar Secret Manager
 */
export function shouldUseSecretManager() {
  const useSecretManager = process.env.USE_SECRET_MANAGER;
  const nodeEnv = process.env.NODE_ENV;

  // Si USE_SECRET_MANAGER está explícitamente configurado, usarlo
  if (useSecretManager !== undefined) {
    return useSecretManager === 'true';
  }

  // Por defecto, usar Secret Manager solo en producción
  return nodeEnv === 'production';
}

/**
 * Guarda el token en Secret Manager (producción).
 *
 * @param {string} secretName - Nombre del secret en Secret Manager
 * @param {string} tokenJson - Token JSON a guardar (NO se loguea por seguridad)
 * @returns {Promise<void>}
 */
async function saveToSecretManager(secretName, tokenJson) {
  const projectId = await getProjectId();
  await addSecretVersion({
    projectId,
    secretId: secretName,
    payload: tokenJson,
  });
  console.log('[TokenStorage] Token guardado en Secret Manager');
}

/**
 * Guarda el token en archivo local (desarrollo).
 *
 * @param {string} secretName - Nombre del archivo (sin extensión)
 * @param {string} tokenJson - Token JSON a guardar (NO se loguea por seguridad)
 * @returns {Promise<void>}
 */
async function saveToLocalFile(secretName, tokenJson) {
  const secretsDir = path.join(process.cwd(), 'secrets');
  const filePath = path.join(secretsDir, `${secretName}.local.json`);

  // Crear directorio si no existe
  await fs.mkdir(secretsDir, { recursive: true });

  // Guardar archivo
  await fs.writeFile(filePath, tokenJson, 'utf8');

  console.log(`[TokenStorage] Token guardado en archivo local: ${filePath}`);
}

/**
 * Guarda el token OAuth de Google de forma segura.
 *
 * En desarrollo (USE_SECRET_MANAGER=false o NODE_ENV!=production):
 * - Guarda en ./secrets/${secretName}.local.json
 *
 * En producción (USE_SECRET_MANAGER=true o NODE_ENV=production):
 * - Guarda en Google Secret Manager
 *
 * IMPORTANTE: NO loguea el contenido del token por seguridad.
 *
 * @param {string} secretName - Nombre del secret/archivo
 * @param {string} tokenJson - Token JSON completo
 * @returns {Promise<void>}
 *
 * @example
 * await saveGoogleToken('GOOGLE_OAUTH_TOKEN_JSON', tokenJson);
 */
export async function saveGoogleToken(secretName, tokenJson) {
  if (!secretName) {
    throw new Error('Secret name is required');
  }
  if (!tokenJson) {
    throw new Error('Token JSON is required');
  }

  const useSecretMgr = shouldUseSecretManager();

  if (useSecretMgr) {
    await saveToSecretManager(secretName, tokenJson);
  } else {
    await saveToLocalFile(secretName, tokenJson);
  }
}
