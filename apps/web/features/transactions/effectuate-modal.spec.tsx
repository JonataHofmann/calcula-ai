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

function setup(onConfirm = vi.fn()) {
  render(<EffectuateModal open onClose={vi.fn()} onConfirm={onConfirm} transaction={tx()} />);
  return { onConfirm };
}

/** Today's 'YYYY-MM' prefix, for picking a day cell in the current calendar month. */
const YM = new Date().toISOString().slice(0, 7);
const TODAY = new Date().toISOString().slice(0, 10);

describe('EffectuateModal', () => {
  it('defaults the value to the due amount', () => {
    setup();
    expect(screen.getByLabelText('Valor')).toHaveValue('1.200,00');
    expect(screen.getByLabelText('Data')).toHaveAttribute('data-value', TODAY);
  });

  it('confirms with the chosen date and amount', async () => {
    const { onConfirm } = setup();
    fireEvent.click(screen.getByLabelText('Data'));
    fireEvent.click(screen.getByLabelText(`${YM}-15`));
    fireEvent.change(screen.getByLabelText('Valor'), { target: { value: '115000' } });

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));

    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
    expect(onConfirm).toHaveBeenCalledWith({
      date: `${YM}-15T00:00:00.000Z`,
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
