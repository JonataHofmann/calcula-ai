'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateCreditCardInput,
  CreditCardDto,
  UpdateCreditCardInput,
} from '@finance/contracts';
import { createCard, deleteCard, listCards, updateCard } from './cards-api';

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

export function useDeleteCard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteCard(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export type { CreditCardDto };
