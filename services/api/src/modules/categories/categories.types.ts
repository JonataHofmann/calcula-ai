/**
 * Module-local domain types & errors (research R3). Error names are load-bearing:
 * `DomainExceptionFilter` maps `*NotFoundError` → 404, `Invalid*` → 400,
 * `*ConflictError` → 409.
 */

/** Requested category does not exist for the scoped user (also cross-user access — never leaks existence). */
export class CategoryNotFoundError extends Error {
  constructor(id: string) {
    super(`Category not found: ${id}`);
    this.name = 'CategoryNotFoundError';
  }
}

/** Domain invariant violated (empty name, unknown catalog reference, bad type). */
export class InvalidCategoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidCategoryError';
  }
}

/** Operation not valid for the category's kind (e.g. restoring/reverting a custom category). */
export class CategoryConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CategoryConflictError';
  }
}

/**
 * Per-user copy-on-write override of a system default category's presentation.
 * `type` is never overridable.
 */
export interface CategoryOverride {
  categoryId: string;
  name: string;
  icon: string;
  color: string;
}
