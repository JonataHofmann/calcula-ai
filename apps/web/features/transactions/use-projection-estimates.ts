'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateProjectionEstimateInput,
  UpdateProjectionEstimateInput,
} from '@finance/contracts';
import {
  createProjectionEstimate,
  deleteProjectionEstimate,
  listProjectionEstimates,
  updateProjectionEstimate,
} from './projection-estimates-api';

const KEY = ['projection-estimates'] as const;

export function useProjectionEstimates() {
  return useQuery({ queryKey: KEY, queryFn: listProjectionEstimates });
}

/** Mutations invalidate both the estimates list and the forecast (which renders estimate rows). */
function useInvalidate() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: KEY });
    void qc.invalidateQueries({ queryKey: ['forecast'] });
  };
}

export function useCreateProjectionEstimate() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: CreateProjectionEstimateInput) => createProjectionEstimate(input),
    onSuccess: invalidate,
  });
}

export function useUpdateProjectionEstimate() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateProjectionEstimateInput }) =>
      updateProjectionEstimate(id, input),
    onSuccess: invalidate,
  });
}

export function useDeleteProjectionEstimate() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => deleteProjectionEstimate(id),
    onSuccess: invalidate,
  });
}
