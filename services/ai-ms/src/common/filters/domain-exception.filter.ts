import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { getRequestContext } from '@finance/observability';
import type { Response } from 'express';

/** Stack só é omitida do RESPONSE se ERROR_EXPOSE_STACK === 'false' (default: expõe). */
const EXPOSE_STACK = process.env.ERROR_EXPOSE_STACK !== 'false';

/**
 * Maps framework-agnostic domain errors to HTTP responses by class-name convention:
 * `*NotFoundError` -> 404, `Invalid*`/`*ValidationError` -> 400,
 * `*ConflictError` -> 409. HttpExceptions pass through untouched.
 *
 * Erros não-mapeados (500) devolvem a MENSAGEM REAL + nome + stack + service +
 * requestId/correlationId — nunca um "Internal server error" nu — para o BFF repassar
 * o erro rastreável ao cliente.
 */
@Catch()
export class DomainExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(DomainExceptionFilter.name);

  constructor(private readonly service = 'ai-ms') {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      response.status(status).json(exception.getResponse());
      return;
    }

    const name = exception instanceof Error ? exception.name : '';
    const message = exception instanceof Error ? exception.message : 'Unexpected error';

    if (name.endsWith('NotFoundError')) {
      response.status(HttpStatus.NOT_FOUND).json({ code: 'NOT_FOUND', message });
      return;
    }
    if (name.startsWith('Invalid') || name.endsWith('ValidationError')) {
      response.status(HttpStatus.BAD_REQUEST).json({ code: 'VALIDATION', message });
      return;
    }
    if (name.endsWith('ConflictError')) {
      response.status(HttpStatus.CONFLICT).json({ code: 'CONFLICT', message });
      return;
    }

    const stack = exception instanceof Error ? exception.stack : undefined;
    this.logger.error(message, stack);
    const ctx = getRequestContext();
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      code: 'INTERNAL',
      error: name || 'UnknownError',
      message,
      service: this.service,
      requestId: ctx?.requestId,
      correlationId: ctx?.correlationId,
      ...(EXPOSE_STACK && stack ? { stack } : {}),
    });
  }
}
