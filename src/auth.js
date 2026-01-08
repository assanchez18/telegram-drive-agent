// auth.js
import { google } from 'googleapis';

const SCOPES = ['https://www.googleapis.com/auth/drive.file'];

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Falta ${name}`);
  return v;
}

export function getDriveAuth() {
  const rawClient = requireEnv('GOOGLE_OAUTH_CLIENT_JSON');
  const rawToken = requireEnv('GOOGLE_OAUTH_TOKEN_JSON');

  let clientJson;
  let tokenJson;

  try {
    clientJson = JSON.parse(rawClient);
  } catch {
    throw new Error('GOOGLE_OAUTH_CLIENT_JSON no es JSON válido');
  }

  try {
    tokenJson = JSON.parse(rawToken);
  } catch {
    throw new Error('GOOGLE_OAUTH_TOKEN_JSON no es JSON válido');
  }

  const c = clientJson.web || clientJson.installed;
  if (!c?.client_id || !c?.client_secret) {
    throw new Error('GOOGLE_OAUTH_CLIENT_JSON debe contener client_id y client_secret');
  }

  const redirectUri =
    (c.redirect_uris || []).find((r) => r.includes('http://localhost:3000/oauth2callback')) ||
    (c.redirect_uris || [])[0] ||
    'http://localhost:3000/oauth2callback';

  const oAuth2Client = new google.auth.OAuth2(c.client_id, c.client_secret, redirectUri);
  oAuth2Client.setCredentials({ ...tokenJson, scope: SCOPES.join(' ') });

  return oAuth2Client;
}
