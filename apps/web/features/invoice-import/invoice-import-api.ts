import type {
  CommitInvoiceInput,
  CommitInvoiceResult,
  InvoiceExtractionResult,
} from '@finance/contracts';
import { apiFetch, apiUpload, newIdempotencyKey } from '../../services/api-client';

export interface ExtractInvoiceInput {
  file: File;
  creditCardId: string;
  password?: string;
}

/** Uploads the invoice PDF + password to the BFF, which proxies extraction to ai-ms. */
export function extractInvoice(
  input: ExtractInvoiceInput,
): Promise<InvoiceExtractionResult> {
  const form = new FormData();
  form.append('file', input.file);
  form.append('creditCardId', input.creditCardId);
  if (input.password) form.append('password', input.password);
  return apiUpload<InvoiceExtractionResult>('/invoice-import/extract', form);
}

/** Commits the reviewed lines (replace/merge). An Idempotency-Key makes a retry safe. */
export function commitInvoice(
  input: CommitInvoiceInput,
): Promise<CommitInvoiceResult> {
  return apiFetch<CommitInvoiceResult>('/invoice-import/commit', {
    method: 'POST',
    headers: { 'Idempotency-Key': newIdempotencyKey() },
    body: JSON.stringify(input),
  });
}
