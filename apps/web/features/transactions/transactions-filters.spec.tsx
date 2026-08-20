import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CategoryTreeDto } from '@finance/contracts';
import { TransactionsFilters } from './transactions-filters';
import type { TransactionFilters } from './transactions-ui.slice';

afterEach(cleanup);

const categories: CategoryTreeDto = {
  expense: [{ id: 'cat-1', name: 'Moradia', color: null, icon: null, children: [] }],
  income: [],
} as unknown as CategoryTreeDto;

function setup(filters: TransactionFilters = {}) {
  const onChange = vi.fn();
  const onClear = vi.fn();
  render(
    <TransactionsFilters
      filters={filters}
      onChange={onChange}
      onClear={onClear}
      categories={categories}
      accounts={[{ id: 'acc-1', name: 'Nubank' }]}
      cards={[{ id: 'card-1', name: 'Inter' }]}
      groupCreditCardExpenses={true}
      onGroupCreditCardExpensesChange={vi.fn()}
      showOverdue={true}
      onShowOverdueChange={vi.fn()}
    />,
  );
  return { onChange, onClear };
}

describe('TransactionsFilters', () => {
  it('emits a search patch', () => {
    const { onChange } = setup();
    fireEvent.change(screen.getByLabelText('Buscar'), { target: { value: 'aluguel' } });
    expect(onChange).toHaveBeenCalledWith({ search: 'aluguel' });
  });

  it('clears a filter when the field is emptied', () => {
    const { onChange } = setup({ search: 'x' });
    fireEvent.change(screen.getByLabelText('Buscar'), { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith({ search: undefined });
  });

  it('hides advanced filters until the toggle is opened', () => {
    setup();
    expect(screen.queryByLabelText('Recorrência')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Filtros/ }));
    expect(screen.getByLabelText('Recorrência')).toBeInTheDocument();
  });

  it('emits the chosen recurrence', () => {
    const { onChange } = setup();
    fireEvent.click(screen.getByRole('button', { name: /Filtros/ }));
    fireEvent.change(screen.getByLabelText('Recorrência'), { target: { value: 'fixed' } });
    expect(onChange).toHaveBeenCalledWith({ recurrence: 'fixed' });
  });

  it('auto-expands and shows the clear button when an advanced filter is active', () => {
    const { onClear } = setup({ type: 'expense' });
    fireEvent.click(screen.getByRole('button', { name: /Limpar filtros/ }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });
});
