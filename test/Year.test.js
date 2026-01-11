import { describe, it, expect } from 'vitest';
import { validateYear, getCurrentYear } from '../src/domain/Year.js';

describe('validateYear', () => {
  it('valida año correcto en formato YYYY', () => {
    const result = validateYear('2024');
    expect(result.valid).toBe(true);
  });

  it('rechaza año que no es string', () => {
    const result = validateYear(2024);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Year must be a string');
  });

  it('rechaza año que no tiene formato YYYY', () => {
    const result = validateYear('24');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Year must be in YYYY format');
  });

  it('rechaza año con letras', () => {
    const result = validateYear('20XX');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Year must be in YYYY format');
  });

  it('rechaza año antes de 1900', () => {
    const result = validateYear('1899');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Year must be between 1900 and');
  });

  it('rechaza año muy futuro', () => {
    const currentYear = new Date().getFullYear();
    const futureYear = String(currentYear + 11);
    const result = validateYear(futureYear);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Year must be between 1900 and');
  });

  it('acepta año actual + 10', () => {
    const currentYear = new Date().getFullYear();
    const futureYear = String(currentYear + 10);
    const result = validateYear(futureYear);
    expect(result.valid).toBe(true);
  });
});

describe('getCurrentYear', () => {
  it('devuelve año actual como string', () => {
    const result = getCurrentYear();
    const currentYear = String(new Date().getFullYear());
    expect(result).toBe(currentYear);
  });
});
