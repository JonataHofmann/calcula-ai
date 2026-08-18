export const HIDDEN_CATEGORY_REPOSITORY = Symbol('HIDDEN_CATEGORY_REPOSITORY');

/**
 * Per-user hidden-flag store for system default categories.
 * A user hides a default category only for themselves; other users are unaffected.
 */
export interface HiddenCategoryRepository {
  /** Hide a system category for the user. Idempotent — hiding twice is a no-op. */
  hide(userId: string, categoryId: string): Promise<void>;
  /** Restore (unhide) a previously hidden system category. Idempotent. */
  unhide(userId: string, categoryId: string): Promise<void>;
  /** Ids of system categories currently hidden by the user. */
  findHiddenIds(userId: string): Promise<string[]>;
}
