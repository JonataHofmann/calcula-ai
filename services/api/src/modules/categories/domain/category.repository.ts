import type { Category } from './category';

export const CATEGORY_REPOSITORY = Symbol('CATEGORY_REPOSITORY');

/**
 * Persistence port for categories.
 * System categories have `ownerId === null` and are shared by every user;
 * custom categories are scoped by `ownerId` so cross-user rows are invisible.
 */
export interface CategoryRepository {
  create(category: Category): Promise<void>;
  /** Persist an in-place edit of a custom category. */
  save(category: Category): Promise<void>;
  /** All system default categories (every level of the tree). */
  findSystem(): Promise<Category[]>;
  /** All custom categories owned by the user (every level of the tree). */
  findAllByOwner(userId: string): Promise<Category[]>;
  /** A category the user may act on: a system category, or one they own. `null` otherwise. */
  findAccessible(id: string, userId: string): Promise<Category | null>;
  /** Delete a custom category owned by the user together with its owned descendants (transactional). */
  deleteWithDescendants(id: string, userId: string): Promise<void>;
}
