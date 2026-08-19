'use client';

import type { ForecastQuery } from '@finance/contracts';
import { SegmentedControl, type SegmentedOption } from '@finance/ui';

export type ForecastHorizon = ForecastQuery['months'];

const OPTIONS: SegmentedOption<`${ForecastHorizon}`>[] = [
  { value: '1', label: '1m' },
  { value: '3', label: '3m' },
  { value: '6', label: '6m' },
  { value: '12', label: '12m' },
  { value: '24', label: '24m' },
  { value: '36', label: '36m' },
];

export interface ForecastHorizonFilterProps {
  value: ForecastHorizon;
  onValueChange: (value: ForecastHorizon) => void;
}

export function ForecastHorizonFilter({ value, onValueChange }: ForecastHorizonFilterProps) {
  return (
    <SegmentedControl
      aria-label="Horizonte de meses"
      options={OPTIONS}
      value={`${value}` as `${ForecastHorizon}`}
      onValueChange={(next) => onValueChange(Number(next) as ForecastHorizon)}
    />
  );
}
