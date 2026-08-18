import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AccountFormModal } from './account-form-modal';

afterEach(cleanup);

function setup(onSubmit = vi.fn()) {
  render(<AccountFormModal open onClose={vi.fn()} onSubmit={onSubmit} />);
  return { onSubmit };
}

describe('AccountFormModal', () => {
  it('renders the create title', () => {
    setup();
    expect(screen.getByText('Nova conta')).toBeInTheDocument();
  });

  it('blocks submit and shows a required-name error on empty name', async () => {
    const { onSubmit } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }));
    expect(await screen.findByText('Nome é obrigatório')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits valid values (defaults for bank/icon/color)', async () => {
    const { onSubmit } = setup();
    fireEvent.change(screen.getByLabelText('Nome'), {
      target: { value: 'Conta Corrente' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Conta Corrente',
        bankId: 'nubank',
        icon: 'wallet',
        color: 'primary',
      }),
    );
  });
});
