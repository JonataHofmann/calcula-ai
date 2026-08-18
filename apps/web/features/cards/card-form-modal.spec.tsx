import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CardFormModal } from './card-form-modal';

afterEach(cleanup);

function setup(onSubmit = vi.fn()) {
  render(<CardFormModal open onClose={vi.fn()} onSubmit={onSubmit} />);
  return { onSubmit };
}

describe('CardFormModal', () => {
  it('renders the create title', () => {
    setup();
    expect(screen.getByText('Novo cartão')).toBeInTheDocument();
  });

  it('blocks submit and shows validation errors on empty/invalid fields', async () => {
    const { onSubmit } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Criar cartão' }));
    expect(await screen.findByText('Informe os 4 últimos dígitos')).toBeInTheDocument();
    expect(screen.getByText('Nome é obrigatório')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('rejects last digits that are not exactly 4 numbers', async () => {
    const { onSubmit } = setup();
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Nubank' } });
    fireEvent.change(screen.getByLabelText('4 últimos dígitos'), {
      target: { value: '12' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Criar cartão' }));
    expect(await screen.findByText('Informe os 4 últimos dígitos')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits valid values', async () => {
    const { onSubmit } = setup();
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Nubank' } });
    fireEvent.change(screen.getByLabelText('4 últimos dígitos'), {
      target: { value: '1234' },
    });
    fireEvent.change(screen.getByLabelText('Limite'), { target: { value: '5000.00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar cartão' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Nubank',
        lastDigits: '1234',
        limit: '5000.00',
        brandId: 'visa',
        dueDay: 10,
        closingDay: 3,
      }),
    );
  });
});
