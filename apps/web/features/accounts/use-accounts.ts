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
  listAccounts,
  updateAccount,
} from './accounts-api';

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

export function useDeleteAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteAccount(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export type { AccountDto };
