import type { BankConnectionRepository } from '../../domain/bank-connection.repository';
import { BankConnection } from '../../domain/bank-connection';
import type { LinkedAccount } from '../../domain/linked-account';
import type { LinkedCreditCard } from '../../domain/linked-credit-card';
import type { SyncedTransaction } from '../../domain/synced-transaction';
import type {
  PluggyAccount,
  PluggyClient,
  PluggyConnectToken,
  PluggyItem,
  PluggyItemStatus,
  PluggyTransaction,
} from '../../domain/pluggy-client.port';
import type {
  ImportTransactionInput,
  TransactionsImporter,
  UpdateTransactionInput,
} from '../../domain/transactions-importer.port';

export const USER_A = 'user-a';

/** In-memory repo — mirrors the aggregate-spanning port (bank_connection + linked accounts/cards + synced transactions). */
export class FakeBankConnectionRepository implements BankConnectionRepository {
  readonly connections = new Map<string, BankConnection>();
  readonly linkedAccounts = new Map<string, LinkedAccount>();
  readonly linkedCreditCards = new Map<string, LinkedCreditCard>();
  readonly syncedTransactions = new Map<string, SyncedTransaction>();

  async create(connection: BankConnection): Promise<void> {
    this.connections.set(connection.id, connection);
  }
  async save(connection: BankConnection): Promise<void> {
    this.connections.set(connection.id, connection);
  }
  async findById(id: string, userId: string): Promise<BankConnection | null> {
    const c = this.connections.get(id);
    return c && c.userId === userId ? c : null;
  }
  async findByUserAndItem(userId: string, pluggyItemId: string): Promise<BankConnection | null> {
    return (
      [...this.connections.values()].find(
        (c) => c.userId === userId && c.pluggyItemId === pluggyItemId,
      ) ?? null
    );
  }
  async findByItemId(pluggyItemId: string): Promise<BankConnection | null> {
    return [...this.connections.values()].find((c) => c.pluggyItemId === pluggyItemId) ?? null;
  }
  async findAllByUser(userId: string): Promise<BankConnection[]> {
    return [...this.connections.values()].filter((c) => c.userId === userId);
  }
  async findStaleActiveConnections(threshold: Date): Promise<BankConnection[]> {
    return [...this.connections.values()].filter(
      (c) => c.status === 'active' && (!c.lastSyncedAt || c.lastSyncedAt.getTime() < threshold.getTime()),
    );
  }

  async upsertLinkedAccount(account: LinkedAccount): Promise<void> {
    this.linkedAccounts.set(account.id, account);
  }
  async upsertLinkedCreditCard(card: LinkedCreditCard): Promise<void> {
    this.linkedCreditCards.set(card.id, card);
  }
  async findLinkedAccountsByConnection(bankConnectionId: string): Promise<LinkedAccount[]> {
    return [...this.linkedAccounts.values()].filter((a) => a.bankConnectionId === bankConnectionId);
  }
  async findLinkedCreditCardsByConnection(bankConnectionId: string): Promise<LinkedCreditCard[]> {
    return [...this.linkedCreditCards.values()].filter((c) => c.bankConnectionId === bankConnectionId);
  }
  async findBankConnectionIdForOrigin(
    linkedAccountId: string | null,
    linkedCreditCardId: string | null,
  ): Promise<string | null> {
    if (linkedAccountId) return this.linkedAccounts.get(linkedAccountId)?.bankConnectionId ?? null;
    if (linkedCreditCardId) return this.linkedCreditCards.get(linkedCreditCardId)?.bankConnectionId ?? null;
    return null;
  }

