import { describe, it, expect } from 'vitest';
import { normalizeAddress } from '../src/domain/normalizeAddress.js';

describe('normalizeAddress', () => {
  it('trim espacios al inicio y final', () => {
    expect(normalizeAddress('  Calle Mayor 123  ')).toBe('Calle Mayor 123');
  });

  it('colapsa múltiples espacios internos en uno solo', () => {
    expect(normalizeAddress('Calle   Mayor    123')).toBe('Calle Mayor 123');
  });

  it('combina trim y colapso de espacios', () => {
    expect(normalizeAddress('  Calle   Mayor    123  ')).toBe('Calle Mayor 123');
  });

  it('devuelve string vacío si la entrada es solo espacios', () => {
    expect(normalizeAddress('     ')).toBe('');
  });

  it('no modifica string ya normalizado', () => {
    expect(normalizeAddress('Calle Mayor 123')).toBe('Calle Mayor 123');
  });

  it('lanza error si la entrada no es string', () => {
    expect(() => normalizeAddress(123)).toThrow('Address must be a string');
  });

  it('lanza error si la entrada es null', () => {
    expect(() => normalizeAddress(null)).toThrow('Address must be a string');
  });

  it('lanza error si la entrada es undefined', () => {
    expect(() => normalizeAddress(undefined)).toThrow('Address must be a string');
  });

  it('lanza error si la entrada es un objeto', () => {
    expect(() => normalizeAddress({})).toThrow('Address must be a string');
  });

  it('lanza error si la entrada es un array', () => {
    expect(() => normalizeAddress([])).toThrow('Address must be a string');
  });
});
