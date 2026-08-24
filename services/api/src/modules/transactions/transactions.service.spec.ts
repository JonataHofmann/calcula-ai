import { randomUUID } from 'node:crypto';
import type { CreateTransactionInput, ListTransactionsQuery } from '@finance/contracts';
import { TransactionsService } from './transactions.service';
import {
  AlreadyPaidError,
  InvalidTransactionError,
  NotPaidError,
  ReferenceNotFoundError,
  SyncedImportConflictError,
  TransactionNotFoundError,
} from './transactions.types';
import { toCents } from './recurrence';
import type { TransactionEntity } from './entities/transaction.entity';
import type { ImportSyncedTransactionInput } from './import-synced-transaction.schemas';
import {
  accountRow,
  cardRow,
  categoryRow,
  makeFakeAccountRepo,
  makeFakeCategoryRepo,
  makeFakeCreditCardRepo,
  makeFakeTransactionRepo,
  transactionEntity,
  USER_A,
  USER_B,
  type FakeTransactionRepo,
} from './__testing__/in-memory-repositories';

/**
 * Unit specs for {@link TransactionsService} — the 10 folded use-cases, reference
 * validation, and forecast projection — exercised against user-scoped in-memory
 * repository fakes (direct instantiation, no Nest TestingModule; per repo convention).
 * The service returns {@link Transaction} aggregates; persistence rows are read back
 * through the transaction repo fake's `store`/`find`.
 */

const CAT_EXPENSE = 'cat-expense';
const CAT_INCOME = 'cat-income';
const ACC = 'acc-1';
const CARD = 'card-1';

/** Service wired to the default fixtures: one expense + income category, an account owned by A and B, a card owned by A. */
function setup() {
  const txRepo = makeFakeTransactionRepo();
  const categoryRepo = makeFakeCategoryRepo([
    categoryRow({ id: CAT_EXPENSE, type: 'expense' }),
    categoryRow({ id: CAT_INCOME, type: 'income' }),
  ]);
  const accountRepo = makeFakeAccountRepo([accountRow(ACC, USER_A), accountRow(ACC, USER_B)]);
  const creditCardRepo = makeFakeCreditCardRepo([cardRow(CARD, USER_A)]);
  const service = new TransactionsService(txRepo, categoryRepo, accountRepo, creditCardRepo);
  return { service, txRepo };
}

/** Group rows sorted by dueDate (entities read straight from the store). */
async function group(txRepo: FakeTransactionRepo, groupId: string): Promise<TransactionEntity[]> {
  return txRepo.find({ where: { groupId, userId: USER_A }, order: { dueDate: 'ASC' } });
}

// --- create ----------------------------------------------------------------------------------

describe('TransactionsService.create (single)', () => {
  const singleExpense = {
    recurrence: 'single',
    type: 'expense',
    description: 'Mercado',
    dueDate: '2026-01-10T00:00:00.000Z',
    amount: '100.00',
    categoryId: CAT_EXPENSE,
    accountId: ACC,
  } as CreateTransactionInput;

  it('creates one row owned by the caller with a null groupId', async () => {
    const { service, txRepo } = setup();
    const [t] = await service.create(USER_A, singleExpense);
    expect(t.userId).toBe(USER_A);
    expect(t.recurrence).toBe('single');
    expect(t.groupId).toBeNull();
    expect(t.status).toBe('pending');
    expect(txRepo.store.size).toBe(1);
  });

  it('accepts an expense paid by card', async () => {
    const { service } = setup();
    const [t] = await service.create(USER_A, {
      ...singleExpense,
      accountId: undefined,
      creditCardId: CARD,
    } as CreateTransactionInput);
    expect(t.creditCardId).toBe(CARD);
    expect(t.accountId).toBeNull();
  });

  it('404s when the category does not belong to the user', async () => {
    const { service } = setup();
    await expect(
      service.create(USER_A, { ...singleExpense, categoryId: 'ghost' } as CreateTransactionInput),
    ).rejects.toBeInstanceOf(ReferenceNotFoundError);
  });

  it('rejects a category whose type mismatches the transaction type', async () => {
    const { service } = setup();
    await expect(
      service.create(USER_A, { ...singleExpense, categoryId: CAT_INCOME } as CreateTransactionInput),
    ).rejects.toBeInstanceOf(InvalidTransactionError);
  });

  it('404s when the account belongs to another user', async () => {
    const { service } = setup();
    await expect(
      service.create(USER_A, {
        ...singleExpense,
        accountId: 'someone-elses',
      } as CreateTransactionInput),
    ).rejects.toBeInstanceOf(ReferenceNotFoundError);
  });
});

