import fs from 'fs/promises';
import path from 'path';
import { addSecretVersion, getProjectId, getSecretVersion } from './secretManagerAdapter.js';

// In-memory token cache
let _tokenCache = null;
let _tokenCacheTimestamp = 0;
const TOKEN_CACHE_TTL_MS = 60 * 1000; // 60 segundos

/**
 * Invalida el caché en memoria del token OAuth.
 * Debe llamarse tras guardar un token nuevo para que el siguiente
 * getGoogleToken() lea la versión más reciente.
 */
export function invalidateTokenCache() {
  _tokenCache = null;
  _tokenCacheTimestamp = 0;
}

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
 * Lee el token OAuth de Google de forma segura, con caché en memoria.
 *
 * En producción (USE_SECRET_MANAGER=true o NODE_ENV=production):
 * - Lee la versión 'latest' desde Google Secret Manager
 *
 * En desarrollo:
 * - Lee desde ./secrets/${secretName}.local.json
 *
 * El resultado se cachea 60 segundos. Llama a invalidateTokenCache() para forzar
 * una lectura fresca (p.ej. tras completar /google_login).
 *
 * IMPORTANTE: NO loguea el contenido del token por seguridad.
 *
 * @param {string} secretName - Nombre del secret/archivo
 * @returns {Promise<string>} Token JSON como string
 */
export async function getGoogleToken(secretName) {
  if (!secretName) {
    throw new Error('Secret name is required');
  }

  if (_tokenCache !== null && Date.now() - _tokenCacheTimestamp < TOKEN_CACHE_TTL_MS) {
    return _tokenCache;
  }

  let tokenJson;
  if (shouldUseSecretManager()) {
    const projectId = await getProjectId();
    tokenJson = await getSecretVersion({ projectId, secretId: secretName, version: 'latest' });
  } else {
    const secretsDir = path.join(process.cwd(), 'secrets');
    const filePath = path.join(secretsDir, `${secretName}.local.json`);
    tokenJson = await fs.readFile(filePath, 'utf8');
  }

  _tokenCache = tokenJson;
  _tokenCacheTimestamp = Date.now();
  return tokenJson;
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
