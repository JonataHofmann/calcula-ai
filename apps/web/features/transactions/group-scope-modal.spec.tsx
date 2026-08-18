import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GroupScopeModal } from './group-scope-modal';

afterEach(cleanup);

describe('GroupScopeModal', () => {
  it('offers the three scopes and confirms with the picked one', async () => {
    const onConfirm = vi.fn();
    render(<GroupScopeModal open action="edit" onClose={vi.fn()} onConfirm={onConfirm} />);

    expect(screen.getByText('Editar recorrência')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Esta e as próximas' }));

    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith('future'));
  });

  it('titles by action and passes the delete scope', async () => {
    const onConfirm = vi.fn();
    render(<GroupScopeModal open action="delete" onClose={vi.fn()} onConfirm={onConfirm} />);

    expect(screen.getByText('Excluir recorrência')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Todas as ocorrências' }));

    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith('all'));
  });

  it('closes without confirming when cancelled', () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    render(<GroupScopeModal open action="edit" onClose={onClose} onConfirm={onConfirm} />);

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
