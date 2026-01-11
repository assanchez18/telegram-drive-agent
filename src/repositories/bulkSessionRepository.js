const bulkSessions = new Map();

export function startBulkSession(chatId) {
  if (typeof chatId !== 'number' && typeof chatId !== 'string') {
    throw new Error('Chat ID is required');
  }

  bulkSessions.set(chatId, {
    chatId,
    files: [],
    state: 'collecting_files',
    createdAt: new Date().toISOString(),
  });

  return bulkSessions.get(chatId);
}

export function getBulkSession(chatId) {
  return bulkSessions.get(chatId) || null;
}

export function addFileToBulkSession(chatId, file) {
  const session = bulkSessions.get(chatId);
  if (!session) {
    throw new Error('No active bulk session found');
  }

  session.files.push(file);
  return session;
}

export function updateBulkSessionState(chatId, state, data = {}) {
  const session = bulkSessions.get(chatId);
  if (!session) {
    throw new Error('No active bulk session found');
  }

  session.state = state;
  Object.assign(session, data);
  return session;
}

export function clearBulkSession(chatId) {
  bulkSessions.delete(chatId);
}

export function clearAllBulkSessions() {
  bulkSessions.clear();
}
