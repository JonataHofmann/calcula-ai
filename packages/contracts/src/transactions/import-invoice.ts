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

/** Reviewed line (commit input). `categoryId` required at write; discarded lines are not persisted. */
export const invoiceReviewLineSchema = extractedInvoiceLineSchema.extend({
  categoryId: z.string().uuid(),
  discarded: z.boolean().default(false),
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
