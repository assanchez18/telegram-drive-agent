import { describe, it, expect } from 'vitest';
import { getRedirectUri } from '../src/services/googleReauthService.js';

describe('getRedirectUri', () => {
  describe('con PUBLIC_BASE_URL definida', () => {
    it('usa PUBLIC_BASE_URL cuando está definida (producción Cloud Run)', () => {
      const baseUrl = 'https://my-app-abc123.run.app';
      const result = getRedirectUri(baseUrl);

      expect(result).toBe('https://my-app-abc123.run.app/oauth/google/callback');
    });

    it('usa PUBLIC_BASE_URL con dominio custom', () => {
      const baseUrl = 'https://bot.example.com';
      const result = getRedirectUri(baseUrl);

      expect(result).toBe('https://bot.example.com/oauth/google/callback');
    });

    it('usa PUBLIC_BASE_URL incluso si port está definido', () => {
      const baseUrl = 'https://my-app.run.app';
      const port = 3000;
      const result = getRedirectUri(baseUrl, port);

      // baseUrl tiene prioridad, port es ignorado
      expect(result).toBe('https://my-app.run.app/oauth/google/callback');
    });

    it('maneja PUBLIC_BASE_URL sin barra al final', () => {
      const baseUrl = 'https://my-app.run.app';
      const result = getRedirectUri(baseUrl);

      expect(result).toBe('https://my-app.run.app/oauth/google/callback');
    });
  });

  describe('sin PUBLIC_BASE_URL (fallback a localhost)', () => {
    it('usa localhost con port por defecto (8080)', () => {
      const result = getRedirectUri(undefined);

      expect(result).toBe('http://localhost:8080/oauth/google/callback');
    });

    it('usa localhost con port especificado', () => {
      const result = getRedirectUri(undefined, 3000);

      expect(result).toBe('http://localhost:3000/oauth/google/callback');
    });

    it('usa localhost con port 80', () => {
      const result = getRedirectUri(undefined, 80);

      expect(result).toBe('http://localhost:80/oauth/google/callback');
    });

    it('usa localhost cuando baseUrl es null', () => {
      const result = getRedirectUri(null, 8080);

      expect(result).toBe('http://localhost:8080/oauth/google/callback');
    });

    it('usa localhost cuando baseUrl es empty string', () => {
      const result = getRedirectUri('', 8080);

      expect(result).toBe('http://localhost:8080/oauth/google/callback');
    });
  });

  describe('casos edge', () => {
    it('maneja baseUrl con puerto explícito', () => {
      const baseUrl = 'https://my-app.run.app:8443';
      const result = getRedirectUri(baseUrl);

      expect(result).toBe('https://my-app.run.app:8443/oauth/google/callback');
    });

    it('maneja baseUrl con path (aunque no debería usarse así)', () => {
      const baseUrl = 'https://my-app.run.app/api';
      const result = getRedirectUri(baseUrl);

      // Importante: NO agregar doble path
      expect(result).toBe('https://my-app.run.app/api/oauth/google/callback');
    });
  });
});
