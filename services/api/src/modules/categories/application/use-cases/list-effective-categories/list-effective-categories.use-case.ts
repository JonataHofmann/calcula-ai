import { Inject, Injectable } from '@nestjs/common';
import type { CategoryNodeDto, CategoryTreeDto } from '@finance/contracts';
import type { Category } from '../../../domain/category';
import {
  CATEGORY_REPOSITORY,
  type CategoryRepository,
} from '../../../domain/category.repository';
import {
  HIDDEN_CATEGORY_REPOSITORY,
  type HiddenCategoryRepository,
} from '../../../domain/hidden-category.repository';
import {
  CATEGORY_OVERRIDE_REPOSITORY,
  type CategoryOverride,
  type CategoryOverrideRepository,
} from '../../../domain/category-override.repository';

interface BuildContext {
  childrenOf: Map<string, Category[]>;
  hidden: Set<string>;
  overrides: Map<string, CategoryOverride>;
}

/**
 * Computes the user's effective category tree:
 *   system defaults (not hidden, with per-user overrides applied) ∪ the user's custom categories,
 * recursed and grouped by type. `type` is never overridden.
 */
@Injectable()
export class ListEffectiveCategoriesUseCase {
  constructor(
    @Inject(CATEGORY_REPOSITORY) private readonly categories: CategoryRepository,
    @Inject(HIDDEN_CATEGORY_REPOSITORY) private readonly hidden: HiddenCategoryRepository,
    @Inject(CATEGORY_OVERRIDE_REPOSITORY)
    private readonly overrides: CategoryOverrideRepository,
  ) {}

  async execute(userId: string): Promise<CategoryTreeDto> {
    const [system, custom, hiddenIds, overrideRows] = await Promise.all([
      this.categories.findSystem(),
      this.categories.findAllByOwner(userId),
      this.hidden.findHiddenIds(userId),
      this.overrides.findByUser(userId),
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

    const roots = all.filter((c) => c.parentId === null && isVisible(c, ctx));

    const tree: CategoryTreeDto = {
      expense: roots.filter((c) => c.type === 'expense').map((c) => buildNode(c, ctx)),
      income: roots.filter((c) => c.type === 'income').map((c) => buildNode(c, ctx)),
    };
    return tree;
  }
}

/** A system category hidden by the user is invisible; custom categories are always visible to their owner. */
function isVisible(cat: Category, ctx: BuildContext): boolean {
  return !(cat.isSystem && ctx.hidden.has(cat.id));
}

function buildNode(cat: Category, ctx: BuildContext): CategoryNodeDto {
  const override = cat.isSystem ? ctx.overrides.get(cat.id) : undefined;
  const source = cat.isSystem ? (override ? 'default-overridden' : 'default') : 'custom';
  const children = (ctx.childrenOf.get(cat.id) ?? [])
    .filter((c) => isVisible(c, ctx))
    .map((c) => buildNode(c, ctx));

  return {
    id: cat.id,
    name: override?.name ?? cat.name,
    icon: override?.icon ?? cat.icon,
    color: override?.color ?? cat.color,
    type: cat.type,
    source,
    children,
  } as CategoryNodeDto;
}
