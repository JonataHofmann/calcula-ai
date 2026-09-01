'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateCreditCardInput,
  CreditCardDto,
  UpdateCreditCardInput,
} from '@finance/contracts';
import {
  createCard,
  deleteCard,
  getCardTransactionCount,
  listCards,
  updateCard,
} from './cards-api';
import { TRANSACTIONS_QUERY_KEY } from '../transactions/use-transactions';

const KEY = ['cards'] as const;

export function useCards() {
  return useQuery({ queryKey: KEY, queryFn: listCards });
}

export function useCreateCard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCreditCardInput) => createCard(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateCard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateCreditCardInput }) =>
      updateCard(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

/** Linked-transaction count for the delete dialog. Disabled until an id is provided. */
export function useCardTransactionCount(id: string | undefined) {
  return useQuery({
    queryKey: [...KEY, id, 'transaction-count'] as const,
    queryFn: () => getCardTransactionCount(id as string),
    enabled: Boolean(id),
  });
}

export function useDeleteCard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, deleteTransactions }: { id: string; deleteTransactions?: boolean }) =>
      deleteCard(id, deleteTransactions),
    onSuccess: (_data, { deleteTransactions }) => {
      qc.invalidateQueries({ queryKey: KEY });
      // Cascaded transactions also change the transaction lists/invoices.
      if (deleteTransactions) qc.invalidateQueries({ queryKey: TRANSACTIONS_QUERY_KEY });
    },
  });
}

export type { CreditCardDto };
