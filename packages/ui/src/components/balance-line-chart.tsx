'use client';

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { cn } from '../lib/cn.js';

export interface BalancePoint {
  label: string;
  value: number;
}

export interface BalanceLineChartProps {
  data: BalancePoint[];
  height?: number;
  color?: string;
  className?: string;
}

const axisTick = {
  fill: 'var(--color-text-muted)',
  fontSize: 12,
};

export function BalanceLineChart({
  data,
  height = 240,
  color = 'var(--color-primary)',
  className,
}: BalanceLineChartProps) {
  return (
    <div className={cn('w-full', className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <defs>
            <linearGradient id="balance-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.25} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--color-border)" strokeDasharray="0" />
          <XAxis
            dataKey="label"
            tick={axisTick}
            tickLine={false}
            axisLine={false}
            tickMargin={12}
          />
          <YAxis tick={axisTick} tickLine={false} axisLine={false} width={48} />
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={3}
            fill="url(#balance-fill)"
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
