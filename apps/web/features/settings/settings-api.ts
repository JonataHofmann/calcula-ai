import type { ResetResult } from '@finance/contracts';
import { apiFetch, newIdempotencyKey } from '../../services/api-client';

/** Wipes all of the user's data (transactions, accounts, cards, custom categories). Irreversible. */
export function resetData(): Promise<ResetResult> {
  return apiFetch<ResetResult>('/account/reset', {
    method: 'POST',
    headers: { 'Idempotency-Key': newIdempotencyKey() },
  });
}
