import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { verifyTelegramWebhookSecret } from '../src/security.js';

describe('verifyTelegramWebhookSecret', () => {
  const originalEnv = process.env.TELEGRAM_WEBHOOK_SECRET;

  beforeEach(() => {
    process.env.TELEGRAM_WEBHOOK_SECRET = 'test-secret-123';
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.TELEGRAM_WEBHOOK_SECRET = originalEnv;
    } else {
      delete process.env.TELEGRAM_WEBHOOK_SECRET;
    }
  });

  it('devuelve true cuando el header coincide exactamente', () => {
    const req = {
      header: (name) => {
        if (name === 'X-Telegram-Bot-Api-Secret-Token') {
          return 'test-secret-123';
        }
        return undefined;
      },
    };

    expect(verifyTelegramWebhookSecret(req)).toBe(true);
  });

  it('devuelve true cuando el header coincide con trim', () => {
    const req = {
      header: (name) => {
        if (name === 'X-Telegram-Bot-Api-Secret-Token') {
          return '  test-secret-123  ';
        }
        return undefined;
      },
    };

    expect(verifyTelegramWebhookSecret(req)).toBe(true);
  });

  it('devuelve false si falta el header', () => {
    const req = {
      header: () => undefined,
    };

    expect(verifyTelegramWebhookSecret(req)).toBe(false);
  });

  it('devuelve false si el header no coincide', () => {
    const req = {
      header: (name) => {
        if (name === 'X-Telegram-Bot-Api-Secret-Token') {
          return 'wrong-secret';
        }
        return undefined;
      },
    };

    expect(verifyTelegramWebhookSecret(req)).toBe(false);
  });

  it('lanza error si falta TELEGRAM_WEBHOOK_SECRET', () => {
    const originalEnv = process.env.TELEGRAM_WEBHOOK_SECRET;
    delete process.env.TELEGRAM_WEBHOOK_SECRET;

    const req = {
      header: () => 'any-secret',
    };

    expect(() => verifyTelegramWebhookSecret(req)).toThrow('Falta TELEGRAM_WEBHOOK_SECRET');

    process.env.TELEGRAM_WEBHOOK_SECRET = originalEnv;
  });
});
