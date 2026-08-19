import type { ForecastQuery, ForecastResponse } from '@finance/contracts';
import { apiFetch } from '../../services/api-client';
import { withQuery } from '../../util/http';

export function getForecast(query: ForecastQuery): Promise<ForecastResponse> {
  return apiFetch<ForecastResponse>(
    withQuery('/transactions/forecast', { from: query.from, months: String(query.months) }),
  );
}
