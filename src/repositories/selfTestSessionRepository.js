/**
 * Repository para gestionar sesiones de self-test en memoria.
 * Evita ejecuciones concurrentes del mismo self-test por chat.
 */

const activeSessions = new Map();

export function startSelfTestSession(chatId) {
  if (activeSessions.has(chatId)) {
    return false;
  }

  activeSessions.set(chatId, {
    startedAt: new Date().toISOString(),
    status: 'running',
  });

  return true;
}

export function getSelfTestSession(chatId) {
  return activeSessions.get(chatId);
}

export function endSelfTestSession(chatId) {
  activeSessions.delete(chatId);
}

export function clearAllSelfTestSessions() {
  activeSessions.clear();
}
