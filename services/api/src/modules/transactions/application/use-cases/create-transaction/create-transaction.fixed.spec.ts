import type { CreateTransactionInput } from '@finance/contracts';
import { CreateTransactionUseCase } from './create-transaction';
import {
  FakeAccountLookup,
  FakeCardLookup,
  FakeCategoryLookup,
  FakeTransactionRepository,
  USER_A,
} from '../test-fakes';

const CAT = 'cat-expense';
const ACC = 'acc-1';

function makeUseCase() {
  const repo = new FakeTransactionRepository();
  const categories = new FakeCategoryLookup().add(CAT, 'expense');
  const accounts = new FakeAccountLookup().add(ACC, USER_A);
  const cards = new FakeCardLookup();
  return { repo, useCase: new CreateTransactionUseCase(repo, categories, accounts, cards) };
}

const fixed = {
  recurrence: 'fixed',
  type: 'expense',
  description: 'Aluguel',
  dueDate: '2026-01-05T00:00:00.000Z',
  amount: '1500.00',
  categoryId: CAT,
  accountId: ACC,
};

describe('CreateTransactionUseCase (fixed)', () => {
  it('creates one row carrying a groupId so future occurrences can join', async () => {
    const { useCase, repo } = makeUseCase();
    const [t] = await useCase.execute(USER_A, fixed as CreateTransactionInput);

    expect(repo.store.size).toBe(1);
    expect(t.recurrence).toBe('fixed');
    expect(t.groupId).not.toBeNull();
    expect(t.endDate).toBeNull();
  });

  it('keeps an optional end date on the fixed occurrence', async () => {
    const { useCase } = makeUseCase();
    const [t] = await useCase.execute(USER_A, {
      ...fixed,
      endDate: '2026-12-05T00:00:00.000Z',
    } as CreateTransactionInput);

    expect(t.endDate?.toISOString()).toBe('2026-12-05T00:00:00.000Z');
  });
});
