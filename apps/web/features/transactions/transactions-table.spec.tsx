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
    ...over,
  };
}

describe('TransactionsTable', () => {
  it('renders a row with the description', () => {
    render(<TransactionsTable transactions={[tx()]} onEdit={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText('Aluguel')).toBeInTheDocument();
  });

  it('shows the empty state when there are no transactions', () => {
    render(<TransactionsTable transactions={[]} onEdit={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText('Nenhuma transação neste mês')).toBeInTheDocument();
  });

  it('fires onEdit and onDelete with the row transaction', () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    const row = tx();
    render(<TransactionsTable transactions={[row]} onEdit={onEdit} onDelete={onDelete} />);

    fireEvent.click(screen.getByRole('button', { name: 'Editar Aluguel' }));
    expect(onEdit).toHaveBeenCalledWith(row);

    fireEvent.click(screen.getByRole('button', { name: 'Excluir Aluguel' }));
    expect(onDelete).toHaveBeenCalledWith(row);
  });

  it('shows the effectuate action only for pending rows when handler is given', () => {
    const onEffectuate = vi.fn();
    render(
      <TransactionsTable
        transactions={[tx(), tx({ id: 'paid-1', description: 'Paga', status: 'paid' })]}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onEffectuate={onEffectuate}
      />,
    );
    expect(screen.getByRole('button', { name: 'Efetivar Aluguel' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Efetivar Paga' })).not.toBeInTheDocument();
  });
});