describe('TransactionsService.create (fixed)', () => {
  const fixed = {
    recurrence: 'fixed',
    type: 'expense',
    description: 'Aluguel',
    dueDate: '2026-01-05T00:00:00.000Z',
    amount: '1500.00',
    categoryId: CAT_EXPENSE,
    accountId: ACC,
  };

  it('creates one row carrying a groupId so future occurrences can join', async () => {
    const { service, txRepo } = setup();
    const [t] = await service.create(USER_A, fixed as CreateTransactionInput);
    expect(txRepo.store.size).toBe(1);
    expect(t.recurrence).toBe('fixed');
    expect(t.groupId).not.toBeNull();
    expect(t.endDate).toBeNull();
  });

  it('keeps an optional end date on the fixed occurrence', async () => {
    const { service } = setup();
    const [t] = await service.create(USER_A, {
      ...fixed,
      endDate: '2026-12-05T00:00:00.000Z',
    } as CreateTransactionInput);
    expect(t.endDate?.toISOString()).toBe('2026-12-05T00:00:00.000Z');
  });
});

describe('TransactionsService.create (installment)', () => {
  const base = {
    recurrence: 'installment',
    type: 'expense',
    description: 'Notebook',
    dueDate: '2026-01-15T00:00:00.000Z',
    categoryId: CAT_EXPENSE,
    accountId: ACC,
  };

  it('creates N rows sharing a groupId with 1-based numbering and monthly due dates', async () => {
    const { service } = setup();
    const rows = await service.create(USER_A, {
      ...base,
      installmentCount: 3,
      amount: '100.00',
    } as CreateTransactionInput);

    expect(rows).toHaveLength(3);
    expect(new Set(rows.map((r) => r.groupId)).size).toBe(1);
    expect(rows.map((r) => r.installmentNumber)).toEqual([1, 2, 3]);
    expect(rows.every((r) => r.installmentCount === 3)).toBe(true);
    expect(rows.map((r) => r.dueDate.toISOString())).toEqual([
      '2026-01-15T00:00:00.000Z',
      '2026-02-15T00:00:00.000Z',
      '2026-03-15T00:00:00.000Z',
    ]);
  });

  it('splits a total amount so the parcels sum back to the total', async () => {
    const { service } = setup();
    const rows = await service.create(USER_A, {
      ...base,
      installmentCount: 3,
      totalAmount: '100.00',
    } as CreateTransactionInput);

    const sum = rows.reduce((acc, r) => acc + toCents(r.amount), 0);
    expect(sum).toBe(toCents('100.00'));
    expect(rows.map((r) => r.amount)).toEqual(['33.33', '33.33', '33.34']);
  });
});

// --- get / list / overdue --------------------------------------------------------------------

describe('TransactionsService.get', () => {
  const single = {
    recurrence: 'single',
    type: 'expense',
    description: 'Item',
    dueDate: '2026-01-10T00:00:00.000Z',
    amount: '10.00',
    categoryId: CAT_EXPENSE,
    accountId: ACC,
  } as CreateTransactionInput;

  it('returns the caller-owned transaction', async () => {
    const { service } = setup();
    const [created] = await service.create(USER_A, single);
    const found = await service.get(USER_A, created.id);
    expect(found.id).toBe(created.id);
  });

  it('404s when the transaction belongs to another user', async () => {
    const { service } = setup();
    const [created] = await service.create(USER_A, single);
    await expect(service.get(USER_B, created.id)).rejects.toBeInstanceOf(TransactionNotFoundError);
  });
});

describe('TransactionsService.list', () => {
  function single(dueDate: string, over: Partial<CreateTransactionInput> = {}): CreateTransactionInput {
    return {
      recurrence: 'single',
      type: 'expense',
      description: 'Item',
      dueDate,
      amount: '10.00',
      categoryId: CAT_EXPENSE,
      accountId: ACC,
      ...over,
    } as CreateTransactionInput;
  }

  const janQuery: ListTransactionsQuery = {
    dueFrom: '2026-01-01T00:00:00.000Z',
    dueTo: '2026-02-01T00:00:00.000Z',
    sort: 'dueDate',
    order: 'asc',
  };

  it('returns only rows whose dueDate is within the month window', async () => {
    const { service } = setup();
    await service.create(USER_A, single('2026-01-15T00:00:00.000Z'));
    await service.create(USER_A, single('2026-02-03T00:00:00.000Z'));
    const rows = await service.list(USER_A, janQuery);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.dueDate.toISOString()).toBe('2026-01-15T00:00:00.000Z');
  });

  it('isolates rows by user', async () => {
    const { service } = setup();
    await service.create(USER_A, single('2026-01-10T00:00:00.000Z'));
    await service.create(USER_B, single('2026-01-11T00:00:00.000Z'));
    const rows = await service.list(USER_A, janQuery);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.userId).toBe(USER_A);
  });
});

