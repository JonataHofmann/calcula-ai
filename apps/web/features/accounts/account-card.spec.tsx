import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AccountDto } from '@finance/contracts';
import { AccountCard } from './account-card';

afterEach(cleanup);

const account: AccountDto = {
  id: '11111111-1111-1111-1111-111111111111',
  name: 'Conta Corrente',
  bankId: 'nubank',
  icon: 'utensils',
  color: 'primary',
};

describe('AccountCard', () => {
  it('renders the account name and bank', () => {
    render(<AccountCard account={account} onEdit={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText('Conta Corrente')).toBeInTheDocument();
    expect(screen.getByText('Nubank')).toBeInTheDocument();
  });

  it('fires edit and delete callbacks with the account', () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    render(<AccountCard account={account} onEdit={onEdit} onDelete={onDelete} />);

    fireEvent.click(screen.getByRole('button', { name: 'Editar Conta Corrente' }));
    expect(onEdit).toHaveBeenCalledWith(account);

    fireEvent.click(screen.getByRole('button', { name: 'Excluir Conta Corrente' }));
    expect(onDelete).toHaveBeenCalledWith(account);
  });
});
