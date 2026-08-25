import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { getRequestContext } from '@finance/observability';
import type { Request, Response } from 'express';
import { UpstreamError } from './upstream-error';

/** Stack só é omitida do RESPONSE se ERROR_EXPOSE_STACK === 'false' (default: expõe). */
const EXPOSE_STACK = process.env.ERROR_EXPOSE_STACK !== 'false';

interface ErrorBody {
  statusCode: number;
  error: string;
  message: string;
  /** Microserviço de origem, quando o erro veio de um upstream. */
  service?: string;
  /** Status/corpo originais do upstream (api-ms/ai-ms/banking-ms). */
  upstream?: { status?: number; body?: unknown };
  requestId?: string;
  correlationId?: string;
  path: string;
  method: string;
  timestamp: string;
  /** Stack completa (BFF ou causa upstream), a menos que desabilitada por env. */
  stack?: string;
}

/**
 * Filtro global do BFF. Garante que TODA resposta de erro seja rastreável — nunca um
 * "Internal Server Error" nu. Expõe qual microserviço falhou (service), o status/corpo
 * do upstream, requestId/correlationId e a stack. Loga o detalhe completo via Nest Logger
 * (roteado para o pino, que carimba os IDs de contexto).
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const res = http.getResponse<Response>();
    const req = http.getRequest<Request>();
    const ctx = getRequestContext();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const { message, error } = this.describe(exception, status);

    const body: ErrorBody = {
      statusCode: status,
      error,
      message,
      path: req.originalUrl,
      method: req.method,
      timestamp: new Date().toISOString(),
      requestId: ctx?.requestId,
      correlationId: ctx?.correlationId,
    };

    if (exception instanceof UpstreamError) {
      body.service = exception.service;
      body.upstream = { status: exception.upstreamStatus, body: exception.upstreamBody };
    }

    // Stack: da causa upstream (falha de rede real) se houver, senão da própria exceção.
    const stackSource =
      exception instanceof UpstreamError && exception.upstreamCause instanceof Error
        ? exception.upstreamCause
        : exception;
    const stack = stackSource instanceof Error ? stackSource.stack : undefined;
    if (EXPOSE_STACK && stack) {
      body.stack = stack;
    }

    // Log server-side SEMPRE com stack completa (independe de EXPOSE_STACK).
    const logLine = `${req.method} ${req.originalUrl} -> ${status}${
      body.service ? ` [${body.service}]` : ''
    } ${message}`;
    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(logLine, stack, 'ExceptionFilter');
    } else {
      this.logger.warn(logLine, 'ExceptionFilter');
    }

    res.status(status).json(body);
  }

  /** Extrai `message` + rótulo `error` de qualquer exceção. */
  private describe(exception: unknown, status: number): { message: string; error: string } {
    if (exception instanceof HttpException) {
      const resp = exception.getResponse();
      if (typeof resp === 'string') {
        return { message: resp, error: exception.name };
      }
      const obj = resp as { message?: unknown; error?: unknown };
      const message = Array.isArray(obj.message)
        ? obj.message.join('; ')
        : typeof obj.message === 'string'
          ? obj.message
          : exception.message;
      const error = typeof obj.error === 'string' ? obj.error : exception.name;
      return { message, error };
    }
    if (exception instanceof Error) {
      return { message: exception.message, error: exception.name };
    }
    return { message: String(exception), error: 'UnknownError' };
  }
}
