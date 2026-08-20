import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { Transaction } from '../../../domain/transaction';
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
import {
  ReferenceNotFoundError,
  SyncedImportConflictError,
  TransactionNotFoundError,
} from '../../../domain/errors';
import { validateReferences } from '../../shared/validate-references';
import type {
  ImportSyncedTransactionInput,
  PatchSyncedTransactionInput,
  SyncedImportResult,
} from './import-synced-transaction.schemas';

/**
 * `POST/PATCH/DELETE /transactions/synced-import*` (T018, T038).
 * `create()` is idempotent by `externalId`: a replay with the same body
 * returns the existing result untouched; a replay with a different body
 * throws `SyncedImportConflictError` (409). `pluggyStatus` is excluded from
 * the comparison since it isn't persisted on `Transaction` — it has its own
 * `patch()` path for legitimate status transitions.
 */
@Injectable()
export class ImportSyncedTransactionUseCase {
  constructor(
    @Inject(TRANSACTION_REPOSITORY) private readonly transactions: TransactionRepository,
    @Inject(CATEGORY_LOOKUP) private readonly categories: CategoryLookup,
    @Inject(ACCOUNT_LOOKUP) private readonly accounts: AccountLookup,
    @Inject(CARD_LOOKUP) private readonly cards: CardLookup,
  ) {}

  async create(input: ImportSyncedTransactionInput): Promise<SyncedImportResult> {
    const existing = await this.transactions.findByExternalId(input.externalId, input.userId);
    if (existing) {
      if (!matchesInput(existing, input)) throw new SyncedImportConflictError(input.externalId);
      return toResult(existing, input.pluggyStatus);
    }

    const categoryId = input.categoryId ?? (await this.categories.findDefaultId(input.type));
    if (!categoryId) throw new ReferenceNotFoundError('category', 'default');

    await validateReferences(
      input.userId,
      {
        type: input.type,
        categoryId,
        accountId: input.accountId,
        creditCardId: input.creditCardId,
      },
      { categories: this.categories, accounts: this.accounts, cards: this.cards },
    );

    const transaction = Transaction.create({
      id: randomUUID(),
      userId: input.userId,
      description: input.description,
      dueDate: new Date(input.dueDate),
      amount: input.amount,
      recurrence: 'single',
      type: input.type,
      categoryId,
      accountId: input.accountId,
      creditCardId: input.creditCardId,
      source: 'synced',
      externalId: input.externalId,
      installmentNumber: input.installmentNumber ?? null,
      installmentCount: input.installmentCount ?? null,
    });
    await this.transactions.create(transaction);
    return toResult(transaction, input.pluggyStatus);
  }

  async patch(
    userId: string,
    externalId: string,
    patch: PatchSyncedTransactionInput,
  ): Promise<SyncedImportResult> {
    const transaction = await this.transactions.findByExternalId(externalId, userId);
    if (!transaction) throw new TransactionNotFoundError(externalId);

    transaction.update({
      description: patch.description,
      amount: patch.amount,
      dueDate: patch.dueDate ? new Date(patch.dueDate) : undefined,
      installmentNumber: patch.installmentNumber,
      installmentCount: patch.installmentCount,
    });
    await this.transactions.save(transaction);
    return toResult(transaction, patch.pluggyStatus ?? 'posted');
  }

  async delete(userId: string, externalId: string): Promise<void> {
    const transaction = await this.transactions.findByExternalId(externalId, userId);
    if (!transaction) throw new TransactionNotFoundError(externalId);
    await this.transactions.delete(transaction.id, userId);
  }
}

/** Excludes `pluggyStatus` — not persisted on `Transaction`, has its own `patch()` path. */
function matchesInput(transaction: Transaction, input: ImportSyncedTransactionInput): boolean {
  if (
    transaction.description !== input.description ||
    transaction.amount !== input.amount ||
    transaction.dueDate.getTime() !== new Date(input.dueDate).getTime() ||
    transaction.type !== input.type ||
    transaction.accountId !== input.accountId ||
    transaction.creditCardId !== input.creditCardId ||
    (transaction.installmentNumber ?? null) !== (input.installmentNumber ?? null) ||
    (transaction.installmentCount ?? null) !== (input.installmentCount ?? null)
  ) {
    return false;
  }
  if (input.categoryId !== undefined && transaction.categoryId !== input.categoryId) return false;
  return true;
}

function toResult(
  transaction: Transaction,
  pluggyStatus: SyncedImportResult['pluggyStatus'],
): SyncedImportResult {
  return {
    id: transaction.id,
    source: 'synced',
    externalId: transaction.externalId ?? '',
    pluggyStatus,
  };
}
