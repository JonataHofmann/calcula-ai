import {
  BadRequestException,
  Body,
  Controller,
  Logger,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { z } from 'zod';
import type { InvoiceExtractionResult } from '@finance/contracts';
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
      if (error instanceof InvalidPdfPasswordError) {
        throw new BadRequestException({
          code: 'INVALID_PDF_PASSWORD',
          message: error.message,
        });
      }
      if (error instanceof UnreadablePdfError) {
        throw new BadRequestException({
          code: 'UNREADABLE_PDF',
          message: error.message,
        });
      }
      if (error instanceof InvoiceExtractionError) {
        throw new BadRequestException({
          code: 'EXTRACTION_FAILED',
          message: error.message,
        });
      }
      throw error;
    }
  }
}
