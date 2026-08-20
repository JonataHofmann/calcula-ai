import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ConnectTokenResponse } from '@finance/contracts';
import { ConnectFlow } from './connect-flow';

const createConnectTokenMock = vi.hoisted(() => vi.fn());
const completeBankConnectionMock = vi.hoisted(() => vi.fn());
const openPluggyConnectMock = vi.hoisted(() => vi.fn());

vi.mock('./bank-connections-api', () => ({
  createConnectToken: createConnectTokenMock,
  completeBankConnection: completeBankConnectionMock,
}));

vi.mock('./pluggy-connect-widget', () => ({
  openPluggyConnect: openPluggyConnectMock,
}));

afterEach(() => {
  cleanup();
  createConnectTokenMock.mockReset();
  completeBankConnectionMock.mockReset();
  openPluggyConnectMock.mockReset();
});

function renderFlow() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <ConnectFlow />
    </QueryClientProvider>,
  );
}

const TOKEN_RESPONSE: ConnectTokenResponse = {
  connectToken: 'connect-token-1',
  expiresAt: '2026-08-19T12:00:00.000Z',
};

describe('ConnectFlow', () => {
  it('creates a connect token then opens the widget with it', async () => {
    createConnectTokenMock.mockResolvedValue(TOKEN_RESPONSE);
    openPluggyConnectMock.mockResolvedValue(undefined);
    renderFlow();

    fireEvent.click(screen.getByRole('button', { name: 'Conectar banco' }));

    await waitFor(() => expect(createConnectTokenMock).toHaveBeenCalledWith({ mode: 'create' }));
    await waitFor(() =>
      expect(openPluggyConnectMock).toHaveBeenCalledWith(
        'connect-token-1',
        expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) }),
      ),
    );
  });

  it('completes the bank connection with the item id on widget success', async () => {
    createConnectTokenMock.mockResolvedValue(TOKEN_RESPONSE);
    completeBankConnectionMock.mockResolvedValue({});
    openPluggyConnectMock.mockImplementation(async (_token, handlers) => {
      handlers.onSuccess('item-123');
    });
    renderFlow();

    fireEvent.click(screen.getByRole('button', { name: 'Conectar banco' }));

    await waitFor(() =>
      expect(completeBankConnectionMock).toHaveBeenCalledWith({ pluggyItemId: 'item-123' }),
    );
  });

  it('shows an error message when the connect token request fails', async () => {
    createConnectTokenMock.mockRejectedValue(new Error('network error'));
    renderFlow();

    fireEvent.click(screen.getByRole('button', { name: 'Conectar banco' }));

    await waitFor(() =>
      expect(
        screen.getByText('Não foi possível iniciar a conexão com o banco.'),
      ).toBeInTheDocument(),
    );
  });

  it('shows an error message when the widget reports an error', async () => {
    createConnectTokenMock.mockResolvedValue(TOKEN_RESPONSE);
    openPluggyConnectMock.mockImplementation(async (_token, handlers) => {
      handlers.onError(new Error('widget error'));
    });
    renderFlow();

    fireEvent.click(screen.getByRole('button', { name: 'Conectar banco' }));

    await waitFor(() =>
      expect(
        screen.getByText('A conexão com o banco falhou. Tente novamente.'),
      ).toBeInTheDocument(),
    );
  });

  it('shows an error message when completing the bank connection fails', async () => {
    createConnectTokenMock.mockResolvedValue(TOKEN_RESPONSE);
    completeBankConnectionMock.mockRejectedValue(new Error('server error'));
    openPluggyConnectMock.mockImplementation(async (_token, handlers) => {
      handlers.onSuccess('item-123');
    });
    renderFlow();

    fireEvent.click(screen.getByRole('button', { name: 'Conectar banco' }));

    await waitFor(() =>
      expect(
        screen.getByText('Não foi possível concluir a conexão com o banco.'),
      ).toBeInTheDocument(),
    );
  });
});
