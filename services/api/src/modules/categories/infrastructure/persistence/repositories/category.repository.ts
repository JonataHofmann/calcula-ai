import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import type { CategoryType } from '@finance/contracts';
import { Category } from '../../../domain/category';
import type { CategoryRepository } from '../../../domain/category.repository';
import { CategoryEntity } from '../entities/category.entity';

@Injectable()
export class TypeOrmCategoryRepository implements CategoryRepository {
  constructor(
    @InjectRepository(CategoryEntity)
    private readonly repo: Repository<CategoryEntity>,
  ) {}

  async create(category: Category): Promise<void> {
    await this.repo.insert(toEntity(category));
  }

  async save(category: Category): Promise<void> {
    await this.repo.save(toEntity(category));
  }

  async findSystem(): Promise<Category[]> {
    const rows = await this.repo.find({
      where: { ownerId: IsNull() },
      order: { createdAt: 'ASC' },
    });
    return rows.map(toDomain);
  }

  async findAllByOwner(userId: string): Promise<Category[]> {
    const rows = await this.repo.find({
      where: { ownerId: userId },
      order: { createdAt: 'ASC' },
    });
    return rows.map(toDomain);
  }

  async findAccessible(id: string, userId: string): Promise<Category | null> {
    const row = await this.repo.findOne({
      where: [
        { id, ownerId: userId },
        { id, ownerId: IsNull() },
      ],
    });
    return row ? toDomain(row) : null;
  }

  async deleteWithDescendants(id: string, userId: string): Promise<void> {
    await this.repo.manager.transaction(async (manager) => {
      const owned = await manager.find(CategoryEntity, {
        where: { ownerId: userId },
        select: { id: true, parentId: true },
      });
      const childrenOf = new Map<string, string[]>();
      for (const row of owned) {
        if (!row.parentId) continue;
        const list = childrenOf.get(row.parentId) ?? [];
        list.push(row.id);
        childrenOf.set(row.parentId, list);
      }
      // Only delete when the target is actually owned by the user.
      if (!owned.some((row) => row.id === id)) return;

      const ids: string[] = [];
      const stack = [id];
      while (stack.length > 0) {
        const current = stack.pop() as string;
        ids.push(current);
        stack.push(...(childrenOf.get(current) ?? []));
      }
      await manager.delete(CategoryEntity, { id: In(ids), ownerId: userId });
    });
  }
}

function toEntity(category: Category): CategoryEntity {
  const entity = new CategoryEntity();
  entity.id = category.id;
  entity.ownerId = category.ownerId;
  entity.parentId = category.parentId;
  entity.name = category.name;
  entity.type = category.type;
  entity.icon = category.icon;
  entity.color = category.color;
  entity.isSystem = category.isSystem;
  entity.createdAt = category.createdAt;
  entity.updatedAt = category.updatedAt;
  return entity;
}

function toDomain(row: CategoryEntity): Category {
  return Category.restore({
    id: row.id,
    ownerId: row.ownerId,
    parentId: row.parentId,
    name: row.name,
    type: row.type as CategoryType,
    icon: row.icon,
    color: row.color,
    isSystem: row.isSystem,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}
