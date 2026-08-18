import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { HiddenCategoryRepository } from '../../../domain/hidden-category.repository';
import { UserHiddenCategoryEntity } from '../entities/user-hidden-category.entity';

@Injectable()
export class TypeOrmHiddenCategoryRepository implements HiddenCategoryRepository {
  constructor(
    @InjectRepository(UserHiddenCategoryEntity)
    private readonly repo: Repository<UserHiddenCategoryEntity>,
  ) {}

  async hide(userId: string, categoryId: string): Promise<void> {
    // Idempotent: a second hide of the same category is silently ignored.
    await this.repo
      .createQueryBuilder()
      .insert()
      .values({ userId, categoryId })
      .orIgnore()
      .execute();
  }

  async unhide(userId: string, categoryId: string): Promise<void> {
    await this.repo.delete({ userId, categoryId });
  }

  async findHiddenIds(userId: string): Promise<string[]> {
    const rows = await this.repo.find({
      where: { userId },
      select: { categoryId: true },
    });
    return rows.map((row) => row.categoryId);
  }
}
