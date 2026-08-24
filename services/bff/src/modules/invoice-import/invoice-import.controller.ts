import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  Logger,
  Post,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type {
  CommitInvoiceInput,
  CommitInvoiceResult,
  InvoiceExtractionResult,
} from '@finance/contracts';
import type { Request } from 'express';
import { InvoiceImportService } from './invoice-import.service';
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
