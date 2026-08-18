import { AddSubcategoryUseCase } from './add-subcategory.use-case';
import { CategoryNotFoundError } from '../../../domain/errors';
import {
  InMemoryCategoryRepository,
  customCategory,
  systemCategory,
} from '../__testing__/in-memory-repositories';

const USER = 'user-1';

function setup() {
  const categories = new InMemoryCategoryRepository([
    systemCategory({ id: 'sys-food', name: 'Alimentação', type: 'expense' }),
    customCategory({ id: 'other', ownerId: 'user-2', name: 'Alheia', type: 'income' }),
  ]);
  const useCase = new AddSubcategoryUseCase(categories);
  return { useCase, categories };
}

describe('AddSubcategoryUseCase', () => {
  it('creates a custom subcategory owned by the user under a system parent', async () => {
    const { useCase, categories } = setup();

    const sub = await useCase.execute(USER, 'sys-food', { name: 'Padaria', icon: 'utensils', color: 'primary' });

    expect(sub.ownerId).toBe(USER);
    expect(sub.parentId).toBe('sys-food');
    expect(sub.isSystem).toBe(false);
    expect(categories.snapshot().some((c) => c.id === sub.id)).toBe(true);
  });

  it('inherits the type from the parent', async () => {
    const { useCase } = setup();

    const sub = await useCase.execute(USER, 'sys-food', { name: 'Padaria', icon: 'utensils', color: 'primary' });

    expect(sub.type).toBe('expense');
  });

  it('throws when the parent is not accessible', async () => {
    const { useCase } = setup();
    await expect(
      useCase.execute(USER, 'other', { name: 'x', icon: 'utensils', color: 'primary' }),
    ).rejects.toBeInstanceOf(CategoryNotFoundError);
  });
});
