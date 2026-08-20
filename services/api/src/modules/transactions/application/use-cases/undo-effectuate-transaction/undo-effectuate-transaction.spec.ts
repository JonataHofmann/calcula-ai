import type { CreateTransactionInput } from '@finance/contracts';
import { CreateTransactionUseCase } from '../create-transaction/create-transaction';
import { EffectuateTransactionUseCase } from '../effectuate-transaction/effectuate-transaction';
import { UndoEffectuateTransactionUseCase } from './undo-effectuate-transaction';
import { NotPaidError, TransactionNotFoundError } from '../../../domain/errors';
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
    effectuate: new EffectuateTransactionUseCase(repo),
    undoEffectuate: new UndoEffectuateTransactionUseCase(repo),
  };
}

const single: CreateTransactionInput = {
  recurrence: 'single',
  type: 'expense',
  description: 'Aluguel',
  dueDate: '2026-01-10T00:00:00.000Z',
  amount: '1200.00',
  categoryId: CAT,
  accountId: ACC,
} as CreateTransactionInput;

describe('UndoEffectuateTransactionUseCase', () => {
  it('marks paid -> pending, clearing effective date/amount', async () => {
    const { create, effectuate, undoEffectuate } = setup();
    const [created] = await create.execute(USER_A, single);
    await effectuate.execute(USER_A, created.id, { amount: '1150.00' });

    const transaction = await undoEffectuate.execute(USER_A, created.id);

    expect(transaction.status).toBe('pending');
    expect(transaction.effectiveDate).toBeNull();
    expect(transaction.effectiveAmount).toBeNull();
  });

  it('blocks undoing a still-pending transaction', async () => {
    const { create, undoEffectuate } = setup();
    const [created] = await create.execute(USER_A, single);

    await expect(undoEffectuate.execute(USER_A, created.id)).rejects.toBeInstanceOf(NotPaidError);
  });

  it('404s when the transaction belongs to another user', async () => {
    const { create, effectuate, undoEffectuate } = setup();
    const [created] = await create.execute(USER_A, single);
    await effectuate.execute(USER_A, created.id, {});

    await expect(undoEffectuate.execute(USER_B, created.id)).rejects.toBeInstanceOf(
      TransactionNotFoundError,
    );
  });
});