describe('TransactionsService.listOverdue', () => {
  function single(due: string): CreateTransactionInput {
    return {
      recurrence: 'single',
      type: 'expense',
      description: 'Conta',
      dueDate: due,
      amount: '100.00',
      categoryId: CAT_EXPENSE,
      accountId: ACC,
    } as CreateTransactionInput;
  }

  // Start of the current month, per the frontend's timezone computation.
  const BEFORE = '2026-02-01T00:00:00.000Z';

  it('returns pending occurrences due before the boundary, scoped to the user', async () => {
    const { service } = setup();
    await service.create(USER_A, single('2026-01-10T00:00:00.000Z')); // overdue
    await service.create(USER_A, single('2026-02-15T00:00:00.000Z')); // current month, not overdue
    await service.create(USER_B, single('2026-01-05T00:00:00.000Z')); // other user

    const rows = await service.listOverdue(USER_A, { before: BEFORE });
    expect(rows).toHaveLength(1);
    expect(rows[0].dueDate.toISOString()).toBe('2026-01-10T00:00:00.000Z');
  });

  it('excludes already-paid past occurrences', async () => {
    const { service } = setup();
    const [paid] = await service.create(USER_A, single('2026-01-10T00:00:00.000Z'));
    await service.effectuate(USER_A, paid.id, {});

    expect(await service.listOverdue(USER_A, { before: BEFORE })).toHaveLength(0);
  });
});

// --- effectuate / undo -----------------------------------------------------------------------

describe('TransactionsService.effectuate (single)', () => {
  const single = {
    recurrence: 'single',
    type: 'expense',
    description: 'Aluguel',
    dueDate: '2026-01-10T00:00:00.000Z',
    amount: '1200.00',
    categoryId: CAT_EXPENSE,
    accountId: ACC,
  } as CreateTransactionInput;

  it('marks pending -> paid and preserves the amount when none is given', async () => {
    const { service } = setup();
    const [created] = await service.create(USER_A, single);
    const { transaction, next } = await service.effectuate(USER_A, created.id, {});
    expect(transaction.status).toBe('paid');
    expect(transaction.effectiveAmount).toBe('1200.00');
    expect(transaction.effectiveDate).toBeInstanceOf(Date);
    expect(next).toBeNull();
  });

  it('honors an explicit effective date and amount', async () => {
    const { service } = setup();
    const [created] = await service.create(USER_A, single);
    const { transaction } = await service.effectuate(USER_A, created.id, {
      date: '2026-01-15T00:00:00.000Z',
      amount: '1150.00',
    });
    expect(transaction.effectiveAmount).toBe('1150.00');
    expect(transaction.effectiveDate?.toISOString()).toBe('2026-01-15T00:00:00.000Z');
  });

  it('blocks effectuating an already-paid transaction', async () => {
    const { service } = setup();
    const [created] = await service.create(USER_A, single);
    await service.effectuate(USER_A, created.id, {});
    await expect(service.effectuate(USER_A, created.id, {})).rejects.toBeInstanceOf(AlreadyPaidError);
  });

  it('404s when the transaction belongs to another user', async () => {
    const { service } = setup();
    const [created] = await service.create(USER_A, single);
    await expect(service.effectuate(USER_B, created.id, {})).rejects.toBeInstanceOf(
      TransactionNotFoundError,
    );
  });
});

describe('TransactionsService.effectuate (fixed)', () => {
  const fixed = {
    recurrence: 'fixed',
    type: 'expense',
    description: 'Aluguel',
    dueDate: '2026-01-05T00:00:00.000Z',
    amount: '1500.00',
    categoryId: CAT_EXPENSE,
    accountId: ACC,
  };

  it('materializes the next monthly pending occurrence in the same group', async () => {
    const { service } = setup();
    const [created] = await service.create(USER_A, fixed as CreateTransactionInput);
    const { transaction, next } = await service.effectuate(USER_A, created.id, {});
    expect(transaction.status).toBe('paid');
    expect(next).not.toBeNull();
    expect(next?.status).toBe('pending');
    expect(next?.groupId).toBe(created.groupId);
    expect(next?.dueDate.toISOString()).toBe('2026-02-05T00:00:00.000Z');
  });

  it('does not generate a next occurrence past the end date', async () => {
    const { service } = setup();
    const [created] = await service.create(USER_A, {
      ...fixed,
      endDate: '2026-01-20T00:00:00.000Z',
    } as CreateTransactionInput);
    const { next } = await service.effectuate(USER_A, created.id, {});
    expect(next).toBeNull();
  });
});

