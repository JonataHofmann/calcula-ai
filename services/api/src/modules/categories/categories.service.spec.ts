import type { Repository } from 'typeorm';
import { CategoriesService } from './categories.service';
import { CategoryConflictError, CategoryNotFoundError } from './categories.types';
import {
  makeFakeCategoryRepo,
  makeFakeHiddenRepo,
  makeFakeOverrideRepo,
  makeFakeTransactionRepo,
  customCategory,
  systemCategory,
} from './__testing__/in-memory-repositories';
import type { TransactionEntity } from '../transactions/entities/transaction.entity';

const USER = 'user-1';

function setup(
  seed = [
    systemCategory({ id: 'sys-food', name: 'Alimentação', type: 'expense', icon: 'utensils', color: 'danger' }),
    systemCategory({ id: 'sys-food-mkt', name: 'Mercado', type: 'expense', parentId: 'sys-food' }),
    systemCategory({ id: 'sys-salary', name: 'Salário', type: 'income' }),
    customCategory({ id: 'cus-pets', ownerId: USER, name: 'Pets', type: 'expense' }),
  ],
  txSeed: TransactionEntity[] = [],
) {
  const categoryRepo = makeFakeCategoryRepo(seed);
  const hiddenRepo = makeFakeHiddenRepo();
  const overrideRepo = makeFakeOverrideRepo();
  const txRepo = makeFakeTransactionRepo(txSeed);
  const service = new CategoriesService(categoryRepo, hiddenRepo, overrideRepo, txRepo);
  return { service, categoryRepo, hiddenRepo, overrideRepo, txRepo };
}

const txStore = (txRepo: Repository<TransactionEntity>): TransactionEntity[] =>
  (txRepo as unknown as { __store: () => TransactionEntity[] }).__store();

describe('CategoriesService.list', () => {
  it('groups defaults and custom categories by type with correct sources', async () => {
    const { service } = setup();
    const tree = await service.list(USER);

    expect(tree.expense.map((n) => n.name)).toEqual(['Alimentação', 'Pets']);
    expect(tree.income.map((n) => n.name)).toEqual(['Salário']);

    const food = tree.expense.find((n) => n.id === 'sys-food');
    expect(food?.source).toBe('default');
    expect(food?.children.map((c) => c.name)).toEqual(['Mercado']);

    const pets = tree.expense.find((n) => n.id === 'cus-pets');
    expect(pets?.source).toBe('custom');
  });

  it('excludes system categories hidden by the user', async () => {
    const { service } = setup();
    await service.delete(USER, 'sys-food');

    const tree = await service.list(USER);
    expect(tree.expense.map((n) => n.id)).toEqual(['cus-pets']);
  });

  it('excludes a hidden system subcategory but keeps its parent', async () => {
    const { service } = setup();
    await service.delete(USER, 'sys-food-mkt');

    const tree = await service.list(USER);
    const food = tree.expense.find((n) => n.id === 'sys-food');
    expect(food?.children).toEqual([]);
  });

  it('applies overrides to name/icon/color and marks the source, never the type', async () => {
    const { service } = setup();
    await service.update(USER, 'sys-food', { name: 'Comida', icon: 'pizza', color: 'warning' });

    const tree = await service.list(USER);
    const food = tree.expense.find((n) => n.id === 'sys-food');
    expect(food?.name).toBe('Comida');
    expect(food?.icon).toBe('pizza');
    expect(food?.color).toBe('warning');
    expect(food?.source).toBe('default-overridden');
    expect(food?.type).toBe('expense');
  });

  it('does not leak another user’s custom categories', async () => {
    const { service, categoryRepo } = setup();
    await categoryRepo.insert(
      customCategory({ id: 'other', ownerId: 'user-2', name: 'Segredo', type: 'expense' }),
    );

    const tree = await service.list(USER);
    expect(tree.expense.some((n) => n.id === 'other')).toBe(false);
  });
});

