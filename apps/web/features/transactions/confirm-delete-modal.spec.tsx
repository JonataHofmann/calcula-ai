import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TransactionDto } from '@finance/contracts';
import { ConfirmDeleteModal } from './confirm-delete-modal';

afterEach(cleanup);

const tx = { description: 'Aluguel' } as TransactionDto;

describe('ConfirmDeleteModal', () => {
  it('shows the transaction description and confirms on Excluir', async () => {
    const onConfirm = vi.fn();
    render(<ConfirmDeleteModal open transaction={tx} onClose={vi.fn()} onConfirm={onConfirm} />);

    expect(screen.getByText(/Aluguel/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Excluir' }));

    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
  });

  it('closes without confirming when cancelled', () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    render(<ConfirmDeleteModal open transaction={tx} onClose={onClose} onConfirm={onConfirm} />);

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
