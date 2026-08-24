'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ResetResult } from '@finance/contracts';
import { resetData } from './settings-api';

/** Resets all user data, then invalidates every query so the whole app refetches empty. */
export function useResetData() {
  const qc = useQueryClient();
  return useMutation<ResetResult>({
    mutationFn: () => resetData(),
    onSuccess: () => qc.invalidateQueries(),
  });
}
