'use client';

import { useQuery } from '@tanstack/react-query';
import type { SyncedTransactionDto, SyncStatus } from '@finance/contracts';
import { listSyncedTransactions } from './synced-transactions-api';

export const SYNCED_TRANSACTIONS_QUERY_KEY = ['synced-transactions'] as const;

export function useSyncedTransactions(status?: SyncStatus) {
  return useQuery({
    queryKey: [...SYNCED_TRANSACTIONS_QUERY_KEY, status ?? 'all'] as const,
    queryFn: () => listSyncedTransactions(status),
  });
}

export type { SyncedTransactionDto };
