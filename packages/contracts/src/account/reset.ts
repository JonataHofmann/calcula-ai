import { z } from 'zod';

/**
 * Row counts deleted by a full "reset my data" wipe. System categories (ownerId null)
 * and the user's login/Keycloak account are never touched — only user-scoped financial data.
 */
export const resetResultSchema = z.object({
  transactions: z.number().int().nonnegative(),
  accounts: z.number().int().nonnegative(),
  creditCards: z.number().int().nonnegative(),
  categories: z.number().int().nonnegative(),
  categoryOverrides: z.number().int().nonnegative(),
  hiddenCategories: z.number().int().nonnegative(),
});

export type ResetResult = z.infer<typeof resetResultSchema>;
