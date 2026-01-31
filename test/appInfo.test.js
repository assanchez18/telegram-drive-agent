import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { APP_STARTED_AT, getRuntimeInfo } from '../src/runtime/appInfo.js';

describe('appInfo', () => {
  let originalEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('APP_STARTED_AT', () => {
    it('es un timestamp ISO válido', () => {
      expect(APP_STARTED_AT).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/);
      expect(new Date(APP_STARTED_AT).toISOString()).toBe(APP_STARTED_AT);
    });
  });

  describe('getRuntimeInfo', () => {
    it('devuelve información completa con todas las env vars', () => {
      process.env.NODE_ENV = 'production';
      process.env.K_SERVICE = 'my-service';
      process.env.K_REVISION = 'my-service-00001';
      process.env.GIT_SHA = 'abc123def';

      const info = getRuntimeInfo();

      expect(info).toEqual({
        startedAt: APP_STARTED_AT,
        nodeEnv: 'production',
        cloudRun: {
          service: 'my-service',
          revision: 'my-service-00001',
        },
        gitSha: 'abc123def',
      });
    });

    it('devuelve N/A cuando NODE_ENV no está definido', () => {
      delete process.env.NODE_ENV;

      const info = getRuntimeInfo();

      expect(info.nodeEnv).toBe('N/A');
    });

    it('devuelve "local" cuando K_SERVICE no está definido', () => {
      delete process.env.K_SERVICE;

      const info = getRuntimeInfo();

      expect(info.cloudRun.service).toBe('local');
    });

    it('devuelve "N/A" cuando K_REVISION no está definido', () => {
      delete process.env.K_REVISION;

      const info = getRuntimeInfo();

      expect(info.cloudRun.revision).toBe('N/A');
    });

    it('devuelve "N/A" cuando GIT_SHA no está definido', () => {
      delete process.env.GIT_SHA;

      const info = getRuntimeInfo();

      expect(info.gitSha).toBe('N/A');
    });
  });
});
