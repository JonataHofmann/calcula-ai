import { Inject, Injectable } from '@nestjs/common';
import type { GroupScope, UpdateTransactionInput } from '@finance/contracts';
import { Transaction, type UpdateTransactionAttributes } from '../../../domain/transaction';
import {
  TRANSACTION_REPOSITORY,
  type TransactionRepository,
} from '../../../domain/transaction.repository';
import {
  ACCOUNT_LOOKUP,
  CARD_LOOKUP,
  CATEGORY_LOOKUP,
  type AccountLookup,
  type CardLookup,
  type CategoryLookup,
} from '../../../domain/lookups';
import { TransactionNotFoundError } from '../../../domain/errors';
import { validateReferences } from '../../shared/validate-references';

@Injectable()
export class UpdateTransactionUseCase {
  constructor(
    @Inject(TRANSACTION_REPOSITORY) private readonly transactions: TransactionRepository,
    @Inject(CATEGORY_LOOKUP) private readonly categories: CategoryLookup,
    @Inject(ACCOUNT_LOOKUP) private readonly accounts: AccountLookup,
    @Inject(CARD_LOOKUP) private readonly cards: CardLookup,
  ) {}

  /** Applies editable fields to one occurrence or a group scope; paid rows keep effectuation (R3/R6). */
  async execute(
    userId: string,
    id: string,
    input: UpdateTransactionInput,
    scope?: GroupScope,
  ): Promise<Transaction[]> {
    const target = await this.transactions.findById(id, userId);
    if (!target) throw new TransactionNotFoundError(id);

    await validateReferences(
      userId,
      {
        type: input.type ?? target.type,
        categoryId: input.categoryId ?? target.categoryId,
        accountId: input.accountId !== undefined ? input.accountId : target.accountId,
        creditCardId:
          input.creditCardId !== undefined ? input.creditCardId : target.creditCardId,
      },
      { categories: this.categories, accounts: this.accounts, cards: this.cards },
    );

    const patch = toDomainPatch(input);

    if (!target.groupId || !scope || scope === 'one') {
      target.update(patch);
      await this.transactions.save(target);
      return [target];
    }

    const group = await this.transactions.findGroup(target.groupId, userId);
    const targets =
      scope === 'all'
        ? group
        : group.filter((t) => t.dueDate.getTime() >= target.dueDate.getTime());
    for (const t of targets) t.update(patch);
    await this.transactions.saveMany(targets);
    return targets;
  }
}

function toDomainPatch(input: UpdateTransactionInput): Partial<UpdateTransactionAttributes> {
  const patch: Partial<UpdateTransactionAttributes> = {};
  if (input.description !== undefined) patch.description = input.description;
  if (input.dueDate !== undefined) patch.dueDate = new Date(input.dueDate);
  if (input.amount !== undefined) patch.amount = input.amount;
  if (input.type !== undefined) patch.type = input.type;
  if (input.notes !== undefined) patch.notes = input.notes ?? null;
  if (input.categoryId !== undefined) patch.categoryId = input.categoryId;
  if (input.accountId !== undefined) patch.accountId = input.accountId;
  if (input.creditCardId !== undefined) patch.creditCardId = input.creditCardId;
  if (input.endDate !== undefined) patch.endDate = input.endDate ? new Date(input.endDate) : null;
  return patch;
}
