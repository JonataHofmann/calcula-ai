'use client';

import type { TransactionDto } from '@finance/contracts';
import {
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@finance/ui';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';

export interface OverdueGridProps {
  transactions: TransactionDto[];
  onEffectuate: (transaction: TransactionDto) => void;
}

/** Formats a decimal-string amount as pt-BR currency. */
function money(value: string): string {
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** Formats an ISO instant as a pt-BR date, read in UTC to match the stored instant. */
function day(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

/** Grid of unpaid occurrences due before the current month. Empty when nothing is overdue. */
export function OverdueGrid({ transactions, onEffectuate }: OverdueGridProps) {
  if (transactions.length === 0) {
    return (
      <div className="text-text-muted flex items-center gap-2 p-4 text-sm">
        <CheckCircle2 className="text-success h-4 w-4" aria-hidden="true" />
        Nenhuma pendência de meses anteriores.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="text-warning flex items-center gap-2 text-sm font-medium">
        <AlertTriangle className="h-4 w-4" aria-hidden="true" />
        Pendentes de meses anteriores
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Descrição</TableHead>
            <TableHead>Vencimento</TableHead>
            <TableHead>Valor</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.map((t) => (
            <TableRow key={t.id}>
              <TableCell className="text-text font-medium">{t.description}</TableCell>
              <TableCell className="text-text-muted">{day(t.dueDate)}</TableCell>
              <TableCell className={t.type === 'income' ? 'text-success' : 'text-text'}>
                {money(t.amount)}
              </TableCell>
              <TableCell>
                <div className="flex items-center justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEffectuate(t)}
                    aria-label={`Efetivar ${t.description}`}
                  >
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
