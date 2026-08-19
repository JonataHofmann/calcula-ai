import type { ForecastQuery, ForecastResponse } from '@finance/contracts';
import { apiFetch } from '../../services/api-client';

/** Builds `path?a=1&b=2`, skipping undefined/null/empty values. */
function withQuery(path: string, query: Record<string, string | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') params.set(key, value);
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

export function getForecast(query: ForecastQuery): Promise<ForecastResponse> {
  return apiFetch<ForecastResponse>(
    withQuery('/transactions/forecast', { from: query.from, months: String(query.months) }),
  );
}
