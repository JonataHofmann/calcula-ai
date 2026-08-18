import { DeleteCategoryUseCase } from './delete-category.use-case';
import { CategoryNotFoundError } from '../../../domain/errors';
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
    customCategory({ id: 'cus-pets-vet', ownerId: USER, name: 'Veterinário', type: 'expense', parentId: 'cus-pets' }),
    customCategory({ id: 'other', ownerId: 'user-2', name: 'Alheia', type: 'expense' }),
  ]);
  const hidden = new InMemoryHiddenCategoryRepository();
  const useCase = new DeleteCategoryUseCase(categories, hidden);
  return { useCase, categories, hidden };
}

describe('DeleteCategoryUseCase', () => {
  it('deletes a custom category together with its descendants', async () => {
    const { useCase, categories } = setup();

    await useCase.execute(USER, 'cus-pets');

    const ids = categories.snapshot().map((c) => c.id);
    expect(ids).not.toContain('cus-pets');
    expect(ids).not.toContain('cus-pets-vet');
  });

  it('hides a system default for the user without deleting the row', async () => {
    const { useCase, categories, hidden } = setup();

    await useCase.execute(USER, 'sys-food');

    expect(categories.snapshot().some((c) => c.id === 'sys-food')).toBe(true);
    expect(hidden.isHidden(USER, 'sys-food')).toBe(true);
  });

  it('hiding a system default twice is idempotent', async () => {
    const { useCase, hidden } = setup();

    await useCase.execute(USER, 'sys-food');
    await useCase.execute(USER, 'sys-food');

    expect(await hidden.findHiddenIds(USER)).toEqual(['sys-food']);
  });

  it('treats another user\'s category as not found', async () => {
    const { useCase } = setup();
    await expect(useCase.execute(USER, 'other')).rejects.toBeInstanceOf(CategoryNotFoundError);
  });
});
