'use client';

import type { ColorToken } from '@finance/contracts';
import {
  Card,
  cn,
  COLOR_TOKEN_BG,
  COLOR_TOKEN_HEX,
  COLOR_TOKEN_SOFT_BG,
  COLOR_TOKEN_TEXT,
  ExpensePieChart,
  formatBRL,
  type ExpenseSlice,
} from '@finance/ui';
import { ChevronDown } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { centsToMoney } from '../../util/money';

export interface BreakdownRow {
  id: string;
  label: string;
  /** Total in integer cents. */
  cents: number;
  color: ColorToken;
  icon?: ReactNode;
}

export interface BreakdownCardProps {
  title: string;
  rows: BreakdownRow[];
  emptyMessage?: string;
}

export function BreakdownCard({
  title,
  rows,
  emptyMessage = 'Nenhuma despesa neste período',
}: BreakdownCardProps) {
  const [expanded, setExpanded] = useState(false);
  const total = rows.reduce((sum, r) => sum + r.cents, 0);
  const sorted = [...rows].sort((a, b) => b.cents - a.cents);
  const slices: ExpenseSlice[] = sorted.map((row) => ({
    label: row.label,
    value: row.cents,
    color: COLOR_TOKEN_HEX[row.color],
  }));

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-text text-sm font-semibold">{title}</h3>
        {total > 0 ? (
          <span className="text-text-muted text-xs font-medium">
            {formatBRL(centsToMoney(total))}
          </span>
        ) : null}
      </div>

      {sorted.length === 0 || total === 0 ? (
        <p className="text-text-muted py-6 text-center text-sm">{emptyMessage}</p>
      ) : (
        <>
          <ExpensePieChart
            data={slices}
            height={400}
            showTotal
            totalLabel="Total"
            valueFormatter={(cents) => formatBRL(centsToMoney(cents))}
          />

          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className="text-text-muted hover:text-text hover:bg-surface-2 -mt-1 flex items-center justify-center gap-1.5 rounded-btn py-1.5 text-xs font-medium transition-colors"
          >
            {expanded ? 'Ocultar detalhes' : 'Ver detalhes'}
            <ChevronDown
              className={cn('h-3.5 w-3.5 transition-transform', expanded && 'rotate-180')}
              aria-hidden="true"
            />
          </button>

          {expanded ? (
            <ul className="flex flex-col gap-3.5">
              {sorted.map((row) => {
                const pct = total > 0 ? Math.round((row.cents / total) * 100) : 0;
                return (
                  <li key={row.id} className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2.5">
                      {row.icon ? (
                        <span
                          aria-hidden="true"
                          className={cn(
                            'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                            COLOR_TOKEN_SOFT_BG[row.color],
                            COLOR_TOKEN_TEXT[row.color],
                          )}
                        >
                          {row.icon}
                        </span>
                      ) : null}
                      <span className="text-text min-w-0 flex-1 truncate text-sm font-medium">
                        {row.label}
                      </span>
                      <span className="text-text shrink-0 text-sm font-semibold">
                        {formatBRL(centsToMoney(row.cents))}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 pl-[42px]">
                      <div className="bg-border/50 h-1.5 flex-1 overflow-hidden rounded-full">
                        <div
                          className={cn('h-full rounded-full', COLOR_TOKEN_BG[row.color])}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-text-muted w-9 shrink-0 text-right text-xs tabular-nums">
                        {pct}%
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </>
      )}
    </Card>
  );
}
