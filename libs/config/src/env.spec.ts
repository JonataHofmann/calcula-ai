import { describe, expect, it } from 'vitest';
import { loadEnv } from './env.js';

describe('loadEnv', () => {
  it('defaults NODE_ENV to development', () => {
    const env = loadEnv({});
    expect(env.NODE_ENV).toBe('development');
  });

  it('rejects invalid DATABASE_URL', () => {
    expect(() => loadEnv({ DATABASE_URL: 'not-a-url' })).toThrow(/DATABASE_URL/);
  });

  it('treats empty strings as unset', () => {
    const env = loadEnv({ AI_ROUTER_URL: '', KEYCLOAK_CLIENT_SECRET: '' });
    expect(env.AI_ROUTER_URL).toBeUndefined();
    expect(env.KEYCLOAK_CLIENT_SECRET).toBeUndefined();
  });

  it('accepts valid values', () => {
    const env = loadEnv({
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://finance:finance@localhost:5432/finance',
    });
    expect(env.NODE_ENV).toBe('test');
    expect(env.DATABASE_URL).toContain('postgresql://');
  });

  it('rejects SESSION_SECRET shorter than 32 chars', () => {
    expect(() => loadEnv({ SESSION_SECRET: 'short' })).toThrow(/SESSION_SECRET/);
  });

  it('accepts SESSION_SECRET with 32+ chars', () => {
    const env = loadEnv({ SESSION_SECRET: 'a'.repeat(32) });
    expect(env.SESSION_SECRET).toHaveLength(32);
  });

  it('rejects invalid BFF_PUBLIC_URL, WEB_URL and NEXT_PUBLIC_BFF_URL', () => {
    expect(() => loadEnv({ BFF_PUBLIC_URL: 'nope' })).toThrow(/BFF_PUBLIC_URL/);
    expect(() => loadEnv({ WEB_URL: 'nope' })).toThrow(/WEB_URL/);
    expect(() => loadEnv({ NEXT_PUBLIC_BFF_URL: 'nope' })).toThrow(/NEXT_PUBLIC_BFF_URL/);
  });

  it('accepts valid auth URLs', () => {
    const env = loadEnv({
      BFF_PUBLIC_URL: 'http://localhost:3002',
      WEB_URL: 'http://localhost:3000',
      NEXT_PUBLIC_BFF_URL: 'http://localhost:3002',
    });
    expect(env.BFF_PUBLIC_URL).toBe('http://localhost:3002');
    expect(env.WEB_URL).toBe('http://localhost:3000');
    expect(env.NEXT_PUBLIC_BFF_URL).toBe('http://localhost:3002');
  });
});
