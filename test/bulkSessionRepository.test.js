import { describe, it, expect, beforeEach } from 'vitest';
import {
  startBulkSession,
  getBulkSession,
  addFileToBulkSession,
  updateBulkSessionState,
  clearBulkSession,
  clearAllBulkSessions,
} from '../src/repositories/bulkSessionRepository.js';
import { BulkFile } from '../src/domain/BulkFile.js';

describe('bulkSessionRepository', () => {
  beforeEach(() => {
    clearAllBulkSessions();
  });

  describe('startBulkSession', () => {
    it('crea nueva sesión bulk', () => {
      const session = startBulkSession(12345);

      expect(session.chatId).toBe(12345);
      expect(session.files).toEqual([]);
      expect(session.state).toBe('collecting_files');
      expect(session.createdAt).toBeDefined();
    });

    it('lanza error si falta chatId', () => {
      expect(() => startBulkSession()).toThrow('Chat ID is required');
    });

    it('acepta chatId como string', () => {
      const session = startBulkSession('12345');
      expect(session.chatId).toBe('12345');
    });
  });

  describe('getBulkSession', () => {
    it('devuelve sesión existente', () => {
      startBulkSession(12345);
      const session = getBulkSession(12345);

      expect(session).not.toBeNull();
      expect(session.chatId).toBe(12345);
    });

    it('devuelve null si no existe sesión', () => {
      const session = getBulkSession(99999);
      expect(session).toBeNull();
    });
  });

  describe('addFileToBulkSession', () => {
    it('añade archivo a sesión existente', () => {
      startBulkSession(12345);

      const file = new BulkFile({
        fileId: 'file-1',
        fileUniqueId: 'unique-1',
        fileName: 'test.pdf',
        mimeType: 'application/pdf',
      });

      const session = addFileToBulkSession(12345, file);

      expect(session.files.length).toBe(1);
      expect(session.files[0]).toBe(file);
    });

    it('lanza error si no hay sesión activa', () => {
      const file = new BulkFile({
        fileId: 'file-1',
        fileUniqueId: 'unique-1',
        fileName: 'test.pdf',
        mimeType: 'application/pdf',
      });

      expect(() => addFileToBulkSession(99999, file)).toThrow('No active bulk session found');
    });

    it('añade múltiples archivos', () => {
      startBulkSession(12345);

      const file1 = new BulkFile({
        fileId: 'file-1',
        fileUniqueId: 'unique-1',
        fileName: 'test1.pdf',
        mimeType: 'application/pdf',
      });

      const file2 = new BulkFile({
        fileId: 'file-2',
        fileUniqueId: 'unique-2',
        fileName: 'test2.pdf',
        mimeType: 'application/pdf',
      });

      addFileToBulkSession(12345, file1);
      const session = addFileToBulkSession(12345, file2);

      expect(session.files.length).toBe(2);
    });
  });

  describe('updateBulkSessionState', () => {
    it('actualiza estado de sesión', () => {
      startBulkSession(12345);

      const session = updateBulkSessionState(12345, 'waiting_for_property');

      expect(session.state).toBe('waiting_for_property');
    });

    it('actualiza estado y datos adicionales', () => {
      startBulkSession(12345);

      const session = updateBulkSessionState(12345, 'waiting_for_category', {
        selectedProperty: { address: 'Test Property' },
      });

      expect(session.state).toBe('waiting_for_category');
      expect(session.selectedProperty).toEqual({ address: 'Test Property' });
    });

    it('lanza error si no hay sesión activa', () => {
      expect(() => updateBulkSessionState(99999, 'new_state')).toThrow('No active bulk session found');
    });
  });

  describe('clearBulkSession', () => {
    it('elimina sesión existente', () => {
      startBulkSession(12345);
      clearBulkSession(12345);

      const session = getBulkSession(12345);
      expect(session).toBeNull();
    });

    it('no lanza error si sesión no existe', () => {
      expect(() => clearBulkSession(99999)).not.toThrow();
    });
  });

  describe('clearAllBulkSessions', () => {
    it('elimina todas las sesiones', () => {
      startBulkSession(12345);
      startBulkSession(67890);

      clearAllBulkSessions();

      expect(getBulkSession(12345)).toBeNull();
      expect(getBulkSession(67890)).toBeNull();
    });
  });
});
