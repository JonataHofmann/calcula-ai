export const CATEGORY_OVERRIDE_REPOSITORY = Symbol('CATEGORY_OVERRIDE_REPOSITORY');

/**
 * Per-user copy-on-write override of a system default category's presentation.
 * `type` is never overridable. Editing a default category writes/updates one of these
 * rows for the acting user; other users keep the original values.
 */
export interface CategoryOverride {
  categoryId: string;
  name: string;
  icon: string;
  color: string;
}

export interface CategoryOverrideRepository {
  /** Insert or replace the user's override for a system category. */
  upsert(userId: string, override: CategoryOverride): Promise<void>;
  /** Remove the user's override so the original default values apply again. Idempotent. */
  revert(userId: string, categoryId: string): Promise<void>;
  /** The user's override for one category, if any. */
  findOne(userId: string, categoryId: string): Promise<CategoryOverride | null>;
  /** All overrides the user has defined. */
  findByUser(userId: string): Promise<CategoryOverride[]>;
}
