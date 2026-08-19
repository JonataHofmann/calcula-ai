'use client';

import { Bar, BarChart, CartesianGrid, Cell, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { cn } from '../lib/cn.js';

export interface BalanceBarDatum {
  label: string;
  income: number;
  expense: number;
  balance: number;
}

export interface BalanceBarChartProps {
  data: BalanceBarDatum[];
  height?: number;
  incomeColor?: string;
  expenseColor?: string;
  positiveBalanceColor?: string;
  negativeBalanceColor?: string;
  valueFormatter?: (value: number) => string;
  className?: string;
}

interface TooltipEntry {
  dataKey: string;
  name: string;
  value: number;
  color: string;
}

interface TooltipContentProps {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string;
  valueFormatter?: (value: number) => string;
}

const axisTick = { fill: 'var(--color-text-muted)', fontSize: 12 };

function TooltipContent({ active, payload, label, valueFormatter }: TooltipContentProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface border-border rounded-md border p-2.5 shadow-card">
      <p className="text-text mb-1.5 text-xs font-semibold">{label}</p>
      <ul className="flex flex-col gap-1">
        {payload.map((entry) => (
          <li key={entry.dataKey} className="flex items-center gap-2 text-xs">
            <span
              aria-hidden="true"
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-text-muted">{entry.name}</span>
            <span className="text-text ml-auto font-medium tabular-nums">
              {valueFormatter ? valueFormatter(entry.value) : entry.value}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Grouped bar chart with income/expense/balance per point; the balance bar flips color when negative. */
export function BalanceBarChart({
  data,
  height = 280,
  incomeColor = 'var(--color-success)',
  expenseColor = 'var(--color-danger)',
  positiveBalanceColor = 'var(--color-success)',
  negativeBalanceColor = 'var(--color-danger)',
  valueFormatter,
  className,
}: BalanceBarChartProps) {
  return (
    <div className={cn('w-full', className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barGap={6} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="0" />
          <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} tickMargin={12} />
          <YAxis tick={axisTick} tickLine={false} axisLine={false} width={48} />
          <Tooltip
            cursor={{ fill: 'var(--color-border)', opacity: 0.25 }}
            content={<TooltipContent valueFormatter={valueFormatter} />}
          />
          <Legend
            verticalAlign="bottom"
            height={28}
            iconType="circle"
            wrapperStyle={{ fontSize: 12, color: 'var(--color-text-muted)' }}
          />
          <Bar dataKey="income" name="Receitas" fill={incomeColor} radius={[6, 6, 6, 6]} maxBarSize={14} />
          <Bar dataKey="expense" name="Despesas" fill={expenseColor} radius={[6, 6, 6, 6]} maxBarSize={14} />
          <Bar dataKey="balance" name="Saldo" radius={[6, 6, 6, 6]} maxBarSize={14}>
            {data.map((entry, index) => (
              <Cell
                key={`balance-${index}`}
                fill={entry.balance >= 0 ? positiveBalanceColor : negativeBalanceColor}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
