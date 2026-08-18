import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type {
  CategoryOverride,
  CategoryOverrideRepository,
} from '../../../domain/category-override.repository';
import { UserCategoryOverrideEntity } from '../entities/user-category-override.entity';

@Injectable()
export class TypeOrmCategoryOverrideRepository implements CategoryOverrideRepository {
  constructor(
    @InjectRepository(UserCategoryOverrideEntity)
    private readonly repo: Repository<UserCategoryOverrideEntity>,
  ) {}

  async upsert(userId: string, override: CategoryOverride): Promise<void> {
    await this.repo.upsert(
      {
        userId,
        categoryId: override.categoryId,
        name: override.name,
        icon: override.icon,
        color: override.color,
      },
      ['userId', 'categoryId'],
    );
  }

  async revert(userId: string, categoryId: string): Promise<void> {
    await this.repo.delete({ userId, categoryId });
  }

  async findOne(userId: string, categoryId: string): Promise<CategoryOverride | null> {
    const row = await this.repo.findOne({ where: { userId, categoryId } });
    return row ? toOverride(row) : null;
  }

  async findByUser(userId: string): Promise<CategoryOverride[]> {
    const rows = await this.repo.find({ where: { userId } });
    return rows.map(toOverride);
  }
}

function toOverride(row: UserCategoryOverrideEntity): CategoryOverride {
  return {
    categoryId: row.categoryId,
    name: row.name,
    icon: row.icon,
    color: row.color,
  };
}
