import { Inject, Injectable } from '@nestjs/common';
import type { ForecastQuery, ForecastResponse, ForecastRow } from '@finance/contracts';
import type { Transaction } from '../../../domain/transaction';
import {
  TRANSACTION_REPOSITORY,
  type TransactionRepository,
} from '../../../domain/transaction.repository';
import { addMonthClamped, fromCents, nextOccurrence, toCents } from '../../../domain/recurrence';

function parseMonth(month: string): Date {
  const [yearStr, monthStr] = month.split('-');
  return new Date(Date.UTC(Number(yearStr), Number(monthStr) - 1, 1));
}

function formatMonth(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function startOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function isSameMonth(a: Date, b: Date): boolean {
  return startOfMonth(a).getTime() === startOfMonth(b).getTime();
}

function buildMonthsList(from: string, count: number): string[] {
  const start = parseMonth(from);
  return Array.from({ length: count }, (_, i) => formatMonth(addMonthClamped(start, i)));
}

function projectFixedCells(
  group: Transaction[],
  months: string[],
): Array<{ month: string; amount: string | null }> {
  const byMonth = new Map<string, Transaction>();
  for (const row of group) byMonth.set(formatMonth(row.dueDate), row);
  const anchor = group[group.length - 1] as Transaction;

  let cursor = anchor.dueDate;
  let amount = anchor.amount;
  let terminated = false;

  return months.map((month) => {
    const monthDate = parseMonth(month);
    if (monthDate.getTime() < startOfMonth(cursor).getTime()) {
      return { month, amount: null };
    }
    if (terminated) return { month, amount: null };

    while (!isSameMonth(cursor, monthDate)) {
      const next = nextOccurrence(cursor, anchor.endDate);
      if (next === null) {
        terminated = true;
        break;
      }
      cursor = next;
      const actual = byMonth.get(formatMonth(cursor));
      if (actual) amount = actual.amount;
    }
    if (terminated) return { month, amount: null };

    const actual = byMonth.get(formatMonth(cursor));
    if (actual) amount = actual.amount;
    return { month, amount };
  });
}

function projectInstallmentCells(
  group: Transaction[],
  months: string[],
): Array<{ month: string; amount: string | null }> {
  const byMonth = new Map<string, Transaction>();
  for (const row of group) byMonth.set(formatMonth(row.dueDate), row);
  return months.map((month) => {
    const row = byMonth.get(month);
    return { month, amount: row ? row.amount : null };
  });
}

@Injectable()
export class GetForecastUseCase {
  constructor(
    @Inject(TRANSACTION_REPOSITORY) private readonly transactions: TransactionRepository,
  ) {}

  async execute(userId: string, query: ForecastQuery): Promise<ForecastResponse> {
    const months = buildMonthsList(query.from, query.months);
    const dueFrom = new Date(0);
    const dueTo = addMonthClamped(parseMonth(months[months.length - 1] as string), 1);

    const all = await this.transactions.find(userId, {
      dueFrom,
      dueTo,
      sort: 'dueDate',
      order: 'asc',
    });

    const relevant = all.filter((t) => t.type === 'expense' && t.recurrence !== 'single');

    const groups = new Map<string, Transaction[]>();
    for (const t of relevant) {
      const key = t.groupId as string;
      const bucket = groups.get(key);
      if (bucket) bucket.push(t);
      else groups.set(key, [t]);
    }

    const rows: ForecastRow[] = [];
    for (const [key, group] of groups) {
      const first = group[0] as Transaction;
      if (first.recurrence === 'installment') {
        rows.push({
          key,
          description: first.description,
          recurrence: 'installment',
          installmentCount: first.installmentCount,
          cells: projectInstallmentCells(group, months),
        });
      } else {
        rows.push({
          key,
          description: first.description,
          recurrence: 'fixed',
          installmentCount: null,
          cells: projectFixedCells(group, months),
        });
      }
    }

    const totals = months.map((month, i) => {
      const cents = rows.reduce((sum, row) => {
        const cell = row.cells[i];
        return sum + (cell?.amount ? toCents(cell.amount) : 0);
      }, 0);
      return { month, amount: fromCents(cents) };
    });

    return { months, rows, totals };
  }
}
