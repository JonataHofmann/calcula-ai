import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { CreateSubcategoryInput } from '@finance/contracts';
import { Category } from '../../../domain/category';
import {
  CATEGORY_REPOSITORY,
  type CategoryRepository,
} from '../../../domain/category.repository';
import { CategoryNotFoundError } from '../../../domain/errors';

/** Adds a custom subcategory under a parent (system or custom). Type is inherited from the parent. */
@Injectable()
export class AddSubcategoryUseCase {
  constructor(
    @Inject(CATEGORY_REPOSITORY) private readonly categories: CategoryRepository,
  ) {}

  async execute(
    userId: string,
    parentId: string,
    input: CreateSubcategoryInput,
  ): Promise<Category> {
    const parent = await this.categories.findAccessible(parentId, userId);
    if (!parent) throw new CategoryNotFoundError(parentId);

    const subcategory = Category.createSubcategory({
      id: randomUUID(),
      ownerId: userId,
      parent,
      name: input.name,
      icon: input.icon,
      color: input.color,
    });
    await this.categories.create(subcategory);
    return subcategory;
  }
}
