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
} from './bank-connections-api';

export const BANK_CONNECTIONS_QUERY_KEY = ['bank-connections'] as const;
const KEY = BANK_CONNECTIONS_QUERY_KEY;

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
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useRefreshBankConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => refreshBankConnection(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDisconnectBankConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => disconnectBankConnection(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export type { BankConnectionDto };
