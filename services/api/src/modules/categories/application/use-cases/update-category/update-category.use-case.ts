import { Inject, Injectable } from '@nestjs/common';
import type { CategoryNodeDto, UpdateCategoryInput } from '@finance/contracts';
import {
  CATEGORY_REPOSITORY,
  type CategoryRepository,
} from '../../../domain/category.repository';
import {
  CATEGORY_OVERRIDE_REPOSITORY,
  type CategoryOverride,
  type CategoryOverrideRepository,
} from '../../../domain/category-override.repository';
import { CategoryNotFoundError, InvalidCategoryError } from '../../../domain/errors';

/**
 * Edits a category. Custom categories are mutated in place; system defaults become a
 * per-user copy-on-write override (the original stays intact for everyone else). `type`
 * is never changed.
 */
@Injectable()
export class UpdateCategoryUseCase {
  constructor(
    @Inject(CATEGORY_REPOSITORY) private readonly categories: CategoryRepository,
    @Inject(CATEGORY_OVERRIDE_REPOSITORY)
    private readonly overrides: CategoryOverrideRepository,
  ) {}

  async execute(
    userId: string,
    id: string,
    input: UpdateCategoryInput,
  ): Promise<CategoryNodeDto> {
    const category = await this.categories.findAccessible(id, userId);
    if (!category) throw new CategoryNotFoundError(id);

    if (!category.isSystem) {
      category.update(input);
      await this.categories.save(category);
      return {
        id: category.id,
        name: category.name,
        icon: category.icon,
        color: category.color,
        type: category.type,
        source: 'custom',
        children: [],
      } as CategoryNodeDto;
    }

    // Copy-on-write: seed from the existing override or the system defaults, then patch.
    const existing = await this.overrides.findOne(userId, id);
    const merged: CategoryOverride = {
      categoryId: id,
      name: input.name ?? existing?.name ?? category.name,
      icon: input.icon ?? existing?.icon ?? category.icon,
      color: input.color ?? existing?.color ?? category.color,
    };
    assertOverride(merged);
    await this.overrides.upsert(userId, merged);

    return {
      id: category.id,
      name: merged.name,
      icon: merged.icon,
      color: merged.color,
      type: category.type,
      source: 'default-overridden',
      children: [],
    } as CategoryNodeDto;
  }
}

function assertOverride(override: CategoryOverride): void {
  if (override.name.trim().length === 0) {
    throw new InvalidCategoryError('Category name must not be empty');
  }
}
