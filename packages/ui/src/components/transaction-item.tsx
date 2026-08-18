import type { ReactNode } from 'react';
import { cn } from '../lib/cn.js';
import { formatBRL } from '../lib/format.js';

export interface TransactionItemProps {
  description: string;
  date: string;
  amount: string;
  icon?: ReactNode;
  category?: string;
  className?: string;
}

export function TransactionItem({
  description,
  date,
  amount,
  icon,
  category,
  className,
}: TransactionItemProps) {
  const negative = amount.startsWith('-');
  const magnitude = negative ? amount.slice(1) : amount;

  return (
    <li className={cn('flex items-center gap-3 py-3', className)}>
      {icon ? (
        <span
          aria-hidden="true"
          className="bg-surface-2 text-text-muted flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
        >
          {icon}
        </span>
      ) : null}
      <div className="min-w-0 flex-1">
        <p className="text-text truncate text-sm font-medium">{description}</p>
        <p className="text-text-muted truncate text-xs">
          {category ? `${category} · ` : ''}
          {date}
        </p>
      </div>
      <p
        className={cn(
          'shrink-0 text-sm font-semibold',
          negative ? 'text-danger' : 'text-success',
        )}
      >
        {negative ? '-' : '+'}
        {formatBRL(magnitude)}
      </p>
    </li>
  );
}

export interface TransactionListProps {
  items: TransactionItemProps[];
  emptyMessage?: string;
  className?: string;
}

export function TransactionList({
  items,
  emptyMessage = 'Nenhuma transação',
  className,
}: TransactionListProps) {
  if (items.length === 0) {
    return <p className={cn('text-text-muted py-8 text-center text-sm', className)}>{emptyMessage}</p>;
  }
  return (
    <ul className={cn('divide-border divide-y', className)}>
      {items.map((item, index) => (
        <TransactionItem key={`${item.description}-${item.date}-${index}`} {...item} />
      ))}
    </ul>
  );
}
