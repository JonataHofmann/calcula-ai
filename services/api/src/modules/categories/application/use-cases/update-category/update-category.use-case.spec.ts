import { UpdateCategoryUseCase } from './update-category.use-case';
import { CategoryNotFoundError } from '../../../domain/errors';
import {
  InMemoryCategoryOverrideRepository,
  InMemoryCategoryRepository,
  customCategory,
  systemCategory,
} from '../__testing__/in-memory-repositories';

const USER = 'user-1';

function setup() {
  const categories = new InMemoryCategoryRepository([
    systemCategory({ id: 'sys-food', name: 'Alimentação', type: 'expense', icon: 'utensils', color: 'danger' }),
    customCategory({ id: 'cus-pets', ownerId: USER, name: 'Pets', type: 'expense' }),
    customCategory({ id: 'other', ownerId: 'user-2', name: 'Alheia', type: 'expense' }),
  ]);
  const overrides = new InMemoryCategoryOverrideRepository();
  const useCase = new UpdateCategoryUseCase(categories, overrides);
  return { useCase, categories, overrides };
}

describe('UpdateCategoryUseCase', () => {
  it('edits a custom category in place (no override row)', async () => {
    const { useCase, categories, overrides } = setup();

    const node = await useCase.execute(USER, 'cus-pets', { name: 'Animais' });

    expect(node.source).toBe('custom');
    expect(node.name).toBe('Animais');
    const stored = categories.snapshot().find((c) => c.id === 'cus-pets');
    expect(stored?.name).toBe('Animais');
    expect(await overrides.findOne(USER, 'cus-pets')).toBeNull();
  });

  it('writes a copy-on-write override for a system default without mutating it', async () => {
    const { useCase, categories, overrides } = setup();

    const node = await useCase.execute(USER, 'sys-food', { name: 'Comida', color: 'warning' });

    expect(node.source).toBe('default-overridden');
    expect(node.name).toBe('Comida');
    expect(node.color).toBe('warning');
    // Original system row is untouched.
    const stored = categories.snapshot().find((c) => c.id === 'sys-food');
    expect(stored?.name).toBe('Alimentação');
    expect(stored?.color).toBe('danger');
    // Override carries the untouched fields too (full copy-on-write).
    const override = await overrides.findOne(USER, 'sys-food');
    expect(override).toEqual({
      categoryId: 'sys-food',
      name: 'Comida',
      icon: 'utensils',
      color: 'warning',
    });
  });

  it('merges successive edits into the same override', async () => {
    const { useCase, overrides } = setup();

    await useCase.execute(USER, 'sys-food', { name: 'Comida' });
    await useCase.execute(USER, 'sys-food', { icon: 'pizza' });

    const override = await overrides.findOne(USER, 'sys-food');
    expect(override?.name).toBe('Comida');
    expect(override?.icon).toBe('pizza');
  });

  it('treats another user\'s category as not found', async () => {
    const { useCase } = setup();
    await expect(useCase.execute(USER, 'other', { name: 'x' })).rejects.toBeInstanceOf(
      CategoryNotFoundError,
    );
  });
});
