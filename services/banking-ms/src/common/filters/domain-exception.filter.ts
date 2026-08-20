import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

/**
 * Maps framework-agnostic domain errors to HTTP responses by class-name convention:
 * `*NotFoundError` -> 404, `Invalid*`/`*ValidationError` -> 400,
 * `Duplicate*`/`*ConflictError` -> 409. HttpExceptions pass through untouched.
 */
@Catch()
export class DomainExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(DomainExceptionFilter.name);

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
    if (name.startsWith('Duplicate') || name.endsWith('ConflictError')) {
      response.status(HttpStatus.CONFLICT).json({ code: 'CONFLICT', message });
      return;
    }

    this.logger.error(message, exception instanceof Error ? exception.stack : undefined);
    response
      .status(HttpStatus.INTERNAL_SERVER_ERROR)
      .json({ code: 'INTERNAL', message: 'Internal server error' });
  }
}
