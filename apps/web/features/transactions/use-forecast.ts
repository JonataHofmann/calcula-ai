'use client';

import { useQuery } from '@tanstack/react-query';
import type { ForecastQuery } from '@finance/contracts';
import { getForecast } from './forecast-api';

const KEY = ['forecast'] as const;

export function useForecast(query: ForecastQuery) {
  return useQuery({
    queryKey: [...KEY, query] as const,
    queryFn: () => getForecast(query),
  });
}
