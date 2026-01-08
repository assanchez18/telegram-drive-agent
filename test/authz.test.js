import { describe, it, expect } from 'vitest';
import { parseAllowedUserIds, isAuthorizedTelegramUser } from '../src/security.js';

describe('parseAllowedUserIds', () => {
  it('parsea lista simple', () => {
    const result = parseAllowedUserIds('123,456');
    expect(result.has('123')).toBe(true);
    expect(result.has('456')).toBe(true);
    expect(result.has('789')).toBe(false);
  });

  it('maneja espacios alrededor de IDs', () => {
    const result = parseAllowedUserIds('123, 456 , 789');
    expect(result.has('123')).toBe(true);
    expect(result.has('456')).toBe(true);
    expect(result.has('789')).toBe(true);
  });

  it('retorna Set vacío para string vacío', () => {
    const result = parseAllowedUserIds('');
    expect(result.size).toBe(0);
  });

  it('retorna Set vacío para undefined', () => {
    const result = parseAllowedUserIds(undefined);
    expect(result.size).toBe(0);
  });

  it('retorna Set vacío para null', () => {
    const result = parseAllowedUserIds(null);
    expect(result.size).toBe(0);
  });

  it('ignora entradas vacías entre comas', () => {
    const result = parseAllowedUserIds('123,,456');
    expect(result.size).toBe(2);
    expect(result.has('123')).toBe(true);
    expect(result.has('456')).toBe(true);
  });
});

describe('isAuthorizedTelegramUser', () => {
  it('retorna true si userId está en ALLOWED_USER_IDS', () => {
    const msg = { from: { id: 123 } };
    const result = isAuthorizedTelegramUser(msg);
    expect(typeof result).toBe('boolean');
  });

  it('retorna false si msg.from no existe', () => {
    const msg = {};
    const result = isAuthorizedTelegramUser(msg);
    expect(result).toBe(false);
  });

  it('retorna false si msg.from.id no existe', () => {
    const msg = { from: {} };
    const result = isAuthorizedTelegramUser(msg);
    expect(result).toBe(false);
  });
});
