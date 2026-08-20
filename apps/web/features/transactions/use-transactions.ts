'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateTransactionInput,
  EffectuateInput,
  GroupScope,
  ListTransactionsQuery,
  TransactionDto,
  UpdateTransactionInput,
} from '@finance/contracts';
import {
  createTransaction,
  deleteTransaction,
  effectuateTransaction,
  listOverdue,
  listTransactions,
  undoEffectuateTransaction,
  updateTransaction,
} from './transactions-api';

export const TRANSACTIONS_QUERY_KEY = ['transactions'] as const;
const KEY = TRANSACTIONS_QUERY_KEY;

export function useTransactions(query: ListTransactionsQuery) {
  return useQuery({
    queryKey: [...KEY, query] as const,
    queryFn: () => listTransactions(query),
  });
}

export function useOverdue(before: string, enabled: boolean) {
  return useQuery({
    queryKey: [...KEY, 'overdue', before] as const,
    queryFn: () => listOverdue(before),
    enabled,
  });
}

export function useCreateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTransactionInput) => createTransaction(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      input,
      scope,
    }: {
      id: string;
      input: UpdateTransactionInput;
      scope?: GroupScope;
    }) => updateTransaction(id, input, scope),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, scope }: { id: string; scope?: GroupScope }) =>
      deleteTransaction(id, scope),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useEffectuateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: EffectuateInput }) =>
      effectuateTransaction(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUndoEffectuateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string }) => undoEffectuateTransaction(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export type { TransactionDto };
