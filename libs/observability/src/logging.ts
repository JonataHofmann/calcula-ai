import type { LoggerService } from '@nestjs/common';
import type { Logger } from '@finance/logger';
import { getRequestContext } from './request-context.js';

const REQUEST_ID_HEADER = 'x-request-id';
const CORRELATION_ID_HEADER = 'x-correlation-id';

/**
 * pino `mixin` that stamps the active request context (requestId/correlationId/userId)
 * onto every log line. Returns `{}` outside a request (bootstrap, cron) so the logger
 * still works — those lines simply carry no trace ids.
 */
export function requestContextMixin(): () => Record<string, unknown> {
  return () => {
    const ctx = getRequestContext();
    if (!ctx) return {};
    return {
      requestId: ctx.requestId,
      correlationId: ctx.correlationId,
      ...(ctx.userId ? { userId: ctx.userId } : {}),
    };
  };
}

/**
 * Headers that continue the trace chain on outgoing service-to-service calls.
 * Spread into the fetch/axios headers so the callee reuses the same correlationId.
 * Empty outside a request context.
 */
export function outgoingTraceHeaders(): Record<string, string> {
  const ctx = getRequestContext();
  if (!ctx) return {};
  return {
    [REQUEST_ID_HEADER]: ctx.requestId,
    [CORRELATION_ID_HEADER]: ctx.correlationId,
  };
}

function splitContext(params: unknown[]): { context?: string; extra: unknown[] } {
  if (params.length > 0 && typeof params[params.length - 1] === 'string') {
    return { context: params[params.length - 1] as string, extra: params.slice(0, -1) };
  }
  return { extra: params };
}

function payload(
  message: unknown,
  base: Record<string, unknown>,
): [Record<string, unknown>, string | undefined] {
  if (typeof message === 'string') return [base, message];
  if (message instanceof Error) {
    return [{ ...base, err: message }, message.message];
  }
  if (message && typeof message === 'object') {
    return [{ ...base, ...(message as Record<string, unknown>) }, undefined];
  }
  return [base, String(message)];
}

/**
 * Adapter that routes NestJS's built-in `Logger` through our pino instance, so app
 * logs (`new Logger(Ctx).log(...)`) become structured JSON carrying the request
 * context (via the pino mixin) — unified with the HTTP request/response logs.
 * Wire with `app.useLogger(new PinoNestLogger(logger))` + `NestFactory.create(m, { bufferLogs: true })`.
 */
export class PinoNestLogger implements LoggerService {
  constructor(private readonly logger: Logger) {}

  log(message: unknown, ...params: unknown[]): void {
    this.emit('info', message, params);
  }

  warn(message: unknown, ...params: unknown[]): void {
    this.emit('warn', message, params);
  }

  debug(message: unknown, ...params: unknown[]): void {
    this.emit('debug', message, params);
  }

  verbose(message: unknown, ...params: unknown[]): void {
    this.emit('trace', message, params);
  }

  /** Nest calls this as (message, stack?, context?). */
  error(message: unknown, ...params: unknown[]): void {
    let stack: string | undefined;
    let context: string | undefined;
    if (params.length >= 2) {
      stack = typeof params[0] === 'string' ? params[0] : undefined;
      context = typeof params[1] === 'string' ? params[1] : undefined;
    } else if (params.length === 1 && typeof params[0] === 'string') {
      if (params[0].includes('\n')) stack = params[0];
      else context = params[0];
    }
    const base: Record<string, unknown> = {};
    if (context) base.context = context;
    if (stack) base.stack = stack;
    const [obj, msg] = payload(message, base);
    this.logger.error(obj, msg);
  }

  private emit(level: 'info' | 'warn' | 'debug' | 'trace', message: unknown, params: unknown[]): void {
    const { context, extra } = splitContext(params);
    const base: Record<string, unknown> = {};
    if (context) base.context = context;
    if (extra.length > 0) base.details = extra;
    const [obj, msg] = payload(message, base);
    this.logger[level](obj, msg);
  }
}