describe('TransactionsService.undoEffectuate', () => {
  const single = {
    recurrence: 'single',
    type: 'expense',
    description: 'Aluguel',
    dueDate: '2026-01-10T00:00:00.000Z',
    amount: '1200.00',
    categoryId: CAT_EXPENSE,
    accountId: ACC,
  } as CreateTransactionInput;

  it('marks paid -> pending, clearing effective date/amount', async () => {
    const { service } = setup();
    const [created] = await service.create(USER_A, single);
    await service.effectuate(USER_A, created.id, { amount: '1150.00' });
    const transaction = await service.undoEffectuate(USER_A, created.id);
    expect(transaction.status).toBe('pending');
    expect(transaction.effectiveDate).toBeNull();
    expect(transaction.effectiveAmount).toBeNull();
  });

  it('blocks undoing a still-pending transaction', async () => {
    const { service } = setup();
    const [created] = await service.create(USER_A, single);
    await expect(service.undoEffectuate(USER_A, created.id)).rejects.toBeInstanceOf(NotPaidError);
  });

  it('404s when the transaction belongs to another user', async () => {
    const { service } = setup();
    const [created] = await service.create(USER_A, single);
    await service.effectuate(USER_A, created.id, {});
    await expect(service.undoEffectuate(USER_B, created.id)).rejects.toBeInstanceOf(
      TransactionNotFoundError,
    );
  });
});

// --- update ----------------------------------------------------------------------------------

describe('TransactionsService.update (single)', () => {
  const single = {
    recurrence: 'single',
    type: 'expense',
    description: 'Item',
    dueDate: '2026-01-10T00:00:00.000Z',
    amount: '10.00',
    categoryId: CAT_EXPENSE,
    accountId: ACC,
  } as CreateTransactionInput;

  it('applies editable fields to the single occurrence', async () => {
    const { service } = setup();
    const [created] = await service.create(USER_A, single);
    const [updated] = await service.update(USER_A, created.id, {
      description: 'Novo nome',
      amount: '25.00',
    });
    expect(updated.description).toBe('Novo nome');
    expect(updated.amount).toBe('25.00');
  });

  it('404s when the transaction belongs to another user', async () => {
    const { service } = setup();
    const [created] = await service.create(USER_A, single);
    await expect(service.update(USER_B, created.id, { description: 'x' })).rejects.toBeInstanceOf(
      TransactionNotFoundError,
    );
  });
});

describe('TransactionsService.update (group scope)', () => {
  const installment = {
    recurrence: 'installment',
    type: 'expense',
    description: 'Curso',
    dueDate: '2026-01-10T00:00:00.000Z',
    amount: '100.00',
    installmentCount: 4,
    categoryId: CAT_EXPENSE,
    accountId: ACC,
  };

  it("scope 'one' touches only the target occurrence", async () => {
    const { service, txRepo } = setup();
    const rows = await service.create(USER_A, installment as CreateTransactionInput);
    await service.update(USER_A, rows[1].id, { description: 'Curso B' }, 'one');

    const g = await group(txRepo, rows[0].groupId as string);
    expect(g.map((t) => t.description)).toEqual(['Curso', 'Curso B', 'Curso', 'Curso']);
  });

  it("scope 'future' touches the target and every later occurrence", async () => {
    const { service, txRepo } = setup();
    const rows = await service.create(USER_A, installment as CreateTransactionInput);
    await service.update(USER_A, rows[1].id, { description: 'Novo' }, 'future');

    const g = await group(txRepo, rows[0].groupId as string);
    expect(g.map((t) => t.description)).toEqual(['Curso', 'Novo', 'Novo', 'Novo']);
  });

  it("scope 'all' touches every occurrence, including already-paid ones, preserving effectuation", async () => {
    const { service, txRepo } = setup();
    const rows = await service.create(USER_A, installment as CreateTransactionInput);
    await service.effectuate(USER_A, rows[0].id, { amount: '100.00' });

    await service.update(USER_A, rows[3].id, { amount: '120.00' }, 'all');

    const g = await group(txRepo, rows[0].groupId as string);
    expect(g.every((t) => t.amount === '120.00')).toBe(true);
    expect(g[0].status).toBe('paid');
    expect(g[0].effectiveAmount).toBe('100.00');
  });
});

// --- delete ----------------------------------------------------------------------------------

