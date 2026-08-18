import type { CreateTransactionInput } from '@finance/contracts';
import { CreateTransactionUseCase } from '../create-transaction/create-transaction';
import { DeleteTransactionUseCase } from './delete-transaction';
import { TransactionNotFoundError } from '../../../domain/errors';
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
  const accounts = new FakeAccountLookup().add(ACC, USER_A);
  const cards = new FakeCardLookup();
  return {
    repo,
    create: new CreateTransactionUseCase(repo, categories, accounts, cards),
    del: new DeleteTransactionUseCase(repo),
  };
}

const single: CreateTransactionInput = {
  recurrence: 'single',
  type: 'expense',
  description: 'Item',
  dueDate: '2026-01-10T00:00:00.000Z',
  amount: '10.00',
  categoryId: CAT,
  accountId: ACC,
} as CreateTransactionInput;

describe('DeleteTransactionUseCase (single)', () => {
  it('removes the caller-owned occurrence', async () => {
    const { create, del, repo } = setup();
    const [created] = await create.execute(USER_A, single);
    await del.execute(USER_A, created.id);
    expect(repo.store.size).toBe(0);
  });

  it('404s and leaves the row intact when another user attempts delete', async () => {
    const { create, del, repo } = setup();
    const [created] = await create.execute(USER_A, single);
    await expect(del.execute(USER_B, created.id)).rejects.toBeInstanceOf(
      TransactionNotFoundError,
    );
    expect(repo.store.size).toBe(1);
  });
});
