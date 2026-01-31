import crypto from 'crypto';
import { google } from 'googleapis';
import { saveGoogleToken } from '../adapters/tokenStorageAdapter.js';

// Store para sesiones activas (en memoria, se pierde al reiniciar pero es aceptable)
const activeSessions = new Map();

/**
 * Construye el redirect URI para OAuth 2.0 de forma consistente.
 *
 * IMPORTANTE: El redirect_uri DEBE coincidir EXACTAMENTE (scheme, host, puerto, path)
 * con los "Authorized redirect URIs" configurados en Google Cloud Console.
 *
 * @param {string} [baseUrl] - Base URL del servidor (ej: https://my-app.run.app)
 * @param {string|number} [port] - Puerto del servidor (solo se usa si baseUrl no está definido)
 * @returns {string} El redirect URI completo (ej: https://my-app.run.app/oauth/google/callback)
 *
 * @example
 * // Producción (con PUBLIC_BASE_URL)
 * getRedirectUri('https://my-app.run.app')
 * // => 'https://my-app.run.app/oauth/google/callback'
 *
 * @example
 * // Desarrollo local (sin PUBLIC_BASE_URL)
 * getRedirectUri(undefined, 8080)
 * // => 'http://localhost:8080/oauth/google/callback'
 */
export function getRedirectUri(baseUrl, port = 8080) {
  const effectiveBaseUrl = baseUrl || `http://localhost:${port}`;
  return `${effectiveBaseUrl}/oauth/google/callback`;
}

/**
 * Genera HMAC signature para el state
 */
function signState(data, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(JSON.stringify(data));
  return hmac.digest('hex');
}

/**
 * Verifica HMAC signature del state
 */
