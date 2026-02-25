// auth.js
import { google } from 'googleapis';
import { getGoogleToken, shouldUseSecretManager } from './adapters/tokenStorageAdapter.js';

const SCOPES = ['https://www.googleapis.com/auth/drive.file'];

// Singleton del cliente OAuth2 compartido por toda la aplicación
let _sharedOAuth2Client = null;

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Falta ${name}`);
  return v;
}

function buildOAuth2Client() {
  const rawClient = requireEnv('GOOGLE_OAUTH_CLIENT_JSON');

  let clientJson;
  try {
    clientJson = JSON.parse(rawClient);
  } catch {
    throw new Error('GOOGLE_OAUTH_CLIENT_JSON no es JSON válido');
  }

  const c = clientJson.web || clientJson.installed;
  if (!c?.client_id || !c?.client_secret) {
    throw new Error('GOOGLE_OAUTH_CLIENT_JSON debe contener client_id y client_secret');
  }

  const redirectUri =
    (c.redirect_uris || []).find((r) => r.includes('http://localhost:3000/oauth2callback')) ||
    (c.redirect_uris || [])[0] ||
    'http://localhost:3000/oauth2callback';

  return new google.auth.OAuth2(c.client_id, c.client_secret, redirectUri);
}

/**
 * Devuelve el cliente OAuth2 de Drive, creándolo la primera vez.
 *
 * En producción (USE_SECRET_MANAGER=true / NODE_ENV=production):
 * - Lee el token desde Secret Manager (versión 'latest') vía getGoogleToken().
 *
 * En desarrollo:
 * - Lee el token desde la env var GOOGLE_OAUTH_TOKEN_JSON.
 *
 * Devuelve siempre el mismo singleton; usa refreshDriveAuthCredentials()
 * para actualizarlo tras un nuevo /google_login.
 *
 * @param {string} [secretName] - Nombre del secret en Secret Manager (requerido en producción)
 * @returns {Promise<import('googleapis').Auth.OAuth2Client>}
 */
export async function getDriveAuth(secretName) {
  if (_sharedOAuth2Client) return _sharedOAuth2Client;

  const oAuth2Client = buildOAuth2Client();

  let rawToken;
  if (shouldUseSecretManager() && secretName) {
    rawToken = await getGoogleToken(secretName);
  } else {
    rawToken = requireEnv('GOOGLE_OAUTH_TOKEN_JSON');
  }

  let tokenJson;
  try {
    tokenJson = JSON.parse(rawToken);
  } catch {
    throw new Error('GOOGLE_OAUTH_TOKEN_JSON no es JSON válido');
  }

  oAuth2Client.setCredentials({ ...tokenJson, scope: SCOPES.join(' ') });
  _sharedOAuth2Client = oAuth2Client;
  return _sharedOAuth2Client;
}

/**
 * Actualiza las credenciales del cliente OAuth2 compartido con el token
 * más reciente leído desde Secret Manager o archivo local.
 *
 * Debe llamarse desde oauthRoutes tras completar con éxito /google_login
 * para que las siguientes llamadas a Drive usen el token nuevo sin
 * necesidad de reiniciar el servidor.
 *
 * @param {string} secretName - Nombre del secret/archivo
 * @returns {Promise<void>}
 */
export async function refreshDriveAuthCredentials(secretName) {
  if (!secretName) {
    throw new Error('Secret name is required');
  }

  const rawToken = await getGoogleToken(secretName);

  let tokenJson;
  try {
    tokenJson = JSON.parse(rawToken);
  } catch {
    throw new Error('Token JSON from storage is not valid JSON');
  }

  if (!tokenJson.refresh_token) {
    console.warn('[Auth] Token actualizado sin refresh_token. El token puede expirar sin renovación automática.');
  }

  if (!_sharedOAuth2Client) {
    await getDriveAuth(secretName);
    return;
  }

  _sharedOAuth2Client.setCredentials({ ...tokenJson, scope: SCOPES.join(' ') });
  console.log('[Auth] Credenciales de Drive actualizadas con token más reciente');
}

/**
 * Resetea el singleton del cliente OAuth2.
 * Solo debe usarse en tests.
 */
export function _resetDriveAuthForTesting() {
  _sharedOAuth2Client = null;
}
