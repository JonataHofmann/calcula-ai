import type { TransactionType } from '@finance/contracts';

export const CATEGORY_LOOKUP = Symbol('CATEGORY_LOOKUP');
export const ACCOUNT_LOOKUP = Symbol('ACCOUNT_LOOKUP');
export const CARD_LOOKUP = Symbol('CARD_LOOKUP');

/**
 * Read-only cross-module ports (ADR-012). Each resolves an owned reference or null;
 * a null result is treated as "not found" by the use case -> 404 (R9/FR-022).
 */
export interface CategoryLookup {
  /** Returns the category's type if it exists and belongs to the user, else null. */
  findType(id: string, userId: string): Promise<TransactionType | null>;
  /** System catch-all category id for a type (e.g. synced imports with no category), else null. */
  findDefaultId(type: TransactionType): Promise<string | null>;
}

export interface AccountLookup {
  /** True if the account exists and belongs to the user. */
  exists(id: string, userId: string): Promise<boolean>;
}

export interface CardLookup {
  /** True if the credit card exists and belongs to the user. */
  exists(id: string, userId: string): Promise<boolean>;
}