function verifyState(data, signature, secret) {
  const expected = signState(data, secret);
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

/**
 * Crea la URL de autorización de Google
 */
export function createAuthUrl({ chatId, userId, oauthClientJson, stateSecret, baseUrl, port }) {
  if (!chatId) {
    throw new Error('Chat ID is required');
  }
  if (!userId) {
    throw new Error('User ID is required');
  }
  if (!oauthClientJson) {
    throw new Error('OAuth client JSON is required');
  }
  if (!stateSecret) {
    throw new Error('State secret is required');
  }

  // Verificar si ya hay una sesión activa para este chat
  const sessionKey = `${chatId}`;
  if (activeSessions.has(sessionKey)) {
    const existingSession = activeSessions.get(sessionKey);
    if (Date.now() < existingSession.expiresAt) {
      throw new Error('Ya hay una sesión de login activa. Espera a que expire o complétala.');
    }
    // Sesión expirada, eliminarla
    activeSessions.delete(sessionKey);
  }

  const clientConfig = JSON.parse(oauthClientJson);
  const credentials = clientConfig.web || clientConfig.installed;

  if (!credentials) {
    throw new Error('OAuth client JSON must have "web" or "installed" key');
  }

  const { client_id, client_secret } = credentials;

  if (!client_id || !client_secret) {
    throw new Error('OAuth client JSON must contain client_id and client_secret');
  }

  const redirectUri = getRedirectUri(baseUrl, port);
  console.log('[GoogleReauth] Using redirect URI:', redirectUri);

  const oauth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirectUri
  );

  // Generar state firmado
  const nonce = crypto.randomBytes(16).toString('hex');
  const iat = Date.now();
  const exp = iat + 10 * 60 * 1000; // 10 minutos

  const stateData = {
    chatId,
    userId,
    nonce,
    iat,
    exp,
  };

  const signature = signState(stateData, stateSecret);
  const state = Buffer.from(JSON.stringify({ ...stateData, sig: signature })).toString('base64url');

  // Guardar sesión activa
  activeSessions.set(sessionKey, {
    chatId,
    userId,
    nonce,
    expiresAt: exp,
  });

  // Generar URL manualmente para asegurar que response_type esté presente
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
    client_id,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/drive',
    access_type: 'offline',
    prompt: 'consent select_account', // Forzar selección de cuenta Y consent
    state,
  }).toString()}`;

  console.log('[GoogleReauth] Generated auth URL:', authUrl);

  // Verificar que la URL contiene response_type
  if (!authUrl.includes('response_type=')) {
    console.error('[GoogleReauth] WARNING: Generated URL missing response_type parameter');
    console.error('[GoogleReauth] OAuth2Client details:', { client_id, redirectUri });
  }

  return {
    url: authUrl,
    expiresAt: exp,
  };
}

/**
 * Maneja el callback de OAuth y actualiza el secreto
 */
export async function handleCallback({
  code,
  state,
  oauthClientJson,
  stateSecret,
  baseUrl,
  port,
  secretName,
}) {
  if (!code) {
    throw new Error('Authorization code is required');
  }
  if (!state) {
    throw new Error('State is required');
  }
  if (!oauthClientJson) {
    throw new Error('OAuth client JSON is required');
  }
  if (!stateSecret) {
    throw new Error('State secret is required');
  }
  if (!secretName) {
    throw new Error('Secret name is required');
  }

  // Decodificar y verificar state
  let stateData;
  try {
    const decoded = JSON.parse(Buffer.from(state, 'base64url').toString('utf8'));
    const { sig, ...data } = decoded;

    // Verificar firma
    if (!verifyState(data, sig, stateSecret)) {
      throw new Error('Invalid state signature');
    }

    // Verificar expiración
    if (Date.now() > data.exp) {
      throw new Error('State has expired');
    }

    stateData = data;
  } catch (err) {
    throw new Error(`Invalid state: ${err.message}`);
  }

  // Verificar que la sesión existe
  const sessionKey = `${stateData.chatId}`;
  if (!activeSessions.has(sessionKey)) {
    throw new Error('No active session found');
  }

  const session = activeSessions.get(sessionKey);
  if (session.nonce !== stateData.nonce) {
    throw new Error('Session nonce mismatch');
  }

  try {
    // Intercambiar código por tokens
    const clientConfig = JSON.parse(oauthClientJson);
    const credentials = clientConfig.web || clientConfig.installed;

    if (!credentials) {
      throw new Error('OAuth client JSON must have "web" or "installed" key');
    }

    const { client_id, client_secret } = credentials;

    if (!client_id || !client_secret) {
      throw new Error('OAuth client JSON must contain client_id and client_secret');
    }

    const redirectUri = getRedirectUri(baseUrl, port);
    const oauth2Client = new google.auth.OAuth2(
      client_id,
      client_secret,
      redirectUri
    );

    const { tokens } = await oauth2Client.getToken(code);

    // Verificar que tenemos refresh_token
    if (!tokens.refresh_token) {
      console.warn('[GoogleReauth] No refresh_token received. User may need to revoke and re-authorize.');
      // Aún así guardamos el token por si tiene access_token válido
    }

    // Construir JSON compatible con auth.js
    const tokenJson = JSON.stringify({
      type: 'authorized_user',
      refresh_token: tokens.refresh_token,
      access_token: tokens.access_token,
      expiry_date: tokens.expiry_date,
      token_type: tokens.token_type,
      scope: tokens.scope,
    });

    // Guardar token (Secret Manager en producción, archivo local en desarrollo)
    await saveGoogleToken(secretName, tokenJson);

    // Limpiar sesión
    activeSessions.delete(sessionKey);

    return {
      success: true,
      chatId: stateData.chatId,
      hasRefreshToken: !!tokens.refresh_token,
      message: tokens.refresh_token
        ? '✅ Token actualizado correctamente'
        : '⚠️ Token actualizado pero sin refresh_token. Puede que necesites revocar acceso en Google y volver a autorizar.',
    };
  } catch (err) {
    // Limpiar sesión en caso de error
    activeSessions.delete(sessionKey);

    throw new Error(`Error exchanging code: ${err.message}`);
  }
}

/**
 * Cancela una sesión activa
 */
export function cancelSession(chatId) {
  const sessionKey = `${chatId}`;
  if (activeSessions.has(sessionKey)) {
    activeSessions.delete(sessionKey);
    return true;
  }
  return false;
}

/**
 * Verifica si hay una sesión activa
 */
export function hasActiveSession(chatId) {
  const sessionKey = `${chatId}`;
  if (!activeSessions.has(sessionKey)) {
    return false;
  }

  const session = activeSessions.get(sessionKey);
  if (Date.now() > session.expiresAt) {
    activeSessions.delete(sessionKey);
    return false;
  }

  return true;
}
