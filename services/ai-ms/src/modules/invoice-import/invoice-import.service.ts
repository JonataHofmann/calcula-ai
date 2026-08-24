import { Inject, Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import {
  invoiceExtractionResultSchema,
  type InvoiceExtractionResult,
} from '@finance/contracts';
import type { AIProvider } from '../../common/ai-provider';
import { AI_PROVIDER } from '../../common/ai-provider.token';
import { readPdfText } from './pdf-reader';
import {
  EXTRACTION_MODEL,
  buildExtractionMessages,
  buildRetryMessage,
  parseModelExtraction,
  type InvoiceCategoryOption,
  type ModelInvoiceExtraction,
} from './invoice-extraction.prompt';

/** The model output could not be parsed/validated even after one corrective retry. */
export class InvoiceExtractionError extends Error {
  constructor(message = 'Não foi possível extrair transações da fatura') {
    super(message);
    this.name = 'InvoiceExtractionError';
  }
}

@Injectable()
export class InvoiceImportService {
  private readonly logger = new Logger(InvoiceImportService.name);

  constructor(@Inject(AI_PROVIDER) private readonly ai: AIProvider) {}

  /**
   * Reads the PDF (decrypting with `password`), extracts transactions via the AI
   * provider and returns the validated extraction. The AI also suggests a
   * category per line, chosen from `categories`; ids outside that set are dropped
   * to null (the BFF fills the remaining nulls from history). The password is
   * never logged nor retained beyond this call.
   */
  async extract(
    fileBuffer: Buffer,
    password: string | undefined,
    categories: InvoiceCategoryOption[] = [],
  ): Promise<InvoiceExtractionResult> {
    const pdfText = await readPdfText(fileBuffer, password);

    const messages = buildExtractionMessages(pdfText, categories);
    let parsed: ModelInvoiceExtraction;

    const first = await this.ai.generate({
      messages,
      model: EXTRACTION_MODEL,
      temperature: 0,
    });

    try {
      parsed = parseModelExtraction(first.content);
    } catch (firstError) {
      const summary =
        firstError instanceof Error ? firstError.message : 'formato inesperado';
      this.logger.warn(`Extraction JSON invalid, retrying once: ${summary}`);
      const retry = await this.ai.generate({
        messages: [
          ...messages,
          { role: 'assistant', content: first.content },
          buildRetryMessage(summary),
        ],
        model: EXTRACTION_MODEL,
        temperature: 0,
      });
      try {
        parsed = parseModelExtraction(retry.content);
      } catch {
        throw new InvoiceExtractionError();
      }
    }

    const allowedCategoryIds = new Set(categories.map((c) => c.id));
    const result: InvoiceExtractionResult = {
      referenceMonth: parsed.referenceMonth,
      dueDate: parsed.dueDate,
      total: parsed.total,
      lines: parsed.lines.map((line) => ({
        lineId: uuidv4(),
        date: line.date,
        description: line.description,
        amount: line.amount,
        installmentNumber: line.installmentNumber,
        installmentCount: line.installmentCount,
        uncertain: line.uncertain,
        // Trust the model's pick only when it names a real category.
        suggestedCategoryId:
          line.categoryId && allowedCategoryIds.has(line.categoryId)
            ? line.categoryId
            : null,
      })),
    };

    const validated = invoiceExtractionResultSchema.safeParse(result);
    if (!validated.success) {
      this.logger.warn(
        `Extraction failed contract validation: ${validated.error.issues
          .map((i) => `${i.path.join('.')}: ${i.message}`)
          .join('; ')}`,
      );
      throw new InvoiceExtractionError();
    }

    this.logger.log(
      `Extracted ${validated.data.lines.length} line(s), referenceMonth=${validated.data.referenceMonth}`,
    );
    return validated.data;
  }
}