describe('CategoriesService.addSubcategory', () => {
  it('creates a custom subcategory under a system parent, inheriting the type', async () => {
    const { service } = setup();
    const sub = await service.addSubcategory(USER, 'sys-food', {
      name: 'Padaria',
      icon: 'utensils',
      color: 'primary',
    });

    expect(sub.source).toBe('custom');
    expect(sub.type).toBe('expense');
    // Color is inherited from the parent (sys-food = 'danger'), never the input.
    expect(sub.color).toBe('danger');

    const tree = await service.list(USER);
    const food = tree.expense.find((n) => n.id === 'sys-food');
    expect(food?.children.some((c) => c.id === sub.id)).toBe(true);
    expect(food?.children.find((c) => c.id === sub.id)?.color).toBe('danger');
  });

  it('re-colors an existing subcategory when the parent color changes', async () => {
    const { service } = setup();
    const sub = await service.addSubcategory(USER, 'sys-food', {
      name: 'Padaria',
      icon: 'utensils',
      color: 'primary',
    });
    // Override the parent's color; the child must follow it in the tree.
    await service.update(USER, 'sys-food', { color: 'warning' });

    const tree = await service.list(USER);
    const food = tree.expense.find((n) => n.id === 'sys-food');
    expect(food?.color).toBe('warning');
    expect(food?.children.find((c) => c.id === sub.id)?.color).toBe('warning');
  });

  it('throws when the parent is not accessible', async () => {
    const { service, categoryRepo } = setup();
    await categoryRepo.insert(
      customCategory({ id: 'other', ownerId: 'user-2', name: 'Alheia', type: 'income' }),
    );
    await expect(
      service.addSubcategory(USER, 'other', { name: 'x', icon: 'utensils', color: 'primary' }),
    ).rejects.toBeInstanceOf(CategoryNotFoundError);
  });
});

describe('CategoriesService.update', () => {
  it('edits a custom category in place (no override row)', async () => {
    const { service, overrideRepo } = setup();
    const node = await service.update(USER, 'cus-pets', { name: 'Animais' });

    expect(node.source).toBe('custom');
    expect(node.name).toBe('Animais');
    expect(await overrideRepo.findOne({ where: { userId: USER, categoryId: 'cus-pets' } })).toBeNull();
  });

  it('writes a copy-on-write override for a system default without mutating it', async () => {
    const { service, categoryRepo, overrideRepo } = setup();
    const node = await service.update(USER, 'sys-food', { name: 'Comida', color: 'warning' });

    expect(node.source).toBe('default-overridden');
    expect(node.name).toBe('Comida');
    expect(node.color).toBe('warning');
    // Original system row is untouched.
    const stored = await categoryRepo.findOne({ where: { id: 'sys-food' } });
    expect(stored?.name).toBe('Alimentação');
    expect(stored?.color).toBe('danger');
    // Override carries the untouched fields too (full copy-on-write).
    const override = await overrideRepo.findOne({ where: { userId: USER, categoryId: 'sys-food' } });
    expect(override).toMatchObject({
      categoryId: 'sys-food',
      name: 'Comida',
      icon: 'utensils',
      color: 'warning',
    });
  });

  it('merges successive edits into the same override', async () => {
    const { service, overrideRepo } = setup();
    await service.update(USER, 'sys-food', { name: 'Comida' });
    await service.update(USER, 'sys-food', { icon: 'pizza' });

    const override = await overrideRepo.findOne({ where: { userId: USER, categoryId: 'sys-food' } });
    expect(override?.name).toBe('Comida');
    expect(override?.icon).toBe('pizza');
    expect(await overrideRepo.find({ where: { userId: USER } })).toHaveLength(1);
  });

  it("treats another user's category as not found", async () => {
    const { service, categoryRepo } = setup();
    await categoryRepo.insert(
      customCategory({ id: 'other', ownerId: 'user-2', name: 'Alheia', type: 'expense' }),
    );
    await expect(service.update(USER, 'other', { name: 'x' })).rejects.toBeInstanceOf(
      CategoryNotFoundError,
    );
  });
});

