import { z } from 'zod';
import { iconKeySchema } from '../reference/icon.js';
import { colorTokenSchema } from '../reference/color.js';

export const categoryTypeSchema = z.enum(['expense', 'income']);
export type CategoryType = z.infer<typeof categoryTypeSchema>;

/** Origin of an effective category for the current user (drives UI badges/actions). */
export const categorySourceSchema = z.enum([
  'default',
  'default-overridden',
  'custom',
]);
export type CategorySource = z.infer<typeof categorySourceSchema>;

export interface CategoryNodeDto {
  id: string;
  name: string;
  icon: z.infer<typeof iconKeySchema>;
  color: z.infer<typeof colorTokenSchema>;
  type: CategoryType;
  source: CategorySource;
  children: CategoryNodeDto[];
}

export const categoryNodeSchema: z.ZodType<CategoryNodeDto> = z.lazy(() =>
  z.object({
    id: z.string(),
    name: z.string().min(1),
    icon: iconKeySchema,
    color: colorTokenSchema,
    type: categoryTypeSchema,
    source: categorySourceSchema,
    children: z.array(categoryNodeSchema),
  }),
);

/** Effective list grouped by type (BFF GET /categories). */
export const categoryTreeSchema = z.object({
  expense: z.array(categoryNodeSchema),
  income: z.array(categoryNodeSchema),
});

export type CategoryTreeDto = z.infer<typeof categoryTreeSchema>;

/** Create a custom root category. */
export const createCategoryInput = z.object({
  name: z.string().trim().min(1, 'Nome é obrigatório').max(60),
  type: categoryTypeSchema,
  icon: iconKeySchema,
  color: colorTokenSchema,
});
export type CreateCategoryInput = z.infer<typeof createCategoryInput>;

/** Create a subcategory — type inherited from the root, not accepted here. */
export const createSubcategoryInput = z.object({
  name: z.string().trim().min(1, 'Nome é obrigatório').max(60),
  icon: iconKeySchema,
  color: colorTokenSchema,
});
export type CreateSubcategoryInput = z.infer<typeof createSubcategoryInput>;

/** Patch — for default categories this becomes a copy-on-write override. `type` never editable. */
export const updateCategoryInput = z
  .object({
    name: z.string().trim().min(1).max(60),
    icon: iconKeySchema,
    color: colorTokenSchema,
  })
  .partial();
export type UpdateCategoryInput = z.infer<typeof updateCategoryInput>;

/** Reparent a category. `parentId: null` promotes it to a root; a uuid nests it under that root. */
export const moveCategoryInput = z.object({
  parentId: z.string().uuid().nullable(),
});
export type MoveCategoryInput = z.infer<typeof moveCategoryInput>;
