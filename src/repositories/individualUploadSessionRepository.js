const individualUploadSessions = new Map();

export function startIndividualUploadSession(chatId, fileInfo) {
  if (typeof chatId !== 'number' && typeof chatId !== 'string') {
    throw new Error('Chat ID is required');
  }
  if (!fileInfo) {
    throw new Error('File info is required');
  }

  individualUploadSessions.set(chatId, {
    chatId,
    fileInfo,
    state: 'waiting_for_property',
    createdAt: new Date().toISOString(),
  });

  return individualUploadSessions.get(chatId);
}

export function getIndividualUploadSession(chatId) {
  return individualUploadSessions.get(chatId) || null;
}

export function updateIndividualUploadSessionState(chatId, state, data = {}) {
  const session = individualUploadSessions.get(chatId);
  if (!session) {
    throw new Error('No active individual upload session found');
  }

  session.state = state;
  Object.assign(session, data);
  return session;
}

export function clearIndividualUploadSession(chatId) {
  individualUploadSessions.delete(chatId);
}

export function clearAllIndividualUploadSessions() {
  individualUploadSessions.clear();
}
