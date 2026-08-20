import { z } from 'zod';
import { moneyAmountSchema } from '@finance/contracts';

/**
 * Service-to-service schemas for `POST/PATCH/DELETE /transactions/synced-import*`
 * (banking-ms -> Transactions MS only). Deliberately NOT exported from
 * `@finance/contracts` — these routes never appear in the Transactions MS's
 * public API used by BFF/web (transactions-import-api.md, "Regra transversal").
 */

export const pluggyStatusSchema = z.enum(['pending', 'posted']);

/** userId travels explicitly in the body for patch/delete too — service-account callers have no user JWT (R5). */
export const userIdSchema = z.string().uuid();

export const importSyncedTransactionInput = z.object({
  userId: z.string().uuid(),
  description: z.string().trim().min(1).max(120),
  amount: moneyAmountSchema,
  dueDate: z.string().datetime(),
  type: z.enum(['expense', 'income']),
  /** Omitted when banking-ms has no matching category — defaults to the type's "Outros" system category. */
  categoryId: z.string().uuid().optional(),
  accountId: z.string().uuid().nullable(),
  creditCardId: z.string().uuid().nullable(),
  source: z.literal('synced'),
  externalId: z.string().uuid(),
  pluggyStatus: pluggyStatusSchema,
  installmentNumber: z.number().int().min(1).nullable().optional(),
  installmentCount: z.number().int().min(1).nullable().optional(),
});
export type ImportSyncedTransactionInput = z.infer<typeof importSyncedTransactionInput>;

export const patchSyncedTransactionInput = z
  .object({
    description: z.string().trim().min(1).max(120),
    amount: moneyAmountSchema,
    dueDate: z.string().datetime(),
    pluggyStatus: pluggyStatusSchema,
    installmentNumber: z.number().int().min(1).nullable(),
    installmentCount: z.number().int().min(1).nullable(),
  })
  .partial();
export type PatchSyncedTransactionInput = z.infer<typeof patchSyncedTransactionInput>;

export interface SyncedImportResult {
  id: string;
  source: 'synced';
  externalId: string;
  pluggyStatus: z.infer<typeof pluggyStatusSchema>;
}