  async upsertSyncedTransaction(transaction: SyncedTransaction): Promise<void> {
    this.syncedTransactions.set(transaction.id, transaction);
  }
  async findSyncedTransactionByPluggyId(
    userId: string,
    pluggyTransactionId: string,
  ): Promise<SyncedTransaction | null> {
    return (
      [...this.syncedTransactions.values()].find(
        (t) => t.userId === userId && t.pluggyTransactionId === pluggyTransactionId,
      ) ?? null
    );
  }
  async findErroredSyncedTransactions(retryLimit: number): Promise<SyncedTransaction[]> {
    return [...this.syncedTransactions.values()].filter(
      (t) => t.syncStatus === 'error' && !t.hasReachedRetryLimit(retryLimit),
    );
  }
  async deleteSyncedTransaction(id: string): Promise<void> {
    this.syncedTransactions.delete(id);
  }
  async findSyncedTransactionsByOrigin(
    linkedAccountId: string | null,
    linkedCreditCardId: string | null,
  ): Promise<SyncedTransaction[]> {
    return [...this.syncedTransactions.values()].filter(
      (t) => t.linkedAccountId === linkedAccountId && t.linkedCreditCardId === linkedCreditCardId,
    );
  }
}

/** Seedable fake Pluggy client — tests configure items/accounts/transactions per itemId/accountId. */
export class FakePluggyClient implements PluggyClient {
  private readonly items = new Map<string, PluggyItem>();
  private readonly accountsByItem = new Map<string, PluggyAccount[]>();
  private readonly transactionsByAccount = new Map<string, PluggyTransaction[]>();
  connectTokenCalls: Array<{ itemId?: string }> = [];
  forceRefreshCalls: string[] = [];

  addItem(itemId: string, item: Omit<PluggyItem, 'id'>): this {
    this.items.set(itemId, { id: itemId, ...item });
    return this;
  }
  setStatus(itemId: string, status: PluggyItemStatus): this {
    const item = this.items.get(itemId);
    if (item) item.status = status;
    return this;
  }
  addAccounts(itemId: string, accounts: PluggyAccount[]): this {
    this.accountsByItem.set(itemId, accounts);
    return this;
  }
  addTransactions(accountId: string, transactions: PluggyTransaction[]): this {
    this.transactionsByAccount.set(accountId, transactions);
    return this;
  }

  async createConnectToken(input: { itemId?: string }): Promise<PluggyConnectToken> {
    this.connectTokenCalls.push(input);
    return { connectToken: 'fake-connect-token', expiresAt: new Date(Date.now() + 30 * 60 * 1000) };
  }
  async getItem(itemId: string): Promise<PluggyItem> {
    const item = this.items.get(itemId);
    if (!item) throw new Error(`FakePluggyClient: unknown itemId ${itemId}`);
    return item;
  }
  async forceRefreshItem(itemId: string): Promise<PluggyItem> {
    this.forceRefreshCalls.push(itemId);
    return this.getItem(itemId);
  }
  async listAccounts(itemId: string): Promise<PluggyAccount[]> {
    return this.accountsByItem.get(itemId) ?? [];
  }
  async listTransactions(accountId: string): Promise<PluggyTransaction[]> {
    return this.transactionsByAccount.get(accountId) ?? [];
  }
}

/** Fake transactions-importer — records calls, returns a deterministic transactionsMsId. */
export class FakeTransactionsImporter implements TransactionsImporter {
  readonly imported: ImportTransactionInput[] = [];
  readonly updated: UpdateTransactionInput[] = [];
  readonly deleted: Array<{ userId: string; pluggyTransactionId: string }> = [];
  shouldFail = false;

  async importTransaction(input: ImportTransactionInput): Promise<{ transactionsMsId: string }> {
    if (this.shouldFail) throw new Error('FakeTransactionsImporter: forced failure');
    this.imported.push(input);
    return { transactionsMsId: `tx-ms-${this.imported.length}` };
  }
  async updateTransaction(input: UpdateTransactionInput): Promise<void> {
    this.updated.push(input);
  }
  async deleteTransaction(userId: string, pluggyTransactionId: string): Promise<void> {
    this.deleted.push({ userId, pluggyTransactionId });
  }
}
