import type { TransactionType } from '@finance/contracts';
import type { Transaction } from '../../domain/transaction';
import type {
  FindTransactionsFilter,
  TransactionRepository,
} from '../../domain/transaction.repository';
import type { AccountLookup, CardLookup, CategoryLookup } from '../../domain/lookups';
import { toCents } from '../../domain/recurrence';

/** In-memory repo scoped by userId — cross-user rows are invisible, mirroring the SQL WHERE. */
export class FakeTransactionRepository implements TransactionRepository {
  readonly store = new Map<string, Transaction>();

  async create(t: Transaction): Promise<void> {
    this.store.set(t.id, t);
  }
  async createMany(ts: Transaction[]): Promise<void> {
    for (const t of ts) this.store.set(t.id, t);
  }
  async save(t: Transaction): Promise<void> {
    this.store.set(t.id, t);
  }
  async saveMany(ts: Transaction[]): Promise<void> {
    for (const t of ts) this.store.set(t.id, t);
  }
  async findById(id: string, userId: string): Promise<Transaction | null> {
    const t = this.store.get(id);
    return t && t.userId === userId ? t : null;
  }
  async find(userId: string, filter: FindTransactionsFilter): Promise<Transaction[]> {
    let rows = [...this.store.values()].filter(
      (t) =>
        t.userId === userId &&
        t.dueDate.getTime() >= filter.dueFrom.getTime() &&
        t.dueDate.getTime() < filter.dueTo.getTime(),
    );
    if (filter.search) {
      const q = filter.search.toLowerCase();
      rows = rows.filter(
        (t) =>
          t.description.toLowerCase().includes(q) ||
          (t.notes ?? '').toLowerCase().includes(q) ||
          t.amount.includes(q),
      );
    }
    if (filter.amount) rows = rows.filter((t) => t.amount.includes(filter.amount as string));
    if (filter.recurrence) rows = rows.filter((t) => t.recurrence === filter.recurrence);
    if (filter.type) rows = rows.filter((t) => t.type === filter.type);
    if (filter.categoryId) rows = rows.filter((t) => t.categoryId === filter.categoryId);
    if (filter.accountId) rows = rows.filter((t) => t.accountId === filter.accountId);
    if (filter.creditCardId) rows = rows.filter((t) => t.creditCardId === filter.creditCardId);
    rows.sort((a, b) => {
      const dir = filter.order === 'desc' ? -1 : 1;
      switch (filter.sort) {
        case 'amount':
          return (toCents(a.amount) - toCents(b.amount)) * dir;
        case 'description':
          return a.description.localeCompare(b.description) * dir;
        default:
          return (a.dueDate.getTime() - b.dueDate.getTime()) * dir;
      }
    });
    return rows;
  }
  async findByExternalId(externalId: string, userId: string): Promise<Transaction | null> {
    const t = [...this.store.values()].find(
      (row) => row.externalId === externalId && row.userId === userId,
    );
    return t ?? null;
  }
  async findOverdue(userId: string, before: Date): Promise<Transaction[]> {
    return [...this.store.values()].filter(
      (t) =>
        t.userId === userId &&
        t.status === 'pending' &&
        t.dueDate.getTime() < before.getTime(),
    );
  }
  async findGroup(groupId: string, userId: string): Promise<Transaction[]> {
    return [...this.store.values()]
      .filter((t) => t.userId === userId && t.groupId === groupId)
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  }
  async delete(id: string, userId: string): Promise<void> {
    const t = this.store.get(id);
    if (t && t.userId === userId) this.store.delete(id);
  }
  async deleteGroup(groupId: string, userId: string): Promise<void> {
    for (const t of [...this.store.values()]) {
      if (t.userId === userId && t.groupId === groupId) this.store.delete(t.id);
    }
  }
}

/** Category lookup backed by a map of id -> {type, ownerId}; system categories use ownerId null. */
export class FakeCategoryLookup implements CategoryLookup {
  private readonly rows = new Map<string, { type: TransactionType; ownerId: string | null }>();
  private readonly defaults = new Map<TransactionType, string>();

  add(id: string, type: TransactionType, ownerId: string | null = null): this {
    this.rows.set(id, { type, ownerId });
    return this;
  }
  addDefault(type: TransactionType, id: string): this {
    this.defaults.set(type, id);
    return this.add(id, type, null);
  }
  async findType(id: string, userId: string): Promise<TransactionType | null> {
    const row = this.rows.get(id);
    if (!row) return null;
    if (row.ownerId === null || row.ownerId === userId) return row.type;
    return null;
  }
  async findDefaultId(type: TransactionType): Promise<string | null> {
    return this.defaults.get(type) ?? null;
  }
}

export class FakeAccountLookup implements AccountLookup {
  private readonly rows = new Set<string>();
  add(id: string, userId: string): this {
    this.rows.add(`${id}|${userId}`);
    return this;
  }
  async exists(id: string, userId: string): Promise<boolean> {
    return this.rows.has(`${id}|${userId}`);
  }
}

export class FakeCardLookup implements CardLookup {
  private readonly rows = new Set<string>();
  add(id: string, userId: string): this {
    this.rows.add(`${id}|${userId}`);
    return this;
  }
  async exists(id: string, userId: string): Promise<boolean> {
    return this.rows.has(`${id}|${userId}`);
  }
}

export const USER_A = 'user-a';
export const USER_B = 'user-b';
