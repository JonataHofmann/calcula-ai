import type { CreateTransactionInput } from '@finance/contracts';
import { CreateTransactionUseCase } from '../create-transaction/create-transaction';
import { EffectuateTransactionUseCase } from './effectuate-transaction';
import {
  FakeAccountLookup,
  FakeCardLookup,
  FakeCategoryLookup,
  FakeTransactionRepository,
  USER_A,
} from '../test-fakes';

const CAT = 'cat-expense';
const ACC = 'acc-1';

function setup() {
  const repo = new FakeTransactionRepository();
  const categories = new FakeCategoryLookup().add(CAT, 'expense');
  const accounts = new FakeAccountLookup().add(ACC, USER_A);
  const cards = new FakeCardLookup();
  return {
    repo,
    create: new CreateTransactionUseCase(repo, categories, accounts, cards),
    effectuate: new EffectuateTransactionUseCase(repo),
  };
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

describe('EffectuateTransactionUseCase (fixed)', () => {
  it('materializes the next monthly pending occurrence in the same group', async () => {
    const { create, effectuate } = setup();
    const [created] = await create.execute(USER_A, fixed as CreateTransactionInput);

    const { transaction, next } = await effectuate.execute(USER_A, created.id, {});

    expect(transaction.status).toBe('paid');
    expect(next).not.toBeNull();
    expect(next?.status).toBe('pending');
    expect(next?.groupId).toBe(created.groupId);
    expect(next?.dueDate.toISOString()).toBe('2026-02-05T00:00:00.000Z');
  });

  it('does not generate a next occurrence past the end date', async () => {
    const { create, effectuate } = setup();
    const [created] = await create.execute(USER_A, {
      ...fixed,
      endDate: '2026-01-20T00:00:00.000Z',
    } as CreateTransactionInput);

    const { next } = await effectuate.execute(USER_A, created.id, {});
    expect(next).toBeNull();
  });
});
