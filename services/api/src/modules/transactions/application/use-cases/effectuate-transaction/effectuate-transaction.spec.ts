import type { CreateTransactionInput } from '@finance/contracts';
import { CreateTransactionUseCase } from '../create-transaction/create-transaction';
import { EffectuateTransactionUseCase } from './effectuate-transaction';
import { AlreadyPaidError, TransactionNotFoundError } from '../../../domain/errors';
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

describe('EffectuateTransactionUseCase (single)', () => {
  it('marks pending -> paid and preserves the amount when none is given', async () => {
    const { create, effectuate } = setup();
    const [created] = await create.execute(USER_A, single);

    const { transaction, next } = await effectuate.execute(USER_A, created.id, {});

    expect(transaction.status).toBe('paid');
    expect(transaction.effectiveAmount).toBe('1200.00');
    expect(transaction.effectiveDate).toBeInstanceOf(Date);
    expect(next).toBeNull();
  });

  it('honors an explicit effective date and amount', async () => {
    const { create, effectuate } = setup();
    const [created] = await create.execute(USER_A, single);

    const { transaction } = await effectuate.execute(USER_A, created.id, {
      date: '2026-01-15T00:00:00.000Z',
      amount: '1150.00',
    });

    expect(transaction.effectiveAmount).toBe('1150.00');
    expect(transaction.effectiveDate?.toISOString()).toBe('2026-01-15T00:00:00.000Z');
  });

  it('blocks effectuating an already-paid transaction', async () => {
    const { create, effectuate } = setup();
    const [created] = await create.execute(USER_A, single);
    await effectuate.execute(USER_A, created.id, {});

    await expect(effectuate.execute(USER_A, created.id, {})).rejects.toBeInstanceOf(
      AlreadyPaidError,
    );
  });

  it('404s when the transaction belongs to another user', async () => {
    const { create, effectuate } = setup();
    const [created] = await create.execute(USER_A, single);

    await expect(effectuate.execute(USER_B, created.id, {})).rejects.toBeInstanceOf(
      TransactionNotFoundError,
    );
  });
});
