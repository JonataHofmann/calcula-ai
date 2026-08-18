import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { CreateCategoryInput } from '@finance/contracts';
import { Category } from '../../../domain/category';
import {
  CATEGORY_REPOSITORY,
  type CategoryRepository,
} from '../../../domain/category.repository';

@Injectable()
export class CreateCustomCategoryUseCase {
  constructor(
    @Inject(CATEGORY_REPOSITORY) private readonly categories: CategoryRepository,
  ) {}

  async execute(userId: string, input: CreateCategoryInput): Promise<Category> {
    const category = Category.create({
      id: randomUUID(),
      ownerId: userId,
      name: input.name,
      type: input.type,
      icon: input.icon,
      color: input.color,
    });
    await this.categories.create(category);
    return category;
  }
}
