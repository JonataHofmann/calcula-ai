import type {
  CategoryNodeDto,
  CategoryTreeDto,
  CreateCategoryInput,
  CreateSubcategoryInput,
  MoveCategoryInput,
  TransactionCountResult,
  UpdateCategoryInput,
} from '@finance/contracts';
import { apiFetch, newIdempotencyKey } from '../../services/api-client';
import { withQuery } from '../../util/http';

export function listCategories(): Promise<CategoryTreeDto> {
  return apiFetch<CategoryTreeDto>('/categories');
}

export function createCategory(input: CreateCategoryInput): Promise<CategoryNodeDto> {
  return apiFetch<CategoryNodeDto>('/categories', {
    method: 'POST',
    headers: { 'Idempotency-Key': newIdempotencyKey() },
    body: JSON.stringify(input),
  });
}

export function addSubcategory(
  parentId: string,
  input: CreateSubcategoryInput,
): Promise<CategoryNodeDto> {
  return apiFetch<CategoryNodeDto>(`/categories/${parentId}/subcategories`, {
    method: 'POST',
    headers: { 'Idempotency-Key': newIdempotencyKey() },
    body: JSON.stringify(input),
  });
}

export function updateCategory(
  id: string,
  input: UpdateCategoryInput,
): Promise<CategoryNodeDto> {
  return apiFetch<CategoryNodeDto>(`/categories/${id}`, {
    method: 'PATCH',
    headers: { 'Idempotency-Key': newIdempotencyKey() },
    body: JSON.stringify(input),
  });
}

/** Reparent a category. `parentId: null` promotes it to a root; a uuid nests it under that root. */
export function moveCategory(
  id: string,
  parentId: MoveCategoryInput['parentId'],
): Promise<CategoryNodeDto> {
  return apiFetch<CategoryNodeDto>(`/categories/${id}/move`, {
    method: 'PATCH',
    headers: { 'Idempotency-Key': newIdempotencyKey() },
    body: JSON.stringify({ parentId }),
  });
}

/** Number of transactions linked to this category's subtree (shown before a cascading delete). */
export function getCategoryTransactionCount(id: string): Promise<TransactionCountResult> {
  return apiFetch<TransactionCountResult>(`/categories/${id}/transaction-count`);
}

/** Deletes a custom category, or hides a default one — the API decides by source. */
export function deleteCategory(id: string, deleteTransactions = false): Promise<void> {
  return apiFetch<void>(
    withQuery(`/categories/${id}`, {
      deleteTransactions: deleteTransactions ? 'true' : undefined,
    }),
    {
      method: 'DELETE',
      headers: { 'Idempotency-Key': newIdempotencyKey() },
    },
  );
}

/** Un-hides a previously hidden default category. */
export function restoreCategory(id: string): Promise<void> {
  return apiFetch<void>(`/categories/${id}/restore`, {
    method: 'POST',
    headers: { 'Idempotency-Key': newIdempotencyKey() },
  });
}

/** Drops the per-user override on a default category. */
export function revertOverride(id: string): Promise<void> {
  return apiFetch<void>(`/categories/${id}/override`, {
    method: 'DELETE',
    headers: { 'Idempotency-Key': newIdempotencyKey() },
  });
}
