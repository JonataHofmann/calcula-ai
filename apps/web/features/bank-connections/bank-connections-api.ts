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
  return apiFetch<ConnectTokenResponse>('/connect-tokens', {
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

export function refreshBankConnection(id: string): Promise<{ status: string }> {
  return apiFetch<{ status: string }>(`/bank-connections/${id}/refresh`, {
    method: 'POST',
    headers: { 'Idempotency-Key': newIdempotencyKey() },
  });
}

export function disconnectBankConnection(id: string): Promise<void> {
  return apiFetch<void>(`/bank-connections/${id}`, { method: 'DELETE' });
}
