'use client';

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

export interface ForecastReportProps {
  forecast: ForecastResponse;
}

/** Formats a decimal-string amount as pt-BR currency. */
function money(value: string): string {
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
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

function rowLabel(row: ForecastResponse['rows'][number]): string {
  if (row.recurrence === 'installment' && row.installmentCount) {
    return `${row.description} (${row.installmentCount}x)`;
  }
  return `${row.description} (fixa)`;
}

export function ForecastReport({ forecast }: ForecastReportProps) {
  const columnCount = forecast.months.length + 1;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Compromisso</TableHead>
          {forecast.months.map((month) => (
            <TableHead key={month} className="text-right">
              {monthLabel(month)}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {forecast.rows.length === 0 ? (
          <TableEmpty colSpan={columnCount} message="Nenhum parcelamento ou despesa fixa cadastrado" />
        ) : (
          <>
            {forecast.rows.map((row) => (
              <TableRow key={row.key}>
                <TableCell className="text-text font-medium">{rowLabel(row)}</TableCell>
                {row.cells.map((cell) => (
                  <TableCell key={cell.month} className="text-text-muted text-right">
                    {cell.amount ? money(cell.amount) : '-'}
                  </TableCell>
                ))}
              </TableRow>
            ))}
            <TableRow>
              <TableCell className="text-text font-semibold">Total</TableCell>
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
