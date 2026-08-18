import type { CreateTransactionInput } from '@finance/contracts';
import { CreateTransactionUseCase } from '../create-transaction/create-transaction';
import { UpdateTransactionUseCase } from './update-transaction';
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
    update: new UpdateTransactionUseCase(repo, categories, accounts, cards),
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

describe('UpdateTransactionUseCase (single)', () => {
  it('applies editable fields to the single occurrence', async () => {
    const { create, update } = setup();
    const [created] = await create.execute(USER_A, single);
    const [updated] = await update.execute(USER_A, created.id, {
      description: 'Novo nome',
      amount: '25.00',
    });
    expect(updated.description).toBe('Novo nome');
    expect(updated.amount).toBe('25.00');
  });

  it('404s when the transaction belongs to another user', async () => {
    const { create, update } = setup();
    const [created] = await create.execute(USER_A, single);
    await expect(
      update.execute(USER_B, created.id, { description: 'x' }),
    ).rejects.toBeInstanceOf(TransactionNotFoundError);
  });
});
