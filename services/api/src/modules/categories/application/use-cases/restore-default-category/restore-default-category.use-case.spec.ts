import { RestoreDefaultCategoryUseCase } from './restore-default-category.use-case';
import { CategoryConflictError, CategoryNotFoundError } from '../../../domain/errors';
import {
  InMemoryCategoryRepository,
  InMemoryHiddenCategoryRepository,
  customCategory,
  systemCategory,
} from '../__testing__/in-memory-repositories';

const USER = 'user-1';

function setup() {
  const categories = new InMemoryCategoryRepository([
    systemCategory({ id: 'sys-food', name: 'Alimentação', type: 'expense' }),
    customCategory({ id: 'cus-pets', ownerId: USER, name: 'Pets', type: 'expense' }),
  ]);
  const hidden = new InMemoryHiddenCategoryRepository();
  const useCase = new RestoreDefaultCategoryUseCase(categories, hidden);
  return { useCase, hidden };
}

describe('RestoreDefaultCategoryUseCase', () => {
  it('un-hides a previously hidden default', async () => {
    const { useCase, hidden } = setup();
    await hidden.hide(USER, 'sys-food');

    await useCase.execute(USER, 'sys-food');

    expect(hidden.isHidden(USER, 'sys-food')).toBe(false);
  });

  it('is idempotent when nothing was hidden', async () => {
    const { useCase, hidden } = setup();
    await useCase.execute(USER, 'sys-food');
    expect(await hidden.findHiddenIds(USER)).toEqual([]);
  });

  it('rejects restoring a custom category', async () => {
    const { useCase } = setup();
    await expect(useCase.execute(USER, 'cus-pets')).rejects.toBeInstanceOf(CategoryConflictError);
  });

  it('throws for an unknown category', async () => {
    const { useCase } = setup();
    await expect(useCase.execute(USER, 'nope')).rejects.toBeInstanceOf(CategoryNotFoundError);
  });
});
