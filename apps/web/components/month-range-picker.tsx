'use client';

import { cn } from '@finance/ui';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { MONTH_LABELS } from '../util/date';

/** 'YYYY-MM' shifted by whole months. */
function stepYM(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number) as [number, number];
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** 'YYYY-MM' → 'Jan 2026'. */
function labelYM(ym: string): string {
  const [y, m] = ym.split('-').map(Number) as [number, number];
  return `${MONTH_LABELS[m - 1]} ${y}`;
}

interface StepperProps {
  value: string;
  onChange: (ym: string) => void;
  label: string;
}

function Stepper({ value, onChange, label }: StepperProps) {
  return (
    <div className="border-border bg-surface-2 inline-flex items-center rounded-btn border">
      <button
        type="button"
        aria-label={`${label}: mês anterior`}
        onClick={() => onChange(stepYM(value, -1))}
        className="text-text-muted hover:text-text hover:bg-surface flex h-8 w-7 items-center justify-center rounded-l-btn transition-colors"
      >
        <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      <span className="text-text w-[5.5rem] text-center text-xs font-semibold tabular-nums">
        {labelYM(value)}
      </span>
      <button
        type="button"
        aria-label={`${label}: próximo mês`}
        onClick={() => onChange(stepYM(value, 1))}
        className="text-text-muted hover:text-text hover:bg-surface flex h-8 w-7 items-center justify-center rounded-r-btn transition-colors"
      >
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}

export interface MonthRangePickerProps {
  from: string;
  to: string;
  onChange: (range: { from: string; to: string }) => void;
  className?: string;
}

/** Compact "de / até" month-range control; keeps from ≤ to by pushing the other end. */
export function MonthRangePicker({ from, to, onChange, className }: MonthRangePickerProps) {
  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <Stepper
        label="Início"
        value={from}
        onChange={(next) => onChange({ from: next, to: next > to ? next : to })}
      />
      <span className="text-text-muted text-xs">até</span>
      <Stepper
        label="Fim"
        value={to}
        onChange={(next) => onChange({ from: next < from ? next : from, to: next })}
      />
    </div>
  );
}
