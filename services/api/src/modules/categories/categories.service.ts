import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import {
  isColorToken,
  isIconKey,
  type CategoryNodeDto,
  type CategoryTreeDto,
  type CategoryType,
  type CreateCategoryInput,
  type CreateSubcategoryInput,
  type UpdateCategoryInput,
} from '@finance/contracts';
import { CategoryEntity } from './entities/category.entity';
import { TransactionEntity } from '../transactions/entities/transaction.entity';
import { UserHiddenCategoryEntity } from './entities/user-hidden-category.entity';
import { UserCategoryOverrideEntity } from './entities/user-category-override.entity';
import { CategoryConverter } from './converters/category.converter';
import {
  CategoryConflictError,
  CategoryNotFoundError,
  InvalidCategoryError,
  type CategoryOverride,
} from './categories.types';

interface BuildContext {
  childrenOf: Map<string, CategoryEntity[]>;
  hidden: Set<string>;
  overrides: Map<string, CategoryOverride>;
}

/**
 * All business logic for the categories module (7 folded use-cases). Persistence
 * is accessed exclusively via the three injected TypeORM repositories (FR-008,
 * FR-009). System defaults have `ownerId === null` and are shared by everyone;
 * custom categories are scoped by owner; per-user hides and copy-on-write
 * overrides personalise the shared defaults without mutating them.
 */
@Injectable()
export class CategoriesService {
  private readonly logger = new Logger(CategoriesService.name);

  constructor(
    @InjectRepository(CategoryEntity)
    private readonly categoryRepo: Repository<CategoryEntity>,
    @InjectRepository(UserHiddenCategoryEntity)
    private readonly hiddenRepo: Repository<UserHiddenCategoryEntity>,
    @InjectRepository(UserCategoryOverrideEntity)
    private readonly overrideRepo: Repository<UserCategoryOverrideEntity>,
    @InjectRepository(TransactionEntity)
    private readonly txRepo: Repository<TransactionEntity>,
  ) {}

  /** Effective tree: system defaults (not hidden, overrides applied) ∪ the user's custom categories. */
  async list(userId: string): Promise<CategoryTreeDto> {
    this.logger.log(`Listing effective categories for user ${userId}`);
    const [system, custom, hiddenIds, overrideRows] = await Promise.all([
      this.findSystem(),
      this.findAllByOwner(userId),
      this.findHiddenIds(userId),
      this.findOverrides(userId),
    ]);

    const all = [...system, ...custom].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
    );

    const ctx: BuildContext = {
      childrenOf: new Map(),
      hidden: new Set(hiddenIds),
      overrides: new Map(overrideRows.map((o) => [o.categoryId, o])),
    };
    for (const cat of all) {
      if (cat.parentId === null) continue;
      const siblings = ctx.childrenOf.get(cat.parentId) ?? [];
      siblings.push(cat);
      ctx.childrenOf.set(cat.parentId, siblings);
    }

