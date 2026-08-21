import { z } from 'zod';
import { moneyAmountSchema } from '../common/money.js';

export const syncedTransactionDirectionSchema = z.enum(['credit', 'debit']);
export type SyncedTransactionDirection = z.infer<typeof syncedTransactionDirectionSchema>;

export const pluggyTransactionStatusSchema = z.enum(['pending', 'posted']);
export type PluggyTransactionStatus = z.infer<typeof pluggyTransactionStatusSchema>;

export const syncStatusSchema = z.enum(['pending', 'processing', 'success', 'error']);
export type SyncStatus = z.infer<typeof syncStatusSchema>;

/**
 * Synced Transaction as exposed by banking-ms (internal detail/list view — R8).
 * Carries the full import audit trail so callers can see, per row, whether the
 * import succeeded (`syncStatus: 'success'` + `transactionsMsId`), failed
 * (`syncStatus: 'error'` + `lastError` + `retryCount`), or is still `pending`/`processing`.
 */
export const syncedTransactionSchema = z.object({
  id: z.string().uuid(),
  pluggyTransactionId: z.string().min(1),
  linkedAccountId: z.string().uuid().nullable(),
  linkedCreditCardId: z.string().uuid().nullable(),
  description: z.string().min(1),
  amount: moneyAmountSchema,
  date: z.string().datetime(),
  direction: syncedTransactionDirectionSchema,
  pluggyStatus: pluggyTransactionStatusSchema,
  installmentNumber: z.number().int().min(1).nullable(),
  installmentTotal: z.number().int().min(1).nullable(),
  syncStatus: syncStatusSchema,
  transactionsMsId: z.string().uuid().nullable(),
  retryCount: z.number().int().min(0),
  lastError: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type SyncedTransactionDto = z.infer<typeof syncedTransactionSchema>;

/** Query filter for `GET /synced-transactions` — optionally narrow to one sync status. */
export const listSyncedTransactionsQuery = z.object({
  status: syncStatusSchema.optional(),
});
export type ListSyncedTransactionsQuery = z.infer<typeof listSyncedTransactionsQuery>;
