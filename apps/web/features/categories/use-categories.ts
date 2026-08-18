'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CategoryTreeDto,
  CreateCategoryInput,
  CreateSubcategoryInput,
  UpdateCategoryInput,
} from '@finance/contracts';
import {
  addSubcategory,
  createCategory,
  deleteCategory,
  listCategories,
  restoreCategory,
  revertOverride,
  updateCategory,
} from './categories-api';

const KEY = ['categories'] as const;

export function useCategories() {
  return useQuery({ queryKey: KEY, queryFn: listCategories });
}

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCategoryInput) => createCategory(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useAddSubcategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ parentId, input }: { parentId: string; input: CreateSubcategoryInput }) =>
      addSubcategory(parentId, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateCategoryInput }) =>
      updateCategory(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteCategory(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useRestoreCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => restoreCategory(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useRevertOverride() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => revertOverride(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export type { CategoryTreeDto };
