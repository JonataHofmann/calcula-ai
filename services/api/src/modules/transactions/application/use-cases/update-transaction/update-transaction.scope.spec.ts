import type { CreateTransactionInput } from '@finance/contracts';
import { CreateTransactionUseCase } from '../create-transaction/create-transaction';
import { EffectuateTransactionUseCase } from '../effectuate-transaction/effectuate-transaction';
import { UpdateTransactionUseCase } from './update-transaction';
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
    update: new UpdateTransactionUseCase(repo, categories, accounts, cards),
    effectuate: new EffectuateTransactionUseCase(repo),
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

/** Rows sorted by dueDate. */
async function group(repo: FakeTransactionRepository, groupId: string) {
  return repo.findGroup(groupId, USER_A);
}

describe('UpdateTransactionUseCase (group scope)', () => {
  it("scope 'one' touches only the target occurrence", async () => {
    const { create, update, repo } = setup();
    const rows = await create.execute(USER_A, installment as CreateTransactionInput);
    await update.execute(USER_A, rows[1].id, { description: 'Curso B' }, 'one');

    const g = await group(repo, rows[0].groupId as string);
    expect(g.map((t) => t.description)).toEqual(['Curso', 'Curso B', 'Curso', 'Curso']);
  });

  it("scope 'future' touches the target and every later occurrence", async () => {
    const { create, update, repo } = setup();
    const rows = await create.execute(USER_A, installment as CreateTransactionInput);
    await update.execute(USER_A, rows[1].id, { description: 'Novo' }, 'future');

    const g = await group(repo, rows[0].groupId as string);
    expect(g.map((t) => t.description)).toEqual(['Curso', 'Novo', 'Novo', 'Novo']);
  });

  it("scope 'all' touches every occurrence, including already-paid ones, preserving effectuation", async () => {
    const { create, update, effectuate, repo } = setup();
    const rows = await create.execute(USER_A, installment as CreateTransactionInput);
    await effectuate.execute(USER_A, rows[0].id, { amount: '100.00' });

    await update.execute(USER_A, rows[3].id, { amount: '120.00' }, 'all');

    const g = await group(repo, rows[0].groupId as string);
    expect(g.every((t) => t.amount === '120.00')).toBe(true);
    // paid row keeps its status and effectuation snapshot
    expect(g[0].status).toBe('paid');
    expect(g[0].effectiveAmount).toBe('100.00');
  });
});
