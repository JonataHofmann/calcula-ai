'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  CommitInvoiceInput,
  CommitInvoiceResult,
  InvoiceExtractionResult,
} from '@finance/contracts';
import {
  commitInvoice,
  extractInvoice,
  type ExtractInvoiceInput,
} from './invoice-import-api';

/** Extracts invoice lines from a PDF. Nothing is persisted until commit (US3). */
export function useExtractInvoice() {
  return useMutation<InvoiceExtractionResult, Error, ExtractInvoiceInput>({
    mutationFn: (input) => extractInvoice(input),
  });
}

/** Commits the reviewed lines. Invalidates transactions so the new rows appear. */
export function useCommitInvoice() {
  const queryClient = useQueryClient();
  return useMutation<CommitInvoiceResult, Error, CommitInvoiceInput>({
    mutationFn: (input) => commitInvoice(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}
