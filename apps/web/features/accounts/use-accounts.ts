'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AccountDto,
  CreateAccountInput,
  UpdateAccountInput,
} from '@finance/contracts';
import {
  createAccount,
  deleteAccount,
  getAccountTransactionCount,
  listAccounts,
  updateAccount,
} from './accounts-api';
import { TRANSACTIONS_QUERY_KEY } from '../transactions/use-transactions';

const KEY = ['accounts'] as const;

export function useAccounts() {
  return useQuery({ queryKey: KEY, queryFn: listAccounts });
}

export function useCreateAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAccountInput) => createAccount(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateAccountInput }) =>
      updateAccount(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

/** Linked-transaction count for the delete dialog. Disabled until an id is provided. */
export function useAccountTransactionCount(id: string | undefined) {
  return useQuery({
    queryKey: [...KEY, id, 'transaction-count'] as const,
    queryFn: () => getAccountTransactionCount(id as string),
    enabled: Boolean(id),
  });
}

export function useDeleteAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, deleteTransactions }: { id: string; deleteTransactions?: boolean }) =>
      deleteAccount(id, deleteTransactions),
    onSuccess: (_data, { deleteTransactions }) => {
      qc.invalidateQueries({ queryKey: KEY });
      if (deleteTransactions) qc.invalidateQueries({ queryKey: TRANSACTIONS_QUERY_KEY });
    },
  });
}

export type { AccountDto };
