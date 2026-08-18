import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TransactionDto } from '@finance/contracts';
import { EffectuateModal } from './effectuate-modal';

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

function setup(onConfirm = vi.fn()) {
  render(<EffectuateModal open onClose={vi.fn()} onConfirm={onConfirm} transaction={tx()} />);
  return { onConfirm };
}

describe('EffectuateModal', () => {
  it('defaults the value to the due amount', () => {
    setup();
    expect(screen.getByLabelText('Valor')).toHaveValue('1200.00');
    expect(screen.getByLabelText('Data')).toHaveValue(new Date().toISOString().slice(0, 10));
  });

  it('confirms with the chosen date and amount', async () => {
    const { onConfirm } = setup();
    fireEvent.change(screen.getByLabelText('Data'), { target: { value: '2026-01-15' } });
    fireEvent.change(screen.getByLabelText('Valor'), { target: { value: '1150.00' } });

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));

    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
    expect(onConfirm).toHaveBeenCalledWith({
      date: '2026-01-15T00:00:00.000Z',
      amount: '1150.00',
    });
  });

  it('blocks confirm when the amount is not positive', async () => {
    const { onConfirm } = setup();
    fireEvent.change(screen.getByLabelText('Valor'), { target: { value: '0' } });

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));

    expect(await screen.findByText('Valor deve ser maior que zero')).toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
