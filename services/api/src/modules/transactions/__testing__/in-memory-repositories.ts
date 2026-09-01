import { FindOperator, type Repository } from 'typeorm';
import type {
  Recurrence,
  TransactionSource,
  TransactionStatus,
  TransactionType,
} from '@finance/contracts';
import { TransactionEntity } from '../entities/transaction.entity';
import { CategoryEntity } from '../../categories/entities/category.entity';
import { AccountEntity } from '../../accounts/entities/account.entity';
import { CreditCardEntity } from '../../cards/entities/credit-card.entity';
import { toCents } from '../recurrence';

/**
 * User-scoped in-memory fakes of the four TypeORM repositories the
 * {@link TransactionsService} injects. They implement only the subset the
 * service uses — mirroring the SQL scoping/filtering rules — so specs run
 * without a database. The transaction fake also implements a minimal
 * `createQueryBuilder` and `manager` transaction batch (folded from the old
 * TypeORM repository) plus a `LessThan`/`IsNull`-aware `find`.
 */

export const USER_A = 'user-a';
export const USER_B = 'user-b';

type WhereValue = unknown;

/** Match a row against a TypeORM `where` object, honouring `IsNull`/`LessThan` FindOperators. */
function matchesWhere(row: Record<string, unknown>, where: Record<string, WhereValue>): boolean {
  for (const [key, cond] of Object.entries(where)) {
    const value = row[key];
    if (cond instanceof FindOperator) {
      const type = cond.type as string;
      if (type === 'isNull') {
        if (value !== null && value !== undefined) return false;
      } else if (type === 'lessThan') {
        const target = cond.value as unknown;
        if (value instanceof Date && target instanceof Date) {
          if (!(value.getTime() < target.getTime())) return false;
        } else if (!((value as number) < (target as number))) {
          return false;
        }
      } else if (value !== cond.value) {
        return false;
      }
    } else if (value !== cond) {
      return false;
    }
  }
  return true;
}

const CENTS_COLUMNS = new Set(['amount', 'effectiveAmount']);

/** Sort by a TypeORM `order` object ({ field: 'ASC' | 'DESC' }), evaluated left-to-right. */
function applyOrder<T>(rows: T[], order?: Record<string, 'ASC' | 'DESC'>): T[] {
  if (!order) return rows;
  const specs = Object.entries(order);
  return rows.sort((a, b) => {
    const ar = a as Record<string, unknown>;
    const br = b as Record<string, unknown>;
    for (const [field, dir] of specs) {
      const cmp = compareField(ar[field], br[field], CENTS_COLUMNS.has(field));
      if (cmp !== 0) return dir === 'DESC' ? -cmp : cmp;
    }
    return 0;
  });
}

function compareField(a: unknown, b: unknown, numericMoney: boolean): number {
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  if (numericMoney) return toCents(String(a)) - toCents(String(b));
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b));
}

// --- query-builder fake (folded find) -----------------------------------------------------------

const SORT_FIELD: Record<string, string> = {
  't.due_date': 'dueDate',
  't.amount': 'amount',
  't.description': 'description',
  't.status': 'status',
  't.type': 'type',
  't.recurrence': 'recurrence',
  't.id': 'id',
};

function stripLike(value: string): string {
  return value.replace(/^%/, '').replace(/%$/, '').toLowerCase();
}

/** Mirrors `TransactionsService.find`'s createQueryBuilder, interpreting bound params by name. */
function makeQueryBuilder(rows: TransactionEntity[]) {
  const params: Record<string, unknown> = {};
  const order: Array<[string, 'ASC' | 'DESC']> = [];
  const qb = {
    where(_sql: string, bound?: Record<string, unknown>) {
      Object.assign(params, bound);
      return qb;
    },
    andWhere(_sql: string, bound?: Record<string, unknown>) {
      Object.assign(params, bound);
      return qb;
    },
    orderBy(column: string, dir: 'ASC' | 'DESC') {
      order.length = 0;
      order.push([column, dir]);
      return qb;
    },
    addOrderBy(column: string, dir: 'ASC' | 'DESC') {
      order.push([column, dir]);
      return qb;
    },
    async getMany(): Promise<TransactionEntity[]> {
      let result = rows.filter((r) => r.userId === params.userId);
      if (params.dueFrom instanceof Date) {
        const from = params.dueFrom.getTime();
        result = result.filter((r) => r.dueDate.getTime() >= from);
      }
      if (params.dueTo instanceof Date) {
        const to = params.dueTo.getTime();
        result = result.filter((r) => r.dueDate.getTime() <= to);
      }
      if (typeof params.search === 'string') {
        const q = stripLike(params.search);
        result = result.filter(
          (r) =>
            r.description.toLowerCase().includes(q) ||
            (r.notes ?? '').toLowerCase().includes(q) ||
            r.amount.toLowerCase().includes(q),
        );
      }
      if (typeof params.amount === 'string') {
        const q = stripLike(params.amount);
        result = result.filter((r) => r.amount.toLowerCase().includes(q));
      }
      if (params.recurrence) result = result.filter((r) => r.recurrence === params.recurrence);
      if (params.type) result = result.filter((r) => r.type === params.type);
      if (params.categoryId) result = result.filter((r) => r.categoryId === params.categoryId);
      if (params.accountId) result = result.filter((r) => r.accountId === params.accountId);
      if (params.creditCardId)
        result = result.filter((r) => r.creditCardId === params.creditCardId);

      const orderObj: Record<string, 'ASC' | 'DESC'> = {};
      for (const [column, dir] of order) orderObj[SORT_FIELD[column] ?? column] = dir;
      return applyOrder([...result], orderObj).map(cloneTx);
    },
  };
  return qb;
}

