import type { CreateTransactionInput } from '@finance/contracts';
import { CreateTransactionUseCase } from './create-transaction';
import {
  FakeAccountLookup,
  FakeCardLookup,
  FakeCategoryLookup,
  FakeTransactionRepository,
  USER_A,
} from '../test-fakes';
import { toCents } from '../../../domain/recurrence';

const CAT = 'cat-expense';
const ACC = 'acc-1';

function makeUseCase() {
  const repo = new FakeTransactionRepository();
  const categories = new FakeCategoryLookup().add(CAT, 'expense');
  const accounts = new FakeAccountLookup().add(ACC, USER_A);
  const cards = new FakeCardLookup();
  return { repo, useCase: new CreateTransactionUseCase(repo, categories, accounts, cards) };
}

const base = {
  recurrence: 'installment',
  type: 'expense',
  description: 'Notebook',
  dueDate: '2026-01-15T00:00:00.000Z',
  categoryId: CAT,
  accountId: ACC,
};

describe('CreateTransactionUseCase (installment)', () => {
  it('creates N rows sharing a groupId with 1-based numbering and monthly due dates', async () => {
    const { useCase } = makeUseCase();
    const rows = await useCase.execute(USER_A, {
      ...base,
      installmentCount: 3,
      amount: '100.00',
    } as CreateTransactionInput);

    expect(rows).toHaveLength(3);
    const groupIds = new Set(rows.map((r) => r.groupId));
    expect(groupIds.size).toBe(1);
    expect(rows.map((r) => r.installmentNumber)).toEqual([1, 2, 3]);
    expect(rows.every((r) => r.installmentCount === 3)).toBe(true);
    expect(rows.map((r) => r.dueDate.toISOString())).toEqual([
      '2026-01-15T00:00:00.000Z',
      '2026-02-15T00:00:00.000Z',
      '2026-03-15T00:00:00.000Z',
    ]);
  });

  it('splits a total amount so the parcels sum back to the total', async () => {
    const { useCase } = makeUseCase();
    const rows = await useCase.execute(USER_A, {
      ...base,
      installmentCount: 3,
      totalAmount: '100.00',
    } as CreateTransactionInput);

    const sum = rows.reduce((acc, r) => acc + toCents(r.amount), 0);
    expect(sum).toBe(toCents('100.00'));
    // last parcel absorbs the rounding remainder
    expect(rows.map((r) => r.amount)).toEqual(['33.33', '33.33', '33.34']);
  });
});
