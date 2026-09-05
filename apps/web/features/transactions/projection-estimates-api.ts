import type {
  CreateProjectionEstimateInput,
  ProjectionEstimate,
  UpdateProjectionEstimateInput,
} from '@finance/contracts';
import { apiFetch, newIdempotencyKey } from '../../services/api-client';

/** Projection-only estimates: rows that show in the forecast but never become real transactions. */
export function listProjectionEstimates(): Promise<ProjectionEstimate[]> {
  return apiFetch<ProjectionEstimate[]>('/transactions/projection-estimates');
}

export function createProjectionEstimate(
  input: CreateProjectionEstimateInput,
): Promise<ProjectionEstimate> {
  return apiFetch<ProjectionEstimate>('/transactions/projection-estimates', {
    method: 'POST',
    headers: { 'Idempotency-Key': newIdempotencyKey() },
    body: JSON.stringify(input),
  });
}

export function updateProjectionEstimate(
  id: string,
  input: UpdateProjectionEstimateInput,
): Promise<ProjectionEstimate> {
  return apiFetch<ProjectionEstimate>(`/transactions/projection-estimates/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function deleteProjectionEstimate(id: string): Promise<void> {
  return apiFetch<void>(`/transactions/projection-estimates/${id}`, { method: 'DELETE' });
}
