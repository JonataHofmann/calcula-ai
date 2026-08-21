import { describe, expect, it } from 'vitest';
import { createLogger } from './logger.js';

describe('createLogger', () => {
  it('creates named logger', () => {
    const logger = createLogger({ name: 'test' });
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe('function');
  });

  it('respects level option', () => {
    const logger = createLogger({ name: 'test', level: 'error' });
    expect(logger.level).toBe('error');
  });
});
