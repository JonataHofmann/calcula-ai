import type {
  AccountDto,
  CreateAccountInput,
  UpdateAccountInput,
} from '@finance/contracts';
import { apiFetch, newIdempotencyKey } from '../../services/api-client';

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

export function deleteAccount(id: string): Promise<void> {
  return apiFetch<void>(`/accounts/${id}`, {
    method: 'DELETE',
    headers: { 'Idempotency-Key': newIdempotencyKey() },
  });
}