describe('TransactionsService.delete (single)', () => {
  const single = {
    recurrence: 'single',
    type: 'expense',
    description: 'Item',
    dueDate: '2026-01-10T00:00:00.000Z',
    amount: '10.00',
    categoryId: CAT_EXPENSE,
    accountId: ACC,
  } as CreateTransactionInput;

  it('removes the caller-owned occurrence', async () => {
    const { service, txRepo } = setup();
    const [created] = await service.create(USER_A, single);
    await service.delete(USER_A, created.id);
    expect(txRepo.store.size).toBe(0);
  });

  it('404s and leaves the row intact when another user attempts delete', async () => {
    const { service, txRepo } = setup();
    const [created] = await service.create(USER_A, single);
    await expect(service.delete(USER_B, created.id)).rejects.toBeInstanceOf(TransactionNotFoundError);
    expect(txRepo.store.size).toBe(1);
  });
});

describe('TransactionsService.delete (group scope)', () => {
  const installment = {
    recurrence: 'installment',
    type: 'expense',
    description: 'Curso',
    dueDate: '2026-01-10T00:00:00.000Z',
    amount: '100.00',
    installmentCount: 4,
    categoryId: CAT_EXPENSE,
    accountId: ACC,
  };

  it("scope 'one' removes only the target row", async () => {
    const { service, txRepo } = setup();
    const rows = await service.create(USER_A, installment as CreateTransactionInput);
    await service.delete(USER_A, rows[1].id, 'one');
    expect(txRepo.store.size).toBe(3);
  });

  it("scope 'future' removes the target and later rows", async () => {
    const { service, txRepo } = setup();
    const rows = await service.create(USER_A, installment as CreateTransactionInput);
    await service.delete(USER_A, rows[1].id, 'future');
    expect(txRepo.store.size).toBe(1);
  });

  it("scope 'all' removes the whole group", async () => {
    const { service, txRepo } = setup();
    const rows = await service.create(USER_A, installment as CreateTransactionInput);
    await service.delete(USER_A, rows[2].id, 'all');
    expect(txRepo.store.size).toBe(0);
  });

  it('deleting a missing transaction 404s', async () => {
    const { service } = setup();
    await expect(service.delete(USER_A, 'ghost', 'all')).rejects.toBeInstanceOf(
      TransactionNotFoundError,
    );
  });
});

// --- forecast --------------------------------------------------------------------------------

