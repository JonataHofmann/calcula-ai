import {
  BadRequestException,
  Body,
  Controller,
  Logger,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { z } from 'zod';
import type {
  InvoiceExtractionResult,
  InvoiceImportProgressEvent,
} from '@finance/contracts';
import {
  InvoiceExtractionError,
  InvoiceImportService,
} from './invoice-import.service';
import {
  InvalidPdfPasswordError,
  UnreadablePdfError,
} from './pdf-reader';

/** Categories the AI may assign, forwarded by the BFF as a JSON string field. */
const categoriesFieldSchema = z
  .array(z.object({ id: z.string(), name: z.string() }))
  .default([]);

const extractBodySchema = z.object({
  creditCardId: z.string().uuid('creditCardId inválido'),
  password: z.string().min(1).max(256).optional(),
  // Multipart fields arrive as strings; `categories` is a JSON-encoded array.
  categories: z
    .string()
    .optional()
    .transform((raw, ctx) => {
      if (raw === undefined) return [];
      try {
        return categoriesFieldSchema.parse(JSON.parse(raw));
      } catch {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'categories inválido' });
        return z.NEVER;
      }
    }),
});

interface UploadedPdf {
  buffer: Buffer;
  mimetype: string;
  size: number;
  originalname: string;
}

/**
 * Extracts transactions from an uploaded (optionally password-protected) PDF
 * invoice via AI. Stateless: nothing is persisted, password is never logged.
 */
@Controller('invoice-extract')
export class InvoiceImportController {
  private readonly logger = new Logger(InvoiceImportController.name);

  constructor(private readonly service: InvoiceImportService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async extract(
    @UploadedFile() file: UploadedPdf | undefined,
    @Body() body: Record<string, unknown>,
  ): Promise<InvoiceExtractionResult> {
    if (!file) {
      throw new BadRequestException({
        code: 'VALIDATION',
        message: 'Arquivo PDF é obrigatório',
      });
    }
    if (file.mimetype !== 'application/pdf') {
      throw new BadRequestException({
        code: 'VALIDATION',
        message: 'Arquivo deve ser um PDF',
      });
    }

    const parsed = extractBodySchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'VALIDATION',
        message: parsed.error.issues
          .map((i) => `${i.path.join('.')}: ${i.message}`)
          .join('; '),
      });
    }

    this.logger.log(
      `POST /invoice-extract file=${file.originalname} size=${file.size}`,
    );

    try {
      return await this.service.extract(
        file.buffer,
        parsed.data.password,
        parsed.data.categories,
      );
    } catch (error) {
      const mapped = mapExtractError(error);
      if (mapped) throw new BadRequestException(mapped);
      throw error;
    }
  }

  /**
   * Igual ao POST /invoice-extract, mas transmite o progresso passo a passo como NDJSON
   * (uma linha JSON por evento) enquanto extrai. Após o head 200 os erros viram um evento
   * `error` (não dá pra trocar o status), então a validação de entrada acontece ANTES.
   */
  @Post('stream')
  @UseInterceptors(FileInterceptor('file'))
  async extractStream(
    @UploadedFile() file: UploadedPdf | undefined,
    @Body() body: Record<string, unknown>,
    @Res() res: Response,
  ): Promise<void> {
    if (!file) {
      throw new BadRequestException({ code: 'VALIDATION', message: 'Arquivo PDF é obrigatório' });
    }
    if (file.mimetype !== 'application/pdf') {
      throw new BadRequestException({ code: 'VALIDATION', message: 'Arquivo deve ser um PDF' });
    }
    const parsed = extractBodySchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'VALIDATION',
        message: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
      });
    }

    this.logger.log(`POST /invoice-extract/stream file=${file.originalname} size=${file.size}`);
    startNdjson(res);
    const write = (event: InvoiceImportProgressEvent) => writeEvent(res, event);

    try {
      const result = await this.service.extract(
        file.buffer,
        parsed.data.password,
        parsed.data.categories,
        write,
      );
      write({ step: 'done', status: 'done', message: 'Extração concluída', result });
    } catch (error) {
      const mapped = mapExtractError(error);
      write({
        step: 'error',
        status: 'error',
        code: mapped?.code ?? 'INTERNAL',
        message: mapped?.message ?? 'Falha inesperada na extração',
      });
      if (!mapped) {
        this.logger.error(
          error instanceof Error ? error.message : String(error),
          error instanceof Error ? error.stack : undefined,
        );
      }
    } finally {
      res.end();
    }
  }
}

/** Cabeçalhos de um stream NDJSON sem buffering (X-Accel-Buffering desliga o nginx). */
function startNdjson(res: Response): void {
  res.writeHead(200, {
    'Content-Type': 'application/x-ndjson; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();
}

/** Escreve um evento como uma linha JSON e faz flush imediato. */
function writeEvent(res: Response, event: InvoiceImportProgressEvent): void {
  res.write(`${JSON.stringify(event)}\n`);
}

/** Mapeia os erros de extração conhecidos para {code, message}; null = desconhecido (500). */
function mapExtractError(error: unknown): { code: string; message: string } | null {
  if (error instanceof InvalidPdfPasswordError) {
    return { code: 'INVALID_PDF_PASSWORD', message: error.message };
  }
  if (error instanceof UnreadablePdfError) {
    return { code: 'UNREADABLE_PDF', message: error.message };
  }
  if (error instanceof InvoiceExtractionError) {
    return { code: 'EXTRACTION_FAILED', message: error.message };
  }
  return null;
}
