'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  BankConnectionCreateInput,
  BankConnectionDto,
  ConnectTokenInput,
} from '@finance/contracts';
import {
  completeBankConnection,
  createConnectToken,
  disconnectBankConnection,
  listBankConnections,
  refreshBankConnection,
  retryConnectionImports,
  type RetryConnectionImportsResult,
} from './bank-connections-api';
import { TRANSACTIONS_QUERY_KEY } from '../transactions/use-transactions';

export const BANK_CONNECTIONS_QUERY_KEY = ['bank-connections'] as const;
const KEY = BANK_CONNECTIONS_QUERY_KEY;

function invalidateConnectionsAndTransactions(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: KEY });
  qc.invalidateQueries({ queryKey: TRANSACTIONS_QUERY_KEY });
}

export function useBankConnections() {
  return useQuery({ queryKey: KEY, queryFn: listBankConnections });
}

export function useCreateConnectToken() {
  return useMutation({
    mutationFn: (input: ConnectTokenInput) => createConnectToken(input),
  });
}

export function useCompleteBankConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: BankConnectionCreateInput) => completeBankConnection(input),
    onSuccess: () => invalidateConnectionsAndTransactions(qc),
  });
}

export function useRefreshBankConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => refreshBankConnection(id),
    onSuccess: () => invalidateConnectionsAndTransactions(qc),
  });
}

export function useForceFullSync() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => refreshBankConnection(id, { forceFullSync: true }),
    onSuccess: () => invalidateConnectionsAndTransactions(qc),
  });
}

export function useDisconnectBankConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => disconnectBankConnection(id),
    onSuccess: () => invalidateConnectionsAndTransactions(qc),
  });
}

export function useRetryConnectionImports() {
  const qc = useQueryClient();
  return useMutation<RetryConnectionImportsResult, Error, string>({
    mutationFn: (id: string) => retryConnectionImports(id),
    onSuccess: () => invalidateConnectionsAndTransactions(qc),
  });
}

export type { BankConnectionDto, RetryConnectionImportsResult };
