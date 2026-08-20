import type { Recurrence, SortOrder, TransactionSort, TransactionType } from '@finance/contracts';
import type { Transaction } from './transaction';

export const TRANSACTION_REPOSITORY = Symbol('TRANSACTION_REPOSITORY');

/** Repository-level filters (Dates already resolved from the ISO query — R4). */
export interface FindTransactionsFilter {
  dueFrom: Date;
  dueTo: Date;
  search?: string;
  amount?: string;
  recurrence?: Recurrence;
  type?: TransactionType;
  categoryId?: string;
  accountId?: string;
  creditCardId?: string;
  sort: TransactionSort;
  order: SortOrder;
}

/**
 * Persistence port. Every method is scoped by userId so cross-user rows are invisible
 * (other user's row -> not found -> 404). Group/batch ops are atomic.
 */
export interface TransactionRepository {
  create(transaction: Transaction): Promise<void>;
  createMany(transactions: Transaction[]): Promise<void>;
  save(transaction: Transaction): Promise<void>;
  saveMany(transactions: Transaction[]): Promise<void>;
  findById(id: string, userId: string): Promise<Transaction | null>;
  findByExternalId(externalId: string, userId: string): Promise<Transaction | null>;
  find(userId: string, filter: FindTransactionsFilter): Promise<Transaction[]>;
  findOverdue(userId: string, before: Date): Promise<Transaction[]>;
  findGroup(groupId: string, userId: string): Promise<Transaction[]>;
  delete(id: string, userId: string): Promise<void>;
  deleteGroup(groupId: string, userId: string): Promise<void>;
}
