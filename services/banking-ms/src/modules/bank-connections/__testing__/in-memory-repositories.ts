import type { Repository } from 'typeorm';
import { BankConnectionEntity } from '../entities/bank-connection.entity';
import { LinkedAccountEntity } from '../entities/linked-account.entity';
import { LinkedCreditCardEntity } from '../entities/linked-credit-card.entity';
import { SyncedTransactionEntity } from '../entities/synced-transaction.entity';
import type {
  PluggyAccount,
  PluggyClient,
  PluggyConnectToken,
  PluggyItem,
  PluggyItemStatus,
  PluggyTransaction,
} from '../pluggy-client.port';
import type {
  CreateSyncedAccountInput,
  CreateSyncedCardInput,
  ImportTransactionInput,
  TransactionsImporter,
  UpdateTransactionInput,
} from '../transactions-importer.port';

/**
 * In-memory fakes of the four TypeORM repositories {@link BankConnectionsService}
 * injects, plus the Pluggy client and transactions-importer ports. Each repository
 * implements only the subset the service actually calls (`insert`/`save`/`upsert`/
 * `findOne`/`find`/`delete`), keyed by the entity `id`, so specs run without a
 * database. Cast `as unknown as Repository<E>` — the fakes are structural, not the
 * full TypeORM surface.
 */

export const USER_A = 'user-a';

type Row = Record<string, unknown> & { id: string };

/** Match a row against a TypeORM `where` object by strict field equality (no FindOperators used here). */
function matchesWhere(row: Row, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([key, value]) => row[key] === value);
}

/** Sort by a TypeORM `order` object ({ field: 'ASC' | 'DESC' }), evaluated left-to-right. */
function applyOrder<E extends Row>(rows: E[], order?: Record<string, 'ASC' | 'DESC'>): E[] {
  if (!order) return rows;
  const specs = Object.entries(order);
  return [...rows].sort((a, b) => {
    for (const [field, dir] of specs) {
      const av = a[field];
      const bv = b[field];
      let cmp = 0;
      if (av instanceof Date && bv instanceof Date) cmp = av.getTime() - bv.getTime();
      else if (av === bv) cmp = 0;
      else if ((av as number) < (bv as number)) cmp = -1;
      else cmp = 1;
      if (cmp !== 0) return dir === 'DESC' ? -cmp : cmp;
    }
    return 0;
  });
}

function clone<E extends Row>(row: E): E {
  return { ...row };
}

interface FindOptions {
  where?: Record<string, unknown>;
  order?: Record<string, 'ASC' | 'DESC'>;
}

/**
 * Generic id-keyed repository fake. `upsert` honours the supplied conflict paths:
 * an existing row matching all of them is removed before the incoming row is stored,
 * so a conflicting insert updates in place instead of duplicating (matching the DB).
 */
function makeRepo<E extends Row>() {
  const store = new Map<string, E>();
  const fake = {
    store,
    async insert(entity: E): Promise<void> {
      store.set(entity.id, clone(entity));
    },
    async save(entity: E): Promise<E> {
      store.set(entity.id, clone(entity));
      return clone(entity);
    },
    async upsert(entity: E, conflictPaths: string[]): Promise<void> {
      for (const [key, row] of [...store]) {
        if (conflictPaths.every((path) => row[path] === entity[path])) store.delete(key);
      }
      store.set(entity.id, clone(entity));
    },
    async findOne(options: { where: Record<string, unknown> }): Promise<E | null> {
      const row = [...store.values()].find((r) => matchesWhere(r, options.where));
      return row ? clone(row) : null;
    },
    async find(options: FindOptions = {}): Promise<E[]> {
      let rows = [...store.values()];
      if (options.where) rows = rows.filter((r) => matchesWhere(r, options.where!));
      return applyOrder(rows, options.order).map(clone);
    },
    async delete(criteria: Record<string, unknown>): Promise<void> {
      for (const [key, row] of [...store]) {
        if (matchesWhere(row, criteria)) store.delete(key);
      }
    },
  };
  return fake;
}

export function makeConnectionRepo(): Repository<BankConnectionEntity> {
  return makeRepo<BankConnectionEntity & Row>() as unknown as Repository<BankConnectionEntity>;
}

export function makeAccountRepo(): Repository<LinkedAccountEntity> {
  return makeRepo<LinkedAccountEntity & Row>() as unknown as Repository<LinkedAccountEntity>;
}

export function makeCardRepo(): Repository<LinkedCreditCardEntity> {
  return makeRepo<LinkedCreditCardEntity & Row>() as unknown as Repository<LinkedCreditCardEntity>;
}

export function makeTransactionRepo(): Repository<SyncedTransactionEntity> {
  return makeRepo<SyncedTransactionEntity & Row>() as unknown as Repository<SyncedTransactionEntity>;
}

/** Seedable fake Pluggy client — tests configure items/accounts/transactions per itemId/accountId. */
export class FakePluggyClient implements PluggyClient {
  private readonly items = new Map<string, PluggyItem>();
  private readonly accountsByItem = new Map<string, PluggyAccount[]>();
  private readonly transactionsByAccount = new Map<string, PluggyTransaction[]>();
  connectTokenCalls: Array<{ itemId?: string }> = [];
  forceRefreshCalls: string[] = [];
  listTransactionsCalls: Array<{ accountId: string; from: Date }> = [];

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
  async listTransactions(accountId: string, from: Date): Promise<PluggyTransaction[]> {
    this.listTransactionsCalls.push({ accountId, from });
    return this.transactionsByAccount.get(accountId) ?? [];
  }
}

/** Fake transactions-importer — records calls, returns a deterministic transactionsMsId. */
export class FakeTransactionsImporter implements TransactionsImporter {
  readonly imported: ImportTransactionInput[] = [];
  readonly updated: UpdateTransactionInput[] = [];
  readonly deleted: Array<{ userId: string; pluggyTransactionId: string }> = [];
  readonly createdAccounts: CreateSyncedAccountInput[] = [];
  readonly createdCards: CreateSyncedCardInput[] = [];
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
  async createSyncedAccount(input: CreateSyncedAccountInput): Promise<{ id: string }> {
    this.createdAccounts.push(input);
    return { id: `api-account-${this.createdAccounts.length}` };
  }
  async createSyncedCard(input: CreateSyncedCardInput): Promise<{ id: string }> {
    this.createdCards.push(input);
    return { id: `api-card-${this.createdCards.length}` };
  }
}
