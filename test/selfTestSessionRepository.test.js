import { describe, it, expect, beforeEach } from 'vitest';
import {
  startSelfTestSession,
  getSelfTestSession,
  endSelfTestSession,
  clearAllSelfTestSessions,
} from '../src/repositories/selfTestSessionRepository.js';

describe('selfTestSessionRepository', () => {
  beforeEach(() => {
    clearAllSelfTestSessions();
  });

  describe('startSelfTestSession', () => {
    it('inicia una sesión exitosamente cuando no existe', () => {
      const chatId = 123456;
      const result = startSelfTestSession(chatId);

      expect(result).toBe(true);
      const session = getSelfTestSession(chatId);
      expect(session).toBeDefined();
      expect(session.status).toBe('running');
      expect(session.startedAt).toBeDefined();
    });

    it('rechaza iniciar sesión cuando ya existe una activa', () => {
      const chatId = 123456;

      startSelfTestSession(chatId);
      const result = startSelfTestSession(chatId);

      expect(result).toBe(false);
    });

    it('permite iniciar sesiones para diferentes chats', () => {
      const chatId1 = 111;
      const chatId2 = 222;

      const result1 = startSelfTestSession(chatId1);
      const result2 = startSelfTestSession(chatId2);

      expect(result1).toBe(true);
      expect(result2).toBe(true);
      expect(getSelfTestSession(chatId1)).toBeDefined();
      expect(getSelfTestSession(chatId2)).toBeDefined();
    });
  });

  describe('getSelfTestSession', () => {
    it('retorna la sesión existente', () => {
      const chatId = 123456;
      startSelfTestSession(chatId);

      const session = getSelfTestSession(chatId);

      expect(session).toBeDefined();
      expect(session.status).toBe('running');
    });

    it('retorna undefined cuando no existe sesión', () => {
      const session = getSelfTestSession(999999);

      expect(session).toBeUndefined();
    });
  });

  describe('endSelfTestSession', () => {
    it('elimina la sesión existente', () => {
      const chatId = 123456;
      startSelfTestSession(chatId);

      endSelfTestSession(chatId);

      const session = getSelfTestSession(chatId);
      expect(session).toBeUndefined();
    });

    it('no falla cuando se intenta eliminar sesión inexistente', () => {
      expect(() => {
        endSelfTestSession(999999);
      }).not.toThrow();
    });

    it('solo elimina la sesión del chat especificado', () => {
      const chatId1 = 111;
      const chatId2 = 222;

      startSelfTestSession(chatId1);
      startSelfTestSession(chatId2);

      endSelfTestSession(chatId1);

      expect(getSelfTestSession(chatId1)).toBeUndefined();
      expect(getSelfTestSession(chatId2)).toBeDefined();
    });
  });

  describe('clearAllSelfTestSessions', () => {
    it('elimina todas las sesiones', () => {
      const chatId1 = 111;
      const chatId2 = 222;
      const chatId3 = 333;

      startSelfTestSession(chatId1);
      startSelfTestSession(chatId2);
      startSelfTestSession(chatId3);

      clearAllSelfTestSessions();

      expect(getSelfTestSession(chatId1)).toBeUndefined();
      expect(getSelfTestSession(chatId2)).toBeUndefined();
      expect(getSelfTestSession(chatId3)).toBeUndefined();
    });

    it('no falla cuando no hay sesiones', () => {
      expect(() => {
        clearAllSelfTestSessions();
      }).not.toThrow();
    });
  });
});
