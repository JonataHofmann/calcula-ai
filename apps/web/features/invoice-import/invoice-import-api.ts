import type {
  CommitInvoiceInput,
  CommitInvoiceResult,
  InvoiceExtractionResult,
  InvoiceImportProgressEvent,
} from '@finance/contracts';
import {
  ApiError,
  apiFetch,
  apiUpload,
  apiUploadStream,
  newIdempotencyKey,
} from '../../services/api-client';

export interface ExtractInvoiceInput {
  file: File;
  creditCardId: string;
  password?: string;
}

export type { InvoiceImportProgressEvent };

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

/**
 * Igual a extractInvoice, mas recebe o progresso passo a passo em tempo real via `onEvent`
 * (enviando arquivo, extraindo texto, IA, processando, categorizando). Resolve com o
 * resultado do evento `done`; um evento `error` vira ApiError com a mensagem real.
 */
export async function extractInvoiceStream(
  input: ExtractInvoiceInput,
  onEvent: (event: InvoiceImportProgressEvent) => void,
): Promise<InvoiceExtractionResult> {
  const form = new FormData();
  form.append('file', input.file);
  form.append('creditCardId', input.creditCardId);
  if (input.password) form.append('password', input.password);

  let result: InvoiceExtractionResult | undefined;
  await apiUploadStream('/invoice-import/extract-stream', form, (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    const event = JSON.parse(trimmed) as InvoiceImportProgressEvent;
    onEvent(event);
    if (event.step === 'error') {
      throw new ApiError(0, event.message);
    }
    if (event.step === 'done' && event.result) {
      result = event.result;
    }
  });

  if (!result) {
    throw new ApiError(0, 'O processamento terminou sem resultado');
  }
  return result;
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
