'use client';

import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import { cn } from '../lib/cn.js';

export interface ExpenseSlice {
  label: string;
  value: number;
  color: string;
}

export interface ExpensePieChartProps {
  data: ExpenseSlice[];
  height?: number;
  className?: string;
}

interface SliceLabelProps {
  cx: number;
  cy: number;
  midAngle: number;
  innerRadius: number;
  outerRadius: number;
  percent: number;
  index: number;
}

const RAD = Math.PI / 180;

export function ExpensePieChart({ data, height = 260, className }: ExpensePieChartProps) {
  function renderLabel({ cx, cy, midAngle, outerRadius, percent, index }: SliceLabelProps) {
    const radius = outerRadius * 0.62;
    const x = cx + radius * Math.cos(-midAngle * RAD);
    const y = cy + radius * Math.sin(-midAngle * RAD);
    return (
      <text
        x={x}
        y={y}
        fill="#ffffff"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={12}
        fontWeight={600}
      >
        <tspan x={x} dy="-0.4em" fontSize={13}>
          {Math.round(percent * 100)}%
        </tspan>
        <tspan x={x} dy="1.3em" fontSize={11} fontWeight={500}>
          {data[index]?.label}
        </tspan>
      </text>
    );
  }

  return (
    <div className={cn('w-full', className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="label"
            cx="50%"
            cy="50%"
            outerRadius="90%"
            paddingAngle={3}
            startAngle={90}
            endAngle={-270}
            labelLine={false}
            label={renderLabel}
            stroke="var(--color-surface)"
            strokeWidth={4}
            isAnimationActive={false}
          >
            {data.map((slice) => (
              <Cell key={slice.label} fill={slice.color} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
