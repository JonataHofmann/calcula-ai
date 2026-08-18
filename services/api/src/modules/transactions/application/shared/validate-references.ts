import type { TransactionType } from '@finance/contracts';
import type { AccountLookup, CardLookup, CategoryLookup } from '../../domain/lookups';
import { InvalidTransactionError, ReferenceNotFoundError } from '../../domain/errors';

export interface ReferenceInput {
  type: TransactionType;
  categoryId: string;
  accountId?: string | null;
  creditCardId?: string | null;
}

/**
 * Cross-module validation via lookup ports (ADR-012): category/account/card must exist,
 * belong to the user (else 404), and the category type must match the transaction type.
 */
export async function validateReferences(
  userId: string,
  input: ReferenceInput,
  lookups: { categories: CategoryLookup; accounts: AccountLookup; cards: CardLookup },
): Promise<void> {
  const categoryType = await lookups.categories.findType(input.categoryId, userId);
  if (categoryType === null) throw new ReferenceNotFoundError('category', input.categoryId);
  if (categoryType !== input.type) {
    throw new InvalidTransactionError('Category type does not match transaction type');
  }

  if (input.accountId) {
    const ok = await lookups.accounts.exists(input.accountId, userId);
    if (!ok) throw new ReferenceNotFoundError('account', input.accountId);
  }
  if (input.creditCardId) {
    const ok = await lookups.cards.exists(input.creditCardId, userId);
    if (!ok) throw new ReferenceNotFoundError('card', input.creditCardId);
  }
}
