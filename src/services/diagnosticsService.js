import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { getRuntimeInfo } from '../runtime/appInfo.js';
import { getDriveAuth } from '../auth.js';
import { listProperties } from './propertyService.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageJsonPath = join(__dirname, '../../package.json');

export function getVersionInfo() {
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  const runtime = getRuntimeInfo();

  return {
    name: packageJson.name,
    version: packageJson.version,
    nodeEnv: runtime.nodeEnv,
    cloudRun: runtime.cloudRun,
    startedAt: runtime.startedAt,
    gitSha: runtime.gitSha,
  };
}

export async function getStatusReport({ drive, baseFolderId }) {
  if (!drive) {
    throw new Error('Drive client is required');
  }
  if (!baseFolderId) {
    throw new Error('Base folder ID is required');
  }

  const checks = {
    config: { status: 'pending', message: '' },
    oauth: { status: 'pending', message: '' },
    driveAccess: { status: 'pending', message: '' },
    catalog: { status: 'pending', message: '' },
  };

  // Check 1: Config - Verificar env vars requeridas
  const requiredEnvVars = [
    'BOT_TOKEN',
    'TELEGRAM_WEBHOOK_SECRET',
    'ALLOWED_TELEGRAM_USER_IDS',
    'DRIVE_FOLDER_ID',
    'GOOGLE_OAUTH_CLIENT_JSON',
    'GOOGLE_OAUTH_TOKEN_JSON',
  ];

  const missingVars = requiredEnvVars.filter((varName) => !process.env[varName]);

  if (missingVars.length === 0) {
    checks.config.status = 'success';
    checks.config.message = 'Todas las variables requeridas están configuradas';
  } else {
    checks.config.status = 'failed';
    checks.config.message = `Faltan variables: ${missingVars.join(', ')}`;
  }

  // Check 2: Google OAuth - Intentar construir auth client y verificar token
  try {
    const authClient = getDriveAuth();

    // Forzar refresh del token para verificar que funciona
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Timeout')), 5000);
    });

    const refreshPromise = authClient.getAccessToken();
    await Promise.race([refreshPromise, timeoutPromise]);

    checks.oauth.status = 'success';
    checks.oauth.message = 'Auth client válido y token actualizado';
  } catch (err) {
    checks.oauth.status = 'failed';

    if (err.message === 'Timeout') {
      checks.oauth.message = 'Timeout verificando token (5s)';
    } else if (err.message?.includes('invalid_grant')) {
      checks.oauth.message = 'Error: invalid_grant - Token expirado o revocado';
    } else {
      checks.oauth.message = `Error: ${err.message || 'Desconocido'}`;
    }
  }

  // Check 3: Drive - Verificar acceso a carpeta raíz
  try {
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Timeout')), 5000);
    });

    // Usar list en lugar de get porque drive.file scope solo permite acceder
    // a archivos creados por la app, no a carpetas arbitrarias
    const drivePromise = drive.files.list({
      q: `'${baseFolderId}' in parents`,
      pageSize: 1,
      fields: 'files(id)',
    });

    await Promise.race([drivePromise, timeoutPromise]);

    checks.driveAccess.status = 'success';
    checks.driveAccess.message = 'Carpeta raíz accesible';
  } catch (err) {
    checks.driveAccess.status = 'failed';

    if (err.message === 'Timeout') {
      checks.driveAccess.message = 'Timeout verificando carpeta (5s)';
    } else if (err.code === 404) {
      checks.driveAccess.message = 'Error: Carpeta no encontrada (404)';
    } else if (err.code === 403) {
      checks.driveAccess.message = 'Error: Sin permisos para acceder (403)';
    } else {
      checks.driveAccess.message = `Error: ${err.message || 'Desconocido'}`;
    }
  }

  // Check 4: Catálogo - Intentar listar properties
  try {
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Timeout')), 5000);
    });

    const catalogPromise = listProperties({ drive, baseFolderId });
    const result = await Promise.race([catalogPromise, timeoutPromise]);

    const activeCount = result.properties?.length || 0;
    checks.catalog.status = 'success';
    checks.catalog.message = `Catálogo accesible (${activeCount} propiedades activas)`;
  } catch (err) {
    checks.catalog.status = 'failed';

    if (err.message === 'Timeout') {
      checks.catalog.message = 'Timeout verificando catálogo (5s)';
    } else {
      checks.catalog.message = `Error: ${err.message || 'Desconocido'}`;
    }
  }

  return checks;
}
