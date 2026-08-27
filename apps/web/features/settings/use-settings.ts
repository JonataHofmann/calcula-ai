'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { BackupSnapshot, ImportMode, ImportResult, ResetResult } from '@finance/contracts';
import { exportData, importData, resetData } from './settings-api';

/** Resets all user data, then invalidates every query so the whole app refetches empty. */
export function useResetData() {
  const qc = useQueryClient();
  return useMutation<ResetResult>({
    mutationFn: () => resetData(),
    onSuccess: () => qc.invalidateQueries(),
  });
}

/** Fetches a full backup snapshot for the user to download. */
export function useExportData() {
  return useMutation<BackupSnapshot>({ mutationFn: () => exportData() });
}

/** Imports an uploaded snapshot (merge or replace), then invalidates every query so the app refetches. */
export function useImportData() {
  const qc = useQueryClient();
  return useMutation<ImportResult, Error, { snapshot: BackupSnapshot; mode: ImportMode }>({
    mutationFn: ({ snapshot, mode }) => importData(snapshot, mode),
    onSuccess: () => qc.invalidateQueries(),
  });
}
