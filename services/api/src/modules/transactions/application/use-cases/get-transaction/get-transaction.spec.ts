import type { CreateTransactionInput } from '@finance/contracts';
import { CreateTransactionUseCase } from '../create-transaction/create-transaction';
import { GetTransactionUseCase } from './get-transaction';
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
    create: new CreateTransactionUseCase(repo, categories, accounts, cards),
    get: new GetTransactionUseCase(repo),
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

describe('GetTransactionUseCase', () => {
  it('returns the caller-owned transaction', async () => {
    const { create, get } = setup();
    const [created] = await create.execute(USER_A, single);
    const found = await get.execute(USER_A, created.id);
    expect(found.id).toBe(created.id);
  });

  it('404s when the transaction belongs to another user', async () => {
    const { create, get } = setup();
    const [created] = await create.execute(USER_A, single);
    await expect(get.execute(USER_B, created.id)).rejects.toBeInstanceOf(
      TransactionNotFoundError,
    );
  });
});