describe('TransactionsService.getForecast', () => {
  const CAT = 'cat-expense';
  const ACC_ID = 'acc-1';

  function forecastService(seed: TransactionEntity[] = []) {
    const txRepo = makeFakeTransactionRepo(seed);
    const service = new TransactionsService(
      txRepo,
      makeFakeCategoryRepo(),
      makeFakeAccountRepo(),
      makeFakeCreditCardRepo(),
    );
    return { service, txRepo };
  }

  function installmentGroup(opts: {
    userId: string;
    groupId: string;
    description: string;
    startMonth: string;
    count: number;
    amount?: string;
  }): TransactionEntity[] {
    const [year, month] = opts.startMonth.split('-').map(Number);
    return Array.from({ length: opts.count }, (_unused, i) =>
      transactionEntity({
        id: `${opts.groupId}-${i + 1}`,
        userId: opts.userId,
        description: opts.description,
        dueDate: new Date(Date.UTC(year as number, (month as number) - 1 + i, 1)),
        amount: opts.amount ?? '100.00',
        recurrence: 'installment',
        type: 'expense',
        categoryId: CAT,
        accountId: ACC_ID,
        installmentCount: opts.count,
        installmentNumber: i + 1,
        groupId: opts.groupId,
      }),
    );
  }

  function monthDate(month: string): Date {
    const [year, mon] = month.split('-').map(Number);
    return new Date(Date.UTC(year as number, (mon as number) - 1, 1));
  }

  function fixedRow(opts: {
    userId: string;
    groupId: string;
    id: string;
    description: string;
    month: string;
    amount?: string;
    endDate?: string;
  }): TransactionEntity {
    return transactionEntity({
      id: opts.id,
      userId: opts.userId,
      description: opts.description,
      dueDate: monthDate(opts.month),
      amount: opts.amount ?? '50.00',
      recurrence: 'fixed',
      type: 'expense',
      categoryId: CAT,
      accountId: ACC_ID,
      endDate: opts.endDate ? monthDate(opts.endDate) : null,
      groupId: opts.groupId,
    });
  }

  it('(a) populates installment cells only within the group parcel range', async () => {
    const { service } = forecastService(
      installmentGroup({ userId: USER_A, groupId: 'g-car', description: 'carro', startMonth: '2026-08', count: 3 }),
    );
    const result = await service.getForecast(USER_A, { from: '2026-08', months: 6 });
    const row = result.rows.find((r) => r.key === 'g-car');
    expect(row).toBeDefined();
    expect(row?.installmentCount).toBe(3);
    expect(row?.cells.map((c) => c.amount)).toEqual([
      '100.00',
      '100.00',
      '100.00',
      null,
      null,
      null,
    ]);
  });

  it('(b) projects fixed cells beyond the single persisted pending row', async () => {
    const { service } = forecastService([
      fixedRow({ userId: USER_A, groupId: 'g-rent', id: 't-rent', description: 'aluguel', month: '2026-08', amount: '50.00' }),
    ]);
    const result = await service.getForecast(USER_A, { from: '2026-08', months: 3 });
    const row = result.rows.find((r) => r.key === 'g-rent');
    expect(row?.cells.map((c) => c.amount)).toEqual(['50.00', '50.00', '50.00']);
  });

  it('(c) fixed with endDate yields null cells after termination', async () => {
    const { service } = forecastService([
      fixedRow({
        userId: USER_A,
        groupId: 'g-gym',
        id: 't-gym',
        description: 'academia',
        month: '2026-08',
        amount: '30.00',
        endDate: '2026-09',
      }),
    ]);
    const result = await service.getForecast(USER_A, { from: '2026-08', months: 3 });
    const row = result.rows.find((r) => r.key === 'g-gym');
    expect(row?.cells.map((c) => c.amount)).toEqual(['30.00', '30.00', null]);
  });

  it('(d) excludes income transactions', async () => {
    const { service } = forecastService([
      transactionEntity({
        id: 't-salary',
        userId: USER_A,
        description: 'salario',
        dueDate: new Date(Date.UTC(2026, 7, 1)),
        amount: '5000.00',
        recurrence: 'fixed',
        type: 'income',
        categoryId: CAT,
        accountId: ACC_ID,
        groupId: 'g-salary',
      }),
    ]);
    const result = await service.getForecast(USER_A, { from: '2026-08', months: 1 });
    expect(result.rows).toHaveLength(0);
  });

  it('(e) excludes single (non-recurring) transactions', async () => {
    const { service } = forecastService([
      transactionEntity({
        id: 't-single',
        userId: USER_A,
        description: 'compra unica',
        dueDate: new Date(Date.UTC(2026, 7, 1)),
        amount: '20.00',
        recurrence: 'single',
        type: 'expense',
        categoryId: CAT,
        accountId: ACC_ID,
        groupId: null,
      }),
    ]);
    const result = await service.getForecast(USER_A, { from: '2026-08', months: 1 });
    expect(result.rows).toHaveLength(0);
  });

  it('(f) scopes rows strictly to userId', async () => {
    const { service } = forecastService([
      fixedRow({ userId: USER_A, groupId: 'g-a', id: 't-a', description: 'a', month: '2026-08' }),
      fixedRow({ userId: USER_B, groupId: 'g-b', id: 't-b', description: 'b', month: '2026-08' }),
    ]);
    const result = await service.getForecast(USER_A, { from: '2026-08', months: 1 });
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.key).toBe('g-a');
  });

  it('(g) returns an empty result when the user has no installment/fixed expenses', async () => {
    const { service } = forecastService();
    const result = await service.getForecast(USER_A, { from: '2026-08', months: 3 });
    expect(result.rows).toEqual([]);
    expect(result.totals).toEqual([
      { month: '2026-08', amount: '0.00' },
      { month: '2026-09', amount: '0.00' },
      { month: '2026-10', amount: '0.00' },
    ]);
  });

  it('(h) sums non-null cells per month in the totals row', async () => {
    const { service } = forecastService([
      ...installmentGroup({ userId: USER_A, groupId: 'g-car', description: 'carro', startMonth: '2026-08', count: 1, amount: '100.00' }),
      fixedRow({ userId: USER_A, groupId: 'g-rent', id: 't-rent', description: 'aluguel', month: '2026-08', amount: '50.00' }),
    ]);
    const result = await service.getForecast(USER_A, { from: '2026-08', months: 2 });
    expect(result.totals).toEqual([
      { month: '2026-08', amount: '150.00' },
      { month: '2026-09', amount: '50.00' },
    ]);
  });
});

// --- synced import (service-to-service) ------------------------------------------------------

