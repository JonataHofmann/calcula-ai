import { Inject, Injectable } from '@nestjs/common';
import {
  CATEGORY_REPOSITORY,
  type CategoryRepository,
} from '../../../domain/category.repository';
import {
  CATEGORY_OVERRIDE_REPOSITORY,
  type CategoryOverrideRepository,
} from '../../../domain/category-override.repository';
import { CategoryConflictError, CategoryNotFoundError } from '../../../domain/errors';

/** Drops the user's copy-on-write override so the original default values apply again. Idempotent. */
@Injectable()
export class RevertCategoryOverrideUseCase {
  constructor(
    @Inject(CATEGORY_REPOSITORY) private readonly categories: CategoryRepository,
    @Inject(CATEGORY_OVERRIDE_REPOSITORY)
    private readonly overrides: CategoryOverrideRepository,
  ) {}

  async execute(userId: string, id: string): Promise<void> {
    const category = await this.categories.findAccessible(id, userId);
    if (!category) throw new CategoryNotFoundError(id);
    if (!category.isSystem) {
      throw new CategoryConflictError('Only default categories have overrides');
    }
    await this.overrides.revert(userId, id);
  }
}
