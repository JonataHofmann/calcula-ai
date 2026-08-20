import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TransactionDto } from '@finance/contracts';
import { TransactionsTable } from './transactions-table';

afterEach(cleanup);

function tx(over: Partial<TransactionDto> = {}): TransactionDto {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    description: 'Aluguel',
    dueDate: '2026-01-10T00:00:00.000Z',
    amount: '1200.00',
    effectiveAmount: null,
    recurrence: 'single',
    effectiveDate: null,
    type: 'expense',
    notes: null,
    status: 'pending',
    endDate: null,
    installmentCount: null,
    installmentNumber: null,
    groupId: null,
    categoryId: '22222222-2222-2222-2222-222222222222',
    accountId: '33333333-3333-3333-3333-333333333333',
    creditCardId: null,
    source: 'manual',
    externalId: null,
    ...over,
  };
}

describe('TransactionsTable (sorting)', () => {
  it('emits the clicked column via onSort', () => {
    const onSort = vi.fn();
    render(
      <TransactionsTable
        transactions={[tx()]}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        sort="dueDate"
        order="asc"
        onSort={onSort}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Ordenar por Valor' }));
    expect(onSort).toHaveBeenCalledWith('amount');
  });

  it('renders plain headers when not sortable', () => {
    render(<TransactionsTable transactions={[tx()]} onEdit={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Ordenar por Valor' })).toBeNull();
    expect(screen.getByText('Vencimento')).toBeInTheDocument();
  });
});
