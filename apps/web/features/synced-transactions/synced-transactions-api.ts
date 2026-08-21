import type { SyncedTransactionDto, SyncStatus } from '@finance/contracts';
import { apiFetch } from '../../services/api-client';

export function listSyncedTransactions(status?: SyncStatus): Promise<SyncedTransactionDto[]> {
  const query = status ? `?status=${encodeURIComponent(status)}` : '';
  return apiFetch<SyncedTransactionDto[]>(`/synced-transactions${query}`);
}
