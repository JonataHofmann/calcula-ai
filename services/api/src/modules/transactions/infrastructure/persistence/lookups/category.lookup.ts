import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import type { TransactionType } from '@finance/contracts';
import { CategoryEntity } from '../../../../categories/infrastructure/persistence/entities/category.entity';
import type { CategoryLookup } from '../../../domain/lookups';

/** Read-only lookup over `categories`. System categories (owner null) are visible to all. */
@Injectable()
export class TypeOrmCategoryLookup implements CategoryLookup {
  constructor(
    @InjectRepository(CategoryEntity)
    private readonly repo: Repository<CategoryEntity>,
  ) {}

  async findType(id: string, userId: string): Promise<TransactionType | null> {
    const own = await this.repo.findOne({ where: { id, ownerId: userId } });
    const row = own ?? (await this.repo.findOne({ where: { id, ownerId: IsNull() } }));
    return row ? (row.type as TransactionType) : null;
  }
}
