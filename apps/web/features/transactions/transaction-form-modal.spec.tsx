import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CategoryNodeDto, CategoryTreeDto } from '@finance/contracts';
import { TransactionFormModal } from './transaction-form-modal';

afterEach(cleanup);

const CAT_EXPENSE = '44444444-4444-4444-4444-444444444444';
const CAT_INCOME = '55555555-5555-5555-5555-555555555555';
const ACC = '33333333-3333-3333-3333-333333333333';
const CARD = '66666666-6666-6666-6666-666666666666';

function node(id: string, name: string, type: 'expense' | 'income'): CategoryNodeDto {
  return { id, name, icon: 'wallet', color: 'primary', type, source: 'custom', children: [] };
}

const categories: CategoryTreeDto = {
  expense: [node(CAT_EXPENSE, 'Moradia', 'expense')],
  income: [node(CAT_INCOME, 'Salário', 'income')],
};

function setup(onSubmit = vi.fn()) {
  render(
    <TransactionFormModal
      open
      onClose={vi.fn()}
      onSubmit={onSubmit}
      categories={categories}
      accounts={[{ id: ACC, name: 'Conta Corrente' }]}
      cards={[{ id: CARD, name: 'Cartão Nubank' }]}
    />,
  );
  return { onSubmit };
}

/** Opens an EntitySelect combobox by label and clicks the named option. */
function pickEntity(label: string, optionName: string) {
  fireEvent.click(screen.getByRole('combobox', { name: label }));
  fireEvent.click(screen.getByRole('option', { name: optionName }));
}

describe('TransactionFormModal', () => {
  it('shows the origin selector for expenses (conta OR cartão)', () => {
    setup();
    expect(screen.getByLabelText('Origem')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Conta' })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Origem'), { target: { value: 'card' } });
    expect(screen.getByRole('combobox', { name: 'Cartão de crédito' })).toBeInTheDocument();
  });

  it('shows the origin selector for income too (card = estorno/reembolso/pagamento)', () => {
    setup();
    fireEvent.change(screen.getByLabelText('Tipo'), { target: { value: 'income' } });
    expect(screen.getByLabelText('Origem')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Conta' })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Origem'), { target: { value: 'card' } });
    expect(screen.getByRole('combobox', { name: 'Cartão de crédito' })).toBeInTheDocument();
  });

  it('submits a valid single expense with an account origin', async () => {
    const { onSubmit } = setup();
    fireEvent.change(screen.getByLabelText('Descrição'), { target: { value: 'Aluguel' } });
    fireEvent.change(screen.getByLabelText('Valor'), { target: { value: '120000' } });
    pickEntity('Categoria', 'Moradia');
    pickEntity('Conta', 'Conta Corrente');

    fireEvent.click(screen.getByRole('button', { name: 'Criar transação' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        recurrence: 'single',
        type: 'expense',
        description: 'Aluguel',
        amount: '1200.00',
        categoryId: CAT_EXPENSE,
        accountId: ACC,
        creditCardId: undefined,
      }),
    );
  });

  it('blocks submit and flags the amount when it is missing', async () => {
    const { onSubmit } = setup();
    fireEvent.change(screen.getByLabelText('Descrição'), { target: { value: 'Aluguel' } });
    pickEntity('Categoria', 'Moradia');
    pickEntity('Conta', 'Conta Corrente');

    fireEvent.click(screen.getByRole('button', { name: 'Criar transação' }));

    expect(await screen.findByText('Valor deve ser maior que zero')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
