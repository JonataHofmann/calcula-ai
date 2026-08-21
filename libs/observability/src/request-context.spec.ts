import { describe, expect, it } from 'vitest';
import { getRequestContext, runWithRequestContext } from './request-context.js';

describe('request context', () => {
  it('provides context inside run scope', () => {
    runWithRequestContext({ requestId: 'req-1', userId: 'user-1' }, () => {
      const ctx = getRequestContext();
      expect(ctx?.requestId).toBe('req-1');
      expect(ctx?.userId).toBe('user-1');
    });
  });

  it('generates requestId when absent', () => {
    runWithRequestContext({}, () => {
      expect(getRequestContext()?.requestId).toBeTruthy();
    });
  });

  it('returns undefined outside scope', () => {
    expect(getRequestContext()).toBeUndefined();
  });
});
