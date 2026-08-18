/** Requested category does not exist for the scoped user (also used for cross-user access — never leaks existence). */
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

/** Operation not valid for the category's kind (e.g. hiding a custom category, editing a system category's type). */
export class CategoryConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CategoryConflictError';
  }
}