describe('CategoriesService.delete', () => {
  it('deletes a custom category together with its descendants', async () => {
    const seed = [
      customCategory({ id: 'cus-pets', ownerId: USER, name: 'Pets', type: 'expense' }),
      customCategory({ id: 'cus-pets-vet', ownerId: USER, name: 'Veterinário', type: 'expense', parentId: 'cus-pets' }),
    ];
    const { service, categoryRepo } = setup(seed);
    await service.delete(USER, 'cus-pets');

    const remaining = (await categoryRepo.find({ where: { ownerId: USER } })).map((c) => c.id);
    expect(remaining).not.toContain('cus-pets');
    expect(remaining).not.toContain('cus-pets-vet');
  });

  it('hides a system default for the user without deleting the row', async () => {
    const { service, categoryRepo, hiddenRepo } = setup();
    await service.delete(USER, 'sys-food');

    expect(await categoryRepo.findOne({ where: { id: 'sys-food' } })).not.toBeNull();
    expect(
      await hiddenRepo.findOne({ where: { userId: USER, categoryId: 'sys-food' } }),
    ).not.toBeNull();
  });

  it('hiding a system default twice is idempotent', async () => {
    const { service, hiddenRepo } = setup();
    await service.delete(USER, 'sys-food');
    await service.delete(USER, 'sys-food');

    expect((await hiddenRepo.find({ where: { userId: USER } })).map((h) => h.categoryId)).toEqual([
      'sys-food',
    ]);
  });

  it("treats another user's category as not found", async () => {
    const { service, categoryRepo } = setup();
    await categoryRepo.insert(
      customCategory({ id: 'other', ownerId: 'user-2', name: 'Alheia', type: 'expense' }),
    );
    await expect(service.delete(USER, 'other')).rejects.toBeInstanceOf(CategoryNotFoundError);
  });

  it('counts transactions across the subtree, scoped to the user', async () => {
    const tx = (id: string, categoryId: string, userId: string) =>
      ({ id, categoryId, userId }) as TransactionEntity;
    const { service } = setup(undefined, [
      tx('t1', 'sys-food', USER),
      tx('t2', 'sys-food-mkt', USER), // descendant of sys-food
      tx('t3', 'sys-food', 'user-2'), // other user
      tx('t4', 'sys-salary', USER), // unrelated subtree
    ]);
    expect(await service.countTransactions(USER, 'sys-food')).toBe(2);
  });

  it('keeps subtree transactions by default but cascades them when the flag is set', async () => {
    const tx = (id: string, categoryId: string) =>
      ({ id, categoryId, userId: USER }) as TransactionEntity;
    const seedTx = [tx('t1', 'sys-food'), tx('t2', 'sys-food-mkt'), tx('t3', 'sys-salary')];

    const kept = setup(undefined, seedTx);
    await kept.service.delete(USER, 'sys-food');
    expect(txStore(kept.txRepo)).toHaveLength(3);

    const gone = setup(undefined, seedTx);
    await gone.service.delete(USER, 'sys-food', true);
    // both sys-food rows removed, unrelated sys-salary row kept
    expect(txStore(gone.txRepo).map((t) => t.id)).toEqual(['t3']);
  });
});

describe('CategoriesService.restore', () => {
  it('un-hides a previously hidden default', async () => {
    const { service, hiddenRepo } = setup();
    await service.delete(USER, 'sys-food');
    await service.restore(USER, 'sys-food');

    expect(
      await hiddenRepo.findOne({ where: { userId: USER, categoryId: 'sys-food' } }),
    ).toBeNull();
  });

  it('is idempotent when nothing was hidden', async () => {
    const { service, hiddenRepo } = setup();
    await service.restore(USER, 'sys-food');
    expect(await hiddenRepo.find({ where: { userId: USER } })).toEqual([]);
  });

  it('rejects restoring a custom category', async () => {
    const { service } = setup();
    await expect(service.restore(USER, 'cus-pets')).rejects.toBeInstanceOf(CategoryConflictError);
  });

  it('throws for an unknown category', async () => {
    const { service } = setup();
    await expect(service.restore(USER, 'nope')).rejects.toBeInstanceOf(CategoryNotFoundError);
  });
});

describe('CategoriesService.revert', () => {
  it('drops an existing override', async () => {
    const { service, overrideRepo } = setup();
    await service.update(USER, 'sys-food', { name: 'Comida' });
    await service.revert(USER, 'sys-food');

    expect(
      await overrideRepo.findOne({ where: { userId: USER, categoryId: 'sys-food' } }),
    ).toBeNull();
  });

  it('is idempotent when no override exists', async () => {
    const { service, overrideRepo } = setup();
    await service.revert(USER, 'sys-food');
    expect(await overrideRepo.find({ where: { userId: USER } })).toEqual([]);
  });

  it('rejects reverting a custom category', async () => {
    const { service } = setup();
    await expect(service.revert(USER, 'cus-pets')).rejects.toBeInstanceOf(CategoryConflictError);
  });

  it('throws for an unknown category', async () => {
    const { service } = setup();
    await expect(service.revert(USER, 'nope')).rejects.toBeInstanceOf(CategoryNotFoundError);
  });
});
