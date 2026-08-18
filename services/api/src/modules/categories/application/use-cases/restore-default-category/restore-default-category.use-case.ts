import { Inject, Injectable } from '@nestjs/common';
import {
  CATEGORY_REPOSITORY,
  type CategoryRepository,
} from '../../../domain/category.repository';
import {
  HIDDEN_CATEGORY_REPOSITORY,
  type HiddenCategoryRepository,
} from '../../../domain/hidden-category.repository';
import { CategoryConflictError, CategoryNotFoundError } from '../../../domain/errors';

/** Un-hides a previously hidden system default category for the user. Idempotent. */
@Injectable()
export class RestoreDefaultCategoryUseCase {
  constructor(
    @Inject(CATEGORY_REPOSITORY) private readonly categories: CategoryRepository,
    @Inject(HIDDEN_CATEGORY_REPOSITORY) private readonly hidden: HiddenCategoryRepository,
  ) {}

  async execute(userId: string, id: string): Promise<void> {
    const category = await this.categories.findAccessible(id, userId);
    if (!category) throw new CategoryNotFoundError(id);
    if (!category.isSystem) {
      throw new CategoryConflictError('Only default categories can be restored');
    }
    await this.hidden.unhide(userId, id);
  }
}
