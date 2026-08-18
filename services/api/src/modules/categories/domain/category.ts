import { isColorToken, isIconKey, type CategoryType } from '@finance/contracts';
import { InvalidCategoryError } from './errors';

export interface CategoryProps {
  id: string;
  /** Owner user id; `null` for system default categories shared by all users. */
  ownerId: string | null;
  /** Parent category id; `null` for a root category. */
  parentId: string | null;
  name: string;
  type: CategoryType;
  icon: string;
  color: string;
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CategoryAttributes {
  name: string;
  icon: string;
  color: string;
}

/**
 * Category aggregate — a node in a single self-referencing tree (root or subcategory).
 * Enforces name/catalog/type invariants; user scoping is done by the repository.
 */
export class Category {
  private constructor(private props: CategoryProps) {}

  /** Create a custom root category owned by a user. */
  static create(input: {
    id: string;
    ownerId: string;
    name: string;
    type: CategoryType;
    icon: string;
    color: string;
    now?: Date;
  }): Category {
    const now = input.now ?? new Date();
    const name = assertName(input.name);
    assertType(input.type);
    assertCatalog(input.icon, input.color);
    return new Category({
      id: input.id,
      ownerId: input.ownerId,
      parentId: null,
      name,
      type: input.type,
      icon: input.icon,
      color: input.color,
      isSystem: false,
      createdAt: now,
      updatedAt: now,
    });
  }

  /** Create a custom subcategory under an existing parent; type is inherited, never accepted. */
  static createSubcategory(input: {
    id: string;
    ownerId: string;
    parent: Category;
    name: string;
    icon: string;
    color: string;
    now?: Date;
  }): Category {
    const now = input.now ?? new Date();
    const name = assertName(input.name);
    assertCatalog(input.icon, input.color);
    return new Category({
      id: input.id,
      ownerId: input.ownerId,
      parentId: input.parent.id,
      name,
      type: input.parent.type,
      icon: input.icon,
      color: input.color,
      isSystem: false,
      createdAt: now,
      updatedAt: now,
    });
  }

  /** Rehydrate from persistence without re-running create-time defaults. */
  static restore(props: CategoryProps): Category {
    return new Category(props);
  }

  /** In-place edit of a custom category. Type is immutable and never patched. */
  update(patch: Partial<CategoryAttributes>, now: Date = new Date()): void {
    if (patch.name !== undefined) this.props.name = assertName(patch.name);
    if (patch.icon !== undefined) {
      if (!isIconKey(patch.icon)) throw new InvalidCategoryError(`Unknown icon: ${patch.icon}`);
      this.props.icon = patch.icon;
    }
    if (patch.color !== undefined) {
      if (!isColorToken(patch.color)) {
        throw new InvalidCategoryError(`Unknown color: ${patch.color}`);
      }
      this.props.color = patch.color;
    }
    this.props.updatedAt = now;
  }

  get id(): string {
    return this.props.id;
  }
  get ownerId(): string | null {
    return this.props.ownerId;
  }
  get parentId(): string | null {
    return this.props.parentId;
  }
  get name(): string {
    return this.props.name;
  }
  get type(): CategoryType {
    return this.props.type;
  }
  get icon(): string {
    return this.props.icon;
  }
  get color(): string {
    return this.props.color;
  }
  get isSystem(): boolean {
    return this.props.isSystem;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }
}

function assertName(value: string): string {
  const name = value.trim();
  if (name.length === 0) throw new InvalidCategoryError('Category name must not be empty');
  return name;
}

function assertType(type: string): void {
  if (type !== 'expense' && type !== 'income') {
    throw new InvalidCategoryError(`Unknown category type: ${type}`);
  }
}

function assertCatalog(icon: string, color: string): void {
  if (!isIconKey(icon)) throw new InvalidCategoryError(`Unknown icon: ${icon}`);
  if (!isColorToken(color)) throw new InvalidCategoryError(`Unknown color: ${color}`);
}
