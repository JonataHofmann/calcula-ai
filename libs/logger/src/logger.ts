import { pino } from 'pino';
import type { Logger as PinoLogger } from 'pino';

export type Logger = PinoLogger;

export interface LoggerOptions {
  name: string;
  level?: string;
  /** Fields merged into every log line (e.g. the active request context). */
  mixin?: () => Record<string, unknown>;
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

/**
 * Render mode. Default `pretty` (pino-pretty, human-readable) em TODOS os ambientes,
 * inclusive produção. Defina `LOG_FORMAT=json` para JSON cru (recomendado quando um
 * agregador — Loki, Datadog, etc. — indexa os logs).
 */
const PRETTY = (process.env.LOG_FORMAT ?? 'pretty').toLowerCase() !== 'json';

export function createLogger(options: LoggerOptions): Logger {
  return pino({
    name: options.name,
    level: options.level ?? process.env.LOG_LEVEL ?? 'info',
    redact: { paths: REDACTED_PATHS, censor: '[REDACTED]' },
    // No modo pretty deixamos o nível numérico: o pino-pretty mapeia p/ INFO/WARN/…
    // e colore. No modo json emitimos o rótulo textual, melhor p/ agregadores.
    ...(PRETTY ? {} : { formatters: { level: (label) => ({ level: label }) } }),
    ...(options.mixin ? { mixin: options.mixin } : {}),
    ...(PRETTY
      ? {
          transport: {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'SYS:standard',
              ignore: 'pid,hostname',
            },
          },
        }
      : {}),
  });
}
