'use client';

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { cn } from '../lib/cn.js';

export interface ExpenseSlice {
  label: string;
  value: number;
  color: string;
  /** Optional identity carried through to onSliceClick. */
  id?: string;
}

export interface ExpensePieChartProps {
  data: ExpenseSlice[];
  height?: number;
  /** Formats a slice value for the tooltip and the center total. */
  valueFormatter?: (value: number) => string;
  /** Renders the summed total in the donut hole. */
  showTotal?: boolean;
  /** Small caption above the center total. */
  totalLabel?: string;
  /** When set, slices become clickable and report their `id`. */
  onSliceClick?: (id: string) => void;
  className?: string;
}

interface TooltipDatum {
  name: string;
  value: number;
  payload: { color: string };
}

interface TooltipContentProps {
  active?: boolean;
  payload?: TooltipDatum[];
  total: number;
  valueFormatter?: (value: number) => string;
}

function TooltipContent({ active, payload, total, valueFormatter }: TooltipContentProps) {
  if (!active || !payload?.length) return null;
  const entry = payload[0]!;
  const pct = total > 0 ? Math.round((entry.value / total) * 100) : 0;
  return (
    <div className="bg-surface border-border rounded-md border p-2.5 shadow-card">
      <div className="flex items-center gap-2 text-xs">
        <span
          aria-hidden="true"
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: entry.payload.color }}
        />
        <span className="text-text-muted">{entry.name}</span>
        <span className="text-text ml-auto font-medium tabular-nums">
          {valueFormatter ? valueFormatter(entry.value) : entry.value}
        </span>
      </div>
      <p className="text-text-subtle mt-1 text-right text-[11px] tabular-nums">{pct}%</p>
    </div>
  );
}

/** Donut chart for expense composition — rounded slices, center total, hover tooltip. */
export function ExpensePieChart({
  data,
  height = 260,
  valueFormatter,
  showTotal = false,
  totalLabel,
  onSliceClick,
  className,
}: ExpensePieChartProps) {
  const total = data.reduce((sum, slice) => sum + slice.value, 0);

  return (
    <div className={cn('relative w-full', className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="label"
            cx="50%"
            cy="50%"
            innerRadius="62%"
            outerRadius="92%"
            paddingAngle={data.length > 1 ? 2 : 0}
            cornerRadius={5}
            startAngle={90}
            endAngle={-270}
            stroke="var(--color-surface)"
            strokeWidth={3}
            isAnimationActive={false}
            onClick={
              onSliceClick
                ? (entry: { id?: string; payload?: { id?: string } }) => {
                    const id = entry?.id ?? entry?.payload?.id;
                    if (id) onSliceClick(id);
                  }
                : undefined
            }
            style={onSliceClick ? { cursor: 'pointer' } : undefined}
          >
            {data.map((slice) => (
              <Cell key={slice.label} fill={slice.color} />
            ))}
          </Pie>
          <Tooltip
            wrapperStyle={{ zIndex: 50, outline: 'none' }}
            content={<TooltipContent total={total} valueFormatter={valueFormatter} />}
          />
        </PieChart>
      </ResponsiveContainer>

      {showTotal ? (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          {totalLabel ? (
            <span className="text-text-subtle text-[11px] font-medium tracking-wide uppercase">
              {totalLabel}
            </span>
          ) : null}
          <span className="text-text text-base font-semibold tabular-nums">
            {valueFormatter ? valueFormatter(total) : total}
          </span>
        </div>
      ) : null}
    </div>
  );
}
