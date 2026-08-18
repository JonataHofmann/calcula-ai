import type { CreateTransactionInput } from '@finance/contracts';
import { CreateTransactionUseCase } from '../create-transaction/create-transaction';
import { EffectuateTransactionUseCase } from '../effectuate-transaction/effectuate-transaction';
import { ListOverdueUseCase } from './list-overdue';
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
    repo,
    create: new CreateTransactionUseCase(repo, categories, accounts, cards),
    effectuate: new EffectuateTransactionUseCase(repo),
    overdue: new ListOverdueUseCase(repo),
  };
}

function single(due: string, over: Partial<CreateTransactionInput> = {}): CreateTransactionInput {
  return {
    recurrence: 'single',
    type: 'expense',
    description: 'Conta',
    dueDate: due,
    amount: '100.00',
    categoryId: CAT,
    accountId: ACC,
    ...over,
  } as CreateTransactionInput;
}

// Start of the current month, per the frontend's timezone computation.
const BEFORE = '2026-02-01T00:00:00.000Z';

describe('ListOverdueUseCase', () => {
  it('returns pending occurrences due before the boundary, scoped to the user', async () => {
    const { create, overdue } = setup();
    await create.execute(USER_A, single('2026-01-10T00:00:00.000Z')); // overdue
    await create.execute(USER_A, single('2026-02-15T00:00:00.000Z')); // current month, not overdue
    await create.execute(USER_B, single('2026-01-05T00:00:00.000Z')); // other user

    const rows = await overdue.execute(USER_A, { before: BEFORE });
    expect(rows).toHaveLength(1);
    expect(rows[0].dueDate.toISOString()).toBe('2026-01-10T00:00:00.000Z');
  });

  it('excludes already-paid past occurrences', async () => {
    const { create, effectuate, overdue } = setup();
    const [paid] = await create.execute(USER_A, single('2026-01-10T00:00:00.000Z'));
    await effectuate.execute(USER_A, paid.id, {});

    expect(await overdue.execute(USER_A, { before: BEFORE })).toHaveLength(0);
  });
});
