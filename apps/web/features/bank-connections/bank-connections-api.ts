import type {
  BankConnectionCreateInput,
  BankConnectionDto,
  ConnectTokenInput,
  ConnectTokenResponse,
} from '@finance/contracts';
import { apiFetch, newIdempotencyKey } from '../../services/api-client';

export function listBankConnections(): Promise<BankConnectionDto[]> {
  return apiFetch<BankConnectionDto[]>('/bank-connections');
}

export function createConnectToken(input: ConnectTokenInput): Promise<ConnectTokenResponse> {
  return apiFetch<ConnectTokenResponse>('/bank-connections/connect-tokens', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function completeBankConnection(
  input: BankConnectionCreateInput,
): Promise<BankConnectionDto> {
  return apiFetch<BankConnectionDto>('/bank-connections', {
    method: 'POST',
    headers: { 'Idempotency-Key': newIdempotencyKey() },
    body: JSON.stringify(input),
  });
}

export function refreshBankConnection(
  id: string,
  options?: { forceFullSync?: boolean },
): Promise<{ status: string }> {
  return apiFetch<{ status: string }>(`/bank-connections/${id}/refresh`, {
    method: 'POST',
    headers: { 'Idempotency-Key': newIdempotencyKey() },
    body: JSON.stringify({ forceFullSync: options?.forceFullSync ?? false }),
  });
}

export function disconnectBankConnection(id: string): Promise<void> {
  return apiFetch<void>(`/bank-connections/${id}`, { method: 'DELETE' });
}

export interface RetryConnectionImportsResult {
  retried: number;
  succeeded: number;
  stillFailing: number;
}

export function retryConnectionImports(id: string): Promise<RetryConnectionImportsResult> {
  return apiFetch<RetryConnectionImportsResult>(`/bank-connections/${id}/retry-imports`, {
    method: 'POST',
    headers: { 'Idempotency-Key': newIdempotencyKey() },
  });
}
