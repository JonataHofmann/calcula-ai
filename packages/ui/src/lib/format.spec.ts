import { describe, expect, it } from 'vitest';
import { formatBRL, formatPercent } from './format.js';

describe('formatBRL', () => {
  it('formats a simple value', () => {
    expect(formatBRL('1500.00')).toBe('R$ 1.500,00');
  });

  it('formats a negative value', () => {
    expect(formatBRL('-89.90')).toBe('-R$ 89,90');
  });

  it('formats zero', () => {
    expect(formatBRL('0.00')).toBe('R$ 0,00');
  });

  it('formats millions without precision loss', () => {
    expect(formatBRL('1234567.89')).toBe('R$ 1.234.567,89');
  });

  it('formats values beyond Number.MAX_SAFE_INTEGER', () => {
    expect(formatBRL('9007199254740993.10')).toBe('R$ 9.007.199.254.740.993,10');
  });

  it('pads single fraction digit', () => {
    expect(formatBRL('10.5')).toBe('R$ 10,50');
  });

  it('formats integer strings', () => {
    expect(formatBRL('42')).toBe('R$ 42,00');
  });

  it('throws on invalid string', () => {
    expect(() => formatBRL('abc')).toThrow();
    expect(() => formatBRL('1,50')).toThrow();
    expect(() => formatBRL('1.234')).toThrow();
    expect(() => formatBRL('')).toThrow();
  });
});

describe('formatPercent', () => {
  it('formats a simple percent', () => {
    expect(formatPercent('12.5')).toBe('12,5%');
  });

  it('adds plus sign when signed', () => {
    expect(formatPercent('12.5', true)).toBe('+12,5%');
  });

  it('keeps minus for negatives', () => {
    expect(formatPercent('-3.2')).toBe('-3,2%');
    expect(formatPercent('-3.2', true)).toBe('-3,2%');
  });

  it('formats integers', () => {
    expect(formatPercent('100')).toBe('100%');
  });

  it('throws on invalid string', () => {
    expect(() => formatPercent('abc')).toThrow();
    expect(() => formatPercent('')).toThrow();
  });
});
