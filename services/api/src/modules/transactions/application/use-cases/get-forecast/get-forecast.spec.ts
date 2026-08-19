import { Transaction } from '../../../domain/transaction';
import { GetForecastUseCase } from './get-forecast';
import { FakeTransactionRepository, USER_A, USER_B } from '../test-fakes';

const CAT = 'cat-expense';
const ACC = 'acc-1';

function installmentGroup(opts: {
  userId: string;
  groupId: string;
  description: string;
  startMonth: string;
  count: number;
  amount?: string;
}): Transaction[] {
  const [year, month] = opts.startMonth.split('-').map(Number);
  return Array.from({ length: opts.count }, (_, i) =>
    Transaction.create({
      id: `${opts.groupId}-${i + 1}`,
      userId: opts.userId,
      description: opts.description,
      dueDate: new Date(Date.UTC(year as number, (month as number) - 1 + i, 1)),
      amount: opts.amount ?? '100.00',
      recurrence: 'installment',
      type: 'expense',
      categoryId: CAT,
      accountId: ACC,
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
}): Transaction {
  return Transaction.create({
    id: opts.id,
    userId: opts.userId,
    description: opts.description,
    dueDate: monthDate(opts.month),
    amount: opts.amount ?? '50.00',
    recurrence: 'fixed',
    type: 'expense',
    categoryId: CAT,
    accountId: ACC,
    endDate: opts.endDate ? monthDate(opts.endDate) : null,
    groupId: opts.groupId,
  });
}

function setup() {
  const repo = new FakeTransactionRepository();
  const useCase = new GetForecastUseCase(repo);
  return { repo, useCase };
}

describe('GetForecastUseCase', () => {
  it('(a) populates installment cells only within the group parcel range', async () => {
    const { repo, useCase } = setup();
    const group = installmentGroup({
      userId: USER_A,
      groupId: 'g-car',
      description: 'carro',
      startMonth: '2026-08',
      count: 3,
    });
    await repo.createMany(group);

    const result = await useCase.execute(USER_A, { from: '2026-08', months: 6 });

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
    const { repo, useCase } = setup();
    await repo.create(
      fixedRow({ userId: USER_A, groupId: 'g-rent', id: 't-rent', description: 'aluguel', month: '2026-08', amount: '50.00' }),
    );

    const result = await useCase.execute(USER_A, { from: '2026-08', months: 3 });

    const row = result.rows.find((r) => r.key === 'g-rent');
    expect(row?.cells.map((c) => c.amount)).toEqual(['50.00', '50.00', '50.00']);
  });

  it('(c) fixed with endDate yields null cells after termination', async () => {
    const { repo, useCase } = setup();
    await repo.create(
      fixedRow({
        userId: USER_A,
        groupId: 'g-gym',
        id: 't-gym',
        description: 'academia',
        month: '2026-08',
        amount: '30.00',
        endDate: '2026-09',
      }),
    );

    const result = await useCase.execute(USER_A, { from: '2026-08', months: 3 });

    const row = result.rows.find((r) => r.key === 'g-gym');
    expect(row?.cells.map((c) => c.amount)).toEqual(['30.00', '30.00', null]);
  });

  it('(d) excludes income transactions', async () => {
    const { repo, useCase } = setup();
    await repo.create(
      Transaction.create({
        id: 't-salary',
        userId: USER_A,
        description: 'salario',
        dueDate: new Date(Date.UTC(2026, 7, 1)),
        amount: '5000.00',
        recurrence: 'fixed',
        type: 'income',
        categoryId: CAT,
        accountId: ACC,
        groupId: 'g-salary',
      }),
    );

    const result = await useCase.execute(USER_A, { from: '2026-08', months: 1 });

    expect(result.rows).toHaveLength(0);
  });

  it('(e) excludes single (non-recurring) transactions', async () => {
    const { repo, useCase } = setup();
    await repo.create(
      Transaction.create({
        id: 't-single',
        userId: USER_A,
        description: 'compra unica',
        dueDate: new Date(Date.UTC(2026, 7, 1)),
        amount: '20.00',
        recurrence: 'single',
        type: 'expense',
        categoryId: CAT,
        accountId: ACC,
      }),
    );

    const result = await useCase.execute(USER_A, { from: '2026-08', months: 1 });

    expect(result.rows).toHaveLength(0);
  });

  it('(f) scopes rows strictly to userId', async () => {
    const { repo, useCase } = setup();
    await repo.create(
      fixedRow({ userId: USER_A, groupId: 'g-a', id: 't-a', description: 'a', month: '2026-08' }),
    );
    await repo.create(
      fixedRow({ userId: USER_B, groupId: 'g-b', id: 't-b', description: 'b', month: '2026-08' }),
    );

    const result = await useCase.execute(USER_A, { from: '2026-08', months: 1 });

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.key).toBe('g-a');
  });

  it('(g) returns an empty result when the user has no installment/fixed expenses', async () => {
    const { useCase } = setup();

    const result = await useCase.execute(USER_A, { from: '2026-08', months: 3 });

    expect(result.rows).toEqual([]);
    expect(result.totals).toEqual([
      { month: '2026-08', amount: '0.00' },
      { month: '2026-09', amount: '0.00' },
      { month: '2026-10', amount: '0.00' },
    ]);
  });

  it('(h) sums non-null cells per month in the totals row', async () => {
    const { repo, useCase } = setup();
    await repo.createMany(
      installmentGroup({ userId: USER_A, groupId: 'g-car', description: 'carro', startMonth: '2026-08', count: 1, amount: '100.00' }),
    );
    await repo.create(
      fixedRow({ userId: USER_A, groupId: 'g-rent', id: 't-rent', description: 'aluguel', month: '2026-08', amount: '50.00' }),
    );

    const result = await useCase.execute(USER_A, { from: '2026-08', months: 2 });

    expect(result.totals).toEqual([
      { month: '2026-08', amount: '150.00' },
      { month: '2026-09', amount: '50.00' },
    ]);
  });
});
