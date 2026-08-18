import { RevertCategoryOverrideUseCase } from './revert-category-override.use-case';
import { CategoryConflictError, CategoryNotFoundError } from '../../../domain/errors';
import {
  InMemoryCategoryOverrideRepository,
  InMemoryCategoryRepository,
  customCategory,
  systemCategory,
} from '../__testing__/in-memory-repositories';

const USER = 'user-1';

function setup() {
  const categories = new InMemoryCategoryRepository([
    systemCategory({ id: 'sys-food', name: 'Alimentação', type: 'expense' }),
    customCategory({ id: 'cus-pets', ownerId: USER, name: 'Pets', type: 'expense' }),
  ]);
  const overrides = new InMemoryCategoryOverrideRepository();
  const useCase = new RevertCategoryOverrideUseCase(categories, overrides);
  return { useCase, overrides };
}

describe('RevertCategoryOverrideUseCase', () => {
  it('drops an existing override', async () => {
    const { useCase, overrides } = setup();
    await overrides.upsert(USER, { categoryId: 'sys-food', name: 'Comida', icon: 'pizza', color: 'warning' });

    await useCase.execute(USER, 'sys-food');

    expect(await overrides.findOne(USER, 'sys-food')).toBeNull();
  });

  it('is idempotent when no override exists', async () => {
    const { useCase, overrides } = setup();
    await useCase.execute(USER, 'sys-food');
    expect(await overrides.findByUser(USER)).toEqual([]);
  });

  it('rejects reverting a custom category', async () => {
    const { useCase } = setup();
    await expect(useCase.execute(USER, 'cus-pets')).rejects.toBeInstanceOf(CategoryConflictError);
  });

  it('throws for an unknown category', async () => {
    const { useCase } = setup();
    await expect(useCase.execute(USER, 'nope')).rejects.toBeInstanceOf(CategoryNotFoundError);
  });
});
