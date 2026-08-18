import type { CreateTransactionInput, ListTransactionsQuery } from '@finance/contracts';
import { CreateTransactionUseCase } from '../create-transaction/create-transaction';
import { ListTransactionsUseCase } from './list-transactions';
import {
  FakeAccountLookup,
  FakeCardLookup,
  FakeCategoryLookup,
  FakeTransactionRepository,
  USER_A,
  USER_B,
} from '../test-fakes';

const CAT = 'cat-expense';
const ACC = 'acc-1';

function setup() {
  const repo = new FakeTransactionRepository();
  const categories = new FakeCategoryLookup().add(CAT, 'expense');
  const accounts = new FakeAccountLookup().add(ACC, USER_A).add(ACC, USER_B);
  const cards = new FakeCardLookup();
  return {
    create: new CreateTransactionUseCase(repo, categories, accounts, cards),
    list: new ListTransactionsUseCase(repo),
  };
}

function single(dueDate: string, over: Partial<CreateTransactionInput> = {}): CreateTransactionInput {
  return {
    recurrence: 'single',
    type: 'expense',
    description: 'Item',
    dueDate,
    amount: '10.00',
    categoryId: CAT,
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

describe('ListTransactionsUseCase', () => {
  it('returns only rows whose dueDate is within the month window', async () => {
    const { create, list } = setup();
    await create.execute(USER_A, single('2026-01-15T00:00:00.000Z'));
    await create.execute(USER_A, single('2026-02-03T00:00:00.000Z'));
    const rows = await list.execute(USER_A, janQuery);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.dueDate.toISOString()).toBe('2026-01-15T00:00:00.000Z');
  });

  it('isolates rows by user', async () => {
    const { create, list } = setup();
    await create.execute(USER_A, single('2026-01-10T00:00:00.000Z'));
    await create.execute(USER_B, single('2026-01-11T00:00:00.000Z'));
    const rows = await list.execute(USER_A, janQuery);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.userId).toBe(USER_A);
  });
});
