import { pino } from 'pino';
import type { Logger as PinoLogger } from 'pino';

export type Logger = PinoLogger;

export interface LoggerOptions {
  name: string;
  level?: string;
}

const REDACTED_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'password',
  'token',
  'apiKey',
  'secret',
  '*.password',
  '*.token',
  '*.apiKey',
  '*.secret',
];

export function createLogger(options: LoggerOptions): Logger {
  return pino({
    name: options.name,
    level: options.level ?? process.env.LOG_LEVEL ?? 'info',
    redact: { paths: REDACTED_PATHS, censor: '[REDACTED]' },
    formatters: {
      level: (label) => ({ level: label }),
    },
  });
}
