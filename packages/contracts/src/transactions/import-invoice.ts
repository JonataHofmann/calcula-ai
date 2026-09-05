import { z } from 'zod';
import { moneyAmountSchema } from '../common/money.js';

/** Reference month of an invoice: "YYYY-MM". */
export const referenceMonthSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Mês de referência deve ser YYYY-MM');
export type ReferenceMonth = z.infer<typeof referenceMonthSchema>;

/**
 * Extracted invoice line (ai-ms -> review). Money is a decimal string and MAY be
 * negative (estorno/crédito). `suggestedCategoryId` is filled by the BFF after extraction.
 */
export const extractedInvoiceLineSchema = z.object({
  lineId: z.string().uuid(),
  date: z.string().datetime(),
  description: z.string().min(1).max(120),
  amount: moneyAmountSchema,
  installmentNumber: z.number().int().positive().nullable(),
  installmentCount: z.number().int().positive().nullable(),
  uncertain: z.boolean(),
  suggestedCategoryId: z.string().uuid().nullable(),
});
export type ExtractedInvoiceLine = z.infer<typeof extractedInvoiceLineSchema>;

/**
 * Extraction result (ai-ms -> bff). The AI fills each line's `suggestedCategoryId`
 * (chosen from the user's categories); the BFF fills any it left null from history.
 * `total` is the invoice grand total ("Total da fatura"), or null if not found.
 */
export const invoiceExtractionResultSchema = z.object({
  referenceMonth: referenceMonthSchema,
  dueDate: z.string().datetime().nullable(),
  total: moneyAmountSchema.nullable(),
  lines: z.array(extractedInvoiceLineSchema),
});
export type InvoiceExtractionResult = z.infer<
  typeof invoiceExtractionResultSchema
>;

/**
 * Passos do fluxo de importação de fatura, emitidos em tempo real (NDJSON) do
 * ai-ms/bff para o web. Ordem lógica: uploading -> loading_categories -> reading_pdf
 * -> extracting_ai -> processing -> categorizing -> done. `error` encerra o fluxo.
 */
export const invoiceImportStepSchema = z.enum([
  'uploading',
  'loading_categories',
  'reading_pdf',
  'extracting_ai',
  'processing',
  'categorizing',
  'done',
  'error',
]);
export type InvoiceImportStep = z.infer<typeof invoiceImportStepSchema>;

/**
 * Um evento de progresso do stream de importação. `result` só vem no evento terminal
 * `done`; `code` só em `error`. `status` marca início/fim/erro de cada passo.
 */
export const invoiceImportProgressEventSchema = z.object({
  step: invoiceImportStepSchema,
  status: z.enum(['start', 'done', 'error']),
  message: z.string(),
  result: invoiceExtractionResultSchema.optional(),
  code: z.string().optional(),
});
export type InvoiceImportProgressEvent = z.infer<
  typeof invoiceImportProgressEventSchema
>;

/**
 * Reviewed line (commit input). `categoryId` required at write; discarded lines are not
 * persisted. `description` may have been edited by the user; `originalDescription` carries
 * the raw AI-extracted text so category matching (find similar transactions) stays anchored
 * to the merchant string, not the human-friendly label.
 */
export const invoiceReviewLineSchema = extractedInvoiceLineSchema.extend({
  categoryId: z.string().uuid(),
  discarded: z.boolean().default(false),
  originalDescription: z.string().min(1).max(120).optional(),
  /** Optional free note the user adds during review; persisted on the transaction. */
  notes: z.string().trim().max(2000).nullish(),
  /**
   * User-flagged as a recurring fixed expense (e.g. streaming). When true the line is
   * imported as a single `fixed` transaction (no end date), overriding any installment info.
   */
  fixed: z.boolean().default(false),
});
export type InvoiceReviewLine = z.infer<typeof invoiceReviewLineSchema>;

/** Commit body (bff -> api). NO userId — it comes from the JWT in the api. */
export const commitInvoiceInputSchema = z.object({
  creditCardId: z.string().uuid(),
  referenceMonth: referenceMonthSchema,
  mode: z.enum(['replace', 'merge']),
  lines: z.array(invoiceReviewLineSchema).min(1),
});
export type CommitInvoiceInput = z.infer<typeof commitInvoiceInputSchema>;

/** Commit summary (api -> bff -> web). */
export const commitInvoiceResultSchema = z.object({
  added: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
  removed: z.number().int().nonnegative(),
});
export type CommitInvoiceResult = z.infer<typeof commitInvoiceResultSchema>;

/**
 * Category suggestion by history (api read). For each description, the categoryId of the
 * user's most recent expense with the same normalized description, or null.
 */
export const categorySuggestionResultSchema = z.array(
  z.object({
    description: z.string(),
    categoryId: z.string().uuid().nullable(),
  }),
);
export type CategorySuggestionResult = z.infer<
  typeof categorySuggestionResultSchema
>;
