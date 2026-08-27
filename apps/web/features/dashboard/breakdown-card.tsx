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
import { ChevronDown, ChevronLeft } from 'lucide-react';
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
  /** When set, slices/legend rows become clickable and report their id (drill-down). */
  onRowClick?: (id: string) => void;
  /** When set, shows a back button before the title (exits drill-down). */
  onBack?: () => void;
}

export function BreakdownCard({
  title,
  rows,
  emptyMessage = 'Nenhuma despesa neste período',
  onRowClick,
  onBack,
}: BreakdownCardProps) {
  const [expanded, setExpanded] = useState(false);
  const total = rows.reduce((sum, r) => sum + r.cents, 0);
  const sorted = [...rows].sort((a, b) => b.cents - a.cents);
  const slices: ExpenseSlice[] = sorted.map((row) => ({
    id: row.id,
    label: row.label,
    value: row.cents,
    color: COLOR_TOKEN_HEX[row.color],
  }));

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-1.5">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              aria-label="Voltar às categorias"
              className="text-text-muted hover:text-text hover:bg-surface-2 -ml-1.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-icon transition-colors"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : null}
          <h3 className="text-text truncate text-sm font-semibold">{title}</h3>
        </div>
        {total > 0 ? (
          <span className="text-text-muted shrink-0 text-xs font-medium">
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
            onSliceClick={onRowClick}
          />
          {onRowClick ? (
            <p className="text-text-subtle -mt-2 text-center text-[11px]">
              Toque numa fatia para ver as subcategorias
            </p>
          ) : null}

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
                    <div
                      className={cn(
                        'flex items-center gap-2.5',
                        onRowClick &&
                          'hover:bg-surface-2 -mx-2 cursor-pointer rounded-btn px-2 py-1 transition-colors',
                      )}
                      onClick={onRowClick ? () => onRowClick(row.id) : undefined}
                    >
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
