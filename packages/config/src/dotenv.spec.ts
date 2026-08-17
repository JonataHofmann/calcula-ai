import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadDotEnv } from './dotenv.js';

const KEYS = ['DOTENV_TEST_A', 'DOTENV_TEST_B', 'DOTENV_TEST_C'];

afterEach(() => {
  for (const key of KEYS) {
    delete process.env[key];
  }
});

function makeEnvDir(content: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'dotenv-test-'));
  writeFileSync(join(dir, '.env'), content);
  return dir;
}

describe('loadDotEnv', () => {
  it('loads variables from .env found upwards', () => {
    const dir = makeEnvDir('DOTENV_TEST_A=hello\nDOTENV_TEST_B="quoted value"\n');
    const nested = join(dir);
    loadDotEnv(nested);
    expect(process.env.DOTENV_TEST_A).toBe('hello');
    expect(process.env.DOTENV_TEST_B).toBe('quoted value');
  });

  it('does not override already-set variables', () => {
    process.env.DOTENV_TEST_A = 'original';
    const dir = makeEnvDir('DOTENV_TEST_A=from-file\n');
    loadDotEnv(dir);
    expect(process.env.DOTENV_TEST_A).toBe('original');
  });

  it('ignores comments and blank lines', () => {
    const dir = makeEnvDir('# comment\n\nDOTENV_TEST_C=value # inline\n');
    loadDotEnv(dir);
    expect(process.env.DOTENV_TEST_C).toBe('value');
  });

  it('is a no-op when no .env exists', () => {
    expect(() => loadDotEnv('/')).not.toThrow();
  });
});
