import { describe, expect, it } from 'vitest';
import { moneySchema } from './money.js';

describe('moneySchema', () => {
  it('accepts decimal string with two fraction digits', () => {
    expect(moneySchema.parse({ amount: '1500.00', currency: 'BRL' })).toEqual({
      amount: '1500.00',
      currency: 'BRL',
    });
  });

  it('accepts negative amounts', () => {
    expect(moneySchema.parse({ amount: '-30.50', currency: 'BRL' }).amount).toBe('-30.50');
  });

  it('rejects float-like values', () => {
    expect(() => moneySchema.parse({ amount: 1500.0, currency: 'BRL' })).toThrow();
  });

  it('rejects wrong precision', () => {
    expect(() => moneySchema.parse({ amount: '1500.0', currency: 'BRL' })).toThrow();
  });

  it('rejects unsupported currency', () => {
    expect(() => moneySchema.parse({ amount: '10.00', currency: 'USD' })).toThrow();
  });
});
