import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TransactionDto } from '@finance/contracts';
import { OverdueGrid } from './overdue-grid';

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

describe('OverdueGrid', () => {
  it('lists overdue rows and effectuates the clicked one', () => {
    const onEffectuate = vi.fn();
    render(
      <OverdueGrid
        transactions={[tx()]}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onEffectuate={onEffectuate}
      />,
    );

    expect(screen.getByText('Aluguel')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Efetivar Aluguel' }));
    expect(onEffectuate).toHaveBeenCalledTimes(1);
  });

  it('fires onEdit and onDelete with the row transaction', () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    const row = tx();
    render(
      <OverdueGrid
        transactions={[row]}
        onEdit={onEdit}
        onDelete={onDelete}
        onEffectuate={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Editar Aluguel' }));
    expect(onEdit).toHaveBeenCalledWith(row);

    fireEvent.click(screen.getByRole('button', { name: 'Excluir Aluguel' }));
    expect(onDelete).toHaveBeenCalledWith(row);
  });

  it('shows an empty state when there are no overdue items', () => {
    render(<OverdueGrid transactions={[]} onEdit={vi.fn()} onDelete={vi.fn()} onEffectuate={vi.fn()} />);
    expect(screen.getByText(/Nenhuma pendência de meses anteriores/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Efetivar/ })).toBeNull();
  });
});
