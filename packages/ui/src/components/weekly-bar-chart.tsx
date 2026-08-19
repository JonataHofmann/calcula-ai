'use client';

import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { cn } from '../lib/cn.js';

export interface WeeklyBarDatum {
  label: string;
  deposit: number;
  withdraw: number;
}

export interface WeeklyBarChartProps {
  data: WeeklyBarDatum[];
  height?: number;
  depositColor?: string;
  withdrawColor?: string;
  className?: string;
  /** When set, renders a value label above each bar, formatted with this function. Zero-value bars are left unlabeled. */
  valueFormatter?: (value: number) => string;
}

const axisTick = {
  fill: 'var(--color-text-muted)',
  fontSize: 12,
};

const labelStyle = { fill: 'var(--color-text-muted)', fontSize: 11 };

export function WeeklyBarChart({
  data,
  height = 240,
  depositColor = 'var(--color-success)',
  withdrawColor = 'var(--color-danger)',
  className,
  valueFormatter,
}: WeeklyBarChartProps) {
  const renderLabel = (value: number) => (value ? valueFormatter?.(value) ?? '' : '');

  return (
    <div className={cn('w-full', className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barGap={8} margin={{ top: valueFormatter ? 20 : 8, right: 8, bottom: 0, left: -16 }}>
          <CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="0" />
          <XAxis
            dataKey="label"
            tick={axisTick}
            tickLine={false}
            axisLine={false}
            tickMargin={12}
          />
          <YAxis tick={axisTick} tickLine={false} axisLine={false} width={48} />
          <Bar dataKey="deposit" fill={depositColor} radius={[8, 8, 8, 8]} maxBarSize={16}>
            {valueFormatter ? (
              <LabelList dataKey="deposit" position="top" style={labelStyle} formatter={renderLabel} />
            ) : null}
          </Bar>
          <Bar dataKey="withdraw" fill={withdrawColor} radius={[8, 8, 8, 8]} maxBarSize={16}>
            {valueFormatter ? (
              <LabelList dataKey="withdraw" position="top" style={labelStyle} formatter={renderLabel} />
            ) : null}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
