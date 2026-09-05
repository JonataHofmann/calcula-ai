'use client';

import { CreditCard, Wallet } from 'lucide-react';
import type { ForecastResponse } from '@finance/contracts';
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from '@finance/ui';
import { centsToMoney, money, toCents } from '../../util/money';

export interface ForecastReportProps {
  forecast: ForecastResponse;
  /** Collapse card commitments into one row per card and all fixed expenses into a single row. */
  groupByCard?: boolean;
}

type ApiRow = ForecastResponse['rows'][number];
type Cell = { month: string; amount: string | null };

/** A row as rendered: a label, an optional origin caption, and cells aligned to `months`. */
interface DisplayRow {
  key: string;
  label: string;
  origin: { kind: 'account' | 'card'; name: string } | null;
  /** Direction: income rows (estimates) render green with a leading '+'; expenses are neutral. */
  type: 'expense' | 'income';
  cells: Cell[];
}

/** Formats a `YYYY-MM` month key as a pt-BR month/year label. */
function monthLabel(month: string): string {
  const [year, mon] = month.split('-');
  return new Date(Date.UTC(Number(year), Number(mon) - 1, 1)).toLocaleDateString('pt-BR', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function apiRowLabel(row: ApiRow): string {
  if (row.recurrence === 'installment' && row.installmentCount) {
    return `${row.description} (${row.installmentCount}x)`;
  }
  if (row.recurrence === 'estimate') return `${row.description} (estimativa)`;
  return `${row.description} (fixa)`;
}

/** Sums cells across rows month-by-month; a month is null only when every row is null there. */
function sumCells(rows: ApiRow[], months: string[]): Cell[] {
  return months.map((month, i) => {
    let hasValue = false;
    let cents = 0;
    for (const row of rows) {
      const amount = row.cells[i]?.amount;
      if (amount != null) {
        hasValue = true;
        cents += toCents(amount);
      }
    }
    return { month, amount: hasValue ? centsToMoney(cents) : null };
  });
}

function origin(row: ApiRow): DisplayRow['origin'] {
  return row.originKind && row.originName
    ? { kind: row.originKind, name: row.originName }
    : null;
}

/** Builds the rendered rows: card first, then fixed, then the rest — collapsing when grouping is on. */
function buildRows(forecast: ForecastResponse, groupByCard: boolean): DisplayRow[] {
  const { rows, months } = forecast;
  if (!groupByCard) {
    return rows.map((row) => ({
      key: row.key,
      label: apiRowLabel(row),
      origin: origin(row),
      type: row.type,
      cells: row.cells,
    }));
  }

  const cardRows = rows.filter((r) => r.originKind === 'card');
  const fixedRows = rows.filter((r) => r.originKind !== 'card' && r.recurrence === 'fixed');
  const rest = rows.filter((r) => r.originKind !== 'card' && r.recurrence !== 'fixed');

  const out: DisplayRow[] = [];

  // One row per card, cells summed.
  const byCard = new Map<string, ApiRow[]>();
  for (const r of cardRows) {
    const id = r.originId as string;
    const bucket = byCard.get(id) ?? [];
    bucket.push(r);
    byCard.set(id, bucket);
  }
  for (const [id, items] of byCard) {
    out.push({
      key: `card-${id}`,
      label: items[0]?.originName ?? 'Cartão',
      origin: { kind: 'card', name: items[0]?.originName ?? 'Cartão' },
      type: 'expense',
      cells: sumCells(items, months),
    });
  }

  // All fixed (non-card) expenses collapsed into a single row.
  if (fixedRows.length > 0) {
    out.push({
      key: 'fixed-all',
      label: 'Despesas fixas',
      origin: null,
      type: 'expense',
      cells: sumCells(fixedRows, months),
    });
  }

  // Remaining installments (on accounts) and estimates kept individual (carry their own type).
  for (const r of rest) {
    out.push({ key: r.key, label: apiRowLabel(r), origin: origin(r), type: r.type, cells: r.cells });
  }

  return out;
}

/** Sticky first column so it stays put while months scroll horizontally. */
const STICKY = 'sticky left-0 z-10 bg-surface';

export function ForecastReport({ forecast, groupByCard = false }: ForecastReportProps) {
  const columnCount = forecast.months.length + 1;
  const rows = buildRows(forecast, groupByCard);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className={STICKY}>Compromisso</TableHead>
          {forecast.months.map((month) => (
            <TableHead key={month} className="text-right">
              {monthLabel(month)}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 ? (
          <TableEmpty colSpan={columnCount} message="Nenhum parcelamento ou despesa fixa cadastrado" />
        ) : (
          <>
            {rows.map((row) => (
              <TableRow key={row.key}>
                <TableCell className={`${STICKY} text-text font-medium`}>
                  <span>{row.label}</span>
                  {row.origin ? (
                    <span className="text-text-muted mt-0.5 flex items-center gap-1 text-xs font-normal">
                      {row.origin.kind === 'card' ? (
                        <CreditCard className="h-3 w-3" aria-hidden="true" />
                      ) : (
                        <Wallet className="h-3 w-3" aria-hidden="true" />
                      )}
                      {row.origin.name}
                    </span>
                  ) : null}
                </TableCell>
                {row.cells.map((cell) => (
                  <TableCell
                    key={cell.month}
                    className={`text-right ${row.type === 'income' ? 'text-success' : 'text-text-muted'}`}
                  >
                    {cell.amount ? `${row.type === 'income' ? '+' : ''}${money(cell.amount)}` : '-'}
                  </TableCell>
                ))}
              </TableRow>
            ))}
            <TableRow>
              <TableCell className={`${STICKY} text-text font-semibold`}>Total</TableCell>
              {forecast.totals.map((total) => (
                <TableCell key={total.month} className="text-text text-right font-semibold">
                  {money(total.amount)}
                </TableCell>
              ))}
            </TableRow>
          </>
        )}
      </TableBody>
    </Table>
  );
}
