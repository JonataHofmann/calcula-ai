import type { BankConnection } from './bank-connection';
import type { LinkedAccount } from './linked-account';
import type { LinkedCreditCard } from './linked-credit-card';
import type { SyncedTransaction } from './synced-transaction';

export const BANK_CONNECTION_REPOSITORY = Symbol('BANK_CONNECTION_REPOSITORY');

export interface BankConnectionRepository {
  create(connection: BankConnection): Promise<void>;
  save(connection: BankConnection): Promise<void>;
  findById(id: string, userId: string): Promise<BankConnection | null>;
  findByUserAndItem(userId: string, pluggyItemId: string): Promise<BankConnection | null>;
  /** Unscoped by user — needed to resolve ownership from a Pluggy webhook, which carries no userId. */
  findByItemId(pluggyItemId: string): Promise<BankConnection | null>;
  findAllByUser(userId: string): Promise<BankConnection[]>;
  findStaleActiveConnections(threshold: Date): Promise<BankConnection[]>;
  /** Counts synced transactions for a connection via its linked accounts/cards (no direct FK). */
  countSyncedTransactions(bankConnectionId: string): Promise<{ total: number; errored: number }>;

  upsertLinkedAccount(account: LinkedAccount): Promise<void>;
  upsertLinkedCreditCard(card: LinkedCreditCard): Promise<void>;
  findLinkedAccountsByConnection(bankConnectionId: string): Promise<LinkedAccount[]>;
  findLinkedCreditCardsByConnection(bankConnectionId: string): Promise<LinkedCreditCard[]>;
  /** Resolves the owning bank_connection id for a SyncedTransaction's origin (exactly one arg is non-null). */
  findBankConnectionIdForOrigin(
    linkedAccountId: string | null,
    linkedCreditCardId: string | null,
  ): Promise<string | null>;

  /** Idempotent by (userId, pluggyTransactionId) — never creates a second row (R6). */
  upsertSyncedTransaction(transaction: SyncedTransaction): Promise<void>;
  findSyncedTransactionByPluggyId(
    userId: string,
    pluggyTransactionId: string,
  ): Promise<SyncedTransaction | null>;
  findErroredSyncedTransactions(retryLimit: number): Promise<SyncedTransaction[]>;
  deleteSyncedTransaction(id: string): Promise<void>;
  /** All synced rows for one account/card origin — used to detect source-side deletions (FR-011). */
  findSyncedTransactionsByOrigin(
    linkedAccountId: string | null,
    linkedCreditCardId: string | null,
  ): Promise<SyncedTransaction[]>;
}