    const roots = all.filter((c) => c.parentId === null && this.isVisible(c, ctx));
    const tree: CategoryTreeDto = {
      expense: roots.filter((c) => c.type === 'expense').map((c) => this.buildNode(c, ctx)),
      income: roots.filter((c) => c.type === 'income').map((c) => this.buildNode(c, ctx)),
    };
    this.logger.log(`Listed categories for user ${userId}`);
    return tree;
  }

  /** Create a custom root category owned by the user. */
  async create(userId: string, input: CreateCategoryInput): Promise<CategoryNodeDto> {
    this.logger.log(`Creating category "${input.name}" for user ${userId}`);
    const name = this.assertName(input.name);
    this.assertType(input.type);
    this.assertCatalog(input.icon, input.color);

    const now = new Date();
    const entity = this.categoryRepo.create({
      id: randomUUID(),
      ownerId: userId,
      parentId: null,
      name,
      type: input.type,
      icon: input.icon,
      color: input.color,
      isSystem: false,
      createdAt: now,
      updatedAt: now,
    });
    await this.categoryRepo.insert(entity);
    this.logger.log(`Created category ${entity.id} for user ${userId}`);
    return CategoryConverter.toNode(entity, { source: 'custom' });
  }

  /** Add a custom subcategory under an accessible parent; type is inherited, never accepted. */
  async addSubcategory(
    userId: string,
    parentId: string,
    input: CreateSubcategoryInput,
  ): Promise<CategoryNodeDto> {
    this.logger.log(`Adding subcategory under ${parentId} for user ${userId}`);
    const parent = await this.findAccessible(parentId, userId);
    if (!parent) {
      this.logger.warn(`Parent category ${parentId} not found for user ${userId}`);
      throw new CategoryNotFoundError(parentId);
    }
    const name = this.assertName(input.name);
    if (!isIconKey(input.icon)) throw new InvalidCategoryError(`Unknown icon: ${input.icon}`);

    const now = new Date();
    const entity = this.categoryRepo.create({
      id: randomUUID(),
      ownerId: userId,
      parentId: parent.id,
      name,
      type: parent.type,
      icon: input.icon,
      // Subcategory color is always inherited from the parent, never taken from input.
      color: parent.color,
      isSystem: false,
      createdAt: now,
      updatedAt: now,
    });
    await this.categoryRepo.insert(entity);
    this.logger.log(`Added subcategory ${entity.id} for user ${userId}`);
    return CategoryConverter.toNode(entity, { source: 'custom' });
  }

  /**
   * Edit a category. Custom categories are mutated in place; system defaults become a
   * per-user copy-on-write override (the original stays intact for everyone else). `type`
   * is never changed.
   */
  async update(
    userId: string,
    id: string,
    input: UpdateCategoryInput,
  ): Promise<CategoryNodeDto> {
    this.logger.log(`Updating category ${id} for user ${userId}`);
    const category = await this.findAccessible(id, userId);
    if (!category) {
      this.logger.warn(`Category ${id} not found for user ${userId}`);
      throw new CategoryNotFoundError(id);
    }

    if (!category.isSystem) {
      if (input.name !== undefined) category.name = this.assertName(input.name);
      if (input.icon !== undefined) {
        if (!isIconKey(input.icon)) throw new InvalidCategoryError(`Unknown icon: ${input.icon}`);
        category.icon = input.icon;
      }
      // Subcategories inherit the parent's color; only roots may set their own.
      if (input.color !== undefined && category.parentId === null) {
        if (!isColorToken(input.color)) {
          throw new InvalidCategoryError(`Unknown color: ${input.color}`);
        }
        category.color = input.color;
      }
      category.updatedAt = new Date();
      await this.categoryRepo.save(category);
      this.logger.log(`Updated custom category ${id} for user ${userId}`);
      return CategoryConverter.toNode(category, { source: 'custom' });
    }

    // Copy-on-write: seed from the existing override or the system defaults, then patch.
    const existing = await this.findOverride(userId, id);
    const merged: CategoryOverride = {
      categoryId: id,
      name: input.name ?? existing?.name ?? category.name,
      icon: input.icon ?? existing?.icon ?? category.icon,
      color: input.color ?? existing?.color ?? category.color,
    };
    if (merged.name.trim().length === 0) {
      throw new InvalidCategoryError('Category name must not be empty');
    }
    await this.overrideRepo.upsert(
      {
        userId,
        categoryId: merged.categoryId,
        name: merged.name,
        icon: merged.icon,
        color: merged.color,
      },
      ['userId', 'categoryId'],
    );
    this.logger.log(`Wrote override for default category ${id} for user ${userId}`);
    return CategoryConverter.toNode(category, { source: 'default-overridden', override: merged });
  }

  /** Number of transactions linked to this category's subtree (for the delete confirmation). */
  async countTransactions(userId: string, id: string): Promise<number> {
    const category = await this.findAccessible(id, userId);
    if (!category) throw new CategoryNotFoundError(id);
    const subtreeIds = await this.collectSubtreeIds(id, userId);
    return this.txRepo.count({ where: { categoryId: In(subtreeIds), userId } });
  }

  /** A custom category is deleted with its owned descendants; a system default is hidden for this user. */
  async delete(userId: string, id: string, deleteTransactions = false): Promise<void> {
    this.logger.log(`Deleting category ${id} for user ${userId}`);
    const category = await this.findAccessible(id, userId);
    if (!category) {
      this.logger.warn(`Category ${id} not found for user ${userId}`);
      throw new CategoryNotFoundError(id);
    }
    // Optionally cascade the whole subtree's transactions before removing the categories.
    if (deleteTransactions) {
      const subtreeIds = await this.collectSubtreeIds(id, userId);
      const { affected } = await this.txRepo.delete({ categoryId: In(subtreeIds), userId });
      this.logger.log(`Deleted ${affected ?? 0} transaction(s) of category subtree ${id} for user ${userId}`);
    }
    if (category.isSystem) {
      await this.hide(userId, id);
    } else {
      await this.deleteWithDescendants(id, userId);
    }
    this.logger.log(`Deleted category ${id} for user ${userId}`);
  }

  /** Un-hide a previously hidden system default for the user. Idempotent. */
  async restore(userId: string, id: string): Promise<void> {
    this.logger.log(`Restoring default category ${id} for user ${userId}`);
    const category = await this.findAccessible(id, userId);
    if (!category) {
      this.logger.warn(`Category ${id} not found for user ${userId}`);
      throw new CategoryNotFoundError(id);
    }
    if (!category.isSystem) {
      throw new CategoryConflictError('Only default categories can be restored');
    }
    await this.hiddenRepo.delete({ userId, categoryId: id });
  }

  /** Drop the user's copy-on-write override so the original default values apply again. Idempotent. */
  async revert(userId: string, id: string): Promise<void> {
    this.logger.log(`Reverting override for category ${id} for user ${userId}`);
    const category = await this.findAccessible(id, userId);
    if (!category) {
      this.logger.warn(`Category ${id} not found for user ${userId}`);
      throw new CategoryNotFoundError(id);
    }
    if (!category.isSystem) {
      throw new CategoryConflictError('Only default categories have overrides');
    }
    await this.overrideRepo.delete({ userId, categoryId: id });
  }

  // --- persistence helpers (folded from the removed custom repositories) ---

  private async findSystem(): Promise<CategoryEntity[]> {
    return this.categoryRepo.find({ where: { ownerId: IsNull() }, order: { createdAt: 'ASC' } });
  }

  private async findAllByOwner(userId: string): Promise<CategoryEntity[]> {
    return this.categoryRepo.find({ where: { ownerId: userId }, order: { createdAt: 'ASC' } });
  }

  /** A category the user may act on: a system default, or one they own. `null` otherwise. */
  private async findAccessible(id: string, userId: string): Promise<CategoryEntity | null> {
    const row = await this.categoryRepo.findOne({ where: { id } });
    if (!row) return null;
    return row.ownerId === userId || row.ownerId === null ? row : null;
  }

  /**
   * The subtree rooted at `id` (id + all descendants) across every category accessible
   * to the user — system defaults ∪ owned rows — so transaction cascades cover custom
   * subcategories hung under a default parent too.
   */
  private async collectSubtreeIds(id: string, userId: string): Promise<string[]> {
    const accessible = [...(await this.findSystem()), ...(await this.findAllByOwner(userId))];
    const childrenOf = new Map<string, string[]>();
    for (const row of accessible) {
      if (!row.parentId) continue;
      const list = childrenOf.get(row.parentId) ?? [];
      list.push(row.id);
      childrenOf.set(row.parentId, list);
    }
    const ids: string[] = [];
    const stack = [id];
    while (stack.length > 0) {
      const current = stack.pop() as string;
      ids.push(current);
      stack.push(...(childrenOf.get(current) ?? []));
    }
    return ids;
  }

  private async deleteWithDescendants(id: string, userId: string): Promise<void> {
    const owned = await this.categoryRepo.find({ where: { ownerId: userId } });
    if (!owned.some((row) => row.id === id)) return;
    const ids = await this.collectSubtreeIds(id, userId);
    await this.categoryRepo.delete({ id: In(ids), ownerId: userId });
  }

  /** Hide a system default for the user. Idempotent — a second hide is a no-op. */
  private async hide(userId: string, categoryId: string): Promise<void> {
    const existing = await this.hiddenRepo.findOne({ where: { userId, categoryId } });
    if (existing) return;
    await this.hiddenRepo.insert({ userId, categoryId });
  }

  private async findHiddenIds(userId: string): Promise<string[]> {
    const rows = await this.hiddenRepo.find({ where: { userId }, select: { categoryId: true } });
    return rows.map((row) => row.categoryId);
  }

  private async findOverride(userId: string, categoryId: string): Promise<CategoryOverride | null> {
    const row = await this.overrideRepo.findOne({ where: { userId, categoryId } });
    return row ? toOverride(row) : null;
  }

  private async findOverrides(userId: string): Promise<CategoryOverride[]> {
    const rows = await this.overrideRepo.find({ where: { userId } });
    return rows.map(toOverride);
  }

  // --- tree building ---

  private isVisible(cat: CategoryEntity, ctx: BuildContext): boolean {
    return !(cat.isSystem && ctx.hidden.has(cat.id));
  }

  /**
   * `inheritedColor` is the root's effective color, threaded down so subcategories
   * always render the parent's color regardless of their own stored value (FR: cor herdada).
   */
  private buildNode(
    cat: CategoryEntity,
    ctx: BuildContext,
    inheritedColor?: string,
  ): CategoryNodeDto {
    const override = cat.isSystem ? ctx.overrides.get(cat.id) : undefined;
    const source = cat.isSystem ? (override ? 'default-overridden' : 'default') : 'custom';
    const color = inheritedColor ?? override?.color ?? cat.color;
    const children = (ctx.childrenOf.get(cat.id) ?? [])
      .filter((c) => this.isVisible(c, ctx))
      .map((c) => this.buildNode(c, ctx, color));
    return CategoryConverter.toNode(cat, { source, override, children, color });
  }

  // --- invariants ---

  private assertName(value: string): string {
    const name = value.trim();
    if (name.length === 0) throw new InvalidCategoryError('Category name must not be empty');
    return name;
  }

  private assertType(type: string): asserts type is CategoryType {
    if (type !== 'expense' && type !== 'income') {
      throw new InvalidCategoryError(`Unknown category type: ${type}`);
    }
  }

  private assertCatalog(icon: string, color: string): void {
    if (!isIconKey(icon)) throw new InvalidCategoryError(`Unknown icon: ${icon}`);
    if (!isColorToken(color)) throw new InvalidCategoryError(`Unknown color: ${color}`);
  }
}

function toOverride(row: UserCategoryOverrideEntity): CategoryOverride {
  return { categoryId: row.categoryId, name: row.name, icon: row.icon, color: row.color };
}