describe('TransactionsService synced import', () => {
  const DEFAULT_EXPENSE_CATEGORY = randomUUID();
  const CHOSEN_CATEGORY = randomUUID();
  const ACCOUNT_ID = randomUUID();

  function importSetup(withDefault = true) {
    const txRepo = makeFakeTransactionRepo();
    const categories = [categoryRow({ id: CHOSEN_CATEGORY, type: 'expense' })];
    if (withDefault) {
      categories.push(
        categoryRow({ id: DEFAULT_EXPENSE_CATEGORY, type: 'expense', name: 'Outros', isSystem: true }),
      );
    }
    const service = new TransactionsService(
      txRepo,
      makeFakeCategoryRepo(categories),
      makeFakeAccountRepo([accountRow(ACCOUNT_ID, USER_A)]),
      makeFakeCreditCardRepo(),
    );
    return { service, txRepo };
  }

  const findRow = (txRepo: FakeTransactionRepo, id: string) =>
    txRepo.findOne({ where: { id, userId: USER_A } });

  const baseInput: Omit<ImportSyncedTransactionInput, 'categoryId'> = {
    userId: USER_A,
    description: 'Supermercado',
    amount: '50.00',
    dueDate: new Date(Date.UTC(2026, 0, 10)).toISOString(),
    type: 'expense',
    accountId: ACCOUNT_ID,
    creditCardId: null,
    source: 'synced',
    externalId: randomUUID(),
    pluggyStatus: 'posted',
  };

  describe('create', () => {
    it('defaults to the type catch-all category when categoryId is omitted', async () => {
      const { service, txRepo } = importSetup();
      const result = await service.importSyncedCreate(baseInput);
      const stored = await findRow(txRepo, result.id);
      expect(stored?.categoryId).toBe(DEFAULT_EXPENSE_CATEGORY);
    });

    it('uses the given categoryId when provided', async () => {
      const { service, txRepo } = importSetup();
      const result = await service.importSyncedCreate({ ...baseInput, categoryId: CHOSEN_CATEGORY });
      const stored = await findRow(txRepo, result.id);
      expect(stored?.categoryId).toBe(CHOSEN_CATEGORY);
    });

    it('throws ReferenceNotFoundError when no default category exists for the type', async () => {
      const { service } = importSetup(false);
      await expect(service.importSyncedCreate(baseInput)).rejects.toBeInstanceOf(
        ReferenceNotFoundError,
      );
    });

    it('is idempotent by externalId, returning the existing transaction', async () => {
      const { service } = importSetup();
      const first = await service.importSyncedCreate(baseInput);
      const second = await service.importSyncedCreate(baseInput);
      expect(second.id).toBe(first.id);
    });

    it('throws SyncedImportConflictError when the same externalId is replayed with a different body', async () => {
      const { service } = importSetup();
      await service.importSyncedCreate(baseInput);
      await expect(
        service.importSyncedCreate({ ...baseInput, amount: '999.00' }),
      ).rejects.toBeInstanceOf(SyncedImportConflictError);
    });

    it('does not conflict on pluggyStatus alone, since it is not persisted', async () => {
      const { service } = importSetup();
      const first = await service.importSyncedCreate(baseInput);
      const second = await service.importSyncedCreate({ ...baseInput, pluggyStatus: 'pending' });
      expect(second.id).toBe(first.id);
    });

    it('accepts card installment metadata without throwing (US3)', async () => {
      const { service, txRepo } = importSetup();
      const result = await service.importSyncedCreate({
        ...baseInput,
        installmentNumber: 3,
        installmentCount: 12,
      });
      const stored = await findRow(txRepo, result.id);
      expect(stored?.installmentNumber).toBe(3);
      expect(stored?.installmentCount).toBe(12);
    });
  });

  describe('patch', () => {
    it('throws TransactionNotFoundError for an unknown externalId', async () => {
      const { service } = importSetup();
      await expect(service.importSyncedPatch(USER_A, randomUUID(), {})).rejects.toBeInstanceOf(
        TransactionNotFoundError,
      );
    });

    it('updates description and amount by externalId', async () => {
      const { service, txRepo } = importSetup();
      const created = await service.importSyncedCreate(baseInput);
      await service.importSyncedPatch(USER_A, baseInput.externalId, {
        description: 'Supermercado Central',
        amount: '55.00',
      });
      const stored = await findRow(txRepo, created.id);
      expect(stored?.description).toBe('Supermercado Central');
      expect(stored?.amount).toBe('55.00');
    });

    it('echoes the pending->posted transition without creating a second transaction (FR-009)', async () => {
      const { service, txRepo } = importSetup();
      const created = await service.importSyncedCreate({ ...baseInput, pluggyStatus: 'pending' });
      const result = await service.importSyncedPatch(USER_A, baseInput.externalId, {
        pluggyStatus: 'posted',
      });
      expect(result.id).toBe(created.id);
      expect(result.pluggyStatus).toBe('posted');
      expect(await findRow(txRepo, created.id)).not.toBeNull();
    });

    it('updates installmentNumber/installmentCount on the same row (US3)', async () => {
      const { service, txRepo } = importSetup();
      const created = await service.importSyncedCreate({
        ...baseInput,
        installmentNumber: 1,
        installmentCount: 12,
      });
      await service.importSyncedPatch(USER_A, baseInput.externalId, {
        installmentNumber: 2,
        installmentCount: 12,
      });
      const stored = await findRow(txRepo, created.id);
      expect(stored?.installmentNumber).toBe(2);
      expect(stored?.installmentCount).toBe(12);
    });
  });

  describe('delete', () => {
    it('throws TransactionNotFoundError for an unknown externalId', async () => {
      const { service } = importSetup();
      await expect(service.importSyncedDelete(USER_A, randomUUID())).rejects.toBeInstanceOf(
        TransactionNotFoundError,
      );
    });

    it('removes the transaction by externalId', async () => {
      const { service, txRepo } = importSetup();
      const created = await service.importSyncedCreate(baseInput);
      await service.importSyncedDelete(USER_A, baseInput.externalId);
      expect(await findRow(txRepo, created.id)).toBeNull();
    });
  });
});

