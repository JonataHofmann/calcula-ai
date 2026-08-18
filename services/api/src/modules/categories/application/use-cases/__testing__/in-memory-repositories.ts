import type { CategoryType } from '@finance/contracts';
import { Category } from '../../../domain/category';
import type { CategoryRepository } from '../../../domain/category.repository';
import type { HiddenCategoryRepository } from '../../../domain/hidden-category.repository';
import type {
  CategoryOverride,
  CategoryOverrideRepository,
} from '../../../domain/category-override.repository';

const byCreated = (a: Category, b: Category): number =>
  a.createdAt.getTime() - b.createdAt.getTime();

/** In-memory CategoryRepository fake mirroring the SQL scoping rules. */
export class InMemoryCategoryRepository implements CategoryRepository {
  constructor(private items: Category[] = []) {}

  async create(category: Category): Promise<void> {
    this.items.push(category);
  }

  async save(category: Category): Promise<void> {
    this.items = this.items.map((i) => (i.id === category.id ? category : i));
  }

  async findSystem(): Promise<Category[]> {
    return this.items.filter((i) => i.isSystem).sort(byCreated);
  }

  async findAllByOwner(userId: string): Promise<Category[]> {
    return this.items.filter((i) => i.ownerId === userId).sort(byCreated);
  }

  async findAccessible(id: string, userId: string): Promise<Category | null> {
    return (
      this.items.find(
        (i) => i.id === id && (i.ownerId === userId || i.ownerId === null),
      ) ?? null
    );
  }

  async deleteWithDescendants(id: string, userId: string): Promise<void> {
    const owned = this.items.filter((i) => i.ownerId === userId);
    if (!owned.some((i) => i.id === id)) return;
    const childrenOf = new Map<string, string[]>();
    for (const i of owned) {
      if (!i.parentId) continue;
      const list = childrenOf.get(i.parentId) ?? [];
      list.push(i.id);
      childrenOf.set(i.parentId, list);
    }
    const ids = new Set<string>();
    const stack = [id];
    while (stack.length > 0) {
      const current = stack.pop() as string;
      ids.add(current);
      stack.push(...(childrenOf.get(current) ?? []));
    }
    this.items = this.items.filter((i) => !(ids.has(i.id) && i.ownerId === userId));
  }

  snapshot(): Category[] {
    return [...this.items];
  }
}

export class InMemoryHiddenCategoryRepository implements HiddenCategoryRepository {
  private hidden = new Set<string>();

  async hide(userId: string, categoryId: string): Promise<void> {
    this.hidden.add(key(userId, categoryId));
  }

  async unhide(userId: string, categoryId: string): Promise<void> {
    this.hidden.delete(key(userId, categoryId));
  }

  async findHiddenIds(userId: string): Promise<string[]> {
    const prefix = `${userId}:`;
    return [...this.hidden]
      .filter((k) => k.startsWith(prefix))
      .map((k) => k.slice(prefix.length));
  }

  isHidden(userId: string, categoryId: string): boolean {
    return this.hidden.has(key(userId, categoryId));
  }
}

export class InMemoryCategoryOverrideRepository implements CategoryOverrideRepository {
  private overrides = new Map<string, CategoryOverride>();

  async upsert(userId: string, override: CategoryOverride): Promise<void> {
    this.overrides.set(key(userId, override.categoryId), { ...override });
  }

  async revert(userId: string, categoryId: string): Promise<void> {
    this.overrides.delete(key(userId, categoryId));
  }

  async findOne(userId: string, categoryId: string): Promise<CategoryOverride | null> {
    return this.overrides.get(key(userId, categoryId)) ?? null;
  }

  async findByUser(userId: string): Promise<CategoryOverride[]> {
    const prefix = `${userId}:`;
    return [...this.overrides.entries()]
      .filter(([k]) => k.startsWith(prefix))
      .map(([, v]) => v);
  }
}

function key(userId: string, categoryId: string): string {
  return `${userId}:${categoryId}`;
}

let seq = 0;

/** Build a persisted system default category with deterministic ordering. */
export function systemCategory(input: {
  id: string;
  name: string;
  type: CategoryType;
  parentId?: string | null;
  icon?: string;
  color?: string;
}): Category {
  const now = new Date(2020, 0, 1, 0, 0, 0, seq++);
  return Category.restore({
    id: input.id,
    ownerId: null,
    parentId: input.parentId ?? null,
    name: input.name,
    type: input.type,
    icon: input.icon ?? 'utensils',
    color: input.color ?? 'primary',
    isSystem: true,
    createdAt: now,
    updatedAt: now,
  });
}

/** Build a persisted custom category owned by a user. */
export function customCategory(input: {
  id: string;
  ownerId: string;
  name: string;
  type: CategoryType;
  parentId?: string | null;
  icon?: string;
  color?: string;
}): Category {
  const now = new Date(2020, 0, 1, 0, 0, 0, seq++);
  return Category.restore({
    id: input.id,
    ownerId: input.ownerId,
    parentId: input.parentId ?? null,
    name: input.name,
    type: input.type,
    icon: input.icon ?? 'tag',
    color: input.color ?? 'accent',
    isSystem: false,
    createdAt: now,
    updatedAt: now,
  });
}
