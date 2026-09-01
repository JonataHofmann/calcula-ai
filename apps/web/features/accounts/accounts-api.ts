import type {
  AccountDto,
  CreateAccountInput,
  TransactionCountResult,
  UpdateAccountInput,
} from '@finance/contracts';
import { apiFetch, newIdempotencyKey } from '../../services/api-client';
import { withQuery } from '../../util/http';

export function listAccounts(): Promise<AccountDto[]> {
  return apiFetch<AccountDto[]>('/accounts');
}

export function createAccount(input: CreateAccountInput): Promise<AccountDto> {
  return apiFetch<AccountDto>('/accounts', {
    method: 'POST',
    headers: { 'Idempotency-Key': newIdempotencyKey() },
    body: JSON.stringify(input),
  });
}

export function updateAccount(id: string, input: UpdateAccountInput): Promise<AccountDto> {
  return apiFetch<AccountDto>(`/accounts/${id}`, {
    method: 'PATCH',
    headers: { 'Idempotency-Key': newIdempotencyKey() },
    body: JSON.stringify(input),
  });
}

/** Number of transactions linked to this account (shown before a cascading delete). */
export function getAccountTransactionCount(id: string): Promise<TransactionCountResult> {
  return apiFetch<TransactionCountResult>(`/accounts/${id}/transaction-count`);
}

export function deleteAccount(id: string, deleteTransactions = false): Promise<void> {
  return apiFetch<void>(
    withQuery(`/accounts/${id}`, { deleteTransactions: deleteTransactions ? 'true' : undefined }),
    {
      method: 'DELETE',
      headers: { 'Idempotency-Key': newIdempotencyKey() },
    },
  );
}
