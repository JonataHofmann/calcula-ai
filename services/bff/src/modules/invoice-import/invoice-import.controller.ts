import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  Logger,
  Post,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type {
  CommitInvoiceInput,
  CommitInvoiceResult,
  InvoiceExtractionResult,
  InvoiceImportProgressEvent,
} from '@finance/contracts';
import type { Request, Response } from 'express';
import { InvoiceImportService } from './invoice-import.service';
import { UpstreamError } from '../../common/upstream-error';
import type { Session } from '../auth/session/session.store';

type SessionRequest = Request & { session?: Session };

function tokenOf(req: SessionRequest): string {
  return (req.session as Session).tokens.accessToken;
}

/** Uploaded PDF as parsed by multer (in-memory buffer). */
interface UploadedPdf {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
}

/** Forwards the invoice PDF + password to ai-ms for extraction. The password is never logged. */
@Controller('invoice-import')
export class InvoiceImportController {
  private readonly logger = new Logger(InvoiceImportController.name);

  constructor(private readonly service: InvoiceImportService) {}

  @Post('extract')
  @UseInterceptors(FileInterceptor('file'))
  extract(
    @Req() req: SessionRequest,
    @UploadedFile() file: UploadedPdf | undefined,
    @Body() body: Record<string, unknown>,
  ): Promise<InvoiceExtractionResult> {
    if (!file) throw new BadRequestException('Arquivo PDF obrigatório');

    const creditCardId = body.creditCardId;
    if (typeof creditCardId !== 'string' || !creditCardId) {
      throw new BadRequestException('creditCardId obrigatório');
    }
    const password =
      typeof body.password === 'string' ? body.password : undefined;

    this.logger.log('POST /invoice-import/extract');
    return this.service.extract(
      tokenOf(req),
      {
        buffer: file.buffer,
        filename: file.originalname,
        mimetype: file.mimetype,
      },
      { creditCardId, password },
    );
  }

  /**
   * Igual a /extract, mas transmite o progresso passo a passo como NDJSON (uma linha JSON
   * por evento). Valida a entrada ANTES do head 200; depois disso, qualquer falha vira um
   * evento `error` (rastreável: mensagem real do microserviço que falhou).
   */
  @Post('extract-stream')
  @UseInterceptors(FileInterceptor('file'))
  async extractStream(
    @Req() req: SessionRequest,
    @UploadedFile() file: UploadedPdf | undefined,
    @Body() body: Record<string, unknown>,
    @Res() res: Response,
  ): Promise<void> {
    if (!file) throw new BadRequestException('Arquivo PDF obrigatório');
    const creditCardId = body.creditCardId;
    if (typeof creditCardId !== 'string' || !creditCardId) {
      throw new BadRequestException('creditCardId obrigatório');
    }
    const password = typeof body.password === 'string' ? body.password : undefined;

    this.logger.log('POST /invoice-import/extract-stream');
    res.writeHead(200, {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders();
    const write = (event: InvoiceImportProgressEvent) => res.write(`${JSON.stringify(event)}\n`);

    try {
      await this.service.extractStream(
        tokenOf(req),
        { buffer: file.buffer, filename: file.originalname, mimetype: file.mimetype },
        { creditCardId, password },
        write,
      );
    } catch (error) {
      const service = error instanceof UpstreamError ? error.service : 'bff';
      const message =
        error instanceof Error ? error.message : 'Falha inesperada na importação';
      this.logger.warn(`extract-stream falhou [${service}]: ${message}`);
      write({ step: 'error', status: 'error', code: service, message });
    } finally {
      res.end();
    }
  }

  @Post('commit')
  commit(
    @Req() req: SessionRequest,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() body: CommitInvoiceInput,
  ): Promise<CommitInvoiceResult> {
    this.logger.log('POST /invoice-import/commit');
    // Ensure the upstream idempotency contract is always satisfied, even if the
    // client omitted the header (a retried commit then still lands on the same key).
    return this.service.commit(tokenOf(req), body, idempotencyKey ?? randomUUID());
  }
}
