import type {
  CreateTransactionInput,
  EffectuateInput,
  GroupScope,
  ListTransactionsQuery,
  TransactionDto,
  UpdateTransactionInput,
} from '@finance/contracts';
import { apiFetch, newIdempotencyKey } from '../../services/api-client';
import { withQuery } from '../../util/http';

/** BFF create response — installment yields N rows, single/fixed yield one. */
export interface CreateTransactionResponse {
  transactions: TransactionDto[];
}

/** BFF effectuate response — `next` is the materialized fixed occurrence, or null. */
export interface EffectuateResponse {
  transaction: TransactionDto;
  next: TransactionDto | null;
}

export function listTransactions(query: ListTransactionsQuery): Promise<TransactionDto[]> {
  return apiFetch<TransactionDto[]>(withQuery('/transactions', query));
}

export function listOverdue(before: string): Promise<TransactionDto[]> {
  return apiFetch<TransactionDto[]>(withQuery('/transactions/overdue', { before }));
}

export function getTransaction(id: string): Promise<TransactionDto> {
  return apiFetch<TransactionDto>(`/transactions/${id}`);
}

export function createTransaction(
  input: CreateTransactionInput,
): Promise<CreateTransactionResponse> {
  return apiFetch<CreateTransactionResponse>('/transactions', {
    method: 'POST',
    headers: { 'Idempotency-Key': newIdempotencyKey() },
    body: JSON.stringify(input),
  });
}

export function updateTransaction(
  id: string,
  input: UpdateTransactionInput,
  scope?: GroupScope,
): Promise<CreateTransactionResponse> {
  return apiFetch<CreateTransactionResponse>(withQuery(`/transactions/${id}`, { scope }), {
    method: 'PATCH',
    headers: { 'Idempotency-Key': newIdempotencyKey() },
    body: JSON.stringify(input),
  });
}

export function deleteTransaction(id: string, scope?: GroupScope): Promise<void> {
  return apiFetch<void>(withQuery(`/transactions/${id}`, { scope }), {
    method: 'DELETE',
    headers: { 'Idempotency-Key': newIdempotencyKey() },
  });
}

export function effectuateTransaction(
  id: string,
  input: EffectuateInput,
): Promise<EffectuateResponse> {
  return apiFetch<EffectuateResponse>(`/transactions/${id}/effectuate`, {
    method: 'POST',
    headers: { 'Idempotency-Key': newIdempotencyKey() },
    body: JSON.stringify(input),
  });
}
