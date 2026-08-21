import { z } from 'zod';
import { createAccountInput } from '@finance/contracts';

/**
 * Deliberately NOT exported from `@finance/contracts` — this route never appears in the
 * Accounts module's public API used by BFF/web, only banking-ms calls it (mirrors
 * `import-synced-transaction.schemas.ts`).
 */
export const createSyncedAccountInput = z.object({ userId: z.string().uuid() }).merge(createAccountInput);
export type CreateSyncedAccountInput = z.infer<typeof createSyncedAccountInput>;
