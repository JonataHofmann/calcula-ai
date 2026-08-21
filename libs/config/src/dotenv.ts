import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const LINE_RE = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/;

function parseValue(raw: string): string {
  const trimmed = raw.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  const commentIndex = trimmed.indexOf(' #');
  return commentIndex >= 0 ? trimmed.slice(0, commentIndex).trim() : trimmed;
}

function findEnvFile(startDir: string): string | null {
  let dir = startDir;
  for (;;) {
    const candidate = join(dir, '.env');
    if (existsSync(candidate)) {
      return candidate;
    }
    const parent = dirname(dir);
    if (parent === dir) {
      return null;
    }
    dir = parent;
  }
}

export function loadDotEnv(startDir: string = process.cwd()): void {
  const file = findEnvFile(startDir);
  if (!file) {
    return;
  }
  const content = readFileSync(file, 'utf8');
  for (const line of content.split('\n')) {
    if (!line || line.trimStart().startsWith('#')) {
      continue;
    }
    const match = LINE_RE.exec(line);
    if (!match) {
      continue;
    }
    const [, key, rawValue] = match;
    if (key && process.env[key] === undefined) {
      process.env[key] = parseValue(rawValue ?? '');
    }
  }
}
