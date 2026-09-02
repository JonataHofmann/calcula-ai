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
  getCategoryTransactionCount,
  listCategories,
  moveCategory,
  restoreCategory,
  revertOverride,
  updateCategory,
} from './categories-api';
import { TRANSACTIONS_QUERY_KEY } from '../transactions/use-transactions';

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

/** Linked-transaction count (whole subtree) for the delete dialog. Disabled until an id is provided. */
export function useCategoryTransactionCount(id: string | undefined) {
  return useQuery({
    queryKey: [...KEY, id, 'transaction-count'] as const,
    queryFn: () => getCategoryTransactionCount(id as string),
    enabled: Boolean(id),
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, deleteTransactions }: { id: string; deleteTransactions?: boolean }) =>
      deleteCategory(id, deleteTransactions),
    onSuccess: (_data, { deleteTransactions }) => {
      qc.invalidateQueries({ queryKey: KEY });
      if (deleteTransactions) qc.invalidateQueries({ queryKey: TRANSACTIONS_QUERY_KEY });
    },
  });
}

/** Reparent a category (drag-and-drop). `parentId: null` promotes it to a root. */
export function useMoveCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, parentId }: { id: string; parentId: string | null }) =>
      moveCategory(id, parentId),
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
