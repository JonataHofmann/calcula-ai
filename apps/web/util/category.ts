import type { CategoryNodeDto, CategoryTreeDto, ColorToken } from '@finance/contracts';

export interface CategoryMeta {
  name: string;
  color: ColorToken;
  icon: CategoryNodeDto['icon'];
}

/** Flattens the category tree into id → {name, color, icon} (roots and subcategories). */
export function flattenCategories(
  nodes: CategoryNodeDto[],
  out: Map<string, CategoryMeta>,
): void {
  for (const node of nodes) {
    out.set(node.id, { name: node.name, color: node.color, icon: node.icon });
    if (node.children.length > 0) flattenCategories(node.children, out);
  }
}

/** Flattens a category tree into an id → node lookup, including nested children. */
export function indexCategories(
  nodes: CategoryNodeDto[],
  map: Map<string, CategoryNodeDto>,
): void {
  for (const node of nodes) {
    map.set(node.id, node);
    if (node.children.length > 0) indexCategories(node.children, map);
  }
}

export function buildCategoryMap(tree?: CategoryTreeDto): Map<string, CategoryNodeDto> {
  const map = new Map<string, CategoryNodeDto>();
  if (tree) {
    indexCategories(tree.expense, map);
    indexCategories(tree.income, map);
  }
  return map;
}

/** Indexes id → full ancestor path [root, …, node], so a subcategory can render its breadcrumb. */
export function indexCategoryPaths(
  nodes: CategoryNodeDto[],
  map: Map<string, CategoryNodeDto[]>,
  trail: CategoryNodeDto[] = [],
): void {
  for (const node of nodes) {
    const path = [...trail, node];
    map.set(node.id, path);
    if (node.children.length > 0) indexCategoryPaths(node.children, map, path);
  }
}

export function buildCategoryPathMap(tree?: CategoryTreeDto): Map<string, CategoryNodeDto[]> {
  const map = new Map<string, CategoryNodeDto[]>();
  if (tree) {
    indexCategoryPaths(tree.expense, map);
    indexCategoryPaths(tree.income, map);
  }
  return map;
}