function cloneTx(e: TransactionEntity): TransactionEntity {
  return Object.assign(new TransactionEntity(), e);
}

// --- transaction repository fake -----------------------------------------------------------------

export type FakeTransactionRepo = Repository<TransactionEntity> & {
  store: Map<string, TransactionEntity>;
};

/** Minimal `EntityManager` shape used by the transaction/save/delete batch operations. */
interface FakeManager {
  insert(entity: unknown, entities: TransactionEntity[]): Promise<void>;
  save(entities: TransactionEntity | TransactionEntity[]): Promise<TransactionEntity | TransactionEntity[]>;
  delete(entity: unknown, criteria: Record<string, unknown>): Promise<void>;
  transaction<T>(cb: (m: FakeManager) => Promise<T>): Promise<T>;
}

export function makeFakeTransactionRepo(seed: TransactionEntity[] = []): FakeTransactionRepo {
  const store = new Map<string, TransactionEntity>(seed.map((t) => [t.id, cloneTx(t)]));

  const putMany = (entities: TransactionEntity | TransactionEntity[]): void => {
    const list = Array.isArray(entities) ? entities : [entities];
    for (const e of list) store.set(e.id, cloneTx(e));
  };
  const removeMatching = (criteria: Record<string, unknown>): void => {
    for (const row of [...store.values()]) {
      if (matchesWhere(row as unknown as Record<string, unknown>, criteria)) store.delete(row.id);
    }
  };

  const manager: FakeManager = {
    async insert(_entity: unknown, entities: TransactionEntity[]) {
      putMany(entities);
    },
    async save(entities: TransactionEntity | TransactionEntity[]) {
      putMany(entities);
      return entities;
    },
    async delete(_entity: unknown, criteria: Record<string, unknown>) {
      removeMatching(criteria);
    },
    async transaction<T>(cb: (m: FakeManager) => Promise<T>): Promise<T> {
      return cb(manager);
    },
  };

  const fake = {
    store,
    manager,
    async insert(entity: TransactionEntity) {
      putMany(entity);
    },
    async save(entity: TransactionEntity | TransactionEntity[]) {
      putMany(entity);
      return entity;
    },
    async findOne(options: { where: Record<string, unknown> }) {
      const row = [...store.values()].find((r) =>
        matchesWhere(r as unknown as Record<string, unknown>, options.where),
      );
      return row ? cloneTx(row) : null;
    },
    async find(options: {
      where?: Record<string, unknown>;
      order?: Record<string, 'ASC' | 'DESC'>;
    }) {
      let rows = [...store.values()];
      if (options.where) {
        rows = rows.filter((r) =>
          matchesWhere(r as unknown as Record<string, unknown>, options.where as Record<string, unknown>),
        );
      }
      return applyOrder(rows, options.order).map(cloneTx);
    },
    async delete(criteria: Record<string, unknown>) {
      removeMatching(criteria);
    },
    createQueryBuilder(_alias?: string) {
      const read = makeQueryBuilder([...store.values()]);
      // Mirror `.insert().into().values().orIgnore().execute()` — used by the fixed-occurrence
      // materialization — honouring the `uq_transactions_group_due` unique partial index so
      // concurrent inserts of the same (group_id, due_date) are skipped, not duplicated.
      return Object.assign(read, {
        insert() {
          let pending: TransactionEntity[] = [];
          let ignoreConflicts = false;
          const insertBuilder = {
            into(_entity: unknown) {
              return insertBuilder;
            },
            values(entities: TransactionEntity[]) {
              pending = entities;
              return insertBuilder;
            },
            orIgnore() {
              ignoreConflicts = true;
              return insertBuilder;
            },
            async execute() {
              const seen = new Set(
                [...store.values()]
                  .filter((r) => r.groupId != null)
                  .map((r) => `${r.groupId}|${r.dueDate.getTime()}`),
              );
              for (const e of pending) {
                if (e.groupId != null) {
                  const key = `${e.groupId}|${e.dueDate.getTime()}`;
                  if (seen.has(key)) {
                    if (ignoreConflicts) continue;
                    throw new Error('duplicate key value violates unique constraint');
                  }
                  seen.add(key);
                }
                putMany(e);
              }
              return { identifiers: [] };
            },
          };
          return insertBuilder;
        },
      });
    },
  };

  return fake as unknown as FakeTransactionRepo;
}