// --- category suggestions (invoice import) -------------------------------------------------------

describe('TransactionsService.suggestCategories', () => {
  /** Service seeded with expense history rows for USER_A (and one for USER_B). */
  function suggestSetup(seed: TransactionEntity[]) {
    const txRepo = makeFakeTransactionRepo(seed);
    const categoryRepo = makeFakeCategoryRepo([
      categoryRow({ id: CAT_EXPENSE, type: 'expense' }),
    ]);
    const service = new TransactionsService(
      txRepo,
      categoryRepo,
      makeFakeAccountRepo(),
      makeFakeCreditCardRepo(),
    );
    return { service };
  }

  it('returns null for a description with no history', async () => {
    const { service } = suggestSetup([]);
    const result = await service.suggestCategories(USER_A, ['Mercado']);
    expect(result).toEqual([{ description: 'Mercado', categoryId: null }]);
  });

  it('matches on the normalized description (trim/case/spaces)', async () => {
    const { service } = suggestSetup([
      transactionEntity({
        userId: USER_A,
        description: 'Padaria  Do  Zé',
        categoryId: 'cat-food',
        type: 'expense',
      }),
    ]);
    const result = await service.suggestCategories(USER_A, ['  padaria do zé ']);
    expect(result[0]?.categoryId).toBe('cat-food');
    // the original text is echoed back unchanged
    expect(result[0]?.description).toBe('  padaria do zé ');
  });

  it('uses the most recent occurrence by dueDate', async () => {
    const { service } = suggestSetup([
      transactionEntity({
        userId: USER_A,
        description: 'Netflix',
        categoryId: 'cat-old',
        dueDate: new Date('2026-01-10T00:00:00.000Z'),
        type: 'expense',
      }),
      transactionEntity({
        userId: USER_A,
        description: 'Netflix',
        categoryId: 'cat-new',
        dueDate: new Date('2026-05-10T00:00:00.000Z'),
        type: 'expense',
      }),
    ]);
    const result = await service.suggestCategories(USER_A, ['Netflix']);
    expect(result[0]?.categoryId).toBe('cat-new');
  });

  it('does not leak another user history', async () => {
    const { service } = suggestSetup([
      transactionEntity({
        userId: USER_B,
        description: 'Uber',
        categoryId: 'cat-b',
        type: 'expense',
      }),
    ]);
    const result = await service.suggestCategories(USER_A, ['Uber']);
    expect(result[0]?.categoryId).toBeNull();
  });

  it('ignores income rows (only expense history counts)', async () => {
    const { service } = suggestSetup([
      transactionEntity({
        userId: USER_A,
        description: 'Salário',
        categoryId: 'cat-income',
        type: 'income',
      }),
    ]);
    const result = await service.suggestCategories(USER_A, ['Salário']);
    expect(result[0]?.categoryId).toBeNull();
  });

  it('resolves a batch, one row per requested description in order', async () => {
    const { service } = suggestSetup([
      transactionEntity({
        userId: USER_A,
        description: 'Mercado',
        categoryId: 'cat-market',
        type: 'expense',
      }),
    ]);
    const result = await service.suggestCategories(USER_A, ['Mercado', 'Desconhecido']);
    expect(result).toEqual([
      { description: 'Mercado', categoryId: 'cat-market' },
      { description: 'Desconhecido', categoryId: null },
    ]);
  });
});
