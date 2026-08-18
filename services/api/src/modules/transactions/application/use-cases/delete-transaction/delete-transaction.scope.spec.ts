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

const installment = {
  recurrence: 'installment',
  type: 'expense',
  description: 'Curso',
  dueDate: '2026-01-10T00:00:00.000Z',
  amount: '100.00',
  installmentCount: 4,
  categoryId: CAT,
  accountId: ACC,
};

describe('DeleteTransactionUseCase (group scope)', () => {
  it("scope 'one' removes only the target row", async () => {
    const { create, del, repo } = setup();
    const rows = await create.execute(USER_A, installment as CreateTransactionInput);
    await del.execute(USER_A, rows[1].id, 'one');
    expect(repo.store.size).toBe(3);
  });

  it("scope 'future' removes the target and later rows", async () => {
    const { create, del, repo } = setup();
    const rows = await create.execute(USER_A, installment as CreateTransactionInput);
    await del.execute(USER_A, rows[1].id, 'future');
    expect(repo.store.size).toBe(1);
  });

  it("scope 'all' removes the whole group", async () => {
    const { create, del, repo } = setup();
    const rows = await create.execute(USER_A, installment as CreateTransactionInput);
    await del.execute(USER_A, rows[2].id, 'all');
    expect(repo.store.size).toBe(0);
  });

  it('deleting a missing transaction 404s', async () => {
    const { del } = setup();
    await expect(del.execute(USER_A, 'ghost', 'all')).rejects.toBeInstanceOf(
      TransactionNotFoundError,
    );
  });
});
