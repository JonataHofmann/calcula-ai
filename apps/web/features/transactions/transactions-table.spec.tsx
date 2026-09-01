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
    purchaseDate: null,
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

  it('shows a synced indicator for synced transactions but not manual ones', () => {
    render(
      <TransactionsTable
        transactions={[
          tx(),
          tx({ id: 'synced-1', description: 'Compra no débito', source: 'synced', externalId: 'ext-1' }),
        ]}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getAllByTitle('Sincronizado automaticamente')).toHaveLength(1);
  });

  it('shows installment info and a direction icon for card transactions', () => {
    render(
      <TransactionsTable
        transactions={[
          tx({
            id: 'card-1',
            description: 'Parcela do sofá',
            creditCardId: '44444444-4444-4444-4444-444444444444',
            installmentNumber: 2,
            installmentCount: 3,
            type: 'expense',
          }),
          tx({
            id: 'card-2',
            description: 'Estorno da loja',
            creditCardId: '44444444-4444-4444-4444-444444444444',
            type: 'income',
          }),
        ]}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByText('(2/3)')).toBeInTheDocument();
    expect(screen.getByTitle('Aumenta a fatura')).toBeInTheDocument();
    expect(screen.getByTitle('Reduz a fatura')).toBeInTheDocument();
  });

  it('shows the invoice header plus nested children when grouping is OFF', () => {
    render(
      <TransactionsTable
        transactions={[
          tx({
            id: 'c1',
            description: 'Compra 1',
            creditCardId: '44444444-4444-4444-4444-444444444444',
          }),
        ]}
        cards={[{ id: '44444444-4444-4444-4444-444444444444', name: 'Cartão X' }]}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByText(/Fatura/)).toBeInTheDocument();
    expect(screen.getByText('Compra 1')).toBeInTheDocument();
  });

  it('shows only the invoice header (children hidden) when grouping is ON', () => {
    render(
      <TransactionsTable
        transactions={[
          tx({
            id: 'c1',
            description: 'Compra 1',
            creditCardId: '44444444-4444-4444-4444-444444444444',
          }),
        ]}
        cards={[{ id: '44444444-4444-4444-4444-444444444444', name: 'Cartão X' }]}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        groupCreditCardExpenses
      />,
    );
    expect(screen.getByText(/Fatura/)).toBeInTheDocument();
    expect(screen.queryByText('Compra 1')).not.toBeInTheDocument();
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

  it('hides the effectuate action for a pending credit-card transaction (only the invoice can be effectuated)', () => {
    render(
      <TransactionsTable
        transactions={[
          tx({
            id: 'card-pending-1',
            description: 'Compra no cartão',
            creditCardId: '44444444-4444-4444-4444-444444444444',
          }),
        ]}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onEffectuate={vi.fn()}
      />,
    );
    expect(
      screen.queryByRole('button', { name: 'Efetivar Compra no cartão' }),
    ).not.toBeInTheDocument();
  });

  it('still shows the effectuate action for a pending invoice row when grouping is on', () => {
    const onEffectuateInvoice = vi.fn();
    render(
      <TransactionsTable
        transactions={[
          tx({
            id: 'card-pending-2',
            description: 'Compra no cartão',
            creditCardId: '44444444-4444-4444-4444-444444444444',
          }),
        ]}
        cards={[{ id: '44444444-4444-4444-4444-444444444444', name: 'Cartão X' }]}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onEffectuateInvoice={onEffectuateInvoice}
        groupCreditCardExpenses
      />,
    );
    const button = screen.getByRole('button', { name: 'Efetivar fatura Cartão X' });
    fireEvent.click(button);
    expect(onEffectuateInvoice).toHaveBeenCalled();
  });

  it('shows the undo action for a paid row and fires onUndoEffectuate', () => {
    const onUndoEffectuate = vi.fn();
    const row = tx({ id: 'paid-1', description: 'Paga', status: 'paid' });
    render(
      <TransactionsTable
        transactions={[row]}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onUndoEffectuate={onUndoEffectuate}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Desfazer efetivação de Paga' }));
    expect(onUndoEffectuate).toHaveBeenCalledWith(row);
  });

  it('shows the undo action for a paid invoice row and fires onUndoEffectuateInvoice', () => {
    const onUndoEffectuateInvoice = vi.fn();
    render(
      <TransactionsTable
        transactions={[
          tx({
            id: 'card-paid-1',
            description: 'Compra no cartão',
            status: 'paid',
            creditCardId: '44444444-4444-4444-4444-444444444444',
          }),
        ]}
        cards={[{ id: '44444444-4444-4444-4444-444444444444', name: 'Cartão X' }]}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onUndoEffectuateInvoice={onUndoEffectuateInvoice}
        groupCreditCardExpenses
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Desfazer efetivação da fatura Cartão X' }));
    expect(onUndoEffectuateInvoice).toHaveBeenCalled();
  });
});
