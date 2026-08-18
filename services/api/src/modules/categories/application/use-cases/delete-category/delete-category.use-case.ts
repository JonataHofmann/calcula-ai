import { Inject, Injectable } from '@nestjs/common';
import {
  CATEGORY_REPOSITORY,
  type CategoryRepository,
} from '../../../domain/category.repository';
import {
  HIDDEN_CATEGORY_REPOSITORY,
  type HiddenCategoryRepository,
} from '../../../domain/hidden-category.repository';
import { CategoryNotFoundError } from '../../../domain/errors';

/**
 * Removes a category for the acting user. A custom category is deleted outright
 * (with its owned descendants); a system default is hidden only for this user.
 */
@Injectable()
export class DeleteCategoryUseCase {
  constructor(
    @Inject(CATEGORY_REPOSITORY) private readonly categories: CategoryRepository,
    @Inject(HIDDEN_CATEGORY_REPOSITORY) private readonly hidden: HiddenCategoryRepository,
  ) {}

  async execute(userId: string, id: string): Promise<void> {
    const category = await this.categories.findAccessible(id, userId);
    if (!category) throw new CategoryNotFoundError(id);

    if (category.isSystem) {
      await this.hidden.hide(userId, id);
    } else {
      await this.categories.deleteWithDescendants(id, userId);
    }
  }
}