// --- reference repository fakes -------------------------------------------------------------------

export function makeFakeCategoryRepo(seed: CategoryEntity[] = []): Repository<CategoryEntity> {
  const store = new Map<string, CategoryEntity>(seed.map((c) => [c.id, { ...c }]));
  const fake = {
    async insert(e: CategoryEntity) {
      store.set(e.id, { ...e });
    },
    async findOne(options: { where: Record<string, unknown> }) {
      const row = [...store.values()].find((r) =>
        matchesWhere(r as unknown as Record<string, unknown>, options.where),
      );
      return row ? { ...row } : null;
    },
  };
  return fake as unknown as Repository<CategoryEntity>;
}

function makeExistsRepo<E extends { id: string }>(seed: E[]): Repository<E> {
  // Array-backed (not keyed by id): the same reference id can be owned by
  // different users across seeds, mirroring rows that only differ by userId.
  const rows: E[] = [...seed];
  const fake = {
    async insert(e: E) {
      rows.push(e);
    },
    async exists(options: { where: Record<string, unknown> }) {
      return rows.some((r) =>
        matchesWhere(r as unknown as Record<string, unknown>, options.where),
      );
    },
    async find(options: { where?: Record<string, unknown> } = {}) {
      const filtered = options.where
        ? rows.filter((r) =>
            matchesWhere(r as unknown as Record<string, unknown>, options.where as Record<string, unknown>),
          )
        : rows;
      return filtered.map((r) => ({ ...r }));
    },
    async findOne(options: { where?: Record<string, unknown> } = {}) {
      const match = options.where
        ? rows.find((r) =>
            matchesWhere(r as unknown as Record<string, unknown>, options.where as Record<string, unknown>),
          )
        : rows[0];
      return match ? { ...match } : null;
    },
  };
  return fake as unknown as Repository<E>;
}

export function makeFakeAccountRepo(seed: AccountEntity[] = []): Repository<AccountEntity> {
  return makeExistsRepo(seed);
}

export function makeFakeCreditCardRepo(seed: CreditCardEntity[] = []): Repository<CreditCardEntity> {
  return makeExistsRepo(seed);
}

// --- entity builders ------------------------------------------------------------------------------

let seq = 0;

/** Build a persisted transaction row with sane defaults (overridable per field). */
export function transactionEntity(overrides: Partial<TransactionEntity> = {}): TransactionEntity {
  const now = new Date(2020, 0, 1, 0, 0, 0, seq++);
  return Object.assign(new TransactionEntity(), {
    id: `tx-${seq}`,
    userId: USER_A,
    description: 'Test',
    originalDescription: null,
    dueDate: new Date('2026-01-10T00:00:00.000Z'),
    amount: '100.00',
    effectiveAmount: null,
    recurrence: 'single' as Recurrence,
    effectiveDate: null,
    type: 'expense' as TransactionType,
    notes: null,
    status: 'pending' as TransactionStatus,
    endDate: null,
    installmentCount: null,
    installmentNumber: null,
    groupId: null,
    categoryId: 'cat-1',
    accountId: 'acc-1',
    creditCardId: null,
    source: 'manual' as TransactionSource,
    externalId: null,
    createdAt: now,
    updatedAt: now,
  } satisfies Partial<TransactionEntity>, overrides);
}

/** Build a category row; system defaults use `ownerId: null`. */
export function categoryRow(input: {
  id: string;
  type: TransactionType;
  ownerId?: string | null;
  name?: string;
  isSystem?: boolean;
}): CategoryEntity {
  return Object.assign(new CategoryEntity(), {
    id: input.id,
    ownerId: input.ownerId ?? null,
    parentId: null,
    name: input.name ?? 'Categoria',
    type: input.type,
    icon: 'tag',
    color: 'primary',
    isSystem: input.isSystem ?? input.ownerId == null,
    createdAt: new Date(2020, 0, 1),
    updatedAt: new Date(2020, 0, 1),
  });
}

export function accountRow(id: string, userId: string): AccountEntity {
  return Object.assign(new AccountEntity(), { id, userId });
}

export function cardRow(id: string, userId: string): CreditCardEntity {
  // Ciclo padrão (fech 1 / venc 10) — a criação manual de cartão deriva o vencimento da fatura daí.
  return Object.assign(new CreditCardEntity(), { id, userId, closingDay: 1, dueDay: 10 });
}
