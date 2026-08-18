import { ListEffectiveCategoriesUseCase } from './list-effective-categories.use-case';
import {
  InMemoryCategoryOverrideRepository,
  InMemoryCategoryRepository,
  InMemoryHiddenCategoryRepository,
  customCategory,
  systemCategory,
} from '../__testing__/in-memory-repositories';

const USER = 'user-1';

function setup(seed = {
  categories: [
    systemCategory({ id: 'sys-food', name: 'Alimentação', type: 'expense' }),
    systemCategory({ id: 'sys-food-mkt', name: 'Mercado', type: 'expense', parentId: 'sys-food' }),
    systemCategory({ id: 'sys-salary', name: 'Salário', type: 'income' }),
    customCategory({ id: 'cus-pets', ownerId: USER, name: 'Pets', type: 'expense' }),
  ],
}) {
  const categories = new InMemoryCategoryRepository(seed.categories);
  const hidden = new InMemoryHiddenCategoryRepository();
  const overrides = new InMemoryCategoryOverrideRepository();
  const useCase = new ListEffectiveCategoriesUseCase(categories, hidden, overrides);
  return { useCase, categories, hidden, overrides };
}

describe('ListEffectiveCategoriesUseCase', () => {
  it('groups defaults and custom categories by type with correct sources', async () => {
    const { useCase } = setup();
    const tree = await useCase.execute(USER);

    expect(tree.expense.map((n) => n.name)).toEqual(['Alimentação', 'Pets']);
    expect(tree.income.map((n) => n.name)).toEqual(['Salário']);

    const food = tree.expense.find((n) => n.id === 'sys-food');
    expect(food?.source).toBe('default');
    expect(food?.children.map((c) => c.name)).toEqual(['Mercado']);

    const pets = tree.expense.find((n) => n.id === 'cus-pets');
    expect(pets?.source).toBe('custom');
  });

  it('excludes system categories hidden by the user', async () => {
    const { useCase, hidden } = setup();
    await hidden.hide(USER, 'sys-food');

    const tree = await useCase.execute(USER);
    expect(tree.expense.map((n) => n.id)).toEqual(['cus-pets']);
  });

  it('excludes a hidden system subcategory but keeps its parent', async () => {
    const { useCase, hidden } = setup();
    await hidden.hide(USER, 'sys-food-mkt');

    const tree = await useCase.execute(USER);
    const food = tree.expense.find((n) => n.id === 'sys-food');
    expect(food?.children).toEqual([]);
  });

  it('applies overrides to name/icon/color and marks the source, never the type', async () => {
    const { useCase, overrides } = setup();
    await overrides.upsert(USER, {
      categoryId: 'sys-food',
      name: 'Comida',
      icon: 'pizza',
      color: 'warning',
    });

    const tree = await useCase.execute(USER);
    const food = tree.expense.find((n) => n.id === 'sys-food');
    expect(food?.name).toBe('Comida');
    expect(food?.icon).toBe('pizza');
    expect(food?.color).toBe('warning');
    expect(food?.source).toBe('default-overridden');
    expect(food?.type).toBe('expense');
  });

  it('does not leak another users custom categories', async () => {
    const { useCase, categories } = setup();
    await categories.create(
      customCategory({ id: 'other', ownerId: 'user-2', name: 'Segredo', type: 'expense' }),
    );

    const tree = await useCase.execute(USER);
    expect(tree.expense.some((n) => n.id === 'other')).toBe(false);
  });
});
