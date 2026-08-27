'use client';

import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { cn } from '../lib/cn.js';

export interface BalanceBarDatum {
  label: string;
  income: number;
  expense: number;
  balance: number;
  /** Variação percentual do balanço vs. mês anterior; null quando não há base para comparar. */
  changePct?: number | null;
}

export interface BalanceBarChartProps {
  data: BalanceBarDatum[];
  height?: number;
  incomeColor?: string;
  expenseColor?: string;
  positiveBalanceColor?: string;
  negativeBalanceColor?: string;
  changeLineColor?: string;
  valueFormatter?: (value: number) => string;
  className?: string;
}

interface TooltipEntry {
  dataKey: string;
  name: string;
  value: number;
  color: string;
  payload?: BalanceBarDatum;
}

interface TooltipContentProps {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string;
  valueFormatter?: (value: number) => string;
}

const axisTick = { fill: 'var(--color-text-muted)', fontSize: 12 };

function formatPct(value: number): string {
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
}

function deltaColor(pct: number): string {
  return pct >= 0 ? 'var(--color-success)' : 'var(--color-danger)';
}

function TooltipContent({ active, payload, label, valueFormatter }: TooltipContentProps) {
  if (!active || !payload?.length) return null;
  // A linha e a barra de balanço compartilham o dataKey "balance": mostra uma vez só.
  const seen = new Set<string>();
  const rows = payload.filter((e) => {
    if (seen.has(e.dataKey)) return false;
    seen.add(e.dataKey);
    return true;
  });
  const changePct = payload[0]?.payload?.changePct;
  return (
    <div className="bg-surface border-border rounded-md border p-2.5 shadow-card">
      <p className="text-text mb-1.5 text-xs font-semibold">{label}</p>
      <ul className="flex flex-col gap-1">
        {rows.map((entry) => (
          <li key={entry.dataKey} className="flex items-center gap-2 text-xs">
            <span
              aria-hidden="true"
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-text-muted">{entry.name === 'Variação do balanço' ? 'Saldo' : entry.name}</span>
            <span className="text-text ml-auto font-medium tabular-nums">
              {valueFormatter ? valueFormatter(entry.value) : entry.value}
            </span>
          </li>
        ))}
        {changePct !== null && changePct !== undefined ? (
          <li className="border-border mt-0.5 flex items-center gap-2 border-t pt-1 text-xs">
            <span
              aria-hidden="true"
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: deltaColor(changePct) }}
            />
            <span className="text-text-muted">Variação vs. mês anterior</span>
            <span
              className="ml-auto font-semibold tabular-nums"
              style={{ color: deltaColor(changePct) }}
            >
              {formatPct(changePct)}
            </span>
          </li>
        ) : null}
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
  changeLineColor = 'var(--color-text)',
  valueFormatter,
  className,
}: BalanceBarChartProps) {
  const hasChange = data.some((d) => d.changePct !== null && d.changePct !== undefined);

  // Ponto só onde há variação; ancorado no topo da barra de balanço (eixo de valor).
  const renderDot = (props: { cx?: number; cy?: number; index?: number; key?: string }) => {
    const { cx, cy, index, key } = props;
    const pct = index != null ? data[index]?.changePct : null;
    if (cx == null || cy == null || pct == null) return <g key={key} />;
    return (
      <circle key={key} cx={cx} cy={cy} r={3.5} fill={deltaColor(pct)} stroke="var(--color-surface)" strokeWidth={1.5} />
    );
  };

  // Rótulo "%": logo acima do ponto, no topo do balanço.
  // Rótulo "%": pílula colorida com seta de direção, ancorada acima do topo do balanço.
  const renderLabel = (props: { x?: number; y?: number; index?: number }) => {
    const { x, y, index } = props;
    const pct = index != null ? data[index]?.changePct : null;
    if (x == null || y == null || pct == null) return <g />;
    const up = pct >= 0;
    const text = `${Math.abs(pct).toFixed(1)}%`;
    const w = text.length * 6.4 + 22;
    const h = 18;
    const bx = x - w / 2;
    const by = y - 12 - h;
    const cy = by + h / 2;
    const color = deltaColor(pct);
    return (
      <g>
        <rect x={bx} y={by} width={w} height={h} rx={h / 2} fill={color} />
        <path
          d={up ? `M${bx + 9} ${cy + 3} l3 -5 l3 5 Z` : `M${bx + 9} ${cy - 3} l3 5 l3 -5 Z`}
          fill="#fff"
        />
        <text
          x={bx + w / 2 + 5}
          y={cy}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={10.5}
          fontWeight={700}
          fill="#fff"
        >
          {text}
        </text>
      </g>
    );
  };

  return (
    <div className={cn('w-full', className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} barGap={4} barCategoryGap="22%" margin={{ top: hasChange ? 36 : 8, right: 8, bottom: 0, left: -16 }}>
          <defs>
            <linearGradient id="kc-bar-income" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={incomeColor} stopOpacity={0.95} />
              <stop offset="100%" stopColor={incomeColor} stopOpacity={0.55} />
            </linearGradient>
            <linearGradient id="kc-bar-expense" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={expenseColor} stopOpacity={0.95} />
              <stop offset="100%" stopColor={expenseColor} stopOpacity={0.55} />
            </linearGradient>
            <linearGradient id="kc-bar-balance-pos" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={positiveBalanceColor} stopOpacity={0.95} />
              <stop offset="100%" stopColor={positiveBalanceColor} stopOpacity={0.55} />
            </linearGradient>
            <linearGradient id="kc-bar-balance-neg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={negativeBalanceColor} stopOpacity={0.95} />
              <stop offset="100%" stopColor={negativeBalanceColor} stopOpacity={0.55} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="3 4" strokeOpacity={0.7} />
          <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} tickMargin={12} />
          <YAxis yAxisId="value" tick={axisTick} tickLine={false} axisLine={false} width={48} />
          <Tooltip
            cursor={{ fill: 'var(--color-border)', opacity: 0.2, radius: 6 }}
            wrapperStyle={{ zIndex: 50 }}
            content={<TooltipContent valueFormatter={valueFormatter} />}
          />
          <Legend
            verticalAlign="bottom"
            height={28}
            iconType="circle"
            wrapperStyle={{ fontSize: 12, color: 'var(--color-text-muted)' }}
          />
          <Bar yAxisId="value" dataKey="income" name="Receitas" fill="url(#kc-bar-income)" radius={[5, 5, 0, 0]} maxBarSize={22} />
          <Bar yAxisId="value" dataKey="expense" name="Despesas" fill="url(#kc-bar-expense)" radius={[5, 5, 0, 0]} maxBarSize={22} />
          <Bar yAxisId="value" dataKey="balance" name="Saldo" radius={[5, 5, 0, 0]} maxBarSize={22}>
            {data.map((entry, index) => (
              <Cell
                key={`balance-${index}`}
                fill={entry.balance >= 0 ? 'url(#kc-bar-balance-pos)' : 'url(#kc-bar-balance-neg)'}
              />
            ))}
          </Bar>
          {hasChange ? (
            <Line
              yAxisId="value"
              type="monotone"
              dataKey="balance"
              name="Variação do balanço"
              stroke={changeLineColor}
              strokeWidth={1.5}
              strokeOpacity={0.45}
              strokeDasharray="5 4"
              connectNulls
              dot={renderDot}
              label={renderLabel}
              activeDot={false}
              isAnimationActive={false}
            />
          ) : null}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
