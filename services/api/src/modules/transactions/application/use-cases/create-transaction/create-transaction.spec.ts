import type { CreateTransactionInput } from '@finance/contracts';
import { CreateTransactionUseCase } from './create-transaction';
import { InvalidTransactionError, ReferenceNotFoundError } from '../../../domain/errors';
import {
  FakeAccountLookup,
  FakeCardLookup,
  FakeCategoryLookup,
  FakeTransactionRepository,
  USER_A,
} from '../test-fakes';

const CAT_EXPENSE = 'cat-expense';
const CAT_INCOME = 'cat-income';
const ACC = 'acc-1';
const CARD = 'card-1';

function makeUseCase() {
  const repo = new FakeTransactionRepository();
  const categories = new FakeCategoryLookup()
    .add(CAT_EXPENSE, 'expense')
    .add(CAT_INCOME, 'income');
  const accounts = new FakeAccountLookup().add(ACC, USER_A);
  const cards = new FakeCardLookup().add(CARD, USER_A);
  return {
    repo,
    useCase: new CreateTransactionUseCase(repo, categories, accounts, cards),
  };
}

const singleExpense: CreateTransactionInput = {
  recurrence: 'single',
  type: 'expense',
  description: 'Mercado',
  dueDate: '2026-01-10T00:00:00.000Z',
  amount: '100.00',
  categoryId: CAT_EXPENSE,
  accountId: ACC,
} as CreateTransactionInput;

describe('CreateTransactionUseCase (single)', () => {
  it('creates one row owned by the caller with a null groupId', async () => {
    const { useCase, repo } = makeUseCase();
    const [t] = await useCase.execute(USER_A, singleExpense);
    expect(t.userId).toBe(USER_A);
    expect(t.recurrence).toBe('single');
    expect(t.groupId).toBeNull();
    expect(t.status).toBe('pending');
    expect(repo.store.size).toBe(1);
  });

  it('accepts an expense paid by card', async () => {
    const { useCase } = makeUseCase();
    const [t] = await useCase.execute(USER_A, {
      ...singleExpense,
      accountId: undefined,
      creditCardId: CARD,
    } as CreateTransactionInput);
    expect(t.creditCardId).toBe(CARD);
    expect(t.accountId).toBeNull();
  });

  it('404s when the category does not belong to the user', async () => {
    const { useCase } = makeUseCase();
    await expect(
      useCase.execute(USER_A, { ...singleExpense, categoryId: 'ghost' } as CreateTransactionInput),
    ).rejects.toBeInstanceOf(ReferenceNotFoundError);
  });

  it('rejects a category whose type mismatches the transaction type', async () => {
    const { useCase } = makeUseCase();
    await expect(
      useCase.execute(USER_A, {
        ...singleExpense,
        categoryId: CAT_INCOME,
      } as CreateTransactionInput),
    ).rejects.toBeInstanceOf(InvalidTransactionError);
  });

  it('404s when the account belongs to another user', async () => {
    const { useCase } = makeUseCase();
    await expect(
      useCase.execute(USER_A, { ...singleExpense, accountId: 'someone-elses' } as CreateTransactionInput),
    ).rejects.toBeInstanceOf(ReferenceNotFoundError);
  });
});
