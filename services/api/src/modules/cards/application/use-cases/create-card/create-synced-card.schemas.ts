import { z } from 'zod';
import { createCreditCardInput } from '@finance/contracts';

/**
 * Deliberately NOT exported from `@finance/contracts` — this route never appears in the
 * Cards module's public API used by BFF/web, only banking-ms calls it (mirrors
 * `import-synced-transaction.schemas.ts`).
 */
export const createSyncedCardInput = z.object({ userId: z.string().uuid() }).merge(createCreditCardInput);
export type CreateSyncedCardInput = z.infer<typeof createSyncedCardInput>;
