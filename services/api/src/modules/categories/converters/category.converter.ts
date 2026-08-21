import type { CategoryNodeDto } from '@finance/contracts';
import type { CategoryEntity } from '../entities/category.entity';
import type { CategoryOverride } from '../categories.types';

type CategorySource = CategoryNodeDto['source'];

/** Sole place entity → response-DTO (tree node) translation happens (FR-013). */
export class CategoryConverter {
  /**
   * Build a tree node from a persisted category. A per-user `override` (system
   * defaults only) shadows name/icon/color — never `type`. `children` are built
   * by the caller during the recursive tree walk.
   */
  static toNode(
    entity: CategoryEntity,
    opts: { source: CategorySource; override?: CategoryOverride; children?: CategoryNodeDto[] },
  ): CategoryNodeDto {
    const { source, override, children = [] } = opts;
    return {
      id: entity.id,
      name: override?.name ?? entity.name,
      icon: override?.icon ?? entity.icon,
      color: override?.color ?? entity.color,
      type: entity.type,
      source,
      children,
    } as CategoryNodeDto;
  }
}
