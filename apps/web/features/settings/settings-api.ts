import type { BackupSnapshot, ImportMode, ImportResult, ResetResult } from '@finance/contracts';
import { apiFetch, newIdempotencyKey } from '../../services/api-client';

/** Wipes all of the user's data (transactions, accounts, cards, custom categories). Irreversible. */
export function resetData(): Promise<ResetResult> {
  return apiFetch<ResetResult>('/account/reset', {
    method: 'POST',
    headers: { 'Idempotency-Key': newIdempotencyKey() },
  });
}

/** Portable JSON snapshot of everything the user owns. */
export function exportData(): Promise<BackupSnapshot> {
  return apiFetch<BackupSnapshot>('/account/export');
}

/**
 * Import a snapshot — every row gets a fresh id (never overwrites).
 * `merge` appends; `replace` wipes the user's data first (irreversible).
 */
export function importData(snapshot: BackupSnapshot, mode: ImportMode): Promise<ImportResult> {
  return apiFetch<ImportResult>(`/account/import?mode=${mode}`, {
    method: 'POST',
    headers: { 'Idempotency-Key': newIdempotencyKey() },
    body: JSON.stringify(snapshot),
  });
}
