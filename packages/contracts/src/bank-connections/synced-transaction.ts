import { z } from 'zod';
import { moneyAmountSchema } from '../common/money.js';

export const syncedTransactionDirectionSchema = z.enum(['credit', 'debit']);
export type SyncedTransactionDirection = z.infer<typeof syncedTransactionDirectionSchema>;

export const pluggyTransactionStatusSchema = z.enum(['pending', 'posted']);
export type PluggyTransactionStatus = z.infer<typeof pluggyTransactionStatusSchema>;

export const syncStatusSchema = z.enum(['pending', 'processing', 'success', 'error']);
export type SyncStatus = z.infer<typeof syncStatusSchema>;

/** Synced Transaction as exposed by banking-ms (internal detail view — R8). */
export const syncedTransactionSchema = z.object({
  id: z.string().uuid(),
  description: z.string().min(1),
  amount: moneyAmountSchema,
  date: z.string().datetime(),
  direction: syncedTransactionDirectionSchema,
  pluggyStatus: pluggyTransactionStatusSchema,
  installmentNumber: z.number().int().min(1).nullable(),
  installmentTotal: z.number().int().min(1).nullable(),
  syncStatus: syncStatusSchema,
});
export type SyncedTransactionDto = z.infer<typeof syncedTransactionSchema>;
