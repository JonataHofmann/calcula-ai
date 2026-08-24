import { randomUUID } from 'node:crypto';
import { getRequestContext, runWithRequestContext } from './request-context.js';

const REQUEST_ID_HEADER = 'x-request-id';
const CORRELATION_ID_HEADER = 'x-correlation-id';

interface MinimalHeaders {
  [key: string]: string | string[] | undefined;
}

interface MinimalRequest {
  method: string;
  originalUrl?: string;
  url: string;
  headers: MinimalHeaders;
}

interface MinimalResponse {
  statusCode: number;
  setHeader(name: string, value: string): void;
  on(event: 'finish', listener: () => void): void;
}

interface RequestLogger {
  info(obj: Record<string, unknown>, msg?: string): void;
  warn(obj: Record<string, unknown>, msg?: string): void;
  error(obj: Record<string, unknown>, msg?: string): void;
}

function headerValue(headers: MinimalHeaders, name: string): string | undefined {
  const value = headers[name];
  return Array.isArray(value) ? value[0] : value;
}

/** Logs one line per request/response pair and binds a requestId/correlationId to the async context for the request's lifetime, so downstream logs can be correlated. */
export function createRequestLoggingMiddleware(logger: RequestLogger) {
  return function requestLoggingMiddleware(
    req: MinimalRequest,
    res: MinimalResponse,
    next: () => void,
  ): void {
    const requestId = headerValue(req.headers, REQUEST_ID_HEADER) ?? randomUUID();
    const correlationId = headerValue(req.headers, CORRELATION_ID_HEADER) ?? requestId;
    const url = req.originalUrl ?? req.url;
    const start = Date.now();

    res.setHeader(REQUEST_ID_HEADER, requestId);

    runWithRequestContext({ requestId, correlationId }, () => {
      logger.info({ requestId, correlationId, method: req.method, url }, 'request received');

      res.on('finish', () => {
        const status = res.statusCode;
        const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';
        logger[level](
          {
            requestId,
            correlationId,
            userId: getRequestContext()?.userId,
            method: req.method,
            url,
            statusCode: status,
            durationMs: Date.now() - start,
          },
          'request completed',
        );
      });

      next();
    });
  };
}
